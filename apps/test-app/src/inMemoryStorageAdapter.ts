import type { StorageAdapter } from '../../../packages/core/src'

type Listener = (value: unknown) => void

export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly values = new Map<string, unknown>()
  private readonly listeners = new Map<string, Set<Listener>>()

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value)
    for (const listener of this.listeners.get(key) ?? []) listener(value)
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key)
    for (const listener of this.listeners.get(key) ?? []) listener(undefined)
  }

  subscribe<T>(key: string, listener: (value: T | undefined) => void): () => void {
    const listeners = this.listeners.get(key) ?? new Set<Listener>()
    const wrapped: Listener = (value) => listener(value as T | undefined)
    listeners.add(wrapped)
    this.listeners.set(key, listeners)
    return () => listeners.delete(wrapped)
  }
}
