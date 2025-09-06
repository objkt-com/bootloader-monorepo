// === Storage cost model (250 mutez/byte) ===
const MUTEZ_PER_BYTE = 250;
const TEZ_PER_MUTEZ = 1_000_000;

// From calibration with your data
const BASE_CREATE_NO_AB = 133; // bytes, does NOT include author_bytes
const BASE_MINT = 932; // bytes, already includes your current fragments + static wrappers

/**
 * Convert a byte count into {bytes, mutez, tez}.
 */
function cost(bytes) {
  const mutez = bytes * MUTEZ_PER_BYTE;
  return { bytes, mutez, tez: mutez / TEZ_PER_MUTEZ };
}

/**
 * Estimate storage cost for create_generator
 *
 * bytes_create = BASE_CREATE_NO_AB
 *              + blen(author_bytes)
 *              + blen(name)
 *              + blen(description)
 *              + blen(code)
 */
export function estimateCreateGenerator(
  nameBytes,
  descriptionBytes,
  codeBytes,
  authorBytes = 36
) {
  const bytes =
    BASE_CREATE_NO_AB + authorBytes + nameBytes + descriptionBytes + codeBytes;
  return cost(bytes);
}

/**
 * Estimate storage cost for mint
 *
 * bytes_mint = BASE_MINT
 *            + blen(code)
 *            + blen(name)
 *            + 2*blen(author_bytes)
 */
export function estimateMint(nameBytes, codeBytes, authorBytes = 36) {
  const bytes = BASE_MINT + codeBytes + nameBytes + 2 * authorBytes;
  return cost(bytes);
}

/**
 * Get byte length of a string (UTF-8 encoded)
 */
export function getByteLength(str) {
  return new TextEncoder().encode(str || "").length;
}

/**
 * Estimate storage cost for updating a generator
 * Only pays for the difference in bytes between old and new content
 *
 * bytes_update_diff = blen(new_name) - blen(old_name)
 *                   + blen(new_description) - blen(old_description)
 *                   + blen(new_code) - blen(old_code)
 */
export function estimateUpdateGenerator(
  oldNameBytes,
  oldDescriptionBytes,
  oldCodeBytes,
  newNameBytes,
  newDescriptionBytes,
  newCodeBytes
) {
  const nameDiff = newNameBytes - oldNameBytes;
  const descriptionDiff = newDescriptionBytes - oldDescriptionBytes;
  const codeDiff = newCodeBytes - oldCodeBytes;

  const totalDiff = nameDiff + descriptionDiff + codeDiff;

  // Only charge for additional bytes (positive difference)
  const bytesToPay = Math.max(0, totalDiff);

  return cost(bytesToPay);
}

/**
 * Format storage cost for display
 */
export function formatStorageCost(cost) {
  if (cost.tez >= 0.01) {
    return `~${cost.tez.toFixed(3)} XTZ`;
  } else {
    return `~${cost.mutez.toLocaleString()} μtz`;
  }
}
