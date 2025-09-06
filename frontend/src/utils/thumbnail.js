// Utility functions for generating thumbnail URLs using thum.io

// Global cache buster - change this value to force refresh all thumbnails
const CACHE_BUSTER = 'v1';

/**
 * Generate a thum.io thumbnail URL for a token
 * @param {number} tokenId - The token ID
 * @param {number} width - Thumbnail width (default: 400)
 * @param {number} height - Thumbnail height (default: 400)
 * @returns {string} The thum.io URL
 */
export function getTokenThumbnailUrl(tokenId, width = 400, height = 400) {
  // Always use the remote URL since thum.io needs to access a publicly available URL
  const baseUrl = 'https://tsmcalister.github.io/svgkt-monorepo';
  
  const targetUrl = `${baseUrl}/thumbnail/${tokenId}?cb=${CACHE_BUSTER}`;
  
  return `https://image.thum.io/get/image/fit/${width}x${height}/https://image.thum.io/get/wait/20/width/1200/crop/1200/viewportWidth/1200/noanimate/allowJPG/${targetUrl}`;
}

/**
 * Generate a thum.io thumbnail URL for a generator
 * @param {number} generatorId - The generator ID
 * @param {number} width - Thumbnail width (default: 400)
 * @param {number} height - Thumbnail height (default: 400)
 * @returns {string} The thum.io URL
 */
export function getGeneratorThumbnailUrl(generatorId, width = 400, height = 400) {
  // Always use the remote URL since thum.io needs to access a publicly available URL
  const baseUrl = 'https://tsmcalister.github.io/svgkt-monorepo';
  
  const targetUrl = `${baseUrl}/generator-thumbnail/${generatorId}?cb=${CACHE_BUSTER}`;
  
  return `https://image.thum.io/get/image/fit/${width}x${height}/https://image.thum.io/get/wait/20/width/1200/crop/1200/viewportWidth/1200/noanimate/allowJPG/${targetUrl}`;
}

/**
 * Generate a thum.io prefetch URL for a token
 * @param {number} tokenId - The token ID
 * @param {number} width - Thumbnail width (default: 400)
 * @param {number} height - Thumbnail height (default: 400)
 * @returns {string} The thum.io prefetch URL
 */
export function getTokenThumbnailPrefetchUrl(tokenId, width = 400, height = 400) {
  // Always use the remote URL since thum.io needs to access a publicly available URL
  const baseUrl = 'https://tsmcalister.github.io/svgkt-monorepo';
  
  const targetUrl = `${baseUrl}/thumbnail/${tokenId}?cb=${CACHE_BUSTER}`;
  
  return `https://image.thum.io/get/prefetch/image/fit/${width}x${height}/https://image.thum.io/get/wait/20/width/1200/crop/1200/viewportWidth/1200/noanimate/allowJPG/${targetUrl}`;
}

/**
 * Generate a thum.io prefetch URL for a generator
 * @param {number} generatorId - The generator ID
 * @param {number} width - Thumbnail width (default: 400)
 * @param {number} height - Thumbnail height (default: 400)
 * @returns {string} The thum.io prefetch URL
 */
export function getGeneratorThumbnailPrefetchUrl(generatorId, width = 400, height = 400) {
  // Always use the remote URL since thum.io needs to access a publicly available URL
  const baseUrl = 'https://tsmcalister.github.io/svgkt-monorepo';
  
  const targetUrl = `${baseUrl}/generator-thumbnail/${generatorId}?cb=${CACHE_BUSTER}`;
  
  return `https://image.thum.io/get/prefetch/image/fit/${width}x${height}/https://image.thum.io/get/wait/20/width/1200/crop/1200/viewportWidth/1200/noanimate/allowJPG/${targetUrl}`;
}

/**
 * Call prefetch for a token thumbnail to queue image generation
 * @param {number} tokenId - The token ID
 * @param {number} width - Thumbnail width (default: 400)
 * @param {number} height - Thumbnail height (default: 400)
 * @returns {Promise<boolean>} Success status
 */
export async function prefetchTokenThumbnail(tokenId, width = 400, height = 400) {
  try {
    const prefetchUrl = getTokenThumbnailPrefetchUrl(tokenId, width, height);
    const response = await fetch(prefetchUrl);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`Token ${tokenId} thumbnail prefetch:`, text);
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
 * Call prefetch for a generator thumbnail to queue image generation
 * @param {number} generatorId - The generator ID
 * @param {number} width - Thumbnail width (default: 400)
 * @param {number} height - Thumbnail height (default: 400)
 * @returns {Promise<boolean>} Success status
 */
export async function prefetchGeneratorThumbnail(generatorId, width = 400, height = 400) {
  try {
    const prefetchUrl = getGeneratorThumbnailPrefetchUrl(generatorId, width, height);
    const response = await fetch(prefetchUrl);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`Generator ${generatorId} thumbnail prefetch:`, text);
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
