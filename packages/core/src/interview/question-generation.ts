import type { AIProvider } from '../ports/ai-provider'
import { NOOP_LOGGER, type CoreLogger } from '../ports/logger'
import { DEFAULT_TARGET_PROFILES, findTargetProfile, type TargetProfile } from '../target/target-profile'
import type { Question, QuestionOption } from '../types/question'
import { AIPIError } from '../types/result'
import type { GeneratedInterview, TargetRecommendation } from './interview-state'

export const INTERVIEW_RESPONSE_SCHEMA = {
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
    recommendedTargetId: { type: 'STRING' },
    recommendedTargetReason: { type: 'STRING' },
  },
  required: ['questions'],
} as const

export function buildQuestionGenerationPrompt(
  originalPrompt: string,
  targets: readonly TargetProfile[] = DEFAULT_TARGET_PROFILES,
): string {
  const targetList = targets.map((target) => `${target.id}(${target.displayName})`).join(', ')
  return [
    '사용자가 AI에게 아래 프롬프트를 보내려고 합니다.',
    `"""${originalPrompt}"""`,
    '',
    '좋은 답변에 꼭 필요한 정보가 부족한지 분석하세요.',
    '부족한 정보가 있다면 사용자가 버튼으로 답할 객관식 질문을 2~4개 만드세요.',
    '각 질문은 2~4개의 선택지를 가져야 합니다.',
    '이미 충분히 구체적이면 questions를 빈 배열로 반환하세요.',
    'id와 category는 영문 소문자와 언더스코어로 된 안정적인 식별자를 사용하세요.',
    '문맥상 추천할 선택지가 있으면 recommendedValue와 recommendedReason을 포함하세요.',
    '',
    `작업에 가장 적합한 대상을 다음 목록에서 하나 추천할 수 있습니다: ${targetList}`,
    '특정 대상이 더 적합하면 recommendedTargetId와 recommendedTargetReason을 반환하세요.',
    '뚜렷한 차이가 없다면 두 값을 빈 문자열로 반환하세요.',
  ].join('\n')
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidResponse(`${label}의 형식이 객체가 아닙니다.`)
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw invalidResponse(`${label}이 비어 있거나 문자열이 아닙니다.`)
  }
  return value.trim()
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function invalidResponse(message: string, cause?: unknown): AIPIError {
  return new AIPIError({
    code: 'INVALID_AI_RESPONSE',
    message,
    retryable: true,
    cause,
  })
}

function parseOption(value: unknown, questionId: string): QuestionOption {
  const option = asRecord(value, `${questionId} 선택지`)
  return {
    label: requiredString(option.label, `${questionId} 선택지 label`),
    value: requiredString(option.value, `${questionId} 선택지 value`),
  }
}

function parseQuestion(value: unknown): Question {
  const item = asRecord(value, '질문')
  const id = requiredString(item.id, '질문 id')
  if (!/^[a-z][a-z0-9_]*$/.test(id)) {
    throw invalidResponse(`질문 id 형식이 잘못됐습니다: ${id}`)
  }
  if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 4) {
    throw invalidResponse(`${id} 질문의 선택지는 2~4개여야 합니다.`)
  }

  const options = item.options.map((option) => parseOption(option, id))
  if (new Set(options.map((option) => option.value)).size !== options.length) {
    throw invalidResponse(`${id} 질문에 중복된 선택지 값이 있습니다.`)
  }

  const recommendedValue = optionalString(item.recommendedValue)
  if (recommendedValue && !options.some((option) => option.value === recommendedValue)) {
    throw invalidResponse(`${id} 질문의 추천값이 선택지에 없습니다.`)
  }

  return {
    id,
    text: requiredString(item.text, `${id} 질문 text`),
    category: optionalString(item.category),
    recommendedValue,
    recommendedReason: optionalString(item.recommendedReason),
    options,
  }
}

function parseRecommendation(
  value: Record<string, unknown>,
  profiles: readonly TargetProfile[],
): TargetRecommendation | undefined {
  const rawTarget = optionalString(value.recommendedTargetId) ?? optionalString(value.recommendedSite)
  if (!rawTarget) return undefined

  const target = findTargetProfile(rawTarget, profiles)
  if (!target) return undefined
  const reason = optionalString(value.recommendedTargetReason)
    ?? optionalString(value.recommendedSiteReason)
    ?? `${target.displayName}의 기능이 이 작업에 적합합니다.`
  return { targetId: target.id, displayName: target.displayName, reason }
}

export function parseGeneratedInterview(
  text: string,
  profiles: readonly TargetProfile[] = DEFAULT_TARGET_PROFILES,
): GeneratedInterview {
  let parsed: unknown
  try {
    const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    parsed = JSON.parse(normalized)
  } catch (error) {
    throw invalidResponse('AI 응답을 JSON으로 해석할 수 없습니다.', error)
  }

  const data = asRecord(parsed, 'AI 응답')
  if (!Array.isArray(data.questions) || data.questions.length > 4) {
    throw invalidResponse('questions는 최대 4개의 배열이어야 합니다.')
  }
  const questions = data.questions.map(parseQuestion)
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    throw invalidResponse('중복된 질문 id가 있습니다.')
  }

  return {
    questions,
    recommendation: parseRecommendation(data, profiles),
  }
}

export class QuestionGenerationService {
  private readonly provider: AIProvider
  private readonly targets: readonly TargetProfile[]
  private readonly logger: CoreLogger

  constructor(
    provider: AIProvider,
    targets: readonly TargetProfile[] = DEFAULT_TARGET_PROFILES,
    logger: CoreLogger = NOOP_LOGGER,
  ) {
    this.provider = provider
    this.targets = targets
    this.logger = logger
  }

  async generate(originalPrompt: string): Promise<GeneratedInterview> {
    const response = await this.provider.generate({
      purpose: 'interview-questions',
      prompt: buildQuestionGenerationPrompt(originalPrompt, this.targets),
      responseFormat: 'json',
      schema: INTERVIEW_RESPONSE_SCHEMA,
      timeoutMs: 20_000,
    })
    const result = parseGeneratedInterview(response.text, this.targets)
    await this.logger.log('question-generation', 'info', '인터뷰 질문 생성 완료', {
      questionCount: result.questions.length,
      recommendedTargetId: result.recommendation?.targetId,
      model: response.model,
    })
    return result
  }
}
