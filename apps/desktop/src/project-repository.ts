import type { InterviewSession } from '../../../packages/core/src'

export const MAX_DESKTOP_PROJECTS = 50

export interface DesktopProject {
  id: string
  name: string
  originalPrompt: string
  createdAt: string
  updatedAt: string
  targetId: string
  providerMode: 'fake' | 'gemini'
  session: InterviewSession
  resultPrompt: string
}

export interface DesktopProjectPort {
  list(): Promise<unknown[]>
  upsert(project: DesktopProject): Promise<unknown[]>
  remove(id: string): Promise<unknown[]>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function normalizeDesktopProject(value: unknown): DesktopProject | undefined {
  if (!isRecord(value) || !isRecord(value.session)) return undefined
  if (typeof value.id !== 'string' || !value.id.trim()) return undefined
  if (typeof value.originalPrompt !== 'string' || !value.originalPrompt.trim()) return undefined
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) return undefined
  if (typeof value.targetId !== 'string' || !value.targetId.trim()) return undefined
  if (value.providerMode !== 'fake' && value.providerMode !== 'gemini') return undefined
  if (typeof value.resultPrompt !== 'string') return undefined
  if (typeof value.session.id !== 'string' || value.session.id !== value.id) return undefined
  if (typeof value.session.originalPrompt !== 'string') return undefined
  if (!Array.isArray(value.session.questions) || !isRecord(value.session.answers)) return undefined

  const name = typeof value.name === 'string' && value.name.trim()
    ? value.name.trim().slice(0, 80)
    : value.originalPrompt.trim().slice(0, 40)
  return { ...value, id: value.id.trim(), name } as DesktopProject
}

export function normalizeDesktopProjects(values: unknown[]): DesktopProject[] {
  const byId = new Map<string, DesktopProject>()
  for (const value of values) {
    const project = normalizeDesktopProject(value)
    if (!project) continue
    const existing = byId.get(project.id)
    if (!existing || project.updatedAt > existing.updatedAt) byId.set(project.id, project)
  }
  return [...byId.values()]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_DESKTOP_PROJECTS)
}

export function projectNameFromPrompt(prompt: string): string {
  const normalized = prompt.trim().replace(/\s+/g, ' ')
  return normalized.length > 36 ? `${normalized.slice(0, 36)}…` : normalized
}

export class DesktopProjectRepository {
  constructor(private readonly port: DesktopProjectPort) {}

  async list(): Promise<DesktopProject[]> {
    return normalizeDesktopProjects(await this.port.list())
  }

  async upsert(project: DesktopProject): Promise<DesktopProject[]> {
    return normalizeDesktopProjects(await this.port.upsert(project))
  }

  async remove(id: string): Promise<DesktopProject[]> {
    return normalizeDesktopProjects(await this.port.remove(id))
  }
}
