import { log } from '../shared/logger'
import { getApiKey } from '../shared/settings'
import { invalidateModelCache, resolveModels } from '../shared/geminiModels'
import { getTargetGuidance } from '../shared/promptTargets'

// 실제로 시도할 모델 수. 최적화는 실패해도 원본으로 대체되므로 짧게 끊는다.
const MAX_MODELS_TO_TRY = 2
const REQUEST_TIMEOUT_MS = 15_000

function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

function buildPrompt(prompt: string, siteName: string): string {
  // 예전에는 대상 이름만 넘겨서 "ChatGPT에 맞게 바꿔라"라고만 했다. 그러면 대상의 특성을
  // 모델의 막연한 짐작에 전적으로 의존하게 된다. prompts/targets.md의 실제 지침을 함께 넘긴다.
  const guidance = getTargetGuidance(siteName)

  return [
    '다음은 AI에게 보낼 프롬프트입니다.',
    `"""${prompt}"""`,
    '',
    `이 프롬프트를 ${siteName}에 최적화된 형태로 다시 작성하세요.`,
    '아래 지침을 따르세요:',
    '',
    guidance,
    '',
    '원본의 의미와 요구사항은 절대 바꾸지 말고 표현 방식만 최적화하세요.',
    '원본에 없는 요구사항을 새로 추가하지 마세요.',
    '최적화된 프롬프트 텍스트만 반환하세요. 설명, 따옴표, 그 밖의 다른 말은 포함하지 마세요.',
  ].join('\n')
}

function requestOptimizedPrompt(
  model: string,
  prompt: string,
  siteName: string,
  apiKey: string,
  useThinkingBudget: boolean,
): Promise<Response> {
  return fetch(endpointFor(model), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(prompt, siteName) }] }],
      generationConfig: useThinkingBudget ? { thinkingConfig: { thinkingBudget: 0 } } : {},
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

// 실패하면 예외를 던진다 — 호출부에서 원래 프롬프트로 대체(fallback)하도록 설계됨.
export async function optimizePromptForSite(prompt: string, siteName: string): Promise<string> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('no Gemini API key set')

  const models = (await resolveModels(apiKey)).slice(0, MAX_MODELS_TO_TRY)
  log('sidepanel', 'info', 'optimizing prompt for site', { siteName, models })

  let res: Response | null = null
  let sawMissingModel = false

  for (const model of models) {
    res = await requestOptimizedPrompt(model, prompt, siteName, apiKey, true)

    // 모델이 thinkingBudget: 0을 지원하지 않으면 400이 나므로 그 옵션 없이 재시도한다.
    if (res.status === 400) {
      log('sidepanel', 'warn', `${model} 400 응답, thinkingConfig 없이 재시도`, { siteName })
      res = await requestOptimizedPrompt(model, prompt, siteName, apiKey, false)
    }

    if (res.ok || res.status === 401 || res.status === 403) break

    if (res.status === 404) sawMissingModel = true
    log('sidepanel', 'warn', `${model} 실패`, { siteName, status: res.status })
  }

  // 캐시된 모델이 단종된 경우 — 다음 시도에서 목록을 새로 받도록 캐시를 비운다.
  if (sawMissingModel) await invalidateModelCache()

  if (!res) throw new Error('Gemini API 요청을 보내지 못했습니다')

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini API 오류 (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) {
    throw new Error('Gemini 응답에서 결과 텍스트를 찾지 못했습니다')
  }

  log('sidepanel', 'info', 'optimized prompt ready', { siteName })
  return text
}

// optimizePromptForSite가 실패해도 삽입 자체는 막지 않도록 원본 프롬프트로 조용히 대체한다.
export async function getBestEffortPrompt(basePrompt: string, siteName: string): Promise<string> {
  try {
    return await optimizePromptForSite(basePrompt, siteName)
  } catch (err) {
    log('sidepanel', 'warn', '프롬프트 최적화 실패, 원본으로 대체', { siteName, error: String(err) })
    return basePrompt
  }
}
