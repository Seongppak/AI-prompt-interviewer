import { log } from '../shared/logger'

const CHATGPT_URL_PATTERNS = ['https://chatgpt.com/*', 'https://chat.openai.com/*']

export type InsertResult = 'inserted' | 'no_tab' | 'failed'

export async function insertIntoChatGpt(prompt: string): Promise<InsertResult> {
  const tabs = await chrome.tabs.query({ url: CHATGPT_URL_PATTERNS })
  log('sidepanel', 'info', 'found ChatGPT tabs', { count: tabs.length })

  const tab = tabs.find((t) => t.active) ?? tabs[0]
  if (!tab?.id) {
    log('sidepanel', 'warn', 'no ChatGPT tab available')
    return 'no_tab'
  }

  log('sidepanel', 'info', 'sending INSERT_PROMPT message', { tabId: tab.id })
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: 'INSERT_PROMPT',
    prompt,
  })
  log('sidepanel', 'info', 'received response', response)
  return response?.ok ? 'inserted' : 'failed'
}
