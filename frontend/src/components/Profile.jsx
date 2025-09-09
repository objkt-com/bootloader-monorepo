import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('generators');
  const [generators, setGenerators] = useState([]);
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [userDisplayInfo, setUserDisplayInfo] = useState({ displayName: '', profile: null });
  const [loading, setLoading] = useState(true);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUserData();
    loadUserProfile();
    loadOwnedTokens(); // Load owned tokens immediately for the count
  }, [address]);

  // Generate meta tags when user data is available
  const metaTags = userDisplayInfo && generators.length >= 0 && ownedTokens.length >= 0 ? 
    generateMetaTags.profile(address, userDisplayInfo, generators.length, ownedTokens.length) : 
    null;
  useMetaTags(metaTags);

  useEffect(() => {
    if (activeTab === 'owned') {
      loadOwnedTokens();
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

  const loadOwnedTokens = async () => {
    try {
      setTokensLoading(true);
      
      const contractAddress = getContractAddress();
      
      if (!contractAddress) {
        console.warn('No contract address configured for current network');
        setOwnedTokens([]);
        return;
      }

      // Use objkt API with network-specific endpoints
      const tokens = await objktService.getOwnedTokens(address, 50);
      console.log('Successfully loaded tokens from objkt API:', tokens.length);
      setOwnedTokens(tokens);
    } catch (err) {
      console.error('Failed to load owned tokens:', err);
      setOwnedTokens([]);
    } finally {
      setTokensLoading(false);
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
        <button onClick={loadUserData}>Retry</button>
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
          Owned ({ownedTokens.length})
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
                <div 
                  key={generator.id} 
                  className="generator-card"
                  onClick={() => handleGeneratorClick(generator)}
                >
                  <div className="generator-preview-container">
                    <SmartThumbnail
                      src={getGeneratorThumbnailUrl(generator.id)}
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'owned' && (
        <div className="profile-owned">
          {tokensLoading ? (
            <div className="loading">Loading owned tokens...</div>
          ) : ownedTokens.length === 0 ? (
            <div className="empty-state">
              <p>This user doesn't own any tokens yet.</p>
            </div>
          ) : (
            <div className="tokens-grid">
              {ownedTokens.map((token) => (
                <a
                  key={token.tokenId}
                  href={`https://${getObjktDomain()}/tokens/${getTokenContractAddress()}/${token.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
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
                    <div className="token-card-generator">
                      from {token.generatorName}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
