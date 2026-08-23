import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../shared/geminiModels', () => ({
  resolveModels: vi.fn().mockResolvedValue(['gemini-test']),
}))
vi.mock('../shared/logger', () => ({ log: vi.fn() }))

import { generateInterviewQuestions } from './generateQuestions'

afterEach(() => vi.unstubAllGlobals())

describe('운영 질문 생성 Core facade', () => {
  it('기존 InterviewResult 저장 형식으로 질문과 추천 사이트를 돌려준다', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        questions: [{
          id: 'language',
          text: '작성 언어는?',
          category: 'language',
          recommendedValue: 'ko',
          recommendedReason: '원문과 같습니다.',
          options: [
            { label: '한국어', value: 'ko' },
            { label: '영어', value: 'en' },
          ],
        }],
        recommendedTargetId: 'claude',
        recommendedTargetReason: '긴 글 작성에 적합합니다.',
      }) }] } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)

    const result = await generateInterviewQuestions('긴 보고서를 작성해줘', 'secret-key')

    expect(result.recommendedSite).toBe('Claude')
    expect(result.recommendedSiteReason).toBe('긴 글 작성에 적합합니다.')
    expect(result.questions).toHaveLength(1)
    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))
    expect(request.generationConfig.responseMimeType).toBe('application/json')
    expect(request.contents[0].parts[0].text).toContain('긴 보고서를 작성해줘')
  })
})
