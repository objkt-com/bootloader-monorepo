export const GENERIC_WEB_SEED_BYTES = 32;
export const GENERIC_WEB_SEED_HEX_LENGTH = GENERIC_WEB_SEED_BYTES * 2;
export const GENERIC_WEB_PREVIEW_SEED = "8".repeat(
  GENERIC_WEB_SEED_HEX_LENGTH
);

export function randomHex(bytes: number): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export function generateGenericWebSeedHex(): string {
  return randomHex(GENERIC_WEB_SEED_BYTES);
}

export function normalizeGenericWebSeedHex(
  value: string | null | undefined
): string {
  const sanitized =
    typeof value === "string"
      ? value
          .trim()
          .replace(/^0x/i, "")
          .replace(/[^0-9a-f]/gi, "f")
          .toLowerCase()
      : "";

  return sanitized
    .slice(-GENERIC_WEB_SEED_HEX_LENGTH)
    .padStart(GENERIC_WEB_SEED_HEX_LENGTH, "0");
}
