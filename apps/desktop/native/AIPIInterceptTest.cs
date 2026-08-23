using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal sealed class InterceptTestForm : Form
{
    private readonly TextBox input = new TextBox();
    private readonly Button send = new Button();
    private bool submitted;
    private readonly string mode;

    internal InterceptTestForm(string mode)
    {
        this.mode = mode;
        Text = "AIPI Intercept Test Target";
        Width = 520;
        Height = 180;
        StartPosition = FormStartPosition.CenterScreen;
        TopMost = true;

        input.Left = 20;
        input.Top = 20;
        input.Width = 460;
        input.Text = mode == "click" ? "클릭 가로채기 테스트" : "엔터 가로채기 테스트";
        Controls.Add(input);

        send.Left = 360;
        send.Top = 60;
        send.Width = 120;
        send.Text = "Send message";
        send.AccessibleName = "Send message";
        send.Click += delegate { submitted = true; };
        Controls.Add(send);
        AcceptButton = send;

        Shown += delegate
        {
            Activate();
            BringToFront();
            SetForegroundWindow(Handle);
            input.Focus();
            Timer trigger = new Timer();
            trigger.Interval = 500;
            trigger.Tick += delegate
            {
                trigger.Stop();
                Activate();
                BringToFront();
                SetForegroundWindow(Handle);
                input.Focus();
                if (GetForegroundWindow() != Handle)
                {
                    Console.WriteLine("focus-failed");
                    Environment.ExitCode = 7;
                    Close();
                    return;
                }
                if (this.mode == "click")
                {
                    Point point = send.PointToScreen(new Point(send.Width / 2, send.Height / 2));
                    SetCursorPos(point.X, point.Y);
                    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
                    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
                }
                else
                {
                    keybd_event(0x0D, 0, 0, UIntPtr.Zero);
                    keybd_event(0x0D, 0, 0x0002, UIntPtr.Zero);
                }
            };
            trigger.Start();

            Timer finish = new Timer();
            finish.Interval = 1500;
            finish.Tick += delegate
            {
                finish.Stop();
                Console.WriteLine(submitted ? "submitted" : "blocked");
                Environment.ExitCode = submitted ? 5 : 0;
                Close();
            };
            finish.Start();
        };
    }

    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
    [DllImport("user32.dll")] private static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
}

internal static class AIPIInterceptTest
{
    [STAThread]
    private static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new InterceptTestForm(args.Length > 0 ? args[0] : "enter"));
    }
}
