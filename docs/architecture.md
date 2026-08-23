# AI Prompt Interviewer 공용 Core 분리 설계

상태: STEP 1 Architecture Design  
기준 버전: 3.1.0  
작성 원칙: 이 문서는 구조와 Migration Map만 확정한다. STEP 1에서는 기존 확장 코드를 이동하지 않는다.

## 1. 목표

기존 Chrome 확장의 동작을 유지하면서 인터뷰, 프롬프트 조립, 대상별 최적화, 선호도 처리를
플랫폼 독립 Core로 분리한다. Desktop, CLI, Browser는 같은 Core를 호출하고 입출력만 Adapter로
처리한다.

의존성 방향은 항상 바깥에서 안쪽으로 향한다.

```text
Apps / Platform Adapters
          ↓
Protocol / Port Interfaces
          ↓
     AIPI Core
```

Core는 `chrome.*`, DOM, Tauri, Windows API, Node 프로세스 API를 알지 못한다.

## 2. 이번 설계에서 확정한 검증·배포 원칙

사용자가 직접 배포를 요청하기 전에는 패키지 게시, 설치 프로그램 생성, Chrome Store 배포,
Release 생성 등 외부 배포 작업을 하지 않는다.

### 운영 Chrome Extension 동결

사용자가 운영 확장 통합을 명시적으로 허용하기 전에는 다음 경로를 수정하지 않는다.

```text
src/
manifest.config.ts
vite.config.ts
prompts/
skills/
scripts/
```

Core와 신규 기능 개발은 `packages/`, `apps/test-app/`, 테스트 및 `docs/` 안에서만 진행한다.
운영 통합 승인이 있더라도 먼저 테스트 앱과 자동 테스트를 통과하고, 변경 전후 확장 빌드를
비교할 수 있는 체크포인트를 만든다. 배포 승인은 운영 소스 수정 승인과 별개로 다시 받는다.

모든 기능 변경은 다음 순서를 따른다.

```text
Core 또는 신규 기능 구현
→ apps/test-app에서 격리 검증
→ Unit Test + Typecheck + Lint + Test App Build
→ 사용자 검토 체크포인트
→ 승인된 기능만 운영 Adapter에 연결
→ 운영 Build와 Adapter 검증
→ 사용자의 명시적 요청이 있을 때만 배포
```

`apps/test-app`은 운영 확장의 Chrome Storage, 실제 Gemini API 키, 실제 브라우저 탭에 접근하지
않는다. 테스트용 Provider와 인메모리 Adapter를 사용한다. 운영 코드를 복제하지 않고
`packages/core`를 직접 소비해야 한다.

테스트 앱의 진단 로그도 인메모리로만 유지한다. 사용자의 Prompt 원문과 Secret은 기록하지 않고,
상태 전이, Target 선택, 결과 길이와 오류 코드처럼 검증에 필요한 최소 정보만 기록한다.

## 3. 현재 구조

```text
manifest.config.ts

src/
  background/
    background.ts
    generateQuestions.ts

  content/
    content.ts

  sidepanel/
    App.tsx
    composePrompt.ts
    optimizePrompt.ts
    insertIntoAiTab.ts
    sendToClaudeCode.ts
    Settings.tsx
    DebugLogs.tsx

  shared/
    question.ts
    project.ts
    preferences.ts
    settings.ts
    storage.ts
    sites.ts
    promptTargets.ts
    promptLink.ts
    geminiModels.ts
    logger.ts

prompts/targets.md
skills/
scripts/
```

현재의 주요 문제는 다음과 같다.

- 인터뷰 상태 전이가 background, React UI, Chrome Storage에 분산돼 있다.
- `src/shared`에 순수 모델과 Chrome 전용 구현이 함께 있다.
- 질문 생성과 최적화가 Gemini HTTP API를 직접 호출한다.
- Target의 AI 특성과 Browser DOM 셀렉터가 같은 `SiteConfig`에 있다.
- 저장소와 메시지의 인터페이스가 없어 Desktop/CLI가 재사용할 수 없다.
- 테스트가 없으므로 리팩터링 회귀를 자동으로 찾을 수 없다.

## 4. 목표 구조

현재 저장소를 한 번에 이동하지 않고 아래 구조로 점진적으로 발전시킨다.

```text
packages/
  core/
    src/
      interview/
        interview-engine.ts
        interview-state.ts
        question-generation.ts
      prompt/
        prompt-builder.ts
        prompt-optimizer.ts
      target/
        target-profile.ts
        target-guidance.ts
      preferences/
        preference-model.ts
        preference-service.ts
      project/
        project-context.ts
      ports/
        ai-provider.ts
        storage-adapter.ts
        target-guidance-provider.ts
        logger.ts
        clock.ts
        id-generator.ts
      types/
        question.ts
        result.ts
      index.ts

  protocol/                  # STEP 4에서 구현
    src/
      messages.ts
      events.ts
      target-adapter.ts
      adapter-registry.ts

apps/
  test-app/                  # 운영 연결 전 검증 앱
  chrome-extension/          # 기존 src를 검증 후 점진 이동
  desktop/                   # STEP 6 이후

adapters/
  browser/
    chrome-storage-adapter.ts
    chrome-message-adapter.ts
    browser-target-adapter.ts
    browser-site-registry.ts
  gemini/
    gemini-provider.ts
    gemini-model-resolver.ts
  claude-code/
  codex/
  clipboard/

prompts/
  targets.md
```

STEP 2에서는 `packages/core`만 실제로 만들고 기존 `src` 위치는 호환 Facade로 유지한다.
`apps/chrome-extension`으로의 물리적 이동은 Core 재연결이 검증된 뒤 별도 단계에서 판단한다.

## 5. Core 경계

### 5.1 Core에 포함한다

- 인터뷰 세션 상태와 상태 전이
- 질문과 답변 모델
- 원본 Prompt와 답변의 조립
- Target Profile과 Target Guidance 파싱
- AI Provider를 이용한 질문 생성·프롬프트 최적화 Use Case
- Preference 횟수 집계와 추천값 계산
- Project Context의 플랫폼 독립 모델
- 오류와 결과 타입

### 5.2 Core에 포함하지 않는다

- Chrome 탭 검색, Side Panel, Downloads, Storage API
- DOM 셀렉터 검색과 입력창 조작
- Clipboard, Global Hotkey, Process Detection
- Tauri command와 Windows API
- Node `spawn`, `cmd`, `PowerShell`
- Gemini URL, API Key header, 모델 목록 API
- React 상태와 UI 컴포넌트

### 5.3 금지 의존성

`packages/core`의 빌드 및 테스트 환경에는 다음 전역 타입을 제공하지 않는다.

```text
chrome
document
window
navigator
Tauri
Windows API
```

Node와 Browser 양쪽에서 쓸 수 있는 표준 기능이라도 시간, UUID, 영속 저장, 로깅처럼 테스트
결과를 비결정적으로 만드는 기능은 Port로 받는다.

## 6. 핵심 도메인 모델

현재 `Project`는 소스 코드 프로젝트가 아니라 인터뷰 기록이다. Core에서는 의미를 명확히 하기
위해 `InterviewSession`으로 명명하고, 기존 `Project` 타입은 Chrome 호환 Facade에서 유지한다.

```ts
export type InterviewPhase =
  | 'idle'
  | 'generating'
  | 'interviewing'
  | 'ready'
  | 'error'
  | 'cancelled'

export interface InterviewSession {
  id: string
  originalPrompt: string
  sourceTargetId?: string
  createdAt: string
  phase: InterviewPhase
  questions: Question[]
  answers: Record<string, string>
  currentQuestionIndex: number
  recommendedTargetId?: string
  recommendedTargetReason?: string
  error?: CoreError
}
```

소스 코드의 프로젝트 분석 결과는 별도 `ProjectContext`다.

```ts
export interface ProjectContext {
  rootPath?: string
  languages: string[]
  frameworks: string[]
  packageManager?: string
  buildTool?: string
  testFrameworks: string[]
}
```

STEP 2에서는 기존 기능에 필요한 필드만 구현한다. `ProjectContext` 수집 기능은 STEP 13까지
구현하지 않는다.

## 7. Interview Engine

`InterviewEngine`은 순수 상태 전이만 담당한다. Storage, AI 호출, UI를 직접 실행하지 않는다.

```ts
export interface InterviewEngine {
  create(originalPrompt: string, sourceTargetId?: string): InterviewSession
  questionsGenerated(
    session: InterviewSession,
    result: GeneratedInterview,
  ): InterviewSession
  answer(session: InterviewSession, questionId: string, value: string): InterviewSession
  skip(session: InterviewSession, questionId: string): InterviewSession
  previous(session: InterviewSession): InterviewSession
  restart(session: InterviewSession): InterviewSession
  fail(session: InterviewSession, error: CoreError): InterviewSession
  cancel(session: InterviewSession): InterviewSession
}
```

불변 조건:

- 원본 Prompt는 상태 전이 중 바뀌지 않는다.
- 존재하지 않는 질문 ID의 답변은 거부한다.
- 선택지가 있는 질문은 허용된 값 또는 명시적인 사용자 직접 입력값만 받는다.
- 마지막 질문 다음에는 `ready` 상태가 된다.
- 질문이 0개면 생성 완료 즉시 `ready`가 된다.
- `previous`, `restart`, `skip`의 의미는 UI와 무관하게 동일하다.

## 8. Prompt Builder

현재 `composePrompt`의 출력은 호환성을 위해 우선 그대로 유지한다.

```ts
export interface PromptBuilder {
  build(input: {
    originalPrompt: string
    questions: Question[]
    answers: Record<string, string>
  }): string
}
```

STEP 2에서 기존 문자열 형식에 대한 Characterization Test를 먼저 작성한다. 출력 형식 개선은
기존 Chrome 재연결 이후 별도 변경으로 다룬다.

## 9. AI Provider

Core는 Gemini를 알지 못한다.

```ts
export interface GenerateTextRequest {
  prompt: string
  timeoutMs?: number
  responseFormat?: 'text' | 'json'
  schema?: unknown
}

export interface GenerateTextResponse {
  text: string
  model?: string
}

export interface AIProvider {
  generate(request: GenerateTextRequest): Promise<GenerateTextResponse>
}
```

구조화 응답은 Provider의 TypeScript generic에 의존하지 않는다. Core Use Case가 `unknown` JSON을
런타임 검증하여 중복 question ID, 빈 option, 잘못된 recommendedValue를 차단한다.

Gemini의 모델 검색, 캐시, `thinkingBudget`, HTTP 재시도, API Key header는
`adapters/gemini` 책임이다.

## 10. Storage Adapter

```ts
export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  subscribe?<T>(key: string, listener: (value: T | undefined) => void): () => void
}
```

Core 서비스는 Chrome의 local/sync 구분을 알지 못한다. 어떤 키를 동기화할지는
`ChromeStorageAdapter`의 정책이다. Desktop에서는 SQLite/파일/OS Credential Store Adapter가
같은 Port 또는 더 구체적인 Repository를 구현한다.

API Key 같은 Secret은 일반 Preference Storage와 분리한다. 향후 다음 Port를 별도로 둔다.

```ts
export interface SecretStorageAdapter {
  getSecret(key: string): Promise<string | undefined>
  setSecret(key: string, value: string): Promise<void>
  removeSecret(key: string): Promise<void>
}
```

## 11. Target 모델과 Adapter 분리

Core의 Target Profile에는 AI의 의미만 담는다.

```ts
export interface TargetProfile {
  id: string
  displayName: string
  guidanceKey: string
  capabilities?: string[]
}
```

DOM 셀렉터, URL, 실행 파일명은 포함하지 않는다.

플랫폼별 송수신은 STEP 4의 Protocol에 정의할 `TargetAdapter`가 담당한다.

```ts
export interface TargetAdapter {
  readonly id: string
  detect(): Promise<boolean>
  receivePrompt(): Promise<string | null>
  sendPrompt(prompt: string): Promise<void>
}
```

Browser Adapter만 `inputSelectors`, `sendButtonSelector`, `urlPattern`을 가진다. Codex Adapter는
실행 파일과 CLI 옵션을 가지며 둘은 Core를 통해서만 연결된다.

## 12. Target Prompt Loader

Markdown 파싱은 Core의 순수 함수로 둔다.

```ts
export function parseTargetGuidance(markdown: string): TargetGuidanceMap

export interface TargetGuidanceProvider {
  get(targetId: string): Promise<TargetGuidance>
}
```

플랫폼별 로딩 방법:

- Chrome: 빌드 시 raw asset 주입
- CLI/Claude Code: 파일 시스템에서 `prompts/targets.md` 읽기
- Desktop: 앱 resource 또는 설정된 외부 파일 읽기
- Test App: fixture 또는 raw asset 주입

파싱과 파일 읽기를 분리하므로 Vite의 `?raw`가 Core에 남지 않는다.

## 13. Preference 모델

선택 횟수 계산은 순수 함수로 분리한다.

```ts
export type PreferenceCounts = Record<string, Record<string, number>>

export function recordPreference(
  counts: PreferenceCounts,
  category: string,
  value: string,
): PreferenceCounts

export function getPreferredValues(
  counts: PreferenceCounts,
): Record<string, string>
```

읽기와 저장은 별도 `PreferenceService`가 `StorageAdapter`를 통해 수행한다. 동점이면 기존
Chrome 데이터와의 호환성을 위해 저장된 순서를 유지하며 이 규칙을 테스트로 고정한다.

## 14. 오류 처리

문자열 오류 대신 Core 오류 코드를 사용한다.

```ts
export type CoreErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_AI_RESPONSE'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'STORAGE_FAILURE'

export interface CoreError {
  code: CoreErrorCode
  message: string
  cause?: unknown
  retryable: boolean
}
```

사용자용 한국어 문구는 UI Adapter가 오류 코드에서 변환한다. API 응답 본문이나 API Key가
사용자 메시지와 로그에 그대로 노출되지 않게 한다.

## 15. Protocol 경계

STEP 1에서는 Protocol 구현을 만들지 않지만 다음 이벤트를 기준으로 경계를 예약한다.

```text
PromptReceived
InterviewGenerationRequested
InterviewGenerated
InterviewAnswered
InterviewSkipped
InterviewCompleted
PromptOptimizationRequested
PromptOptimized
PromptDeliveryRequested
PromptDelivered
AdapterFailed
```

현재 문자열 리터럴인 `ORIGINAL_QUESTION`, `INSERT_PROMPT`는 STEP 4에서 discriminated union으로
옮긴다. STEP 2에서는 범위를 넘지 않기 위해 기존 메시지를 변경하지 않는다.

## 16. 테스트 전략

### Unit Test

- Interview Engine의 모든 상태 전이
- 질문 0개, Skip, Previous, Restart, Error
- Prompt Builder 기존 출력 호환성
- Target Markdown 파싱과 없는 Target의 공통 폴백
- Preference 누적과 동점 규칙
- 잘못된 AI JSON 응답 검증
- Prompt hash의 한글·이모지 round trip

### Test App

테스트 앱은 아래 Adapter를 사용한다.

```text
InMemoryStorageAdapter
FakeAIProvider
TestTargetGuidanceProvider
InMemoryTargetAdapter
```

검증 시나리오:

- 정보가 부족한 Prompt → 질문 생성 → 답변 → 조립
- 충분한 Prompt → 질문 없이 즉시 완료
- 일부 질문 Skip
- Previous/Restart/Cancel
- Provider timeout/error 및 재시도 표시
- 대상별 Guidance 적용과 없는 대상의 공통 폴백
- Preference 추천 표시
- 최적화 성공/실패 시 원문 폴백

### 운영 Adapter 검증

Test App과 Unit Test가 통과한 커밋만 Chrome Adapter에 연결한다. Chrome 연결 후에는 기존 6개
서비스에 대해 Enter/Click 가로채기와 삽입을 별도 Test Matrix로 확인한다.

## 17. Migration Map

| 기존 파일 | 목표 위치 | 처리 방식 | 예정 단계 |
|---|---|---|---|
| `src/shared/question.ts` | `packages/core/src/types/question.ts` | 타입 이동 후 기존 경로 re-export | STEP 2 |
| `src/sidepanel/composePrompt.ts` | `packages/core/src/prompt/prompt-builder.ts` | 기존 출력 Characterization Test 후 추출 | STEP 2 |
| `src/shared/promptTargets.ts` | Core 파서 + 플랫폼 Loader | 파서와 `?raw` import 분리 | STEP 2~3 |
| `src/shared/preferences.ts` | Core model/service + Chrome storage wrapper | 계산과 I/O 분리 | STEP 2~3 |
| `src/shared/project.ts` | Core InterviewSession + Chrome repository | 타입/전이와 Storage 분리 | STEP 2~3 |
| `src/background/generateQuestions.ts` | Core question use case + Gemini Adapter | Prompt/검증과 HTTP 분리 | STEP 2~3 |
| `src/sidepanel/optimizePrompt.ts` | Core optimizer + Gemini Adapter | Target 규칙/Use Case와 HTTP 분리 | STEP 2~3 |
| `src/shared/geminiModels.ts` | `adapters/gemini` | Chrome cache를 Adapter로 주입 | STEP 3 |
| `src/shared/storage.ts` | `adapters/browser` | `StorageAdapter` 구현 | STEP 3 |
| `src/shared/logger.ts` | Core Logger Port + Chrome Logger | 저장과 형식 분리 | STEP 3 |
| `src/shared/sites.ts` | Core Target Profile + Browser registry | AI 의미와 DOM 설정 분리 | STEP 3 |
| `src/content/content.ts` | Browser Adapter | Core와 Protocol만 호출 | STEP 3~4 |
| `src/background/background.ts` | Chrome orchestration Adapter | Core use case 조정 | STEP 3~4 |
| `src/sidepanel/App.tsx` | Chrome UI | 직접 비즈니스 로직 제거 | STEP 3 |
| `src/sidepanel/insertIntoAiTab.ts` | Browser Target Adapter | Protocol 구현 | STEP 3~4 |
| `src/sidepanel/sendToClaudeCode.ts` | Claude Code/Clipboard Adapter | 파일·클립보드 전달 분리 | STEP 10 |
| `scripts/send-to-browser.mjs` | Browser CLI Adapter 소비 | 사이트/hash 중복 제거 | STEP 5 이후 |

## 18. 단계별 안전한 이동 순서

### STEP 2

1. `packages/core`와 테스트 환경 생성
2. 기존 순수 함수에 Characterization Test 작성
3. Question 타입, Prompt Builder, Guidance Parser, Preference 계산 추출
4. Interview Engine 추가
5. 기존 파일은 Core re-export 또는 얇은 Facade로 유지
6. Test App을 새 Core로 먼저 전환
7. 테스트 앱 검증과 사용자 체크포인트 생성

### STEP 3

1. 사용자 확인 후 Chrome Storage/Gemini/Browser Adapter 구현
2. 기존 background와 sidepanel을 Core에 연결
3. 기존 저장 데이터와 메시지 형식 유지
4. Extension build 및 Browser Test Matrix 수행

### STEP 4

1. 공용 메시지와 이벤트 union 정의
2. TargetAdapter와 Registry 구현
3. 기존 Chrome 메시지를 Protocol에 연결

이 순서를 지키면 Desktop이나 CLI를 만들기 전에 Core가 Chrome 밖에서도 실행된다는 것을
테스트 앱으로 증명할 수 있다.

## 19. 호환성 정책

- 기존 `src/*` import 경로는 STEP 3 완료 전까지 제거하지 않는다.
- 기존 `Project` 저장 키와 데이터는 마이그레이션 코드 없이 즉시 변경하지 않는다.
- `ORIGINAL_QUESTION`, `INSERT_PROMPT` 메시지는 STEP 4 전까지 유지한다.
- `prompts/targets.md`는 계속 단일 원본으로 유지한다.
- Chrome Extension의 기존 build 명령과 `dist` 출력은 유지한다.
- Test App은 `dist-test-app`만 사용한다.
- API Key를 새 Core 타입이나 Test App fixture에 포함하지 않는다.

## 20. STEP 2 진입 조건

다음 조건을 충족한 뒤에만 Core 실제 분리를 시작한다.

- 이 Architecture와 Migration Map에 대한 사용자 검토 완료
- Test App의 독립 build와 기본 인터랙션 검증 통과
- 운영 확장 `dist`가 Test App build로 변경되지 않음
- 테스트 프레임워크와 Core package build 방식 확정

STEP 1 완료 시점에는 기존 Chrome Extension 실행 코드는 변경하지 않는다.
