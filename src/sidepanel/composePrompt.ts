import type { Question } from './data/mockQuestions'

export function composePrompt(
  questions: Question[],
  answers: Record<string, string>,
): string {
  const lines = questions.map((q) => `- ${q.text} ${answers[q.id]}`)
  return `다음 조건을 참고해서 답변해줘:\n${lines.join('\n')}`
}
