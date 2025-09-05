import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tezosService } from '../services/tezos.js';
import SVGPreview from './SVGPreview.jsx';

export default function Home() {
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadGenerators();
  }, []);

  const loadGenerators = async () => {
    try {
      setLoading(true);
      setError(null);
      const generatorsList = await tezosService.getGenerators();
      setGenerators(generatorsList);
    } catch (err) {
      console.error('Failed to load generators:', err);
      setError('Failed to load generators');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratorClick = (generator) => {
    navigate(`/generator/${generator.id}`);
  };

  // Mock function to determine generator status - will be replaced with real data later
  const getGeneratorStatus = (generator) => {
    // For now, cycle through different states based on generator ID for demo
    const statusTypes = ['active', 'scheduled', 'finished', 'created'];
    const statusIndex = generator.id % 4;
    
    const mockData = {
      active: { minted: 9, total: 21, price: '0.5 XTZ', progress: 43 },
      scheduled: { minted: 0, total: 100, countdown: '2d 3h 4m', progress: 0 },
      finished: { minted: 255, total: 255, price: '1.2 XTZ', progress: 100 },
      created: { minted: 0, total: 50, progress: 100 }
    };
    
    return {
      type: statusTypes[statusIndex],
      ...mockData[statusTypes[statusIndex]]
    };
  };

  const renderGeneratorStatus = (generator) => {
    const status = getGeneratorStatus(generator);
    
    return (
      <>
        <div className="generator-card-status">
          {status.type === 'scheduled' ? (
            <>
              <span className="generator-card-editions">{status.minted} / {status.total}</span>
              <span className="generator-card-countdown">{status.countdown}</span>
            </>
          ) : status.type === 'created' ? (
            <span className="generator-card-editions">(-)</span>
          ) : (
            <>
              <span className="generator-card-editions">{status.minted} / {status.total} minted</span>
              <span className="generator-card-price">{status.price}</span>
            </>
          )}
        </div>
        <div className="progress-bar">
          <div 
            className={`progress-fill ${status.type}`}
            style={{ width: `${status.progress}%` }}
          ></div>
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading generators...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">{error}</div>
        <button onClick={loadGenerators}>Retry</button>
      </div>
    );
  }

  return (
    <div className="explore-container">
      {generators.length === 0 ? (
        <div className="empty-state">
          <p>No generators found.</p>
        </div>
      ) : (
        <div className="generators-grid">
          {generators.map((generator) => (
            <div 
              key={generator.id} 
              className="generator-card"
              onClick={() => handleGeneratorClick(generator)}
            >
              <div className="generator-preview-container">
                <SVGPreview 
                  code={generator.code} 
                  seed={12345} 
                  width={320}
                  height={320}
                />
              </div>
              <div className="generator-card-info">
                <div className="generator-card-title">
                  {generator.name || `Generator #${generator.id}`}
                </div>
                <div className="generator-card-author">
                  by {generator.author.slice(0, 6)}...{generator.author.slice(-4)}
                </div>
                {renderGeneratorStatus(generator)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
