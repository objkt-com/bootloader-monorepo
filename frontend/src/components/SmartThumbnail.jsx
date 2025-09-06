import { useState, useEffect } from 'react';

function SmartThumbnail({ 
  src, 
  alt, 
  width, 
  height, 
  style = {}, 
  className = '',
  fallbackSrc = null,
  maxRetries = 5,
  retryDelay = 2000 
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setCurrentSrc(src);
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    if (retryCount < maxRetries) {
      // Retry after delay
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setCurrentSrc(`${src}?retry=${retryCount + 1}`); // Add cache buster
      }, retryDelay);
    } else {
      // Max retries reached
      setIsLoading(false);
      setHasError(true);
      if (fallbackSrc) {
        setCurrentSrc(fallbackSrc);
        setHasError(false);
      }
    }
  };

  const placeholderStyle = {
    width: width,
    height: height,
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    fontSize: '12px',
    textAlign: 'center',
    ...style
  };

  if (isLoading && retryCount === 0) {
    return (
      <div style={placeholderStyle} className={className}>
        <div>
          <div style={{ marginBottom: '4px' }}>⏳</div>
          <div>Generating...</div>
        </div>
      </div>
    );
  }

  if (isLoading && retryCount > 0) {
    return (
      <div style={placeholderStyle} className={className}>
        <div>
          <div style={{ marginBottom: '4px' }}>⏳</div>
          <div>Loading... ({retryCount}/{maxRetries})</div>
        </div>
      </div>
    );
  }

  if (hasError && !fallbackSrc) {
    return (
      <div style={placeholderStyle} className={className}>
        <div>
          <div style={{ marginBottom: '4px' }}>❌</div>
          <div>Failed to load</div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      style={style}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
      loading="lazy"
    />
  );
}

export default SmartThumbnail;
