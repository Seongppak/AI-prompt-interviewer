import { log } from '../shared/logger'
import { getSiteConfig } from '../shared/sites'
import { getBypassShortcut, getExtensionEnabled, type BypassShortcut } from '../shared/settings'
import { decodePromptHash } from '../shared/promptLink'
import { subscribeStored } from '../shared/storage'
import {
  DOUBLE_SEND_WINDOW_MS,
  isDoubleSend,
  matchesBypassShortcut,
  type SendAttempt,
} from './sendBypass'

interface InsertPromptMessage {
  type: 'INSERT_PROMPT'
  prompt: string
}

const siteConfig = getSiteConfig(location.hostname)

// After we programmatically insert the interviewed prompt, the user's next
// Enter/click should actually send it rather than be caught again.
let insertedPrompt: { input: HTMLElement; question: string } | null = null
// 사이트의 Enter 핸들러가 click을 호출해도 현재 전송 안에서만 우회한다.
let isSendingImmediately = false
let bypassShortcut: BypassShortcut = 'ctrl_enter'
let pendingSend: (SendAttempt & { timer: ReturnType<typeof setTimeout> }) | null = null

// 사이드패널의 전원 버튼으로 언제든 끄고 켤 수 있는 전역 스위치.
let isExtensionEnabled = true
getExtensionEnabled().then((enabled) => {
  isExtensionEnabled = enabled
})
getBypassShortcut().then((shortcut) => {
  bypassShortcut = shortcut
})
subscribeStored('extension_enabled', (value) => {
  isExtensionEnabled = value !== false
  if (!isExtensionEnabled) clearPendingSend()
})
subscribeStored('bypass_shortcut', (value) => {
  if (value === 'ctrl_enter' || value === 'alt_enter') bypassShortcut = value
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
  insertedPrompt = { input, question: getInputText(input) }
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

function clearPendingSend(): void {
  if (!pendingSend) return
  clearTimeout(pendingSend.timer)
  pendingSend = null
}

function scheduleIntercept(input: HTMLElement, question: string): void {
  clearPendingSend()
  const attempt: SendAttempt = { input, question, at: Date.now() }
  const timer = setTimeout(() => {
    if (pendingSend?.timer !== timer) return
    pendingSend = null
    if (!isExtensionEnabled) return

    // 대기하는 동안 사용자가 문구를 고쳤다면 최신 입력을 인터뷰 대상으로 삼는다.
    const latestQuestion = getInputText(input)
    if (latestQuestion) captureOriginalQuestion(latestQuestion)
  }, DOUBLE_SEND_WINDOW_MS)
  pendingSend = { ...attempt, timer }
}

function stopSendEvent(event: Event): void {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

function stopEarlyButtonEvent(event: Event, input: HTMLElement): void {
  if (!isExtensionEnabled || isSendingImmediately || !getInputText(input)) return
  if (insertedPrompt?.input === input && insertedPrompt.question === getInputText(input)) return

  // 일부 사이트는 click보다 이른 pointer/mouse 이벤트에서 전송을 시작한다.
  // 기본 동작까지 취소하면 뒤따르는 click이 생성되지 않을 수 있으므로 전파만 막고,
  // 실제 단일/이중 전송 판정과 preventDefault는 click 핸들러에서 처리한다.
  event.stopPropagation()
  event.stopImmediatePropagation()
}

function sendImmediately(event: Event): boolean {
  clearPendingSend()
  const sendButton = document.querySelector<HTMLElement>(siteConfig!.sendButtonSelector)
  const canClick = sendButton && !sendButton.matches(':disabled, [aria-disabled="true"]')

  // 버튼을 찾았다면 일반 클릭으로 바꿔 각 사이트의 단축키 해석 차이와 무관하게 전송한다.
  // 버튼이 없다면 원래 키 이벤트를 그대로 통과시켜 사이트 자체 처리를 시도한다.
  if (canClick) {
    stopSendEvent(event)
    isSendingImmediately = true
    try {
      sendButton.click()
    } finally {
      isSendingImmediately = false
    }
  }
  return !!canClick
}

function sendImmediatelyWithShortcut(event: KeyboardEvent): void {
  insertedPrompt = null
  const clickedSendButton = sendImmediately(event)
  log('content', 'info', 'keyboard shortcut bypassed interview', {
    bypassShortcut,
    clickedSendButton,
  })
}

function handleSendTrigger(event: Event, input: HTMLElement): void {
  if (!isExtensionEnabled || isSendingImmediately) return

  const question = getInputText(input)
  const shouldSendInsertedPrompt = insertedPrompt?.input === input && insertedPrompt.question === question
  insertedPrompt = null
  if (shouldSendInsertedPrompt) {
    clearPendingSend()
    if (event.type === 'keydown') sendImmediately(event)
    return
  }

  if (!question) return

  const attempt: SendAttempt = { input, question, at: Date.now() }
  if (isDoubleSend(pendingSend, attempt)) {
    clearPendingSend()
    if (event.type === 'keydown') sendImmediately(event)
    log('content', 'info', 'double send bypassed interview')
    return
  }

  stopSendEvent(event)
  scheduleIntercept(input, question)
}

if (siteConfig) {
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter' || event.shiftKey) return
      if (!isExtensionEnabled || isSendingImmediately || event.isComposing) return
      const input = findChatInput()
      if (!input || !input.contains(event.target as Node)) return
      // 키를 누르고 있을 때 발생하는 repeat는 의도적인 두 번 입력으로 보지 않는다.
      if (event.repeat) {
        stopSendEvent(event)
        return
      }
      if (matchesBypassShortcut(event, bypassShortcut)) {
        sendImmediatelyWithShortcut(event)
        return
      }
      handleSendTrigger(event, input)
    },
    true,
  )

  window.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target as Element | null
      if (!target?.closest(siteConfig.sendButtonSelector)) return
      const input = findChatInput()
      if (!input) return
      stopEarlyButtonEvent(event, input)
    },
    true,
  )

  window.addEventListener(
    'mousedown',
    (event) => {
      const target = event.target as Element | null
      if (!target?.closest(siteConfig.sendButtonSelector)) return
      const input = findChatInput()
      if (!input) return
      stopEarlyButtonEvent(event, input)
    },
    true,
  )

  window.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null
      if (!target?.closest(siteConfig.sendButtonSelector)) return
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
