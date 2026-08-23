import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { createSecretStore } = require('../electron/secret-store.cjs') as {
  createSecretStore(
    app: { getPath(): string },
    safeStorage: {
      isEncryptionAvailable(): boolean
      encryptString(value: string): Buffer
      decryptString(value: Buffer): string
    },
  ): { load(): Promise<string>; save(value: string): Promise<void>; clear(): Promise<void> }
}

const directories: string[] = []
const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) => Buffer.from(Buffer.from(value, 'utf8').map((byte) => byte ^ 0xaa)),
  decryptString: (value: Buffer) => Buffer.from(value.map((byte) => byte ^ 0xaa)).toString('utf8'),
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('Gemini API key secret store', () => {
  it('API 키를 평문이 아닌 암호화 바이트로 저장하고 다시 복원한다', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aipi-secret-store-'))
    directories.push(directory)
    const store = createSecretStore({ getPath: () => directory }, fakeSafeStorage)

    await store.save('test-secret-api-key')
    expect((await readFile(join(directory, 'gemini-api-key.enc'))).toString('utf8'))
      .not.toContain('test-secret-api-key')
    await expect(store.load()).resolves.toBe('test-secret-api-key')
  })

  it('저장된 키를 명시적으로 삭제한다', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aipi-secret-store-'))
    directories.push(directory)
    const store = createSecretStore({ getPath: () => directory }, fakeSafeStorage)
    await store.save('secret')
    await store.clear()
    await expect(store.load()).resolves.toBe('')
  })
})
