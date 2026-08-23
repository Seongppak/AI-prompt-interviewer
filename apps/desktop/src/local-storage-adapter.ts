import type { StorageAdapter } from '../../../packages/core/src'

export class LocalStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | undefined> {
    const value = localStorage.getItem(`aipi:${key}`)
    return value === null ? undefined : JSON.parse(value) as T
  }

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(`aipi:${key}`, JSON.stringify(value))
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(`aipi:${key}`)
  }
}
