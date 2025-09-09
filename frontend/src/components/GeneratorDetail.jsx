import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Maximize2, X } from 'lucide-react';
import { tezosService } from '../services/tezos.js';
import { tzktService } from '../services/tzkt.js';
import { getNetworkConfig, getContractAddress } from '../config.js';
import CodeEditor from './CodeEditor.jsx';
import SVGPreview from './SVGPreview.jsx';
import PreviewControls from './PreviewControls.jsx';
import MintSuccessPopup from './MintSuccessPopup.jsx';
import { estimateMint, estimateUpdateGenerator, getByteLength, formatStorageCost } from '../utils/storageCost.js';
import { getTokenThumbnailUrl, prefetchTokenThumbnail } from '../utils/thumbnail.js';
import { getUserDisplayInfo, formatAddress } from '../utils/userDisplay.js';
import SmartThumbnail from './SmartThumbnail.jsx';
import { useMetaTags, generateMetaTags } from '../hooks/useMetaTags.js';

export default function GeneratorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [generator, setGenerator] = useState(null);
  const [authorDisplayInfo, setAuthorDisplayInfo] = useState({ displayName: '', profile: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [previewSeed, setPreviewSeed] = useState(Math.floor(Math.random() * 1000000));
  const [latestTokens, setLatestTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saleFormData, setSaleFormData] = useState({
    startTime: '',
    price: '',
    editions: '',
    paused: false
  });
  const [isSavingSale, setIsSavingSale] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [mintedTokenData, setMintedTokenData] = useState(null);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [showCodeOnMobile, setShowCodeOnMobile] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [bootloaderInfo, setBootloaderInfo] = useState(null);

  // Handle escape key to close fullscreen
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && showFullscreenPreview) {
        setShowFullscreenPreview(false);
      }
    };

    if (showFullscreenPreview) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [showFullscreenPreview]);

  // Handle navigation warning when in edit mode
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isEditing) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    if (isEditing) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [isEditing]);

  // Handle React Router navigation warning when in edit mode
  useEffect(() => {
    const handlePopState = (event) => {
      if (isEditing) {
        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
        if (!confirmLeave) {
          // Push the current state back to prevent navigation
          window.history.pushState(null, '', window.location.pathname);
        }
      }
    };

    if (isEditing) {
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isEditing]);

  // Helper function to parse description from multi-line comment
  const parseDescription = (codeText) => {
    const lines = codeText.split('\n');
    if (lines[0].startsWith('/*')) {
      let description = '';
      let endIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('*/')) {
          endIndex = i;
          // Add the content before */ on the same line
          const lastLine = lines[i].substring(0, lines[i].indexOf('*/')).trim();
          if (lastLine) {
            description += (description ? '\n' : '') + lastLine;
          }
          break;
        }
        
        if (i === 0) {
          // First line: remove /* and any content after it
          const firstLine = lines[i].substring(lines[i].indexOf('/*') + 2).trim();
          if (firstLine) {
            description = firstLine;
          }
        } else {
          // Middle lines: remove leading * and whitespace
          const line = lines[i].replace(/^\s*\*\s?/, '').trim();
          if (line || description) { // Include empty lines if we already have content
            description += (description ? '\n' : '') + line;
          }
        }
      }
      
      if (endIndex >= 0) {
        // Return description and code without the comment
        const remainingCode = lines.slice(endIndex + 1).join('\n').trim();
        return { description: description.trim(), code: remainingCode };
      }
    }
    
    return { description: '', code: codeText };
  };

  // Helper function to format code with description comment
  const formatCodeWithDescription = (description, codeText) => {
    if (!description.trim()) {
      return codeText;
    }
    
    const descLines = description.split('\n');
    let comment = '/*\n';
    descLines.forEach(line => {
      comment += ` * ${line}\n`;
    });
    comment += ' */\n\n';
    
    return comment + codeText;
  };

  useEffect(() => {
    loadGenerator();
  }, [id]);

  useEffect(() => {
    if (generator) {
      loadLatestTokens();
      loadAuthorProfile();
    }
  }, [generator]);

  // Generate meta tags when generator and author info are available
  const metaTags = generator && authorDisplayInfo ? 
    generateMetaTags.generator(generator, authorDisplayInfo) : 
    null;
  useMetaTags(metaTags);

  // Timer for countdown updates
  useEffect(() => {
    if (!generator?.sale?.start_time) return;

    const updateCountdown = () => {
      const startTime = new Date(generator.sale.start_time);
      const now = new Date();
      
      if (now < startTime) {
        const timeDiff = startTime - now;
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        
        let countdownText = '';
        if (days > 0) {
          countdownText += `${days}d `;
          if (hours > 0) countdownText += `${hours}h `;
          if (minutes > 0) countdownText += `${minutes}m`;
        } else if (hours > 0) {
          countdownText += `${hours}h `;
          if (minutes > 0) countdownText += `${minutes}m `;
          countdownText += `${seconds}s`;
        } else if (minutes > 0) {
          countdownText += `${minutes}m `;
          countdownText += `${seconds}s`;
        } else {
          countdownText += `${seconds}s`;
        }
        
        setCountdown(countdownText.trim() || '< 1s');
      } else {
        setCountdown('');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000); // Update every second

    return () => clearInterval(interval);
  }, [generator?.sale?.start_time]);

  const loadAuthorProfile = async () => {
    if (!generator?.author) return;
    
    try {
      const displayInfo = await getUserDisplayInfo(generator.author);
      setAuthorDisplayInfo(displayInfo);
    } catch (err) {
      console.error('Failed to load author profile:', err);
    }
  };

  const loadLatestTokens = async () => {
    try {
      setTokensLoading(true);
      if (generator) {
        // Use TzKT API to get real mints for this generator
        const tokens = await tzktService.getGeneratorMints(generator.id, 6); // Get 6 latest mints
        setLatestTokens(tokens);
      }
    } catch (err) {
      console.error('Failed to load latest tokens:', err);
      setLatestTokens([]); // Set empty array on error
    } finally {
      setTokensLoading(false);
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

  const loadGenerator = async () => {
    try {
      setLoading(true);
      setError(null);
      const generators = await tezosService.getGenerators();
      const foundGenerator = generators.find(g => g.id === parseInt(id));
      
      if (foundGenerator) {
        setGenerator(foundGenerator);
        setEditName(foundGenerator.name);
        
        // Format code with description comment for display
        const codeWithDescription = formatCodeWithDescription(
          foundGenerator.description || '', 
          foundGenerator.code
        );
        setEditCode(codeWithDescription);
        
        // Load bootloader information if bootloaderId is available
        if (foundGenerator.bootloaderId !== undefined && foundGenerator.bootloaderId !== null) {
          await loadBootloaderInfo(foundGenerator.bootloaderId);
        }
      } else {
        setError('Generator not found');
      }
    } catch (err) {
      console.error('Failed to load generator:', err);
      setError('Failed to load generator');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(generator.name);
    // Format code with description comment for display
    const codeWithDescription = formatCodeWithDescription(
      generator.description || '', 
      generator.code
    );
    setEditCode(codeWithDescription);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!tezosService.isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!editName.trim()) {
      setError('Please enter a name for your generator');
      return;
    }

    if (!editCode.trim()) {
      setError('Please enter some code for your generator');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Parse description from code
      const { description, code: cleanCode } = parseDescription(editCode);
      
      const result = await tezosService.updateGenerator(
        parseInt(id), 
        editName.trim(), 
        cleanCode, 
        description
      );
      
      if (result.success) {
        setSuccess(`Generator updated successfully!`);
        setIsEditing(false);
        // Reload generator data
        setTimeout(() => {
          loadGenerator();
        }, 2000);
      } else {
        setError(`Failed to update generator: ${result.error}`);
      }
    } catch (err) {
      console.error('Update generator error:', err);
      setError(`Failed to update generator: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMint = async () => {
    if (!tezosService.isConnected) {
      // Trigger wallet connection instead of showing error
      try {
        const connectResult = await tezosService.connectWallet();
        if (!connectResult.success) {
          setError(`Failed to connect wallet: ${connectResult.error}`);
          return;
        }
        // If connection successful, continue with minting
      } catch (err) {
        setError(`Failed to connect wallet: ${err.message}`);
        return;
      }
    }

    if (!generator.sale) {
      setError('No sale configured for this generator');
      return;
    }

    const sale = generator.sale;
    const priceInTez = sale.price / 1000000;

    setIsMinting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await tezosService.mintToken(parseInt(id));
      
      if (result.success) {
        // Use the actual token ID returned from the mint operation
        const mintedTokenId = result.tokenId;
        
        // Use the actual artifactUri from the on-chain token metadata if available
        // Otherwise fall back to generating the SVG manually
        let svgDataUri = result.artifactUri;
        
        if (!svgDataUri) {
          // Fallback: Extract seed from the entropy and generate SVG manually
          const entropyHex = result.entropy;
          const entropyBytes = entropyHex.slice(2); // Remove '0x' prefix
          const entropyBigInt = BigInt('0x' + entropyBytes);
          const seed = Number(entropyBigInt % BigInt(2**32)); // Use 32-bit seed
          svgDataUri = tezosService.generateSVG(generator.code, Math.abs(seed), mintedTokenId);
        }
        
        // Use the on-chain token name if available, otherwise construct it
        const iterationNumber = (generator.nTokens || 0) + 1;
        const fallbackTokenName = `${generator.name || `Generator #${generator.id}`} #${iterationNumber}`;
        
        // Prepare token data for success popup
        const tokenData = {
          tokenId: mintedTokenId,
          tokenName: result.tokenName || fallbackTokenName, // Use on-chain name if available
          generatorName: generator.name || `Generator #${generator.id}`,
          authorTwitter: authorDisplayInfo.profile?.twitter,
          authorDisplayName: authorDisplayInfo.displayName,
          svgDataUri: svgDataUri,
          objktUrl: `https://${getObjktDomain()}/tokens/${getTokenContractAddress()}/${mintedTokenId}`,
          generatorUrl: `https://bootloader.art/generator/${generator.id}`
        };
        
        setMintedTokenData(tokenData);
        setShowSuccessPopup(true);
        
        // Prefetch token thumbnail with identical parameters to the ones used in display
        prefetchTokenThumbnail(mintedTokenId).catch(err => {
          console.warn('Token thumbnail prefetch failed:', err);
        });
        
        // Update local generator state to reflect the new mint count
        setGenerator(prevGenerator => ({
          ...prevGenerator,
          nTokens: (prevGenerator.nTokens || 0) + 1
        }));
        
        // Refresh the latest tokens list to include the new mint
        loadLatestTokens();
      } else {
        setError(`Failed to mint token: ${result.error}`);
      }
    } catch (err) {
      console.error('Mint token error:', err);
      setError(`Failed to mint token: ${err.message}`);
    } finally {
      setIsMinting(false);
    }
  };

  const getMintButtonText = () => {
    if (!generator.sale) {
      return 'No Sale Active';
    }

    const sale = generator.sale;
    const priceInTez = (sale.price / 1000000).toFixed(2);
    const minted = generator.nTokens || 0;
    const total = sale.editions || 0;

    if (sale.paused) {
      return 'Sale Paused';
    }

    if (minted >= total) {
      return 'Sold Out';
    }

    if (sale.start_time) {
      const startTime = new Date(sale.start_time);
      const now = new Date();
      if (now < startTime) {
        return countdown ? `Starts in ${countdown}` : 'Not Started';
      }
    }

    return `Mint for ${priceInTez} XTZ`;
  };

  const isMintDisabled = () => {
    if (isMinting) return true;
    if (!generator.sale) return true;

    const sale = generator.sale;
    const minted = generator.nTokens || 0;
    const total = sale.editions || 0;

    if (sale.paused || minted >= total) return true;

    if (sale.start_time) {
      const startTime = new Date(sale.start_time);
      const now = new Date();
      if (now < startTime) return true;
    }

    return false;
  };

  const handleFork = () => {
    // Navigate to create page with the generator's code pre-filled
    navigate('/create', { 
      state: { 
        forkCode: generator.code,
        forkName: `Fork of ${generator.name || `Generator #${generator.id}`}`
      } 
    });
  };

  const handleShowSaleForm = () => {
    // Pre-fill form with existing sale data if available
    if (generator.sale) {
      const sale = generator.sale;
      setSaleFormData({
        startTime: sale.start_time ? new Date(sale.start_time).toISOString().slice(0, 16) : '',
        price: sale.price ? (sale.price / 1000000).toString() : '',
        editions: sale.editions ? sale.editions.toString() : '',
        paused: sale.paused || false
      });
    } else {
      setSaleFormData({
        startTime: '',
        price: '',
        editions: '',
        paused: false
      });
    }
    setShowSaleForm(true);
    setError(null);
    setSuccess(null);
  };

  const handleCancelSaleForm = () => {
    setShowSaleForm(false);
    setSaleFormData({
      startTime: '',
      price: '',
      editions: '',
      paused: false
    });
    setError(null);
    setSuccess(null);
  };

  const handleSaveSale = async () => {
    if (!tezosService.isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    const price = parseFloat(saleFormData.price);
    const editions = parseInt(saleFormData.editions);

    if (!saleFormData.price || price <= 0) {
      setError('Please enter a valid price');
      return;
    }

    if (price > 1000000) {
      setError('Maximum price is 1,000,000 XTZ');
      return;
    }

    if (!saleFormData.editions || editions <= 0) {
      setError('Please enter a valid number of editions');
      return;
    }

    if (editions > 10000) {
      setError('Maximum editions is 10,000');
      return;
    }

    // Check if updating existing sale - editions can only be increased if no tokens were minted yet
    if (generator.sale && generator.sale.editions) {
      const currentEditions = generator.sale.editions;
      const tokensMinted = generator.nTokens || 0;
      
      if (editions > currentEditions && tokensMinted > 0) {
        setError(`Editions can only be increased if no tokens were minted yet. Current: ${currentEditions}, Tokens minted: ${tokensMinted}`);
        return;
      }
    }

    setIsSavingSale(true);
    setError(null);
    setSuccess(null);

    try {
      const priceInMutez = Math.floor(price * 1000000);
      const startTime = saleFormData.startTime ? new Date(saleFormData.startTime).toISOString() : null;

      const result = await tezosService.setSale(
        parseInt(id),
        startTime,
        priceInMutez,
        saleFormData.paused,
        editions
      );

      if (result.success) {
        setSuccess(`Sale configuration saved successfully!`);
        setShowSaleForm(false);
        // Reload generator data
        setTimeout(() => {
          loadGenerator();
        }, 2000);
      } else {
        setError(`Failed to save sale configuration: ${result.error}`);
      }
    } catch (err) {
      console.error('Save sale error:', err);
      setError(`Failed to save sale configuration: ${err.message}`);
    } finally {
      setIsSavingSale(false);
    }
  };

  const refreshPreview = () => {
    // Force a re-render with the same seed by updating a dummy state or triggering SVGPreview refresh
    // We can do this by temporarily changing the seed and then setting it back
    const currentSeed = previewSeed;
    setPreviewSeed(currentSeed + 0.1); // Tiny change to trigger re-render
    setTimeout(() => setPreviewSeed(currentSeed), 10); // Set back to original
  };

  const isAuthor = generator && tezosService.userAddress === generator.author;

  const getAuthorDisplayName = () => {
    return authorDisplayInfo.displayName || formatAddress(generator.author);
  };

  // Helper function to get the correct objkt domain based on network
  const getObjktDomain = () => {
    const networkConfig = getNetworkConfig();
    return networkConfig.tzktApi.includes('ghostnet') ? 'ghostnet.objkt.com' : 'objkt.com';
  };

  // Helper function to get the contract address for token links
  const getTokenContractAddress = () => {
    return getContractAddress();
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading generator...</div>
      </div>
    );
  }

  if (error && !generator) {
    return (
      <div className="container">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/')}>Back to Home</button>
      </div>
    );
  }

  if (!generator) {
    return (
      <div className="container">
        <div>Generator not found</div>
        <button onClick={() => navigate('/')}>Back to Home</button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="generator-header">
        <h1>{generator.name || `Generator #${generator.id}`}</h1>
        <p className="generator-author">
          by{' '}
          <a 
            href={`/profile/${generator.author}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/profile/${generator.author}`);
            }}
            className="author-link"
          >
            {getAuthorDisplayName()}
          </a>
        </p>
        
        {/* Metadata toggle button */}
        <button 
          onClick={() => setShowMetadata(!showMetadata)}
          className="metadata-toggle-btn"
        >
          {showMetadata ? '[-] hide' : '[+] show'} metadata
        </button>
        
        {/* Generator metadata - collapsible */}
        {showMetadata && (
          <div className="generator-metadata-expanded">
            <div className="metadata-item">
              <span className="metadata-label">Created:</span>
              <span className="metadata-value">
                {generator.created ? new Date(generator.created).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Unknown'}
              </span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Last Updated:</span>
              <span className="metadata-value">
                {generator.lastUpdate ? new Date(generator.lastUpdate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Unknown'}
              </span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Generator Version:</span>
              <span className="metadata-value">
                {generator.version ? `${generator.version}` : '-'}
              </span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Bootloader:</span>
              <span className="metadata-value bootloader-version">
                {bootloaderInfo?.version || '-'}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {isEditing && (
        <div className="form-group">
          <label htmlFor="editName">Generator Name:</label>
          <input
            id="editName"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            disabled={isSaving}
          />
        </div>
      )}

      {/* Mobile code toggle button */}
      <div className="mobile-code-toggle">
        <button 
          onClick={() => setShowCodeOnMobile(!showCodeOnMobile)}
          className="toggle-code-btn"
        >
          {showCodeOnMobile ? 'Hide Code' : 'Show Code'}
        </button>
      </div>

      <div className="editor-container">
        <CodeEditor
          value={isEditing ? editCode : formatCodeWithDescription(generator.description || '', generator.code)}
          onChange={isEditing ? setEditCode : () => {}}
          height="100%"
          readOnly={!isEditing}
          className={showCodeOnMobile ? 'show-on-mobile' : ''}
          forkButton={!isEditing ? (
            <button 
              className="fork-btn"
              onClick={handleFork}
              title="Fork this generator"
            >
              ⑂
            </button>
          ) : null}
        />
        
        <div className="preview-panel">
          <div className="preview-header">
            <span>Live Preview</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="loading-indicator">updating...</span>
              <PreviewControls
                seed={previewSeed}
                onSeedChange={setPreviewSeed}
                onRefresh={refreshPreview}
                showRefresh={true}
              />
              <button 
                className="fullscreen-btn"
                onClick={() => setShowFullscreenPreview(true)}
                title="View fullscreen"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
          <SVGPreview 
            code={isEditing ? editCode : generator.code}
            seed={previewSeed}
            width={400}
            height={400}
            noPadding={true}
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* Sale progress and info */}
      {generator.sale && (
        <div className="sale-progress">
          <div className="sale-info">
            <div className="sale-info-left">
              <span className="sale-editions">
                {generator.nTokens || 0} / {generator.sale.editions || 0} minted
              </span>
              <span className="sale-price">
                {(generator.sale.price / 1000000).toFixed(2)} XTZ
              </span>
            </div>
            {generator.sale.start_time && countdown && (
              <div className="sale-info-right">
                <span className="sale-countdown">Starts in {countdown}</span>
              </div>
            )}
          </div>
          <div className="progress-bar">
            <div 
              className={`progress-fill ${generator.sale.start_time && countdown ? 'scheduled' : 'active'}`}
              style={{ 
                width: `${generator.sale.editions > 0 ? Math.round(((generator.nTokens || 0) / generator.sale.editions) * 100) : 0}%` 
              }}
            ></div>
          </div>
        </div>
      )}

      <div className="actions">
        <div className="actions-left">
          {isAuthor && !isEditing && (
            <>
              <button onClick={handleEdit}>Edit Generator</button>
              <button onClick={handleShowSaleForm}>
                {generator.sale ? 'Update Sale' : 'Set Sale'}
              </button>
            </>
          )}

          {isEditing && (
            <>
              <button onClick={handleCancelEdit} disabled={isSaving}>Cancel</button>
              <button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              {/* Storage Cost Display for Generator Updates - shown when editing */}
              <div className="action-with-cost">
                <div className="storage-cost">
                  <div className="storage-cost-label">Storage fee for changes:</div>
                  <div className="storage-cost-value">
                    {(() => {
                      // Calculate byte differences for the update
                      const { description: newDescription, code: newCleanCode } = parseDescription(editCode);
                      
                      const oldNameBytes = getByteLength(generator.name || "");
                      const oldDescriptionBytes = getByteLength(generator.description || "");
                      const oldCodeBytes = getByteLength(generator.code || "");
                      
                      const newNameBytes = getByteLength(editName.trim());
                      const newDescriptionBytes = getByteLength(newDescription);
                      const newCodeBytes = getByteLength(newCleanCode);
                      
                      const cost = estimateUpdateGenerator(
                        oldNameBytes, oldDescriptionBytes, oldCodeBytes,
                        newNameBytes, newDescriptionBytes, newCodeBytes
                      );
                      
                      return formatStorageCost(cost);
                    })()}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="actions-right">
          <div className="action-with-cost">
            <button 
              onClick={handleMint}
              disabled={isMintDisabled()}
              className="mint-button"
            >
              {isMinting ? 'Minting...' : getMintButtonText()}
            </button>
            {/* Storage Cost Display for Minting */}
            {generator.sale && (
              <div className="storage-cost">
                <div className="storage-cost-label">Onchain inscription fee:</div>
                <div className="storage-cost-value">
                  {(() => {
                    const nameBytes = getByteLength(generator.name || `Generator #${generator.id}`);
                    // Use encoded code length to match what gets stored on-chain during minting
                    const encodedCode = encodeURIComponent(generator.code);
                    const codeBytes = getByteLength(encodedCode);
                    const cost = estimateMint(nameBytes, codeBytes);
                    return formatStorageCost(cost);
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {showSaleForm && (
        <div className="sale-form">
          <h3>{generator.sale ? 'Update Sale Configuration' : 'Set Sale Configuration'}</h3>
          
          <div className="form-group">
            <label htmlFor="salePrice">Price (XTZ):</label>
            <input
              id="salePrice"
              type="number"
              step="0.01"
              min="0"
              value={saleFormData.price}
              onChange={(e) => setSaleFormData({...saleFormData, price: e.target.value})}
              disabled={isSavingSale}
              placeholder="e.g. 1.5"
            />
          </div>

          <div className="form-group">
            <label htmlFor="saleEditions">Number of Editions:</label>
            <input
              id="saleEditions"
              type="number"
              min="1"
              value={saleFormData.editions}
              onChange={(e) => setSaleFormData({...saleFormData, editions: e.target.value})}
              disabled={isSavingSale}
              placeholder="e.g. 100"
            />
          </div>

          <div className="form-group">
            <label htmlFor="saleStartTime">Start Time (optional):</label>
            <input
              id="saleStartTime"
              type="datetime-local"
              value={saleFormData.startTime}
              onChange={(e) => setSaleFormData({...saleFormData, startTime: e.target.value})}
              disabled={isSavingSale}
            />
            <small>Leave empty for immediate start</small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={saleFormData.paused}
                onChange={(e) => setSaleFormData({...saleFormData, paused: e.target.checked})}
                disabled={isSavingSale}
              />
              Pause sale
            </label>
          </div>

          <div className="actions">
            <button onClick={handleCancelSaleForm} disabled={isSavingSale}>
              Cancel
            </button>
            <button onClick={handleSaveSale} disabled={isSavingSale}>
              {isSavingSale ? 'Saving...' : 'Save Sale Configuration'}
            </button>
          </div>
        </div>
      )}

      <div className="latest-mints">
        <h3>Latest Mints</h3>
        {tokensLoading ? (
          <div className="loading">Loading latest tokens...</div>
        ) : latestTokens.length === 0 ? (
          <div className="empty-state">
            <p>No tokens minted yet.</p>
          </div>
        ) : (
          <div className="tokens-grid">
            {latestTokens.map((token) => {
              return (
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
                      alt={`${generator.name || `Generator #${generator.id}`} #${token.tokenId}`}
                      maxRetries={8}
                      retryDelay={3000}
                    />
                  </div>
                  <div className="token-card-info">
                    <div className="token-card-name">
                      {token.name || `${generator.name || `Generator #${generator.id}`} #${token.tokenId}`}
                    </div>
                    <div className="token-card-owner">
                      owned by {token.owner.slice(0, 6)}...{token.owner.slice(-4)}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Mint Success Popup */}
      <MintSuccessPopup
        isOpen={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
        tokenName={mintedTokenData?.tokenName}
        tokenId={mintedTokenData?.tokenId}
        generatorName={mintedTokenData?.generatorName}
        authorTwitter={mintedTokenData?.authorTwitter}
        authorDisplayName={mintedTokenData?.authorDisplayName}
        svgDataUri={mintedTokenData?.svgDataUri}
        objktUrl={mintedTokenData?.objktUrl}
        generatorUrl={mintedTokenData?.generatorUrl}
      />

      {/* Fullscreen Preview Modal */}
      {showFullscreenPreview && (
        <div className="fullscreen-modal" onClick={() => setShowFullscreenPreview(false)}>
          <div className="fullscreen-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-modal-header">
              <h2>{generator.name || `Generator #${generator.id}`}</h2>
              <div className="fullscreen-controls">
                <PreviewControls
                  seed={previewSeed}
                  onSeedChange={setPreviewSeed}
                  onRefresh={refreshPreview}
                  showRefresh={true}
                />
                <button 
                  className="close-fullscreen-btn"
                  onClick={() => setShowFullscreenPreview(false)}
                  title="Close fullscreen"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="fullscreen-preview">
              <SVGPreview 
                code={isEditing ? editCode : generator.code}
                seed={previewSeed}
                width={Math.min(window.innerWidth - 100, window.innerHeight - 150)}
                height={Math.min(window.innerWidth - 100, window.innerHeight - 150)}
                noPadding={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
