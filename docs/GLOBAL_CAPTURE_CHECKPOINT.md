# Desktop 전역 단축키·클립보드 캡처 체크포인트

마지막 갱신: 2026-08-23 (Asia/Seoul)

## 동작

1. 다른 앱에서 프롬프트로 사용할 텍스트를 복사한다.
2. `Ctrl+Shift+Space`를 누른다.
3. AI Prompt Interviewer 창이 복원·활성화된다.
4. 클립보드 텍스트가 새 프롬프트로 자동 입력된다.

기본 단축키가 다른 프로그램에 이미 등록돼 있으면 `Ctrl+Alt+Space`를 시도한다. 둘 다 등록할 수
없으면 앱 화면에 등록 실패를 표시한다. 현재 Windows 실행 로그에서는 `Ctrl+Shift+Space` 등록에
성공했다.

## 구조

- `adapters/clipboard/`: 플랫폼 독립 Clipboard Target Adapter
- Electron main: `globalShortcut`, 창 복원·활성화, renderer 이벤트 전달
- preload: 캡처 이벤트와 실제 등록 단축키만 제한적으로 노출
- renderer: 캡처된 텍스트를 기존 프로젝트를 덮어쓰지 않는 새 프롬프트로 적용

## 검증

```text
npm run typecheck:clipboard-adapter PASS
npm test                            21 files / 64 tests PASS
npm run build:desktop               PASS
npm run lint                        PASS
Runtime shortcut registration       Ctrl+Shift+Space PASS
```

Windows에서는 선택 영역 전용 clipboard가 없으므로 현재 단계는 사용자가 먼저 복사한 텍스트를
캡처한다. 다른 앱에 강제로 `Ctrl+C` 입력을 주입하지 않아 사용자의 현재 입력과 클립보드를 임의로
변경하지 않는다.
