import { describe, expect, it, vi } from 'vitest'
import {
  BrowserTargetAdapter,
  findBrowserSite,
  type BrowserEnvironment,
  type BrowserPromptPort,
} from '../src'

describe('BrowserTargetAdapter', () => {
  const chatGpt = findBrowserSite('chatgpt.com')!

  function create(hostname = 'chatgpt.com') {
    const environment: BrowserEnvironment = { getHostname: () => hostname }
    const promptPort: BrowserPromptPort = {
      readPrompt: vi.fn(() => '  원본 프롬프트  '),
      insertPrompt: vi.fn(() => true),
    }
    return { adapter: new BrowserTargetAdapter(chatGpt, environment, promptPort), promptPort }
  }

  it('detects only its configured hostname and receives a trimmed prompt', async () => {
    const { adapter } = create()
    expect(await adapter.detect()).toBe(true)
    expect(await adapter.receivePrompt()).toBe('원본 프롬프트')

    const other = create('claude.ai').adapter
    expect(await other.detect()).toBe(false)
    expect(await other.receivePrompt()).toBeNull()
  })

  it('sends a prompt through the injected page port without submitting it', async () => {
    const { adapter, promptPort } = create()
    await adapter.sendPrompt('최적화된 프롬프트')
    expect(promptPort.insertPrompt).toHaveBeenCalledWith(chatGpt, '최적화된 프롬프트')
  })

  it('rejects blank prompts, wrong pages, and failed insertions', async () => {
    await expect(create().adapter.sendPrompt(' ')).rejects.toThrow('비어 있습니다')
    await expect(create('claude.ai').adapter.sendPrompt('prompt')).rejects.toThrow('페이지가 아닙니다')

    const environment: BrowserEnvironment = { getHostname: () => 'chatgpt.com' }
    const promptPort: BrowserPromptPort = { readPrompt: () => null, insertPrompt: () => false }
    await expect(new BrowserTargetAdapter(chatGpt, environment, promptPort).sendPrompt('prompt'))
      .rejects.toThrow('삽입하지 못했습니다')
  })
})
