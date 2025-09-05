import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { tezosService } from '../services/tezos.js';
import CodeEditor from './CodeEditor.jsx';
import SVGPreview from './SVGPreview.jsx';
import PreviewControls from './PreviewControls.jsx';

export default function Create() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [previewSeed, setPreviewSeed] = useState(Math.floor(Math.random() * 1000000));
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

  // Default generative svgKT logo generator
  const defaultCode = `/*
 * Generative svgKT logo - creates the logo in different styles
 * This comment is stored as the generator's description on-chain.
 * (c) 2025 svgKT
 */

svg.style.backgroundColor = "white";
svg.setAttribute("viewBox", "0 0 100 100");
NS = "http://www.w3.org/2000/svg";
const colors = ["#000", "#333", "#666", "#999"];
let style = rnd() * 4 | 0;

function text(t, x, y, s, c) {
  let e = document.createElementNS(NS, "text");
  e.textContent = t;
  e.setAttribute("x", x);
  e.setAttribute("y", y);
  e.setAttribute("font-size", s);
  e.setAttribute("font-family", "monospace");
  e.setAttribute("font-weight", "bold");
  e.setAttribute("fill", c);
  e.setAttribute("text-anchor", "middle");
  svg.appendChild(e);
}

if (style == 0) {
  // Wavy letters
  for (let i = 0; i < 5; i++) {
    let x = 10 + i * 16;
    let y = 50 + Math.sin(i + rnd() * 6) * 8;
    text("svgKT"[i], x, y, 12 + rnd() * 4, colors[rnd() * 4 | 0]);
  }
} else if (style == 1) {
  // Letters with background rectangles
  let chars = "svgKT";
  for (let i = 0; i < chars.length; i++) {
    let x = 10 + i * 16, y = 50;
    let r = document.createElementNS(NS, "rect");
    r.setAttribute("x", x - 6);
    r.setAttribute("y", y - 8);
    r.setAttribute("width", 12);
    r.setAttribute("height", 16);
    r.setAttribute("fill", colors[rnd() * 4 | 0]);
    r.setAttribute("opacity", 0.3 + rnd() * 0.4);
    svg.appendChild(r);
    text(chars[i], x, y, 12, "#000");
  }
} else if (style == 2) {
  // Logo with background circles
  let t = "svgKT";
  for (let i = 0; i < 15; i++) {
    let x = rnd() * 100, y = rnd() * 100;
    let c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", x);
    c.setAttribute("cy", y);
    c.setAttribute("r", 2 + rnd() * 6);
    c.setAttribute("fill", colors[rnd() * 4 | 0]);
    c.setAttribute("opacity", 0.1 + rnd() * 0.3);
    svg.appendChild(c);
  }
  text(t, 50, 50, 18, "#000");
} else {
  // Circular arrangement
  let g = document.createElementNS(NS, "g");
  g.setAttribute("transform", \`translate(50,50) rotate(\${rnd() * 360})\`);
  for (let i = 0; i < 5; i++) {
    let a = i * 72 * Math.PI / 180;
    let x = Math.cos(a) * 15, y = Math.sin(a) * 15;
    text("svgKT"[i], x, y, 10, colors[rnd() * 4 | 0]);
  }
  svg.appendChild(g);
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

  const handleCreate = async () => {
    if (!tezosService.isConnected) {
      setError('Please connect your wallet first');
      return;
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
          height="60vh"
        />
        
        <div className="preview-panel">
          <div className="preview-header">
            <span>Live Preview</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="loading-indicator">updating...</span>
              <PreviewControls
                seed={previewSeed}
                onSeedChange={setPreviewSeed}
              />
              <button 
                className="fullscreen-btn"
                onClick={() => setShowFullscreenPreview(true)}
                title="View fullscreen"
              >
                ⛶
              </button>
            </div>
          </div>
          <SVGPreview 
            code={code}
            seed={previewSeed}
            width={400}
            height={400}
            noPadding={true}
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="actions">
        <button onClick={() => navigate('/')}>Cancel</button>
        <button 
          onClick={handleCreate}
          disabled={isCreating || !tezosService.isConnected}
        >
          {isCreating ? 'Creating...' : 'Create Generator'}
        </button>
      </div>

      {!tezosService.isConnected && (
        <div className="error">
          Please connect your wallet to create a generator
        </div>
      )}

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
                />
                <button 
                  className="close-fullscreen-btn"
                  onClick={() => setShowFullscreenPreview(false)}
                  title="Close fullscreen"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="fullscreen-preview">
              <SVGPreview 
                code={code}
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
