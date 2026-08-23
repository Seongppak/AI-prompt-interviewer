import { describe, expect, it, vi } from 'vitest'
import {
  ChromeStorageAdapter,
  type BrowserStorageArea,
  type BrowserStorageChange,
  type BrowserStorageEvents,
  type BrowserStorageFacade,
} from '../src'

class FakeArea implements BrowserStorageArea {
  readonly values = new Map<string, unknown>()

  async get(key: string): Promise<Record<string, unknown>> {
    return this.values.has(key) ? { [key]: this.values.get(key) } : {}
  }

  async set(values: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(values)) this.values.set(key, value)
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key)
  }
}

class FakeEvents implements BrowserStorageEvents {
  readonly listeners = new Set<(
    changes: Record<string, BrowserStorageChange>,
    area: string,
  ) => void>()

  addListener(listener: (changes: Record<string, BrowserStorageChange>, area: string) => void): void {
    this.listeners.add(listener)
  }

  removeListener(listener: (changes: Record<string, BrowserStorageChange>, area: string) => void): void {
    this.listeners.delete(listener)
  }

  emit(changes: Record<string, BrowserStorageChange>, area: string): void {
    for (const listener of this.listeners) listener(changes, area)
  }
}

function createStorage(): BrowserStorageFacade & { onChanged: FakeEvents } {
  return { local: new FakeArea(), sync: new FakeArea(), onChanged: new FakeEvents() }
}

describe('ChromeStorageAdapter', () => {
  it('stores preferences in sync and credentials in local', async () => {
    const storage = createStorage()
    const adapter = new ChromeStorageAdapter(storage)
    await adapter.set('preferences', { language: 'ko' })
    await adapter.set('gemini_api_key', 'secret')
    expect(await storage.sync.get('preferences')).toEqual({ preferences: { language: 'ko' } })
    expect(await storage.local.get('gemini_api_key')).toEqual({ gemini_api_key: 'secret' })
  })

  it('migrates a stray value to its declared area without overwriting current data', async () => {
    const storage = createStorage()
    await storage.local.set({ theme: 'dark' })
    const adapter = new ChromeStorageAdapter(storage)
    expect(await adapter.get('theme')).toBe('dark')
    expect(await storage.sync.get('theme')).toEqual({ theme: 'dark' })
    expect(await storage.local.get('theme')).toEqual({})

    const secondStorage = createStorage()
    await secondStorage.local.set({ preferences: { language: 'en' } })
    await secondStorage.sync.set({ preferences: { language: 'ko' } })
    const secondAdapter = new ChromeStorageAdapter(secondStorage)
    expect(await secondAdapter.get('preferences')).toEqual({ language: 'ko' })
    expect(await secondStorage.local.get('preferences')).toEqual({})
  })

  it('subscribes only to the key and storage area selected by policy', () => {
    const storage = createStorage()
    const adapter = new ChromeStorageAdapter(storage)
    const listener = vi.fn()
    const unsubscribe = adapter.subscribe('theme', listener)
    storage.onChanged.emit({ theme: { newValue: 'dark' } }, 'local')
    storage.onChanged.emit({ other: { newValue: true } }, 'sync')
    storage.onChanged.emit({ theme: { newValue: 'light' } }, 'sync')
    unsubscribe()
    storage.onChanged.emit({ theme: { newValue: 'dark' } }, 'sync')
    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith('light')
  })
})
