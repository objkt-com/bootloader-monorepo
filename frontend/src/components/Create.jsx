import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Maximize2, X } from 'lucide-react';
import { tezosService } from '../services/tezos.js';
import CodeEditor from './CodeEditor.jsx';
import SVGPreview from './SVGPreview.jsx';
import PreviewControls from './PreviewControls.jsx';
import { estimateCreateGenerator, getByteLength, formatStorageCost } from '../utils/storageCost.js';
import { prefetchGeneratorThumbnail } from '../utils/thumbnail.js';
import { useMetaTags, generateMetaTags } from '../hooks/useMetaTags.js';

export default function Create() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [previewSeed, setPreviewSeed] = useState(Math.floor(Math.random() * 1000000));
  const [renderCounter, setRenderCounter] = useState(0);
  const [previewIterationNumber, setPreviewIterationNumber] = useState(1);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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

  // Handle navigation warning when user has made changes
  useEffect(() => {
    const hasChanges = name.trim() !== '' || (code.trim() !== '' && code.trim() !== defaultCode.trim());
    
    const handleBeforeUnload = (event) => {
      if (hasChanges && !isCreating) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    if (hasChanges && !isCreating) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [name, code, isCreating]);

  // Handle React Router navigation warning when user has made changes
  useEffect(() => {
    const hasChanges = name.trim() !== '' || (code.trim() !== '' && code.trim() !== defaultCode.trim());
    
    const handlePopState = (event) => {
      if (hasChanges && !isCreating) {
        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
        if (!confirmLeave) {
          // Push the current state back to prevent navigation
          window.history.pushState(null, '', window.location.pathname);
        }
      }
    };

    if (hasChanges && !isCreating) {
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [name, code, isCreating]);

  // Default example generator
const defaultCode = `/**
 * bootloader: v0.0.1
 */

BTLDR.svg.setAttribute('viewBox', '0 0 400 400');

// Create 5 random circles
for (let i = 0; i < 5; i++) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  
  circle.setAttribute('cx', 60 + BTLDR.rnd() * 280);
  circle.setAttribute('cy', 60 + BTLDR.rnd() * 280);
  circle.setAttribute('r', 20 + BTLDR.rnd() * 40);
  circle.setAttribute('fill', \`hsl(\${BTLDR.rnd() * 360}, 70%, 60%)\`);
  circle.setAttribute('opacity', 0.8);
  
  BTLDR.svg.appendChild(circle);
}`;

  useEffect(() => {
    // Check if we're forking from another generator
    if (location.state?.forkCode) {
      setCode(location.state.forkCode);
      setName(location.state.forkName || '');
    } else {
      setCode(defaultCode);
    }
  }, [location.state]);

  // Set meta tags for create page
  const metaTags = generateMetaTags.create();
  useMetaTags(metaTags);

  const refreshPreview = () => {
    setRenderCounter(prevCounter => prevCounter + 1);
  };

  const handleCreate = async () => {
    if (!tezosService.isConnected) {
      // Trigger wallet connection instead of showing error
      try {
        const connectResult = await tezosService.connectWallet();
        if (!connectResult.success) {
          setError(`Failed to connect wallet: ${connectResult.error}`);
          return;
        }
        // If connection successful, continue with creating
      } catch (err) {
        setError(`Failed to connect wallet: ${err.message}`);
        return;
      }
    }

    if (!name.trim()) {
      setError('Please enter a name for your generator');
      return;
    }

    if (!code.trim()) {
      setError('Please enter some code for your generator');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await tezosService.createGenerator(name.trim(), code);
      
      if (result.success) {
        setSuccess(`Generator created successfully!`);
        // Get the next generator ID to navigate to the new generator page
        try {
          const newGeneratorId = result.generatorId;
          
          // Prefetch generator thumbnail with identical parameters to the ones used in display
          prefetchGeneratorThumbnail(newGeneratorId).catch(err => {
            console.warn('Generator thumbnail prefetch failed:', err);
          });
          
          setTimeout(() => {
            navigate(`/generator/${newGeneratorId}`);
          }, 2000);
        } catch (err) {
          console.error('Failed to get generator ID, navigating to home:', err);
          setTimeout(() => {
            navigate('/');
          }, 2000);
        }
      } else {
        setError(`Failed to create generator: ${result.error}`);
      }
    } catch (err) {
      console.error('Create generator error:', err);
      setError(`Failed to create generator: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container">
      <h1>Create Generator</h1>
      
      <div className="form-group">
        <label htmlFor="name">Generator Name:</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter generator name"
          disabled={isCreating}
        />
      </div>

      <div className="editor-container">
        <CodeEditor
          value={code}
          onChange={setCode}
          height="100%"
          className='show-on-mobile'
        />
        
        <div className="preview-panel">
          <div className="preview-header">
            <span>Live Preview</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="loading-indicator">updating...</span>
              <PreviewControls
                seed={previewSeed}
                onSeedChange={setPreviewSeed}
                iterationNumber={previewIterationNumber}
                onIterationNumberChange={setPreviewIterationNumber}
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
            code={code}
            seed={previewSeed}
            renderCounter={renderCounter}
            iterationNumber={previewIterationNumber}
            width={400}
            height={400}
            noPadding={true}
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="actions" style={{ justifyContent: 'flex-end' }}>
        <div className="action-with-cost">
        <button 
          onClick={handleCreate}
          disabled={isCreating || (() => {
            if (!code.trim()) return false;
            const nameBytes = getByteLength(name.trim());
            const encodedCode = encodeURIComponent(code);
            const codeBytes = getByteLength(encodedCode);
            const cost = estimateCreateGenerator(nameBytes, codeBytes);
            return cost.tez > 8;
          })()}
        >
          {isCreating ? 'creating...' : 'create generator'}
        </button>
          {/* Storage Cost Display */}
          {code.trim() && (
            <div className="storage-cost">
              <div className="storage-cost-label">Onchain inscription fee:</div>
              <div className="storage-cost-value">
                {(() => {
                  const nameBytes = getByteLength(name.trim());
                  // Use encoded code length to match what gets stored on-chain
                  const encodedCode = encodeURIComponent(code);
                  const codeBytes = getByteLength(encodedCode);
                  const cost = estimateCreateGenerator(nameBytes, codeBytes);
                  
                  // Check if cost exceeds 8 tez limit
                  if (cost.tez > 8) {
                    return (
                      <span style={{ color: '#ff6b6b' }}>
                        {formatStorageCost(cost)} - Warning: inscription size will exceed transaction limit. Minting Disabled
                      </span>
                    );
                  }
                  
                  return formatStorageCost(cost);
                })()}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Fullscreen Preview Modal */}
      {showFullscreenPreview && (
        <div className="fullscreen-modal" onClick={() => setShowFullscreenPreview(false)}>
          <div className="fullscreen-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-modal-header">
              <h2>{name || 'Untitled Generator'}</h2>
              <div className="fullscreen-controls">
                <PreviewControls
                  seed={previewSeed}
                  onSeedChange={setPreviewSeed}
                  iterationNumber={previewIterationNumber}
                  onIterationNumberChange={setPreviewIterationNumber}
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
                code={code}
                seed={previewSeed}
                renderCounter={renderCounter}
                iterationNumber={previewIterationNumber}
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
