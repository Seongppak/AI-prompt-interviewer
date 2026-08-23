export interface OriginalQuestionMessage {
  type: 'ORIGINAL_QUESTION'
  question: string
  hostname: string
}

export interface BrowserMessageSender {
  tab?: {
    id?: number
    url?: string
  }
}

export interface ChromeRuntimeMessagePort {
  onMessage: {
    addListener(listener: (message: unknown, sender: BrowserMessageSender) => void): void
    removeListener?(listener: (message: unknown, sender: BrowserMessageSender) => void): void
  }
}

export interface OriginalQuestionEnvelope {
  message: OriginalQuestionMessage
  sender: BrowserMessageSender
}

export function parseOriginalQuestionMessage(message: unknown): OriginalQuestionMessage | undefined {
  if (typeof message !== 'object' || message === null) return undefined
  const candidate = message as Record<string, unknown>
  if (candidate.type !== 'ORIGINAL_QUESTION') return undefined
  if (typeof candidate.question !== 'string' || !candidate.question.trim()) return undefined
  if (typeof candidate.hostname !== 'string' || !candidate.hostname.trim()) return undefined
  return {
    type: 'ORIGINAL_QUESTION',
    question: candidate.question.trim(),
    hostname: candidate.hostname.trim().toLowerCase(),
  }
}

export function registerOriginalQuestionListener(
  runtime: ChromeRuntimeMessagePort,
  handler: (envelope: OriginalQuestionEnvelope) => void,
): () => void {
  const listener = (message: unknown, sender: BrowserMessageSender): void => {
    const parsed = parseOriginalQuestionMessage(message)
    if (parsed) handler({ message: parsed, sender })
  }
  runtime.onMessage.addListener(listener)
  return () => runtime.onMessage.removeListener?.(listener)
}
