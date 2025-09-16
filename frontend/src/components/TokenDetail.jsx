import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Maximize2, X, ExternalLink, RefreshCw } from 'lucide-react';
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
  const [tokenExtra, setTokenExtra] = useState(null);
  const [artistDisplayInfo, setArtistDisplayInfo] = useState({ displayName: '', profile: null });
  const [ownerDisplayInfo, setOwnerDisplayInfo] = useState({ displayName: '', profile: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [userAddress, setUserAddress] = useState(null);
  const [bootloaderInfo, setBootloaderInfo] = useState(null);
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

  // Get user address from tezos service
  useEffect(() => {
    const initializeTezos = async () => {
      await tezosService.initialize();
      setUserAddress(tezosService.userAddress);
    };

    initializeTezos();

    // Set up callback for account changes
    tezosService.setAccountChangeCallback((address) => {
      setUserAddress(address);
    });
  }, []);

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

      let tokenData = null;

      // Get token metadata from tzkt only
      try {
        const tokenMetadataBigMap = await tzktService.getBigMapByPath("token_metadata");
        const ledgerBigMap = await tzktService.getBigMapByPath("ledger");
        
        if (tokenMetadataBigMap && ledgerBigMap) {
          const tokenMetadata = await tzktService.getBigMapKey(
            tokenMetadataBigMap.ptr,
            tokenId.toString()
          );
          const tokenOwner = await tzktService.getBigMapKey(
            ledgerBigMap.ptr,
            tokenId.toString()
          );

          if (tokenMetadata && tokenOwner) {
            const tokenInfo = tokenMetadata.value.token_info;
            
            // Get token creation timestamp from key updates
            const creationTimestamp = await tzktService.getBigMapKeyCreationTime(
              tokenMetadataBigMap.ptr,
              tokenId.toString()
            );

            tokenData = {
              token_id: tokenId.toString(),
              name: tzktService.bytesToString(tokenInfo.name),
              artifact_uri: tzktService.bytesToString(tokenInfo.artifactUri),
              display_uri: tokenInfo.displayUri ? tzktService.bytesToString(tokenInfo.displayUri) : null,
              thumbnail_uri: tokenInfo.thumbnailUri ? tzktService.bytesToString(tokenInfo.thumbnailUri) : null,
              mime: tokenInfo.mime ? tzktService.bytesToString(tokenInfo.mime) : null,
              supply: "1", // Default for FA2
              timestamp: creationTimestamp, // Get from key updates
              creators: [], // Will be populated from generator info
              holders: [{
                holder_address: tokenOwner.value,
                quantity: "1"
              }],
              metadata: null // Not available from tzkt
            };
          }
        }
      } catch (tzktError) {
        console.error('Failed to get token from tzkt:', tzktError);
      }
      
      // Check if request was aborted after tzkt call
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

      // Try to get generator info from TzKT (this will also populate creator info)
      try {
        const generatorInfo = await getGeneratorFromToken(transformedToken, signal);
        
        // Check if request was aborted after getting generator info
        if (signal?.aborted) {
          return;
        }
        
        console.log('Generator info found:', generatorInfo);
        setGenerator(generatorInfo);

        // If we got generator info and don't have creator info, use generator author
        if (generatorInfo && transformedToken.creators.length === 0) {
          transformedToken.creators = [{
            creator_address: generatorInfo.author,
            verified: false
          }];
          setToken(transformedToken);
        }
      } catch (err) {
        // Don't log errors if the request was aborted
        if (!signal?.aborted) {
          console.warn('Could not load generator info:', err);
        }
      }

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

  const loadBootloaderInfo = async (bootloaderId) => {
    try {
      const bootloader = await tzktService.getBootloader(bootloaderId);
      setBootloaderInfo(bootloader);
    } catch (err) {
      console.error('Failed to load bootloader info:', err);
      setBootloaderInfo(null);
    }
  };

  // Helper function to extract generator info from token using TzKT
  const getGeneratorFromToken = async (token, signal) => {
    try {
      // Check if request was aborted before starting
      if (signal?.aborted) {
        return null;
      }

      // Get the token extra data which contains the generator_id and generator_version
      const tokenExtraData = await tzktService.getTokenExtra(token.tokenId);
      
      // Check if request was aborted after first API call
      if (signal?.aborted) {
        return null;
      }
      
      if (!tokenExtraData) {
        return null;
      }

      // Store token extra data
      setTokenExtra(tokenExtraData);

      // Get the generator details using TzKT
      const generator = await tzktService.getGenerator(tokenExtraData.generatorId);
      
      // Check if request was aborted after second API call
      if (signal?.aborted) {
        return null;
      }
      
      // Load bootloader information if bootloaderId is available
      if (generator && generator.bootloaderId !== undefined && generator.bootloaderId !== null) {
        await loadBootloaderInfo(generator.bootloaderId);
      }
      
      return generator;
    } catch (err) {
      // Don't log errors if the request was aborted
      if (!signal?.aborted) {
        console.warn('Failed to get generator info from TzKT:', err);
      }
    }

    return null;
  };

  // Handle token version update
  const handleUpdateVersion = async () => {
    if (!token || !userAddress || isUpdating) {
      return;
    }

    try {
      setIsUpdating(true);
      
      const result = await tezosService.regenerateToken(token.tokenId);
      
      if (result.success) {
        // Reload token data to get updated version
        setTimeout(() => {
          window.location.reload();
        }, 3000); // Give some time for the blockchain to update
        
        alert('Token version updated successfully! The page will refresh in a moment.');
      } else {
        alert(`Failed to update token version: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to update token version:', error);
      alert(`Failed to update token version: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Check if user can update the token version
  const canUpdateVersion = () => {
    if (!token || !generator || !tokenExtra || !userAddress) {
      return false;
    }

    const owner = getCurrentOwner();
    const isOwner = userAddress.toLowerCase() === owner.address.toLowerCase();
    const hasNewerVersion = generator.version > tokenExtra.generatorVersion;
    const hasSeed = tokenExtra.seed !== null;

    return isOwner && hasNewerVersion && hasSeed;
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

            {tokenExtra && generator && (
              <>
                <div className="token-info-item">
                  <span className="token-info-label">Generator Version:</span>
                  <span className={`token-info-value ${generator.version > tokenExtra.generatorVersion ? 'version-outdated' : ''}`}>
                    {tokenExtra.generatorVersion}
                    {generator.version > tokenExtra.generatorVersion && (
                      <span style={{ fontSize: '12px', marginLeft: '8px', color: '#ff6b35' }}>
                        (v{generator.version} available)
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="token-info-item">
                  <span className="token-info-label">Bootloader:</span>
                  <span className="token-info-value">
                    {bootloaderInfo?.version || '-'}
                  </span>
                </div>
              </>
            )}
            
            <div className="token-info-section">
              <div className="token-info-item">
                <span className="token-info-label">Minted:</span>
                <span className="token-info-value">
                  {token.timestamp ? formatMintDate(token.timestamp) : '-'}
                </span>
              </div>

              <div className="token-info-item">
                <span className="token-info-label">Owned by:</span>
                {owner.address !== 'unknown' ? (
                  <Link 
                    to={`/profile/${owner.address}`}
                    className="token-info-link"
                  >
                    {owner.displayName}
                  </Link>
                ) : (
                  <span className="token-info-value">-</span>
                )}
              </div>
            </div>

            <div className="token-actions">
              {canUpdateVersion() && (
                <button
                  onClick={handleUpdateVersion}
                  disabled={isUpdating}
                  className="btn token-update-btn"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw size={14} />
                      Updating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Update Version
                    </>
                  )}
                </button>
              )}
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
