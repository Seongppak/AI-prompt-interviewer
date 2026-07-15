const STORAGE_KEY = 'pending_question'

export async function getPendingQuestion(): Promise<string> {
  const { [STORAGE_KEY]: existing = '' } = await chrome.storage.local.get(STORAGE_KEY)
  return existing as string
}

export async function setPendingQuestion(question: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: question })
}

export async function clearPendingQuestion(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}
