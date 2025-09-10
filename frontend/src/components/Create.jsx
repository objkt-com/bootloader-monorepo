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
  const [previewIterationNumber, setPreviewIterationNumber] = useState(0);
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

  // Default example generator
const defaultCode = `/**
 * bootloader: v0.0.1
 */

bl.svg.setAttribute('viewBox', '0 0 400 400');

// Create 5 random circles
for (let i = 0; i < 5; i++) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  
  circle.setAttribute('cx', 60 + bl.rnd() * 280);
  circle.setAttribute('cy', 60 + bl.rnd() * 280);
  circle.setAttribute('r', 20 + bl.rnd() * 40);
  circle.setAttribute('fill', \`hsl(\${bl.rnd() * 360}, 70%, 60%)\`);
  circle.setAttribute('opacity', 0.8);
  
  bl.svg.appendChild(circle);
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
    // Force a re-render with the same seed by updating a dummy state or triggering SVGPreview refresh
    // We can do this by temporarily changing the seed and then setting it back
    const currentSeed = previewSeed;
    setPreviewSeed(currentSeed + 0.1); // Tiny change to trigger re-render
    setTimeout(() => setPreviewSeed(currentSeed), 10); // Set back to original
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
      // Parse description from code
      const { description, code: cleanCode } = parseDescription(code);
      
      const result = await tezosService.createGenerator(name.trim(), cleanCode, description);
      
      if (result.success) {
        setSuccess(`Generator created successfully!`);
        // Get the next generator ID to navigate to the new generator page
        try {
          const nextId = await tezosService.getNextGeneratorId();
          const newGeneratorId = nextId - 1; // The ID that was just created
          
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
            const { description, code: cleanCode } = parseDescription(code);
            const nameBytes = getByteLength(name.trim());
            const descriptionBytes = getByteLength(description);
            const encodedCode = encodeURIComponent(cleanCode);
            const codeBytes = getByteLength(encodedCode);
            const cost = estimateCreateGenerator(nameBytes, descriptionBytes, codeBytes);
            return cost.tez > 8;
          })()}
        >
          {isCreating ? 'Creating...' : 'Create Generator'}
        </button>
          {/* Storage Cost Display */}
          {code.trim() && (
            <div className="storage-cost">
              <div className="storage-cost-label">Onchain inscription fee:</div>
              <div className="storage-cost-value">
                {(() => {
                  const { description, code: cleanCode } = parseDescription(code);
                  const nameBytes = getByteLength(name.trim());
                  const descriptionBytes = getByteLength(description);
                  // Use encoded code length to match what gets stored on-chain
                  const encodedCode = encodeURIComponent(cleanCode);
                  const codeBytes = getByteLength(encodedCode);
                  const cost = estimateCreateGenerator(nameBytes, descriptionBytes, codeBytes);
                  
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
