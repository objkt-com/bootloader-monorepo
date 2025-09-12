import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { tzktService } from '../services/tzkt.js';

function ThumbnailRenderer() {
  const { tokenId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tokenData, setTokenData] = useState(null);

  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get token metadata from the token_metadata bigmap
        const tokenMetadataBigMap = await tzktService.getBigMapByPath("token_metadata");
        if (!tokenMetadataBigMap) {
          throw new Error("Token metadata bigmap not found");
        }

        const tokenMetadata = await tzktService.getBigMapKey(
          tokenMetadataBigMap.ptr,
          tokenId.toString()
        );

        if (!tokenMetadata) {
          throw new Error(`Token ${tokenId} not found`);
        }

        // Extract token info - we only need the artifactUri
        const tokenInfo = tokenMetadata.value.token_info;
        const artifactUri = tzktService.bytesToString(tokenInfo.artifactUri);
        const tokenName = tzktService.bytesToString(tokenInfo.name);

        const token = {
          tokenId: parseInt(tokenId),
          name: tokenName,
          artifactUri: artifactUri,
        };

        setTokenData(token);

      } catch (err) {
        console.error('Failed to fetch token data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (tokenId) {
      fetchTokenData();
    }
  }, [tokenId]);

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
        <div>Loading token {tokenId}...</div>
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

  if (!tokenData) {
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
        <div>Token not found</div>
      </div>
    );
  }

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
        src={tokenData.artifactUri}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          margin: 0,
          padding: 0,
          display: 'block',
          overflow: 'hidden'
        }}
        title={`Token ${tokenId} - ${tokenData.name}`}
        sandbox="allow-scripts"
        allow="accelerometer; camera; gyroscope; microphone; xr-spatial-tracking; midi;"
      />
    </div>
  );
}

export default ThumbnailRenderer;
