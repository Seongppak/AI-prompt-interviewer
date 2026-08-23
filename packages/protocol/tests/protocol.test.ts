import { describe, expect, it, vi } from 'vitest'
import { AdapterRegistry, parsePromptReceived, type TargetAdapter } from '../src'

function adapter(id: string, active: boolean): TargetAdapter {
  return {
    id,
    detect: vi.fn().mockResolvedValue(active),
    receivePrompt: vi.fn().mockResolvedValue(null),
    sendPrompt: vi.fn().mockResolvedValue(undefined),
  }
}

describe('AIPI protocol', () => {
  it('데스크톱 입력 메시지를 검증하고 정규화한다', () => {
    expect(parsePromptReceived({
      type: 'PROMPT_RECEIVED',
      prompt: '  앱을 만들어줘  ',
      sourceTargetId: ' CODEX ',
    })).toEqual({ type: 'PROMPT_RECEIVED', prompt: '앱을 만들어줘', sourceTargetId: 'codex' })
    expect(parsePromptReceived({ type: 'PROMPT_RECEIVED', prompt: '  ' })).toBeUndefined()
  })

  it('플랫폼 Adapter를 중복 없이 등록하고 활성 대상을 찾는다', async () => {
    const registry = new AdapterRegistry()
    registry.register(adapter('clipboard', true))
    registry.register(adapter('codex', false))
    expect((await registry.detect()).map(({ id }) => id)).toEqual(['clipboard'])
    expect(() => registry.register(adapter('clipboard', true))).toThrow('이미 등록된')
  })
})
