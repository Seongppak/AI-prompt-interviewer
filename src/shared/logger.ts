export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  scope: string
  level: LogLevel
  message: string
  data?: unknown
}

const STORAGE_KEY = 'debug_logs'
const MAX_ENTRIES = 500

// storage 읽기→쓰기 사이에 다른 log()가 끼어들면 항목이 유실되므로,
// 같은 컨텍스트 안에서는 쓰기를 순차 큐로 처리한다.
let writeQueue: Promise<void> = Promise.resolve()

export function log(scope: string, level: LogLevel, message: string, data?: unknown): Promise<void> {
  console[level](`[${scope}]`, message, data ?? '')

  const entry: LogEntry = { timestamp: new Date().toISOString(), scope, level, message, data }
  writeQueue = writeQueue.then(async () => {
    const { [STORAGE_KEY]: existing = [] } = await chrome.storage.local.get(STORAGE_KEY)
    const updated = [...(existing as LogEntry[]), entry].slice(-MAX_ENTRIES)
    await chrome.storage.local.set({ [STORAGE_KEY]: updated })
  }).catch(() => {})
  return writeQueue
}

export async function getLogs(): Promise<LogEntry[]> {
  const { [STORAGE_KEY]: existing = [] } = await chrome.storage.local.get(STORAGE_KEY)
  return existing as LogEntry[]
}

export async function clearLogs(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] })
}
