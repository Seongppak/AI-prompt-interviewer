import { describe, expect, it, vi } from 'vitest'
import {
  parseOriginalQuestionMessage,
  registerOriginalQuestionListener,
  type BrowserMessageSender,
} from '../src/chrome-message-adapter'

describe('Chrome message adapter', () => {
  it('기존 ORIGINAL_QUESTION 형식을 검증하고 정규화한다', () => {
    expect(parseOriginalQuestionMessage({
      type: 'ORIGINAL_QUESTION',
      question: '  쇼핑몰을 만들어줘  ',
      hostname: ' ChatGPT.COM ',
    })).toEqual({
      type: 'ORIGINAL_QUESTION',
      question: '쇼핑몰을 만들어줘',
      hostname: 'chatgpt.com',
    })
  })

  it.each([
    undefined,
    { type: 'OTHER', question: '질문', hostname: 'chatgpt.com' },
    { type: 'ORIGINAL_QUESTION', question: '', hostname: 'chatgpt.com' },
    { type: 'ORIGINAL_QUESTION', question: '질문', hostname: '' },
  ])('잘못된 메시지는 무시한다: %o', (message) => {
    expect(parseOriginalQuestionMessage(message)).toBeUndefined()
  })

  it('등록된 listener에 검증된 메시지와 sender를 전달하고 해제한다', () => {
    let listener: ((message: unknown, sender: BrowserMessageSender) => void) | undefined
    const removeListener = vi.fn()
    const handler = vi.fn()
    const dispose = registerOriginalQuestionListener({
      onMessage: {
        addListener: (next) => { listener = next },
        removeListener,
      },
    }, handler)

    const sender = { tab: { id: 7, url: 'https://chatgpt.com/' } }
    listener?.({ type: 'ORIGINAL_QUESTION', question: '질문', hostname: 'chatgpt.com' }, sender)
    expect(handler).toHaveBeenCalledWith({
      message: { type: 'ORIGINAL_QUESTION', question: '질문', hostname: 'chatgpt.com' },
      sender,
    })

    dispose()
    expect(removeListener).toHaveBeenCalledWith(listener)
  })
})
