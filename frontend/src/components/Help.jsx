import { useState } from 'react';
import { Link } from 'react-router-dom';
import CodeEditor from './CodeEditor.jsx';
import SVGPreview from './SVGPreview.jsx';
import PreviewControls from './PreviewControls.jsx';

export default function Help() {
  const [exampleCode, setExampleCode] = useState(`/*
* Five Random Circles
* bootloader v0.0.1
*/

$b.svg.setAttribute('viewBox', '0 0 400 400');
$b.svg.style.cssText = "background:white";

// Create 5 random circles
for (let i = 0; i < 5; i++) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  
  circle.setAttribute('cx', 50 + $b.rnd() * 300);
  circle.setAttribute('cy', 50 + $b.rnd() * 300);
  circle.setAttribute('r', 20 + $b.rnd() * 40);
  circle.setAttribute('fill', \`hsl(\${$b.rnd() * 360}, 70%, 60%)\`);
  circle.setAttribute('opacity', 0.8);
  
  $b.svg.appendChild(circle);
}`);
  
  const [previewSeed, setPreviewSeed] = useState(12345);

  const refreshPreview = () => {
    const currentSeed = previewSeed;
    setPreviewSeed(currentSeed + 0.1);
    setTimeout(() => setPreviewSeed(currentSeed), 10);
  };

  return (
    <div className="help-container">
      <div className="help-content">
        {/* Experimental Software Warning */}
        <div className="warning-banner">
          <div className="warning-icon">⚠️</div>
          <div>
            <strong>Experimental Software Notice:</strong> bootloader is experimental alpha software that has not been audited. 
            This is an open source project available at{' '}
            <a href="https://github.com/objkt-com/bootloader-monorepo/" target="_blank" rel="noopener noreferrer">
              github.com/objkt-com/bootloader-monorepo/
            </a>. 
            Use at your own risk. Always test with small amounts and understand the risks before deploying significant resources.
          </div>
        </div>

        {/* objkt labs branding */}
        <div className="objkt-labs-branding">
          <img 
            src="/objkt_labs_logo.png" 
            alt="objkt labs" 
            className="objkt-labs-logo"
          />
          <div>
            <div className="objkt-labs-title">Part of objkt labs</div>
            <div className="objkt-labs-description">
              objkt labs encompasses residencies, educational initiatives, and experimental content for the Tezos ecosystem.
              This entire project is an open source mono-repo.
            </div>
            <div className="objkt-labs-link">
              <a href="https://x.com/objktlabs" target="_blank" rel="noopener noreferrer">
                Follow @objktlabs on X →
              </a>
            </div>
          </div>
        </div>

        <h1>bootloader Documentation</h1>

        <h2>What is bootloader?</h2>
        <p>
          bootloader is an open-source experimental on-chain long-form generative art platform built on Tezos. It empowers artists and developers
          to create generative art algorithms that produce unique SVG images directly on the blockchain. Using a{' '}
          <a href="https://en.wikipedia.org/wiki/WYSIWYG" target="_blank" rel="noopener noreferrer">WYSIWYG</a>{' '}
          (What You See Is What You Get) editor, the platform presents code alongside live previews, creating an intuitive environment 
          that invites users to explore, experiment, and discover the creative possibilities of generative art through code.
        </p>

        <h3>Why SVG?</h3>
        <p>
          SVG is one of the more esoteric formats in the digital landscape — part image, part code, part container. 
          What looks like a simple XML file can also act as an engine, carrying instructions, executing logic, and 
          shaping visuals directly in the browser.
        </p>
        <p>
          This potential first revealed itself on Tezos in 2021, when artists on hic et nunc discovered a hack: 
          embedding JavaScript inside SVGs so that a "picture file" could suddenly become interactive. Mini-games, 
          drawing tools, and generative systems began appearing on-chain through this trick, reviving the spirit 
          of early net art and showing how NFTs could be both artifact and algorithm. Yet all of this lived on IPFS, 
          relying on external storage and viewers.
        </p>
        <p>
          With bootloader, we are reintroducing this concept in a raw form, giving it new life in the context of 
          long-form generative art. Here the works are fully on-chain, each mint animated by random seeds from 
          the blockchain itself, producing unique yet reproducible variations that remain durable, self-contained, 
          and alive within the chain's own data.
        </p>

        <h3>Why This Platform?</h3>
        <p>
          With the void left by fxhash no longer supporting long-form mints on Tezos, bootloader offers an open and 
          non-curated space for generative artists on the network. The platform is designed to make the process 
          both accessible and enjoyable. Showing the code alongside the resulting artwork is a deliberate choice—like 
          opening up a watch to see the intricate cogs in motion, it reveals the inner mechanics of the system and 
          offers a unique perspective on how generative art emerges.
        </p>

        <h3>Why On-Chain?</h3>
        <p>
          bootloader demonstrates how platforms can be built without any backend systems, relying only on publicly available 
          infrastructure like indexer APIs (tzkt and objkt). These APIs are open to anyone, showing that experimental 
          tools and platforms like this are accessible to any developer. Of course, this approach comes with limitations - 
          such as no thumbnails showing on objkt marketplace - but the trade-off is complete self-containment and independence.
        </p>

        <h2>Quick Start Guide</h2>
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

        <h2>Try It Now: Interactive Example</h2>
        <p>Edit the code below to see how changes affect the generated artwork:</p>
        
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

        <h2>Available Variables in Your Code</h2>
        
        <p>Your generator code runs inside an SVG "bootloader" that provides access to the <code>$b</code> object. This is where your code executes. Currently there is no standard library - only these 4 properties are available (this will change in the future):</p>
        
        <h4>The $b Object</h4>
        <pre className="code-preview"><code>{`// The $b object provided to your code:
const $b = {
  rnd: sfc32(a,b,c,d),           // Deterministic random function (0-1)
  SEED: SEED,                    // Raw BigInt seed from blockchain
  svg: document.documentElement, // Reference to the root SVG element
  v: '0.0.1'                    // Template version string
};

// Your code is executed in this structure:
(($b) => {
  // YOUR GENERATOR CODE GOES HERE
  // You can destructure for convenience:
  const { rnd, svg, SEED, v } = $b;
  
  // Set up your SVG canvas
  svg.setAttribute('viewBox', '0 0 400 400');
  
  // Use rnd() for deterministic randomness
  const x = rnd() * 400;
  const y = rnd() * 400;
  
  // Create and append SVG elements
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', x);
  circle.setAttribute('cy', y);
  circle.setAttribute('r', 20 + rnd() * 30);
  svg.appendChild(circle);
})($b);`}</code></pre>

        <h2>Best Practices</h2>
        <div className="best-practices">
          <div className="practice-item">
            <h4>🎯 Use Deterministic Randomness</h4>
            <p>Always use <code>$b.rnd()</code> instead of <code>Math.random()</code> to ensure reproducible results</p>
          </div>
          <div className="practice-item">
            <h4>🔒 Clean Code Scoping</h4>
            <p>Your code is automatically wrapped in an IIFE (Immediately Invoked Function Expression) by the template, so you don't need to worry about variable conflicts. The template handles scoping for you.</p>
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

        <h2>How It Works: Technical Overview</h2>
        
        <h3>Generator Lifecycle</h3>
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

        <h3>Generator Description from Comments</h3>
        <p>
          bootloader automatically extracts your generator's description from the first multi-line comment in your code.
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

        <h3>NFT Assembly During Mint</h3>
        <p>
          When someone mints your generator, the contract assembles a complete SVG using template fragments and creates the NFT metadata.
          Here's the real-time assembly process:
        </p>

        <div className="assembly-diagram">
          <h4 className="assembly-title">NFT Name Assembly</h4>
          <div className="fragment-flow">
            <div className="fragment-box">
              <div className="fragment-header">generator.name</div>
              <div className="fragment-content">
                <code>"Colorful Circles"</code>
                <div className="fragment-note">From generator storage</div>
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
          <h4 className="assembly-title">SVG Fragment Assembly Process</h4>
          <div className="fragment-flow">
            <div className="fragment-box">
              <div className="fragment-header">
                Fragment 0 
                <a href="https://better-call.dev/ghostnet/KT1STnjUvPN5mexM1Pc2F3NNhXj3ZRp42Vtp/storage/big_map/477485/exprtZBwZUeYYYfUs9B9Rg2ywHezVHnCCnmF9WsDQVrs582dSK63dC" target="_blank" rel="noopener noreferrer" style={{marginLeft: '8px', fontSize: '12px'}}>
                  (view on-chain)
                </a>
              </div>
              <div className="fragment-content">
                <code>{`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg">
<script><![CDATA[const SEED=`}</code>
                <div className="fragment-note">Note: Content after data:image/svg+xml;utf8, is URL-encoded on-chain but shown decoded here for readability</div>
              </div>
            </div>
            
            <div className="assembly-arrow">+</div>
            
            <div className="fragment-box entropy">
              <div className="fragment-header">Random Entropy (BigInt)</div>
              <div className="fragment-content">
                <code>123456789012345678901234567890123456789012345678901234567890n</code>
                <div className="fragment-note">Generated from blockchain randomness (BigInt with 'n' suffix)</div>
              </div>
            </div>
            
            <div className="assembly-arrow">+</div>
            
            <div className="fragment-box">
              <div className="fragment-header">
                Fragment 1 
                <a href="https://better-call.dev/ghostnet/KT1STnjUvPN5mexM1Pc2F3NNhXj3ZRp42Vtp/storage/big_map/477485/exprtZBwZUeYYYfUs9B9Rg2ywHezVHnCCnmF9WsDQVrs582dSK63dC" target="_blank" rel="noopener noreferrer" style={{marginLeft: '8px', fontSize: '12px'}}>
                  (view on-chain)
                </a>
              </div>
              <div className="fragment-content">
                <code>{`;function splitmix64(f){let n=f;return function(){let f=n=n+0x9e3779b97f4a7c15n&0xffffffffffffffffn;return f=((f=(f^f>>30n)*0xbf58476d1ce4e5b9n&0xffffffffffffffffn)^f>>27n)*0x94d049bb133111ebn&0xffffffffffffffffn,Number(4294967295n&(f^=f>>31n))>>>0}}function sfc32(f,n,$,t){return function(){$|=0;let e=((f|=0)+(n|=0)|0)+(t|=0)|0;return t=t+1|0,f=n^n>>>9,n=$+($<<3)|0,$=($=$<<21|$>>>11)+e|0,(e>>>0)/4294967296}}const sm=splitmix64(SEED),a=sm(),b=sm(),c=sm(),d=sm(),$b={rnd:sfc32(a,b,c,d),SEED:SEED,svg:document.documentElement,v:'0.0.1'};(($b)=>{`}</code>
                <div className="fragment-note">Random number generator setup and $b object creation</div>
              </div>
            </div>
            
            <div className="assembly-arrow">+</div>
            
            <div className="fragment-box user-code">
              <div className="fragment-header">Your Generator Code</div>
              <div className="fragment-content">
                <pre className="fragment-code-example"><code>{`// Your creative code here
const { rnd, svg } = $b;

svg.setAttribute('viewBox', '0 0 400 400');
const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
circle.setAttribute('cx', 200);
circle.setAttribute('cy', 200);
circle.setAttribute('r', 50 + rnd() * 100);
circle.setAttribute('fill', \`hsl(\${rnd() * 360}, 70%, 50%)\`);
svg.appendChild(circle);`}</code></pre>
                <div className="fragment-note">Retrieved from generator.code field</div>
              </div>
            </div>
            
            <div className="assembly-arrow">+</div>
            
            <div className="fragment-box">
              <div className="fragment-header">
                Fragment 2
                <a href="https://better-call.dev/ghostnet/KT1STnjUvPN5mexM1Pc2F3NNhXj3ZRp42Vtp/storage/big_map/477485/exprtZBwZUeYYYfUs9B9Rg2ywHezVHnCCnmF9WsDQVrs582dSK63dC" target="_blank" rel="noopener noreferrer" style={{marginLeft: '8px', fontSize: '12px'}}>
                  (view on-chain)
                </a>
              </div>
              <div className="fragment-content">
                <code>{`})($b);]]></script>
</svg>`}</code>
                <div className="fragment-note">Closes the IIFE and completes the SVG structure</div>
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

        <h2>Generator Storage Structure</h2>
        <p>
          When you create a generator, all data is stored permanently on-chain in a structured format.
          Here are the fields stored for each generator:
        </p>

        <div className="help-table-container">
          <table className="help-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Max Size</th>
                <th>Description</th>
                <th>Mutable</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>name</code></td>
                <td>bytes</td>
                <td>100 bytes</td>
                <td>Display name for your generator</td>
                <td>✅</td>
              </tr>
              <tr>
                <td><code>description</code></td>
                <td>bytes</td>
                <td>8,000 bytes</td>
                <td>Extracted from first /* */ comment in code</td>
                <td>✅</td>
              </tr>
              <tr>
                <td><code>code</code></td>
                <td>bytes</td>
                <td>30,000 bytes</td>
                <td>Your JavaScript generator code</td>
                <td>✅</td>
              </tr>
              <tr>
                <td><code>author</code></td>
                <td>address</td>
                <td>36 bytes</td>
                <td>Your Tezos address</td>
                <td>❌</td>
              </tr>
              <tr>
                <td><code>author_bytes</code></td>
                <td>bytes</td>
                <td>36 bytes</td>
                <td>Hex-encoded address for NFT metadata</td>
                <td>✅</td>
              </tr>
              <tr>
                <td><code>created</code></td>
                <td>timestamp</td>
                <td>8 bytes</td>
                <td>Creation timestamp</td>
                <td>❌</td>
              </tr>
              <tr>
                <td><code>last_update</code></td>
                <td>timestamp</td>
                <td>8 bytes</td>
                <td>Last modification timestamp</td>
                <td>Auto</td>
              </tr>
              <tr>
                <td><code>n_tokens</code></td>
                <td>nat</td>
                <td>~4 bytes</td>
                <td>Number of tokens minted</td>
                <td>Auto</td>
              </tr>
              <tr>
                <td><code>reserved_editions</code></td>
                <td>nat</td>
                <td>~4 bytes</td>
                <td>Number of editions reserved for airdrops</td>
                <td>✅</td>
              </tr>
              <tr>
                <td><code>flag</code></td>
                <td>nat</td>
                <td>~4 bytes</td>
                <td>Moderation flag (0 = normal, other values for UI filtering)</td>
                <td>Mods only</td>
              </tr>
              <tr>
                <td><code>version</code></td>
                <td>nat</td>
                <td>~4 bytes</td>
                <td>Generator version (increments on updates)</td>
                <td>Auto</td>
              </tr>
              <tr>
                <td><code>sale</code></td>
                <td>option</td>
                <td>~32 bytes</td>
                <td>Sale configuration (price, editions, etc.)</td>
                <td>✅</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Storage Costs and Mint Pricing</h2>
        <p>
          Understanding the cost structure of bootloader helps you optimize your generators and set appropriate mint prices.
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
          bootloader is an open-source project. You can find the code, report issues, and contribute 
          on <a href="https://github.com/objkt-com/bootloader-monorepo" target="_blank" rel="noopener noreferrer">GitHub</a>.
          Join our community to share your creations and learn from other generative artists.
        </p>

        <div className="help-footer">
          <p><em>Ready to create? <Link to="/create">Start building your first generator →</Link></em></p>
        </div>
      </div>
    </div>
  );
}
