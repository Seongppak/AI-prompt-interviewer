import type { Question } from '../types/question'

export interface BuildPromptInput {
  originalPrompt: string
  questions: Question[]
  answers: Record<string, string>
}

export function composePrompt(
  originalPrompt: string,
  questions: Question[],
  answers: Record<string, string>,
): string {
  const lines = questions
    .filter((question) => answers[question.id])
    .map((question) => `- ${question.text} ${answers[question.id]}`)

  if (lines.length === 0) return originalPrompt
  return `${originalPrompt}\n\n다음 조건을 참고해서 답변해줘:\n${lines.join('\n')}`
}

export class PromptBuilder {
  build(input: BuildPromptInput): string {
    return composePrompt(input.originalPrompt, input.questions, input.answers)
  }
}
