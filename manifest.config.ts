import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

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
      matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
      js: ['src/content/content.ts'],
    },
  ],
  permissions: ['sidePanel', 'activeTab', 'scripting', 'storage'],
  host_permissions: [
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
    'https://generativelanguage.googleapis.com/*',
  ],
})
