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

export async function log(
  scope: string,
  level: LogLevel,
  message: string,
  data?: unknown,
): Promise<void> {
  console[level](`[${scope}]`, message, data ?? '')

  const entry: LogEntry = { timestamp: new Date().toISOString(), scope, level, message, data }
  const { [STORAGE_KEY]: existing = [] } = await chrome.storage.local.get(STORAGE_KEY)
  const updated = [...(existing as LogEntry[]), entry].slice(-MAX_ENTRIES)
  await chrome.storage.local.set({ [STORAGE_KEY]: updated })
}

export async function getLogs(): Promise<LogEntry[]> {
  const { [STORAGE_KEY]: existing = [] } = await chrome.storage.local.get(STORAGE_KEY)
  return existing as LogEntry[]
}

export async function clearLogs(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] })
}
