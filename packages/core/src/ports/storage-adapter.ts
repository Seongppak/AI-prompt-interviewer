export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  subscribe?<T>(key: string, listener: (value: T | undefined) => void): () => void
}

export interface SecretStorageAdapter {
  getSecret(key: string): Promise<string | undefined>
  setSecret(key: string, value: string): Promise<void>
  removeSecret(key: string): Promise<void>
}
