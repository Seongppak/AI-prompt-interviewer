const fs = require('node:fs/promises')
const path = require('node:path')

const FILE_NAME = 'projects.json'
const MAX_PROJECTS = 50
let writeQueue = Promise.resolve()

function storePath(app) {
  return path.join(app.getPath('userData'), FILE_NAME)
}

function isProject(value) {
  return value && typeof value === 'object'
    && typeof value.id === 'string' && value.id.trim()
    && typeof value.name === 'string'
    && typeof value.originalPrompt === 'string' && value.originalPrompt.trim()
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && typeof value.targetId === 'string'
    && (value.providerMode === 'fake' || value.providerMode === 'gemini')
    && typeof value.resultPrompt === 'string'
    && value.session && typeof value.session === 'object'
    && value.session.id === value.id
}

function normalize(projects) {
  const byId = new Map()
  for (const value of projects) {
    if (!isProject(value)) continue
    const project = JSON.parse(JSON.stringify(value))
    const existing = byId.get(project.id)
    if (!existing || project.updatedAt > existing.updatedAt) byId.set(project.id, project)
  }
  return [...byId.values()]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_PROJECTS)
}

async function readProjects(app) {
  const file = storePath(app)
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'))
    return normalize(Array.isArray(parsed) ? parsed : [])
  } catch (error) {
    if (error && error.code === 'ENOENT') return []
    const backup = `${file}.corrupt-${Date.now()}`
    await fs.copyFile(file, backup).catch(() => {})
    return []
  }
}

async function writeProjects(app, projects) {
  const file = storePath(app)
  const temporary = `${file}.tmp`
  const normalized = normalize(projects)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(temporary, JSON.stringify(normalized, null, 2), 'utf8')
  await fs.rename(temporary, file)
  return normalized
}

function mutate(app, operation) {
  const task = writeQueue.then(async () => writeProjects(app, operation(await readProjects(app))))
  writeQueue = task.then(() => undefined, () => undefined)
  return task
}

function createProjectStore(app) {
  return {
    list: () => readProjects(app),
    upsert: (project) => {
      if (!isProject(project)) throw new Error('저장할 프로젝트 형식이 잘못됐습니다.')
      return mutate(app, (projects) => [project, ...projects.filter((item) => item.id !== project.id)])
    },
    remove: (id) => {
      if (typeof id !== 'string' || !id.trim()) throw new Error('삭제할 프로젝트 id가 필요합니다.')
      return mutate(app, (projects) => projects.filter((item) => item.id !== id))
    },
  }
}

function registerProjectStore(ipcMain, app) {
  const store = createProjectStore(app)
  ipcMain.handle('projects:list', () => store.list())
  ipcMain.handle('projects:upsert', (_event, project) => store.upsert(project))
  ipcMain.handle('projects:remove', (_event, id) => store.remove(id))
}

module.exports = { createProjectStore, registerProjectStore }
