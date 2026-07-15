const STORAGE_KEY = 'preferences'

// category -> (value -> 선택된 횟수)
type PreferenceCounts = Record<string, Record<string, number>>

async function getAllCounts(): Promise<PreferenceCounts> {
  const { [STORAGE_KEY]: existing = {} } = await chrome.storage.local.get(STORAGE_KEY)
  return existing as PreferenceCounts
}

export async function recordPreference(category: string, value: string): Promise<void> {
  if (!category || !value) return

  const counts = await getAllCounts()
  const categoryCounts = { ...counts[category] }
  categoryCounts[value] = (categoryCounts[value] ?? 0) + 1
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...counts, [category]: categoryCounts } })
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
