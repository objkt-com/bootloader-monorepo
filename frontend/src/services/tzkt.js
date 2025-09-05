import { getNetworkConfig, getContractAddress } from "../config.js";

class TzKTService {
  constructor() {
    this.config = getNetworkConfig();
    this.contractAddress = getContractAddress();
    this.baseUrl = this.config.tzktApi;
  }

  async fetchJson(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("TzKT API request failed:", error);
      throw error;
    }
  }

  // Get all bigmaps for the contract
  async getContractBigMaps() {
    const url = `${this.baseUrl}/v1/bigmaps?contract=${this.contractAddress}&active=true`;
    return await this.fetchJson(url);
  }

  // Get bigmap by path (e.g., "generators", "frags")
  async getBigMapByPath(path) {
    const url = `${this.baseUrl}/v1/bigmaps?contract=${this.contractAddress}&path=${path}&active=true`;
    const bigmaps = await this.fetchJson(url);
    return bigmaps.length > 0 ? bigmaps[0] : null;
  }

  // Get all keys from a bigmap
  async getBigMapKeys(bigmapId, options = {}) {
    let url = `${this.baseUrl}/v1/bigmaps/${bigmapId}/keys?active=true`;

    // Add query parameters
    const params = new URLSearchParams();
    if (options.limit) params.append("limit", options.limit);
    if (options.offset) params.append("offset", options.offset);
    if (options.select) params.append("select", options.select);

    // Handle sorting - TzKT uses sort.field=direction format
    if (options.sortField && options.sortDirection) {
      params.append(`sort.${options.sortField}`, options.sortDirection);
    } else if (options.sort) {
      // Legacy support for simple sort parameter
      params.append("sort", options.sort);
    }

    const queryString = params.toString();
    if (queryString) {
      url += `&${queryString}`;
    }

    return await this.fetchJson(url);
  }

  // Get a specific key from a bigmap
  async getBigMapKey(bigmapId, key) {
    const url = `${
      this.baseUrl
    }/v1/bigmaps/${bigmapId}/keys/${encodeURIComponent(key)}`;
    try {
      return await this.fetchJson(url);
    } catch (error) {
      // Key might not exist
      if (error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  // Get all generators from the generators bigmap
  async getGenerators() {
    try {
      const generatorsBigMap = await this.getBigMapByPath("generators");
      if (!generatorsBigMap) {
        console.warn("Generators bigmap not found");
        return [];
      }

      const keys = await this.getBigMapKeys(generatorsBigMap.ptr, {
        sortField: "key",
        sortDirection: "desc", // Sort descending (newest first)
        limit: 1000, // Adjust as needed
      });

      const generators = keys.map((keyData) => {
        const generator = keyData.value;
        return {
          id: parseInt(keyData.key),
          name: this.bytesToString(generator.name),
          description: this.bytesToString(generator.description),
          author: generator.author,
          code: this.bytesToStringAndDecodeUrl(generator.code),
          created: new Date(generator.created),
          lastUpdate: new Date(generator.last_update),
          nTokens: parseInt(generator.n_tokens || 0),
          sale: generator.sale || null,
        };
      });

      return generators;
    } catch (error) {
      console.error("Failed to get generators from TzKT:", error);
      throw error;
    }
  }

  // Get a specific generator by ID
  async getGenerator(generatorId) {
    try {
      const generatorsBigMap = await this.getBigMapByPath("generators");
      if (!generatorsBigMap) {
        throw new Error("Generators bigmap not found");
      }

      const keyData = await this.getBigMapKey(
        generatorsBigMap.ptr,
        generatorId.toString()
      );
      if (!keyData) {
        return null;
      }

      const generator = keyData.value;
      return {
        id: parseInt(keyData.key),
        name: this.bytesToString(generator.name),
        description: this.bytesToString(generator.description),
        author: generator.author,
        code: this.bytesToStringAndDecodeUrl(generator.code),
        created: new Date(generator.created),
        lastUpdate: new Date(generator.last_update),
      };
    } catch (error) {
      console.error(`Failed to get generator ${generatorId} from TzKT:`, error);
      throw error;
    }
  }

  // Get all fragments from the frags bigmap
  async getFragments() {
    try {
      const fragsBigMap = await this.getBigMapByPath("frags");
      if (!fragsBigMap) {
        console.warn("Fragments bigmap not found");
        return [];
      }

      const keys = await this.getBigMapKeys(fragsBigMap.ptr, {
        sortField: "key",
        sortDirection: "asc", // Sort ascending (0, 1, 2, 3...)
        limit: 10, // Should be enough for fragments
      });

      const fragments = [];
      keys.forEach((keyData) => {
        const index = parseInt(keyData.key);
        fragments[index] = this.bytesToString(keyData.value);
      });

      return fragments;
    } catch (error) {
      console.error("Failed to get fragments from TzKT:", error);
      throw error;
    }
  }

  // Get a specific fragment by index
  async getFragment(index) {
    try {
      const fragsBigMap = await this.getBigMapByPath("frags");
      if (!fragsBigMap) {
        throw new Error("Fragments bigmap not found");
      }

      const keyData = await this.getBigMapKey(
        fragsBigMap.ptr,
        index.toString()
      );
      if (!keyData) {
        return null;
      }

      return this.bytesToString(keyData.value);
    } catch (error) {
      console.error(`Failed to get fragment ${index} from TzKT:`, error);
      throw error;
    }
  }

  // Get contract storage (for fields not in bigmaps)
  async getContractStorage() {
    const url = `${this.baseUrl}/v1/contracts/${this.contractAddress}/storage`;
    return await this.fetchJson(url);
  }

  // Get next generator ID from contract storage
  async getNextGeneratorId() {
    try {
      const storage = await this.getContractStorage();
      return parseInt(storage.next_generator_id);
    } catch (error) {
      console.error("Failed to get next generator ID from TzKT:", error);
      throw error;
    }
  }

  // Get bigmap updates for monitoring changes
  async getBigMapUpdates(bigmapId, options = {}) {
    let url = `${this.baseUrl}/v1/bigmaps/${bigmapId}/updates`;

    const params = new URLSearchParams();
    if (options.limit) params.append("limit", options.limit);
    if (options.offset) params.append("offset", options.offset);
    if (options.sort) params.append("sort", options.sort);
    if (options.level) params.append("level.gt", options.level);

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return await this.fetchJson(url);
  }

  // Get historical bigmap keys at a specific level
  async getHistoricalBigMapKeys(bigmapId, level, options = {}) {
    let url = `${this.baseUrl}/v1/bigmaps/${bigmapId}/historical_keys/${level}`;

    const params = new URLSearchParams();
    if (options.limit) params.append("limit", options.limit);
    if (options.offset) params.append("offset", options.offset);
    if (options.sort) params.append("sort", options.sort);

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return await this.fetchJson(url);
  }

  // Get historical bigmap key at a specific level
  async getHistoricalBigMapKey(bigmapId, level, key) {
    const url = `${
      this.baseUrl
    }/v1/bigmaps/${bigmapId}/historical_keys/${level}/${encodeURIComponent(
      key
    )}`;
    try {
      return await this.fetchJson(url);
    } catch (error) {
      if (error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  // Utility function to convert bytes to string
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

  // Utility function to convert bytes to string and decode URL encoding for code fields
  bytesToStringAndDecodeUrl(bytes) {
    try {
      const decodedString = this.bytesToString(bytes);
      // URL decode the string (this handles the encoded JavaScript code)
      return decodeURIComponent(decodedString);
    } catch (error) {
      console.warn("Failed to decode URL-encoded bytes:", bytes, error);
      // Fallback to regular bytes to string conversion
      return this.bytesToString(bytes);
    }
  }

  // Get latest mints for a specific generator
  async getGeneratorMints(generatorId, limit = 10) {
    try {
      // First get the generator_mapping bigmap to find tokens for this generator
      const generatorMappingBigMap = await this.getBigMapByPath(
        "generator_mapping"
      );
      if (!generatorMappingBigMap) {
        console.warn("Generator mapping bigmap not found");
        return [];
      }

      // Get all generator mapping keys and filter for this generator
      const mappingKeys = await this.getBigMapKeys(generatorMappingBigMap.ptr, {
        sortField: "key",
        sortDirection: "desc", // Sort by token_id descending (newest first)
        limit: 1000, // Get a large batch to filter
      });

      // Filter for tokens that belong to this generator
      const generatorTokens = mappingKeys
        .filter((keyData) => parseInt(keyData.value) === generatorId)
        .slice(0, limit); // Take only the requested number

      if (generatorTokens.length === 0) {
        return [];
      }

      // Now get the token metadata and owner info for these tokens
      const tokenMetadataBigMap = await this.getBigMapByPath("token_metadata");
      const ledgerBigMap = await this.getBigMapByPath("ledger");

      if (!tokenMetadataBigMap || !ledgerBigMap) {
        console.warn("Required bigmaps not found");
        return [];
      }

      // Get metadata and owner for each token
      const tokens = [];
      for (const tokenMapping of generatorTokens) {
        const tokenId = parseInt(tokenMapping.key);
        try {
          const tokenMetadata = await this.getBigMapKey(
            tokenMetadataBigMap.ptr,
            tokenId.toString()
          );
          const tokenOwner = await this.getBigMapKey(
            ledgerBigMap.ptr,
            tokenId.toString()
          );

          if (tokenMetadata && tokenOwner) {
            const tokenInfo = tokenMetadata.value.token_info;
            // Extract the seed from the artifactUri (it's embedded in the SVG)
            const artifactUri = this.bytesToString(tokenInfo.artifactUri);
            const seedMatch = artifactUri.match(/const SEED=(\d+)/);
            const seed = seedMatch ? parseInt(seedMatch[1]) : 12345;

            tokens.push({
              tokenId: tokenId,
              name: this.bytesToString(tokenInfo.name),
              artifactUri: artifactUri,
              seed: seed,
              generatorId: generatorId,
              owner: tokenOwner.value,
            });
          }
        } catch (error) {
          console.warn(`Failed to get data for token ${tokenId}:`, error);
        }
      }

      return tokens;
    } catch (error) {
      console.error(`Failed to get mints for generator ${generatorId}:`, error);
      throw error;
    }
  }

  // Get tokens owned by a specific address
  async getOwnedTokens(ownerAddress, limit = 50) {
    try {
      // Get the ledger bigmap to find tokens owned by this address
      const ledgerBigMap = await this.getBigMapByPath("ledger");
      if (!ledgerBigMap) {
        console.warn("Ledger bigmap not found");
        return [];
      }

      // Get all ledger keys and filter for this owner
      const ledgerKeys = await this.getBigMapKeys(ledgerBigMap.ptr, {
        sortField: "key",
        sortDirection: "desc", // Sort by token_id descending (newest first)
        limit: 1000, // Get a large batch to filter
      });

      // Filter for tokens owned by this address
      const ownedTokens = ledgerKeys
        .filter((keyData) => keyData.value === ownerAddress)
        .slice(0, limit); // Take only the requested number

      if (ownedTokens.length === 0) {
        return [];
      }

      // Now get the token metadata and generator info for these tokens
      const tokenMetadataBigMap = await this.getBigMapByPath("token_metadata");
      const generatorMappingBigMap = await this.getBigMapByPath(
        "generator_mapping"
      );
      const generatorsBigMap = await this.getBigMapByPath("generators");

      if (
        !tokenMetadataBigMap ||
        !generatorMappingBigMap ||
        !generatorsBigMap
      ) {
        console.warn("Required bigmaps not found");
        return [];
      }

      // Get metadata and generator info for each token
      const tokens = [];
      for (const tokenOwnership of ownedTokens) {
        const tokenId = parseInt(tokenOwnership.key);
        try {
          // Get token metadata
          const tokenMetadata = await this.getBigMapKey(
            tokenMetadataBigMap.ptr,
            tokenId.toString()
          );

          // Get generator mapping
          const generatorMapping = await this.getBigMapKey(
            generatorMappingBigMap.ptr,
            tokenId.toString()
          );

          if (tokenMetadata && generatorMapping) {
            const generatorId = parseInt(generatorMapping.value);

            // Get generator info
            const generatorData = await this.getBigMapKey(
              generatorsBigMap.ptr,
              generatorId.toString()
            );

            if (generatorData) {
              const tokenInfo = tokenMetadata.value.token_info;
              const artifactUri = this.bytesToString(tokenInfo.artifactUri);
              const seedMatch = artifactUri.match(/const SEED=(\d+)/);
              const seed = seedMatch ? parseInt(seedMatch[1]) : 12345;

              tokens.push({
                tokenId: tokenId,
                name: this.bytesToString(tokenInfo.name),
                artifactUri: artifactUri,
                seed: seed,
                generatorId: generatorId,
                generatorName: this.bytesToString(generatorData.value.name),
                generatorCode: this.bytesToStringAndDecodeUrl(
                  generatorData.value.code
                ),
                owner: ownerAddress,
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to get data for token ${tokenId}:`, error);
        }
      }

      return tokens;
    } catch (error) {
      console.error(`Failed to get owned tokens for ${ownerAddress}:`, error);
      throw error;
    }
  }

  // Utility function to convert string to bytes (for comparison/filtering)
  stringToBytes(str) {
    return "0x" + Buffer.from(str, "utf8").toString("hex");
  }
}

export const tzktService = new TzKTService();
