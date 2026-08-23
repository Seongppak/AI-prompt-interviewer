export interface TargetGuidance {
  targetName: string
  common: string
  specific: string
  combined: string
  hasSpecific: boolean
}

export interface TargetGuidanceProvider {
  get(targetName: string): Promise<TargetGuidance>
}
