import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { tzktService } from '../services/tzkt.js';
import { processSeedLikeContract } from '../utils/thumbnail.js';

export function fixSeedEncoding(hexString) {
    // Hex prefixes to identify the seed location
    const prefix = '646174613a696d6167652f7376672b786d6c3b757466382c253343737667253230786d6c6e73253344253232687474702533412532462532467777772e77332e6f7267253246323030302532467376672532322533452533437363726970742533452533432532312535424344415441253542636f6e737425323053454544253344';
    const suffix = '6e25334266756e6374696f6e25323073706c69746d69783634253238662532392537426c65742532306e2533446';

    // Find the seed between prefix and suffix
    const prefixIndex = hexString.indexOf(prefix);
    const suffixIndex = hexString.indexOf(suffix);

    if (prefixIndex === -1 || suffixIndex === -1 || suffixIndex <= prefixIndex) {
        // No seed pattern found or invalid structure, return original
        return hexString;
    }

    // Extract the seed hex bytes between prefix and suffix
    const seedStart = prefixIndex + prefix.length;
    const seedHex = hexString.slice(seedStart, suffixIndex);

    if (seedHex.length != 64){
      // 64 bytes seeds need to be processed
      return hexString
    }

    // Process the seed using the same logic as the smart contract
    // bytes_utils.from_nat(bytes_utils.to_nat(seed))
    const processedSeed = processSeedLikeContract(seedHex);

    // Reconstruct the hex string with the processed seed
    const beforeSeed = hexString.slice(0, seedStart);
    const afterSeed = hexString.slice(suffixIndex);

    return beforeSeed + processedSeed + afterSeed;
}

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
        const correctedArtifactUriBytes = fixSeedEncoding(tokenInfo.artifactUri);
        const artifactUri = tzktService.bytesToString(correctedArtifactUriBytes);
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
        ref={(iframe) => {
          if (iframe && tokenData.artifactUri) {
            // Set src after a brief delay to ensure iframe is ready
            setTimeout(() => {
              if (iframe.src !== tokenData.artifactUri) {
                iframe.src = tokenData.artifactUri;
              }
            }, 0);
          }
        }}
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
