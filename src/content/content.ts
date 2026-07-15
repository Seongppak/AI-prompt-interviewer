import { log } from '../shared/logger'
import { getSiteConfig } from '../shared/sites'

interface InsertPromptMessage {
  type: 'INSERT_PROMPT'
  prompt: string
}

const siteConfig = getSiteConfig(location.hostname)

// After we programmatically insert the interviewed prompt, the user's next
// Enter/click should actually send it rather than be caught again.
let bypassNextSend = false

function findChatInput(): HTMLElement | null {
  if (!siteConfig) return null
  for (const selector of siteConfig.inputSelectors) {
    const input = document.querySelector<HTMLElement>(selector)
    if (input) return input
  }
  return null
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
