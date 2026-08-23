import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const forbiddenPatterns = [
  /\bchrome\s*\./,
  /\bdocument\s*\./,
  /\bwindow\s*\./,
  /\bnavigator\s*\./,
  /\bfetch\s*\(/,
  /\bprocess\s*\./,
]

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') ? [path] : []
  })
}

describe('Core platform boundary', () => {
  it('does not reference browser, Chrome, network, or Node process APIs directly', () => {
    const violations = sourceFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return forbiddenPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${path}: ${pattern.source}`)
    })
    expect(violations).toEqual([])
  })
})
