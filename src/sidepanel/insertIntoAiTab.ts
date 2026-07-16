import { log } from '../shared/logger'
import { SUPPORTED_SITES, getSiteConfig } from '../shared/sites'

const AI_URL_PATTERNS = SUPPORTED_SITES.map((site) => site.urlPattern)

export type InsertResult = 'inserted' | 'no_tab' | 'failed'

// sourceHostname과 같은 사이트의 탭을 우선으로 찾고, 없으면 열려 있는 다른 AI 탭으로 폴백한다.
export async function insertIntoAiTab(prompt: string, sourceHostname: string): Promise<InsertResult> {
  const sourceSite = getSiteConfig(sourceHostname)
  const sourceTabs = sourceSite ? await chrome.tabs.query({ url: sourceSite.urlPattern }) : []

  let tab = sourceTabs.find((t) => t.active) ?? sourceTabs[0]
  if (!tab?.id) {
    const anyTabs = await chrome.tabs.query({ url: AI_URL_PATTERNS })
    log('sidepanel', 'info', 'found AI tabs', { count: anyTabs.length, sourceHostname })
    tab = anyTabs.find((t) => t.active) ?? anyTabs[0]
  }

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
