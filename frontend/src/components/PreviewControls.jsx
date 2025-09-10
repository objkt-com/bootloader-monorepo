import { useState } from 'react';
import { Dices, RefreshCw } from 'lucide-react';

export default function PreviewControls({ 
  seed, 
  onSeedChange, 
  iterationNumber = 0,
  onIterationNumberChange = null,
  onRefresh = null,
  showRefresh = false 
}) {
  const [isEditingSeed, setIsEditingSeed] = useState(false);
  const [seedEditValue, setSeedEditValue] = useState(seed.toString());
  const [isEditingIteration, setIsEditingIteration] = useState(false);
  const [iterationEditValue, setIterationEditValue] = useState(iterationNumber.toString());

  const handleSeedClick = () => {
    if (isEditingSeed) return; // Don't generate new seed if editing
    const newSeed = Math.floor(Math.random() * 1000000);
    onSeedChange(newSeed);
  };

  const handleSeedEditClick = (e) => {
    e.stopPropagation();
    setIsEditingSeed(true);
    setSeedEditValue(seed.toString());
  };

  const handleSeedInputChange = (e) => {
    setSeedEditValue(e.target.value);
  };

  const handleSeedInputBlur = () => {
    const parsedSeed = parseInt(seedEditValue);
    const newSeed = isNaN(parsedSeed) ? seed : parsedSeed;
    onSeedChange(newSeed);
    setIsEditingSeed(false);
  };

  const handleSeedInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSeedInputBlur();
    } else if (e.key === 'Escape') {
      setSeedEditValue(seed.toString());
      setIsEditingSeed(false);
    }
  };

  // Iteration number handlers
  const handleIterationClick = () => {
    if (isEditingIteration || !onIterationNumberChange) return;
    const newIteration = Math.floor(Math.random() * 1000);
    onIterationNumberChange(newIteration);
  };

  const handleIterationEditClick = (e) => {
    e.stopPropagation();
    setIsEditingIteration(true);
    setIterationEditValue(iterationNumber.toString());
  };

  const handleIterationInputChange = (e) => {
    setIterationEditValue(e.target.value);
  };

  const handleIterationInputBlur = () => {
    const parsedIteration = parseInt(iterationEditValue);
    const newIteration = isNaN(parsedIteration) ? iterationNumber : parsedIteration;
    if (onIterationNumberChange) {
      onIterationNumberChange(newIteration);
    }
    setIsEditingIteration(false);
  };

  const handleIterationInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleIterationInputBlur();
    } else if (e.key === 'Escape') {
      setIterationEditValue(iterationNumber.toString());
      setIsEditingIteration(false);
    }
  };

  const handleRefresh = () => {
    // Refresh with the same seed - just trigger a re-render
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className="preview-controls">
      {onIterationNumberChange && (
        <div className="seed-control">
          <span className="seed-label">iteration: </span>
          {isEditingIteration ? (
            <input
              type="number"
              value={iterationEditValue}
              onChange={handleIterationInputChange}
              onBlur={handleIterationInputBlur}
              onKeyDown={handleIterationInputKeyDown}
              className="seed-input"
              autoFocus
              min="0"
              max="999999999"
            />
          ) : (
            <span 
              className="seed-value clickable" 
              onClick={handleIterationEditClick}
              title="Click to edit iteration number"
            >
              {iterationNumber}
            </span>
          )}
        </div>
      )}

      <div className="seed-control">
        <span className="seed-label">seed: </span>
        {isEditingSeed ? (
          <input
            type="number"
            value={seedEditValue}
            onChange={handleSeedInputChange}
            onBlur={handleSeedInputBlur}
            onKeyDown={handleSeedInputKeyDown}
            className="seed-input"
            autoFocus
            min="0"
            max="999999999"
          />
        ) : (
          <span 
            className="seed-value clickable" 
            onClick={handleSeedEditClick}
            title="Click to edit seed (or click elsewhere to generate new)"
          >
            {seed}
          </span>
        )}
        {!isEditingSeed && (
          <button 
            className="seed-random-btn"
            onClick={handleSeedClick}
            title="Generate new random seed"
          >
            <Dices size={16} />
          </button>
        )}
      </div>
      
      {showRefresh && onRefresh && (
        <button onClick={handleRefresh} className="refresh-btn" title="Reload with same seed">
          <RefreshCw size={16} />
        </button>
      )}
    </div>
  );
}
