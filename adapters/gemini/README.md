# Gemini Adapter

기존 확장의 `src/background/generateQuestions.ts`와 `src/sidepanel/optimizePrompt.ts`에서
검증된 Gemini `generateContent` 흐름을 플랫폼 독립 Core의 `AIProvider` 포트에 맞춘 구현이다.

- 생성 가능한 Gemini 모델을 API에서 조회하고 Flash/latest 계열을 우선한다.
- 모델 목록 조회가 실패하면 안정적인 latest 별칭으로 대체한다.
- `thinkingBudget: 0`을 거부하는 모델은 해당 옵션 없이 재시도한다.
- 인터뷰 질문은 JSON schema를 사용하고, 프롬프트 최적화는 텍스트를 반환한다.
- API 키는 생성자에서만 받아 저장하거나 로그에 남기지 않는다.

현재 운영 확장에서는 이 Adapter를 import하지 않는다. 테스트 앱에서 검증한 뒤 사용자가
운영 연결을 승인하는 시점에 기존 Gemini 호출부와 교체한다.
