import { getStored, setStored } from './storage'

// 기기 간 공유 대상이다 — 저장 위치는 storage.ts가 정한다.
const STORAGE_KEY = 'preferences'

// category -> (value -> 선택된 횟수)
type PreferenceCounts = Record<string, Record<string, number>>

async function getAllCounts(): Promise<PreferenceCounts> {
  return getStored<PreferenceCounts>(STORAGE_KEY, {})
}

export async function recordPreference(category: string, value: string): Promise<void> {
  if (!category || !value) return

  const counts = await getAllCounts()
  const categoryCounts = { ...counts[category] }
  categoryCounts[value] = (categoryCounts[value] ?? 0) + 1
  await setStored(STORAGE_KEY, { ...counts, [category]: categoryCounts })
}

// category -> 가장 많이 선택된 value
export async function getPreferredValues(): Promise<Record<string, string>> {
  const counts = await getAllCounts()
  const preferred: Record<string, string> = {}

  for (const [category, valueCounts] of Object.entries(counts)) {
    const top = Object.entries(valueCounts).sort((a, b) => b[1] - a[1])[0]
    if (top) preferred[category] = top[0]
  }

  return preferred
}
