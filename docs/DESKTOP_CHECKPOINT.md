# Desktop App 체크포인트

마지막 갱신: 2026-08-23 (Asia/Seoul)

## 구현 상태

- `apps/desktop/`에 실제 Windows 창으로 실행되는 Electron 앱을 추가했다.
- `packages/core/`의 Interview Engine, 질문 생성, 대상 추천, Prompt Optimizer,
  Preference Service를 직접 사용한다.
- 데스크톱 고유 연결은 Electron preload/IPC 경계 뒤에 둔다.
  - 시스템 클립보드에서 원본 프롬프트 가져오기
  - 완성된 프롬프트를 시스템 클립보드에 복사
  - 전역 단축키로 복사된 프롬프트 캡처
  - 지원되는 데스크톱 AI 앱과 IDE AI 채팅의 Enter/전송 버튼 가로채기
  - 완성 프롬프트를 캡처한 원래 채팅 입력창으로 반환
- Provider는 로컬 시뮬레이션과 실제 Gemini API 중 선택할 수 있다.
- Gemini API 키는 사용자가 저장 버튼을 눌렀을 때만 Windows `safeStorage`로 암호화해 저장한다.
- 선호도 데이터는 데스크톱 앱의 localStorage에 별도 저장한다.
- Chrome API, Chrome Storage, 확장 프로그램 메시지에 의존하지 않는다.

## Protocol

`packages/protocol/`에 플랫폼 공용 메시지·이벤트·Target Adapter·Registry를 구현했다.
Desktop, Browser, CLI Adapter가 동일한 경계를 사용할 수 있다.

## 실행

```bash
npm run dev:desktop
npm run build:desktop
npm run start:desktop
```

`start:desktop`은 `dist-desktop/`을 빌드하고 독립 Electron 창을 실행한다.

## 검증

```text
npm test                  21 files / 69 tests PASS
npm run typecheck:protocol PASS
npm run build:desktop      PASS
npm run lint               PASS
Electron window            실행 및 렌더링 확인
Native UTF-8 self-test     PASS
```

현재 실행 창에서 사용자 입력이 감지된 뒤에는 자동 UI 입력을 중단했다. 창 렌더링, Desktop 표시,
프롬프트 입력 영역, Provider 선택, 대상 표시, 클립보드 버튼 노출까지 확인했다.

## 다음 데스크톱 단계

프로젝트/인터뷰 기록 영구 저장은 `docs/PERSISTENCE_CHECKPOINT.md` 범위로 완료했다.

Global Hotkey 및 Clipboard Capture Adapter는 `docs/GLOBAL_CAPTURE_CHECKPOINT.md` 범위로 완료했다.

Codex·Claude Code 전달 Adapter는 `docs/DESKTOP_DELIVERY_ADAPTER_CHECKPOINT.md` 범위로 완료했다.

Windows x64 패키징과 NSIS 설치 프로그램 생성은 `docs/WINDOWS_PACKAGING_CHECKPOINT.md` 범위로 완료했다.
