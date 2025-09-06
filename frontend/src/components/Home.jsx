import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tezosService } from '../services/tezos.js';
import { getGeneratorThumbnailUrl } from '../utils/thumbnail.js';
import SmartThumbnail from './SmartThumbnail.jsx';

export default function Home() {
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, forceUpdate] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadGenerators();
  }, []);

  // Timer to update countdowns every second
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1); // Force re-render to update countdowns
    }, 1000); // Update every second

    return () => clearInterval(interval);
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

  // Function to determine generator status based on real contract data
  const getGeneratorStatus = (generator) => {
    if (!generator.sale) {
      // No sale configured - generator is just created
      return {
        type: 'created',
        minted: generator.nTokens || 0,
        total: 0,
        progress: 100
      };
    }

    const sale = generator.sale;
    const minted = generator.nTokens || 0;
    const total = sale.editions || 0;
    const progress = total > 0 ? Math.round((minted / total) * 100) : 0;
    const priceInTez = sale.price ? (sale.price / 1000000).toFixed(2) : '0';

    // Check if sale is paused
    if (sale.paused) {
      return {
        type: 'paused',
        minted,
        total,
        price: `${priceInTez} XTZ`,
        progress
      };
    }

    // Check if sold out
    if (minted >= total) {
      return {
        type: 'finished',
        minted,
        total,
        price: `${priceInTez} XTZ`,
        progress: 100
      };
    }

    // Check if scheduled for future
    if (sale.start_time) {
      const startTime = new Date(sale.start_time);
      const now = new Date();
      
      if (now < startTime) {
        const timeDiff = startTime - now;
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        
        let countdown = '';
        if (days > 0) {
          countdown += `${days}d `;
          if (hours > 0) countdown += `${hours}h `;
          if (minutes > 0) countdown += `${minutes}m`;
        } else if (hours > 0) {
          countdown += `${hours}h `;
          if (minutes > 0) countdown += `${minutes}m `;
          countdown += `${seconds}s`;
        } else if (minutes > 0) {
          countdown += `${minutes}m `;
          countdown += `${seconds}s`;
        } else {
          countdown += `${seconds}s`;
        }
        
        return {
          type: 'scheduled',
          minted,
          total,
          countdown: countdown.trim() || '< 1s',
          progress: 0
        };
      }
    }

    // Sale is active
    return {
      type: 'active',
      minted,
      total,
      price: `${priceInTez} XTZ`,
      progress
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
          ) : status.type === 'paused' ? (
            <>
              <span className="generator-card-editions">{status.minted} / {status.total} minted</span>
              <span className="generator-card-price">PAUSED</span>
            </>
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
                <SmartThumbnail
                  src={getGeneratorThumbnailUrl(generator.id, 500, 500)}
                  width="500"
                  height="500"
                  alt={generator.name || `Generator #${generator.id}`}
                  maxRetries={8}
                  retryDelay={3000}
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
