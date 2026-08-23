import { describe, expect, it, vi } from 'vitest'
import { PreferenceService } from '../../../packages/core/src'
import { InMemoryStorageAdapter } from '../src/inMemoryStorageAdapter'

describe('Test App preference flow', () => {
  it('learns preferred answers through the StorageAdapter port', async () => {
    const storage = new InMemoryStorageAdapter()
    const preferences = new PreferenceService(storage)
    await preferences.record('language', '한국어')
    await preferences.record('language', '영어')
    await preferences.record('language', '한국어')
    expect(await preferences.getPreferredValues()).toEqual({ language: '한국어' })
  })

  it('notifies and unsubscribes storage listeners', async () => {
    const storage = new InMemoryStorageAdapter()
    const listener = vi.fn()
    const unsubscribe = storage.subscribe('key', listener)
    await storage.set('key', 'first')
    unsubscribe()
    await storage.set('key', 'second')
    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith('first')
  })
})
