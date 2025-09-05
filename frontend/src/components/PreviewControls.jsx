import { useState } from 'react';

export default function PreviewControls({ 
  seed, 
  onSeedChange, 
  onRefresh = null,
  showRefresh = false 
}) {
  const handleSeedClick = () => {
    const newSeed = Math.floor(Math.random() * 1000000);
    onSeedChange(newSeed);
  };

  const handleRefresh = () => {
    // Refresh with the same seed - just trigger a re-render
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className="preview-controls">
      <span 
        className="preview-control clickable" 
        onClick={handleSeedClick}
        title="Click to generate new seed"
      >
        seed: {seed}
      </span>
      
      {showRefresh && onRefresh && (
        <button onClick={handleRefresh} className="refresh-btn" title="Reload with same seed">
          Reload
        </button>
      )}
    </div>
  );
}
