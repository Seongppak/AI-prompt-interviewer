import type { TargetAdapter } from '../../../packages/protocol/src'

export interface DesktopPromptInsertionResult {
  inserted: boolean
  error?: string
}

export interface DesktopPromptPort {
  isAvailable(): boolean
  activeTargetId(): string | null
  readPrompt(): string | null
  insertPrompt(prompt: string): Promise<DesktopPromptInsertionResult>
}

export class DesktopChatTargetAdapter implements TargetAdapter {
  readonly id: string
  private readonly port: DesktopPromptPort

  constructor(id: string, port: DesktopPromptPort) {
    const normalizedId = id.trim().toLowerCase()
    if (!normalizedId) throw new Error('Desktop Adapter id가 비어 있습니다.')
    this.id = normalizedId
    this.port = port
  }

  async detect(): Promise<boolean> {
    return this.port.isAvailable()
      && this.port.activeTargetId()?.trim().toLowerCase() === this.id
  }

  async receivePrompt(): Promise<string | null> {
    if (!await this.detect()) return null
    return this.port.readPrompt()?.trim() || null
  }

  async sendPrompt(prompt: string): Promise<void> {
    if (!await this.detect()) throw new Error(`${this.id} 원본 채팅창을 찾을 수 없습니다.`)
    const normalized = prompt.trim()
    if (!normalized) throw new Error('전달할 프롬프트가 비어 있습니다.')
    const result = await this.port.insertPrompt(normalized)
    if (!result.inserted) {
      throw new Error(result.error?.trim() || `${this.id} 입력창에 프롬프트를 삽입하지 못했습니다.`)
    }
  }
}
