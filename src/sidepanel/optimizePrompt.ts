import { GeminiAIProvider } from '../../adapters/gemini/src'
import {
  collectInterviewDecisions,
  composePrompt,
  findTargetProfile,
  MarkdownTargetGuidanceProvider,
  PromptOptimizer,
  type Question,
  type TargetProfile,
} from '../../packages/core/src'
import targetsMarkdown from '../../prompts/targets.md?raw'
import { resolveModels } from '../shared/geminiModels'
import { log } from '../shared/logger'
import { getApiKey } from '../shared/settings'

export interface InterviewPromptSource {
  originalPrompt: string
  questions: Question[]
  answers: Record<string, string>
}

type PromptSource = string | InterviewPromptSource

const guidanceProvider = new MarkdownTargetGuidanceProvider(targetsMarkdown)

function targetFor(siteName: string): TargetProfile {
  return findTargetProfile(siteName) ?? {
    id: siteName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'unknown',
    displayName: siteName.trim() || 'AI',
    guidanceKey: siteName.trim(),
    capabilities: [],
  }
}

function normalizedSource(source: PromptSource): InterviewPromptSource {
  return typeof source === 'string'
    ? { originalPrompt: source, questions: [], answers: {} }
    : source
}

// 기존 함수 이름은 유지하되, 구조화된 원문·질문·답변을 Core Optimizer에 전달한다.
export async function optimizePromptForSite(source: PromptSource, siteName: string): Promise<string> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('no Gemini API key set')

  const input = normalizedSource(source)
  const models = await resolveModels(apiKey)
  const provider = new GeminiAIProvider({ apiKey, models })
  const optimizer = new PromptOptimizer(provider, guidanceProvider, { log })
  const target = targetFor(siteName)
  const result = await optimizer.optimize({
    originalPrompt: input.originalPrompt,
    interviewDecisions: collectInterviewDecisions(input.questions, input.answers),
    target,
  })
  return result.prompt
}

// 최적화 실패 시에도 기존과 같이 답변이 포함된 조립 프롬프트를 삽입한다.
export async function getBestEffortPrompt(source: PromptSource, siteName: string): Promise<string> {
  try {
    return await optimizePromptForSite(source, siteName)
  } catch (error) {
    const input = normalizedSource(source)
    await log('sidepanel', 'warn', '프롬프트 최적화 실패, 조립 프롬프트로 대체', {
      siteName,
      error: String(error),
    })
    return composePrompt(input.originalPrompt, input.questions, input.answers)
  }
}
