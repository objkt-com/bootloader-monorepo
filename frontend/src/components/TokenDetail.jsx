import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Maximize2, X, ExternalLink, RefreshCw, Download, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { tezosService } from '../services/tezos.js';
import { tzktService } from '../services/tzkt.js';
import { getNetworkConfig, getContractAddress } from '../config.js';
import { getUserDisplayInfo, formatAddress } from '../utils/userDisplay.js';
import { useMetaTags, generateMetaTags } from '../hooks/useMetaTags.js';
import { fixSeedEncoding } from './ThumbnailRenderer.jsx';
import SmartThumbnail from './SmartThumbnail.jsx';
import { useIframeRef } from '../utils/iframe.js';
import './TokenDetail.css';

const DEFAULT_DOWNLOAD_RESOLUTION = 1024;
const MIN_DOWNLOAD_RESOLUTION = 64;
const MAX_DOWNLOAD_RESOLUTION = 16384;
const SUPPORTED_DOWNLOAD_FORMATS = [
  { value: 'svg', label: 'SVG (vector)' },
  { value: 'png', label: 'PNG (raster)' },
  { value: 'jpg', label: 'JPG (raster)' },
];
const DEFAULT_CAPTURE_DELAY_S = 3;
const DEFAULT_CAPTURE_DELAY_MS = DEFAULT_CAPTURE_DELAY_S * 1000;
const MAX_CAPTURE_DELAY_S = 120;
const MAX_CAPTURE_DELAY_MS = MAX_CAPTURE_DELAY_S * 1000;

function readExportConfigNumber(value, fallback, { min = 0 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= min) {
    return parsed;
  }
  return fallback;
}

function resolveExportCaptureConfig() {
  const globalConfig = typeof window !== 'undefined' ? window.__BOOTLOADER_EXPORT_CONFIG__ : null;
  const envDelay = typeof window !== 'undefined'
    ? (globalConfig?.renderDelayMs ?? window.__BOOTLOADER_EXPORT_RENDER_DELAY_MS)
    : null;
  const envTimeout = typeof window !== 'undefined'
    ? (globalConfig?.timeoutMs ?? window.__BOOTLOADER_EXPORT_TIMEOUT_MS)
    : null;

  const delayFromEnv = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_EXPORT_RENDER_DELAY_MS ?? null)
    : null;
  const timeoutFromEnv = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_EXPORT_TIMEOUT_MS ?? null)
    : null;

  const renderDelayMsCandidate = readExportConfigNumber(
    envDelay ?? delayFromEnv,
    DEFAULT_CAPTURE_DELAY_MS,
  );
  const renderDelayMs = Math.min(
    Math.max(renderDelayMsCandidate, 0),
    MAX_CAPTURE_DELAY_MS,
  );

  const timeoutDefault = renderDelayMs + 2000;
  const timeoutMsRaw = readExportConfigNumber(
    envTimeout ?? timeoutFromEnv,
    timeoutDefault,
    { min: 1 },
  );
  const timeoutMs = Math.max(timeoutMsRaw, renderDelayMs + 2000);

  return {
    renderDelayMs,
    timeoutMs,
  };
}

const EXPORT_CAPTURE_CONFIG = resolveExportCaptureConfig();
const STATIC_CAPTURE_BASE_DELAY_MS = 200;
const STATIC_CAPTURE_RENDER_DELAY_MS = EXPORT_CAPTURE_CONFIG.renderDelayMs;
const STATIC_CAPTURE_TIMEOUT_MS = EXPORT_CAPTURE_CONFIG.timeoutMs;
const RASTERIZATION_DELAY_MS = 120;
const RASTERIZATION_ATTEMPTS = 2;

function decodeSvgDataUri(dataUri) {
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:image/svg+xml')) {
    return null;
  }

  const commaIndex = dataUri.indexOf(',');
  if (commaIndex === -1) {
    return null;
  }

  const metadata = dataUri.slice(0, commaIndex);
  const payload = dataUri.slice(commaIndex + 1);

  try {
    if (metadata.includes(';base64')) {
      return typeof atob === 'function' ? atob(payload) : null;
    }

    return decodeURIComponent(payload);
  } catch (error) {
    console.warn('Failed to decode SVG data URI:', error);
    return null;
  }
}

function isSvgDataUri(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return value.trimStart().toLowerCase().startsWith('data:image/svg+xml');
}

async function resolveSvgContent(source) {
  const inlineSvg = decodeSvgDataUri(source);
  if (inlineSvg !== null) {
    return inlineSvg;
  }

  const response = await fetch(source, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Failed to fetch SVG source (${response.status})`);
  }

  return await response.text();
}

function parseDimension(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = parseFloat(String(value).replace(/[^0-9.\-eE]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function extractSvgMetrics(svgText) {
  try {
    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = documentFragment.documentElement;

    if (!svgElement || svgElement.nodeName.toLowerCase() !== 'svg') {
      return null;
    }

    let width = parseDimension(svgElement.getAttribute('width'));
    let height = parseDimension(svgElement.getAttribute('height'));
    const viewBox = svgElement.getAttribute('viewBox');

    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map((part) => parseFloat(part));
      if (parts.length === 4) {
        const [, , vbWidth, vbHeight] = parts;
        if (!Number.isNaN(vbWidth) && vbWidth > 0 && (!width || width <= 0)) {
          width = vbWidth;
        }
        if (!Number.isNaN(vbHeight) && vbHeight > 0 && (!height || height <= 0)) {
          height = vbHeight;
        }
      }
    }

    if ((!height || height <= 0) && width && width > 0) {
      height = width;
    }

    const aspect = width && height ? height / width : 1;

    return {
      width: width && width > 0 ? width : DEFAULT_DOWNLOAD_RESOLUTION,
      height: height && height > 0 ? height : width && width > 0 ? width : DEFAULT_DOWNLOAD_RESOLUTION,
      aspect: aspect > 0 ? aspect : 1,
      viewBox,
    };
  } catch (error) {
    console.warn('Failed to extract SVG metadata:', error);
    return null;
  }
}

function applyResolutionToSvg(svgText, requestedWidth, requestedHeight, metadata) {
  if (!svgText) {
    return null;
  }

  try {
    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = documentFragment.documentElement;

    if (!svgElement || svgElement.nodeName.toLowerCase() !== 'svg') {
      return svgText;
    }

    const baseMetadata = metadata || extractSvgMetrics(svgText) || {
      width: DEFAULT_DOWNLOAD_RESOLUTION,
      height: DEFAULT_DOWNLOAD_RESOLUTION,
      aspect: 1,
      viewBox: null,
    };

    let widthValue = Number.parseInt(requestedWidth, 10);
    if (!Number.isFinite(widthValue) || widthValue <= 0) {
      widthValue = baseMetadata.width || DEFAULT_DOWNLOAD_RESOLUTION;
    }

    let heightValue = Number.parseInt(requestedHeight, 10);
    if (!Number.isFinite(heightValue) || heightValue <= 0) {
      const aspect = baseMetadata.aspect && Number.isFinite(baseMetadata.aspect) && baseMetadata.aspect > 0
        ? baseMetadata.aspect
        : 1;
      heightValue = Math.max(1, Math.round(widthValue * aspect));
    }

    svgElement.setAttribute('width', `${widthValue}`);
    svgElement.setAttribute('height', `${heightValue}`);

    return new XMLSerializer().serializeToString(svgElement);
  } catch (error) {
    console.warn('Failed to adjust SVG resolution:', error);
    return svgText;
  }
}

function formatDownloadFileName(name, tokenId, width, height, format) {
  const slug = (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  const baseName = slug || (tokenId !== undefined ? `token-${tokenId}` : 'token');
  const widthSuffix = width ? `${width}` : '';
  const heightSuffix = height ? `x${height}` : '';
  const dimensionSuffix = widthSuffix ? `-${widthSuffix}${heightSuffix}` : '';
  const extension = format || 'svg';
  return `${baseName}${dimensionSuffix}.${extension}`;
}

function removeDynamicContent(svgElement) {
  svgElement.querySelectorAll('script').forEach((node) => node.remove());
  return svgElement;
}

function normalizeSvgString(svgString) {
  try {
    let cleanedString = svgString;
    let firstDefaultNamespace = true;
    cleanedString = cleanedString.replace(/\s+xmlns="[^"]*"/g, (match) => {
      if (firstDefaultNamespace) {
        firstDefaultNamespace = false;
        return match;
      }
      return '';
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedString, 'image/svg+xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(parseError.textContent || 'SVG parse error');
    }

    const root = doc.documentElement;
    if (!root) {
      return svgString;
    }

    const seen = new Set();
    Array.from(root.attributes).forEach((attr) => {
      if (attr.name === 'xmlns') {
        if (seen.has(attr.name)) {
          root.removeAttribute(attr.name);
        } else {
          seen.add(attr.name);
        }
      }
    });

    return new XMLSerializer().serializeToString(root);
  } catch (error) {
    console.warn('Failed to normalise SVG markup:', error);
    return svgString;
  }
}

function serializeSanitizedSvg(svgElement) {
  const serialized = new XMLSerializer().serializeToString(svgElement);
  return ensureSvgXmlHeader(normalizeSvgString(serialized));
}

function normalizeHexColor(value) {
  if (typeof value !== 'string') {
    return null;
  }

  let trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.startsWith('#')) {
    trimmed = trimmed.slice(1);
  }

  const hex = trimmed.replace(/[^0-9a-fA-F]/g, '');
  if (hex.length === 3) {
    const expanded = hex.split('').map((char) => char + char).join('');
    return `#${expanded.toLowerCase()}`;
  }

  if (hex.length === 4) {
    const expanded = hex.slice(0, 3).split('').map((char) => char + char).join('');
    return `#${expanded.toLowerCase()}`;
  }

  if (hex.length === 6) {
    return `#${hex.toLowerCase()}`;
  }

  if (hex.length === 8) {
    return `#${hex.slice(0, 6).toLowerCase()}`;
  }

  return null;
}

function getViewBoxFromElement(element) {
  if (!element || typeof element.getAttribute !== 'function') {
    return null;
  }
  const raw = element.getAttribute('viewBox') || element.getAttribute('viewbox');
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createSvgBlobUrl(svgString) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  return URL.createObjectURL(blob);
}

function ensureViewBox(svgString, viewBox) {
  if (!viewBox) {
    return svgString;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = doc.documentElement;

    if (!svgElement || svgElement.nodeName.toLowerCase() !== 'svg') {
      return svgString;
    }

    if (!svgElement.hasAttribute('viewBox') && !svgElement.hasAttribute('viewbox')) {
      svgElement.setAttribute('viewBox', viewBox);
      return new XMLSerializer().serializeToString(svgElement);
    }

    return svgString;
  } catch (error) {
    console.warn('Failed to ensure viewBox:', error);
    return svgString;
  }
}

function ensureSvgXmlHeader(svgString) {
  const trimmed = svgString.trimStart();
  if (trimmed.startsWith('<?xml')) {
    return svgString;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`;
}

function captureSvgFromIframe(loadContent, {
  renderDelayMs = STATIC_CAPTURE_BASE_DELAY_MS,
  timeoutMs = STATIC_CAPTURE_TIMEOUT_MS,
} = {}) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

    const cleanup = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    let settled = false;
    let resourceCleanup = null;
    const settle = (value, isError) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      if (typeof resourceCleanup === 'function') {
        try {
          resourceCleanup();
        } catch {}
        resourceCleanup = null;
      }
      cleanup();
      if (isError) {
        reject(value);
      } else {
        resolve(value);
      }
    };

    const timeoutId = window.setTimeout(() => {
      settle(new Error('Timed out while preparing static SVG export'), true);
    }, timeoutMs);

    iframe.addEventListener('load', () => {
      window.setTimeout(() => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document || null;
          if (!doc) {
            throw new Error('Unable to access SVG document');
          }

          const snapshot = extractSnapshotFromDocument(doc);

          settle(snapshot, false);
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          settle(normalizedError, true);
        }
      }, renderDelayMs);
    }, { once: true });

    iframe.addEventListener('error', () => {
      settle(new Error('Failed to load SVG content'), true);
    }, { once: true });

    document.body.appendChild(iframe);

    try {
      resourceCleanup = loadContent(iframe) || null;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      settle(normalizedError, true);
    }
  });
}

function extractSnapshotFromDocument(doc) {
  const svgElement = doc.querySelector('svg') || doc.documentElement;
  if (!svgElement || svgElement.tagName.toLowerCase() !== 'svg') {
    throw new Error('SVG root element not found');
  }

  const clone = svgElement.cloneNode(true);

  const transferableSelector = [
    'defs', 'style', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline',
    'polygon', 'text', 'use', 'image', 'pattern', 'mask', 'clipPath', 'linearGradient',
    'radialGradient', 'symbol', 'filter', 'foreignObject',
  ].join(',');

  const extraNodes = Array.from(doc.querySelectorAll(transferableSelector))
    .filter((node) => node !== svgElement
      && node.namespaceURI === 'http://www.w3.org/2000/svg'
      && node.closest('svg') !== svgElement);

  extraNodes.forEach((node) => {
    clone.appendChild(node.cloneNode(true));
  });

  const sanitized = removeDynamicContent(clone);
  const serialized = serializeSanitizedSvg(sanitized);
  const viewBox = getViewBoxFromElement(svgElement) || getViewBoxFromElement(doc.documentElement);

  return { serialized, viewBox };
}

async function createStaticSvgSnapshot({
  originalMarkup,
  dataUriSource,
  targetWidth,
  targetHeight,
  metadata,
  existingDocument = null,
}, captureDelayMs = STATIC_CAPTURE_RENDER_DELAY_MS, { resize = true } = {}) {
  let capturedViewBox = metadata?.viewBox || null;
  const captureTimeoutMs = Math.max(captureDelayMs + 2000, 5000);

  const applyFinalize = (snapshot) => {
    if (!snapshot || typeof snapshot.serialized !== 'string') {
      throw new Error('Invalid SVG snapshot');
    }

    if (snapshot.viewBox) {
      capturedViewBox = snapshot.viewBox;
    }

    const baseMarkup = ensureSvgXmlHeader(normalizeSvgString(snapshot.serialized));
    const sized = resize
      ? applyResolutionToSvg(baseMarkup, targetWidth, targetHeight, metadata) || baseMarkup
      : baseMarkup;
    const withViewBox = ensureViewBox(sized, capturedViewBox);
    return normalizeSvgString(withViewBox);
  };

  if (existingDocument?.documentElement) {
    try {
      const snapshot = extractSnapshotFromDocument(existingDocument);
      return applyFinalize(snapshot);
    } catch (error) {
      console.warn('Failed to snapshot from rendered iframe:', error);
    }
  }

  const inlineMarkup = isSvgDataUri(dataUriSource) ? decodeSvgDataUri(dataUriSource) : null;
  if (inlineMarkup) {
    try {
      const blobUrl = createSvgBlobUrl(inlineMarkup);
      const snapshot = await captureSvgFromIframe((iframe) => {
        iframe.src = blobUrl;
        return () => URL.revokeObjectURL(blobUrl);
      }, {
        renderDelayMs: captureDelayMs,
        timeoutMs: captureTimeoutMs,
      });
      return applyFinalize(snapshot);
    } catch (error) {
      console.warn('Failed to snapshot from data URI iframe:', error);
    }
  }

  if (originalMarkup) {
    try {
      const blobUrl = createSvgBlobUrl(originalMarkup);
      const snapshot = await captureSvgFromIframe((iframe) => {
        iframe.src = blobUrl;
        return () => URL.revokeObjectURL(blobUrl);
      }, {
        renderDelayMs: captureDelayMs,
        timeoutMs: captureTimeoutMs,
      });
      return applyFinalize(snapshot);
    } catch (error) {
      console.warn('Failed to snapshot SVG markup in iframe:', error);
    }
  }
  const fallbackMarkup = originalMarkup || inlineMarkup;
  if (!fallbackMarkup) {
    throw new Error('No SVG markup available for export');
  }
  try {
    const parsedDoc = new DOMParser().parseFromString(fallbackMarkup, 'image/svg+xml');
    const snapshot = extractSnapshotFromDocument(parsedDoc);
    return applyFinalize(snapshot);
  } catch (error) {
    console.warn('Failed to parse SVG markup directly:', error);
  }

  const ensuredMarkup = ensureSvgXmlHeader(normalizeSvgString(fallbackMarkup));
  return applyFinalize({ serialized: ensuredMarkup, viewBox: capturedViewBox });
}

function triggerFileDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function svgStringToDataUrl(svgString) {
  const ensured = ensureSvgXmlHeader(normalizeSvgString(svgString));
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ensured)}`;
}

async function rasterizeSvg(preparedSvg, width, height, { format = 'png', background = null } = {}) {
  const attempts = [preparedSvg];

  let lastError = null;
  const normalizedBackground = normalizeHexColor(background || '') || null;
  const isJpeg = format === 'jpg' || format === 'jpeg';
  const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
  const jpegQuality = 0.92;

  for (let i = 0; i < attempts.length; i += 1) {
    const candidate = attempts[i];

    try {
      const normalizedCandidate = ensureSvgXmlHeader(normalizeSvgString(candidate));
      const blob = new Blob([normalizedCandidate], { type: 'image/svg+xml;charset=utf-8' });

      if (typeof window.createImageBitmap === 'function') {
        try {
          const bitmap = await window.createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('Canvas context unavailable');
          }

          if (normalizedBackground) {
            context.fillStyle = normalizedBackground;
            context.fillRect(0, 0, width, height);
          } else {
            context.clearRect(0, 0, width, height);
          }
          context.drawImage(bitmap, 0, 0, width, height);

          if (typeof bitmap.close === 'function') {
            bitmap.close();
          }

          const rasterBlob = await new Promise((resolve, reject) => {
            canvas.toBlob((result) => {
              if (result) {
                resolve(result);
              } else {
                reject(new Error('Failed to create raster blob'));
              }
            }, mimeType, isJpeg ? jpegQuality : undefined);
          });

          return rasterBlob;
        } catch (bitmapError) {
          lastError = bitmapError instanceof Error ? bitmapError : new Error(String(bitmapError));
        }
      }

      const dataUrl = svgStringToDataUrl(normalizedCandidate);
      const needsRevoke = dataUrl.startsWith('blob:');

      const rasterBlob = await new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';

        let blobUrl = null;
        let triedDataUrl = false;
        let fallbackDataUrl = null;

        const cleanup = () => {
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            blobUrl = null;
          }
          image.src = '';
        };

        const drawToCanvas = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (!context) {
              cleanup();
              reject(new Error('Canvas context unavailable'));
              return;
            }

            const finalizeRasterization = () => {
              if (normalizedBackground) {
                context.fillStyle = normalizedBackground;
                context.fillRect(0, 0, width, height);
              } else {
                context.clearRect(0, 0, width, height);
              }
              context.drawImage(image, 0, 0, width, height);

              canvas.toBlob((result) => {
                cleanup();
                if (result) {
                  resolve(result);
                } else {
                  reject(new Error('Failed to create raster blob'));
                }
              }, mimeType, isJpeg ? jpegQuality : undefined);
            };

            if (RASTERIZATION_DELAY_MS > 0) {
              setTimeout(finalizeRasterization, RASTERIZATION_DELAY_MS);
            } else {
              finalizeRasterization();
            }
          } catch (error) {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        };

        image.onload = () => {
          drawToCanvas();
        };

        image.onerror = (error) => {
          if (!triedDataUrl) {
            triedDataUrl = true;
            try {
              if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
                blobUrl = null;
              }
              fallbackDataUrl = svgStringToDataUrl(normalizedCandidate);
              image.src = fallbackDataUrl;
              return;
            } catch (conversionError) {
              lastError = conversionError instanceof Error ? conversionError : new Error(String(conversionError));
            }
          }

          cleanup();
          reject(error instanceof Error ? error : new Error('Failed to load SVG image for rasterization'));
        };

        try {
          blobUrl = URL.createObjectURL(blob);
          image.src = blobUrl;
        } catch (err) {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      return rasterBlob;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('Failed to rasterize SVG. The SVG may reference external resources that block conversion.');
}

export default function TokenDetail() {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [generator, setGenerator] = useState(null);
  const [tokenExtra, setTokenExtra] = useState(null);
  const [artistDisplayInfo, setArtistDisplayInfo] = useState({ displayName: '', profile: null });
  const [ownerDisplayInfo, setOwnerDisplayInfo] = useState({ displayName: '', profile: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [userAddress, setUserAddress] = useState(null);
  const [bootloaderInfo, setBootloaderInfo] = useState(null);
  const [svgSource, setSvgSource] = useState(null);
  const [svgMetadata, setSvgMetadata] = useState(null);
  const [downloadWidthInput, setDownloadWidthInput] = useState(String(DEFAULT_DOWNLOAD_RESOLUTION));
  const [downloadHeightInput, setDownloadHeightInput] = useState(String(DEFAULT_DOWNLOAD_RESOLUTION));
  const [downloadFormat, setDownloadFormat] = useState('svg');
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [captureDelayInput, setCaptureDelayInput] = useState(String(Math.round(STATIC_CAPTURE_RENDER_DELAY_MS / 1000)));
  const [jpgBackgroundInput, setJpgBackgroundInput] = useState('#ffffff');
  const [preparingCountdown, setPreparingCountdown] = useState(0);
  const [showExportWarning, setShowExportWarning] = useState(false);
  const abortControllerRef = useRef(null);
  const artifactIframeRef = useRef(null);
  const hasUserAdjustedDimensionsRef = useRef(false);
  const countdownIntervalRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const previewBlobUrlRef = useRef(null);
  const originalIframeSrcRef = useRef(null);

  const baseArtifactIframeRef = useMemo(() => useIframeRef(token?.artifactUri), [token?.artifactUri]);
  const artifactIframeCallback = useMemo(() => (iframe) => {
    artifactIframeRef.current = iframe;
    if (typeof baseArtifactIframeRef === 'function') {
      baseArtifactIframeRef(iframe);
    }
  }, [baseArtifactIframeRef]);
  const fullscreenIframeRef = useMemo(() => useIframeRef(token?.artifactUri), [token?.artifactUri]);

  const effectiveWidth = useMemo(() => {
    const parsed = Number.parseInt(downloadWidthInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return svgMetadata?.width ? Math.round(svgMetadata.width) : DEFAULT_DOWNLOAD_RESOLUTION;
    }

    return Math.min(
      MAX_DOWNLOAD_RESOLUTION,
      Math.max(MIN_DOWNLOAD_RESOLUTION, parsed),
    );
  }, [downloadWidthInput, svgMetadata]);

  const effectiveHeight = useMemo(() => {
    const parsed = Number.parseInt(downloadHeightInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      const aspect = svgMetadata?.aspect && Number.isFinite(svgMetadata.aspect) && svgMetadata.aspect > 0
        ? svgMetadata.aspect
        : 1;
      return Math.max(1, Math.round(effectiveWidth * aspect));
    }

    return Math.min(
      MAX_DOWNLOAD_RESOLUTION,
      Math.max(MIN_DOWNLOAD_RESOLUTION, parsed),
    );
  }, [downloadHeightInput, svgMetadata, effectiveWidth]);

  const effectiveCaptureDelayMs = useMemo(() => {
    const parsedSeconds = Number.parseFloat(captureDelayInput);
    if (!Number.isFinite(parsedSeconds) || parsedSeconds < 0) {
      return DEFAULT_CAPTURE_DELAY_MS;
    }
    const clampedSeconds = Math.min(parsedSeconds, MAX_CAPTURE_DELAY_S);
    return Math.round(clampedSeconds * 1000);
  }, [captureDelayInput]);

  const normalizedJpgBackground = useMemo(() => normalizeHexColor(jpgBackgroundInput) || '#ffffff', [jpgBackgroundInput]);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    loadTokenData(abortControllerRef.current.signal);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [tokenId]);

  useEffect(() => {
    const initializeTezos = async () => {
      await tezosService.initialize();
      setUserAddress(tezosService.userAddress);
    };

    initializeTezos();

    tezosService.setAccountChangeCallback((address) => {
      setUserAddress(address);
    });
  }, []);

  useEffect(() => () => {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (warningTimeoutRef.current) {
      window.clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const prepareSvgForDownload = async () => {
      if (!token?.artifactUri) {
        if (!cancelled) {
          setSvgSource(null);
          setSvgMetadata(null);
          if (!hasUserAdjustedDimensionsRef.current) {
            setDownloadWidthInput(String(DEFAULT_DOWNLOAD_RESOLUTION));
            setDownloadHeightInput(String(DEFAULT_DOWNLOAD_RESOLUTION));
            setDownloadFormat('svg');
          }
        }
        return;
      }

      try {
        const svgText = await resolveSvgContent(token.artifactUri);
        if (cancelled) {
          return;
        }

        setSvgSource(svgText);
        const metadata = extractSvgMetrics(svgText);
        setSvgMetadata(metadata);
        originalIframeSrcRef.current = token.artifactUri;

        if (!hasUserAdjustedDimensionsRef.current) {
          const nextWidth = metadata?.width && metadata.width > 0
            ? Math.round(metadata.width)
            : DEFAULT_DOWNLOAD_RESOLUTION;
          const nextHeight = metadata?.height && metadata.height > 0
            ? Math.round(metadata.height)
            : nextWidth;
          setDownloadWidthInput(String(nextWidth));
          setDownloadHeightInput(String(nextHeight));
          setDownloadFormat('svg');
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.warn('Failed to prepare SVG for download:', err);
        setSvgSource(null);
        setSvgMetadata(null);
        if (!hasUserAdjustedDimensionsRef.current) {
          setDownloadWidthInput(String(DEFAULT_DOWNLOAD_RESOLUTION));
          setDownloadHeightInput(String(DEFAULT_DOWNLOAD_RESOLUTION));
          setDownloadFormat('svg');
        }
      }
    };

    hasUserAdjustedDimensionsRef.current = false;
    setDownloadError(null);
    prepareSvgForDownload();

    return () => {
      cancelled = true;
    };
  }, [token?.artifactUri]);

  useEffect(() => {
    if (!showDownloadOptions) {
      hideWarningTooltip();
    }
  }, [showDownloadOptions]);

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && showFullscreen) {
        setShowFullscreen(false);
      }
    };

    if (showFullscreen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [showFullscreen]);

  const loadTokenData = async (signal) => {
    try {
      setLoading(true);
      setError(null);

      if (signal?.aborted) {
        return;
      }

      let tokenData = null;

      try {
        const tokenMetadataBigMap = await tzktService.getBigMapByPath("token_metadata");
        const ledgerBigMap = await tzktService.getBigMapByPath("ledger");
        
        if (tokenMetadataBigMap && ledgerBigMap) {
          const tokenMetadata = await tzktService.getBigMapKey(
            tokenMetadataBigMap.ptr,
            tokenId.toString()
          );
          const tokenOwner = await tzktService.getBigMapKey(
            ledgerBigMap.ptr,
            tokenId.toString()
          );

          if (tokenMetadata && tokenOwner) {
            const tokenInfo = tokenMetadata.value.token_info;
            
            const creationTimestamp = await tzktService.getBigMapKeyCreationTime(
              tokenMetadataBigMap.ptr,
              tokenId.toString()
            );

            const correctedArtifactUriBytes = fixSeedEncoding(tokenInfo.artifactUri);
            
            tokenData = {
              token_id: tokenId.toString(),
              name: tzktService.bytesToString(tokenInfo.name),
              artifact_uri: tzktService.bytesToString(correctedArtifactUriBytes),
              display_uri: tokenInfo.displayUri ? tzktService.bytesToString(tokenInfo.displayUri) : null,
              thumbnail_uri: tokenInfo.thumbnailUri ? tzktService.bytesToString(tokenInfo.thumbnailUri) : null,
              mime: tokenInfo.mime ? tzktService.bytesToString(tokenInfo.mime) : null,
              supply: "1",
              timestamp: creationTimestamp,
              creators: [],
              holders: [{
                holder_address: tokenOwner.value,
                quantity: "1"
              }],
              metadata: null
            };
          }
        }
      } catch (tzktError) {
        console.error('Failed to get token from tzkt:', tzktError);
      }
      
      if (signal?.aborted) {
        return;
      }
      
      if (!tokenData) {
        setError('Token not found');
        return;
      }

      const transformedToken = {
        tokenId: parseInt(tokenData.token_id),
        pk: tokenData.pk,
        name: tokenData.name || `Token #${tokenData.token_id}`,
        description: tokenData.description,
        artifactUri: tokenData.artifact_uri,
        displayUri: tokenData.display_uri,
        thumbnailUri: tokenData.thumbnail_uri,
        mime: tokenData.mime,
        supply: parseInt(tokenData.supply || 1),
        timestamp: tokenData.timestamp,
        creators: tokenData.creators || [],
        holders: tokenData.holders || [],
        metadata: tokenData.metadata
      };

      if (signal?.aborted) {
        return;
      }

      setToken(transformedToken);

      const currentOwner = transformedToken.holders.reduce((max, holder) => 
        parseFloat(holder.quantity) > parseFloat(max.quantity || 0) ? holder : max, 
        { holder_address: 'unknown', quantity: '0' }
      );

      try {
        const generatorInfo = await getGeneratorFromToken(transformedToken, signal);
        if (signal?.aborted) {
          return;
        }
        
        setGenerator(generatorInfo);

        if (generatorInfo && transformedToken.creators.length === 0) {
          transformedToken.creators = [{
            creator_address: generatorInfo.author,
            verified: false
          }];
          setToken(transformedToken);
        }
      } catch (err) {
        if (!signal?.aborted) {
          console.warn('Could not load generator info:', err);
        }
      }

      if (transformedToken.creators.length > 0) {
        const artistAddress = transformedToken.creators[0].creator_address;
        const artistInfo = await getUserDisplayInfo(artistAddress);
        if (signal?.aborted) {
          return;
        }
        
        setArtistDisplayInfo(artistInfo);
      }

      if (currentOwner.holder_address !== 'unknown') {
        const ownerInfo = await getUserDisplayInfo(currentOwner.holder_address);
        if (signal?.aborted) {
          return;
        }
        
        setOwnerDisplayInfo(ownerInfo);
      }

    } catch (err) {
      if (!signal?.aborted) {
        console.error('Failed to load token data:', err);
        setError('Failed to load token data');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const loadBootloaderInfo = async (bootloaderId) => {
    try {
      const bootloader = await tzktService.getBootloader(bootloaderId);
      setBootloaderInfo(bootloader);
    } catch (err) {
      console.error('Failed to load bootloader info:', err);
      setBootloaderInfo(null);
    }
  };

  const handleToggleDownloadOptions = () => {
    setShowDownloadOptions((prev) => !prev);
    setDownloadError(null);
  };

  const handleWidthInputChange = (event) => {
    hasUserAdjustedDimensionsRef.current = true;
    setDownloadError(null);
    setDownloadWidthInput(event.target.value);
  };

  const handleHeightInputChange = (event) => {
    hasUserAdjustedDimensionsRef.current = true;
    setDownloadError(null);
    setDownloadHeightInput(event.target.value);
  };

  const clampDownloadDimension = (currentValue, fallbackValue) => {
    const parsed = Number.parseInt(currentValue, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return String(fallbackValue);
    }

    const clamped = Math.min(
      MAX_DOWNLOAD_RESOLUTION,
      Math.max(MIN_DOWNLOAD_RESOLUTION, parsed),
    );
    return String(clamped);
  };

  const handleWidthInputBlur = () => {
    const fallback = svgMetadata?.width && svgMetadata.width > 0
      ? Math.round(svgMetadata.width)
      : DEFAULT_DOWNLOAD_RESOLUTION;
    setDownloadWidthInput((current) => clampDownloadDimension(current, fallback));
  };

  const handleHeightInputBlur = () => {
    const fallback = svgMetadata?.height && svgMetadata.height > 0
      ? Math.round(svgMetadata.height)
      : svgMetadata?.width && svgMetadata.width > 0
        ? Math.round(svgMetadata.width)
        : DEFAULT_DOWNLOAD_RESOLUTION;
    setDownloadHeightInput((current) => clampDownloadDimension(current, fallback));
  };

  const handleFormatChange = (event) => {
    setDownloadError(null);
    setDownloadFormat(event.target.value);
  };

  const showWarningTooltip = () => {
    if (warningTimeoutRef.current) {
      window.clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    warningTimeoutRef.current = window.setTimeout(() => {
      setShowExportWarning(true);
    }, 50);
  };

  const hideWarningTooltip = () => {
    if (warningTimeoutRef.current) {
      window.clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    setShowExportWarning(false);
  };

  const handleDownloadAsset = async () => {
    if (!token?.artifactUri || isPreparingDownload) {
      return;
    }

    const shouldResizeSvg = downloadFormat !== 'svg';
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    const countdownSeconds = Math.max(0, Math.ceil(effectiveCaptureDelayMs / 1000));
    if (countdownSeconds > 0) {
      setPreparingCountdown(countdownSeconds);
      countdownIntervalRef.current = window.setInterval(() => {
        setPreparingCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              window.clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setPreparingCountdown(0);
    }

    setDownloadError(null);
    setIsPreparingDownload(true);

    try {
      let svgText = svgSource;
      if (!svgText) {
        svgText = await resolveSvgContent(token.artifactUri);
      }

      if (!svgText) {
        throw new Error('SVG content unavailable');
      }

      if (artifactIframeRef.current) {
        if (!originalIframeSrcRef.current) {
          originalIframeSrcRef.current = artifactIframeRef.current.src || token.artifactUri;
        }
        if (previewBlobUrlRef.current) {
          URL.revokeObjectURL(previewBlobUrlRef.current);
          previewBlobUrlRef.current = null;
        }
        const previewBlobUrl = createSvgBlobUrl(svgText);
        previewBlobUrlRef.current = previewBlobUrl;
        artifactIframeRef.current.removeAttribute('srcdoc');
        artifactIframeRef.current.src = previewBlobUrl;
      }
      setSvgSource(svgText);

      let staticSvg;
      try {
        staticSvg = await createStaticSvgSnapshot({
          originalMarkup: svgText,
          dataUriSource: token.artifactUri,
          targetWidth: effectiveWidth,
          targetHeight: effectiveHeight,
          metadata: svgMetadata,
          existingDocument: artifactIframeRef.current?.contentDocument || null,
        }, effectiveCaptureDelayMs, { resize: shouldResizeSvg });
      } catch (snapshotError) {
        console.warn('Falling back to resized SVG markup:', snapshotError);
        try {
          const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
          const root = parsed.documentElement ? removeDynamicContent(parsed.documentElement) : null;
          const serialized = root ? serializeSanitizedSvg(root) : ensureSvgXmlHeader(svgText);
          const normalized = ensureSvgXmlHeader(normalizeSvgString(serialized));
          if (shouldResizeSvg) {
            const adjusted = applyResolutionToSvg(normalized, effectiveWidth, effectiveHeight, svgMetadata) || normalized;
            staticSvg = ensureSvgXmlHeader(normalizeSvgString(adjusted));
          } else {
            staticSvg = normalized;
          }
        } catch (fallbackError) {
          console.warn('Failed to sanitize fallback SVG, using original markup:', fallbackError);
          if (shouldResizeSvg) {
            const resized = applyResolutionToSvg(svgText, effectiveWidth, effectiveHeight, svgMetadata) || svgText;
            staticSvg = ensureSvgXmlHeader(normalizeSvgString(resized));
          } else {
            staticSvg = ensureSvgXmlHeader(normalizeSvgString(svgText));
          }
        }
      }

      if (!staticSvg) {
        throw new Error('Unable to prepare SVG for export');
      }


      const fileName = formatDownloadFileName(
        token.name,
        token.tokenId,
        shouldResizeSvg ? effectiveWidth : undefined,
        shouldResizeSvg ? effectiveHeight : undefined,
        downloadFormat,
      );

      if (downloadFormat === 'svg') {
        const blob = new Blob([staticSvg], { type: 'image/svg+xml;charset=utf-8' });
        triggerFileDownload(blob, fileName);
      } else if (downloadFormat === 'png' || downloadFormat === 'jpg') {
        const rasterOptions = {
          format: downloadFormat,
          background: downloadFormat === 'jpg' ? normalizedJpgBackground : null,
        };
        const blob = await rasterizeSvg(staticSvg, effectiveWidth, effectiveHeight, rasterOptions);
        triggerFileDownload(blob, fileName);
      } else {
        throw new Error(`Unsupported download format: ${downloadFormat}`);
      }

      hasUserAdjustedDimensionsRef.current = true;
    } catch (err) {
      console.error('Failed to export artwork:', err);
      setDownloadError('Failed to prepare download. Please try again.');
    } finally {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setPreparingCountdown(0);
      if (artifactIframeRef.current) {
        if (previewBlobUrlRef.current) {
          URL.revokeObjectURL(previewBlobUrlRef.current);
          previewBlobUrlRef.current = null;
        }
        artifactIframeRef.current.removeAttribute('srcdoc');
        artifactIframeRef.current.src = originalIframeSrcRef.current || token.artifactUri;
      }
      setIsPreparingDownload(false);
    }
  };

  const getGeneratorFromToken = async (token, signal) => {
    try {
      if (signal?.aborted) {
        return null;
      }

      const tokenExtraData = await tzktService.getTokenExtra(token.tokenId);
      
      if (signal?.aborted) {
        return null;
      }
      
      if (!tokenExtraData) {
        return null;
      }

      setTokenExtra(tokenExtraData);

      const generator = await tzktService.getGenerator(tokenExtraData.generatorId);
      
      if (signal?.aborted) {
        return null;
      }
      
      if (generator && generator.bootloaderId !== undefined && generator.bootloaderId !== null) {
        await loadBootloaderInfo(generator.bootloaderId);
      }
      
      return generator;
    } catch (err) {
      if (!signal?.aborted) {
        console.warn('Failed to get generator info from TzKT:', err);
      }
    }

    return null;
  };

  const handleUpdateVersion = async () => {
    if (!token || !userAddress || isUpdating) {
      return;
    }

    try {
      setIsUpdating(true);
      
      const result = await tezosService.regenerateToken(token.tokenId);
      
      if (result.success) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
        
        alert('Token version updated successfully! The page will refresh in a moment.');
      } else {
        alert(`Failed to update token version: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to update token version:', error);
      alert(`Failed to update token version: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const canUpdateVersion = () => {
    if (!token || !generator || !tokenExtra || !userAddress) {
      return false;
    }

    const owner = getCurrentOwner();
    const isOwner = userAddress.toLowerCase() === owner.address.toLowerCase();
    const hasNewerVersion = generator.version > tokenExtra.generatorVersion;
    const hasSeed = tokenExtra.seed !== null;

    return isOwner && hasNewerVersion && hasSeed;
  };

  const metaTags = token && artistDisplayInfo ? 
    generateMetaTags.token(token, artistDisplayInfo) : 
    null;
  useMetaTags(metaTags);

  const getObjktDomain = () => {
    const networkConfig = getNetworkConfig();
    return networkConfig.tzktApi.includes('ghostnet') ? 'ghostnet.objkt.com' : 'objkt.com';
  };

  const getTokenContractAddress = () => {
    return getContractAddress();
  };

  const getCurrentOwner = () => {
    if (!token || !token.holders || token.holders.length === 0) {
      return { address: 'unknown', displayName: 'Unknown' };
    }

    const currentOwner = token.holders.reduce((max, holder) => 
      parseFloat(holder.quantity) > parseFloat(max.quantity || 0) ? holder : max, 
      { holder_address: 'unknown', quantity: '0' }
    );

    return {
      address: currentOwner.holder_address,
      displayName: ownerDisplayInfo.displayName || formatAddress(currentOwner.holder_address)
    };
  };

  const getArtist = () => {
    if (!token || !token.creators || token.creators.length === 0) {
      return { address: 'unknown', displayName: 'Unknown Artist' };
    }

    const artist = token.creators[0];
    return {
      address: artist.creator_address,
      displayName: artistDisplayInfo.displayName || formatAddress(artist.creator_address)
    };
  };

  const formatMintDate = (timestamp) => {
    if (!timestamp) return null;
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (err) {
      console.warn('Failed to format mint date:', err);
      return null;
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading token...</div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="container">
        <div className="error">{error || 'Token not found'}</div>
        <button onClick={() => navigate('/')}>back to home</button>
      </div>
    );
  }

  const artist = getArtist();
  const owner = getCurrentOwner();

  return (
    <div className="token-detail-container">
      <div className="token-detail-layout">
        {/* Left side - Artwork */}
        <div className="token-artwork-container">
          <div className="token-artwork-wrapper">
            {token.artifactUri ? (
              <iframe
                ref={artifactIframeCallback}
                src={token.artifactUri}
                title={token.name}
                className="token-artwork-iframe"
                sandbox="allow-scripts allow-same-origin"
                allow="accelerometer; camera; gyroscope; microphone; xr-spatial-tracking; midi;"
              />
            ) : token.displayUri ? (
              <SmartThumbnail
                src={token.displayUri}
                width="100%"
                height="100%"
                alt={token.name}
                className="token-artwork-image"
              />
            ) : (
              <div className="token-artwork-placeholder">
                No artwork available
              </div>
            )}
            
            {/* Fullscreen button */}
            <button 
              className="token-fullscreen-btn"
              onClick={() => setShowFullscreen(true)}
              title="View fullscreen"
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>

        {/* Right side - Token info */}
        <div className="token-info-container">
          <div className="token-info-content">
            <div className="token-info-item">
              <span className="token-info-label">Artist:</span>
              <Link 
                to={`/profile/${artist.address}`}
                className="token-info-link"
              >
                {artist.displayName}
              </Link>
            </div>

            {generator && (
              <div className="token-info-item">
                <span className="token-info-label">Generator:</span>
                <Link 
                  to={`/generator/${generator.id}`}
                  className="token-info-link"
                >
                  {generator.name || `Generator #${generator.id}`}
                </Link>
              </div>
            )}

            {tokenExtra && generator && (
              <>
                <div className="token-info-item">
                  <span className="token-info-label">Generator Version:</span>
                  <span className={`token-info-value ${generator.version > tokenExtra.generatorVersion ? 'version-outdated' : ''}`}>
                    {tokenExtra.generatorVersion}
                    {generator.version > tokenExtra.generatorVersion && (
                      <span style={{ fontSize: '12px', marginLeft: '8px', color: '#ff6b35' }}>
                        (v{generator.version} available)
                      </span>
                    )}
                  </span>
                </div>
                
                {tokenExtra?.iterationNumber !== undefined && generator?.maxTokens !== undefined && (
                  <div className="token-info-item">
                    <span className="token-info-label">Iteration:</span>
                    <span className="token-info-value">
                      {tokenExtra.iterationNumber}/{generator.maxTokens}
                    </span>
                  </div>
                )}
                
                <div className="token-info-item">
                  <span className="token-info-label">Bootloader:</span>
                  <span className="token-info-value">
                    {bootloaderInfo?.version || '-'}
                  </span>
                </div>
              </>
            )}
            
            <div className="token-info-section">
              <div className="token-info-item">
                <span className="token-info-label">Minted:</span>
                <span className="token-info-value">
                  {token.timestamp ? formatMintDate(token.timestamp) : '-'}
                </span>
              </div>

              <div className="token-info-item">
                <span className="token-info-label">Owned by:</span>
                {owner.address !== 'unknown' ? (
                  <Link 
                    to={`/profile/${owner.address}`}
                    className="token-info-link"
                  >
                    {owner.displayName}
                  </Link>
                ) : (
                  <span className="token-info-value">-</span>
                )}
              </div>
            </div>

            <div className="token-actions">
              {canUpdateVersion() && (
                <button
                  onClick={handleUpdateVersion}
                  disabled={isUpdating}
                  className="btn token-update-btn"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw size={14} />
                      Updating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Update Version
                    </>
                  )}
                </button>
              )}
              {token.artifactUri && (
                <div className="token-download-group">
                  <button
                    type="button"
                    className="btn token-action-btn token-download-btn"
                    onClick={handleDownloadAsset}
                    disabled={isPreparingDownload}
                  >
                    <Download size={14} />
                    {isPreparingDownload
                      ? `Preparing…${preparingCountdown > 0 ? ` (${preparingCountdown}s)` : ''}`
                      : `Download ${downloadFormat.toUpperCase()}`}
                  </button>
                  {downloadError && (
                    <span className="token-download-error">{downloadError}</span>
                  )}
                  <div className="token-download-actions">
                    <button
                      type="button"
                      className="token-download-toggle"
                      onClick={handleToggleDownloadOptions}
                      aria-expanded={showDownloadOptions}
                    >
                      <SlidersHorizontal size={14} />
                      {showDownloadOptions ? 'hide export options' : 'export options'}
                    </button>
                    <button
                      type="button"
                      className="token-download-warning-icon"
                      aria-label="Export sandbox warning"
                      onMouseEnter={showWarningTooltip}
                      onMouseLeave={hideWarningTooltip}
                      onFocus={showWarningTooltip}
                      onBlur={hideWarningTooltip}
                      onClick={(event) => {
                        event.preventDefault();
                        if (warningTimeoutRef.current) {
                          window.clearTimeout(warningTimeoutRef.current);
                          warningTimeoutRef.current = null;
                        }
                        setShowExportWarning((prev) => !prev);
                      }}
                    >
                      <AlertTriangle size={14} />
                    </button>
                    {showExportWarning && (
                      <div className="token-download-warning-tooltip" role="alert">
                        Exporting requires escaping the SVG sandbox. If you receive wallet prompts after clicking download, ignore or reject them. This is equivalent to enabling “advanced mode” on objkt.
                      </div>
                    )}
                  </div>
                  {showDownloadOptions && (
                    <div className="token-download-options">
                      <div className="token-download-option-row">
                        <label htmlFor="token-download-format">Format</label>
                        <div className="token-download-field token-download-format-field">
                          <select
                            id="token-download-format"
                            value={downloadFormat}
                            onChange={handleFormatChange}
                          >
                            {SUPPORTED_DOWNLOAD_FORMATS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="token-download-option-row">
                        <label htmlFor="token-download-capture-delay">Capture Delay</label>
                        <div className="token-download-field">
                          <input
                            id="token-download-capture-delay"
                            type="number"
                            min={0}
                            max={MAX_CAPTURE_DELAY_S}
                            value={captureDelayInput}
                            onChange={(event) => {
                              setCaptureDelayInput(event.target.value);
                            }}
                            inputMode="numeric"
                          />
                          <span className="token-download-field-suffix">s</span>
                        </div>
                      </div>
                      {downloadFormat !== 'svg' && (
                        <>
                          <div className="token-download-option-row">
                            <label htmlFor="token-download-width">Width</label>
                            <div className="token-download-field">
                              <input
                                id="token-download-width"
                                type="number"
                                min={MIN_DOWNLOAD_RESOLUTION}
                                max={MAX_DOWNLOAD_RESOLUTION}
                                value={downloadWidthInput}
                                onChange={handleWidthInputChange}
                                onBlur={handleWidthInputBlur}
                                inputMode="numeric"
                              />
                              <span className="token-download-field-suffix">px</span>
                            </div>
                          </div>
                          <div className="token-download-option-row">
                            <label htmlFor="token-download-height">Height</label>
                            <div className="token-download-field">
                              <input
                                id="token-download-height"
                                type="number"
                                min={MIN_DOWNLOAD_RESOLUTION}
                                max={MAX_DOWNLOAD_RESOLUTION}
                                value={downloadHeightInput}
                                onChange={handleHeightInputChange}
                                onBlur={handleHeightInputBlur}
                                inputMode="numeric"
                              />
                              <span className="token-download-field-suffix">px</span>
                            </div>
                          </div>
                        </>
                      )}
                      {downloadFormat === 'jpg' && (
                        <div className="token-download-option-row">
                          <label htmlFor="token-download-jpg-bg">Background</label>
                          <div className="token-download-field token-download-color-field">
                            <input
                              type="color"
                              id="token-download-jpg-bg"
                              value={normalizedJpgBackground}
                              onChange={(event) => {
                                setJpgBackgroundInput(event.target.value);
                              }}
                              title="JPEG background color"
                            />
                            <input
                              type="text"
                              value={jpgBackgroundInput}
                              onChange={(event) => setJpgBackgroundInput(event.target.value)}
                              className="token-download-color-text"
                              placeholder="#ffffff"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <a 
                href={`https://${getObjktDomain()}/tokens/${getTokenContractAddress()}/${token.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn token-action-btn"
              >
                View on objkt
                <ExternalLink size={14} style={{ marginLeft: '6px' }} />
              </a>
            </div>

          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && (
        <div className="token-fullscreen-modal" onClick={() => setShowFullscreen(false)}>
          <div className="token-fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <div className="token-fullscreen-header">
              <h2>{token.name}</h2>
              <button 
                className="close-fullscreen-btn"
                onClick={() => setShowFullscreen(false)}
                title="Close fullscreen"
              >
                <X size={20} />
              </button>
            </div>
            <div className="token-fullscreen-artwork">
              {token.artifactUri ? (
                <iframe
                  ref={fullscreenIframeRef}
                  src={token.artifactUri}
                  title={token.name}
                  className="token-fullscreen-iframe"
                  sandbox="allow-scripts allow-same-origin"
                  allow="accelerometer; camera; gyroscope; microphone; xr-spatial-tracking; midi;"
                />
              ) : token.displayUri ? (
                <SmartThumbnail
                  src={token.displayUri}
                  width="100%"
                  height="100%"
                  alt={token.name}
                  className="token-fullscreen-image"
                />
              ) : (
                <div className="token-artwork-placeholder">
                  No artwork available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
