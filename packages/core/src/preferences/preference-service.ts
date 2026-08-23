import type { StorageAdapter } from '../ports/storage-adapter'
import { getPreferredValues, recordPreference, type PreferenceCounts } from './preference-model'

export class PreferenceService {
  private readonly storage: StorageAdapter
  private readonly storageKey: string

  constructor(
    storage: StorageAdapter,
    storageKey = 'preferences',
  ) {
    this.storage = storage
    this.storageKey = storageKey
  }

  async record(category: string, value: string): Promise<void> {
    const counts = await this.storage.get<PreferenceCounts>(this.storageKey) ?? {}
    await this.storage.set(this.storageKey, recordPreference(counts, category, value))
  }

  async getPreferredValues(): Promise<Record<string, string>> {
    const counts = await this.storage.get<PreferenceCounts>(this.storageKey) ?? {}
    return getPreferredValues(counts)
  }
}
