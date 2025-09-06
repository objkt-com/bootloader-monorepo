// Utility functions for generating thumbnail URLs

// Global cache buster - change this value to force refresh all thumbnails
const CACHE_BUSTER = 'v1';

/**
 * Generate a thumbnail URL for a token
 * @param {number} tokenId - The token ID
 * @returns {string} The thumbnail URL
 */
export function getTokenThumbnailUrl(tokenId) {
  return `https://media.svgkt.com/thumbnail/${tokenId}?cb=${CACHE_BUSTER}`;
}

/**
 * Generate a thumbnail URL for a generator
 * @param {number} generatorId - The generator ID
 * @returns {string} The thumbnail URL
 */
export function getGeneratorThumbnailUrl(generatorId) {
  return `https://media.svgkt.com/generator-thumbnail/${generatorId}?cb=${CACHE_BUSTER}`;
}

/**
 * Generate a prefetch URL for a token (same as regular URL)
 * @param {number} tokenId - The token ID
 * @returns {string} The thumbnail URL
 */
export function getTokenThumbnailPrefetchUrl(tokenId) {
  return getTokenThumbnailUrl(tokenId);
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
 * @returns {Promise<boolean>} Success status
 */
export async function prefetchTokenThumbnail(tokenId) {
  try {
    const prefetchUrl = getTokenThumbnailPrefetchUrl(tokenId);
    const response = await fetch(prefetchUrl, { method: 'HEAD' });
    
    if (response.ok) {
      console.log(`Token ${tokenId} thumbnail prefetch successful`);
      return true;
    } else {
      console.warn(`Token ${tokenId} thumbnail prefetch failed:`, response.status);
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
    const response = await fetch(prefetchUrl, { method: 'HEAD' });
    
    if (response.ok) {
      console.log(`Generator ${generatorId} thumbnail prefetch successful`);
      return true;
    } else {
      console.warn(`Generator ${generatorId} thumbnail prefetch failed:`, response.status);
      return false;
    }
  } catch (error) {
    console.error(`Generator ${generatorId} thumbnail prefetch error:`, error);
    return false;
  }
}
