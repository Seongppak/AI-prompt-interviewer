export interface SiteConfig {
  hostname: string
  urlPattern: string
  // 순서대로 시도하는 입력창 셀렉터 목록 (사이트 개편에 대비한 fallback 포함)
  inputSelectors: string[]
  sendButtonSelector: string
}

export const SUPPORTED_SITES: SiteConfig[] = [
  {
    hostname: 'chatgpt.com',
    urlPattern: 'https://chatgpt.com/*',
    inputSelectors: ['#prompt-textarea', '[contenteditable="true"]'],
    sendButtonSelector: '[data-testid="send-button"]',
  },
  {
    hostname: 'chat.openai.com',
    urlPattern: 'https://chat.openai.com/*',
    inputSelectors: ['#prompt-textarea', '[contenteditable="true"]'],
    sendButtonSelector: '[data-testid="send-button"]',
  },
  {
    hostname: 'gemini.google.com',
    urlPattern: 'https://gemini.google.com/*',
    // aria-label은 사용자 언어 설정에 따라 바뀌므로 data-test-id로 잡는다.
    inputSelectors: [
      '[data-test-id="textarea-wrapper"] [contenteditable="true"]',
      '[contenteditable="true"]',
    ],
    sendButtonSelector: '[data-test-id="send-button-container"] button',
  },
]

export function getSiteConfig(hostname: string): SiteConfig | undefined {
  return SUPPORTED_SITES.find((site) => site.hostname === hostname)
}
