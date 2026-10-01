import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOUBLE_SEND_WINDOW_MS } from './sendBypass'

vi.mock('../shared/logger', () => ({ log: vi.fn() }))
vi.mock('../shared/settings', () => ({
  getExtensionEnabled: async () => true,
  getBypassShortcut: async () => 'ctrl_enter',
}))
vi.mock('../shared/storage', () => ({ subscribeStored: vi.fn() }))
vi.mock('../shared/promptLink', () => ({ decodePromptHash: () => null }))
vi.mock('../shared/sites', () => ({
  getSiteConfig: () => ({ inputSelectors: ['#input'], sendButtonSelector: '#send' }),
}))

describe('content script send lifecycle', () => {
  let surface: EventTarget
  let input: { tagName: string; innerText: string; contains: (node: unknown) => boolean }
  let button: { matches: () => boolean; closest: () => unknown; click: ReturnType<typeof vi.fn> }
  let sendMessage: ReturnType<typeof vi.fn>
  let hasButton: boolean

  beforeEach(async () => {
    vi.resetModules()
    vi.useFakeTimers()
    surface = new EventTarget()
    input = { tagName: 'DIV', innerText: '첫 질문', contains: (node) => node === input }
    hasButton = true
    button = {
      matches: () => false,
      closest: () => button,
      click: vi.fn(() => {
        const click = new Event('click', { cancelable: true })
        Object.defineProperty(click, 'target', { value: button })
        surface.dispatchEvent(click)
        if (!click.defaultPrevented) input.innerText = ''
      }),
    }
    sendMessage = vi.fn(async () => undefined)
    vi.stubGlobal('window', surface)
    vi.stubGlobal('document', {
      querySelector: (selector: string) => selector === '#input' ? input : hasButton ? button : null,
    })
    vi.stubGlobal('location', { hostname: 'chatgpt.com', hash: '' })
    vi.stubGlobal('chrome', { runtime: { sendMessage, onMessage: { addListener: vi.fn() } } })
    await import('./content')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function enter(overrides: Record<string, unknown> = {}) {
    const event = new Event('keydown', { cancelable: true })
    Object.defineProperties(event, Object.fromEntries(Object.entries({
      target: input, key: 'Enter', shiftKey: false, ctrlKey: false,
      metaKey: false, altKey: false, repeat: false, isComposing: false, ...overrides,
    }).map(([key, value]) => [key, { value }])))
    surface.dispatchEvent(event)
    return event
  }

  it('bypasses only the double-Enter question and intercepts the next question', () => {
    expect(enter().defaultPrevented).toBe(true)
    vi.advanceTimersByTime(100)
    enter()
    expect(button.click).toHaveBeenCalledTimes(1)
    expect(input.innerText).toBe('')
    vi.advanceTimersByTime(DOUBLE_SEND_WINDOW_MS)
    expect(sendMessage).not.toHaveBeenCalled()

    input.innerText = '다음 질문'
    expect(enter().defaultPrevented).toBe(true)
    vi.advanceTimersByTime(DOUBLE_SEND_WINDOW_MS)
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'ORIGINAL_QUESTION', question: '다음 질문', hostname: 'chatgpt.com',
    })
  })

  it('restores interception after a shortcut and a nested send-button click', () => {
    enter({ ctrlKey: true })
    expect(button.click).toHaveBeenCalledTimes(1)
    input.innerText = '단축키 다음 질문'
    enter()
    vi.advanceTimersByTime(DOUBLE_SEND_WINDOW_MS)
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('falls back to the native Enter event without leaving a persistent bypass', () => {
    hasButton = false
    enter()
    vi.advanceTimersByTime(100)
    expect(enter().defaultPrevented).toBe(false)
    input.innerText = '다음 질문'
    enter()
    vi.advanceTimersByTime(DOUBLE_SEND_WINDOW_MS)
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })
})
