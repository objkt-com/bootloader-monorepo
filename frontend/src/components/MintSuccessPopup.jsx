import { useState, useEffect } from 'react';

export default function MintSuccessPopup({ 
  isOpen, 
  onClose, 
  tokenName, 
  tokenId, 
  generatorName, 
  authorTwitter,
  authorDisplayName,
  svgDataUri,
  objktUrl,
  generatorUrl
}) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Auto-hide confetti after animation
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleShareOnX = () => {
    // Use Twitter handle if available, otherwise use display name (alias/tzdomain/short address), fallback to 'the artist'
    const authorIdentifier = authorTwitter 
      ? `@${authorTwitter}` 
      : (authorDisplayName || 'the artist');
    
    const tweetText = `I just minted "${tokenName}" by ${authorIdentifier}. A long-form generative on-chain SVG via @bootloader_art ${generatorUrl || ''}`.trim();
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {/* Full-screen confetti overlay */}
      {showConfetti && (
        <div className="confetti-fullscreen">
          {[...Array(100)].map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
                backgroundColor: ['#000', '#333', '#666', '#999'][Math.floor(Math.random() * 4)],
                width: `${4 + Math.random() * 8}px`,
                height: `${4 + Math.random() * 8}px`,
              }}
            />
          ))}
        </div>
      )}
      
      <div className="mint-success-overlay" onClick={handleBackdropClick}>
        <div className="mint-success-popup">
          <div className="mint-success-content">
            <div className="mint-success-header">
              <h2>Mint Successful!</h2>
              <button className="close-button" onClick={onClose}>×</button>
            </div>
            
            <div className="mint-success-body">
              <div className="minted-artwork">
                {svgDataUri && (
                  <iframe
                    src={svgDataUri}
                    width="300"
                    height="300"
                    style={{ border: '1px solid var(--color-black)' }}
                    title={tokenName}
                  />
                )}
              </div>
              
              <div className="mint-success-info">
                <h3>{tokenName}</h3>
                <p>by {authorDisplayName || 'unknown artist'}</p>
              </div>
            </div>
            
            <div className="mint-success-actions">
              <button onClick={handleShareOnX} className="share-button">
                share on 𝕏
              </button>
              {objktUrl && (
                <a 
                  href={objktUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn objkt-button"
                >
                  view on objkt
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
