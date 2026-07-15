import { log } from '../shared/logger'
import { setPendingQuestion } from '../shared/pendingQuestion'
import { getApiKey } from '../shared/settings'
import { setDynamicQuestions } from '../shared/dynamicQuestions'
import { generateInterviewQuestions } from './generateQuestions'

interface OriginalQuestionMessage {
  type: 'ORIGINAL_QUESTION'
  question: string
}

async function handleOriginalQuestion(question: string): Promise<void> {
  await setDynamicQuestions({ status: 'loading', questions: [] })

  const apiKey = await getApiKey()
  if (!apiKey) {
    log('background', 'warn', 'no Gemini API key set')
    await setDynamicQuestions({
      status: 'error',
      questions: [],
      error: '설정에서 Gemini API 키를 먼저 입력해주세요',
    })
    return
  }

  try {
    const questions = await generateInterviewQuestions(question, apiKey)
    log('background', 'info', 'generated interview questions', { count: questions.length })
    await setDynamicQuestions({ status: 'ready', questions })
  } catch (err) {
    log('background', 'error', 'failed to generate interview questions', String(err))
    await setDynamicQuestions({
      status: 'error',
      questions: [],
      error: String(err),
    })
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

  setPendingQuestion(message.question).catch((err) => {
    log('background', 'error', 'failed to store pending question', String(err))
  })

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
  handleOriginalQuestion(message.question).finally(() => {
    isGenerating = false
  })
})
