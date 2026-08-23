export type PreferenceCounts = Record<string, Record<string, number>>

export function recordPreference(
  counts: PreferenceCounts,
  category: string,
  value: string,
): PreferenceCounts {
  const normalizedCategory = category.trim()
  const normalizedValue = value.trim()
  if (!normalizedCategory || !normalizedValue) return counts

  const categoryCounts = { ...counts[normalizedCategory] }
  categoryCounts[normalizedValue] = (categoryCounts[normalizedValue] ?? 0) + 1
  return { ...counts, [normalizedCategory]: categoryCounts }
}

export function getPreferredValues(counts: PreferenceCounts): Record<string, string> {
  const preferred: Record<string, string> = {}

  for (const [category, valueCounts] of Object.entries(counts)) {
    // 동일 횟수면 기존 저장 순서를 유지해 Chrome 확장의 기존 추천 동작을 보존한다.
    const top = Object.entries(valueCounts).sort((left, right) => right[1] - left[1])[0]
    if (top) preferred[category] = top[0]
  }

  return preferred
}
