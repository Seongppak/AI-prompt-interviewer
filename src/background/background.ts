import { log } from '../shared/logger'
import { getApiKey } from '../shared/settings'
import { createProject, updateProject } from '../shared/project'
import { getSiteConfig } from '../shared/sites'
import { generateInterviewQuestions } from './generateQuestions'

const SIDE_PANEL_PATH = 'src/sidepanel/index.html'

// AI 사이트 탭에서만 사이드패널을 켜서, 다른 탭으로 옮겨도 패널이 계속 따라오지 않게 한다.
async function updateSidePanelForTab(tabId: number, url?: string): Promise<void> {
  let hostname = ''
  try {
    hostname = url ? new URL(url).hostname : ''
  } catch {
    hostname = ''
  }

  try {
    if (getSiteConfig(hostname)) {
      await chrome.sidePanel.setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: true })
    } else {
      await chrome.sidePanel.setOptions({ tabId, enabled: false })
    }
  } catch (err) {
    log('background', 'error', 'sidePanel.setOptions failed', String(err))
  }
}

// 확장이 새로 로드/리로드될 때 이미 열려 있던 탭들에도 반영한다.
chrome.tabs.query({}).then((tabs) => {
  for (const tab of tabs) {
    if (tab.id !== undefined) updateSidePanelForTab(tab.id, tab.url)
  }
})

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id !== undefined) updateSidePanelForTab(tab.id, tab.url)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateSidePanelForTab(tabId, changeInfo.url)
  } else if (changeInfo.status === 'complete') {
    updateSidePanelForTab(tabId, tab.url)
  }
})

interface OriginalQuestionMessage {
  type: 'ORIGINAL_QUESTION'
  question: string
  hostname: string
}

async function handleOriginalQuestion(question: string, hostname: string): Promise<void> {
  const project = await createProject(question, hostname)

  const apiKey = await getApiKey()
  if (!apiKey) {
    log('background', 'warn', 'no Gemini API key set')
    await updateProject(project.id, {
      status: 'error',
      error: '설정에서 Gemini API 키를 먼저 입력해주세요',
    })
    return
  }

  try {
    const result = await generateInterviewQuestions(question, apiKey)
    log('background', 'info', 'generated interview questions', {
      count: result.questions.length,
      recommendedSite: result.recommendedSite,
    })
    await updateProject(project.id, {
      status: 'interviewing',
      questions: result.questions,
      recommendedSite: result.recommendedSite,
      recommendedSiteReason: result.recommendedSiteReason,
    })
  } catch (err) {
    log('background', 'error', 'failed to generate interview questions', String(err))
    await updateProject(project.id, { status: 'error', error: String(err) })
  }
}

chrome.runtime.onInstalled.addListener(() => {
  log('background', 'info', 'installed')
})

chrome.action.onClicked.addListener((tab) => {
  log('background', 'info', 'action icon clicked', { tabId: tab.id, windowId: tab.windowId })
  if (tab.windowId !== undefined) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) => {
      log('background', 'error', 'sidePanel.open failed', String(err))
    })
  }
})

// 이전 질문의 생성이 끝나기 전에 새 ORIGINAL_QUESTION이 들어오면 중복 호출을 막는다.
let isGenerating = false

chrome.runtime.onMessage.addListener((message: OriginalQuestionMessage, sender) => {
  if (message.type !== 'ORIGINAL_QUESTION') return

  log('background', 'info', 'received ORIGINAL_QUESTION', { question: message.question })

  if (sender.tab?.windowId !== undefined) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId }).catch((err) => {
      log('background', 'error', 'sidePanel.open failed', String(err))
    })
  }

  if (isGenerating) {
    log('background', 'warn', 'generation already in progress, ignoring duplicate message')
    return
  }

  isGenerating = true
  handleOriginalQuestion(message.question, message.hostname).finally(() => {
    isGenerating = false
  })
})
