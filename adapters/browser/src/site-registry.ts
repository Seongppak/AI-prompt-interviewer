export interface BrowserSiteDefinition {
  targetId: string
  hostname: string
  urlPattern: string
  displayName: string
  inputSelectors: string[]
  sendButtonSelector: string
}

export const BROWSER_SITE_DEFINITIONS: readonly BrowserSiteDefinition[] = [
  {
    targetId: 'chatgpt',
    hostname: 'chatgpt.com',
    urlPattern: 'https://chatgpt.com/*',
    displayName: 'ChatGPT',
    inputSelectors: ['#prompt-textarea', '[contenteditable="true"]'],
    sendButtonSelector: '[data-testid="send-button"]',
  },
  {
    targetId: 'chatgpt',
    hostname: 'chat.openai.com',
    urlPattern: 'https://chat.openai.com/*',
    displayName: 'ChatGPT',
    inputSelectors: ['#prompt-textarea', '[contenteditable="true"]'],
    sendButtonSelector: '[data-testid="send-button"]',
  },
  {
    targetId: 'gemini',
    hostname: 'gemini.google.com',
    urlPattern: 'https://gemini.google.com/*',
    displayName: 'Gemini',
    inputSelectors: ['[data-test-id="textarea-wrapper"] [contenteditable="true"]', '[contenteditable="true"]'],
    sendButtonSelector: '[data-test-id="send-button-container"] button',
  },
  {
    targetId: 'grok',
    hostname: 'grok.com',
    urlPattern: 'https://grok.com/*',
    displayName: 'Grok',
    inputSelectors: ['[data-testid="chat-input"] [contenteditable="true"]', 'textarea[placeholder]', '[contenteditable="true"]', 'textarea'],
    sendButtonSelector: '[data-testid="chat-submit"]',
  },
  {
    targetId: 'claude',
    hostname: 'claude.ai',
    urlPattern: 'https://claude.ai/*',
    displayName: 'Claude',
    inputSelectors: ['[data-testid="chat-input"]'],
    sendButtonSelector: 'fieldset:has([data-testid="chat-input"]) div.duration-snap:last-child button',
  },
  {
    targetId: 'perplexity',
    hostname: 'www.perplexity.ai',
    urlPattern: 'https://www.perplexity.ai/*',
    displayName: 'Perplexity',
    inputSelectors: ['#ask-input'],
    sendButtonSelector: 'div:has(> * > * > #ask-input) > div:last-child > button:last-child',
  },
  {
    targetId: 'copilot',
    hostname: 'copilot.microsoft.com',
    urlPattern: 'https://copilot.microsoft.com/*',
    displayName: 'Copilot',
    inputSelectors: ['#userInput'],
    sendButtonSelector: '[data-testid="submit-button"]',
  },
]

export function findBrowserSite(hostname: string): BrowserSiteDefinition | undefined {
  const normalized = hostname.trim().toLowerCase()
  return BROWSER_SITE_DEFINITIONS.find((site) => site.hostname === normalized)
}

export function findBrowserSitesByTarget(targetId: string): BrowserSiteDefinition[] {
  const normalized = targetId.trim().toLowerCase()
  return BROWSER_SITE_DEFINITIONS.filter((site) => site.targetId === normalized)
}
