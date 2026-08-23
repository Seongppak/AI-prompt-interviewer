export type AIPICommand =
  | { type: 'PROMPT_RECEIVED'; prompt: string; sourceTargetId?: string }
  | { type: 'INTERVIEW_ANSWERED'; sessionId: string; questionId: string; answer: string }
  | { type: 'INTERVIEW_SKIPPED'; sessionId: string; questionId: string }
  | { type: 'PROMPT_OPTIMIZATION_REQUESTED'; sessionId: string; targetId: string }
  | { type: 'PROMPT_DELIVERY_REQUESTED'; prompt: string; targetId: string }

export function parsePromptReceived(value: unknown): Extract<AIPICommand, { type: 'PROMPT_RECEIVED' }> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const message = value as Record<string, unknown>
  if (message.type !== 'PROMPT_RECEIVED' || typeof message.prompt !== 'string') return undefined
  const prompt = message.prompt.trim()
  if (!prompt) return undefined
  return {
    type: 'PROMPT_RECEIVED',
    prompt,
    ...(typeof message.sourceTargetId === 'string' && message.sourceTargetId.trim()
      ? { sourceTargetId: message.sourceTargetId.trim().toLowerCase() }
      : {}),
  }
}
