import { useState } from 'react';
import { Link } from 'react-router-dom';
import CodeEditor from './CodeEditor.jsx';
import SVGPreview from './SVGPreview.jsx';
import PreviewControls from './PreviewControls.jsx';

export default function Help() {
  const [exampleCode, setExampleCode] = useState(`/*
This generator creates colorful circles with random positions and sizes.
Each circle has a unique color based on the deterministic random seed.
*/

(() => {
  svg = document.documentElement;
  svg.setAttribute('viewBox', '0 0 400 400');
  svg.style.cssText = "background:white";

  // Create 5 random circles
  for (let i = 0; i < 5; i++) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    
    // Random position and size
    const x = 50 + rnd() * 300;
    const y = 50 + rnd() * 300;
    const r = 20 + rnd() * 40;
    
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', \`hsl(\${rnd() * 360}, 70%, 60%)\`);
    circle.setAttribute('opacity', 0.8);
    
    svg.appendChild(circle);
  }
})();`);
  
  const [previewSeed, setPreviewSeed] = useState(12345);

  const refreshPreview = () => {
    const currentSeed = previewSeed;
    setPreviewSeed(currentSeed + 0.1);
    setTimeout(() => setPreviewSeed(currentSeed), 10);
  };

  return (
    <div className="help-container">
      <div className="help-content">
        <h1>How svgKT Works</h1>

        <h2>What is svgKT?</h2>
        <p>
          svgKT is an on-chain long-form generative SVG platform built on Tezos. It allows artists and developers
          to create generative art algorithms that produce unique SVG images directly on the blockchain.
          Each piece is truly unique, verifiable, and stored permanently on-chain.
        </p>

        <h2>Generator Storage Structure</h2>
        <p>
          When you create a generator, all data is stored permanently on-chain in a structured format.
          Here are the fields stored for each generator:
        </p>

        <div style={{overflowX: 'auto', marginBottom: '2rem'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
            <thead>
              <tr style={{backgroundColor: '#f5f5f5'}}>
                <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Field</th>
                <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Type</th>
                <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Max Size</th>
                <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Description</th>
                <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Mutable</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}><code>name</code></td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>500 bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>Display name for your generator</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>✅</td>
              </tr>
              <tr>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}><code>description</code></td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>8,000 bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>Extracted from first /* */ comment in code</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>✅</td>
              </tr>
              <tr>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}><code>code</code></td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>30,000 bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>Your JavaScript generator code</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>✅</td>
              </tr>
              <tr>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}><code>author</code></td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>address</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>36 bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>Your Tezos address</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>❌</td>
              </tr>
              <tr>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}><code>author_bytes</code></td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>~44 bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>Hex-encoded address for NFT metadata</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>✅</td>
              </tr>
              <tr>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}><code>created</code></td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>timestamp</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>8 bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>Creation timestamp</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>❌</td>
              </tr>
              <tr>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}><code>last_update</code></td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>timestamp</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>8 bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>Last modification timestamp</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>Auto</td>
              </tr>
              <tr>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}><code>n_tokens</code></td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>nat</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>~4 bytes</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>Number of tokens minted</td>
                <td style={{padding: '10px', borderBottom: '1px solid #eee'}}>Auto</td>
              </tr>
              <tr>
                <td style={{padding: '10px'}}><code>sale</code></td>
                <td style={{padding: '10px'}}>option</td>
                <td style={{padding: '10px'}}>~32 bytes</td>
                <td style={{padding: '10px'}}>Sale configuration (price, editions, etc.)</td>
                <td style={{padding: '10px'}}>✅</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>NFT Assembly During Mint</h2>
        <p>
          When someone mints your generator, the contract assembles a complete SVG using template fragments and creates the NFT metadata.
          Here's the real-time assembly process:
        </p>

        <div className="assembly-diagram">
          <h3 style={{marginTop: '1rem', marginBottom: '1.5rem', textAlign: 'center'}}>NFT Name Assembly</h3>
          <div className="fragment-flow">
            <div className="fragment-box">
              <div className="fragment-header">generator.name</div>
              <div className="fragment-content">
                <code>"Colorful Circles"</code>
                <div className="fragment-note">From generator storage table above</div>
              </div>
            </div>
            
            <div className="assembly-arrow">+</div>
            
            <div className="fragment-box">
              <div className="fragment-header">"#" character</div>
              <div className="fragment-content">
                <code>0x2023</code>
                <div className="fragment-note">Hex encoding of " #" separator</div>
              </div>
            </div>
            
            <div className="assembly-arrow">+</div>
            
            <div className="fragment-box">
              <div className="fragment-header">Iteration Number</div>
              <div className="fragment-content">
                <code>generator.n_tokens + 1</code>
                <div className="fragment-note">Sequential numbering (1, 2, 3...)</div>
              </div>
            </div>
            
            <div className="assembly-result">
              <div className="result-arrow">↓</div>
              <div className="result-box">
                <div className="result-header">Final NFT Name</div>
                <div className="result-content">
                  "Colorful Circles #1", "Colorful Circles #2", etc.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="assembly-diagram">
          <h3 style={{marginTop: '1rem', marginBottom: '1.5rem', textAlign: 'center'}}>SVG Fragment Assembly Process</h3>
          <div className="fragment-flow">
            <div className="fragment-box">
              <div className="fragment-header">
                Fragment 0 
                <a href="https://better-call.dev/ghostnet/KT1V7LKhv83hr7DnKRN1hnqF8yndDj71vNkZ/storage/big_map/477169/exprtZBwZUeYYYfUs9B9Rg2ywHezVHnCCnmF9WsDQVrs582dSK63dC" target="_blank" rel="noopener noreferrer" style={{marginLeft: '8px', fontSize: '12px'}}>
                  (view on-chain)
                </a>
              </div>
              <div className="fragment-content">
                <code>{`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg">
<script><![CDATA[const SEED=`}</code>
              </div>
            </div>
            
            <div className="assembly-arrow">+</div>
            
            <div className="fragment-box entropy">
              <div className="fragment-header">Random Entropy</div>
              <div className="fragment-content">
                <code>a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456</code>
                <div className="fragment-note">Generated from blockchain randomness (SHA256 hash)</div>
              </div>
            </div>
            
            <div className="assembly-arrow">+</div>
            
            <div className="fragment-box">
              <div className="fragment-header">
                Fragment 1
                <a href="https://better-call.dev/ghostnet/KT1V7LKhv83hr7DnKRN1hnqF8yndDj71vNkZ/storage/big_map/477169/expru2dKqDfZG8hu4wNGkiyunvq2hdSKuVYtcKta7BWP6Q18oNxKjS" target="_blank" rel="noopener noreferrer" style={{marginLeft: '8px', fontSize: '12px'}}>
                  (view on-chain)
                </a>
              </div>
              <div className="fragment-content">
                <code>{`n;function splitmix64(t){...}function sfc32(a,b,c,d){...}
const sm=splitmix64(SEED),a=sm(),b=sm(),c=sm(),d=sm(),rnd=sfc32(a,b,c,d);`}</code>
                <div className="fragment-note">Sets up deterministic random number generator</div>
              </div>
            </div>
            
            <div className="assembly-arrow">+</div>
            
            <div className="fragment-box user-code">
              <div className="fragment-header">Your Generator Code</div>
              <div className="fragment-content">
                <pre style={{whiteSpace: 'pre-wrap', wordWrap: 'break-word'}}><code>{`// Your creative code here
svg = document.documentElement;
const circle = document.createElementNS(
  'http://www.w3.org/2000/svg', 'circle');
circle.setAttribute('cx', 200);
circle.setAttribute('cy', 200);
circle.setAttribute('r', 50 + rnd() * 100);
circle.setAttribute('fill', 
  \`hsl(\${rnd() * 360}, 70%, 50%)\`);
svg.appendChild(circle);`}</code></pre>
                <div className="fragment-note">Retrieved from generator.code field</div>
              </div>
            </div>
            
            <div className="assembly-arrow">+</div>
            
            <div className="fragment-box">
              <div className="fragment-header">
                Fragment 2
                <a href="https://better-call.dev/ghostnet/KT1V7LKhv83hr7DnKRN1hnqF8yndDj71vNkZ/storage/big_map/477169/expruDuAZnFKqmLoisJqUGqrNzXTvw7PJM2rYk97JErM5FHCerQqgn" target="_blank" rel="noopener noreferrer" style={{marginLeft: '8px', fontSize: '12px'}}>
                  (view on-chain)
                </a>
              </div>
              <div className="fragment-content">
                <code>{`]]></script>
</svg>`}</code>
              </div>
            </div>
            
            <div className="assembly-result">
              <div className="result-arrow">↓</div>
              <div className="result-box">
                <div className="result-header">Complete On-Chain SVG</div>
                <div className="result-content">
                  A fully executable SVG with embedded JavaScript that generates unique art
                </div>
              </div>
            </div>
          </div>
        </div>

        <h2>Generator Lifecycle</h2>
        <div className="contract-diagram">
          <div className="contract-flow">
            <div className="contract-step">
              <h4>1. Generator Creation</h4>
              <p>Artists create generators by submitting their JavaScript code, name, and description to the blockchain. The generator is stored permanently with metadata including creation time and author.</p>
            </div>
            
            <div className="contract-step">
              <h4>2. Generator Updates</h4>
              <p>Only the original author can update their generator's code, name, or description. The creation date and authorship remain unchanged.</p>
            </div>
            
            <div className="contract-step">
              <h4>3. Sale Configuration</h4>
              <p>Authors configure sales by setting price, edition limits, start time, and pause status. Edition sizes can only be reduced if tokens have already been minted.</p>
            </div>
            
            <div className="contract-step">
              <h4>4. Minting Process</h4>
              <p>Users mint tokens by paying the set price. The contract generates blockchain entropy, assembles the complete SVG by combining fragments with the generator code, and creates an NFT with the SVG as the artifact URI.</p>
            </div>
          </div>
        </div>

        <h2>Generator Description from Comments</h2>
        <p>
          svgKT automatically extracts your generator's description from the first multi-line comment in your code.
          This description is stored on-chain separately from your code and displayed to users when they view your generator.
        </p>
        <div className="description-example">
          <h4>Example:</h4>
          <pre><code>{`/*
This generator creates colorful circles with random positions and sizes.
Each circle has a unique color based on the deterministic random seed.
*/

// Your generator code follows...
svg = document.documentElement;`}</code></pre>
          <p>
            The text inside the first <code>/* */</code> comment block becomes your generator's description.
            Any comments outside of the description section will be written on-chain into the code section.
          </p>
        </div>

        <h2>Storage Costs and Mint Pricing</h2>
        <p>
          Understanding the cost structure of svgKT helps you optimize your generators and set appropriate mint prices.
        </p>
        <div className="pricing-section">
          <div className="pricing-item">
            <h4>On-Chain Storage Costs</h4>
            <p>
              Storing data on-chain costs <strong>250 mutez per byte</strong>. Your code is URL encoded and not minified, 
              so the formatting of your code is part of the aesthetic of the project. This means your indentation, 
              spacing, and code style become permanent parts of the artwork's provenance and are visible when 
              viewing the on-chain data.
            </p>
            <p>
              <strong>Important:</strong> When you edit a stored value, you only pay for the difference in bytes, not the full new size. 
              For example, if your old generator code was 100 bytes and your updated code is 120 bytes, you only pay 
              storage fees for the additional 20 bytes (20 × 250 = 5,000 mutez). This makes iterating and improving 
              your generators more cost-effective.
            </p>
          </div>
          <div className="pricing-item">
            <h4>Minting Costs</h4>
            <p>
              During minting, your generator code is assembled with template fragments and written into the 
              minted token's token-metadata as a complete SVG data URI. Since this data is being stored 
              on-chain again as part of the token, the storage fee (250 mutez per byte) must be paid again 
              by the minter. The larger your code, the higher the minting cost for your collectors.
            </p>
          </div>
        </div>

        <h2>Available Variables in Your Code</h2>
        <div className="variables-section">
          <div className="variable-item">
            <code>SEED</code>
            <p>A random number generated from blockchain entropy, unique for each mint</p>
          </div>
          <div className="variable-item">
            <code>rnd()</code>
            <p>A deterministic random number generator using the SFC32 algorithm, seeded with SEED. Returns values between 0 and 1. Always produces the same sequence for the same SEED, ensuring reproducible artwork.</p>
          </div>
        </div>

        <h2>Example: Simple Generative Circle</h2>
        <p>Try editing the code below to see how changes affect the generated artwork:</p>
        
        <div className="editor-container" style={{height: '350px'}}>
          <CodeEditor
            value={exampleCode}
            onChange={setExampleCode}
            height="300px"
          />
          
          <div className="preview-panel">
            <div className="preview-header">
              <span>Live Preview</span>
              <PreviewControls
                seed={previewSeed}
                onSeedChange={setPreviewSeed}
                onRefresh={refreshPreview}
                showRefresh={true}
              />
            </div>
            <div className="preview-content">
              <SVGPreview 
                code={exampleCode}
                seed={previewSeed}
                width={300}
                height={300}
                noPadding={true}
              />
            </div>
          </div>
        </div>

        <h2>Creating Your First Generator</h2>
        <div className="getting-started">
          <ol>
            <li><strong>Connect your Tezos wallet</strong> - You'll need XTZ for transaction fees</li>
            <li><strong>Click "Create"</strong> - Start with the provided template or write from scratch</li>
            <li><strong>Write your generative code</strong> - Use SVG DOM manipulation and the <code>rnd()</code> function</li>
            <li><strong>Test in the preview</strong> - Try different seeds to see variations</li>
            <li><strong>Deploy to blockchain</strong> - Your code becomes permanently stored on Tezos</li>
            <li><strong>Set up sales</strong> - Configure pricing and edition limits</li>
          </ol>
        </div>

        <h2>Best Practices</h2>
        <div className="best-practices">
          <div className="practice-item">
            <h4>🎯 Use Deterministic Randomness</h4>
            <p>Always use <code>rnd()</code> instead of <code>Math.random()</code> to ensure reproducible results</p>
          </div>
          <div className="practice-item">
            <h4>🔒 Wrap Code in IIFE</h4>
            <p>Wrap your generator code in <code>(() =&gt; {'{}'})();</code> to create a clean scope and avoid variable conflicts with the SVG execution environment</p>
          </div>
          <div className="practice-item">
            <h4>📏 Optimize Code Size</h4>
            <p>Your code is stored on-chain, so keep it concise. Each byte costs storage fees.</p>
          </div>
          <div className="practice-item">
            <h4>🧪 Test Thoroughly</h4>
            <p>Try many different seeds to ensure your generator produces good variations</p>
          </div>
          <div className="practice-item">
            <h4>🎨 Consider Scalability</h4>
            <p>Design your art to look good at different sizes and aspect ratios</p>
          </div>
          <div className="practice-item">
            <h4>⚡ Performance Matters</h4>
            <p>Avoid infinite loops or computationally expensive operations</p>
          </div>
        </div>

        <h2>Important Information</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h4>Royalties & Fees</h4>
            <p>Each token includes a default 5% royalty fee for the creator. The platform takes a 20% fee on primary sales, with secondary sales happening on objkt.</p>
          </div>
          <div className="feature-card">
            <h4>Creator Verification</h4>
            <p>To attribute tokens to your account on objkt, go to your profile → Collaborations → Creator Verifications and verify your Tezos address.</p>
          </div>
          <div className="feature-card">
            <h4>Thumbnail Limitations</h4>
            <p>Thumbnails are not generated dynamically on-chain (since they need to be images) and thus don't currently show on objkt marketplace.</p>
          </div>
          <div className="feature-card">
            <h4>On-Chain Execution</h4>
            <p>Your SVG runs directly in browsers and applications without external dependencies, ensuring permanent accessibility.</p>
          </div>
        </div>

        <h2>Community & Support</h2>
        <p>
          svgKT is an open-source project. You can find the code, report issues, and contribute 
          on <a href="https://github.com/tsmcalister/svjkt-monorepo" target="_blank" rel="noopener noreferrer">GitHub</a>.
          Join our community to share your creations and learn from other generative artists.
        </p>

        <div className="help-footer">
          <p><em>Ready to create? <Link to="/create">Start building your first generator →</Link></em></p>
        </div>
      </div>
    </div>
  );
}
