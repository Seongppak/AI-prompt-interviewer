import { log } from '../shared/logger'

interface InsertPromptMessage {
  type: 'INSERT_PROMPT'
  prompt: string
}

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
  log('content', 'info', 'prompt inserted')
  return true
}

log('content', 'info', 'content script loaded', { hostname: location.hostname })

chrome.runtime.onMessage.addListener((message: InsertPromptMessage, _sender, sendResponse) => {
  if (message.type === 'INSERT_PROMPT') {
    log('content', 'info', 'received INSERT_PROMPT message')
    sendResponse({ ok: insertPrompt(message.prompt) })
  }
  return true
})
