import type { BrowserSiteDefinition } from './site-registry'

export interface BrowserEnvironment {
  getHostname(): string
}

export interface BrowserPromptPort {
  readPrompt(site: BrowserSiteDefinition): string | null
  insertPrompt(site: BrowserSiteDefinition, prompt: string): boolean
}

export class BrowserTargetAdapter {
  readonly id: string
  readonly site: BrowserSiteDefinition
  private readonly environment: BrowserEnvironment
  private readonly promptPort: BrowserPromptPort

  constructor(
    site: BrowserSiteDefinition,
    environment: BrowserEnvironment,
    promptPort: BrowserPromptPort,
  ) {
    this.site = site
    this.environment = environment
    this.promptPort = promptPort
    this.id = site.targetId
  }

  async detect(): Promise<boolean> {
    return this.environment.getHostname().trim().toLowerCase() === this.site.hostname
  }

  async receivePrompt(): Promise<string | null> {
    if (!await this.detect()) return null
    const prompt = this.promptPort.readPrompt(this.site)?.trim()
    return prompt || null
  }

  async sendPrompt(prompt: string): Promise<void> {
    if (!await this.detect()) throw new Error(`${this.site.displayName} 페이지가 아닙니다.`)
    if (!prompt.trim()) throw new Error('전달할 프롬프트가 비어 있습니다.')
    if (!this.promptPort.insertPrompt(this.site, prompt)) {
      throw new Error(`${this.site.displayName} 입력창에 프롬프트를 삽입하지 못했습니다.`)
    }
  }
}
