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
      }
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

  async createGenerator(name, code, description = "", reservedEditions = 0) {
    try {
      if (!this.contract) {
        await this.loadContract();
      }

      // URL encode the code before converting to bytes
      const encodedCode = encodeURIComponent(code);

      // Use methodsObject with named parameters matching the new contract signature
      const operation = await this.contract.methodsObject
        .create_generator({
          name: this.stringToBytes(name),
          description: this.stringToBytes(description),
          code: this.stringToBytes(encodedCode),
          author_bytes: this.stringToBytes(this.userAddress || ""),
          reserved_editions: reservedEditions,
        })
        .send();

      await operation.confirmation();
      return { success: true, hash: operation.hash };
    } catch (error) {
      console.error("Failed to create generator:", error);
      return { success: false, error: error.message };
    }
  }

  async updateGenerator(generatorId, name, code, description = "", reservedEditions = 0) {
    try {
      if (!this.contract) {
        await this.loadContract();
      }

      // URL encode the code before converting to bytes
      const encodedCode = encodeURIComponent(code);

      // Use methodsObject with named parameters matching the new contract signature
      const operation = await this.contract.methodsObject
        .update_generator({
          generator_id: generatorId,
          name: this.stringToBytes(name),
          description: this.stringToBytes(description),
          code: this.stringToBytes(encodedCode),
          author_bytes: this.stringToBytes(this.userAddress || ""),
          reserved_editions: reservedEditions,
        })
        .send();

      await operation.confirmation();
      return { success: true, hash: operation.hash };
    } catch (error) {
      console.error("Failed to update generator:", error);
      return { success: false, error: error.message };
    }
  }

  async setSale(generatorId, startTime, price, paused, editions, maxPerWallet = null) {
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
          max_per_wallet: maxPerWallet, // null for no limit, or number for limit
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

      // Get the current next_token_id before minting
      const storageBefore = await this.getContractStorage();
      const nextTokenId = parseInt(storageBefore.next_token_id);

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

      // Extract the actual minted token information from the operation result
      let mintedTokenId = nextTokenId; // fallback to predicted ID
      let artifactUri = null;

      try {
        // Get the operation results to find the actual token that was minted
        const operationResult = await operation.operationResults();

        if (operationResult && operationResult.length > 0) {
          // Look for lazy_storage_diff that contains bigmap updates
          for (let i = 0; i < operationResult.length; i++) {
            const result = operationResult[i];

            // Check for lazy_storage_diff in the correct location: metadata.operation_result.lazy_storage_diff
            const lazyStorageDiff =
              result.metadata?.operation_result?.lazy_storage_diff ||
              result.lazy_storage_diff;

            if (lazyStorageDiff && Array.isArray(lazyStorageDiff)) {
              for (const lazyDiff of lazyStorageDiff) {
                // Look for big_map updates
                if (
                  lazyDiff.kind === "big_map" &&
                  lazyDiff.diff &&
                  lazyDiff.diff.updates
                ) {
                  for (const update of lazyDiff.diff.updates) {
                    // Look for token_metadata updates (value contains token_info)
                    if (
                      update.value &&
                      update.value.args &&
                      update.value.args.length >= 2
                    ) {
                      const tokenInfo = update.value.args[1];

                      // Check if this looks like token_info (array of Elt entries)
                      if (
                        Array.isArray(tokenInfo) &&
                        tokenInfo.length > 0 &&
                        tokenInfo[0].prim === "Elt"
                      ) {
                        // Extract the actual token ID that was minted
                        mintedTokenId = parseInt(update.key.int);

                        // Find the artifactUri and name in the token_info entries
                        let tokenName = null;
                        for (const entry of tokenInfo) {
                          if (entry.args && entry.args.length >= 2) {
                            if (entry.args[0].string === "artifactUri") {
                              artifactUri = this.bytesToString(
                                entry.args[1].bytes
                              );
                            } else if (entry.args[0].string === "name") {
                              tokenName = this.bytesToString(
                                entry.args[1].bytes
                              );
                            }
                          }
                        }

                        if (artifactUri && tokenName) {
                          // Store the extracted token name for later use
                          this.extractedTokenName = tokenName;
                          break; // Found what we need, exit the loops
                        }
                      }
                    }
                  }

                  if (artifactUri) {
                    break; // Found what we need, exit the loops
                  }
                }
              }

              if (artifactUri) {
                break; // Found what we need, exit the loops
              }
            }
          }
        }

        // Fallback: Get the contract storage after the mint to fetch the token metadata
        if (!artifactUri) {
          const storageAfter = await this.getContractStorage();
          const tokenMetadata = await storageAfter.token_metadata.get(
            mintedTokenId.toString()
          );

          if (
            tokenMetadata &&
            tokenMetadata.token_info &&
            tokenMetadata.token_info.artifactUri
          ) {
            // Decode the artifactUri from bytes
            artifactUri = this.bytesToString(
              tokenMetadata.token_info.artifactUri
            );
          }
        }
      } catch (error) {
        console.warn(
          "Failed to fetch token metadata from operation result:",
          error
        );
      }

      return {
        success: true,
        hash: operation.hash,
        tokenId: mintedTokenId,
        entropy: entropyHex,
        artifactUri: artifactUri,
        tokenName: this.extractedTokenName, // On-chain token name if extracted
      };
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
      // Create the complete JavaScript code including the random number generator
      const encodedCode = encodeURIComponent(code);

      // Use the new template structure with $svg object
      const svgContent = `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cscript%3E%3C!%5BCDATA%5Bconst%20SEED%3D${seed}n%3Bfunction%20splitmix64(f)%7Blet%20n%3Df%3Breturn%20function()%7Blet%20f%3Dn%3Dn%2B0x9e3779b97f4a7c15n%260xffffffffffffffffn%3Breturn%20f%3D((f%3D(f%5Ef%3E%3E30n)*0xbf58476d1ce4e5b9n%260xffffffffffffffffn)%5Ef%3E%3E27n)*0x94d049bb133111ebn%260xffffffffffffffffn%2CNumber(4294967295n%26(f%5E%3Df%3E%3E31n))%3E%3E%3E0%7D%7Dfunction%20sfc32(f%2Cn%2C%24%2Ct)%7Breturn%20function()%7B%24%7C%3D0%3Blet%20e%3D((f%7C%3D0)%2B(n%7C%3D0)%7C0)%2B(t%7C%3D0)%7C0%3Breturn%20t%3Dt%2B1%7C0%2Cf%3Dn%5En%3E%3E%3E9%2Cn%3D%24%2B(%24%3C%3C3)%7C0%2C%24%3D(%24%3D%24%3C%3C21%7C%24%3E%3E%3E11)%2Be%7C0%2C(e%3E%3E%3E0)%2F4294967296%7D%7Dconst%20sm%3Dsplitmix64(SEED)%2Ca%3Dsm()%2Cb%3Dsm()%2Cc%3Dsm()%2Cd%3Dsm()%2C%24svg%3D%7Brnd%3Asfc32(a%2Cb%2Cc%2Cd)%2CSEED%3ASEED%2Csvg%3Adocument.documentElement%2Cv%3A'0.0.1'%7D%3B((%24svg)%3D%3E%7B${encodedCode}%7D)(%24svg)%3B%5D%5D%3E%3C%2Fscript%3E%3C%2Fsvg%3E`;

      return svgContent;
    } catch (error) {
      console.error("Failed to generate SVG:", error);
      return null;
    }
  }
}

export const tezosService = new TezosService();
