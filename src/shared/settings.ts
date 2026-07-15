const STORAGE_KEY = 'gemini_api_key'

export async function getApiKey(): Promise<string> {
  const { [STORAGE_KEY]: existing = '' } = await chrome.storage.local.get(STORAGE_KEY)
  return existing as string
}

export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: key })
}

export async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}
