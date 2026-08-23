import type { StorageAdapter } from '../../../packages/core/src'

export type BrowserStorageAreaName = 'local' | 'sync'

export interface BrowserStorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(values: Record<string, unknown>): Promise<void>
  remove(key: string): Promise<void>
}

export interface BrowserStorageChange {
  oldValue?: unknown
  newValue?: unknown
}

export interface BrowserStorageEvents {
  addListener(listener: (changes: Record<string, BrowserStorageChange>, area: string) => void): void
  removeListener(listener: (changes: Record<string, BrowserStorageChange>, area: string) => void): void
}

export interface BrowserStorageFacade {
  local: BrowserStorageArea
  sync: BrowserStorageArea
  onChanged: BrowserStorageEvents
}

export type StorageAreaPolicy = (key: string) => BrowserStorageAreaName

export const DEFAULT_SYNCED_KEYS = new Set(['theme', 'preferences'])

export const defaultStorageAreaPolicy: StorageAreaPolicy = (key) =>
  DEFAULT_SYNCED_KEYS.has(key) ? 'sync' : 'local'

export class ChromeStorageAdapter implements StorageAdapter {
  private readonly migrated = new Set<string>()
  private readonly storage: BrowserStorageFacade
  private readonly areaFor: StorageAreaPolicy

  constructor(
    storage: BrowserStorageFacade,
    areaFor: StorageAreaPolicy = defaultStorageAreaPolicy,
  ) {
    this.storage = storage
    this.areaFor = areaFor
  }

  private async migrateIfNeeded(key: string): Promise<void> {
    if (this.migrated.has(key)) return
    this.migrated.add(key)
    const target = this.areaFor(key)
    const source: BrowserStorageAreaName = target === 'sync' ? 'local' : 'sync'
    const stray = (await this.storage[source].get(key))[key]
    if (stray === undefined) return

    const current = (await this.storage[target].get(key))[key]
    if (current === undefined) await this.storage[target].set({ [key]: stray })
    await this.storage[source].remove(key)
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.migrateIfNeeded(key)
    return (await this.storage[this.areaFor(key)].get(key))[key] as T | undefined
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.storage[this.areaFor(key)].set({ [key]: value })
  }

  async remove(key: string): Promise<void> {
    await this.storage[this.areaFor(key)].remove(key)
  }

  subscribe<T>(key: string, listener: (value: T | undefined) => void): () => void {
    const expectedArea = this.areaFor(key)
    const wrapped = (changes: Record<string, BrowserStorageChange>, area: string) => {
      if (area !== expectedArea || !changes[key]) return
      listener(changes[key].newValue as T | undefined)
    }
    this.storage.onChanged.addListener(wrapped)
    return () => this.storage.onChanged.removeListener(wrapped)
  }
}
