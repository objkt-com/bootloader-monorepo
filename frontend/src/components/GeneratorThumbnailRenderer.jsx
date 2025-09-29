import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { tzktService } from '../services/tzkt.js';
import { tezosService } from '../services/tezos.js';
import { useIframeRef } from '../utils/iframe.js';

function GeneratorThumbnailRenderer() {
  const { generatorId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatorData, setGeneratorData] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlScrollbarGutter = html.style.scrollbarGutter;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root ? root.style.overflow : undefined;
    const previousRootHeight = root ? root.style.height : undefined;

    html.style.overflow = 'hidden';
    html.style.scrollbarGutter = 'stable both-edges';
    body.style.overflow = 'hidden';
    if (root) {
      root.style.overflow = 'hidden';
      root.style.height = '100%';
    }

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.scrollbarGutter = previousHtmlScrollbarGutter;
      body.style.overflow = previousBodyOverflow;
      if (root) {
        root.style.overflow = previousRootOverflow ?? '';
        root.style.height = previousRootHeight ?? '';
      }
    };
  }, []);

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
        inset: 0,
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
        inset: 0,
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
        inset: 0,
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
      inset: 0,
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      <iframe
        ref={useIframeRef(generatedSvg)}
        style={{
          position: 'absolute',
          inset: 0,
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
        scrolling="no"
      />
    </div>
  );
}

export default GeneratorThumbnailRenderer;
