import { useState, useEffect } from 'react';

function SmartThumbnail({ 
  src, 
  alt, 
  width, 
  height, 
  style = {}, 
  className = '',
  maxRetries = 8,
  initialDelay = 5000 // Start with 5 seconds
}) {
  const [showImage, setShowImage] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    setShowImage(false);
    setRetryCount(0);
    setIsRetrying(false);
    attemptLoad();
  }, [src]);

  const attemptLoad = async () => {
    try {
      // Try to fetch the image to check if it exists
      const response = await fetch(src, { method: 'HEAD' });
      
      if (response.ok) {
        // Image is ready, show it
        setShowImage(true);
        setIsRetrying(false);
      } else if (response.status === 404 && retryCount < maxRetries) {
        // 404 - thumbnail not ready yet, retry with exponential backoff
        scheduleRetry();
      } else {
        // Other error or max retries reached
        setIsRetrying(false);
      }
    } catch (error) {
      // Network error or other issue, retry if we haven't exceeded max attempts
      if (retryCount < maxRetries) {
        scheduleRetry();
      } else {
        setIsRetrying(false);
      }
    }
  };

  const scheduleRetry = () => {
    setIsRetrying(true);
    const delay = initialDelay * Math.pow(2, retryCount); // Exponential backoff
    
    setTimeout(() => {
      setRetryCount(prev => prev + 1);
      attemptLoad();
    }, delay);
  };

  const placeholderStyle = {
    width: width,
    height: height,
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    fontSize: '12px',
    textAlign: 'center',
    objectFit: 'cover',
    ...style
  };

  if (!showImage) {
    return (
      <div style={placeholderStyle} className={className}>
        <div>&lt;generating preview&gt;</div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={{ objectFit: 'cover', ...style }}
      className={className}
      onError={() => {
        // If the image fails to load after we thought it was ready, 
        // go back to placeholder and retry
        setShowImage(false);
        if (retryCount < maxRetries) {
          scheduleRetry();
        }
      }}
    />
  );
}

export default SmartThumbnail;
