# STEP 3 — Chrome Extension Core 재연결 체크포인트

마지막 갱신: 2026-08-23 (Asia/Seoul)

## 이번 연결 범위

- 기존 `ORIGINAL_QUESTION` 메시지 형식을 유지하면서 런타임 검증을 수행하는
  `Chrome Message Adapter`를 background에 연결했다.
- 기존 `generateInterviewQuestions()` 공개 API와 `Project` 저장 형식을 유지하면서 내부 구현을
  `QuestionGenerationService` + `GeminiAIProvider`로 교체했다.
- Sidepanel이 원문 뒤에 질문·답변을 붙인 문자열을 Gemini에 넘기지 않고, 원문과 인터뷰 결정을
  구조화해 `PromptOptimizer`에 전달하도록 바꿨다.
- Gemini 최적화가 실패하면 기존 동작처럼 답변이 포함된 조립 프롬프트로 대체한다.
- 기존 `question`, `composePrompt`, `sites`, `storage`, `preferences` import 경로는 얇은 facade로
  유지하고 새 Core/Browser Adapter 구현에 연결했다.
- Browser site 공개 객체는 기존과 같은 모양을 유지한다. Adapter 내부의 `targetId`는 기존
  `SUPPORTED_SITES` 소비자에게 노출하지 않는다.

## 자동 검증

```text
npm test                         16 files / 50 tests PASS
npm run build                   PASS (62 modules)
npm run build:test-app          PASS
npm run typecheck:core          PASS
npm run typecheck:browser-adapter PASS
npm run typecheck:gemini-adapter  PASS
npm run lint                    PASS
npm audit                       0 vulnerabilities
git diff --check                PASS
```

Characterization/호환성 테스트는 다음을 고정한다.

- 질문과 AI 추천 결과가 기존 `InterviewResult` 형식으로 저장되는지
- 원문과 인터뷰 답변이 Gemini 요청에 별도 구조로 포함되는지
- 최적화 실패 시 답변을 잃지 않고 기존 조립 프롬프트로 대체하는지
- 기존 7개 사이트 Registry와 공개 객체 형식이 동일한지
- 잘못된 Chrome 메시지를 무시하고 기존 메시지만 전달하는지

## 아직 하지 않은 작업

- 사용 중인 Chrome 확장 재로드
- ChatGPT, Claude, Gemini, Grok, Perplexity, Copilot 대상별 실제 가로채기·삽입 검증
- Chrome Store 배포, Release 생성, 패키지 게시

수동 Browser Test Matrix는 사용자의 현재 운영 확장을 임의로 교체하지 않도록 이 체크포인트에서
멈춘다. 다음 승인에서는 `dist/`를 unpacked extension으로 별도 검증한 뒤, 서비스별
가로채기 → 인터뷰 → Gemini 재작성 → 입력 삽입을 확인한다. 배포 승인은 그 이후에도 별도다.
