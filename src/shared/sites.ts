export interface SiteConfig {
  hostname: string
  urlPattern: string
  // 버튼/상태 메시지 등 UI에 노출되는 사람이 읽는 이름 (예: "ChatGPT", "Grok").
  displayName: string
  // 순서대로 시도하는 입력창 셀렉터 목록 (사이트 개편에 대비한 fallback 포함)
  inputSelectors: string[]
  sendButtonSelector: string
}

export const SUPPORTED_SITES: SiteConfig[] = [
  {
    hostname: 'chatgpt.com',
    urlPattern: 'https://chatgpt.com/*',
    displayName: 'ChatGPT',
    inputSelectors: ['#prompt-textarea', '[contenteditable="true"]'],
    sendButtonSelector: '[data-testid="send-button"]',
  },
  {
    hostname: 'chat.openai.com',
    urlPattern: 'https://chat.openai.com/*',
    displayName: 'ChatGPT',
    inputSelectors: ['#prompt-textarea', '[contenteditable="true"]'],
    sendButtonSelector: '[data-testid="send-button"]',
  },
  {
    hostname: 'gemini.google.com',
    urlPattern: 'https://gemini.google.com/*',
    displayName: 'Gemini',
    // aria-label은 사용자 언어 설정에 따라 바뀌므로 data-test-id로 잡는다.
    inputSelectors: [
      '[data-test-id="textarea-wrapper"] [contenteditable="true"]',
      '[contenteditable="true"]',
    ],
    sendButtonSelector: '[data-test-id="send-button-container"] button',
  },
  {
    hostname: 'grok.com',
    urlPattern: 'https://grok.com/*',
    displayName: 'Grok',
    // 로그인 상태에서는 contenteditable(data-testid="chat-input"), 로그아웃 상태에서는
    // <textarea>를 쓴다. 로그아웃 화면엔 placeholder 없는 숨은 textarea가 하나 더 있어 구분 필요.
    inputSelectors: [
      '[data-testid="chat-input"] [contenteditable="true"]',
      'textarea[placeholder]',
      '[contenteditable="true"]',
      'textarea',
    ],
    sendButtonSelector: '[data-testid="chat-submit"]',
  },
  {
    hostname: 'claude.ai',
    urlPattern: 'https://claude.ai/*',
    displayName: 'Claude',
    inputSelectors: ['[data-testid="chat-input"]'],
    // aria-label이 상태(마이크/전송)와 언어에 따라 바뀌고 data-testid도 없어서,
    // 입력창을 담은 fieldset 안에서 툴바의 마지막 버튼(항상 마이크/전송 슬롯)을 잡는다.
    sendButtonSelector: 'fieldset:has([data-testid="chat-input"]) div.duration-snap:last-child button',
  },
]

export function getSiteConfig(hostname: string): SiteConfig | undefined {
  return SUPPORTED_SITES.find((site) => site.hostname === hostname)
}

// displayName은 대소문자/여백 차이가 있을 수 있어 느슨하게 비교한다.
export function findSiteByDisplayName(name: string): SiteConfig | undefined {
  const normalized = name.trim().toLowerCase()
  return SUPPORTED_SITES.find((site) => site.displayName.toLowerCase() === normalized)
}

export function getBaseUrl(site: SiteConfig): string {
  return site.urlPattern.replace(/\/\*$/, '')
}
