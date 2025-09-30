# bootloader - On-chain Generative Art Platform

The web interface for bootloade.art

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
npm run dev:mainnet
npm run dev:ghostnet
```

3. Open your browser to `http://localhost:3000`

### Configuration

Change the configuration for ghost- and mainnet in `src/config.js`:

- **RPC contracts**
- **Contract Address**
- **Network**: Mainnet (configurable in `src/config.js`)