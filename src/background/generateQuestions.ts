import type { Question } from '../shared/question'
import { log } from '../shared/logger'
import { invalidateModelCache, resolveModels } from '../shared/geminiModels'

// 실제로 시도할 모델 수. 목록 상위 몇 개만 써서 실패 시 대기 시간이 길어지지 않게 한다.
const MAX_MODELS_TO_TRY = 3

function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

// 일시적 오류(과부하·한도 초과)만 재시도 대상. 404/401 등은 재시도해도 소용없다.
const RETRYABLE_STATUSES = [429, 500, 503]
// API 키 자체가 문제인 경우(모델을 바꿔도 소용없음)만 즉시 포기한다.
const FATAL_STATUSES = [401, 403]
const MAX_ATTEMPTS_PER_MODEL = 2
const REQUEST_TIMEOUT_MS = 20_000

const QUESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          text: { type: 'STRING' },
          category: { type: 'STRING' },
          recommendedValue: { type: 'STRING' },
          recommendedReason: { type: 'STRING' },
          options: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                label: { type: 'STRING' },
                value: { type: 'STRING' },
              },
              required: ['label', 'value'],
            },
          },
        },
        required: ['id', 'text', 'options'],
      },
    },
    recommendedSite: { type: 'STRING' },
    recommendedSiteReason: { type: 'STRING' },
  },
  required: ['questions'],
}

function buildPrompt(question: string): string {
  return [
    '사용자가 AI에게 아래 질문을 하려고 합니다.',
    `"""${question}"""`,
    '',
    '이 질문에 좋은 답변을 하려면 AI가 추가로 알아야 할 정보가 있는지 판단하세요.',
    '부족한 정보가 있다면, 사용자가 버튼을 눌러 답할 수 있는 객관식 질문을 2~4개 만드세요.',
    '각 질문은 2~4개의 선택지를 가져야 합니다.',
    '질문이 이미 충분히 구체적이라면 questions를 빈 배열로 반환하세요.',
    '각 question의 id는 영문 소문자와 언더스코어만 사용한 짧은 식별자로 만드세요.',
    '각 question에는 category 필드도 포함하세요. 운영체제, 답변 언어, 설명의 상세도, 말투/톤, 대상 독자처럼',
    '다른 프로젝트의 질문에서도 반복될 수 있는 보편적인 주제라면 "os", "language", "detail_level"처럼',
    '영문 소문자와 언더스코어로 된 안정적인 슬러그를 사용하세요(같은 주제는 항상 같은 슬러그).',
    '이번 질문에만 해당하는 매우 구체적인 내용이라면 category를 빈 문자열로 두세요.',
    '각 question에는 recommendedValue와 recommendedReason 필드도 포함하세요.',
    '사용자의 원래 질문 맥락상 선택지 중 일반적으로 가장 무난하거나 좋은 기본값이 있다면,',
    '그 옵션의 value를 recommendedValue에 넣고 왜 추천하는지 한 문장으로 recommendedReason에 설명하세요.',
    '특별히 추천할 이유가 없다면 둘 다 빈 문자열로 두세요.',
    '',
    'recommendedSite와 recommendedSiteReason 필드도 포함하세요.',
    '이 작업의 성격상 ChatGPT, Claude, Gemini, Grok, Perplexity, Copilot 등 실제 존재하는 AI 서비스 중',
    '더 적합한 곳이 있다면 그 이름을 recommendedSite에 넣고, 왜 적합한지 한 문장으로 recommendedSiteReason에',
    '설명하세요. 예를 들어 사업계획서 작성처럼 긴 글의 논리적 구조가 중요하면 Claude, 최신 뉴스나 실시간 정보가',
    '필요하면 Gemini나 Perplexity를 추천할 수 있습니다. 특별히 다른 AI가 더 낫다고 볼 이유가 없다면 둘 다',
    '빈 문자열로 두세요.',
  ].join('\n')
}

async function fetchWithRetry(model: string, request: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    let res: Response | null = null
    try {
      res = await fetch(endpointFor(model), {
        ...request,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.ok || !RETRYABLE_STATUSES.includes(res.status) || attempt >= MAX_ATTEMPTS_PER_MODEL) {
        return res
      }
    } catch (err) {
      // 타임아웃·네트워크 오류도 일시적 오류로 보고 재시도한다.
      if (attempt >= MAX_ATTEMPTS_PER_MODEL) throw err
    }

    const delayMs = 1000 * attempt
    log('background', 'warn', `Gemini ${res ? `${res.status} 응답` : '요청 실패(타임아웃/네트워크)'}, ${delayMs}ms 후 재시도`, {
      model,
      attempt,
      maxAttempts: MAX_ATTEMPTS_PER_MODEL,
    })
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
}

export interface InterviewResult {
  questions: Question[]
  recommendedSite: string
  recommendedSiteReason: string
}

function buildRequest(question: string, apiKey: string, useThinkingBudget: boolean): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(question) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: QUESTION_SCHEMA,
        // 단순한 구조화 생성 작업이라 thinking 단계 없이도 품질 차이가 거의 없다.
        // thinking을 끄면 응답 속도가 크게 빨라진다.
        ...(useThinkingBudget ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
  }
}

// 모델마다 thinkingConfig 유무 두 가지를 시도한다. 모델·옵션 조합 중 하나라도
// 성공하면 그 응답을 쓰고, 전부 실패하면 각 조합의 실패 사유를 모아서 던진다.
async function fetchWithFallback(question: string, apiKey: string): Promise<Response> {
  const models = (await resolveModels(apiKey)).slice(0, MAX_MODELS_TO_TRY)
  log('background', 'info', 'requesting Gemini', { models })

  const failures: string[] = []
  let sawMissingModel = false

  for (const model of models) {
    for (const useThinkingBudget of [true, false]) {
      let res: Response
      try {
        res = await fetchWithRetry(model, buildRequest(question, apiKey, useThinkingBudget))
      } catch (err) {
        failures.push(`${model}: ${String(err)}`)
        break // 네트워크·타임아웃이면 같은 모델의 다른 옵션도 볼 것 없다.
      }

      // API 키 자체가 잘못됐다면 어떤 모델·옵션으로도 통과할 수 없다.
      if (res.ok || FATAL_STATUSES.includes(res.status)) return res

      if (res.status === 404) sawMissingModel = true

      const body = await res.clone().text().catch(() => '')
      failures.push(`${model}(thinking=${useThinkingBudget}): ${res.status} ${body.slice(0, 120)}`)
      log('background', 'warn', `${model} 실패`, {
        status: res.status,
        useThinkingBudget,
      })

      // 400이 아니면 옵션 문제가 아니므로 같은 모델을 다시 시도할 이유가 없다.
      if (res.status !== 400) break
    }
  }

  // 캐시된 모델이 단종된 경우 — 다음 시도에서 목록을 새로 받도록 캐시를 비운다.
  if (sawMissingModel) await invalidateModelCache()

  throw new Error(`Gemini 요청이 모두 실패했습니다:\n${failures.join('\n')}`)
}

export async function generateInterviewQuestions(
  question: string,
  apiKey: string,
): Promise<InterviewResult> {
  const res = await fetchWithFallback(question, apiKey)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini API 오류 (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini 응답에서 결과 텍스트를 찾지 못했습니다')
  }

  const parsed = JSON.parse(text) as Partial<InterviewResult>
  return {
    questions: parsed.questions ?? [],
    recommendedSite: parsed.recommendedSite ?? '',
    recommendedSiteReason: parsed.recommendedSiteReason ?? '',
  }
}
