function floatToToken(value: number): string {
  return Number(value).toPrecision(17);
}

function encodeParamValue(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return value;
    }
    return { "@f": floatToToken(value) };
  }

  if (Array.isArray(value)) {
    return value.map(encodeParamValue);
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = encodeParamValue(inner);
    }
    return out;
  }

  return value;
}

function decodeParamValue(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "@f" in value
  ) {
    return parseFloat((value as { "@f": string })["@f"]);
  }

  if (Array.isArray(value)) {
    return value.map(decodeParamValue);
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = decodeParamValue(inner);
    }
    return out;
  }

  return value;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeBootWebParamsForQuery(
  values: Record<string, unknown>
): string | null {
  if (!values || Object.keys(values).length === 0) {
    return null;
  }

  const encoded = encodeParamValue(values);
  const json = JSON.stringify(encoded);
  const bytes = new TextEncoder().encode(json);
  return base64UrlEncode(bytes);
}

export function decodeBootWebParamsFromQuery(
  encoded: string
): Record<string, unknown> | null {
  if (!encoded) {
    return null;
  }

  try {
    const bytes = base64UrlDecode(encoded);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    return decodeParamValue(parsed) as Record<string, unknown>;
  } catch {
    return null;
  }
}
