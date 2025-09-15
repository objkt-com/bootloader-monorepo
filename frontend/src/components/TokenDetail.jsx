import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Maximize2, X, ExternalLink } from 'lucide-react';
import { objktService } from '../services/objkt.js';
import { tezosService } from '../services/tezos.js';
import { tzktService } from '../services/tzkt.js';
import { getNetworkConfig, getContractAddress } from '../config.js';
import { getUserDisplayInfo, formatAddress } from '../utils/userDisplay.js';
import { useMetaTags, generateMetaTags } from '../hooks/useMetaTags.js';
import SmartThumbnail from './SmartThumbnail.jsx';
import './TokenDetail.css';

export default function TokenDetail() {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [generator, setGenerator] = useState(null);
  const [artistDisplayInfo, setArtistDisplayInfo] = useState({ displayName: '', profile: null });
  const [ownerDisplayInfo, setOwnerDisplayInfo] = useState({ displayName: '', profile: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    loadTokenData(abortControllerRef.current.signal);
    
    // Cleanup function to abort request if component unmounts or tokenId changes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [tokenId]);

  // Handle escape key to close fullscreen
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && showFullscreen) {
        setShowFullscreen(false);
      }
    };

    if (showFullscreen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [showFullscreen]);

  const loadTokenData = async (signal) => {
    try {
      setLoading(true);
      setError(null);

      // Check if request was aborted before starting
      if (signal?.aborted) {
        return;
      }

      // Get token details from objkt
      const tokenData = await objktService.getTokenDetails(tokenId);
      
      // Check if request was aborted after API call
      if (signal?.aborted) {
        return;
      }
      
      if (!tokenData) {
        setError('Token not found');
        return;
      }

      // Transform the token data to match our expected format
      const transformedToken = {
        tokenId: parseInt(tokenData.token_id),
        pk: tokenData.pk,
        name: tokenData.name || `Token #${tokenData.token_id}`,
        description: tokenData.description,
        artifactUri: tokenData.artifact_uri,
        displayUri: tokenData.display_uri,
        thumbnailUri: tokenData.thumbnail_uri,
        mime: tokenData.mime,
        supply: parseInt(tokenData.supply || 1),
        timestamp: tokenData.timestamp,
        creators: tokenData.creators || [],
        holders: tokenData.holders || [],
        metadata: tokenData.metadata
      };

      // Check if request was aborted before setting state
      if (signal?.aborted) {
        return;
      }

      setToken(transformedToken);

      // Get the current owner (holder with highest quantity)
      const currentOwner = transformedToken.holders.reduce((max, holder) => 
        parseFloat(holder.quantity) > parseFloat(max.quantity || 0) ? holder : max, 
        { holder_address: 'unknown', quantity: '0' }
      );

      // Load artist display info
      if (transformedToken.creators.length > 0) {
        const artistAddress = transformedToken.creators[0].creator_address;
        const artistInfo = await getUserDisplayInfo(artistAddress);
        
        // Check if request was aborted after getting artist info
        if (signal?.aborted) {
          return;
        }
        
        setArtistDisplayInfo(artistInfo);
      }

      // Load owner display info
      if (currentOwner.holder_address !== 'unknown') {
        const ownerInfo = await getUserDisplayInfo(currentOwner.holder_address);
        
        // Check if request was aborted after getting owner info
        if (signal?.aborted) {
          return;
        }
        
        setOwnerDisplayInfo(ownerInfo);
      }

      // Try to get generator info from TzKT
      try {
        const generatorInfo = await getGeneratorFromToken(transformedToken, signal);
        
        // Check if request was aborted after getting generator info
        if (signal?.aborted) {
          return;
        }
        
        console.log('Generator info found:', generatorInfo);
        setGenerator(generatorInfo);
      } catch (err) {
        // Don't log errors if the request was aborted
        if (!signal?.aborted) {
          console.warn('Could not load generator info:', err);
        }
      }

    } catch (err) {
      // Don't set error state if the request was aborted
      if (!signal?.aborted) {
        console.error('Failed to load token data:', err);
        setError('Failed to load token data');
      }
    } finally {
      // Only set loading to false if request wasn't aborted
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  // Helper function to extract generator info from token using TzKT
  const getGeneratorFromToken = async (token, signal) => {
    try {
      // Check if request was aborted before starting
      if (signal?.aborted) {
        return null;
      }

      // Use TzKT to get the generator ID from the token_extra bigmap
      const tokenExtraBigMap = await tzktService.getBigMapByPath("token_extra");
      
      // Check if request was aborted after first API call
      if (signal?.aborted) {
        return null;
      }
      
      if (!tokenExtraBigMap) {
        return null;
      }

      // Get the token extra data which contains the generator_id
      const tokenExtraData = await tzktService.getBigMapKey(
        tokenExtraBigMap.ptr,
        token.tokenId.toString()
      );

      // Check if request was aborted after second API call
      if (signal?.aborted) {
        return null;
      }

      if (!tokenExtraData || !tokenExtraData.value) {
        return null;
      }

      const generatorId = parseInt(tokenExtraData.value.generator_id);

      if (generatorId) {
        // Get the generator details using TzKT
        const generator = await tzktService.getGenerator(generatorId);
        
        // Check if request was aborted after third API call
        if (signal?.aborted) {
          return null;
        }
        
        return generator;
      }
    } catch (err) {
      // Don't log errors if the request was aborted
      if (!signal?.aborted) {
        console.warn('Failed to get generator info from TzKT:', err);
      }
    }

    return null;
  };

  // Generate meta tags when token data is available
  const metaTags = token && artistDisplayInfo ? 
    generateMetaTags.token(token, artistDisplayInfo) : 
    null;
  useMetaTags(metaTags);

  // Helper function to get the correct objkt domain based on network
  const getObjktDomain = () => {
    const networkConfig = getNetworkConfig();
    return networkConfig.tzktApi.includes('ghostnet') ? 'ghostnet.objkt.com' : 'objkt.com';
  };

  // Helper function to get the contract address for token links
  const getTokenContractAddress = () => {
    return getContractAddress();
  };

  // Get current owner
  const getCurrentOwner = () => {
    if (!token || !token.holders || token.holders.length === 0) {
      return { address: 'unknown', displayName: 'Unknown' };
    }

    const currentOwner = token.holders.reduce((max, holder) => 
      parseFloat(holder.quantity) > parseFloat(max.quantity || 0) ? holder : max, 
      { holder_address: 'unknown', quantity: '0' }
    );

    return {
      address: currentOwner.holder_address,
      displayName: ownerDisplayInfo.displayName || formatAddress(currentOwner.holder_address)
    };
  };

  // Get artist info
  const getArtist = () => {
    if (!token || !token.creators || token.creators.length === 0) {
      return { address: 'unknown', displayName: 'Unknown Artist' };
    }

    const artist = token.creators[0];
    return {
      address: artist.creator_address,
      displayName: artistDisplayInfo.displayName || formatAddress(artist.creator_address)
    };
  };

  // Helper function to format the mint date
  const formatMintDate = (timestamp) => {
    if (!timestamp) return null;
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (err) {
      console.warn('Failed to format mint date:', err);
      return null;
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading token...</div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="container">
        <div className="error">{error || 'Token not found'}</div>
        <button onClick={() => navigate('/')}>back to home</button>
      </div>
    );
  }

  const artist = getArtist();
  const owner = getCurrentOwner();

  return (
    <div className="token-detail-container">
      <div className="token-detail-layout">
        {/* Left side - Artwork */}
        <div className="token-artwork-container">
          <div className="token-artwork-wrapper">
            {token.artifactUri ? (
              <iframe
                src={token.artifactUri}
                title={token.name}
                className="token-artwork-iframe"
                sandbox="allow-scripts"
                allow="accelerometer; camera; gyroscope; microphone; xr-spatial-tracking; midi;"
              />
            ) : token.displayUri ? (
              <SmartThumbnail
                src={token.displayUri}
                width="100%"
                height="100%"
                alt={token.name}
                className="token-artwork-image"
              />
            ) : (
              <div className="token-artwork-placeholder">
                No artwork available
              </div>
            )}
            
            {/* Fullscreen button */}
            <button 
              className="token-fullscreen-btn"
              onClick={() => setShowFullscreen(true)}
              title="View fullscreen"
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>

        {/* Right side - Token info */}
        <div className="token-info-container">
          <div className="token-info-content">
            <div className="token-info-item">
              <span className="token-info-label">Artist:</span>
              <Link 
                to={`/profile/${artist.address}`}
                className="token-info-link"
              >
                {artist.displayName}
              </Link>
            </div>

            {generator && (
              <div className="token-info-item">
                <span className="token-info-label">Generator:</span>
                <Link 
                  to={`/generator/${generator.id}`}
                  className="token-info-link"
                >
                  {generator.name || `Generator #${generator.id}`}
                </Link>
              </div>
            )}
            
            <div className="token-info-section">
              {token.timestamp && (
                <div className="token-info-item">
                  <span className="token-info-label">Minted:</span>
                  <span className="token-info-value">
                    {formatMintDate(token.timestamp)}
                  </span>
                </div>
              )}

              <div className="token-info-item">
                <span className="token-info-label">Owned by:</span>
                <Link 
                  to={`/profile/${owner.address}`}
                  className="token-info-link"
                >
                  {owner.displayName}
                </Link>
              </div>
            </div>

            <div className="token-actions">
              <a 
                href={`https://${getObjktDomain()}/tokens/${getTokenContractAddress()}/${token.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn token-action-btn"
              >
                View on objkt
                <ExternalLink size={14} style={{ marginLeft: '6px' }} />
              </a>
            </div>

            {token.description && (
              <div className="token-description">
                <h3>Description</h3>
                <p>{token.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && (
        <div className="token-fullscreen-modal" onClick={() => setShowFullscreen(false)}>
          <div className="token-fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <div className="token-fullscreen-header">
              <h2>{token.name}</h2>
              <button 
                className="close-fullscreen-btn"
                onClick={() => setShowFullscreen(false)}
                title="Close fullscreen"
              >
                <X size={20} />
              </button>
            </div>
            <div className="token-fullscreen-artwork">
              {token.artifactUri ? (
                <iframe
                  src={token.artifactUri}
                  title={token.name}
                  className="token-fullscreen-iframe"
                  sandbox="allow-scripts"
                  allow="accelerometer; camera; gyroscope; microphone; xr-spatial-tracking; midi;"
                />
              ) : token.displayUri ? (
                <SmartThumbnail
                  src={token.displayUri}
                  width="100%"
                  height="100%"
                  alt={token.name}
                  className="token-fullscreen-image"
                />
              ) : (
                <div className="token-artwork-placeholder">
                  No artwork available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
