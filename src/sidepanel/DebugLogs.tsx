import { useEffect, useState } from 'react'
import { clearLogs, getLogs, type LogEntry } from '../shared/logger'

function formatEntry(entry: LogEntry): string {
  const dataText = entry.data !== undefined ? ` ${JSON.stringify(entry.data)}` : ''
  return `[${entry.timestamp}] [${entry.scope}] [${entry.level}] ${entry.message}${dataText}`
}

export function DebugLogs() {
  const [visible, setVisible] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])

  async function refresh() {
    setLogs(await getLogs())
  }

  // 로그가 열려 있는 동안 storage 변경을 구독해서 실시간으로 갱신한다.
  useEffect(() => {
    if (!visible) return
    refresh()

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area === 'local' && changes['debug_logs']) {
        setLogs((changes['debug_logs'].newValue ?? []) as LogEntry[])
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [visible])

  function toggle() {
    setVisible((prev) => !prev)
  }

  async function handleClear() {
    await clearLogs()
    await refresh()
  }

  function handleDownload() {
    const text = logs.map(formatEntry).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ai-prompt-interviewer-logs.log'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="debug-logs">
      <button type="button" onClick={toggle}>
        {visible ? '디버그 로그 숨기기' : '디버그 로그 보기'}
      </button>

      {visible && (
        <div className="debug-logs-body">
          <div className="debug-logs-actions">
            <button type="button" onClick={refresh}>
              새로고침
            </button>
            <button type="button" onClick={handleDownload} disabled={logs.length === 0}>
              로그 파일 다운로드
            </button>
            <button type="button" onClick={handleClear}>
              지우기
            </button>
          </div>
          <pre className="debug-logs-list">
            {logs.length === 0 ? '기록된 로그가 없습니다' : logs.map(formatEntry).join('\n')}
          </pre>
        </div>
      )}
    </section>
  )
}
