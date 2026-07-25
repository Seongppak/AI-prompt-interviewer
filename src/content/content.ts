import { log } from '../shared/logger'
import { getSiteConfig } from '../shared/sites'
import { getExtensionEnabled } from '../shared/settings'
import { decodePromptHash } from '../shared/promptLink'

interface InsertPromptMessage {
  type: 'INSERT_PROMPT'
  prompt: string
}

const siteConfig = getSiteConfig(location.hostname)

// After we programmatically insert the interviewed prompt, the user's next
// Enter/click should actually send it rather than be caught again.
let bypassNextSend = false

// 사이드패널의 전원 버튼으로 언제든 끄고 켤 수 있는 전역 스위치.
let isExtensionEnabled = true
getExtensionEnabled().then((enabled) => {
  isExtensionEnabled = enabled
})
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['extension_enabled']) {
    isExtensionEnabled = changes['extension_enabled'].newValue !== false
  }
})

function findChatInput(): HTMLElement | null {
  if (!siteConfig) return null
  for (const selector of siteConfig.inputSelectors) {
    const input = document.querySelector<HTMLElement>(selector)
    if (input) return input
  }
  return null
}

function isTextInputElement(el: HTMLElement): el is HTMLTextAreaElement | HTMLInputElement {
  return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT'
}

function insertPrompt(text: string): boolean {
  const input = findChatInput()
  if (!input) {
    log('content', 'warn', 'chat input not found')
    return false
  }

  input.focus()

  // <textarea>/<input>은 자체 selection 모델을 쓰므로 window.getSelection()이 통하지 않는다.
  if (isTextInputElement(input)) {
    input.select()
  } else {
    const selection = window.getSelection()
    if (selection) {
      const range = document.createRange()
      range.selectNodeContents(input)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  document.execCommand('insertText', false, text)
  bypassNextSend = true
  log('content', 'info', 'prompt inserted')
  return true
}

function getInputText(input: HTMLElement): string {
  if (isTextInputElement(input)) return input.value.trim()
  return input.innerText.trim()
}

const HASH_INSERT_RETRY_DELAY_MS = 500
const HASH_INSERT_MAX_ATTEMPTS = 20

// 외부에서 #aipi=로 넘긴 프롬프트를 입력창에 넣는다.
//
// isExtensionEnabled를 보지 않는 건 의도적이다 — 그 스위치는 "내가 누른 Enter를 낚아채지 마라"는
// 뜻이고, 해시 삽입은 사용자가 명시적으로 요청한 동작이라 가로채기가 아니다.
async function consumeHashPrompt(): Promise<void> {
  const prompt = decodePromptHash(location.hash)
  if (prompt === null) return

  // 새로고침이나 뒤로가기로 같은 프롬프트가 다시 삽입되지 않도록 해시를 먼저 지운다.
  history.replaceState(null, '', location.pathname + location.search)

  // 입력창은 React 등으로 나중에 그려지므로 나타날 때까지 기다린다.
  for (let attempt = 1; attempt <= HASH_INSERT_MAX_ATTEMPTS; attempt++) {
    if (findChatInput()) {
      if (insertPrompt(prompt)) {
        log('content', 'info', 'inserted prompt from hash', { attempt })
      }
      return
    }
    await new Promise((resolve) => setTimeout(resolve, HASH_INSERT_RETRY_DELAY_MS))
  }

  log('content', 'error', 'chat input never appeared for hash prompt', {
    waitedMs: HASH_INSERT_MAX_ATTEMPTS * HASH_INSERT_RETRY_DELAY_MS,
  })
}

function captureOriginalQuestion(question: string): void {
  log('content', 'info', 'intercepted original question', { question })
  chrome.runtime
    .sendMessage({ type: 'ORIGINAL_QUESTION', question, hostname: location.hostname })
    .catch((err) => {
      log('content', 'error', 'failed to send ORIGINAL_QUESTION', String(err))
    })
}

function handleSendTrigger(event: Event, input: HTMLElement): void {
  if (!isExtensionEnabled) return

  if (bypassNextSend) {
    bypassNextSend = false
    return
  }

  const question = getInputText(input)
  if (!question) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  captureOriginalQuestion(question)
}

if (siteConfig) {
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter' || event.shiftKey) return
      const input = findChatInput()
      if (!input || !input.contains(event.target as Node)) return
      handleSendTrigger(event, input)
    },
    true,
  )

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement
      if (!target.closest(siteConfig.sendButtonSelector)) return
      const input = findChatInput()
      if (!input) return
      handleSendTrigger(event, input)
    },
    true,
  )

  void consumeHashPrompt()

  // 이미 열려 있는 탭의 해시만 바뀌면 페이지가 다시 로드되지 않으므로 별도로 받아준다.
  window.addEventListener('hashchange', () => {
    void consumeHashPrompt()
  })

  log('content', 'info', 'content script loaded', { hostname: location.hostname })
} else {
  log('content', 'warn', 'no site config for this hostname, content script inactive', {
    hostname: location.hostname,
  })
}

chrome.runtime.onMessage.addListener((message: InsertPromptMessage, _sender, sendResponse) => {
  if (message.type === 'INSERT_PROMPT') {
    log('content', 'info', 'received INSERT_PROMPT message')
    sendResponse({ ok: insertPrompt(message.prompt) })
  }
  return true
})
