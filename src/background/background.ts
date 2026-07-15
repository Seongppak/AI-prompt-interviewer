import { log } from '../shared/logger'

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
