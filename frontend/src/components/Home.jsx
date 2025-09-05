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
          <button onClick={() => navigate('/create')}>Create the first generator</button>
        </div>
      ) : (
        <div className="generators-grid">
          {generators.map((generator) => (
            <div 
              key={generator.id} 
              className="generator-grid-item"
              onClick={() => handleGeneratorClick(generator)}
            >
              <div className="generator-preview-container">
                <SVGPreview 
                  code={generator.code} 
                  seed={12345} 
                  width={400}
                  height={400}
                />
                <div className="generator-name-always">
                  {generator.name || `Generator #${generator.id}`}
                </div>
                <div className="generator-overlay">
                  <div className="generator-details">
                    <div className="generator-author">
                      by {generator.author.slice(0, 6)}...{generator.author.slice(-4)}
                    </div>
                    {generator.description && (
                      <div className="generator-description">
                        {generator.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
