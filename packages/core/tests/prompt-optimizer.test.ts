import { describe, expect, it } from 'vitest'
import {
  assessPromptQuality,
  MarkdownTargetGuidanceProvider,
  PromptOptimizer,
  type AIProvider,
  type GenerateRequest,
  type TargetProfile,
} from '../src'

const target: TargetProfile = {
  id: 'chatgpt',
  displayName: 'ChatGPT',
  guidanceKey: 'ChatGPT',
  capabilities: ['general'],
}

describe('PromptOptimizer', () => {
  it('passes common and target guidance to the provider', async () => {
    let captured: GenerateRequest | undefined
    const provider: AIProvider = {
      async generate(request) {
        captured ??= request
        return { text: '최적화된 결과', model: 'fake' }
      },
    }
    const guidance = new MarkdownTargetGuidanceProvider('## 공통\n공통 규칙\n\n## ChatGPT\n전용 규칙')
    const result = await new PromptOptimizer(provider, guidance).optimize({
      originalPrompt: '쇼핑몰을 만들어줘',
      interviewDecisions: [{
        questionId: 'language',
        question: '어떤 언어로 작성할까요?',
        category: 'language',
        answer: '한국어',
      }],
      target,
    })

    expect(result).toEqual({
      prompt: '최적화된 결과',
      optimized: true,
      targetId: 'chatgpt',
      qualityScore: 25,
      refined: true,
    })
    expect(captured?.purpose).toBe('prompt-optimization')
    expect(captured?.prompt).toContain('공통 규칙')
    expect(captured?.prompt).toContain('전용 규칙')
    expect(captured?.prompt).toContain('"originalPrompt": "쇼핑몰을 만들어줘"')
    expect(captured?.prompt).toContain('"answer": "한국어"')
    expect(captured?.prompt).toContain('질문과 답변 목록을 덧붙이거나')
    expect(captured?.prompt).toContain('원문에 포함되어 있었던 것처럼')
    expect(captured?.prompt).toContain('실행 가능한 새 지시문으로 재설계')
    expect(captured?.prompt).toContain('역할, 목표, 요구사항, 수행 지침, 출력 형식, 품질 기준')
    expect(captured?.prompt).toContain('AIPI_BASELINE_DRAFT_START')
  })

  it('scores shallow drafts and keeps complete structured prompts', () => {
    const input = {
      originalPrompt: '한국 증권 시장 전술을 다룬 책을 만들어라.',
      interviewDecisions: [
        { questionId: 'audience', question: '독자는?', category: 'audience', answer: '중급 투자자' },
        { questionId: 'strategy', question: '전략은?', category: 'strategy_type', answer: '퀀트 투자' },
      ],
      target,
    }
    expect(assessPromptQuality(input, '책을 작성하세요.')).toMatchObject({ passed: false })
    const complete = [
      '## 역할',
      '너는 금융 도서 저자다.',
      '## 목표',
      '한국 증권 시장 전술을 다룬 책을 작성한다.',
      '## 조건',
      '- 독자: 중급 투자자',
      '- 접근 방식: 퀀트 투자',
      '## 출력 구조',
      '목차와 장별 본문, 사례, 위험 관리 기준을 상세히 작성한다.',
      '각 전술의 데이터와 계산법, 진입 및 청산 규칙을 설명하고 실제 적용 예시를 포함한다.',
      '한국 시장의 거래비용과 유동성 제약을 반영하며 독자가 재현할 수 있는 점검표를 제공한다.',
    ].join('\n')
    expect(assessPromptQuality(input, complete)).toMatchObject({ passed: true, score: 100 })
  })

  it('runs a second refinement only when the first draft is insufficient', async () => {
    let calls = 0
    const provider: AIProvider = {
      async generate() {
        calls += 1
        return calls === 1
          ? { text: '쇼핑몰을 만들어줘', model: 'draft' }
          : { text: [
            '## 역할',
            '너는 시니어 웹 개발자다.',
            '## 목표',
            '상품 검색과 장바구니가 동작하는 쇼핑몰을 구현한다.',
            '## 확정 조건',
            '- 작성 언어: 한국어',
            '## 수행 지침',
            '구조를 설계하고 기능을 구현한 뒤 오류 처리와 테스트를 포함한다.',
            '## 출력 구조',
            '파일별 코드와 실행 방법, 테스트 결과를 명확히 제시한다.',
            '완성 결과물은 바로 실행하고 검증할 수 있는 수준이어야 한다.',
          ].join('\n'), model: 'refiner' }
      },
    }
    const result = await new PromptOptimizer(
      provider,
      new MarkdownTargetGuidanceProvider('## 공통\n공통 규칙'),
    ).optimize({
      originalPrompt: '쇼핑몰을 만들어줘',
      interviewDecisions: [{
        questionId: 'language', question: '언어는?', category: 'language', answer: '한국어',
      }],
      target,
    })
    expect(calls).toBe(2)
    expect(result.refined).toBe(true)
    expect(result.prompt).toContain('오류 처리와 테스트')
  })

  it('returns the original prompt in best-effort mode when the provider fails', async () => {
    const provider: AIProvider = {
      async generate() {
        throw new Error('offline')
      },
    }
    const result = await new PromptOptimizer(
      provider,
      new MarkdownTargetGuidanceProvider('## 공통\n공통 규칙'),
    ).optimizeBestEffort({ originalPrompt: '원본', interviewDecisions: [], target })

    expect(result.prompt).toBe('원본')
    expect(result.optimized).toBe(false)
    expect(result.warning).toContain('offline')
  })
})
