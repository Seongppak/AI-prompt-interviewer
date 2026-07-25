import { log } from '../shared/logger'

// 다운로드 폴더 기준 상대 경로. /inbox 스킬이 같은 경로를 읽는다.
const HANDOFF_DIR = 'ai-prompt-interviewer'
export const HANDOFF_FILENAME = `${HANDOFF_DIR}/prompt.md`

export interface HandoffResult {
  // 파일과 클립보드는 독립적으로 실패할 수 있다. 하나라도 되면 /inbox가 받을 수 있다.
  file: boolean
  clipboard: boolean
}

// 파일을 언제 만들었는지 알아야 /inbox가 오래된 프롬프트를 새 것으로 착각하지 않는다.
function buildFileContent(prompt: string, sourceHostname: string): string {
  return [
    '---',
    `createdAt: ${new Date().toISOString()}`,
    `sourceHostname: ${sourceHostname}`,
    '---',
    '',
    prompt,
    '',
  ].join('\n')
}

// 다운로드가 끝나기 전에 blob URL을 해제하면 파일이 비거나 실패한다.
function revokeWhenDone(downloadId: number, url: string): void {
  function listener(delta: chrome.downloads.DownloadDelta) {
    if (delta.id !== downloadId) return
    const state = delta.state?.current
    if (state !== 'complete' && state !== 'interrupted') return

    chrome.downloads.onChanged.removeListener(listener)
    URL.revokeObjectURL(url)
    if (state === 'interrupted') {
      log('sidepanel', 'warn', 'handoff download interrupted', { downloadId })
    }
  }
  chrome.downloads.onChanged.addListener(listener)
}

async function writeHandoffFile(prompt: string, sourceHostname: string): Promise<boolean> {
  // service worker에는 URL.createObjectURL이 없지만 사이드패널은 문서 컨텍스트라 쓸 수 있다.
  const blob = new Blob([buildFileContent(prompt, sourceHostname)], {
    type: 'text/markdown;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)

  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename: HANDOFF_FILENAME,
      // uniquify면 prompt(1).md, prompt(2).md가 쌓이고 /inbox가 어느 걸 읽을지 모른다.
      conflictAction: 'overwrite',
      saveAs: false,
    })
    revokeWhenDone(downloadId, url)
    log('sidepanel', 'info', 'wrote handoff file', { filename: HANDOFF_FILENAME })
    return true
  } catch (err) {
    URL.revokeObjectURL(url)
    log('sidepanel', 'error', 'failed to write handoff file', String(err))
    return false
  }
}

async function copyToClipboard(prompt: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(prompt)
    return true
  } catch (err) {
    log('sidepanel', 'warn', 'clipboard write failed', String(err))
    return false
  }
}

/**
 * 프롬프트를 파일과 클립보드 양쪽에 넘긴다.
 *
 * 파일이 주 경로다 — 클립보드는 스크린샷 한 번에도 덮어써지지만 파일은 남는다.
 * 클립보드도 함께 채우는 이유는 폴백이 공짜이고, 다른 곳에 바로 붙여넣고 싶을 때도 있어서다.
 */
export async function sendToClaudeCode(
  prompt: string,
  sourceHostname: string,
): Promise<HandoffResult> {
  const [file, clipboard] = await Promise.all([
    writeHandoffFile(prompt, sourceHostname),
    copyToClipboard(prompt),
  ])
  return { file, clipboard }
}
