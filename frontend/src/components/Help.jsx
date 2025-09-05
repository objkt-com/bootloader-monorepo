export default function Help() {
  return (
    <div className="help-container">
      <div className="help-content">
        <h1>How svgKT Works</h1>

        <h2>What is svgKT?</h2>
        <p>
          svgKT is an on-chain SVG generator platform built on Tezos. It allows artists and developers
          to create generative art algorithms that produce unique SVG images directly on the blockchain.
        </p>

        <h2>Creating Generators</h2>
        <p>
          Generators are JavaScript programs that create SVG graphics. When you create a generator, 
          your code is stored permanently on the Tezos blockchain. Each generator can produce infinite 
          variations based on random entropy.
        </p>

        <h2>Available Variables</h2>
        <p>Your generator code has access to these variables:</p>
        <ul>
          <li><code>SEED</code> - A random number used for deterministic randomness</li>
          <li><code>TOKEN_ID</code> - The unique ID of the minted token</li>
          <li><code>rnd()</code> - A seeded random number generator function</li>
          <li><code>svg</code> - The SVG document element for manipulation</li>
        </ul>

        <h2>Example Code</h2>
        <pre>{`// Create a simple circle with random color
const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
circle.setAttribute('cx', 200);
circle.setAttribute('cy', 200);
circle.setAttribute('r', 50 + rnd() * 100);
circle.setAttribute('fill', \`hsl(\${rnd() * 360}, 70%, 50%)\`);
svg.appendChild(circle);`}</pre>

        <h2>Minting Tokens</h2>
        <p>
          Once a generator is created, anyone can mint unique tokens from it. Each mint uses 
          random entropy to create a one-of-a-kind artwork. The SVG is generated and stored 
          entirely on-chain.
        </p>

        <h2>Technical Details</h2>
        <p>
          svgKT uses SmartPy contracts on Tezos to store generator code and metadata. 
          The SVG generation happens client-side using the stored code and blockchain-provided 
          entropy, ensuring each piece is truly unique and verifiable.
        </p>

        <h2>Getting Started</h2>
        <p>
          To get started, connect your Tezos wallet and explore existing generators. 
          When you're ready to create, click "create" to write your own generative algorithm. 
          You can test your code in the preview panel before publishing it to the blockchain.
        </p>

        <h2>Tips for Creating</h2>
        <ul>
          <li>Use the <code>rnd()</code> function for consistent randomness</li>
          <li>Keep your code concise - it's stored on-chain</li>
          <li>Test thoroughly with different seeds</li>
          <li>Consider how your art will look at different scales</li>
          <li>Use SVG elements and attributes for best results</li>
        </ul>

        <h2>Community</h2>
        <p>
          svgKT is an open-source project. You can find the code, report issues, and contribute 
          on <a href="https://github.com/tsmcalister/svjkt-monorepo" target="_blank" rel="noopener noreferrer">GitHub</a>.
        </p>
      </div>
    </div>
  );
}
