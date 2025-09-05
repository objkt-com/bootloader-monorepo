import { useState, useEffect, useRef } from 'react';
import { tezosService } from '../services/tezos.js';

export default function SVGPreview({ code, seed = 12345, width = 400, height = 300, showHeader = false, onRefresh = null }) {
  const [svgUrl, setSvgUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isReloading, setIsReloading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set loading state immediately for visual feedback
    setIsReloading(true);

    // Debounce the preview generation
    debounceRef.current = setTimeout(() => {
      generatePreview();
    }, 300); // 300ms debounce

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, seed]);

  const generatePreview = () => {
    try {
      if (!code || code.trim() === '') {
        setSvgUrl(null);
        setError(null);
        setIsReloading(false);
        return;
      }

      const svgDataUrl = tezosService.generateSVG(code, seed);
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
    <div className={`preview-content ${isReloading ? 'preview-loading' : ''}`}>
      <iframe
        src={svgUrl}
        width={width}
        height={height}
        style={{ 
          border: '1px solid #ccc', 
          background: 'white',
          overflow: 'hidden'
        }}
        scrolling="no"
        title="SVG Preview"
      />
    </div>
  );
}
