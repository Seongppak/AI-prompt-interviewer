# AI-prompt-interviewer

AI 사이트에 질문하기 전에 버튼 기반 인터뷰로 프롬프트를 보강해주는 Chrome 확장 프로그램.
Claude Code와도 양방향으로 연결된다.

## 새 기기에서 시작하기

```bash
gh auth login
git clone https://github.com/Seongppak/AI-prompt-interviewer.git
cd AI-prompt-interviewer
npm run setup
```

`npm run setup`이 의존성 설치, 확장 빌드, Claude Code 스킬 연결까지 한다.
여러 번 실행해도 안전하다.

그다음 손으로 할 3가지 (스크립트가 끝에 다시 안내한다):

1. `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램을 로드** → `dist` 폴더 선택
2. 사이드패널 설정에서 **Gemini API 키 입력** — 자격증명이라 기기 간 동기화하지 않는다
3. **Claude Code 재시작** — `~/.claude/skills`를 새로 만든 경우에만 필요

테마와 학습된 선호도(⭐)는 Chrome 계정을 통해 자동으로 따라온다.

## 평소 업데이트

```bash
npm run sync    # git pull + 빌드
```

확장 **코드**가 바뀐 경우에는 `chrome://extensions`에서 **↻ 리로드**가 추가로 필요하다.
빌드만으로는 반영되지 않고, Chrome 재시작으로도 안 된다.
`prompts/targets.md`만 고쳤다면 Claude Code 쪽은 즉시 반영된다.

## 운영 연결 전 테스트 앱

새 Core 로직과 기능은 운영 확장에 연결하기 전에 별도의 테스트 앱에서 먼저 검증한다.
기본값은 Fake Provider이며, 화면에서 **실제 Gemini API** 모드를 선택하면 기존 확장과 같은
Gemini `generateContent` 흐름도 검증할 수 있다. 테스트 앱에 입력한 API 키는 페이지 메모리에만
유지되고 Storage나 로그에 저장되지 않는다. 테스트 앱은 Chrome API와 운영 Storage를 사용하지 않는다.

```bash
npm run dev:test-app       # 로컬 테스트 앱 실행
npm run build:test-app     # 전용 타입 검사 + 빌드
npm run dev:desktop        # 실제 데스크톱 창 개발 실행
npm run start:desktop      # 데스크톱 빌드 후 실행
```

빌드 결과는 운영 확장의 `dist`와 분리된 `dist-test-app`에 생성된다. 기능 검증과 사용자
체크포인트를 통과한 뒤에만 운영 Adapter에 연결하고, 배포는 사용자가 명시적으로 요청할 때만 한다.
화면 상단의 **로그 확인** 메뉴에서 테스트 동작과 오류를 확인하거나 로그 파일로 받을 수 있다.

## 쓰는 법

### 브라우저에서

지원 사이트(ChatGPT, Gemini, Grok, Claude, Perplexity, Copilot)에서 질문을 입력하고
Enter를 누르면 확장이 가로채서 인터뷰를 띄운다. 답을 고르면 대상 AI에 맞게 최적화된
프롬프트를 입력창에 넣어준다.

사이드패널의 **📤 Claude Code로 보내기**를 누르면 프롬프트가 파일로 떨어진다.

### Claude Code에서

| 명령 | 하는 일 |
|---|---|
| `/inbox` | 확장에서 보낸 프롬프트를 받아 **작업을 수행**한다 |
| `/optimize-prompt <요청>` | 인터뷰 후 **프롬프트 자체를 결과물로** 만들어 준다 |

`/optimize-prompt`로 만든 프롬프트는 브라우저로 바로 보낼 수 있다:

```bash
node scripts/send-to-browser.mjs chatgpt "<프롬프트>"
```

URL 프래그먼트(`#aipi=`)로 넘기기 때문에 대상 사이트가 프리필 파라미터를 지원하지 않아도
동작하고, 프래그먼트는 서버로 전송되지 않아 프롬프트가 대상 사이트 로그에 남지 않는다.
입력창에 넣기만 하고 **전송은 하지 않는다.**

## 구조

| 경로 | 역할 |
|---|---|
| `packages/core/` | 플랫폼 독립 인터뷰·질문 생성·AI 추천·Prompt Builder/Optimizer |
| `apps/test-app/` | 운영 연결 전 Fake Provider 기반 전체 흐름 검증 |
| `apps/desktop/` | Core 기반 Electron 데스크톱 앱, Clipboard IPC, 프로젝트 영구 저장 |
| `packages/protocol/` | Desktop/Browser/CLI 공용 메시지·이벤트·Target Adapter 경계 |
| `adapters/browser/` | 기존 확장과 분리된 Browser Target/Storage Adapter shadow 구현 |
| `adapters/gemini/` | Core의 AI 요청을 Gemini `generateContent`로 실행하는 독립 Adapter |
| `src/content/` | 질문 가로채기, 입력창에 프롬프트 삽입, `#aipi=` 수신 |
| `src/background/` | Gemini로 인터뷰 문항 생성, 사이드패널 관리 |
| `src/sidepanel/` | 인터뷰 UI, 프롬프트 조립·최적화, Claude Code로 전달 |
| `src/shared/` | 사이트 설정, 저장소, 프로젝트·선호도 모델 |
| `prompts/targets.md` | **대상 AI별 최적화 지침.** 품질을 결정하는 핵심 자산 |
| `skills/` | Claude Code 스킬 (`~/.claude/skills`로 연결됨) |

`prompts/targets.md`는 확장과 Claude Code 스킬이 **함께 읽는 단일 원본**이다.
확장은 빌드 시 `?raw`로 가져오고, 스킬은 런타임에 직접 읽는다.

공용 Core를 변경할 때는 `npm test`, `npm run build:test-app`, `npm run build` 순서로
검증하고, 테스트 앱 체크포인트를 통과한 변경만 운영 Adapter에 연결한다.

## 저장 위치

| 데이터 | 위치 | 이유 |
|---|---|---|
| 테마, 학습된 선호도 | `storage.sync` | 기기 간 공유가 목적 |
| Gemini API 키 | `storage.local` | 자격증명을 Google 서버에 올리지 않는다 |
| 가로채기 on/off | `storage.local` | 순간적인 토글. 공유하면 반대편 기기가 죽는다 |
| 프로젝트, 디버그 로그 | `storage.local` | sync의 항목당 8KB 한도를 넘는다 |

키별 판단은 [`src/shared/storage.ts`](src/shared/storage.ts) 한 곳에 모여 있다.
