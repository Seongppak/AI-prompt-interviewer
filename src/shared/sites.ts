import {
  BROWSER_SITE_DEFINITIONS,
  findBrowserSite,
  type BrowserSiteDefinition,
} from '../../adapters/browser/src/site-registry.js'

// 운영 확장의 기존 import 경로와 공개 객체 모양을 보존하는 Browser Adapter registry facade.
export type SiteConfig = Omit<BrowserSiteDefinition, 'targetId'>
export const SUPPORTED_SITES: readonly SiteConfig[] = BROWSER_SITE_DEFINITIONS.map(
  ({ targetId: _targetId, ...site }) => site,
)

export function getSiteConfig(hostname: string): SiteConfig | undefined {
  const site = findBrowserSite(hostname)
  if (!site) return undefined
  const { targetId: _targetId, ...legacySite } = site
  return legacySite
}

export function findSiteByDisplayName(name: string): SiteConfig | undefined {
  const normalized = name.trim().toLowerCase()
  return SUPPORTED_SITES.find((site) => site.displayName.toLowerCase() === normalized)
}

export function getBaseUrl(site: SiteConfig): string {
  return site.urlPattern.replace(/\/\*$/, '')
}
