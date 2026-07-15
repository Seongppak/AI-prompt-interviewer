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

const ENABLED_KEY = 'extension_enabled'

export async function getExtensionEnabled(): Promise<boolean> {
  const { [ENABLED_KEY]: existing } = await chrome.storage.local.get(ENABLED_KEY)
  return existing !== false
}

export async function setExtensionEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [ENABLED_KEY]: enabled })
}

export type Theme = 'system' | 'light' | 'dark'
const THEME_KEY = 'theme'

export async function getTheme(): Promise<Theme> {
  const { [THEME_KEY]: existing = 'system' } = await chrome.storage.local.get(THEME_KEY)
  return existing as Theme
}

export async function setTheme(theme: Theme): Promise<void> {
  await chrome.storage.local.set({ [THEME_KEY]: theme })
}
