/**
 * XML/HTML character escaping utilities using xml-escape library
 */
import xmlEscape from 'xml-escape';

/**
 * Escape JavaScript code for embedding in SVG script tags
 * This handles both XML escaping and ensures the code is safe for data URIs
 * @param {string} code - JavaScript code to escape
 * @returns {string} - Escaped code
 */
export function escapeJavaScriptForSvg(code) {
  if (typeof code !== 'string') return code;
  
  // First escape XML characters using the library
  let escaped = xmlEscape(code);
  
  // Additional escaping for data URIs - encode problematic characters
  escaped = escaped.replace(/#/g, '%23'); // Hash symbol
  escaped = escaped.replace(/\n/g, '%0A'); // Newlines
  escaped = escaped.replace(/\r/g, '%0D'); // Carriage returns
  
  return escaped;
}

/**
 * Unescape JavaScript code from SVG script tags
 * @param {string} code - Escaped JavaScript code
 * @returns {string} - Unescaped code
 */
export function unescapeJavaScriptFromSvg(code) {
  if (typeof code !== 'string') return code;
  
  // First unescape data URI encoding
  let unescaped = code.replace(/%23/g, '#'); // Hash symbol
  unescaped = unescaped.replace(/%0A/g, '\n'); // Newlines
  unescaped = unescaped.replace(/%0D/g, '\r'); // Carriage returns
  
  // Then unescape XML characters - we'll need to implement this manually
  // since xml-escape doesn't provide an unescape function
  const XML_UNESCAPE_MAP = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'" // Alternative apostrophe encoding
  };
  
  return unescaped.replace(/&(?:amp|lt|gt|quot|#39|apos);/g, (match) => XML_UNESCAPE_MAP[match]);
}

// Re-export the main escape function for convenience
export { xmlEscape as escapeXml };
