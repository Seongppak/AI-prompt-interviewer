import type { DesktopProject } from './project-repository'

declare global {
  interface Window {
    aipiDesktop: {
      readClipboard(): Promise<string>
      writeClipboard(text: string): Promise<void>
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
