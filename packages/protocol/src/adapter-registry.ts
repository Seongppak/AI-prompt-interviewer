import type { TargetAdapter } from './target-adapter'

export class AdapterRegistry {
  private readonly adapters = new Map<string, TargetAdapter>()

  register(adapter: TargetAdapter): void {
    const id = adapter.id.trim().toLowerCase()
    if (!id) throw new Error('Adapter id가 비어 있습니다.')
    if (this.adapters.has(id)) throw new Error(`이미 등록된 Adapter입니다: ${id}`)
    this.adapters.set(id, adapter)
  }

  get(id: string): TargetAdapter | undefined {
    return this.adapters.get(id.trim().toLowerCase())
  }

  async detect(): Promise<TargetAdapter[]> {
    const detected = await Promise.all(
      [...this.adapters.values()].map(async (adapter) => ({ adapter, active: await adapter.detect() })),
    )
    return detected.filter(({ active }) => active).map(({ adapter }) => adapter)
  }

  list(): TargetAdapter[] {
    return [...this.adapters.values()]
  }
}
