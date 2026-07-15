const CHATGPT_URL_PATTERNS = ['https://chatgpt.com/*', 'https://chat.openai.com/*']

export type InsertResult = 'inserted' | 'no_tab' | 'failed'

export async function insertIntoChatGpt(prompt: string): Promise<InsertResult> {
  const tabs = await chrome.tabs.query({ url: CHATGPT_URL_PATTERNS })
  const tab = tabs.find((t) => t.active) ?? tabs[0]
  if (!tab?.id) return 'no_tab'

  const response = await chrome.tabs.sendMessage(tab.id, {
    type: 'INSERT_PROMPT',
    prompt,
  })
  return response?.ok ? 'inserted' : 'failed'
}
