export interface TargetProfile {
  id: string
  displayName: string
  guidanceKey: string
  capabilities: string[]
}

export const DEFAULT_TARGET_PROFILES: readonly TargetProfile[] = [
  { id: 'chatgpt', displayName: 'ChatGPT', guidanceKey: 'ChatGPT', capabilities: ['general', 'writing', 'coding'] },
  { id: 'claude', displayName: 'Claude', guidanceKey: 'Claude', capabilities: ['long-context', 'writing', 'coding'] },
  { id: 'gemini', displayName: 'Gemini', guidanceKey: 'Gemini', capabilities: ['general', 'multimodal', 'search'] },
  { id: 'grok', displayName: 'Grok', guidanceKey: 'Grok', capabilities: ['realtime', 'social'] },
  { id: 'perplexity', displayName: 'Perplexity', guidanceKey: 'Perplexity', capabilities: ['search', 'citations'] },
  { id: 'copilot', displayName: 'Copilot', guidanceKey: 'Copilot', capabilities: ['microsoft', 'general'] },
  { id: 'claude-code', displayName: 'Claude Code', guidanceKey: 'Claude Code', capabilities: ['coding', 'project-context'] },
  { id: 'codex', displayName: 'Codex', guidanceKey: 'Codex', capabilities: ['coding', 'project-context'] },
]

export function findTargetProfile(
  value: string,
  profiles: readonly TargetProfile[] = DEFAULT_TARGET_PROFILES,
): TargetProfile | undefined {
  const normalized = value.trim().toLowerCase()
  return profiles.find((profile) =>
    profile.id === normalized || profile.displayName.toLowerCase() === normalized,
  )
}
