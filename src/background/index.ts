chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Prompt Interviewer installed')
})

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) {
    chrome.sidePanel.open({ windowId: tab.windowId })
  }
})
