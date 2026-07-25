import { log } from './logger'

const LIST_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const CACHE_KEY = 'geminiModelCache'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const LIST_TIMEOUT_MS = 10_000

// 목록 조회가 실패했을 때만 쓰는 최후의 수단. 버전을 고정하지 않은 별칭이라
// 특정 세대가 단종돼도 살아남을 가능성이 높다.
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest']

interface ModelCache {
  models: string[]
  fetchedAt: number
}

interface ListedModel {
  name?: string
  supportedGenerationMethods?: string[]
}

// 텍스트 생성용이 아닌 모델(임베딩·이미지·음성 등)은 후보에서 제외한다.
const EXCLUDED_NAME_PATTERN = /embedding|aqa|imagen|veo|tts|image|audio|live|learnlm/i

// -latest 별칭은 Google이 알아서 현행 모델로 이어주므로 세대가 단종돼도 404가 나지 않는다.
// 버전을 고정한 이름보다 항상 위에 오도록 버전 점수(최대 수십 점)를 압도하는 값을 준다.
const ALIAS_BONUS = 200

// 이름만 보고 "얼마나 우선해서 쓸 만한가"를 점수로 매긴다.
// 새 세대 모델이 나와도 이름 규칙만 지키면 자동으로 상위에 오도록 설계.
function scoreModel(name: string): number {
  let score = 0

  // flash 계열은 빠르고 저렴해서 이 확장의 용도(짧은 구조화 생성)에 가장 잘 맞는다.
  if (name.includes('flash')) score += 100
  else if (name.includes('pro')) score += 80
  else score += 50

  // lite는 품질이 조금 떨어지지만 충분히 빠르므로 살짝만 뒤로 민다.
  if (name.includes('lite')) score -= 15

  // preview/exp는 예고 없이 사라질 수 있어 안정 버전보다 뒤로 민다.
  if (/preview|exp/.test(name)) score -= 25

  if (name.endsWith('-latest')) score += ALIAS_BONUS

  // 버전이 고정된 이름끼리는 세대가 높을수록 우선(gemini-3-... > gemini-2.5-...).
  const version = /gemini-(\d+)(?:\.(\d+))?/.exec(name)
  if (version) {
    const major = Number(version[1])
    const minor = Number(version[2] ?? 0)
    score += major * 10 + minor
  }

  return score
}

async function readCache(): Promise<string[] | null> {
  const { [CACHE_KEY]: cached } = await chrome.storage.local.get(CACHE_KEY)
  const cache = cached as ModelCache | undefined
  if (!cache?.models?.length) return null
  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null
  return cache.models
}

// 404(모델 단종) 등으로 캐시가 더 이상 유효하지 않을 때 호출한다.
export async function invalidateModelCache(): Promise<void> {
  await chrome.storage.local.remove(CACHE_KEY)
}

async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  const res = await fetch(LIST_MODELS_URL, {
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`모델 목록 조회 실패 (${res.status})`)
  }

  const data = (await res.json()) as { models?: ListedModel[] }
  return (data.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => (model.name ?? '').replace(/^models\//, ''))
    .filter((name) => name && !EXCLUDED_NAME_PATTERN.test(name))
    .sort((a, b) => scoreModel(b) - scoreModel(a))
}

// 이 API 키로 실제 쓸 수 있는 모델을 우선순위 순으로 돌려준다.
// 모델명을 코드에 고정하지 않으므로 Google이 세대를 교체해도 그대로 동작한다.
export async function resolveModels(apiKey: string): Promise<string[]> {
  const cached = await readCache()
  if (cached) return cached

  try {
    const models = await fetchAvailableModels(apiKey)
    if (!models.length) throw new Error('사용 가능한 생성 모델이 없습니다')

    await chrome.storage.local.set({
      [CACHE_KEY]: { models, fetchedAt: Date.now() } satisfies ModelCache,
    })
    log('gemini','info', '사용 가능한 Gemini 모델 확인', { models: models.slice(0, 5) })
    return models
  } catch (err) {
    // 목록 조회가 막혀도 확장 자체는 동작해야 하므로 별칭으로 계속 진행한다.
    log('gemini','warn', '모델 목록 조회 실패, 기본 목록 사용', { error: String(err) })
    return FALLBACK_MODELS
  }
}
