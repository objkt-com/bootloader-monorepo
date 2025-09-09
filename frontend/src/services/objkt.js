import { getContractAddress, getNetworkConfig } from '../config.js';

class ObjktService {
  constructor() {
    // Get the correct objkt API endpoint for the current network
    const networkConfig = getNetworkConfig();
    this.graphqlEndpoint = networkConfig.objktApi;
  }

  async graphqlQuery(query, variables = {}) {
    try {
      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      return result.data;
    } catch (error) {
      console.error('Objkt GraphQL request failed:', error);
      throw error;
    }
  }

  // Get tokens owned by a specific address from the FA2 contract
  async getOwnedTokens(ownerAddress, limit = 50) {
    const contractAddress = getContractAddress();
    
    if (!contractAddress) {
      throw new Error('Contract address not configured for current network');
    }

    const query = `
      query GetOwnedTokens($ownerAddress: String!, $contractAddress: String!, $limit: Int!) {
        token_holder(
          where: {
            holder_address: { _eq: $ownerAddress }
            quantity: { _gt: "0" }
            token: {
              fa_contract: { _eq: $contractAddress }
            }
          }
          order_by: { token: { pk: desc } }
          limit: $limit
        ) {
          quantity
          token {
            pk
            token_id
            name
            description
            artifact_uri
            display_uri
            thumbnail_uri
            mime
            supply
            timestamp
            fa_contract
            metadata
          }
        }
      }
    `;

    const variables = {
      ownerAddress,
      contractAddress,
      limit,
    };

    try {
      const data = await this.graphqlQuery(query, variables);
      
      // Transform the data to match the expected format
      const tokens = data.token_holder.map(holder => {
        const token = holder.token;
        
        // Extract seed from artifact_uri if it's an SVG with embedded seed
        let seed = 12345; // default
        if (token.artifact_uri) {
          const seedMatch = token.artifact_uri.match(/const SEED=(\d+)/);
          if (seedMatch) {
            seed = parseInt(seedMatch[1]);
          }
        }

        // Try to extract generator info from metadata or name
        let generatorId = null;
        let generatorName = 'Unknown Generator';
        
        // Parse metadata if available
        if (token.metadata) {
          try {
            const metadata = typeof token.metadata === 'string' 
              ? JSON.parse(token.metadata) 
              : token.metadata;
            
            // Look for generator info in attributes or other metadata fields
            if (metadata.attributes) {
              const generatorAttr = metadata.attributes.find(attr => 
                attr.trait_type === 'Generator' || attr.trait_type === 'generator'
              );
              if (generatorAttr) {
                generatorName = generatorAttr.value;
              }
            }
          } catch (e) {
            console.warn('Failed to parse token metadata:', e);
          }
        }

        return {
          tokenId: parseInt(token.token_id),
          pk: token.pk,
          name: token.name || `Token #${token.token_id}`,
          description: token.description,
          artifactUri: token.artifact_uri,
          displayUri: token.display_uri,
          thumbnailUri: token.thumbnail_uri,
          mime: token.mime,
          supply: parseInt(token.supply || 1),
          timestamp: token.timestamp,
          seed,
          generatorId,
          generatorName,
          quantity: parseFloat(holder.quantity),
          owner: ownerAddress,
        };
      });

      return tokens;
    } catch (error) {
      console.error(`Failed to get owned tokens for ${ownerAddress}:`, error);
      throw error;
    }
  }

  // Get total count of tokens owned by an address (for the tab counter)
  async getOwnedTokensCount(ownerAddress) {
    const contractAddress = getContractAddress();
    
    if (!contractAddress) {
      return 0;
    }

    const query = `
      query GetOwnedTokensCount($ownerAddress: String!, $contractAddress: String!) {
        token_holder_aggregate(
          where: {
            holder_address: { _eq: $ownerAddress }
            quantity: { _gt: "0" }
            token: {
              fa_contract: { _eq: $contractAddress }
            }
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `;

    const variables = {
      ownerAddress,
      contractAddress,
    };

    try {
      const data = await this.graphqlQuery(query, variables);
      return data.token_holder_aggregate.aggregate.count || 0;
    } catch (error) {
      console.error(`Failed to get owned tokens count for ${ownerAddress}:`, error);
      return 0;
    }
  }

  // Get token details by token ID (useful for additional token info)
  async getTokenDetails(tokenId) {
    const contractAddress = getContractAddress();
    
    if (!contractAddress) {
      throw new Error('Contract address not configured for current network');
    }

    const query = `
      query GetTokenDetails($contractAddress: String!, $tokenId: String!) {
        token(
          where: {
            fa_contract: { _eq: $contractAddress }
            token_id: { _eq: $tokenId }
          }
        ) {
          pk
          token_id
          name
          description
          artifact_uri
          display_uri
          thumbnail_uri
          mime
          supply
          timestamp
          fa_contract
          metadata
          creators {
            creator_address
            verified
          }
          holders {
            holder_address
            quantity
          }
        }
      }
    `;

    const variables = {
      contractAddress,
      tokenId: tokenId.toString(),
    };

    try {
      const data = await this.graphqlQuery(query, variables);
      return data.token.length > 0 ? data.token[0] : null;
    } catch (error) {
      console.error(`Failed to get token details for ${tokenId}:`, error);
      throw error;
    }
  }
}

export const objktService = new ObjktService();
