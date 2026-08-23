import type { TargetAdapter } from '../../../packages/protocol/src'

export interface ClipboardPort {
  isAvailable(): boolean
  readText(): string
  writeText(text: string): void
}

export class ClipboardTargetAdapter implements TargetAdapter {
  readonly id = 'clipboard'
  private readonly clipboard: ClipboardPort

  constructor(clipboard: ClipboardPort) {
    this.clipboard = clipboard
  }

  async detect(): Promise<boolean> {
    return this.clipboard.isAvailable()
  }

  async receivePrompt(): Promise<string | null> {
    if (!await this.detect()) return null
    return this.clipboard.readText().trim() || null
  }

  async sendPrompt(prompt: string): Promise<void> {
    if (!await this.detect()) throw new Error('클립보드를 사용할 수 없습니다.')
    const normalized = prompt.trim()
    if (!normalized) throw new Error('복사할 프롬프트가 비어 있습니다.')
    this.clipboard.writeText(normalized)
  }
}
