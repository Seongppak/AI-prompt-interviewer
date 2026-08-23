# Desktop 전달 Adapter 체크포인트

마지막 갱신: 2026-08-23 (Asia/Seoul)

## 구현

- `adapters/desktop/`에 공용 `TargetAdapter`를 구현하는 `DesktopChatTargetAdapter`를 추가했다.
- Adapter는 활성 대상 감지, 캡처 프롬프트 읽기, 완성 프롬프트 반환을 `DesktopPromptPort` 뒤로 분리한다.
- React UI는 Electron IPC를 직접 해석하지 않고 Adapter의 `sendPrompt()`를 호출한다.
- Codex는 `codex`, IDE 접근성 문맥에서 Claude가 확인되면 `claude-code` 대상으로 연결한다.
- 실제 반환은 기존 Windows x64 Helper가 원래 창을 활성화한 뒤 입력 요소를 전체 선택하고 UTF-8 클립보드로 교체한다.
- 프롬프트는 자동 전송하지 않는다.

## 검증

```text
npm run typecheck:desktop-adapter PASS
npm test                           22 files / 67 tests PASS
npm run build:desktop              PASS
npm run lint                       PASS
git diff --check                   PASS
Native UTF-8 self-test             PASS
```

## 다음 단계

Windows x64 패키징과 설치 프로그램 생성이다. 설치 파일 생성은 배포 준비에 해당하므로 사용자 승인 후 진행한다.
