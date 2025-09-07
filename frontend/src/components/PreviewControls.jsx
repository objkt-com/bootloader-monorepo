import { useState } from 'react';
import { Dices, RefreshCw } from 'lucide-react';

export default function PreviewControls({ 
  seed, 
  onSeedChange, 
  onRefresh = null,
  showRefresh = false 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(seed.toString());

  const handleSeedClick = () => {
    if (isEditing) return; // Don't generate new seed if editing
    const newSeed = Math.floor(Math.random() * 1000000);
    onSeedChange(newSeed);
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(seed.toString());
  };

  const handleInputChange = (e) => {
    setEditValue(e.target.value);
  };

  const handleInputBlur = () => {
    const newSeed = parseInt(editValue) || seed;
    onSeedChange(newSeed);
    setIsEditing(false);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setEditValue(seed.toString());
      setIsEditing(false);
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
      <div className="seed-control">
        <span className="seed-label">seed: </span>
        {isEditing ? (
          <input
            type="number"
            value={editValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="seed-input"
            autoFocus
            min="0"
            max="999999999"
          />
        ) : (
          <span 
            className="seed-value clickable" 
            onClick={handleEditClick}
            title="Click to edit seed (or click elsewhere to generate new)"
          >
            {seed}
          </span>
        )}
        {!isEditing && (
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
