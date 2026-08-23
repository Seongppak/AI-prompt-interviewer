const fs = require('node:fs/promises')
const path = require('node:path')

const FILE_NAME = 'gemini-api-key.enc'

function createSecretStore(app, safeStorage) {
  const file = () => path.join(app.getPath('userData'), FILE_NAME)

  return {
    async load() {
      try {
        const encrypted = await fs.readFile(file())
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error('Windows 보안 저장소를 사용할 수 없습니다.')
        }
        return safeStorage.decryptString(encrypted)
      } catch (error) {
        if (error && error.code === 'ENOENT') return ''
        throw error
      }
    },

    async save(apiKey) {
      const normalized = typeof apiKey === 'string' ? apiKey.trim() : ''
      if (!normalized) throw new Error('저장할 API 키가 비어 있습니다.')
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Windows 보안 저장소를 사용할 수 없습니다.')
      }
      const destination = file()
      const temporary = `${destination}.tmp`
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.writeFile(temporary, safeStorage.encryptString(normalized))
      await fs.rename(temporary, destination)
    },

    async clear() {
      await fs.rm(file(), { force: true })
    },
  }
}

function registerSecretStore(ipcMain, app, safeStorage) {
  const store = createSecretStore(app, safeStorage)
  ipcMain.handle('secret:gemini:get', () => store.load())
  ipcMain.handle('secret:gemini:set', (_event, apiKey) => store.save(apiKey))
  ipcMain.handle('secret:gemini:clear', () => store.clear())
}

module.exports = { createSecretStore, registerSecretStore }
