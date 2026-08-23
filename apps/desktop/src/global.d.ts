import type { DesktopProject } from './project-repository'

interface InterceptorStatus {
  enabled: boolean
  available: boolean
  error: string
}

interface InterceptedPrompt {
  prompt: string
  target: 'chatgpt' | 'claude' | 'claude-code' | 'codex' | 'test'
  source: string
  trigger: 'enter' | 'click'
}

declare global {
  interface Window {
    aipiDesktop: {
      readClipboard(): Promise<string>
      writeClipboard(text: string): Promise<void>
      openGeminiApiKeyPage(): Promise<void>
      captureShortcut(): Promise<string>
      onClipboardCapture(listener: () => void): () => void
      interceptor: {
        status(): Promise<InterceptorStatus>
        setEnabled(enabled: boolean): Promise<InterceptorStatus>
        insertPrompt(text: string): Promise<{ ok: boolean; error: string }>
        onCapture(listener: (capture: InterceptedPrompt) => void): () => void
        onStatus(listener: (status: InterceptorStatus) => void): () => void
      }
      geminiApiKey: {
        load(): Promise<string>
        save(apiKey: string): Promise<void>
        clear(): Promise<void>
      }
      projects: {
        list(): Promise<unknown[]>
        upsert(project: DesktopProject): Promise<unknown[]>
        remove(id: string): Promise<unknown[]>
      }
      platform: string
      arch: string
    }
  }
}

export {}
