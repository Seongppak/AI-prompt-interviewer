import { describe, expect, it } from 'vitest'
import {
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
        captured = request
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

    expect(result).toEqual({ prompt: '최적화된 결과', optimized: true, targetId: 'chatgpt' })
    expect(captured?.purpose).toBe('prompt-optimization')
    expect(captured?.prompt).toContain('공통 규칙')
    expect(captured?.prompt).toContain('전용 규칙')
    expect(captured?.prompt).toContain('"originalPrompt": "쇼핑몰을 만들어줘"')
    expect(captured?.prompt).toContain('"answer": "한국어"')
    expect(captured?.prompt).toContain('질문과 답변 목록을 덧붙이거나')
    expect(captured?.prompt).toContain('원문에 포함되어 있었던 것처럼')
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
