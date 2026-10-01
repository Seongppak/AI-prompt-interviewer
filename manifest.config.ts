import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }
import { SUPPORTED_SITES } from './src/shared/sites.ts'

const siteUrlPatterns = SUPPORTED_SITES.map((site) => site.urlPattern)

export default defineManifest({
  manifest_version: 3,
  name: 'AI Prompt Interviewer',
  version: pkg.version,
  description: 'AI 사이트에 질문하기 전에 버튼 기반 인터뷰로 프롬프트를 보강해주는 확장 프로그램',
  action: {
    default_title: 'AI Prompt Interviewer 열기',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: siteUrlPatterns,
      js: ['src/content/content.ts'],
      // Register capture-phase handlers before each site's app installs its own
      // delegated pointer/click handlers. Otherwise a page-level handler can
      // submit the prompt before the extension sees the click.
      run_at: 'document_start',
    },
  ],
  // downloads: 완성된 프롬프트를 파일로 떨어뜨려 Claude Code의 /inbox가 읽게 한다.
  permissions: ['sidePanel', 'activeTab', 'scripting', 'storage', 'downloads'],
  host_permissions: [...siteUrlPatterns, 'https://generativelanguage.googleapis.com/*'],
})
