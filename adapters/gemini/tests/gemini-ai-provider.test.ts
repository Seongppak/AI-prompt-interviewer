import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeminiAIProvider } from '../src'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GeminiAIProvider', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('binds the browser fetch function to globalThis', async () => {
    vi.stubGlobal('fetch', function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return Promise.resolve(jsonResponse({
        candidates: [{ content: { parts: [{ text: '바인딩된 응답' }] } }],
      }))
    })
    const provider = new GeminiAIProvider({ apiKey: 'test-secret', models: ['gemini'] })

    await expect(provider.generate({ purpose: 'prompt-optimization', prompt: 'x' }))
      .resolves.toEqual({ text: '바인딩된 응답', model: 'gemini' })
  })

  it('sends the Core optimization prompt to Gemini and returns rewritten text', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      candidates: [{ content: { parts: [{ text: '새로 작성된 최종 프롬프트' }] } }],
    }))
    const provider = new GeminiAIProvider({
      apiKey: 'test-secret',
      models: ['gemini-flash-latest'],
      fetcher,
    })

    const result = await provider.generate({
      purpose: 'prompt-optimization',
      prompt: '원문과 인터뷰 결정을 통합해서 새 프롬프트를 작성하라',
      responseFormat: 'text',
    })

    expect(result).toEqual({ text: '새로 작성된 최종 프롬프트', model: 'gemini-flash-latest' })
    const [, init] = fetcher.mock.calls[0]!
    expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'test-secret' })
    expect(String(init?.body)).toContain('원문과 인터뷰 결정을 통합')
  })

  it('retries without thinkingConfig when a model rejects that option', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'unsupported' }, 400))
      .mockResolvedValueOnce(jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"questions":[]}' }] } }],
      }))
    const provider = new GeminiAIProvider({
      apiKey: 'test-secret',
      models: ['gemini-flash-latest'],
      fetcher,
    })

    await provider.generate({ purpose: 'interview-questions', prompt: '질문 생성', responseFormat: 'json' })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain('thinkingBudget')
    expect(String(fetcher.mock.calls[1]?.[1]?.body)).not.toContain('thinkingBudget')
  })

  it('does not include the API key in authentication errors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 403))
    const provider = new GeminiAIProvider({ apiKey: 'never-log-this', models: ['gemini'], fetcher })
    await expect(provider.generate({ purpose: 'prompt-optimization', prompt: 'x' }))
      .rejects.not.toThrow('never-log-this')
  })
})
