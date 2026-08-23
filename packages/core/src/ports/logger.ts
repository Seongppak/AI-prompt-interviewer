export type CoreLogLevel = 'info' | 'warn' | 'error'

export interface CoreLogger {
  log(scope: string, level: CoreLogLevel, message: string, data?: unknown): void | Promise<void>
}

export const NOOP_LOGGER: CoreLogger = {
  log: () => {},
}
