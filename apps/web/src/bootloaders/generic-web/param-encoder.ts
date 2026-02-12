/**
 * Encode parameter values for URL query string
 * Handles float precision with @f markers
 */

function floatToToken(value: number): string {
  return Number(value).toPrecision(17)
}

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function encodeParamValue(value: unknown): unknown {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) return value
    return { '@f': floatToToken(value) }
  }
  if (Array.isArray(value)) {
    return value.map(encodeParamValue)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value)) {
      out[key] = encodeParamValue(inner)
    }
    return out
  }
  return value
}

export function encodeParamsForQuery(values: Record<string, unknown>): string | null {
  if (!values || Object.keys(values).length === 0) return null
  const encoded = encodeParamValue(values)
  return base64UrlEncode(JSON.stringify(encoded))
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

function decodeParamValue(value: unknown): unknown {
  if (value && typeof value === 'object' && '@f' in value) {
    return parseFloat((value as { '@f': string })['@f'])
  }
  if (Array.isArray(value)) {
    return value.map(decodeParamValue)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value)) {
      out[key] = decodeParamValue(inner)
    }
    return out
  }
  return value
}

export function decodeParamsFromQuery(encoded: string): Record<string, unknown> | null {
  if (!encoded) return null
  try {
    const json = base64UrlDecode(encoded)
    const parsed = JSON.parse(json)
    return decodeParamValue(parsed) as Record<string, unknown>
  } catch {
    return null
  }
}
