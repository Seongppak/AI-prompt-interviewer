import type { Question } from './question'

export type ProjectStatus = 'loading' | 'interviewing' | 'error'

export interface Project {
  id: string
  originalQuestion: string
  createdAt: string
  status: ProjectStatus
  questions: Question[]
  answers: Record<string, string>
  stepIndex: number
  error?: string
}

const PROJECTS_KEY = 'projects'
const ACTIVE_PROJECT_KEY = 'active_project_id'
const MAX_PROJECTS = 30

export async function getProjects(): Promise<Project[]> {
  const { [PROJECTS_KEY]: existing = [] } = await chrome.storage.local.get(PROJECTS_KEY)
  return existing as Project[]
}

export async function getActiveProjectId(): Promise<string> {
  const { [ACTIVE_PROJECT_KEY]: existing = '' } = await chrome.storage.local.get(ACTIVE_PROJECT_KEY)
  return existing as string
}

export async function setActiveProjectId(id: string): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_PROJECT_KEY]: id })
}

// 새 원본 질문이 들어올 때마다 프로젝트를 만들어 목록 맨 앞에 추가하고 활성 프로젝트로 전환한다.
export async function createProject(originalQuestion: string): Promise<Project> {
  const project: Project = {
    id: crypto.randomUUID(),
    originalQuestion,
    createdAt: new Date().toISOString(),
    status: 'loading',
    questions: [],
    answers: {},
    stepIndex: 0,
  }

  const projects = await getProjects()
  const updated = [project, ...projects].slice(0, MAX_PROJECTS)
  await chrome.storage.local.set({ [PROJECTS_KEY]: updated, [ACTIVE_PROJECT_KEY]: project.id })
  return project
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  const projects = await getProjects()
  const updated = projects.map((project) => (project.id === id ? { ...project, ...patch } : project))
  await chrome.storage.local.set({ [PROJECTS_KEY]: updated })
}
