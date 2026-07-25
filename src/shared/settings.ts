import { getStored, removeStored, setStored } from './storage'

// 저장 위치(local/sync)는 storage.ts가 키별로 정한다.
const API_KEY = 'gemini_api_key'

export async function getApiKey(): Promise<string> {
  return getStored(API_KEY, '')
}

export async function setApiKey(key: string): Promise<void> {
  await setStored(API_KEY, key)
}

export async function clearApiKey(): Promise<void> {
  await removeStored(API_KEY)
}

const ENABLED_KEY = 'extension_enabled'

export async function getExtensionEnabled(): Promise<boolean> {
  return (await getStored(ENABLED_KEY, true)) !== false
}

export async function setExtensionEnabled(enabled: boolean): Promise<void> {
  await setStored(ENABLED_KEY, enabled)
}

export type Theme = 'system' | 'light' | 'dark'
const THEME_KEY = 'theme'

export async function getTheme(): Promise<Theme> {
  return getStored<Theme>(THEME_KEY, 'system')
}

export async function setTheme(theme: Theme): Promise<void> {
  await setStored(THEME_KEY, theme)
}
