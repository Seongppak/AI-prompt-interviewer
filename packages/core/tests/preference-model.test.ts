import { describe, expect, it } from 'vitest'
import { getPreferredValues, recordPreference, type PreferenceCounts } from '../src'

describe('Preference Model', () => {
  it('records counts without mutating the input', () => {
    const original: PreferenceCounts = { language: { ko: 1 } }
    const updated = recordPreference(original, 'language', 'ko')
    expect(updated.language.ko).toBe(2)
    expect(original.language.ko).toBe(1)
  })

  it('returns the most frequent value for each category', () => {
    expect(getPreferredValues({ language: { en: 1, ko: 3 }, os: { windows: 2 } })).toEqual({
      language: 'ko',
      os: 'windows',
    })
  })

  it('preserves the existing storage order when counts are tied', () => {
    expect(getPreferredValues({ language: { ko: 2, en: 2 } })).toEqual({ language: 'ko' })
  })

  it('ignores blank categories and values', () => {
    const original = { language: { ko: 1 } }
    expect(recordPreference(original, '', 'ko')).toBe(original)
    expect(recordPreference(original, 'language', ' ')).toBe(original)
  })
})
