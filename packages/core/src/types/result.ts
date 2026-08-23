export type CoreErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_AI_RESPONSE'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'STORAGE_FAILURE'

export interface CoreError {
  code: CoreErrorCode
  message: string
  retryable: boolean
  cause?: unknown
}

export class AIPIError extends Error {
  readonly code: CoreErrorCode
  readonly retryable: boolean
  override readonly cause?: unknown

  constructor(error: CoreError) {
    super(error.message)
    this.name = 'AIPIError'
    this.code = error.code
    this.retryable = error.retryable
    this.cause = error.cause
  }

  toCoreError(): CoreError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      cause: this.cause,
    }
  }
}
