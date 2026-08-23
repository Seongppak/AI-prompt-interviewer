import { describe, expect, it, vi } from 'vitest'
import { ClipboardTargetAdapter } from '../src'

describe('ClipboardTargetAdapter', () => {
  it('클립보드 텍스트를 정규화해 프롬프트로 받는다', async () => {
    const adapter = new ClipboardTargetAdapter({
      isAvailable: () => true,
      readText: () => '  새 프롬프트  ',
      writeText: vi.fn(),
    })
    await expect(adapter.receivePrompt()).resolves.toBe('새 프롬프트')
  })

  it('완성된 프롬프트를 클립보드에 쓴다', async () => {
    const writeText = vi.fn()
    const adapter = new ClipboardTargetAdapter({
      isAvailable: () => true,
      readText: () => '',
      writeText,
    })
    await adapter.sendPrompt('  완성 프롬프트  ')
    expect(writeText).toHaveBeenCalledWith('완성 프롬프트')
  })

  it('빈 프롬프트는 전달하지 않는다', async () => {
    const adapter = new ClipboardTargetAdapter({
      isAvailable: () => true,
      readText: () => '',
      writeText: vi.fn(),
    })
    await expect(adapter.sendPrompt('   ')).rejects.toThrow('비어 있습니다')
  })
})
