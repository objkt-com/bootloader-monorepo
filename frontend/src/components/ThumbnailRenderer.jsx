import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { tzktService } from '../services/tzkt.js';
import { tezosService } from '../services/tezos.js';

function ThumbnailRenderer() {
  const { tokenId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tokenData, setTokenData] = useState(null);
  const [svgContent, setSvgContent] = useState(null);

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

        // Get generator mapping to find which generator this token belongs to
        const generatorMappingBigMap = await tzktService.getBigMapByPath("generator_mapping");
        if (!generatorMappingBigMap) {
          throw new Error("Generator mapping bigmap not found");
        }

        const generatorMapping = await tzktService.getBigMapKey(
          generatorMappingBigMap.ptr,
          tokenId.toString()
        );

        if (!generatorMapping) {
          throw new Error(`Generator mapping for token ${tokenId} not found`);
        }

        const generatorId = parseInt(generatorMapping.value);

        // Get generator data
        const generator = await tzktService.getGenerator(generatorId);
        if (!generator) {
          throw new Error(`Generator ${generatorId} not found`);
        }

        // Extract token info
        const tokenInfo = tokenMetadata.value.token_info;
        const artifactUri = tzktService.bytesToString(tokenInfo.artifactUri);
        
        // Extract seed from the artifactUri (it's embedded in the SVG)
        const seedMatch = artifactUri.match(/const SEED=(\d+)n?/);
        const seed = seedMatch ? parseInt(seedMatch[1]) : 12345;

        const token = {
          tokenId: parseInt(tokenId),
          name: tzktService.bytesToString(tokenInfo.name),
          artifactUri: artifactUri,
          seed: seed,
          generatorId: generatorId,
          generatorName: generator.name,
          generatorCode: generator.code,
        };

        setTokenData(token);

        // Generate the SVG using the generator code and seed
        const generatedSvg = tezosService.generateSVG(generator.code, seed, parseInt(tokenId));
        setSvgContent(generatedSvg);

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

  if (!tokenData || !svgContent) {
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
        src={svgContent}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          margin: 0,
          padding: 0,
          display: 'block'
        }}
        title={`Token ${tokenId} - ${tokenData.name}`}
        sandbox="allow-scripts"
      />
    </div>
  );
}

export default ThumbnailRenderer;
