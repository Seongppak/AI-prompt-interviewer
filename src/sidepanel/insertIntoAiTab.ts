import { log } from '../shared/logger'
import { SUPPORTED_SITES } from '../shared/sites'

const AI_URL_PATTERNS = SUPPORTED_SITES.map((site) => site.urlPattern)

export type InsertResult = 'inserted' | 'no_tab' | 'failed'

export async function insertIntoAiTab(prompt: string): Promise<InsertResult> {
  const tabs = await chrome.tabs.query({ url: AI_URL_PATTERNS })
  log('sidepanel', 'info', 'found AI tabs', { count: tabs.length })

  const tab = tabs.find((t) => t.active) ?? tabs[0]
  if (!tab?.id) {
    log('sidepanel', 'warn', 'no AI tab available')
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
