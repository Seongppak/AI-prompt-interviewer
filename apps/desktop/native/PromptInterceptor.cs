using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Forms;

internal static class PromptInterceptor
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WH_MOUSE_LL = 14;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_LBUTTONUP = 0x0202;
    private const int VK_RETURN = 0x0D;
    private const int VK_SHIFT = 0x10;
    private const int GCS_COMPSTR = 0x0008;

    private static readonly LowLevelProc KeyboardProc = KeyboardHook;
    private static readonly LowLevelProc MouseProc = MouseHook;
    private static IntPtr keyboardHook = IntPtr.Zero;
    private static IntPtr mouseHook = IntPtr.Zero;
    private static bool suppressReturnKeyUp;
    private static bool suppressLeftButtonUp;
    private static bool debug;

    [STAThread]
    private static void Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        foreach (string argument in args)
        {
            if (argument == "--self-test-utf8")
            {
                Console.Out.WriteLine("{\"text\":\"한글 프롬프트\"}");
                return;
            }
            if (!argument.StartsWith("--paste-window=")) continue;
            long rawWindow;
            if (!Int64.TryParse(argument.Substring("--paste-window=".Length), out rawWindow))
            {
                Environment.ExitCode = 3;
                return;
            }
            Environment.ExitCode = PasteToWindow(new IntPtr(rawWindow)) ? 0 : 4;
            return;
        }
        foreach (string argument in args) if (argument == "--debug") debug = true;
        keyboardHook = SetHook(WH_KEYBOARD_LL, KeyboardProc);
        mouseHook = SetHook(WH_MOUSE_LL, MouseProc);
        if (keyboardHook == IntPtr.Zero || mouseHook == IntPtr.Zero)
        {
            Console.Error.WriteLine("hook-registration-failed");
            Environment.ExitCode = 2;
            return;
        }

        Console.Error.WriteLine("ready");
        Application.Run(new ApplicationContext());
        UnhookWindowsHookEx(keyboardHook);
        UnhookWindowsHookEx(mouseHook);
    }

    private static IntPtr KeyboardHook(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0)
        {
            int virtualKey = Marshal.ReadInt32(data);
            if (message == (IntPtr)WM_KEYUP && virtualKey == VK_RETURN && suppressReturnKeyUp)
            {
                suppressReturnKeyUp = false;
                return (IntPtr)1;
            }

            if (message == (IntPtr)WM_KEYDOWN && virtualKey == VK_RETURN)
            {
                if (IsKeyDown(VK_SHIFT) || HasImeComposition()) return CallNextHookEx(keyboardHook, code, message, data);
                Capture capture;
                if (TryCaptureFocusedPrompt("enter", out capture))
                {
                    suppressReturnKeyUp = true;
                    Emit(capture);
                    return (IntPtr)1;
                }
            }
        }
        return CallNextHookEx(keyboardHook, code, message, data);
    }

    private static IntPtr MouseHook(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0)
        {
            if (message == (IntPtr)WM_LBUTTONUP && suppressLeftButtonUp)
            {
                suppressLeftButtonUp = false;
                return (IntPtr)1;
            }

            if (message == (IntPtr)WM_LBUTTONDOWN)
            {
                MSLLHOOKSTRUCT info = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(data, typeof(MSLLHOOKSTRUCT));
                Capture capture;
                if (IsSendButtonAt(info.point) && TryCaptureFocusedPrompt("click", out capture))
                {
                    suppressLeftButtonUp = true;
                    Emit(capture);
                    return (IntPtr)1;
                }
            }
        }
        return CallNextHookEx(mouseHook, code, message, data);
    }

    private static bool TryCaptureFocusedPrompt(string trigger, out Capture capture)
    {
        capture = null;
        IntPtr foreground = GetForegroundWindow();
        TargetProfile target;
        int processId;
        if (!TryGetAllowedTarget(foreground, out processId, out target)) { Debug("target-not-allowed"); return false; }

        try
        {
            AutomationElement focused = AutomationElement.FocusedElement;
            if (focused == null || focused.Current.ProcessId != processId || focused.Current.IsPassword) { Debug("focused-element-rejected"); return false; }
            if (target.RequiresPromptContext)
            {
                string promptContext;
                if (!TryGetPromptContext(focused, out promptContext)) { Debug("prompt-context-not-found"); return false; }
                if (promptContext.Contains("claude"))
                    target = new TargetProfile("claude-code", target.SourceName + " · Claude Code", true);
            }
            string prompt = ReadText(focused);
            if (String.IsNullOrWhiteSpace(prompt) || prompt.Length > 100000) { Debug("focused-text-empty"); return false; }
            capture = new Capture(prompt.Trim(), target.TargetId, target.SourceName, trigger, foreground);
            return true;
        }
        catch (Exception error)
        {
            Debug("capture-error:" + error.GetType().Name);
            return false;
        }
    }

    private static string ReadText(AutomationElement element)
    {
        object pattern;
        if (element.TryGetCurrentPattern(ValuePattern.Pattern, out pattern))
            return ((ValuePattern)pattern).Current.Value;
        if (element.TryGetCurrentPattern(TextPattern.Pattern, out pattern))
            return ((TextPattern)pattern).DocumentRange.GetText(-1);
        return null;
    }

    private static bool IsSendButtonAt(POINT point)
    {
        IntPtr foreground = GetForegroundWindow();
        int ignored;
        TargetProfile target;
        if (!TryGetAllowedTarget(foreground, out ignored, out target)) return false;
        try
        {
            AutomationElement element = AutomationElement.FromPoint(new Point(point.x, point.y));
            if (element == null || element.Current.ControlType != ControlType.Button) return false;
            string descriptor = ((element.Current.AutomationId ?? "") + " " + (element.Current.Name ?? "")).ToLowerInvariant();
            string[] tokens = { "send", "submit", "전송", "보내기", "메시지 보내" };
            foreach (string token in tokens) if (descriptor.Contains(token)) return true;
        }
        catch { }
        return false;
    }

    private static bool TryGetAllowedTarget(IntPtr window, out int processId, out TargetProfile target)
    {
        processId = 0;
        target = null;
        uint rawProcessId;
        GetWindowThreadProcessId(window, out rawProcessId);
        if (rawProcessId == 0) return false;
        processId = (int)rawProcessId;
        try
        {
            Process process = Process.GetProcessById(processId);
            string name = process.ProcessName.ToLowerInvariant();
            string path = "";
            try { path = process.MainModule.FileName.ToLowerInvariant(); } catch { }
            Debug("candidate:" + name + ":" + path);
            if (path.Contains("openai.codex"))
            {
                target = new TargetProfile("codex", "Codex", false);
                return true;
            }
            if (name == "chatgpt" && (path.Contains("openai.chatgpt") || path.Contains("chatgpt")))
            {
                target = new TargetProfile("chatgpt", "ChatGPT", false);
                return true;
            }
            if (name == "claude" || path.Contains("claude"))
            {
                target = new TargetProfile("claude", "Claude", false);
                return true;
            }
            if (name == "aipiintercepttest")
            {
                target = new TargetProfile("test", "테스트 앱", false);
                return true;
            }
            if (name == "code") { target = new TargetProfile("codex", "VS Code", true); return true; }
            if (name == "cursor") { target = new TargetProfile("codex", "Cursor", true); return true; }
            if (name == "windsurf") { target = new TargetProfile("codex", "Windsurf", true); return true; }
            if (name == "vscodium") { target = new TargetProfile("codex", "VSCodium", true); return true; }
            if (name == "zed") { target = new TargetProfile("codex", "Zed", true); return true; }
            string[] jetBrains = { "devenv", "idea64", "pycharm64", "webstorm64", "rider64", "clion64", "goland64", "rustrover64" };
            foreach (string ide in jetBrains)
                if (name == ide) { target = new TargetProfile("codex", process.ProcessName, true); return true; }
        }
        catch { }
        return false;
    }

    private static bool TryGetPromptContext(AutomationElement element, out string matchedContext)
    {
        matchedContext = null;
        bool matched = false;
        StringBuilder context = new StringBuilder();
        string[] promptTokens = {
            "chat", "prompt", "ask", "agent", "copilot", "composer", "message", "assistant",
            "interactive", "질문", "메시지", "프롬프트", "에이전트", "채팅"
        };
        AutomationElement current = element;
        for (int depth = 0; current != null && depth < 8; depth++)
        {
            try
            {
                string descriptor = ((current.Current.AutomationId ?? "") + " "
                    + (current.Current.Name ?? "") + " " + (current.Current.ClassName ?? "")).ToLowerInvariant();
                context.Append(' ').Append(descriptor);
                foreach (string token in promptTokens)
                {
                    if (!descriptor.Contains(token)) continue;
                    matched = true;
                    break;
                }
                current = TreeWalker.ControlViewWalker.GetParent(current);
            }
            catch { return false; }
        }
        if (matched) matchedContext = context.ToString();
        return matched;
    }

    private static bool PasteToWindow(IntPtr window)
    {
        if (window == IntPtr.Zero || !IsWindow(window)) return false;
        ShowWindowAsync(window, 9);
        uint ignoredProcessId;
        uint targetThread = GetWindowThreadProcessId(window, out ignoredProcessId);
        uint currentThread = GetCurrentThreadId();
        bool attached = targetThread != 0 && targetThread != currentThread
            && AttachThreadInput(currentThread, targetThread, true);
        try
        {
            BringWindowToTop(window);
            SetForegroundWindow(window);
        }
        finally
        {
            if (attached) AttachThreadInput(currentThread, targetThread, false);
        }
        Thread.Sleep(180);
        if (GetForegroundWindow() != window) return false;
        try
        {
            AutomationElement focused = AutomationElement.FocusedElement;
            if (focused == null || focused.Current.IsPassword || ReadText(focused) == null) return false;
        }
        catch { return false; }
        keybd_event(0x11, 0, 0, UIntPtr.Zero);
        keybd_event(0x41, 0, 0, UIntPtr.Zero);
        keybd_event(0x41, 0, 0x0002, UIntPtr.Zero);
        keybd_event(0x11, 0, 0x0002, UIntPtr.Zero);
        Thread.Sleep(40);
        keybd_event(0x11, 0, 0, UIntPtr.Zero);
        keybd_event(0x56, 0, 0, UIntPtr.Zero);
        keybd_event(0x56, 0, 0x0002, UIntPtr.Zero);
        keybd_event(0x11, 0, 0x0002, UIntPtr.Zero);
        return true;
    }

    private static bool HasImeComposition()
    {
        GUITHREADINFO info = new GUITHREADINFO();
        info.cbSize = Marshal.SizeOf(info);
        uint ignoredProcessId;
        uint threadId = GetWindowThreadProcessId(GetForegroundWindow(), out ignoredProcessId);
        if (!GetGUIThreadInfo(threadId, ref info) || info.hwndFocus == IntPtr.Zero) return false;
        IntPtr context = ImmGetContext(info.hwndFocus);
        if (context == IntPtr.Zero) return false;
        try { return ImmGetCompositionString(context, GCS_COMPSTR, null, 0) > 0; }
        finally { ImmReleaseContext(info.hwndFocus, context); }
    }

    private static bool IsKeyDown(int key) { return (GetAsyncKeyState(key) & 0x8000) != 0; }
    private static void Debug(string message) { if (debug) Console.Error.WriteLine("debug:" + message); }

    private static void Emit(Capture capture)
    {
        Console.Out.WriteLine("{\"type\":\"capture\",\"prompt\":\"" + Escape(capture.Prompt)
            + "\",\"target\":\"" + Escape(capture.Target) + "\",\"source\":\"" + Escape(capture.Source)
            + "\",\"window\":\"" + capture.Window.ToInt64() + "\",\"trigger\":\"" + capture.Trigger + "\"}");
        Console.Out.Flush();
    }

    private static string Escape(string value)
    {
        StringBuilder output = new StringBuilder();
        foreach (char character in value)
        {
            switch (character)
            {
                case '\\': output.Append("\\\\"); break;
                case '"': output.Append("\\\""); break;
                case '\n': output.Append("\\n"); break;
                case '\r': output.Append("\\r"); break;
                case '\t': output.Append("\\t"); break;
                default:
                    if (character < 32) output.Append("\\u" + ((int)character).ToString("x4"));
                    else output.Append(character);
                    break;
            }
        }
        return output.ToString();
    }

    private static IntPtr SetHook(int hookId, LowLevelProc callback)
    {
        using (Process process = Process.GetCurrentProcess())
        using (ProcessModule module = process.MainModule)
            return SetWindowsHookEx(hookId, callback, GetModuleHandle(module.ModuleName), 0);
    }

    private sealed class Capture
    {
        internal readonly string Prompt;
        internal readonly string Target;
        internal readonly string Source;
        internal readonly string Trigger;
        internal readonly IntPtr Window;
        internal Capture(string prompt, string target, string source, string trigger, IntPtr window)
        {
            Prompt = prompt;
            Target = target;
            Source = source;
            Trigger = trigger;
            Window = window;
        }
    }

    private sealed class TargetProfile
    {
        internal readonly string TargetId;
        internal readonly string SourceName;
        internal readonly bool RequiresPromptContext;
        internal TargetProfile(string targetId, string sourceName, bool requiresPromptContext)
        {
            TargetId = targetId;
            SourceName = sourceName;
            RequiresPromptContext = requiresPromptContext;
        }
    }

    private delegate IntPtr LowLevelProc(int code, IntPtr message, IntPtr data);
    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int x; public int y; }
    [StructLayout(LayoutKind.Sequential)] private struct MSLLHOOKSTRUCT { public POINT point; public uint mouseData; public uint flags; public uint time; public IntPtr extraInfo; }
    [StructLayout(LayoutKind.Sequential)] private struct GUITHREADINFO { public int cbSize; public uint flags; public IntPtr hwndActive, hwndFocus, hwndCapture, hwndMenuOwner, hwndMoveSize, hwndCaret; public RECT rcCaret; }
    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int left, top, right, bottom; }

    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelProc callback, IntPtr module, uint threadId);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr window);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool attach);
    [DllImport("user32.dll")] private static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] private static extern bool GetGUIThreadInfo(uint threadId, ref GUITHREADINFO info);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto)] private static extern IntPtr GetModuleHandle(string moduleName);
    [DllImport("imm32.dll")] private static extern IntPtr ImmGetContext(IntPtr window);
    [DllImport("imm32.dll")] private static extern bool ImmReleaseContext(IntPtr window, IntPtr context);
    [DllImport("imm32.dll", CharSet = CharSet.Unicode)] private static extern int ImmGetCompositionString(IntPtr context, int index, byte[] buffer, int bufferLength);
}
