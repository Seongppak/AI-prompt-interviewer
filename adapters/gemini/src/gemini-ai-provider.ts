import type {
  AIProvider,
  GenerateRequest,
  GenerateResponse,
} from '../../../packages/core/src'

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models'
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest']
const EXCLUDED_MODEL_PATTERN = /embedding|aqa|imagen|veo|tts|image|audio|live|learnlm/i

type Fetcher = typeof fetch

export interface GeminiAIProviderOptions {
  apiKey: string
  fetcher?: Fetcher
  models?: string[]
  timeoutMs?: number
}

interface ListedModel {
  name?: string
  supportedGenerationMethods?: string[]
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}

function scoreModel(name: string): number {
  let score = name.includes('flash') ? 100 : name.includes('pro') ? 80 : 50
  if (name.includes('lite')) score -= 15
  if (/preview|exp/.test(name)) score -= 25
  if (name.endsWith('-latest')) score += 200
  const version = /gemini-(\d+)(?:\.(\d+))?/.exec(name)
  if (version) score += Number(version[1]) * 10 + Number(version[2] ?? 0)
  return score
}

export class GeminiAIProvider implements AIProvider {
  private readonly fetcher: Fetcher
  private readonly timeoutMs: number
  private readonly options: GeminiAIProviderOptions
  private resolvedModels?: Promise<string[]>

  constructor(options: GeminiAIProviderOptions) {
    if (!options.apiKey.trim()) throw new Error('Gemini API 키가 필요합니다.')
    this.options = options
    // Window.fetch는 잘못된 this로 호출되면 Electron/Browser에서 Illegal invocation이 발생한다.
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis)
    this.timeoutMs = options.timeoutMs ?? 20_000
  }

  private endpoint(model: string): string {
    return `${API_ROOT}/${model}:generateContent`
  }

  private async discoverModels(): Promise<string[]> {
    if (this.options.models?.length) return this.options.models
    try {
      const response = await this.fetcher(API_ROOT, {
        headers: { 'x-goog-api-key': this.options.apiKey },
        signal: AbortSignal.timeout(Math.min(this.timeoutMs, 10_000)),
      })
      if (!response.ok) throw new Error(`모델 목록 조회 실패 (${response.status})`)
      const data = await response.json() as { models?: ListedModel[] }
      const models = (data.models ?? [])
        .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model) => (model.name ?? '').replace(/^models\//, ''))
        .filter((name) => name && !EXCLUDED_MODEL_PATTERN.test(name))
        .sort((a, b) => scoreModel(b) - scoreModel(a))
      return models.length ? models : FALLBACK_MODELS
    } catch {
      return FALLBACK_MODELS
    }
  }

  private models(): Promise<string[]> {
    this.resolvedModels ??= this.discoverModels()
    return this.resolvedModels
  }

  private request(request: GenerateRequest, model: string, useThinkingBudget: boolean): Promise<Response> {
    return this.fetcher(this.endpoint(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.options.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: request.prompt }] }],
        generationConfig: {
          ...(request.responseFormat === 'json' ? {
            responseMimeType: 'application/json',
            ...(request.schema ? { responseSchema: request.schema } : {}),
          } : {}),
          ...(useThinkingBudget ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? this.timeoutMs),
    })
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const failures: string[] = []
    const limit = request.purpose === 'prompt-optimization' ? 2 : 3

    for (const model of (await this.models()).slice(0, limit)) {
      for (const useThinkingBudget of [true, false]) {
        let response: Response
        try {
          response = await this.request(request, model, useThinkingBudget)
        } catch (error) {
          failures.push(`${model}: ${String(error)}`)
          break
        }

        if (response.ok) {
          const data = await response.json() as GeminiResponse
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
          if (!text) throw new Error('Gemini 응답에서 결과 텍스트를 찾지 못했습니다.')
          return { text, model }
        }

        const body = await response.text().catch(() => '')
        failures.push(`${model}(thinking=${useThinkingBudget}): ${response.status} ${body.slice(0, 120)}`)
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Gemini API 인증 오류 (${response.status}). API 키를 확인하세요.`)
        }
        if (response.status !== 400) break
      }
    }

    throw new Error(`Gemini 요청이 모두 실패했습니다:\n${failures.join('\n')}`)
  }
}
