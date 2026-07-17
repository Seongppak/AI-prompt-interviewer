import { log } from '../shared/logger'
import { SUPPORTED_SITES, getSiteConfig } from '../shared/sites'

const AI_URL_PATTERNS = SUPPORTED_SITES.map((site) => site.urlPattern)

export type InsertResult = 'inserted' | 'no_tab' | 'failed'

async function sendInsertPrompt(tabId: number, prompt: string): Promise<InsertResult> {
  log('sidepanel', 'info', 'sending INSERT_PROMPT message', { tabId })
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'INSERT_PROMPT', prompt })
    log('sidepanel', 'info', 'received response', response)
    return response?.ok ? 'inserted' : 'failed'
  } catch (err) {
    log('sidepanel', 'error', 'failed to send INSERT_PROMPT', String(err))
    return 'failed'
  }
}

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

  return sendInsertPrompt(tab.id, prompt)
}

const OPEN_TAB_TIMEOUT_MS = 15_000

// 새 탭을 열고, 로딩이 끝나 content script가 준비되면 프롬프트를 자동 삽입한다.
export async function openAndInsertPrompt(url: string, prompt: string): Promise<InsertResult> {
  const tab = await chrome.tabs.create({ url })
  if (!tab.id) return 'failed'
  const tabId = tab.id

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      resolve('failed')
    }, OPEN_TAB_TIMEOUT_MS)

    function listener(updatedTabId: number, info: chrome.tabs.OnUpdatedInfo) {
      if (updatedTabId !== tabId || info.status !== 'complete') return
      chrome.tabs.onUpdated.removeListener(listener)
      clearTimeout(timeout)
      sendInsertPrompt(tabId, prompt).then(resolve)
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}
