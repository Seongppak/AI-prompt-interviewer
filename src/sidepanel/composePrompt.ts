import type { Question } from '../shared/question'

export function composePrompt(
  originalQuestion: string,
  questions: Question[],
  answers: Record<string, string>,
): string {
  const lines = questions.filter((q) => answers[q.id]).map((q) => `- ${q.text} ${answers[q.id]}`)
  if (lines.length === 0) return originalQuestion

  return `${originalQuestion}\n\n다음 조건을 참고해서 답변해줘:\n${lines.join('\n')}`
}
