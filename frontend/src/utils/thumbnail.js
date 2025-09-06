// Utility functions for generating thumbnail URLs using thum.io

/**
 * Generate a thum.io thumbnail URL for a token
 * @param {number} tokenId - The token ID
 * @param {number} width - Thumbnail width (default: 400)
 * @param {number} height - Thumbnail height (default: 400)
 * @returns {string} The thum.io URL
 */
export function getTokenThumbnailUrl(tokenId, width = 400, height = 400) {
  const baseUrl = import.meta.env.PROD 
    ? 'https://tsmcalister.github.io/svgkt-monorepo' 
    : 'http://localhost:3000';
  
  const targetUrl = `${baseUrl}/thumbnail/${tokenId}`;
  
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
  const baseUrl = import.meta.env.PROD 
    ? 'https://tsmcalister.github.io/svgkt-monorepo' 
    : 'http://localhost:3000';
  
  const targetUrl = `${baseUrl}/generator-thumbnail/${generatorId}`;
  
  return `https://image.thum.io/get/image/fit/${width}x${height}/https://image.thum.io/get/wait/20/width/1200/crop/1200/viewportWidth/1200/noanimate/allowJPG/${targetUrl}`;
}
