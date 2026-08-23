import { describe, expect, it, vi } from 'vitest'
import { DesktopProjectRepository, normalizeDesktopProjects, projectNameFromPrompt, type DesktopProject } from '../src/project-repository'

function project(overrides: Partial<DesktopProject> = {}): DesktopProject {
  const id = overrides.id ?? 'project-1'
  return {
    id,
    name: '프로젝트',
    originalPrompt: '데스크톱 앱을 만들어줘',
    createdAt: '2026-08-23T00:00:00.000Z',
    updatedAt: '2026-08-23T00:00:00.000Z',
    targetId: 'codex',
    providerMode: 'fake',
    resultPrompt: '',
    session: {
      id,
      originalPrompt: '데스크톱 앱을 만들어줘',
      createdAt: '2026-08-23T00:00:00.000Z',
      phase: 'ready',
      questions: [],
      answers: {},
      currentQuestionIndex: 0,
    },
    ...overrides,
  }
}

describe('Desktop project persistence model', () => {
  it('손상된 항목을 제외하고 중복 id의 최신 프로젝트만 복구한다', () => {
    const old = project()
    const latest = project({ name: '최신', updatedAt: '2026-08-24T00:00:00.000Z' })
    expect(normalizeDesktopProjects([old, { broken: true }, latest])).toEqual([latest])
  })

  it('긴 원문에서 읽기 쉬운 기본 프로젝트 이름을 만든다', () => {
    expect(projectNameFromPrompt(`  ${'가'.repeat(50)}  `)).toBe(`${'가'.repeat(36)}…`)
  })

  it('IPC Port 결과도 다시 검증한다', async () => {
    const valid = project()
    const port = {
      list: vi.fn().mockResolvedValue([valid, null]),
      upsert: vi.fn().mockResolvedValue([valid]),
      remove: vi.fn().mockResolvedValue([]),
    }
    const repository = new DesktopProjectRepository(port)
    await expect(repository.list()).resolves.toEqual([valid])
    await repository.upsert(valid)
    await repository.remove(valid.id)
    expect(port.upsert).toHaveBeenCalledWith(valid)
    expect(port.remove).toHaveBeenCalledWith(valid.id)
  })
})
