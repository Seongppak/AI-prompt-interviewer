import { describe, expect, it } from 'vitest'
import {
  DOUBLE_SEND_WINDOW_MS,
  isDoubleSend,
  matchesBypassShortcut,
  type SendAttempt,
} from './sendBypass'

const input = {} as HTMLElement

function attempt(overrides: Partial<SendAttempt> = {}): SendAttempt {
  return { input, question: '바로 보내기', at: 1_000, ...overrides }
}

describe('send bypass gestures', () => {
  it('treats the same prompt submitted twice inside the window as a bypass', () => {
    expect(isDoubleSend(attempt(), attempt({ at: 1_000 + DOUBLE_SEND_WINDOW_MS }))).toBe(true)
  })

  it('does not bypass a late, edited, or different-input submission', () => {
    expect(isDoubleSend(attempt(), attempt({ at: 1_001 + DOUBLE_SEND_WINDOW_MS }))).toBe(false)
    expect(isDoubleSend(attempt(), attempt({ question: '수정됨', at: 1_100 }))).toBe(false)
    expect(isDoubleSend(attempt(), attempt({ input: {} as HTMLElement, at: 1_100 }))).toBe(false)
  })

  it('matches the configured keyboard shortcut without stealing Shift+Enter', () => {
    expect(
      matchesBypassShortcut(
        { key: 'Enter', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
        'ctrl_enter',
      ),
    ).toBe(true)
    expect(
      matchesBypassShortcut(
        { key: 'Enter', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false },
        'ctrl_enter',
      ),
    ).toBe(true)
    expect(
      matchesBypassShortcut(
        { key: 'Enter', ctrlKey: false, metaKey: false, altKey: true, shiftKey: false },
        'alt_enter',
      ),
    ).toBe(true)
    expect(
      matchesBypassShortcut(
        { key: 'Enter', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true },
        'ctrl_enter',
      ),
    ).toBe(false)
  })
})
