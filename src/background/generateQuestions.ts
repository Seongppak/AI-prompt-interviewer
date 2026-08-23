import { GeminiAIProvider } from '../../adapters/gemini/src'
import { QuestionGenerationService } from '../../packages/core/src'
import type { Question } from '../shared/question'
import { log } from '../shared/logger'
import { resolveModels } from '../shared/geminiModels'

export interface InterviewResult {
  questions: Question[]
  recommendedSite: string
  recommendedSiteReason: string
}

// 기존 background API와 저장 형식은 유지하고, 내부 생성만 공용 Core/Provider에 위임한다.
export async function generateInterviewQuestions(
  question: string,
  apiKey: string,
): Promise<InterviewResult> {
  const models = await resolveModels(apiKey)
  const provider = new GeminiAIProvider({ apiKey, models })
  const service = new QuestionGenerationService(provider, undefined, { log })
  const result = await service.generate(question)

  return {
    questions: result.questions,
    recommendedSite: result.recommendation?.displayName ?? '',
    recommendedSiteReason: result.recommendation?.reason ?? '',
  }
}
