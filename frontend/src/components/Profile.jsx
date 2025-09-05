import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tezosService } from '../services/tezos.js';
import { tzktService } from '../services/tzkt.js';
import { getNetworkConfig, getContractAddress } from '../config.js';
import SVGPreview from './SVGPreview.jsx';

export default function Profile() {
  const { address } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('generators');
  const [generators, setGenerators] = useState([]);
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUserData();
    loadUserProfile();
    loadOwnedTokens(); // Load owned tokens immediately for the count
  }, [address]);

  useEffect(() => {
    if (activeTab === 'owned') {
      loadOwnedTokens();
    }
  }, [activeTab, address]);

  const loadUserProfile = async () => {
    try {
      setProfileLoading(true);
      const query = `
        query GetHolder($address: String!) {
          holder(where: {address: {_eq: $address}}) {
            address
            alias
            description
            twitter
            tzdomain
          }
        }
      `;
      
      const response = await fetch('https://data.objkt.com/v3/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { address }
        })
      });
      
      const data = await response.json();
      if (data.data?.holder) {
        setUserProfile(data.data.holder);
      }
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
      const tokens = await tzktService.getOwnedTokens(address, 50);
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

  // Mock function to determine generator status - will be replaced with real data later
  const getGeneratorStatus = (generator) => {
    // For now, cycle through different states based on generator ID for demo
    const statusTypes = ['active', 'scheduled', 'finished', 'created'];
    const statusIndex = generator.id % 4;
    
    const mockData = {
      active: { minted: 9, total: 21, price: '0.5 XTZ', progress: 43 },
      scheduled: { minted: 0, total: 100, countdown: '2d 3h 4m', progress: 0 },
      finished: { minted: 255, total: 255, price: '1.2 XTZ', progress: 100 },
      created: { minted: 0, total: 50, progress: 100 }
    };
    
    return {
      type: statusTypes[statusIndex],
      ...mockData[statusTypes[statusIndex]]
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

  const formatAddress = (addr) => {
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const formatAddressFull = (addr) => {
    return addr;
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
          {profileLoading ? 'Loading...' : (userProfile?.alias || formatAddress(address))}
        </div>
        <div className="profile-address-full">
          {formatAddressFull(address)}
        </div>
        <div className="profile-links">
          {userProfile?.twitter && (
            <a 
              href={`https://x.com/${userProfile.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-link"
            >
              x.com/{userProfile.twitter}
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
                    <SVGPreview 
                      code={generator.code} 
                      seed={12345} 
                      width={320}
                      height={320}
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
                    <SVGPreview 
                      code={token.generatorCode}
                      seed={token.seed}
                      width={200}
                      height={200}
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
