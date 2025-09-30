import { useState, useEffect, useRef } from 'react';
import { tezosService } from '../services/tezos.js';

export default function SVGPreview({
  code,
  seed = 12345,
  iterationNumber = 0,
  width = 400,
  height = 300,
  showHeader = false,
  onRefresh = null,
  noPadding = false,
  useObjktCDN = false,
  contractAddress = null,
  tokenId = null,
  renderCounter,
}) {
  const [svgUrl, setSvgUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isReloading, setIsReloading] = useState(false);
  const debounceRef = useRef(null);
  const previousRenderCounter = useRef(renderCounter);

  useEffect(() => {
    const manualTrigger = renderCounter !== previousRenderCounter.current;
    previousRenderCounter.current = renderCounter;

    if (useObjktCDN && contractAddress && tokenId) {
      // Use objkt CDN for token previews with network-specific URL format
      const isGhostnet = window.location.hostname.includes('ghostnet') || 
                        process.env.NODE_ENV === 'development'; // Assume ghostnet for development
      
      const objktUrl = isGhostnet 
        ? `https://assets.ghostnet.objkt.media/file/assets-ghostnet/${contractAddress}/${tokenId}/thumb400`
        : `https://assets.objkt.media/file/assets-003/${contractAddress}/${tokenId}/thumb400`;
      
      setSvgUrl(objktUrl);
      setError(null);
      setIsReloading(false);
      return;
    }

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (manualTrigger) {
      setIsReloading(true);
      generatePreview();
      return;
    }

    // Debounce the preview generation
    debounceRef.current = setTimeout(() => {
      setIsReloading(true);
      generatePreview();
    }, 500); // 500ms debounce to allow longer typing bursts

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, seed, iterationNumber, useObjktCDN, contractAddress, tokenId, renderCounter]);

  const generatePreview = () => {
    try {
      if (!code || code.trim() === '') {
        setSvgUrl(null);
        setError(null);
        setIsReloading(false);
        return;
      }

      const svgDataUrl = tezosService.generateSVG(code, seed, iterationNumber);
      setSvgUrl(svgDataUrl);
      setError(null);
      
      // Brief delay to show the reload indicator
      setTimeout(() => {
        setIsReloading(false);
      }, 100);
    } catch (err) {
      console.error('Preview generation error:', err);
      setError('Failed to generate preview');
      setSvgUrl(null);
      setIsReloading(false);
    }
  };

  if (error) {
    return (
      <div className="preview-content">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!svgUrl) {
    return (
      <div className="preview-content">
        <div>No preview available</div>
      </div>
    );
  }

  return (
    <div className={`preview-content ${isReloading ? 'preview-loading' : ''} ${noPadding ? 'no-padding' : ''}`}>
      <iframe
        key={renderCounter}
        src={svgUrl}
        style={{ 
          overflow: 'hidden'
        }}
        scrolling="no"
        title="SVG Preview"
        sandbox="allow-scripts"
        allow="accelerometer; camera; gyroscope; microphone; xr-spatial-tracking; midi;"
      />
    </div>
  );
}
