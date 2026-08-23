import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { createProjectStore } = require('../electron/project-store.cjs') as {
  createProjectStore(app: { getPath(): string }): {
    list(): Promise<unknown[]>
    upsert(project: unknown): Promise<unknown[]>
    remove(id: string): Promise<unknown[]>
  }
}

const temporaryDirectories: string[] = []

async function createStore() {
  const directory = await mkdtemp(join(tmpdir(), 'aipi-project-store-'))
  temporaryDirectories.push(directory)
  return { directory, store: createProjectStore({ getPath: () => directory }) }
}

function project() {
  return {
    id: 'restart-project',
    name: '재시작 복원 테스트',
    originalPrompt: '프로젝트 기록을 저장해줘',
    createdAt: '2026-08-23T00:00:00.000Z',
    updatedAt: '2026-08-23T01:00:00.000Z',
    targetId: 'codex',
    providerMode: 'fake',
    resultPrompt: '복원된 최종 프롬프트',
    session: {
      id: 'restart-project',
      originalPrompt: '프로젝트 기록을 저장해줘',
      createdAt: '2026-08-23T00:00:00.000Z',
      phase: 'ready',
      questions: [],
      answers: {},
      currentQuestionIndex: 0,
    },
  }
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('Electron project JSON store', () => {
  it('저장 후 새 Store 인스턴스에서도 프로젝트와 최종 결과를 복원한다', async () => {
    const { directory, store } = await createStore()
    await store.upsert(project())

    const reopened = createProjectStore({ getPath: () => directory })
    await expect(reopened.list()).resolves.toEqual([project()])
    expect(JSON.parse(await readFile(join(directory, 'projects.json'), 'utf8'))).toEqual([project()])
  })

  it('손상된 JSON을 별도 파일로 보존하고 빈 목록으로 복구한다', async () => {
    const { directory, store } = await createStore()
    await writeFile(join(directory, 'projects.json'), '{broken json', 'utf8')

    await expect(store.list()).resolves.toEqual([])
    expect((await readdir(directory)).some((name) => name.startsWith('projects.json.corrupt-'))).toBe(true)
  })

  it('삭제 결과도 다음 실행에 유지한다', async () => {
    const { directory, store } = await createStore()
    await store.upsert(project())
    await store.remove('restart-project')
    await expect(createProjectStore({ getPath: () => directory }).list()).resolves.toEqual([])
  })
})
