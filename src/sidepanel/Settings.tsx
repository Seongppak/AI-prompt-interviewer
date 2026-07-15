import { useEffect, useState } from 'react'
import { clearApiKey, getApiKey, setApiKey } from '../shared/settings'

export function Settings() {
  const [visible, setVisible] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [status, setStatus] = useState('')

  async function refresh() {
    const existing = await getApiKey()
    setHasKey(existing.length > 0)
    setKeyInput('')
  }

  useEffect(() => {
    refresh()
  }, [])

  async function toggle() {
    const next = !visible
    setVisible(next)
    if (next) await refresh()
  }

  async function handleSave() {
    if (!keyInput.trim()) return
    await setApiKey(keyInput.trim())
    setStatus('저장했어요')
    await refresh()
  }

  async function handleClear() {
    await clearApiKey()
    setStatus('삭제했어요')
    await refresh()
  }

  return (
    <section className="settings">
      <button type="button" onClick={toggle}>
        {visible ? '설정 숨기기' : hasKey ? '⚙️ 설정 (API 키 등록됨)' : '⚙️ 설정 (API 키 필요)'}
      </button>

      {visible && (
        <div className="settings-body">
          <label className="settings-label" htmlFor="api-key-input">
            Gemini API 키
          </label>
          <input
            id="api-key-input"
            type="password"
            placeholder={hasKey ? '••••••••••••••••' : 'AIza...'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <div className="settings-actions">
            <button type="button" onClick={handleSave} disabled={!keyInput.trim()}>
              저장
            </button>
            <button type="button" onClick={handleClear} disabled={!hasKey}>
              삭제
            </button>
          </div>
          {status && <p className="status-message">{status}</p>}
        </div>
      )}
    </section>
  )
}
