import { PreferenceService } from '../../packages/core/src'
import { chromeStorageAdapter } from './storage'

const service = new PreferenceService(chromeStorageAdapter)

export async function recordPreference(category: string, value: string): Promise<void> {
  if (!category || !value) return
  await service.record(category, value)
}

export function getPreferredValues(): Promise<Record<string, string>> {
  return service.getPreferredValues()
}
