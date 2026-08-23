import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../shared/settings', () => ({ getApiKey: vi.fn().mockResolvedValue('secret-key') }))
vi.mock('../shared/geminiModels', () => ({
  resolveModels: vi.fn().mockResolvedValue(['gemini-test']),
}))
vi.mock('../shared/logger', () => ({ log: vi.fn() }))

import { getBestEffortPrompt, optimizePromptForSite } from './optimizePrompt'

afterEach(() => vi.unstubAllGlobals())

const source = {
  originalPrompt: '쇼핑몰을 만들어줘',
  questions: [{
    id: 'language',
    text: '작성 언어는?',
    category: 'language',
    options: [
      { label: '한국어', value: '한국어' },
      { label: '영어', value: '영어' },
    ],
  }],
  answers: { language: '한국어' },
}

describe('운영 프롬프트 최적화 Core facade', () => {
  it('원문과 인터뷰 결정을 구조화해 Gemini에 보내고 새 프롬프트만 반환한다', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '한국어로 작성하는 쇼핑몰을 만들어줘.' }] } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)

    await expect(optimizePromptForSite(source, 'ChatGPT'))
      .resolves.toBe('한국어로 작성하는 쇼핑몰을 만들어줘.')

    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))
    const prompt = request.contents[0].parts[0].text as string
    expect(prompt).toContain('"originalPrompt": "쇼핑몰을 만들어줘"')
    expect(prompt).toContain('"answer": "한국어"')
    expect(prompt).toContain('질문과 답변 목록을 덧붙이거나')
  })

  it('Gemini 실패 시 기존처럼 답변이 포함된 조립 프롬프트로 대체한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })))

    await expect(getBestEffortPrompt(source, 'ChatGPT')).resolves.toBe(
      '쇼핑몰을 만들어줘\n\n다음 조건을 참고해서 답변해줘:\n- 작성 언어는? 한국어',
    )
  })
})
