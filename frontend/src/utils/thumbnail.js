// Utility functions for generating thumbnail URLs
import { CONFIG } from "../config.js";
import { tzktService } from "../services/tzkt.js";

// Global cache buster - change this value to force refresh all thumbnails
const CACHE_BUSTER = "v12";

/**
 * JavaScript equivalent of the smart contract's bytes_utils.to_nat function
 * Converts hex string bytes to a natural number by treating them as binary data
 * @param {string} hexString - Hex string (with or without 0x prefix)
 * @returns {bigint} The natural number representation
 */
function hexToNat(hexString) {
  // Remove 0x prefix if present
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;

  // Convert hex string to bytes and then to natural number
  let result = 0n;

  // Process bytes from left to right (big-endian byte order)
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byteHex = cleanHex.slice(i, i + 2);
    const byteValue = parseInt(byteHex, 16);

    // Process each bit of the byte from LSB to MSB (like the smart contract)
    // Bit masks: 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80
    for (let bitMask = 1; bitMask <= 128; bitMask <<= 1) {
      result = result << 1n;
      if ((byteValue & bitMask) === bitMask) {
        result = result + 1n;
      }
    }
  }

  return result;
}

/**
 * JavaScript equivalent of the smart contract's bytes_utils.from_nat function
 * Converts a natural number to ASCII-encoded decimal bytes (as hex string)
 * @param {bigint} n - The natural number
 * @returns {string} Hex string representing ASCII-encoded decimal
 */
function natToHex(n) {
  if (n === 0n) {
    return '30'; // ASCII '0'
  }

  const digits = [];
  let value = n;

  // Convert to decimal digits
  while (value > 0n) {
    const remainder = value % 10n;
    digits.push(Number(remainder));
    value = value / 10n;
  }

  // Convert digits to ASCII hex (reverse order since we collected least-significant first)
  let result = '';
  for (let i = digits.length - 1; i >= 0; i--) {
    const asciiCode = 48 + digits[i]; // ASCII '0' is 48
    result += asciiCode.toString(16).padStart(2, '0');
  }

  return result;
}

/**
 * JavaScript equivalent of bytes_utils.from_nat(bytes_utils.to_nat(seed))
 * This matches the smart contract's seed processing logic
 * @param {string} hexString - Hex string (with or without 0x prefix)
 * @returns {string} Processed hex string
 */
export function processSeedLikeContract(hexString) {
  const nat = hexToNat(hexString);
  return natToHex(nat);
}

/**
 * Get a thumbnail URL for a token from chain data
 * @param {number} tokenId - The token ID
 * @param {Object} tokenData - Optional token data if already available
 * @param {Object} [options]
 * @param {number|string|null} [options.generatorVersion]
 * @param {string|null} [options.network]
 * @returns {Promise<string>} The thumbnail URL from chain or fallback URL
 */
export async function getTokenThumbnailUrl(
  tokenId,
  tokenData = null,
  options = {},
) {
  const { generatorVersion, network } = {
    generatorVersion: null,
    network: null,
    ...options,
  };
  const resolvedGeneratorVersion =
    generatorVersion ?? tokenData?.generatorVersion ?? null;
  const fallbackUrl = buildTokenThumbnailUrl(tokenId, {
    generatorVersion: resolvedGeneratorVersion,
    network,
  });

  try {
    // If token data is provided, use it directly
    if (tokenData && tokenData.thumbnailUri) {
      return tokenData.thumbnailUri;
    }

    // Otherwise, fetch token metadata from chain
    const tokenMetadataBigMap = await tzktService.getBigMapByPath(
      "token_metadata",
    );
    if (!tokenMetadataBigMap) {
      console.warn("Token metadata bigmap not found, using fallback URL");
      return fallbackUrl;
    }

    const tokenMetadata = await tzktService.getBigMapKey(
      tokenMetadataBigMap.ptr,
      tokenId.toString(),
    );

    if (
      tokenMetadata &&
      tokenMetadata.value &&
      tokenMetadata.value.token_info
    ) {
      const tokenInfo = tokenMetadata.value.token_info;

      // Look for thumbnailUri in the token_info
      if (tokenInfo.thumbnailUri) {
        return tzktService.bytesToString(tokenInfo.thumbnailUri);
      }
    }

    // Fallback to constructed URL if thumbnailUri not found
    console.warn(
      `No thumbnailUri found for token ${tokenId}, using fallback URL`,
    );
    return fallbackUrl;
  } catch (error) {
    console.error(`Failed to get thumbnailUri for token ${tokenId}:`, error);
    // Fallback to constructed URL on error
    return fallbackUrl;
  }
}

/**
 * Generate a thumbnail URL for a generator
 * @param {number} generatorId - The generator ID
 * @param {number} generatorVersion - The generator version (optional, defaults to 1)
 * @returns {string} The thumbnail URL
 */
export function getGeneratorThumbnailUrl(generatorId, generatorVersion = 1) {
  return `https://media.bootloader.art/generator-thumbnail/${generatorId}?v=${generatorVersion}-${CACHE_BUSTER}&n=${getNetwork()}`;
}

/**
 * Get a prefetch URL for a token (same as regular URL)
 * @param {number} tokenId - The token ID
 * @param {Object} tokenData - Optional token data if already available
 * @param {Object} [options]
 * @param {number|string|null} [options.generatorVersion]
 * @param {string|null} [options.network]
 * @returns {Promise<string>} The thumbnail URL from chain or fallback URL
 */
export async function getTokenThumbnailPrefetchUrl(
  tokenId,
  tokenData = null,
  options = {},
) {
  return await getTokenThumbnailUrl(tokenId, tokenData, options);
}

/**
 * Generate a prefetch URL for a generator (same as regular URL)
 * @param {number} generatorId - The generator ID
 * @param {number} generatorVersion - The generator version (optional, defaults to 1)
 * @returns {string} The thumbnail URL
 */
export function getGeneratorThumbnailPrefetchUrl(generatorId, generatorVersion = 1) {
  return getGeneratorThumbnailUrl(generatorId, generatorVersion);
}

/**
 * Call prefetch for a token thumbnail (simplified since we're using direct URLs)
 * @param {number} tokenId - The token ID
 * @param {Object} [options]
 * @param {Object|null} [options.tokenData] - Optional token data if already available
 * @param {number|string|null} [options.generatorVersion] - Explicit generator version to include in the cache key
 * @param {string|null} [options.network] - Optional override for the network code (m/g/s)
 * @returns {Promise<boolean>} Success status
 */
export async function prefetchTokenThumbnail(
  tokenId,
  options = {},
) {
  try {
    const { tokenData = null, ...rest } = options || {};
    const prefetchUrl = await getTokenThumbnailPrefetchUrl(
      tokenId,
      tokenData,
      rest,
    );
    const response = await fetch(prefetchUrl, { method: "HEAD" });

    if (response.ok) {
      console.log(`Token ${tokenId} thumbnail prefetch successful`);
      return true;
    } else {
      console.warn(
        `Token ${tokenId} thumbnail prefetch failed:`,
        response.status,
      );
      return false;
    }
  } catch (error) {
    console.error(`Token ${tokenId} thumbnail prefetch error:`, error);
    return false;
  }
}

/**
 * Call prefetch for a generator thumbnail (simplified since we're using direct URLs)
 * @param {number} generatorId - The generator ID
 * @param {number} generatorVersion - The generator version (optional, defaults to 1)
 * @returns {Promise<boolean>} Success status
 */
export async function prefetchGeneratorThumbnail(generatorId, generatorVersion = 1) {
  try {
    const prefetchUrl = getGeneratorThumbnailPrefetchUrl(generatorId, generatorVersion);
    const response = await fetch(prefetchUrl, { method: "HEAD" });

    if (response.ok) {
      console.log(`Generator ${generatorId} thumbnail prefetch successful`);
      return true;
    } else {
      console.warn(
        `Generator ${generatorId} thumbnail prefetch failed:`,
        response.status,
      );
      return false;
    }
  } catch (error) {
    console.error(`Generator ${generatorId} thumbnail prefetch error:`, error);
    return false;
  }
}

export function getNetwork() {
  switch (CONFIG.network) {
    case "ghostnet":
      return "g";
    case "shadownet":
      return "s";
    default:
      return "m";
  }
}

export function buildTokenThumbnailUrl(
  tokenId,
  { generatorVersion = null, network = null } = {},
) {
  const params = new URLSearchParams();
  if (generatorVersion != null) {
    params.set("v", String(generatorVersion));
  }

  const networkCode = network || getNetwork();
  if (networkCode) {
    params.set("n", networkCode);
  }

  const query = params.toString();
  return query
    ? `https://media.bootloader.art/thumbnail/${tokenId}?${query}`
    : `https://media.bootloader.art/thumbnail/${tokenId}`;
}
