# SVJKT - On-chain SVG Generator Platform

A minimalist web interface for the SVJKT smart contract that allows users to create, edit, and mint generative SVG art on the Tezos blockchain.

## Features

- **Explore**: Browse all generators created by the community
- **Create**: Build new SVG generators with live preview
- **Edit**: Update your own generators (author only)
- **Mint**: Generate unique NFTs from any generator
- **Wallet Integration**: Connect with Temple, Kukai, and other Tezos wallets

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Tezos wallet (Temple, Kukai, etc.)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

### Configuration

The app is configured to work with the SVJKT contract at:
- **Contract Address**: `KT1DZrTdXKU35MzLygZkmyWHDuEu1hJhm4qn`
- **Network**: Mainnet (configurable in `src/config.js`)

## How It Works

### SVG Generation

The platform uses a fragment-based architecture where:

1. **Template Fragments**: Boilerplate SVG code stored on-chain
2. **Generator Code**: User-written JavaScript that creates SVG elements
3. **Random Seed**: Entropy for generating unique variations
4. **Token ID**: Unique identifier for each minted NFT

### Code Editor

The Monaco Editor provides:
- JavaScript syntax highlighting
- Boilerplate code display (read-only)
- Live preview as you type
- Error handling and validation

### Available Variables

When writing generator code, you have access to:

- `SEED_NAT`: Random seed for this generation
- `TOKEN_ID`: Unique token identifier
- `rnd()`: Seeded random function (0-1)
- `svg`: Root SVG element
- `W`, `H`: Canvas dimensions (800x600)
- `NS`: SVG namespace constant

### Example Code

```javascript
// Create random circles
for(let i=0; i<80; i++){
  let radius = 5 + (90 * rnd() | 0);
  let x = radius + (rnd() * (800 - 2 * radius) | 0);
  let y = radius + (rnd() * (600 - 2 * radius) | 0);
  let circle = document.createElementNS(NS, "circle");
  circle.setAttribute("cx", x);
  circle.setAttribute("cy", y);
  circle.setAttribute("r", radius);
  circle.setAttribute("fill", "black");
  svg.appendChild(circle);
}

// Add token ID text
const text = document.createElementNS(NS, "text");
text.textContent = TOKEN_ID;
text.setAttribute("x", 400);
text.setAttribute("y", 300);
text.setAttribute("fill", "white");
text.setAttribute("font-size", "120");
text.setAttribute("font-family", "monospace");
text.setAttribute("text-anchor", "middle");
text.setAttribute("dominant-baseline", "middle");
svg.appendChild(text);
```

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── Home.jsx        # Generator gallery
│   │   ├── Create.jsx      # Generator creation
│   │   ├── GeneratorDetail.jsx # View/edit generators
│   │   ├── CodeEditor.jsx  # Monaco editor wrapper
│   │   ├── SVGPreview.jsx  # Live preview component
│   │   └── WalletConnection.jsx # Wallet integration
│   ├── services/
│   │   └── tezos.js        # Blockchain interaction
│   ├── config.js           # App configuration
│   ├── index.css           # Minimalist styling
│   ├── App.jsx             # Main app component
│   └── main.jsx            # Entry point
├── index.html
├── package.json
└── vite.config.js
```

## Design Philosophy

SVJKT follows a minimalist design inspired by hicetnunc.xyz:

- **Monospace typography** (Courier New)
- **Black and white color scheme**
- **Clean, functional interface**
- **No unnecessary decorations**
- **Focus on the art and code**

## Smart Contract Integration

The frontend interacts with the SVJKT smart contract through:

- **create_generator**: Submit new generators
- **update_generator**: Modify existing generators (author only)
- **mint**: Generate NFTs with random entropy
- **generators**: Read generator data from big_map
- **frags**: Access template fragments

## Development

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## License

This project is open source and available under the MIT License.
