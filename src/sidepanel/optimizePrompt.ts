import { log } from '../shared/logger'
import { getApiKey } from '../shared/settings'

const MODEL = 'gemini-flash-latest'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
const REQUEST_TIMEOUT_MS = 15_000

function buildPrompt(prompt: string, siteName: string): string {
  return [
    '다음은 AI에게 보낼 프롬프트입니다.',
    `"""${prompt}"""`,
    '',
    `이 프롬프트를 ${siteName}에 최적화된 형태로 다시 작성하세요.`,
    `${siteName}가 요구사항을 잘 이해하고 좋은 결과를 내도록, 그 AI의 특성에 맞는 구조(필요하다면 태그, 목록, 단계별`,
    '지시 등)와 어투로 바꾸세요. 원본의 의미와 요구사항은 절대 바꾸지 말고 표현 방식만 최적화하세요.',
    '최적화된 프롬프트 텍스트만 반환하세요. 설명, 따옴표, 그 밖의 다른 말은 포함하지 마세요.',
  ].join('\n')
}

// 실패하면 예외를 던진다 — 호출부에서 원래 프롬프트로 대체(fallback)하도록 설계됨.
export async function optimizePromptForSite(prompt: string, siteName: string): Promise<string> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('no Gemini API key set')

  log('sidepanel', 'info', 'optimizing prompt for site', { siteName })
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(prompt, siteName) }] }],
      generationConfig: {
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

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
