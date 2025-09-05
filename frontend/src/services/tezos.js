import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { NetworkType, BeaconEvent } from "@airgap/beacon-dapp";
import { getNetworkConfig, getContractAddress, CONFIG } from "../config.js";
import { tzktService } from "./tzkt.js";

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
      preferredNetwork:
        this.network === "mainnet" ? NetworkType.MAINNET : NetworkType.GHOSTNET,
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
    this.wallet.client.subscribeToEvent(
      BeaconEvent.ACTIVE_ACCOUNT_SET,
      (account) => {
        console.log(`${BeaconEvent.ACTIVE_ACCOUNT_SET} triggered:`, account);

        if (account) {
          this.userAddress = account.address;
          this.isConnected = true;
          console.log("Active account updated:", this.userAddress);

          if (this.onAccountChangeCallback) {
            this.onAccountChangeCallback(account.address);
          }
        } else {
          this.userAddress = null;
          this.isConnected = false;
          console.log("Active account cleared");

          if (this.onAccountChangeCallback) {
            this.onAccountChangeCallback(null);
          }
        }
      },
    );
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
      console.error("Wallet connection failed:", error);
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
      console.error("Wallet disconnection failed:", error);
      return { success: false, error: error.message };
    }
  }

  async loadContract() {
    try {
      this.contract = await this.tezos.wallet.at(this.contractAddress);
      return this.contract;
    } catch (error) {
      console.error("Failed to load contract:", error);
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
      console.error("Failed to get contract storage:", error);
      throw error;
    }
  }

  async getGenerators() {
    try {
      // Use TzKT service instead of RPC calls
      return await tzktService.getGenerators();
    } catch (error) {
      console.error("Failed to get generators:", error);
      throw error;
    }
  }

  async getFragments() {
    try {
      // Use TzKT service instead of RPC calls
      return await tzktService.getFragments();
    } catch (error) {
      console.error("Failed to get fragments:", error);
      throw error;
    }
  }

  async getGenerator(generatorId) {
    try {
      // Use TzKT service to get a specific generator
      return await tzktService.getGenerator(generatorId);
    } catch (error) {
      console.error(`Failed to get generator ${generatorId}:`, error);
      throw error;
    }
  }

  async getNextGeneratorId() {
    try {
      // Use TzKT service to get the next generator ID
      return await tzktService.getNextGeneratorId();
    } catch (error) {
      console.error("Failed to get next generator ID:", error);
      throw error;
    }
  }

  async getContractBigMaps() {
    try {
      // Use TzKT service to get all bigmaps for the contract
      return await tzktService.getContractBigMaps();
    } catch (error) {
      console.error("Failed to get contract bigmaps:", error);
      throw error;
    }
  }

  async createGenerator(name, code, description = "") {
    try {
      if (!this.contract) {
        await this.loadContract();
      }

      // Use methodsObject with named parameters matching the new contract signature
      const operation = await this.contract.methodsObject
        .create_generator({
          name: this.stringToBytes(name),
          description: this.stringToBytes(description),
          code: this.stringToBytes(code),
          author_bytes: this.stringToBytes(this.userAddress || ""),
        })
        .send();

      await operation.confirmation();
      return { success: true, hash: operation.hash };
    } catch (error) {
      console.error("Failed to create generator:", error);
      return { success: false, error: error.message };
    }
  }

  async updateGenerator(generatorId, name, code, description = "") {
    try {
      if (!this.contract) {
        await this.loadContract();
      }

      // Use methodsObject with named parameters matching the new contract signature
      const operation = await this.contract.methodsObject
        .update_generator({
          generator_id: generatorId,
          name: this.stringToBytes(name),
          description: this.stringToBytes(description),
          code: this.stringToBytes(code),
          author_bytes: this.stringToBytes(this.userAddress || ""),
        })
        .send();

      await operation.confirmation();
      return { success: true, hash: operation.hash };
    } catch (error) {
      console.error("Failed to update generator:", error);
      return { success: false, error: error.message };
    }
  }

  async setSale(generatorId, startTime, price, paused, editions) {
    try {
      if (!this.contract) {
        await this.loadContract();
      }

      // Use methodsObject with named parameters matching the contract signature
      const operation = await this.contract.methodsObject
        .set_sale({
          generator_id: generatorId,
          start_time: startTime, // null for immediate start, or timestamp
          price: price, // in mutez
          paused: paused,
          editions: editions,
        })
        .send();

      await operation.confirmation();
      return { success: true, hash: operation.hash };
    } catch (error) {
      console.error("Failed to set sale:", error);
      return { success: false, error: error.message };
    }
  }

  async mintToken(generatorId) {
    try {
      if (!this.contract) {
        await this.loadContract();
      }

      // Get the generator data to find the sale price
      const generators = await this.getGenerators();
      const generator = generators.find((g) => g.id === generatorId);

      if (!generator || !generator.sale) {
        throw new Error("Generator not found or no sale configured");
      }

      const salePrice = generator.sale.price; // Price is already in mutez

      // Generate random entropy (16 bytes) and convert to hex string
      const entropy = new Uint8Array(16);
      crypto.getRandomValues(entropy);
      const entropyHex =
        "0x" +
        Array.from(entropy)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      // Use methodsObject with named parameters and send the correct amount
      const operation = await this.contract.methodsObject
        .mint({
          generator_id: generatorId,
          entropy: entropyHex,
        })
        .send({ amount: salePrice, mutez: true });

      await operation.confirmation();
      return { success: true, hash: operation.hash };
    } catch (error) {
      console.error("Failed to mint token:", error);
      return { success: false, error: error.message };
    }
  }

  // Utility functions
  stringToBytes(str) {
    return "0x" + Buffer.from(str, "utf8").toString("hex");
  }

  bytesToString(bytes) {
    try {
      if (typeof bytes === "string") {
        if (bytes.startsWith("0x")) {
          // Handle hex string
          return Buffer.from(bytes.slice(2), "hex").toString("utf8");
        } else if (bytes.match(/^[0-9a-fA-F]+$/)) {
          // Handle hex string without 0x prefix
          return Buffer.from(bytes, "hex").toString("utf8");
        }
      }
      return bytes;
    } catch (error) {
      console.warn("Failed to decode bytes:", bytes, error);
      return bytes;
    }
  }

  generateSVG(code, seed = 555555, tokenId = 0) {
    try {
      // Create the SVG content with proper encoding for data URI
      const svgContent = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><script><![CDATA[const SEED=${seed}n;function sfc32(t,e,n,$){return function(){n|=0;var r=((t|=0)+(e|=0)|0)+($|=0)|0;return $=$+1|0,t=e^e>>>9,e=n+(n<<3)|0,n=(n=n<<21|n>>>11)+r|0,(r>>>0)/4294967296}}function splitBigInt(t,e=4){let n=[];for(let $=0n;$<e;$++)n.push(Number(t>>32n*$&4294967295n));return n}const[a,b,c,d]=splitBigInt(SEED,4),rnd=sfc32(a,b,c,d),svg=document.documentElement,${code}]]></script></svg>`;

      return svgContent;
    } catch (error) {
      console.error("Failed to generate SVG:", error);
      return null;
    }
  }
}

export const tezosService = new TezosService();
