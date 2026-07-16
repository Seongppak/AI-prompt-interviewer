import { log } from '../shared/logger'
import { getApiKey } from '../shared/settings'
import { createProject, updateProject } from '../shared/project'
import { generateInterviewQuestions } from './generateQuestions'

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
    const questions = await generateInterviewQuestions(question, apiKey)
    log('background', 'info', 'generated interview questions', { count: questions.length })
    await updateProject(project.id, { status: 'interviewing', questions })
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
