import { log } from '../shared/logger'

interface InsertPromptMessage {
  type: 'INSERT_PROMPT'
  prompt: string
}

const SEND_BUTTON_SELECTOR = '[data-testid="send-button"]'

// After we programmatically insert the interviewed prompt, the user's next
// Enter/click should actually send it rather than be caught again.
let bypassNextSend = false

function findChatInput(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('#prompt-textarea') ??
    document.querySelector<HTMLElement>('[contenteditable="true"]')
  )
}

function insertPrompt(text: string): boolean {
  const input = findChatInput()
  if (!input) {
    log('content', 'warn', 'chat input not found')
    return false
  }

  input.focus()

  const selection = window.getSelection()
  if (selection) {
    const range = document.createRange()
    range.selectNodeContents(input)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  document.execCommand('insertText', false, text)
  bypassNextSend = true
  log('content', 'info', 'prompt inserted')
  return true
}

function getInputText(input: HTMLElement): string {
  return input.innerText.trim()
}

function captureOriginalQuestion(question: string): void {
  log('content', 'info', 'intercepted original question', { question })
  chrome.runtime.sendMessage({ type: 'ORIGINAL_QUESTION', question }).catch((err) => {
    log('content', 'error', 'failed to send ORIGINAL_QUESTION', String(err))
  })
}

function handleSendTrigger(event: Event, input: HTMLElement): void {
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
    if (!target.closest(SEND_BUTTON_SELECTOR)) return
    const input = findChatInput()
    if (!input) return
    handleSendTrigger(event, input)
  },
  true,
)

log('content', 'info', 'content script loaded', { hostname: location.hostname })

chrome.runtime.onMessage.addListener((message: InsertPromptMessage, _sender, sendResponse) => {
  if (message.type === 'INSERT_PROMPT') {
    log('content', 'info', 'received INSERT_PROMPT message')
    sendResponse({ ok: insertPrompt(message.prompt) })
  }
  return true
})
