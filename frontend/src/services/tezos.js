import { TezosToolkit } from '@taquito/taquito';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType, BeaconEvent } from '@airgap/beacon-dapp';
import { getNetworkConfig, getContractAddress, CONFIG } from '../config.js';

class TezosService {
  constructor() {
    this.network = CONFIG.network;
    this.config = getNetworkConfig();
    this.contractAddress = getContractAddress();
    
    // Initialize Tezos toolkit
    this.tezos = new TezosToolkit(this.config.rpcUrl);
    
    // Initialize wallet
    this.wallet = new BeaconWallet({
      name: CONFIG.branding.projectName,
      preferredNetwork: this.network === 'mainnet' ? NetworkType.MAINNET : NetworkType.GHOSTNET,
      disableDefaultEvents: false,
      enableMetrics: true,
    });
    
    this.tezos.setWalletProvider(this.wallet);
    this.contract = null;
    this.userAddress = null;
    this.isConnected = false;
    this.onAccountChangeCallback = null;
    
    // Set up event subscription for active account changes
    this.setupAccountEventSubscription();
  }

  // Set up event subscription for active account changes
  setupAccountEventSubscription() {
    this.wallet.client.subscribeToEvent(BeaconEvent.ACTIVE_ACCOUNT_SET, (account) => {
      console.log(`${BeaconEvent.ACTIVE_ACCOUNT_SET} triggered:`, account);
      
      if (account) {
        this.userAddress = account.address;
        this.isConnected = true;
        console.log('Active account updated:', this.userAddress);
        
        if (this.onAccountChangeCallback) {
          this.onAccountChangeCallback(account.address);
        }
      } else {
        this.userAddress = null;
        this.isConnected = false;
        console.log('Active account cleared');
        
        if (this.onAccountChangeCallback) {
          this.onAccountChangeCallback(null);
        }
      }
    });
  }

  // Method to set a callback for account changes
  setAccountChangeCallback(callback) {
    this.onAccountChangeCallback = callback;
  }

  async initialize() {
    // Check if already connected
    const activeAccount = await this.wallet.client.getActiveAccount();
    if (activeAccount) {
      this.userAddress = activeAccount.address;
      this.isConnected = true;
      await this.loadContract();
    }
  }

  async connectWallet() {
    try {
      const permissions = await this.wallet.requestPermissions();
      this.userAddress = await this.wallet.getPKH();
      this.isConnected = true;
      await this.loadContract();
      
      return { success: true, address: this.userAddress };
    } catch (error) {
      console.error('Wallet connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  async disconnectWallet() {
    try {
      await this.wallet.clearActiveAccount();
      this.userAddress = null;
      this.isConnected = false;
      this.contract = null;
      return { success: true };
    } catch (error) {
      console.error('Wallet disconnection failed:', error);
      return { success: false, error: error.message };
    }
  }

  async loadContract() {
    try {
      this.contract = await this.tezos.wallet.at(this.contractAddress);
      return this.contract;
    } catch (error) {
      console.error('Failed to load contract:', error);
      throw error;
    }
  }

  async getContractStorage() {
    try {
      if (!this.contract) {
        await this.loadContract();
      }
      return await this.contract.storage();
    } catch (error) {
      console.error('Failed to get contract storage:', error);
      throw error;
    }
  }

  async getGenerators() {
    try {
      const storage = await this.getContractStorage();
      const generators = [];
      
      // Get all generators from the big_map
      const generatorsBigMap = storage.generators;
      const nextGeneratorId = storage.next_generator_id.toNumber();
      
      for (let i = 0; i < nextGeneratorId; i++) {
        try {
          const generator = await generatorsBigMap.get(i);
          if (generator) {
            generators.push({
              id: i,
              name: this.bytesToString(generator.name),
              description: this.bytesToString(generator.description),
              author: generator.author,
              code: this.bytesToString(generator.code),
              created: new Date(generator.created),
              lastUpdate: new Date(generator.last_update)
            });
          }
        } catch (error) {
          console.warn(`Failed to get generator ${i}:`, error);
        }
      }
      
      // Sort by creation time (newest first)
      generators.sort((a, b) => b.created - a.created);
      
      return generators;
    } catch (error) {
      console.error('Failed to get generators:', error);
      throw error;
    }
  }

  async getFragments() {
    try {
      const storage = await this.getContractStorage();
      const fragments = [];
      
      // Get fragments 0-3 (based on the template structure)
      for (let i = 0; i < 4; i++) {
        try {
          const fragment = await storage.frags.get(i);
          if (fragment) {
            fragments[i] = this.bytesToString(fragment);
          }
        } catch (error) {
          console.warn(`Failed to get fragment ${i}:`, error);
        }
      }
      
      return fragments;
    } catch (error) {
      console.error('Failed to get fragments:', error);
      throw error;
    }
  }

  async createGenerator(name, code) {
    try {
      if (!this.contract) {
        throw new Error('Contract not loaded');
      }
      
      const operation = await this.contract.methods.create_generator(
        this.stringToBytes(code),
        this.stringToBytes(''), // empty description for now
        this.stringToBytes(name),
      ).send();
      
      await operation.confirmation();
      return { success: true, hash: operation.hash };
    } catch (error) {
      console.error('Failed to create generator:', error);
      return { success: false, error: error.message };
    }
  }

  async updateGenerator(generatorId, name, code) {
    try {
      if (!this.contract) {
        throw new Error('Contract not loaded');
      }
      
      const operation = await this.contract.methods.update_generator(
        generatorId,
        this.stringToBytes(code),
        this.stringToBytes(''), // empty description for now
        this.stringToBytes(name),
      ).send();
      
      await operation.confirmation();
      return { success: true, hash: operation.hash };
    } catch (error) {
      console.error('Failed to update generator:', error);
      return { success: false, error: error.message };
    }
  }

  async mintToken(generatorId) {
    try {
      if (!this.contract) {
        throw new Error('Contract not loaded');
      }
      
      // Generate random entropy (16 bytes)
      const entropy = new Uint8Array(16);
      crypto.getRandomValues(entropy);
      const entropyHex = '0x' + Array.from(entropy).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const operation = await this.contract.methods.mint(
        generatorId,
        entropyHex
      ).send();
      
      await operation.confirmation();
      return { success: true, hash: operation.hash };
    } catch (error) {
      console.error('Failed to mint token:', error);
      return { success: false, error: error.message };
    }
  }

  // Utility functions
  stringToBytes(str) {
    return '0x' + Buffer.from(str, 'utf8').toString('hex');
  }

  bytesToString(bytes) {
    try {
      if (typeof bytes === 'string') {
        if (bytes.startsWith('0x')) {
          // Handle hex string
          return Buffer.from(bytes.slice(2), 'hex').toString('utf8');
        } else if (bytes.match(/^[0-9a-fA-F]+$/)) {
          // Handle hex string without 0x prefix
          return Buffer.from(bytes, 'hex').toString('utf8');
        }
      }
      return bytes;
    } catch (error) {
      console.warn('Failed to decode bytes:', bytes, error);
      return bytes;
    }
  }

  generateSVG(code, seed = 555555, tokenId = 0) {
    try {
      // For now, use the fallback template since fragments might not be properly set up on the contract
      // This matches the template structure from the files
      const svgTemplate = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><script><![CDATA[const SEED=${seed},TOKEN_ID=${tokenId};function sfc32(t,e,n,$){return function(){n|=0;var r=((t|=0)+(e|=0)|0)+($|=0)|0;return $=$+1|0,t=e^e>>>9,e=n+(n<<3)|0,n=(n=n<<21|n>>>11)+r|0,(r>>>0)/4294967296}}function splitBigInt(t,e=4){let n=[];for(let $=0;$<e;$++)n.push(Number(t>>32*$&4294967295));return n}const[a,b,c,d]=splitBigInt(${seed},4),rnd=sfc32(a,b,c,d),svg=document.documentElement,${code}]]></script></svg>`;
      
      return svgTemplate;
    } catch (error) {
      console.error('Failed to generate SVG:', error);
      return null;
    }
  }
}

export const tezosService = new TezosService();
