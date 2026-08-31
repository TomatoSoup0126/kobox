function bytesToBase64Url (bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes (value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deflateBytes (bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflateBytes (bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodePayload (payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  const compressed = await deflateBytes(bytes)
  return `d.${bytesToBase64Url(compressed)}`
}

export async function decodePayload (encoded) {
  if (!encoded || typeof encoded !== 'string') {
    throw new Error('invalid_payload')
  }

  const trimmed = encoded.replace(/^#/, '').trim()
  const hasPrefix = trimmed.startsWith('d.') || trimmed.startsWith('r.')
  const prefix = hasPrefix ? trimmed.slice(0, 2) : 'd.'
  const body = hasPrefix ? trimmed.slice(2) : trimmed
  const bytes = base64UrlToBytes(body)

  if (prefix === 'r.') {
    return JSON.parse(new TextDecoder().decode(bytes))
  }

  try {
    const inflated = await inflateBytes(bytes)
    return JSON.parse(new TextDecoder().decode(inflated))
  } catch (error) {
    try {
      return JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      throw error
    }
  }
}
