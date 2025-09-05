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
  const navigate = useNavigate();
  const location = useLocation();

  // Default example code - matches what's stored on-chain
  const defaultCode = `W=400,H=400,NS="http://www.w3.org/2000/svg";for(let i=0;i<80;i++){let t=5+(90*rnd()|0),e=t+(rnd()*(400-2*t)|0),n=t+(rnd()*(400-2*t)|0),$=document.createElementNS(NS,"circle");$.setAttribute("cx",e),$.setAttribute("cy",n),$.setAttribute("r",t),$.setAttribute("fill","black"),svg.appendChild($)}const text=document.createElementNS(NS,"text");text.textContent=TOKEN_ID,text.setAttribute("x",200),text.setAttribute("y",200),text.setAttribute("fill","white"),text.setAttribute("font-size","120"),text.setAttribute("font-family","monospace"),text.setAttribute("text-anchor","middle"),text.setAttribute("dominant-baseline","middle"),svg.appendChild(text);`;

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
      const result = await tezosService.createGenerator(name.trim(), code.trim());
      
      if (result.success) {
        setSuccess(`Generator created successfully! Transaction: ${result.hash}`);
        setTimeout(() => {
          navigate('/');
        }, 3000);
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
            </div>
          </div>
          <SVGPreview 
            code={code}
            seed={previewSeed}
            width={400}
            height={400}
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
    </div>
  );
}
