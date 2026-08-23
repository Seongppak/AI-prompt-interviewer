# @aipi/core

AI Prompt Interviewer의 플랫폼 독립 비즈니스 로직이다.

## 포함 기능

- `InterviewEngine`: 인터뷰 세션과 상태 전이
- `QuestionGenerationService`: AI 질문 생성 요청과 런타임 응답 검증
- `PromptBuilder`: 원문과 답변 조립
- `PromptOptimizer`: Target 지침을 포함한 최적화 Use Case와 원문 폴백
- `MarkdownTargetGuidanceProvider`: `targets.md` 파싱과 조회
- Preference 순수 모델과 `PreferenceService`
- `AIProvider`, `StorageAdapter`, Logger, Clock, ID Port
- `InterviewSession`, `ProjectContext`, Target, 오류 공통 타입

Core 소스에서는 Chrome, DOM, Tauri, Windows API를 사용하지 않는다.

## 검증

```bash
npm run typecheck:core
npm run test:core
npm test
```

`apps/test-app`은 Fake AI Provider와 이 Core를 직접 사용해 전체 흐름을 검증한다.
