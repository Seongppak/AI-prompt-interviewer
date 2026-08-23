import {
  ChromeStorageAdapter,
  defaultStorageAreaPolicy,
  type BrowserStorageAreaName,
  type BrowserStorageFacade,
} from '../../adapters/browser/src'

export type StorageArea = BrowserStorageAreaName

// 기존 키 정책과 양방향 마이그레이션을 Browser Adapter의 단일 구현으로 연결한다.
export const chromeStorageAdapter = new ChromeStorageAdapter(
  chrome.storage as unknown as BrowserStorageFacade,
)

export function areaFor(key: string): StorageArea {
  return defaultStorageAreaPolicy(key)
}

export async function getStored<T>(key: string, fallback: T): Promise<T> {
  const value = await chromeStorageAdapter.get<T>(key)
  return value === undefined ? fallback : value
}

export async function setStored(key: string, value: unknown): Promise<void> {
  await chromeStorageAdapter.set(key, value)
}

export async function removeStored(key: string): Promise<void> {
  await chromeStorageAdapter.remove(key)
}

export function subscribeStored(
  key: string,
  onChange: (newValue: unknown) => void,
): () => void {
  return chromeStorageAdapter.subscribe(key, onChange)
}
