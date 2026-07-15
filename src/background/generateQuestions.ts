import type { Question } from '../shared/question'
import { log } from '../shared/logger'

// 앞 모델이 과부하(503 등)로 계속 실패하면 뒤의 경량 모델로 폴백한다.
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest']

function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

// 일시적 오류(과부하·한도 초과)만 재시도 대상. 404/401 등은 재시도해도 소용없다.
const RETRYABLE_STATUSES = [429, 500, 503]
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

async function fetchWithFallback(request: RequestInit): Promise<Response> {
  let lastResponse: Response | null = null
  let lastError: unknown = null

  for (const [index, model] of GEMINI_MODELS.entries()) {
    try {
      const res = await fetchWithRetry(model, request)
      if (res.ok || !RETRYABLE_STATUSES.includes(res.status)) return res
      lastResponse = res
    } catch (err) {
      lastError = err
    }

    const nextModel = GEMINI_MODELS[index + 1]
    if (nextModel) {
      log('background', 'warn', `${model} 실패 지속, ${nextModel}로 폴백`)
    }
  }

  if (lastResponse) return lastResponse
  throw lastError
}

export async function generateInterviewQuestions(
  question: string,
  apiKey: string,
): Promise<Question[]> {
  log('background', 'info', 'requesting Gemini', { model: GEMINI_MODELS[0] })
  const res = await fetchWithFallback({
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
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini API 오류 (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini 응답에서 결과 텍스트를 찾지 못했습니다')
  }

  const parsed = JSON.parse(text) as { questions: Question[] }
  return parsed.questions ?? []
}
