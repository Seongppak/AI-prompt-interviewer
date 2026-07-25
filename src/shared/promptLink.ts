// 확장 외부(Claude Code 등)에서 프롬프트를 넘겨받기 위한 URL 프래그먼트 규약.
//
// 대상 사이트가 ?q= 같은 프리필 파라미터를 지원하는지에 의존하지 않는다 —
// content script가 이미 각 사이트에 주입돼 있으므로 우리가 정한 규약을 직접 읽으면 된다.
// 프래그먼트는 서버로 전송되지 않아서 프롬프트가 대상 사이트의 접근 로그에도 남지 않는다.
export const PROMPT_HASH_PREFIX = '#aipi='

// base64url을 쓰는 이유: 일반 base64의 '+'는 URL에서 공백으로 해석될 수 있고
// '/'와 '='도 셸 인자로 넘길 때 애매해진다. base64url 문자는 전부 URL-safe라
// 브라우저가 퍼센트 인코딩을 하지 않는다.
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  // atob는 패딩이 없으면 실패하므로 길이를 4의 배수로 복원한다.
  return base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
}

export function encodePromptHash(prompt: string): string {
  // btoa는 바이트열만 받으므로 UTF-8로 인코딩한 뒤 latin1 문자열로 옮긴다.
  const bytes = new TextEncoder().encode(prompt)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `${PROMPT_HASH_PREFIX}${toBase64Url(btoa(binary))}`
}

// 우리 규약이 아니거나 형식이 깨졌으면 null — 호출부에서 조용히 무시하도록 설계됨.
export function decodePromptHash(hash: string): string | null {
  if (!hash.startsWith(PROMPT_HASH_PREFIX)) return null

  const encoded = hash.slice(PROMPT_HASH_PREFIX.length)
  if (!encoded) return null

  try {
    const binary = atob(fromBase64Url(encoded))
    // atob 결과는 바이트열이므로 UTF-8로 디코드해야 한글이 깨지지 않는다.
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes) || null
  } catch {
    return null
  }
}
