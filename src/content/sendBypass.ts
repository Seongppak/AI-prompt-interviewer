export const DOUBLE_SEND_WINDOW_MS = 500

export type BypassShortcut = 'ctrl_enter' | 'alt_enter'

export interface SendAttempt {
  input: HTMLElement
  question: string
  at: number
}

export function isDoubleSend(previous: SendAttempt | null, current: SendAttempt): boolean {
  if (!previous) return false
  const elapsed = current.at - previous.at
  return (
    previous.input === current.input &&
    previous.question === current.question &&
    elapsed >= 0 &&
    elapsed <= DOUBLE_SEND_WINDOW_MS
  )
}

export function matchesBypassShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  shortcut: BypassShortcut,
): boolean {
  if (event.key !== 'Enter' || event.shiftKey) return false
  if (shortcut === 'alt_enter') return event.altKey && !event.ctrlKey && !event.metaKey
  return (event.ctrlKey || event.metaKey) && !event.altKey
}
