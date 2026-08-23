import { describe, expect, it, vi } from 'vitest'
import { DesktopChatTargetAdapter, type DesktopPromptPort } from '../src'

function port(overrides: Partial<DesktopPromptPort> = {}): DesktopPromptPort {
  return {
    isAvailable: () => true,
    activeTargetId: () => 'codex',
    readPrompt: () => '  기존 한글 프롬프트  ',
    insertPrompt: vi.fn().mockResolvedValue({ inserted: true }),
    ...overrides,
  }
}

describe('DesktopChatTargetAdapter', () => {
  it('활성 데스크톱 대상에서 캡처한 프롬프트를 읽는다', async () => {
    const adapter = new DesktopChatTargetAdapter('CODEX', port())
    expect(adapter.id).toBe('codex')
    await expect(adapter.detect()).resolves.toBe(true)
    await expect(adapter.receivePrompt()).resolves.toBe('기존 한글 프롬프트')
  })

  it('완성 프롬프트를 Port를 통해 원래 채팅창에 전달한다', async () => {
    const insertPrompt = vi.fn().mockResolvedValue({ inserted: true })
    const adapter = new DesktopChatTargetAdapter('codex', port({ insertPrompt }))
    await adapter.sendPrompt('  새 한글 프롬프트  ')
    expect(insertPrompt).toHaveBeenCalledWith('새 한글 프롬프트')
  })

  it('다른 대상이나 삽입 실패를 명확한 오류로 반환한다', async () => {
    const inactive = new DesktopChatTargetAdapter('claude-code', port())
    await expect(inactive.sendPrompt('프롬프트')).rejects.toThrow('원본 채팅창')

    const failed = new DesktopChatTargetAdapter('codex', port({
      insertPrompt: vi.fn().mockResolvedValue({ inserted: false, error: '창이 닫혔습니다.' }),
    }))
    await expect(failed.sendPrompt('프롬프트')).rejects.toThrow('창이 닫혔습니다.')
  })
})
