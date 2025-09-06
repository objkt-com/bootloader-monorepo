import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { tezosService } from '../services/tezos.js';
import CodeEditor from './CodeEditor.jsx';
import SVGPreview from './SVGPreview.jsx';
import PreviewControls from './PreviewControls.jsx';
import { estimateCreateGenerator, getByteLength, formatStorageCost } from '../utils/storageCost.js';

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
 * Hyperdimensional svgKT - Cutting-Edge Animated Physics Logo
 * Features: SVG shaders, morphing geometry, particle systems, 
 * fractal noise, chromatic aberration, temporal distortions,
 * neural network patterns, and quantum field animations
 */

svg = document.documentElement;
svg.setAttribute("viewBox", "0 0 400 400");

// Extreme variation parameters - each generation is dramatically different
let seed = rnd();
let morphType = Math.floor(rnd() * 5); // 5 completely different visual styles
let timeScale = 0.5 + rnd() * 3;
let complexity = Math.floor(rnd() * 4) + 2;
let energyMode = Math.floor(rnd() * 4);
let dimensionShift = rnd() * 8;

// Dynamic color system with extreme variation
let baseHue = rnd() * 360;
let colorIntensity = 0.4 + rnd() * 0.6;
let chromaShift = 60 + rnd() * 120;

// Create advanced SVG definitions with shaders and filters
let defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

// Fractal noise turbulence filter
let turbulence = document.createElementNS("http://www.w3.org/2000/svg", "feTurbulence");
turbulence.setAttribute("baseFrequency", (0.01 + rnd() * 0.04) + " " + (0.01 + rnd() * 0.04));
turbulence.setAttribute("numOctaves", complexity);
turbulence.setAttribute("result", "noise");

let displace = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap");
displace.setAttribute("in", "SourceGraphic");
displace.setAttribute("in2", "noise");
displace.setAttribute("scale", 15 + rnd() * 25);

let noiseFilter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
noiseFilter.setAttribute("id", "fractalNoise");
noiseFilter.appendChild(turbulence);
noiseFilter.appendChild(displace);

// Glow filter
let blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
blur.setAttribute("stdDeviation", 3 + rnd() * 5);
blur.setAttribute("result", "coloredBlur");

let glowFilter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
glowFilter.setAttribute("id", "glow");
glowFilter.appendChild(blur);

// Morphing gradient with extreme variation
let morphGrad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
morphGrad.setAttribute("id", "morphGrad");
morphGrad.setAttribute("cx", (30 + rnd() * 40) + "%");
morphGrad.setAttribute("cy", (30 + rnd() * 40) + "%");

// Animated gradient stops
for (let i = 0; i < 5; i++) {
  let stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  stop.setAttribute("offset", (i * 25) + "%");
  
  let hue = (baseHue + i * chromaShift + rnd() * 40) % 360;
  let sat = 50 + rnd() * 40;
  let light = 3 + rnd() * 12;
  
  stop.setAttribute("stop-color", "hsl(" + hue + ", " + sat + "%, " + light + "%)");
  stop.setAttribute("stop-opacity", 0.7 + rnd() * 0.3);
  
  morphGrad.appendChild(stop);
}

defs.appendChild(noiseFilter);
defs.appendChild(glowFilter);
defs.appendChild(morphGrad);
svg.appendChild(defs);

// Animated background
let bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
bg.setAttribute("width", "400");
bg.setAttribute("height", "400");
bg.setAttribute("fill", "url(#morphGrad)");
if (rnd() < 0.6) bg.setAttribute("filter", "url(#fractalNoise)");
svg.appendChild(bg);

// Generate dramatically different visual styles based on morphType
if (morphType === 0) {
  // Neural Network Style with animated connections
  let nodes = [];
  for (let node = 0; node < 25 + rnd() * 35; node++) {
    let x = 50 + rnd() * 300;
    let y = 50 + rnd() * 300;
    let r = 2 + rnd() * 6;
    nodes.push({x, y, r});
    
    let neuron = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    neuron.setAttribute("cx", x);
    neuron.setAttribute("cy", y);
    neuron.setAttribute("r", r);
    neuron.setAttribute("fill", "hsl(" + (baseHue + rnd() * 80) + ", 80%, 65%)");
    neuron.setAttribute("opacity", 0.8);
    neuron.setAttribute("filter", "url(#glow)");
    
    // Pulsing animation
    let pulse = document.createElementNS("http://www.w3.org/2000/svg", "animate");
    pulse.setAttribute("attributeName", "r");
    pulse.setAttribute("values", r + "; " + (r * 1.8) + "; " + r);
    pulse.setAttribute("dur", (1.5 + rnd() * 2.5) + "s");
    pulse.setAttribute("repeatCount", "indefinite");
    neuron.appendChild(pulse);
    
    svg.appendChild(neuron);
  }
  
  // Create animated connections
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (rnd() < 0.15) {
        let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", nodes[i].x);
        line.setAttribute("y1", nodes[i].y);
        line.setAttribute("x2", nodes[j].x);
        line.setAttribute("y2", nodes[j].y);
        line.setAttribute("stroke", "hsl(" + (baseHue + 40) + ", 70%, 50%)");
        line.setAttribute("stroke-width", 0.5 + rnd() * 1.5);
        line.setAttribute("opacity", 0.3);
        
        let strokeAnim = document.createElementNS("http://www.w3.org/2000/svg", "animate");
        strokeAnim.setAttribute("attributeName", "stroke-opacity");
        strokeAnim.setAttribute("values", "0.1; 0.7; 0.1");
        strokeAnim.setAttribute("dur", (2 + rnd() * 3) + "s");
        strokeAnim.setAttribute("repeatCount", "indefinite");
        line.appendChild(strokeAnim);
        
        svg.appendChild(line);
      }
    }
  }
  
} else if (morphType === 1) {
  // Particle System Style
  for (let p = 0; p < 80 + rnd() * 120; p++) {
    let x = rnd() * 400;
    let y = rnd() * 400;
    let r = 1 + rnd() * 4;
    let speed = 0.5 + rnd() * 2;
    
    let particle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    particle.setAttribute("cx", x);
    particle.setAttribute("cy", y);
    particle.setAttribute("r", r);
    particle.setAttribute("fill", "hsl(" + (baseHue + rnd() * 120) + ", 75%, 60%)");
    particle.setAttribute("opacity", 0.6 + rnd() * 0.4);
    
    // Orbital motion
    let orbit = document.createElementNS("http://www.w3.org/2000/svg", "animateTransform");
    orbit.setAttribute("attributeName", "transform");
    orbit.setAttribute("type", "rotate");
    orbit.setAttribute("values", "0 200 200; 360 200 200");
    orbit.setAttribute("dur", (8 + rnd() * 15) + "s");
    orbit.setAttribute("repeatCount", "indefinite");
    particle.appendChild(orbit);
    
    // Size pulsing
    let sizePulse = document.createElementNS("http://www.w3.org/2000/svg", "animate");
    sizePulse.setAttribute("attributeName", "r");
    sizePulse.setAttribute("values", r + "; " + (r * 2.5) + "; " + r);
    sizePulse.setAttribute("dur", (1 + rnd() * 2) + "s");
    sizePulse.setAttribute("repeatCount", "indefinite");
    particle.appendChild(sizePulse);
    
    svg.appendChild(particle);
  }
  
} else if (morphType === 2) {
  // Geometric Morphing Style
  for (let shape = 0; shape < 8 + rnd() * 12; shape++) {
    let cx = 100 + rnd() * 200;
    let cy = 100 + rnd() * 200;
    let size = 20 + rnd() * 40;
    
    if (rnd() < 0.5) {
      // Morphing polygons
      let sides = 3 + Math.floor(rnd() * 5);
      let points = "";
      for (let i = 0; i < sides; i++) {
        let angle = (i / sides) * Math.PI * 2;
        let x = cx + Math.cos(angle) * size;
        let y = cy + Math.sin(angle) * size;
        points += x + "," + y + " ";
      }
      
      let poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      poly.setAttribute("points", points);
      poly.setAttribute("fill", "none");
      poly.setAttribute("stroke", "hsl(" + (baseHue + shape * 30) + ", 70%, 55%)");
      poly.setAttribute("stroke-width", 2 + rnd() * 3);
      poly.setAttribute("opacity", 0.7);
      
      // Rotation animation
      let rotate = document.createElementNS("http://www.w3.org/2000/svg", "animateTransform");
      rotate.setAttribute("attributeName", "transform");
      rotate.setAttribute("type", "rotate");
      rotate.setAttribute("values", "0 " + cx + " " + cy + "; 360 " + cx + " " + cy);
      rotate.setAttribute("dur", (4 + rnd() * 8) + "s");
      rotate.setAttribute("repeatCount", "indefinite");
      poly.appendChild(rotate);
      
      svg.appendChild(poly);
    } else {
      // Morphing circles to ellipses
      let ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      ellipse.setAttribute("cx", cx);
      ellipse.setAttribute("cy", cy);
      ellipse.setAttribute("rx", size);
      ellipse.setAttribute("ry", size * 0.6);
      ellipse.setAttribute("fill", "hsl(" + (baseHue + shape * 25) + ", 60%, 45%)");
      ellipse.setAttribute("opacity", 0.5);
      
      // Morphing animation
      let morphRx = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      morphRx.setAttribute("attributeName", "rx");
      morphRx.setAttribute("values", size + "; " + (size * 2) + "; " + size);
      morphRx.setAttribute("dur", (3 + rnd() * 4) + "s");
      morphRx.setAttribute("repeatCount", "indefinite");
      ellipse.appendChild(morphRx);
      
      svg.appendChild(ellipse);
    }
  }
  
} else if (morphType === 3) {
  // Wave Interference Style
  for (let wave = 0; wave < 15 + rnd() * 20; wave++) {
    let path = "M";
    let startX = rnd() * 400;
    let startY = 100 + rnd() * 200;
    let freq = 0.02 + rnd() * 0.08;
    let amp = 10 + rnd() * 30;
    
    for (let x = 0; x < 400; x += 3) {
      let y = startY + Math.sin(x * freq + wave) * amp;
      path += (x === 0 ? "" : " L") + (startX + x - 200) + " " + y;
    }
    
    let wavePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    wavePath.setAttribute("d", path);
    wavePath.setAttribute("stroke", "hsl(" + (baseHue + wave * 15) + ", 65%, 50%)");
    wavePath.setAttribute("stroke-width", 1 + rnd() * 2);
    wavePath.setAttribute("fill", "none");
    wavePath.setAttribute("opacity", 0.6);
    
    // Wave animation
    let waveAnim = document.createElementNS("http://www.w3.org/2000/svg", "animateTransform");
    waveAnim.setAttribute("attributeName", "transform");
    waveAnim.setAttribute("type", "translate");
    waveAnim.setAttribute("values", "0 0; " + (20 * (rnd() - 0.5)) + " " + (10 * (rnd() - 0.5)) + "; 0 0");
    waveAnim.setAttribute("dur", (4 + rnd() * 6) + "s");
    waveAnim.setAttribute("repeatCount", "indefinite");
    wavePath.appendChild(waveAnim);
    
    svg.appendChild(wavePath);
  }
  
} else {
  // Quantum Field Style
  for (let field = 0; field < 60 + rnd() * 80; field++) {
    let x = rnd() * 400;
    let y = rnd() * 400;
    let intensity = rnd();
    
    if (intensity > 0.3) {
      let dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("r", 1 + intensity * 3);
      dot.setAttribute("fill", "hsl(" + (baseHue + intensity * 180) + ", 80%, 70%)");
      dot.setAttribute("opacity", intensity);
      
      // Quantum fluctuation
      let fluctuate = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      fluctuate.setAttribute("attributeName", "opacity");
      fluctuate.setAttribute("values", "0.2; " + intensity + "; 0.2");
      fluctuate.setAttribute("dur", (0.5 + rnd() * 1.5) + "s");
      fluctuate.setAttribute("repeatCount", "indefinite");
      dot.appendChild(fluctuate);
      
      svg.appendChild(dot);
    }
  }
}

// Create animated svgKT letters with extreme variation
let letters = "svgKT";
let letterSpacing = 60 + rnd() * 20;
let startX = 40 + rnd() * 20;

for (let i = 0; i < letters.length; i++) {
  let x = startX + i * letterSpacing;
  let y = 200 + (rnd() - 0.5) * 40;
  let char = letters[i];
  let fontSize = 45 + rnd() * 20;
  
  // Create multiple letter layers for depth
  for (let layer = 0; layer < 3; layer++) {
    let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.textContent = char;
    text.setAttribute("x", x + layer * 2);
    text.setAttribute("y", y + layer * 1.5);
    text.setAttribute("font-family", "monospace");
    text.setAttribute("font-weight", layer === 0 ? "900" : "400");
    text.setAttribute("font-size", fontSize * (1 - layer * 0.1));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "hsl(" + (baseHue + layer * 60 + i * 30) + ", 75%, " + (70 - layer * 10) + "%)");
    text.setAttribute("opacity", 0.9 - layer * 0.2);
    
    if (layer === 0) text.setAttribute("filter", "url(#glow)");
    
    // Letter animations
    if (energyMode === 0) {
      // Floating animation
      let float = document.createElementNS("http://www.w3.org/2000/svg", "animateTransform");
      float.setAttribute("attributeName", "transform");
      float.setAttribute("type", "translate");
      float.setAttribute("values", "0 0; 0 " + (-5 - rnd() * 10) + "; 0 0");
      float.setAttribute("dur", (2 + rnd() * 3) + "s");
      float.setAttribute("repeatCount", "indefinite");
      text.appendChild(float);
    } else if (energyMode === 1) {
      // Rotation animation
      let rotate = document.createElementNS("http://www.w3.org/2000/svg", "animateTransform");
      rotate.setAttribute("attributeName", "transform");
      rotate.setAttribute("type", "rotate");
      rotate.setAttribute("values", "0 " + x + " " + y + "; " + (360 * (rnd() - 0.5)) + " " + x + " " + y);
      rotate.setAttribute("dur", (8 + rnd() * 12) + "s");
      rotate.setAttribute("repeatCount", "indefinite");
      text.appendChild(rotate);
    } else if (energyMode === 2) {
      // Scale pulsing
      let scale = document.createElementNS("http://www.w3.org/2000/svg", "animateTransform");
      scale.setAttribute("attributeName", "transform");
      scale.setAttribute("type", "scale");
      scale.setAttribute("values", "1; " + (1.2 + rnd() * 0.5) + "; 1");
      scale.setAttribute("dur", (1.5 + rnd() * 2) + "s");
      scale.setAttribute("repeatCount", "indefinite");
      text.appendChild(scale);
    } else {
      // Color shifting
      let colorShift = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      colorShift.setAttribute("attributeName", "fill");
      colorShift.setAttribute("values", "hsl(" + (baseHue + i * 30) + ", 75%, 70%); hsl(" + ((baseHue + 180) % 360) + ", 75%, 70%); hsl(" + (baseHue + i * 30) + ", 75%, 70%)");
      colorShift.setAttribute("dur", (3 + rnd() * 4) + "s");
      colorShift.setAttribute("repeatCount", "indefinite");
      text.appendChild(colorShift);
    }
    
    svg.appendChild(text);
  }
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

  const refreshPreview = () => {
    // Force a re-render with the same seed by updating a dummy state or triggering SVGPreview refresh
    // We can do this by temporarily changing the seed and then setting it back
    const currentSeed = previewSeed;
    setPreviewSeed(currentSeed + 0.1); // Tiny change to trigger re-render
    setTimeout(() => setPreviewSeed(currentSeed), 10); // Set back to original
  };

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
                onRefresh={refreshPreview}
                showRefresh={true}
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
        <div className="action-with-cost">
        <button 
          onClick={handleCreate}
          disabled={isCreating || !tezosService.isConnected || (() => {
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
                  onRefresh={refreshPreview}
                  showRefresh={true}
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
