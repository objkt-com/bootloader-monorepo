import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tezosService } from '../services/tezos.js';
import { tzktService } from '../services/tzkt.js';
import { objktService } from '../services/objkt.js';
import { getNetworkConfig, getContractAddress } from '../config.js';
import { getGeneratorThumbnailUrl, getNetwork, getTokenThumbnailUrl } from '../utils/thumbnail.js';
import { getUserDisplayInfo, formatAddress } from '../utils/userDisplay.js';
import SmartThumbnail from './SmartThumbnail.jsx';
import { useMetaTags, generateMetaTags } from '../hooks/useMetaTags.js';

export default function Profile() {
  const { address } = useParams();
  const [activeTab, setActiveTab] = useState('generators');
  const [generators, setGenerators] = useState([]);
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [ownedTokensTotal, setOwnedTokensTotal] = useState(0);
  const [ownedTokensPage, setOwnedTokensPage] = useState(0);
  const [hasMoreTokens, setHasMoreTokens] = useState(true);
  const [userDisplayInfo, setUserDisplayInfo] = useState({ displayName: '', profile: null });
  const [artistNames, setArtistNames] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState(null);

  const TOKENS_PER_PAGE = 50;

  useEffect(() => {
    loadUserData();
    loadUserProfile();
    loadOwnedTokensCount(); // Load count asynchronously with fast pk query
    // Always load tokens on address change, regardless of active tab
    loadOwnedTokens(true); // Reset pagination when address changes
  }, [address]);

  // Generate meta tags when user data is available
  const metaTags = userDisplayInfo && generators.length >= 0 && ownedTokensTotal >= 0 ? 
    generateMetaTags.profile(address, userDisplayInfo, generators.length, ownedTokensTotal) : 
    null;
  useMetaTags(metaTags);

  useEffect(() => {
    if (activeTab === 'owned') {
      loadOwnedTokens(true); // Reset pagination when switching to owned tab
    }
  }, [activeTab, address]);

  const loadUserProfile = async () => {
    try {
      setProfileLoading(true);
      const displayInfo = await getUserDisplayInfo(address);
      setUserDisplayInfo(displayInfo);
    } catch (err) {
      console.error('Failed to load user profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      const allGenerators = await tezosService.getGenerators();
      // Filter generators by the user's address
      const userGenerators = allGenerators.filter(gen => gen.author === address);
      setGenerators(userGenerators);
    } catch (err) {
      console.error('Failed to load user generators:', err);
      setError('Failed to load user generators');
    } finally {
      setLoading(false);
    }
  };

  // Function to resolve artist names for creators
  const resolveArtistNames = async (tokens) => {
    const newArtistNames = new Map(artistNames);
    const addressesToResolve = new Set();

    // Collect all unique creator addresses that we haven't resolved yet
    tokens.forEach(token => {
      if (token.creators && token.creators.length > 0) {
        token.creators.forEach(creator => {
          if (!newArtistNames.has(creator.creator_address)) {
            addressesToResolve.add(creator.creator_address);
          }
        });
      }
    });

    // Resolve display names for new addresses
    const resolvePromises = Array.from(addressesToResolve).map(async (creatorAddress) => {
      try {
        const displayInfo = await getUserDisplayInfo(creatorAddress);
        newArtistNames.set(creatorAddress, displayInfo.displayName);
      } catch (err) {
        console.error(`Failed to resolve artist name for ${creatorAddress}:`, err);
        newArtistNames.set(creatorAddress, formatAddress(creatorAddress));
      }
    });

    await Promise.all(resolvePromises);
    setArtistNames(newArtistNames);
  };

  // Load total count of owned tokens using fast pk-only query
  const loadOwnedTokensCount = async () => {
    try {
      const contractAddress = getContractAddress();

      if (!contractAddress) {
        console.warn('No contract address configured for current network');
        setOwnedTokensTotal(0);
        return;
      }

      const count = await objktService.getOwnedTokensCount(address);
      setOwnedTokensTotal(count);
    } catch (err) {
      console.error('Failed to load owned tokens count:', err);
      setOwnedTokensTotal(0);
    }
  };


  const loadOwnedTokens = async (reset = false, pageOverride = null) => {
    try {
      setTokensLoading(true);
      
      const contractAddress = getContractAddress();
      
      if (!contractAddress) {
        console.warn('No contract address configured for current network');
        setOwnedTokens([]);
        setHasMoreTokens(false);
        setOwnedTokensTotal(0);
        return;
      }

      const currentPage = reset ? 0 : (pageOverride !== null ? pageOverride : ownedTokensPage);
      const offset = currentPage * TOKENS_PER_PAGE;

      const tokens = await objktService.getOwnedTokens(address, TOKENS_PER_PAGE, offset);

      if (reset) {
        setOwnedTokens(tokens);
        setOwnedTokensPage(0);
      } else {
        setOwnedTokens(prev => [...prev, ...tokens]);
        if (pageOverride !== null) {
          setOwnedTokensPage(pageOverride);
        }
      }

      // Check if there are more tokens to load
      const hasMore = tokens.length === TOKENS_PER_PAGE;
      setHasMoreTokens(hasMore);

      // Resolve artist names for the tokens
      await resolveArtistNames(tokens);
    } catch (err) {
      console.error('Failed to load owned tokens:', err);
      if (reset) {
        setOwnedTokens([]);
        setOwnedTokensTotal(0);
      }
      setHasMoreTokens(false);
    } finally {
      setTokensLoading(false);
    }
  };

  const loadMoreTokens = async () => {
    if (!hasMoreTokens || tokensLoading) return;

    const nextPage = ownedTokensPage + 1;
    await loadOwnedTokens(false, nextPage);
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
        
        let countdown = '';
        if (days > 0) countdown += `${days}d `;
        if (hours > 0) countdown += `${hours}h `;
        if (minutes > 0) countdown += `${minutes}m`;
        
        return {
          type: 'scheduled',
          minted,
          total,
          countdown: countdown.trim() || '< 1m',
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
      <div className="profile-container">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="error">{error}</div>
        <button onClick={loadUserData}>retry</button>
      </div>
    );
  }

  // Helper function to get the correct objkt domain based on network
  const getObjktDomain = () => {
    const networkConfig = getNetworkConfig();
    return networkConfig.tzktApi.includes('ghostnet') ? 'ghostnet.objkt.com' : 'objkt.com';
  };

  // Helper function to get the contract address for token links
  const getTokenContractAddress = () => {
    return getContractAddress();
  };

  // Helper function to get artist display text for a token
  const getArtistDisplayText = (token) => {
    if (!token.creators || token.creators.length === 0) {
      return 'Unknown Artist';
    }

    if (token.creators.length === 1) {
      const creatorAddress = token.creators[0].creator_address;
      const artistName = artistNames.get(creatorAddress);
      return artistName || formatAddress(creatorAddress);
    }

    // Multiple creators - show first artist + count
    const firstCreatorAddress = token.creators[0].creator_address;
    const firstArtistName = artistNames.get(firstCreatorAddress) || formatAddress(firstCreatorAddress);
    const remainingCount = token.creators.length - 1;
    return `${firstArtistName} +${remainingCount}`;
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-name">
          {profileLoading ? 'Loading...' : (userDisplayInfo.displayName || formatAddress(address))}
        </div>
        <div className="profile-address-full">
          {address}
        </div>
        <div className="profile-links">
          {userDisplayInfo.profile?.twitter && (
            <a 
              href={userDisplayInfo.profile.twitter.startsWith('http') 
                ? userDisplayInfo.profile.twitter 
                : `https://x.com/${userDisplayInfo.profile.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-link"
            >
              {userDisplayInfo.profile.twitter.startsWith('http') 
                ? userDisplayInfo.profile.twitter 
                : `x.com/${userDisplayInfo.profile.twitter}`}
            </a>
          )}
          <a 
            href={`https://${getObjktDomain()}/users/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="profile-link"
          >
            {getObjktDomain()}/users/{formatAddress(address)}
          </a>
        </div>
      </div>

      <div className="profile-tabs">
        <button 
          className={`tab ${activeTab === 'generators' ? 'active' : ''}`}
          onClick={() => setActiveTab('generators')}
        >
          Generators ({generators.length})
        </button>
        <button 
          className={`tab ${activeTab === 'owned' ? 'active' : ''}`}
          onClick={() => setActiveTab('owned')}
        >
          Owned ({ownedTokensTotal})
        </button>
      </div>

      {activeTab === 'generators' && (
        <div className="profile-generators">
          {generators.length === 0 ? (
            <div className="empty-state">
              <p>This user hasn't created any generators yet.</p>
            </div>
          ) : (
            <div className="generators-grid">
              {generators.map((generator) => (
                <Link 
                  key={generator.id} 
                  to={`/generator/${generator.id}`}
                  className="generator-card"
                >
                  <div className="generator-preview-container">
                    <SmartThumbnail
                      src={getGeneratorThumbnailUrl(generator.id, generator.version)}
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
                      Created {new Date(generator.created).toLocaleDateString()}
                    </div>
                    {renderGeneratorStatus(generator)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'owned' && (
        <div className="profile-owned">
          {ownedTokens.length === 0 && !tokensLoading ? (
            <div className="empty-state">
              <p>This user doesn't own any tokens yet.</p>
            </div>
          ) : (
            <>
              <div className="tokens-grid">
                {ownedTokens.map((token) => (
                  <Link
                    key={token.tokenId}
                    to={`/token/${token.tokenId}`}
                    className="token-card"
                  >
                    <div className="token-preview-container">
                      <SmartThumbnail
                        src={token.thumbnailUri || `https://media.bootloader.art/thumbnail/${token.tokenId}?n=${getNetwork()}`}
                        width="200"
                        height="200"
                        alt={token.name}
                        maxRetries={8}
                        retryDelay={3000}
                      />
                    </div>
                    <div className="token-card-info">
                      <div className="token-card-name">
                        {token.name}
                      </div>
                      <div className="token-card-artist">
                        by {getArtistDisplayText(token)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination controls */}
              {ownedTokensTotal > 0 && (
                <div className="pagination-info">
                  <div className="pagination-status">
                    Showing {ownedTokens.length} of {ownedTokensTotal} tokens
                  </div>
                  {hasMoreTokens && (
                    <button
                      className="load-more-button"
                      onClick={loadMoreTokens}
                      disabled={tokensLoading}
                    >
                      {tokensLoading ? 'Loading...' : 'Load More'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {tokensLoading && ownedTokens.length === 0 && (
            <div className="loading">Loading owned tokens...</div>
          )}
        </div>
      )}
    </div>
  );
}
