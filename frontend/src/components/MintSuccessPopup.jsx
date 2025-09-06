import { useState, useEffect } from 'react';

export default function MintSuccessPopup({ 
  isOpen, 
  onClose, 
  tokenName, 
  tokenId, 
  generatorName, 
  authorTwitter, 
  svgDataUri,
  objktUrl 
}) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Auto-hide confetti after animation
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleShareOnX = () => {
    const twitterHandle = authorTwitter ? `@${authorTwitter}` : 'the artist';
    const tweetText = `I have just minted "${tokenName}" by ${twitterHandle} a long-form generative onchain SVG via svgKT`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="mint-success-overlay" onClick={handleBackdropClick}>
      <div className="mint-success-popup">
        {showConfetti && (
          <div className="confetti-container">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  backgroundColor: ['#000', '#666', '#999'][Math.floor(Math.random() * 3)]
                }}
              />
            ))}
          </div>
        )}
        
        <div className="mint-success-content">
          <div className="mint-success-header">
            <h2>🎉 Mint Successful!</h2>
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
              <p>from "{generatorName}"</p>
              {objktUrl && (
                <a 
                  href={objktUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="objkt-link"
                >
                  View on objkt.com →
                </a>
              )}
            </div>
          </div>
          
          <div className="mint-success-actions">
            <button onClick={handleShareOnX} className="share-button">
              Share on 𝕏
            </button>
            <button onClick={onClose} className="done-button">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
