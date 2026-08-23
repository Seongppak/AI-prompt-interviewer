import type { AIProvider, GenerateRequest, GenerateResponse } from '../../../packages/core/src'

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
  if (/긴 글|기획서|보고서|문서|분석/.test(normalized)) {
    return { id: 'claude', reason: '긴 문맥을 유지하며 구조화된 글을 작성하는 작업입니다.' }
  }
  return { id: 'chatgpt', reason: '범용적인 질의응답과 아이디어 정리에 적합한 요청입니다.' }
}

function interviewResponse(originalPrompt: string): string {
  const recommendation = recommendTarget(originalPrompt)
  const sufficientlyDetailed = originalPrompt.length > 180
    && /형식|언어|대상|제약|조건/.test(originalPrompt)

  return JSON.stringify({
    questions: sufficientlyDetailed ? [] : [
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
    ],
    recommendedTargetId: recommendation.id,
    recommendedTargetReason: recommendation.reason,
  })
}

interface OptimizationPayload {
  originalPrompt: string
  interviewDecisions: Array<{ category?: string; answer: string }>
}

function extractOptimizationPayload(requestPrompt: string): OptimizationPayload {
  const match = /AIPI_INPUT_JSON_START\s*([\s\S]*?)\s*AIPI_INPUT_JSON_END/.exec(requestPrompt)
  if (!match?.[1]) return { originalPrompt: requestPrompt.trim(), interviewDecisions: [] }
  return JSON.parse(match[1]) as OptimizationPayload
}

function optimizationResponse(requestPrompt: string): string {
  const payload = extractOptimizationPayload(requestPrompt)
  const original = payload.originalPrompt.trim().replace(/[.。]?$/, '.')
  const target = /바탕으로 (.+?)에 바로 입력할/.exec(requestPrompt)?.[1] ?? 'AI'
  const decisions = new Map(payload.interviewDecisions.map((decision) => [decision.category, decision.answer]))
  const categorized = new Set([
    decisions.get('output_type'),
    decisions.get('detail_level'),
    decisions.get('language'),
  ])
  const lines = [original, '', '완료 기준:']

  if (decisions.get('output_type')) lines.push(`- 결과물 형태: ${decisions.get('output_type')}`)
  if (decisions.get('detail_level')) lines.push(`- 상세 수준: ${decisions.get('detail_level')}`)
  if (decisions.get('language')) lines.push(`- 작성 언어: ${decisions.get('language')}`)
  for (const decision of payload.interviewDecisions) {
    if (!categorized.has(decision.answer)) lines.push(`- ${decision.answer}`)
  }

  if (target === 'Claude') {
    return `<task>\n${lines.join('\n')}\n</task>`
  }
  if (target === 'Codex' || target === 'Claude Code') {
    return `목표:\n${lines.join('\n')}\n\n작업 지침:\n- 기존 프로젝트 구조와 규칙을 먼저 확인한다.\n- 요구사항을 구현하고 관련 테스트와 빌드를 실행한다.\n- 변경 파일과 검증 결과를 보고한다.`
  }
  return `## 요청\n${lines.join('\n')}`
}

export class FakeAIProvider implements AIProvider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    await new Promise((resolve) => setTimeout(resolve, 280))
    return request.purpose === 'interview-questions'
      ? { text: interviewResponse(extractQuotedPrompt(request.prompt)), model: 'fake-interviewer-v1' }
      : { text: optimizationResponse(request.prompt), model: 'fake-optimizer-v1' }
  }
}
