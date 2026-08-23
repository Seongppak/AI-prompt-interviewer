import { describe, expect, it } from 'vitest'
import { SUPPORTED_SITES } from '../../../src/shared/sites'
import {
  BROWSER_SITE_DEFINITIONS,
  findBrowserSite,
  findBrowserSitesByTarget,
} from '../src'

describe('Browser site registry', () => {
  it('matches every site currently supported by the frozen extension', () => {
    expect(BROWSER_SITE_DEFINITIONS.map(({ targetId: _targetId, ...site }) => site))
      .toEqual(SUPPORTED_SITES)
  })

  it('finds sites by normalized hostname and target id', () => {
    expect(findBrowserSite(' CHATGPT.COM ')?.targetId).toBe('chatgpt')
    expect(findBrowserSitesByTarget('chatgpt')).toHaveLength(2)
    expect(findBrowserSite('unsupported.example')).toBeUndefined()
  })
})
