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
  if (!input) return false

  input.focus()

  const selection = window.getSelection()
  if (selection) {
    const range = document.createRange()
    range.selectNodeContents(input)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  document.execCommand('insertText', false, text)
  return true
}

chrome.runtime.onMessage.addListener((message: InsertPromptMessage, _sender, sendResponse) => {
  if (message.type === 'INSERT_PROMPT') {
    sendResponse({ ok: insertPrompt(message.prompt) })
  }
  return true
})
