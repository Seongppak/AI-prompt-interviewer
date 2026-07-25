export type StorageArea = 'local' | 'sync'

/**
 * 어떤 데이터를 기기 간에 공유할지 한 곳에서 정한다.
 *
 * sync는 Chrome 계정을 통해 다른 기기로 따라가지만 항목당 8KB / 전체 100KB 한도가 있고,
 * 값이 Google 서버를 거친다. 그래서 "다른 기기에서 다시 설정하기 귀찮은 것"만 올린다.
 */
const SYNCED_KEYS = new Set([
  // 노트북에서 API 키를 다시 입력하지 않으려면 이게 따라가야 한다.
  // 대가로 키가 Chrome 동기화를 통해 Google 서버를 거친다. 그게 싫으면 이 줄만 지우면
  // 기기별 로컬 저장으로 되돌아간다.
  'gemini_api_key',
  'theme',
  // 학습된 선호도(⭐). 애초에 기기 간 공유가 목적인 데이터다.
  'preferences',
])

// 아래는 의도적으로 local에 둔다:
//   extension_enabled — 순간적인 토글이다. 사이드패널을 닫으면 꺼지는데(handleClosePanel),
//                       공유하면 반대편 기기의 가로채기가 갑자기 죽는다.
//   projects          — 프로젝트 30개는 sync의 항목당 8KB 한도를 쉽게 넘는다.
//   active_project_id — projects가 local이므로 함께 둔다.
//   debug_logs        — 최대 500개 항목. 한도를 크게 넘고 공유할 이유도 없다.
//   geminiModelCache  — 캐시다. 기기마다 다시 만들면 된다.

export function areaFor(key: string): StorageArea {
  return SYNCED_KEYS.has(key) ? 'sync' : 'local'
}

// 이미 확인한 키는 다시 검사하지 않는다 — 없으면 synced 키를 읽을 때마다 local까지 들여다본다.
const migrated = new Set<string>()

/**
 * local에만 있던 기존 값을 sync로 한 번 옮긴다.
 *
 * 이 마이그레이션이 없으면 저장 위치를 바꾼 순간 사용자에게는 API 키와 학습된 선호도가
 * 사라진 것으로 보인다. 실제로 쓰던 데이터가 있는 상태에서 배포되는 변경이라 필수다.
 */
async function migrateToSyncIfNeeded(key: string): Promise<void> {
  if (migrated.has(key) || areaFor(key) !== 'sync') return
  migrated.add(key)

  const { [key]: synced } = await chrome.storage.sync.get(key)
  if (synced !== undefined) return

  const { [key]: local } = await chrome.storage.local.get(key)
  if (local === undefined) return

  // sync 쓰기가 성공한 뒤에만 local에서 지운다. 순서가 바뀌면 실패 시 값을 잃는다.
  await chrome.storage.sync.set({ [key]: local })
  await chrome.storage.local.remove(key)
}

export async function getStored<T>(key: string, fallback: T): Promise<T> {
  await migrateToSyncIfNeeded(key)
  const { [key]: existing } = await chrome.storage[areaFor(key)].get(key)
  return existing === undefined ? fallback : (existing as T)
}

export async function setStored(key: string, value: unknown): Promise<void> {
  await chrome.storage[areaFor(key)].set({ [key]: value })
}

export async function removeStored(key: string): Promise<void> {
  await chrome.storage[areaFor(key)].remove(key)
}

/**
 * 이 키의 변경을 구독한다. 해당 키가 어느 area에 사는지 호출부가 몰라도 되게 감싼다.
 * 저장 위치를 옮겼을 때 리스너가 조용히 죽는 사고를 막는 게 목적이다.
 */
export function subscribeStored(
  key: string,
  onChange: (newValue: unknown) => void,
): () => void {
  const expectedArea = areaFor(key)

  function listener(
    changes: { [k: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) {
    if (area !== expectedArea) return
    const change = changes[key]
    if (change) onChange(change.newValue)
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
