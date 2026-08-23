export interface ProjectContext {
  rootPath?: string
  languages: string[]
  frameworks: string[]
  packageManager?: string
  buildTool?: string
  testFrameworks: string[]
}

export const EMPTY_PROJECT_CONTEXT: ProjectContext = {
  languages: [],
  frameworks: [],
  testFrameworks: [],
}
