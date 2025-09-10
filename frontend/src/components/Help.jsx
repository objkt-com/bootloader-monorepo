import { useState } from 'react';
import { Link } from 'react-router-dom';
import CodeEditor from './CodeEditor.jsx';
import SVGPreview from './SVGPreview.jsx';
import PreviewControls from './PreviewControls.jsx';
import { CONFIG } from '../config.js';
import { 
  AlertTriangle, 
  Palette, 
  RefreshCw, 
  DollarSign, 
  Target, 
  RotateCcw, 
  Settings, 
  Search, 
  Crosshair, 
  Lock, 
  Ruler, 
  TestTube, 
  Paintbrush, 
  Zap,
  Lightbulb
} from 'lucide-react';

export default function Help() {
  const [exampleCode, setExampleCode] = useState(`/**
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
}`);
  
  const [previewSeed, setPreviewSeed] = useState(CONFIG.defaultPreviewSeed);

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
          <div className="warning-icon"><AlertTriangle size={20} /></div>
          <div>
            <strong>Experimental Software Notice:</strong> bootloader: is experimental alpha software that has not been audited. 
            This is an open source project available at{' '}
            <a href="https://github.com/objkt-com/bootloader-monorepo/" target="_blank" rel="noopener noreferrer">
              github.com/objkt-com/bootloader-monorepo/
            </a>. 
            Use at your own risk. Always test with small amounts and understand the risks before deploying significant resources.
          </div>
        </div>


        <h1>bootloader: Documentation</h1>

        <h2>What is bootloader:?</h2>
        <p>
          bootloader: is an open-source experimental on-chain long-form generative art platform built on Tezos. It empowers artists and developers
          to create generative art algorithms that come to live through a SVG <em>bootloader</em> and stored directly on the blockchain. Using a{' '}
          <a href="https://en.wikipedia.org/wiki/WYSIWYG" target="_blank" rel="noopener noreferrer">WYSIWYG</a>{' '}
          (What You See Is What You Get) editor, bootloader: juxtaposes editable code alongside live previews, creating an intuitive environment 
          that invites users to explore the generative system's hard-coded rules and it's (audio)-visual manifestation.
        </p>

        <p>Edit the code below to see how changes affect the generated artwork:</p>
        
        <div className="editor-container help-editor-container" style={{height: '350px'}}>
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
        <p>
          
        </p>
        <p> 
          The term <em>bootloader</em> comes from computing, where it describes the small program that starts up a 
          computer by loading the system into memory. In the same way, <code>bootloader:</code> acts as the minimal 
          code that "boots" your artwork — a self-contained SVG fragment that, when combined with blockchain entropy, 
          initializes the generative system and produces the final piece. Each token’s <code>artifactUri</code> is 
          effectively its own tiny bootable environment: it carries both the instructions (your code) and the randomness 
          (the seed) needed to regenerate the artwork <em>forever</em>. 
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
          of early net art and showing how NFTs could be both artifact and algorithm.
        </p>
        <p>
          With bootloader:, we are reintroducing this concept in a raw form, giving it new life in the context of 
          long-form generative art. Here the works are fully on-chain, each mint animated by random seeds from 
          the blockchain itself, producing unique yet reproducible variations that remain durable, self-contained, 
          and alive within the chain's own data.
        </p>

        <h3>Why bootloader:?</h3>
        <p>
          With the void left by fxhash no longer supporting long-form mints on Tezos, bootloader: offers an open and 
          non-curated space for generative artists on the network. The platform is designed to make the process 
          both accessible and enjoyable. Showing the code alongside the resulting artwork is a deliberate choice - like 
          opening up a watch to see the intricate cogs in motion, it reveals the inner mechanics of the system and 
          invites viewers to mess with the code.
        </p>

        <h2>The SVG <em>bootloader</em></h2>

        <p>
          Your generator code runs inside an SVG <em>bootloader</em> that assembles your artwork at mint time. 
          The <em>bootloader</em> provides a minimal but powerful runtime environment through the <code>BTLDR</code> object:
        </p>

        <div className="bootloader-fragments">
          <div className="fragment-compact">
            <h4>On-Chain Assembly Process</h4>
            <p>
              When collectors mint your generator, the contract assembles a complete SVG data URI on-chain by combining 
              template fragments with your code and blockchain entropy. This assembled data URI becomes the NFT's 
              <code>artifactUri</code>, stored permanently on the blockchain:
            </p>
            <pre className="code-preview"><code>{`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg">
<script><![CDATA[
  const SEED = 123456789012345678901234567890n; // ← Blockchain entropy
  // ... random number generator setup (sfc32, splitmix64) ...
  
  const BTLDR = {
    rnd: sfc32(a,b,c,d),           // Deterministic random (0-1)
    seed: SEED,                    // Raw BigInt from blockchain
    iterationNumber: n,            // Iteration number
    isPreview: n===0&&SEED===0n,   // Preview mode flag
    svg: document.documentElement, // Root SVG element
    v: 'svg-js:0.0.1'             // bootloader: version
  };
  
  ((BTLDR) => {
    // YOUR INJECTED GENERATOR CODE STARTS HERE
    BTLDR.svg.setAttribute('viewBox', '0 0 400 400');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', 200 + BTLDR.rnd() * 100);
    circle.setAttribute('cy', 200 + BTLDR.rnd() * 100);
    circle.setAttribute('r', 50);
    BTLDR.svg.appendChild(circle);
    // YOUR INJECTED GENERATOR CODE ENDS HERE
  })(BTLDR);
]]></script>
</svg>`}</code></pre>
            <div className="assembly-note">
              <p>
                <strong>Key Point:</strong> This entire data URI (including your code and the unique seed) is stored 
                as the token's <code>artifactUri</code> in the blockchain's token metadata. Each minted token contains 
                a complete, self-executing SVG that generates the same artwork every time it's viewed.
              </p>
            </div>
          </div>
        </div>

        <p>
          This deliberately minimal <code>bootloader</code> focuses on the essentials: deterministic randomness, SVG manipulation, 
          and blockchain entropy. 
        </p>

        <div className="explore-fragments">
          <h4><Search size={18} className="inline-icon" /> Explore the Fragments On-Chain</h4>
          <p>
            Want to see the actual template fragments stored on the blockchain? You can explore the contract storage 
            and examine the <code>bootloaders</code> bigmap to see how the fragments are stored:
          </p>
          <div className="contract-links">
            <p>
              <strong>Ghostnet:</strong>{' '}
              {CONFIG.contracts.ghostnet ? (
                <a 
                  href={`https://better-call.dev/ghostnet/${CONFIG.contracts.ghostnet}/storage`}
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  better-call.dev/ghostnet/{CONFIG.contracts.ghostnet}/storage
                </a>
              ) : (
                <em>Contract not yet deployed</em>
              )}
            </p>
            <p>
              <strong>Mainnet:</strong>{' '}
              {CONFIG.contracts.mainnet ? (
                <a 
                  href={`https://better-call.dev/mainnet/${CONFIG.contracts.mainnet}/storage`}
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  better-call.dev/mainnet/{CONFIG.contracts.mainnet}/storage
                </a>
              ) : (
                <em>Contract not yet deployed</em>
              )}
            </p>
          </div>
          <p>
            <small>
              <Lightbulb size={16} className="inline-icon" /> <strong>Tip:</strong> Look for the <code>bootloaders</code> bigmap in the storage to see the template 
              fragments that get assembled with your generator code during minting.
            </small>
          </p>
        </div>

        <h2>Best Practices</h2>
        <div className="best-practices">
          <div className="practice-item">
            <h4><Target size={18} className="inline-icon" /> Use Deterministic Randomness</h4>
            <p>Always use <code>BTLDR.rnd()</code> instead of <code>Math.random()</code> to ensure reproducible results</p>
          </div>
          <div className="practice-item">
            <h4><Lock size={18} className="inline-icon" /> Clean Code Scoping</h4>
            <p>Your code is automatically wrapped in an IIFE (Immediately Invoked Function Expression) by the template, so you don't need to worry about variable conflicts. The template handles scoping for you.</p>
          </div>
          <div className="practice-item">
            <h4><Ruler size={18} className="inline-icon" /> Optimize Code Size</h4>
            <p>Your code is stored on-chain, so keep it concise. Each byte costs storage fees.</p>
          </div>
          <div className="practice-item">
            <h4><TestTube size={18} className="inline-icon" /> Test Thoroughly</h4>
            <p>Try many different seeds to ensure your generator produces good variations. The platform uses a consistent preview seed ({CONFIG.defaultPreviewSeed}) across all generator thumbnails.</p>
          </div>
          <div className="practice-item">
            <h4><Paintbrush size={18} className="inline-icon" /> Consider Scalability</h4>
            <p>Design your art to look good at different sizes and aspect ratios</p>
          </div>
          <div className="practice-item">
            <h4><Zap size={18} className="inline-icon" /> Performance Matters</h4>
            <p>Avoid infinite loops or computationally expensive operations</p>
          </div>
        </div>

        <h2>How It Works: Technical Overview</h2>
        
        <div className="technical-overview">
          <div className="overview-section">
            <h4><Palette size={18} className="inline-icon" /> Generator Creation & Updates</h4>
            <p>
              Artists create generators with JavaScript code stored permanently on-chain. Generators are <strong>updatable</strong> - 
              authors can modify code, descriptions, and settings at any time. Each update increments the version number 
              (v1 → v2 → v3...) while preserving creation date and authorship.
            </p>
          </div>

          <div className="overview-section">
            <h4><Target size={18} className="inline-icon" /> Minting Process</h4>
            <p>
              When collectors mint, the contract generates blockchain entropy and assembles a complete SVG by combining 
              <code>bootloader</code> fragments with your generator code. This SVG becomes the NFT's <code>artifactUri</code>, 
              stored permanently on-chain with unique randomness for each token.
            </p>
          </div>

          <div className="overview-section highlight-section">
            <h4><RefreshCw size={18} className="inline-icon" /> Token Regeneration</h4>
            <p>
              <strong>Key Feature:</strong> Token owners can regenerate their NFTs when the original generator 
              has been updated to a newer version. This allows collectors to benefit from bug fixes and improvements 
              while preserving their original seed and iteration number.
            </p>
            <div className="regeneration-details">
              <ul>
                <li>Only available when generator version &gt; token's current version</li>
                <li>Preserves original seed and iteration number for consistency</li>
                <li>Free operation (only pay storage difference)</li>
                <li><strong>Example:</strong> Own token #42 from v2? Artist updates to v3? Regenerate to get v3 improvements with the same unique seed.</li>
              </ul>
            </div>
          </div>

          <div className="overview-section">
            <h4><Settings size={18} className="inline-icon" /> Platform Features</h4>
            <ul>
              <li><strong>Sale Configuration:</strong> Flexible pricing, edition limits, per-wallet limits, pause/resume</li>
              <li><strong>Airdrops:</strong> Authors can reserve editions for direct distribution</li>
              <li><strong>Versioning:</strong> New mints use latest version, existing tokens stay at their version until regenerated</li>
              <li><strong>Permanence:</strong> Generators become permanent once tokens are minted</li>
            </ul>
          </div>
        </div>

        <h3>Generator Description from Comments</h3>
        <p>
          bootloader: automatically extracts your generator's description from the first multi-line comment in your code.
          This description is stored on-chain separately from your code and displayed to users when they view your generator.
        </p>
        <div className="description-example">
          <h4>Example:</h4>
          <pre><code>{`/*
This generator creates colorful circles with random positions and sizes.
Each circle has a unique color based on the deterministic random seed.
*/

// Your generator code follows...
const {svg, rnd} = BTLDR;`}</code></pre>
          <p>
            The text inside the first <code>/* */</code> comment block becomes your generator's description.
            Any comments outside of the description section will be written on-chain into the code section.
          </p>
        </div>

        <h2>Storage Costs and Mint Pricing</h2>
        <p>
          Understanding the cost structure of bootloader: helps you optimize your generators and set appropriate mint prices.
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
        </div>

        <h2>Community & Support</h2>
        <p>
          bootloader: is an open-source project. You can find the code, report issues, and contribute 
          on <a href="https://github.com/objkt-com/bootloader-monorepo" target="_blank" rel="noopener noreferrer">GitHub</a>.
          Join our community to share your creations and learn from other generative artists.
        </p>

        <div className="help-footer">
          <p><em>Ready to create? <Link to="/create">Start building your first generator →</Link></em></p>
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
      </div>
    </div>
  );
}
