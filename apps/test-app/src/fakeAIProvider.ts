import {
  buildStructuredPrompt,
  DEFAULT_TARGET_PROFILES,
  type AIProvider,
  type GenerateRequest,
  type GenerateResponse,
} from '../../../packages/core/src'

function extractQuotedPrompt(prompt: string): string {
  return /"""([\s\S]*?)"""/.exec(prompt)?.[1]?.trim() ?? prompt.trim()
}

function recommendTarget(prompt: string): { id: string; reason: string } {
  const normalized = prompt.toLowerCase()
  if (/코드|개발|앱|프로그램|react|python|typescript|버그/.test(normalized)) {
    return { id: 'codex', reason: '코드 작성과 프로젝트 단위 구현이 중심인 요청입니다.' }
  }
  if (/최신|뉴스|조사|출처|시장 비교/.test(normalized)) {
    return { id: 'perplexity', reason: '최신 자료 검색과 출처 확인이 중요한 요청입니다.' }
  }
  if (/긴 글|기획서|보고서|문서|분석|책|도서|가이드북|교재/.test(normalized)) {
    return { id: 'claude', reason: '긴 문맥을 유지하며 구조화된 글을 작성하는 작업입니다.' }
  }
  return { id: 'chatgpt', reason: '범용적인 질의응답과 아이디어 정리에 적합한 요청입니다.' }
}

function interviewResponse(originalPrompt: string): string {
  const recommendation = recommendTarget(originalPrompt)
  const sufficientlyDetailed = originalPrompt.length > 180
    && /형식|언어|대상|제약|조건/.test(originalPrompt)

  const financeBook = /증권|주식|투자|금융|퀀트/.test(originalPrompt)
    && /책|도서|가이드북|교재/.test(originalPrompt)
  const questions = financeBook ? [
    {
      id: 'audience',
      text: '이 책의 주요 대상 독자는 누구입니까?',
      category: 'audience',
      recommendedValue: '중급 투자자',
      recommendedReason: '기초 개념과 실제 전략을 함께 이해할 수 있는 독자층입니다.',
      options: [
        { label: '입문자', value: '입문자' },
        { label: '중급 투자자', value: '중급 투자자' },
        { label: '전문 투자자', value: '전문 투자자' },
      ],
    },
    {
      id: 'strategy_type',
      text: '주로 다루고자 하는 투자 전술의 성격은 무엇입니까?',
      category: 'strategy_type',
      recommendedValue: '퀀트 투자',
      recommendedReason: '규칙과 검증 기준을 구체적으로 설명하기 좋습니다.',
      options: [
        { label: '가치 투자', value: '가치 투자' },
        { label: '기술적 분석', value: '기술적 분석' },
        { label: '퀀트 투자', value: '퀀트 투자' },
      ],
    },
    {
      id: 'detail_level',
      text: '책의 내용과 전술 설명은 어느 정도로 상세해야 합니까?',
      category: 'detail_level',
      recommendedValue: '상세함',
      recommendedReason: '독자가 전략을 이해하고 재현할 수 있습니다.',
      options: [
        { label: '간결함', value: '간결함' },
        { label: '보통', value: '보통' },
        { label: '상세함', value: '상세함' },
      ],
    },
  ] : [
      {
        id: 'output_type',
        text: '어떤 형태의 결과물이 필요합니까?',
        category: 'output_type',
        recommendedValue: '완성 결과물',
        recommendedReason: '바로 검증할 수 있는 완성 결과물이 가장 실용적입니다.',
        options: [
          { label: '완성 결과물', value: '완성 결과물' },
          { label: '설계안', value: '설계안' },
          { label: '단계별 가이드', value: '단계별 가이드' },
        ],
      },
      {
        id: 'detail_level',
        text: '어느 정도로 자세하게 답변할까요?',
        category: 'detail_level',
        recommendedValue: '구현 가능한 수준',
        recommendedReason: '구현과 검증에 필요한 근거를 함께 확인할 수 있습니다.',
        options: [
          { label: '핵심만', value: '핵심만 간결하게' },
          { label: '구현 가능한 수준', value: '구현 가능한 수준' },
          { label: '깊은 기술 설명', value: '깊은 기술 설명' },
        ],
      },
      {
        id: 'language',
        text: '결과는 어떤 언어로 작성할까요?',
        category: 'language',
        recommendedValue: '한국어',
        recommendedReason: '현재 요청 언어를 유지합니다.',
        options: [
          { label: '한국어', value: '한국어' },
          { label: '영어', value: '영어' },
        ],
      },
    ]

  return JSON.stringify({
    questions: sufficientlyDetailed ? [] : questions,
    recommendedTargetId: recommendation.id,
    recommendedTargetReason: recommendation.reason,
  })
}

interface OptimizationPayload {
  originalPrompt: string
  interviewDecisions: Array<{ question: string; category?: string; answer: string }>
}

function extractOptimizationPayload(requestPrompt: string): OptimizationPayload {
  const match = /AIPI_INPUT_JSON_START\s*([\s\S]*?)\s*AIPI_INPUT_JSON_END/.exec(requestPrompt)
  if (!match?.[1]) return { originalPrompt: requestPrompt.trim(), interviewDecisions: [] }
  return JSON.parse(match[1]) as OptimizationPayload
}

function optimizationResponse(requestPrompt: string): string {
  const payload = extractOptimizationPayload(requestPrompt)
  const targetName = /바탕으로 (.+?)에 바로 입력할/.exec(requestPrompt)?.[1] ?? 'ChatGPT'
  const target = DEFAULT_TARGET_PROFILES.find((profile) => profile.displayName === targetName)
    ?? DEFAULT_TARGET_PROFILES[0]!
  return buildStructuredPrompt({
    originalPrompt: payload.originalPrompt,
    interviewDecisions: payload.interviewDecisions,
    target,
  })
}

export class FakeAIProvider implements AIProvider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    await new Promise((resolve) => setTimeout(resolve, 280))
    return request.purpose === 'interview-questions'
      ? { text: interviewResponse(extractQuotedPrompt(request.prompt)), model: 'fake-interviewer-v1' }
      : { text: optimizationResponse(request.prompt), model: 'fake-optimizer-v1' }
  }
}
