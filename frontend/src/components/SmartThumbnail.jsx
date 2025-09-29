import { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '../config.js';

const HTTP_URL_REGEX = /^https?:\/\//i;
const IPFS_PREFIX = "ipfs://";
const OBJKT_GATEWAYS = {
  ghostnet: "https://assets.ghostnet.objkt.media/file/assets-ghostnet/",
  mainnet: "https://assets.objkt.media/file/assets-003/",
};
const OBJKT_ARTIFACT_SUFFIX = "/artifact";

function normaliseThumbnailSrc(value) {
  if (!value) return "";
  if (HTTP_URL_REGEX.test(value)) {
    return value;
  }

  if (value.startsWith(IPFS_PREFIX)) {
    const path = value.slice(IPFS_PREFIX.length).replace(/^ipfs\//i, "");
    const cid = path.split(/[/?#]/)[0];
    if (!cid) {
      return "";
    }

    const gatewayBase =
      OBJKT_GATEWAYS[CONFIG.network] ?? OBJKT_GATEWAYS.mainnet;
    return `${gatewayBase}${cid}${OBJKT_ARTIFACT_SUFFIX}`;
  }

  return value;
}

function SmartThumbnail({
  src,
  alt,
  width,
  height,
  style = {},
  className = "",
  maxRetries = 8,
  initialDelay = 5000, // Start with 5 seconds
}) {
  const [showImage, setShowImage] = useState(false);
  const [, setIsRetrying] = useState(false);
  const timeoutRef = useRef(null);
  const retryRef = useRef(0);
  const scheduleRetryRef = useRef(null);

  const normalisedSrc = useMemo(() => normaliseThumbnailSrc(src), [src]);
  const isFetchable = useMemo(
    () => Boolean(normalisedSrc) && HTTP_URL_REGEX.test(normalisedSrc),
    [normalisedSrc]
  );

  useEffect(() => {
    let cancelled = false;

    const clearPendingRetry = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const scheduleRetry = (overrideDelayMs) => {
      if (cancelled) return;
      if (retryRef.current >= maxRetries) {
        setIsRetrying(false);
        return;
      }

      setIsRetrying(true);

      const baseDelay = initialDelay * Math.pow(2, retryRef.current);
      const delay = Number.isFinite(overrideDelayMs)
        ? Math.max(overrideDelayMs, 250)
        : baseDelay;

      clearPendingRetry();
      timeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        retryRef.current += 1;
        void attemptLoad();
      }, delay);
    };

    const attemptLoad = async () => {
      if (cancelled) return;

      if (!isFetchable) {
        setShowImage(Boolean(normalisedSrc));
        setIsRetrying(false);
        return;
      }

      try {
        const response = await fetch(normalisedSrc, { method: "HEAD" });
        if (cancelled) return;

        const workerStatusHeader = response.headers?.get("X-Worker-Status");
        const workerStatus = workerStatusHeader
          ? Number.parseInt(workerStatusHeader, 10)
          : undefined;
        const effectiveStatus = Number.isFinite(workerStatus)
          ? workerStatus
          : response.status;

        if (effectiveStatus === 204 || effectiveStatus === 404 || effectiveStatus === 425) {
          scheduleRetry();
          return;
        }

        if (effectiveStatus === 429) {
          const retryAfterSeconds = Number.parseInt(
            response.headers?.get("Retry-After") ?? "",
            10
          );
          scheduleRetry(
            Number.isFinite(retryAfterSeconds)
              ? retryAfterSeconds * 1000
              : undefined
          );
          return;
        }

        if (response.ok) {
          setShowImage(true);
          setIsRetrying(false);
          return;
        }

        if (retryRef.current < maxRetries) {
          scheduleRetry();
        } else {
          setIsRetrying(false);
        }
      } catch (error) {
        if (cancelled) return;
        if (retryRef.current < maxRetries) {
          scheduleRetry();
        } else {
          setIsRetrying(false);
        }
      }
    };

    retryRef.current = 0;
    setShowImage(false);
    setIsRetrying(false);
    clearPendingRetry();

    scheduleRetryRef.current = (delay) => scheduleRetry(delay);

    if (!normalisedSrc) {
      return () => {
        cancelled = true;
        clearPendingRetry();
        scheduleRetryRef.current = null;
      };
    }

    if (!isFetchable) {
      setShowImage(true);
      return () => {
        cancelled = true;
        clearPendingRetry();
        scheduleRetryRef.current = null;
      };
    }

    void attemptLoad();

    return () => {
      cancelled = true;
      clearPendingRetry();
      scheduleRetryRef.current = null;
    };
  }, [normalisedSrc, isFetchable, initialDelay, maxRetries]);

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
      src={normalisedSrc}
      alt={alt}
      width={width}
      height={height}
      style={{ objectFit: 'cover', ...style }}
      className={className}
      onError={() => {
        // If the image fails to load after we thought it was ready, 
        // go back to placeholder and retry
        setShowImage(false);
        retryRef.current = 0;
        scheduleRetryRef.current?.(500);
      }}
    />
  );
}

export default SmartThumbnail;
