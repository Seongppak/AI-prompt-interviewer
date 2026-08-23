# 다음 채팅 인수인계

마지막 갱신: 2026-08-23 (Asia/Seoul)

## 사용자 목표

사용자가 AI 사이트에 입력한 원본 프롬프트를 가로채고, 필요한 추가 질문을 인터뷰한 뒤,
답변을 모아 Gemini API로 **새로운 최종 프롬프트를 재작성**한다. 단순히 원문 뒤에
질문·답변을 붙이는 것이 아니다. 작업에 가장 적합한 대상 AI 추천 기능도 포함한다.

장기 목표와 단계별 규칙은 최초 첨부된 마스터 프롬프트를 따른다. 각 STEP은 구현·테스트·빌드 후
멈추며, 다음 STEP을 자동으로 시작하지 않는다.

## 절대 지켜야 할 사용자 규칙

1. 사용자가 직접 배포하라고 말하기 전에는 배포하지 않는다.
2. 모든 변경과 추가 기능은 별도 테스트 앱에서 먼저 검증한다.
3. 기존에 사용 중인 Chrome 확장 프로그램을 깨뜨리거나 임의로 수정하지 않는다.
4. 현재 운영 확장 동결 경로는 다음과 같다.
   - `src/`
   - `manifest.config.ts`
   - `vite.config.ts`
   - `prompts/`
   - `skills/`
   - `scripts/`
5. 위 운영 경로를 새 Core/Adapter에 실제 연결하는 작업과 배포는 서로 다른 승인 단계다.
6. 현재 변경 사항은 커밋되지 않았다. 사용자의 기존 변경으로 취급하고 보존한다.

## 현재 기준점

- 저장소: `https://github.com/Seongppak/AI-prompt-interviewer.git`
- 브랜치: `main`
- 작업 시작 기준 HEAD: `44299de958e839db56150337ad4474e8043c629e`
- 테스트 앱: `http://127.0.0.1:5173/`
- 테스트 앱 빌드 출력: `dist-test-app/`
- 운영 확장 빌드 출력: `dist/`

## 완료 상태

### STEP 0

- Repository 분석 완료.

### STEP 1

- `docs/architecture.md`에 현재 구조, 목표 구조, Migration Map 작성.
- 운영 확장과 분리된 `apps/test-app/` 생성.
- 테스트 앱 전용 Vite/TypeScript 설정과 로그 확인 메뉴 구현.

### STEP 2

- 플랫폼 독립 `packages/core/` 구현.
- Interview Engine, 질문 생성, AI 추천, Prompt Builder/Optimizer, Target Guidance,
  Preference Service, Project Context, 공통 Port/Type 구현.
- 상태 전이 보호와 플랫폼 API 직접 사용 방지 테스트 구현.
- 테스트 앱에 인메모리 Storage와 선호도 학습 연결.

### STEP 3 사전 작업(Shadow Adapter)

- `adapters/browser/`에 Browser Target Adapter, 사이트 Registry, Chrome Storage Adapter 구현.
- 기존 운영 확장에서는 import하지 않는 분리된 shadow 구현이다.
- 기존 7개 사이트 Registry와 자동 호환성 테스트를 추가했다.

### Gemini 재작성 기능 보강

- 기존 GitHub 구현의 다음 흐름을 기준으로 삼았다.
  - `src/background/generateQuestions.ts`: Gemini로 인터뷰 질문과 AI 추천 생성
  - `src/sidepanel/composePrompt.ts`: 원문과 인터뷰 답변 조립
  - `src/sidepanel/optimizePrompt.ts`: Gemini `generateContent`로 새 프롬프트 재작성
- 새 `adapters/gemini/`를 구현했다. 아직 운영 확장에서는 사용하지 않는다.
- Core Optimizer는 원문과 인터뷰 결정을 별도 구조로 받는다.
- Gemini 지시문은 다음을 요구한다.
  - 답변을 원문에 의미적으로 통합
  - 질문·답변 목록을 그대로 덧붙이지 않음
  - 인터뷰가 있었다고 언급하지 않음
  - 건너뛴 질문을 추측하지 않음
  - 대상 AI별 `prompts/targets.md` 지침 적용
- 테스트 앱에서 Provider를 선택할 수 있다.
  - `시뮬레이션`: API 키 없이 전체 흐름 검증
  - `실제 Gemini API`: 사용자가 입력한 키로 질문 생성과 최종 프롬프트 재작성
- 테스트 앱의 Gemini API 키는 React 메모리에만 유지하며 Storage와 로그에 저장하지 않는다.

## 마지막 검증 결과

다음 검증이 모두 통과했다.

```text
npm test                         13 files / 41 tests PASS
npm run typecheck:core           PASS
npm run typecheck:gemini-adapter PASS
npm run typecheck:browser-adapter PASS
npm run build:test-app           PASS
npm run build                    PASS
npm run lint                     PASS
npm audit                        0 vulnerabilities
git diff --check                 PASS
Test App HTTP                    200
Browser console errors           0
```

기존 운영 확장 빌드는 기존과 동일하게 38 modules 및
`dist/assets/index.html-D2Z1KlZz.js`를 생성했다. 동결 경로의 `git diff --name-only` 결과는 비어 있다.

## 브라우저에서 확인한 시뮬레이션 결과

기본 쇼핑몰 프롬프트로 인터뷰한 뒤 다음 답변을 선택했다.

- 결과물 형태: 완성 결과물
- 상세 수준: 구현 가능한 수준
- 작성 언어: 한국어

최종 출력은 질문 문장을 붙이지 않고 아래 요구사항이 들어간 새로운 Codex용 프롬프트로 표시됐다.

```text
목표:
React로 상품 검색과 장바구니가 있는 쇼핑몰 웹사이트를 만들어줘.

완료 기준:
- 결과물 형태: 완성 결과물
- 상세 수준: 구현 가능한 수준
- 작성 언어: 한국어

작업 지침:
...
```

## 새 채팅에서 먼저 할 일

1. 이 문서와 `docs/architecture.md`를 읽는다.
2. `git status --short`로 현재 미커밋 변경을 확인하고 보존한다.
3. 아래 검증을 다시 실행해 기준 상태를 확인한다.

```bash
npm test
npm run build:test-app
npm run build
```

4. 테스트 앱이 꺼져 있으면 `npm run dev:test-app -- --host 127.0.0.1`로 다시 실행한다.
5. 사용자에게 운영 확장 연결 승인이 명시되어 있는지 확인한다.

## 다음 작업 시작점

`STEP 3 — Chrome Extension Core 재연결`의 자동 검증 구간을 시작했고 완료했다.
상세 범위와 결과는 `docs/STEP3_CHECKPOINT.md`에 기록되어 있다.

다음 시작점은 운영 Chrome을 건드리지 않는 별도 unpacked extension 환경에서 수동 Browser Test
Matrix를 실행하는 것이다. 현재 사용 중인 확장을 임의로 재로드하거나 교체하지 않는다.

연결된 항목:

- QuestionGenerationService + GeminiAIProvider background facade
- 구조화된 원문/인터뷰 결정을 사용하는 PromptOptimizer sidepanel facade
- Chrome Message Adapter
- Browser site Registry, Chrome Storage Adapter, PreferenceService facade
- 기존 Question/Prompt Builder import 호환 facade

자동 검증 결과는 16 files / 50 tests PASS이며 운영 확장과 테스트 앱 빌드가 모두 통과했다.

### 남은 STEP 3 수동 검증

1. `dist/`를 기존 운영 확장과 분리된 unpacked extension으로 로드
2. ChatGPT, Claude, Gemini, Grok, Perplexity, Copilot 대상별 가로채기→인터뷰→재작성→입력 삽입 검증
3. 기존 저장 프로젝트, 선호도, 설정 마이그레이션 확인
4. 오류/최적화 fallback과 중복 메시지 방지 확인
5. 사용자 체크포인트에서 멈춤

배포는 이 수동 검증과 별개이며, 사용자가 직접 배포를 요청할 때만 수행한다.

## 이전 STEP 3 시작 조건 기록

아래 내용은 STEP 3 시작 전의 동결 조건 기록이다.

그러나 현재 사용자 규칙상 운영 확장 경로는 동결되어 있다. 사용자가 기존 확장 소스 연결을 명시적으로
허용하기 전에는 아래 작업만 할 수 있다.

- 테스트 앱의 Gemini 실사용 검증 보조
- `packages/core/`, `adapters/gemini/`, `adapters/browser/`의 테스트 보강
- 실제 연결 전에 필요한 Migration 계획과 체크리스트 작성

연결 승인을 받은 경우에도 한 번에 전환하지 말고 다음 순서로 진행한다.

1. 기존 `src/sidepanel/optimizePrompt.ts`와 새 `GeminiAIProvider`의 Characterization Test 작성
2. 기존 `src/background/generateQuestions.ts`와 새 QuestionGenerationService의 결과 호환성 검증
3. Chrome Message Adapter 구현
4. Sidepanel에서 새 Core를 feature flag 또는 되돌릴 수 있는 얇은 facade로 연결
5. ChatGPT, Claude, Gemini, Grok, Perplexity, Copilot 대상별 가로채기→인터뷰→재작성→입력 삽입 검증
6. 기존 확장 빌드와 테스트 통과 확인
7. 사용자 체크포인트에서 멈춤

배포는 이 연결 작업과 별개이며, 사용자가 직접 배포를 요청할 때만 수행한다.
