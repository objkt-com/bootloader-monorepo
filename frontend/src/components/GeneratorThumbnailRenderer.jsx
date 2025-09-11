import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { tzktService } from '../services/tzkt.js';
import { tezosService } from '../services/tezos.js';
import { CONFIG } from '../config.js';

function GeneratorThumbnailRenderer() {
  const { generatorId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatorData, setGeneratorData] = useState(null);

  useEffect(() => {
    const fetchGeneratorData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get generator data
        const generator = await tzktService.getGenerator(parseInt(generatorId));
        if (!generator) {
          throw new Error(`Generator ${generatorId} not found`);
        }

        setGeneratorData(generator);

      } catch (err) {
        console.error('Failed to fetch generator data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (generatorId) {
      fetchGeneratorData();
    }
  }, [generatorId]);

  if (loading) {
    return (
      <div style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: 'white',
        margin: 0,
        padding: 0
      }}>
        <div>Loading generator {generatorId}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: 'white',
        color: '#d32f2f',
        margin: 0,
        padding: 0
      }}>
        <div>Error: {error}</div>
      </div>
    );
  }

  if (!generatorData) {
    return (
      <div style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: 'white',
        margin: 0,
        padding: 0
      }}>
        <div>Generator not found</div>
      </div>
    );
  }

  // Use seed 0 and iteration number 0 for generator thumbnails
  const generatedSvg = tezosService.generateSVG(generatorData.code, 0, 0, 0);

  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      <iframe
        src={generatedSvg}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          margin: 0,
          padding: 0,
          display: 'block'
        }}
        title={`Generator ${generatorId} - ${generatorData.name}`}
        sandbox="allow-scripts"
        allow="accelerometer; camera; gyroscope; microphone; xr-spatial-tracking; midi;"
      />
    </div>
  );
}

export default GeneratorThumbnailRenderer;
