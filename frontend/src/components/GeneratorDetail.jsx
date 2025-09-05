import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tezosService } from '../services/tezos.js';
import CodeEditor from './CodeEditor.jsx';
import SVGPreview from './SVGPreview.jsx';
import PreviewControls from './PreviewControls.jsx';

export default function GeneratorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [generator, setGenerator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [previewSeed, setPreviewSeed] = useState(Math.floor(Math.random() * 1000000));

  useEffect(() => {
    loadGenerator();
  }, [id]);

  const loadGenerator = async () => {
    try {
      setLoading(true);
      setError(null);
      const generators = await tezosService.getGenerators();
      const foundGenerator = generators.find(g => g.id === parseInt(id));
      
      if (foundGenerator) {
        setGenerator(foundGenerator);
        setEditName(foundGenerator.name);
        setEditCode(foundGenerator.code);
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
    setEditCode(generator.code);
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
      const result = await tezosService.updateGenerator(
        parseInt(id), 
        editName.trim(), 
        editCode.trim()
      );
      
      if (result.success) {
        setSuccess(`Generator updated successfully! Transaction: ${result.hash}`);
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
      setError('Please connect your wallet first');
      return;
    }

    setIsMinting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await tezosService.mintToken(parseInt(id));
      
      if (result.success) {
        setSuccess(`Token minted successfully! Transaction: ${result.hash}`);
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

  const handleFork = () => {
    // Navigate to create page with the generator's code pre-filled
    navigate('/create', { 
      state: { 
        forkCode: generator.code,
        forkName: `Fork of ${generator.name || `Generator #${generator.id}`}`
      } 
    });
  };

  const refreshPreview = () => {
    // Force a re-render with the same seed by updating a dummy state or triggering SVGPreview refresh
    // We can do this by temporarily changing the seed and then setting it back
    const currentSeed = previewSeed;
    setPreviewSeed(currentSeed + 0.1); // Tiny change to trigger re-render
    setTimeout(() => setPreviewSeed(currentSeed), 10); // Set back to original
  };

  const isAuthor = generator && tezosService.userAddress === generator.author;

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
      <h1>{generator.name || `Generator #${generator.id}`}</h1>
      <p>by {generator.author}</p>
      {generator.description && <p>{generator.description}</p>}
      
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

      <div className="editor-container">
        <CodeEditor
          value={isEditing ? editCode : generator.code}
          onChange={isEditing ? setEditCode : () => {}}
          height="60vh"
          readOnly={!isEditing}
          forkButton={!isAuthor && !isEditing ? (
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
            </div>
          </div>
          <SVGPreview 
            code={isEditing ? editCode : generator.code}
            seed={previewSeed}
            width={400}
            height={400}
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="actions">
        <button onClick={() => navigate('/')}>Back to Home</button>
        
        <button 
          onClick={handleMint}
          disabled={isMinting || !tezosService.isConnected}
        >
          {isMinting ? 'Minting...' : 'Mint Token'}
        </button>

        {isAuthor && !isEditing && (
          <button onClick={handleEdit}>Edit Generator</button>
        )}

        {isEditing && (
          <>
            <button onClick={handleCancelEdit} disabled={isSaving}>Cancel</button>
            <button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        )}
      </div>

      {!tezosService.isConnected && (
        <div className="error">
          Please connect your wallet to mint or edit
        </div>
      )}
    </div>
  );
}
