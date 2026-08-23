# Desktop AI prompt interception checkpoint

## Implemented

- Windows x64 native helper watches global keyboard and mouse input.
- Supported standalone AI apps include ChatGPT, Claude, and Codex.
- Supported IDE families include VS Code, Cursor, Windsurf, VSCodium, Zed, Visual Studio, and JetBrains IDEs.
- IDE interception requires chat/prompt/agent context in the focused accessibility tree, so ordinary code editors are not captured.
- Browsers are intentionally excluded; browser capture belongs to the existing extension.
- Pressing Enter in a supported prompt field captures the prompt before submission.
- Clicking a recognized send button captures the prompt before submission.
- A successful capture focuses the Interviewer app and pre-fills the captured prompt.
- The captured source window is retained for the current flow. The final prompt can be returned to that input with the `아래 채팅창에 입력하기` button without sending it automatically.
- Native JSON output explicitly uses UTF-8, preserving Korean prompts between the helper and Electron.
- Shift+Enter, IME composition, password fields, empty text, and oversized input are ignored.
- Interception is off by default and can be enabled or disabled in the desktop UI.
- Codex is recognized by its `OpenAI.Codex` executable path even when its process is named `ChatGPT.exe`.

## Verification

- Native x64 helper compilation passes.
- Desktop production build passes.
- 64 automated tests pass.
- Lint and whitespace checks pass.

## Remaining live verification

Windows prevented the isolated test window from taking foreground focus while Codex was active. The test harness now refuses to synthesize input unless it has verified that its own window is foreground. Therefore live Enter/click suppression still needs a manual smoke test in the supported desktop apps before this feature is considered production-ready.
