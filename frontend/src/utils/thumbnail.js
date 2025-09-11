// Utility functions for generating thumbnail URLs
import { CONFIG } from "../config.js";
import { tzktService } from "../services/tzkt.js";

// Global cache buster - change this value to force refresh all thumbnails
const CACHE_BUSTER = "v11";

/**
 * Get a thumbnail URL for a token from chain data
 * @param {number} tokenId - The token ID
 * @param {Object} tokenData - Optional token data if already available
 * @returns {Promise<string>} The thumbnail URL from chain or fallback URL
 */
export async function getTokenThumbnailUrl(tokenId, tokenData = null) {
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
      return `https://media.bootloader.art/thumbnail/${tokenId}?n=${getNetwork()}`;
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
    return `https://media.bootloader.art/thumbnail/${tokenId}?n=${getNetwork()}`;
  } catch (error) {
    console.error(`Failed to get thumbnailUri for token ${tokenId}:`, error);
    // Fallback to constructed URL on error
    return `https://media.bootloader.art/thumbnail/${tokenId}?n=${getNetwork()}`;
  }
}

/**
 * Generate a thumbnail URL for a generator
 * @param {number} generatorId - The generator ID
 * @returns {string} The thumbnail URL
 */
export function getGeneratorThumbnailUrl(generatorId) {
  return `https://media.bootloader.art/generator-thumbnail/${generatorId}?v=${CACHE_BUSTER}&n=${getNetwork()}`;
}

/**
 * Get a prefetch URL for a token (same as regular URL)
 * @param {number} tokenId - The token ID
 * @param {Object} tokenData - Optional token data if already available
 * @returns {Promise<string>} The thumbnail URL from chain or fallback URL
 */
export async function getTokenThumbnailPrefetchUrl(tokenId, tokenData = null) {
  return await getTokenThumbnailUrl(tokenId, tokenData);
}

/**
 * Generate a prefetch URL for a generator (same as regular URL)
 * @param {number} generatorId - The generator ID
 * @returns {string} The thumbnail URL
 */
export function getGeneratorThumbnailPrefetchUrl(generatorId) {
  return getGeneratorThumbnailUrl(generatorId);
}

/**
 * Call prefetch for a token thumbnail (simplified since we're using direct URLs)
 * @param {number} tokenId - The token ID
 * @param {Object} tokenData - Optional token data if already available
 * @returns {Promise<boolean>} Success status
 */
export async function prefetchTokenThumbnail(tokenId, tokenData = null) {
  try {
    const prefetchUrl = await getTokenThumbnailPrefetchUrl(tokenId, tokenData);
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
 * @returns {Promise<boolean>} Success status
 */
export async function prefetchGeneratorThumbnail(generatorId) {
  try {
    const prefetchUrl = getGeneratorThumbnailPrefetchUrl(generatorId);
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
