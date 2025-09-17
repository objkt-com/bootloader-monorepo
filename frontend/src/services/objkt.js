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
  async getOwnedTokens(ownerAddress, limit = 50, offset = 0) {
    const contractAddress = getContractAddress();
    
    if (!contractAddress) {
      throw new Error('Contract address not configured for current network');
    }

    const query = `
      query GetOwnedTokens($ownerAddress: String!, $contractAddress: String!, $limit: Int!, $offset: Int!) {
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
          offset: $offset
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
            creators {
              creator_address
              verified
            }
          }
        }
      }
    `;

    const variables = {
      ownerAddress,
      contractAddress,
      limit,
      offset,
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
          creators: token.creators || [],
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

  // Fast count query - only fetches pk field with higher limit for quick pagination
  async getOwnedTokensCount(ownerAddress) {
    const contractAddress = getContractAddress();

    if (!contractAddress) {
      console.log('No contract address, returning 0');
      return 0;
    }

    let totalCount = 0;
    let offset = 0;
    const limit = 100; // Higher limit for faster counting
    let hasMore = true;

    try {
      while (hasMore) {
        const query = `
          query GetOwnedTokensPkOnly($ownerAddress: String!, $contractAddress: String!, $limit: Int!, $offset: Int!) {
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
              offset: $offset
            ) {
              token {
                pk
              }
            }
          }
        `;

        const variables = {
          ownerAddress,
          contractAddress,
          limit,
          offset,
        };

        const data = await this.graphqlQuery(query, variables);
        const batch = data.token_holder || [];

        totalCount += batch.length;
        hasMore = batch.length === limit;
        offset += limit;
      }

      return totalCount;
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

  // Get bootloader activity (mints and marketplace events)
  async getBootloaderActivity(limit = 50, sinceTimestamp = null) {
    const contractAddress = getContractAddress();
    
    if (!contractAddress) {
      throw new Error('Contract address not configured for current network');
    }

    // Build where clause for filtering - only mints and specific marketplace events
    let whereClause = {
      fa_contract: { _eq: contractAddress },
      _or: [
        { event_type: { _eq: "mint" } },
        { 
          marketplace_event_type: { 
            _in: ["dutch_auction_buy", "offer_accept", "offer_floor_accept", "english_auction_settle", "list_buy"] 
          } 
        }
      ]
    };

    // Add timestamp filter for polling new events
    if (sinceTimestamp) {
      whereClause.timestamp = { _gt: sinceTimestamp };
    }

    const query = `
      query GetBootloaderActivity($whereClause: event_bool_exp!, $limit: Int!) {
        event(
          where: $whereClause
          order_by: { timestamp: desc }
          limit: $limit
        ) {
          id
          event_type
          marketplace_event_type
          amount
          price
          price_xtz
          timestamp
          ophash
          level
          creator {
            address
            alias
            logo
          }
          recipient {
            address
            alias
            logo
          }
          token {
            pk
            token_id
            name
            description
            thumbnail_uri
            display_uri
            artifact_uri
          }
        }
      }
    `;

    const variables = {
      whereClause,
      limit,
    };

    try {
      const data = await this.graphqlQuery(query, variables);
      
      // Transform the data to match our expected format
      const events = data.event.map(event => {
        // Determine if this is a mint or sale event
        const isMint = event.event_type === 'mint';
        const eventType = isMint ? 'mint' : 'sale';
        
        return {
          id: event.id,
          event_type: eventType,
          marketplace_event_type: event.marketplace_event_type,
          amount: event.amount || 1,
          price: event.price,
          price_xtz: event.price_xtz,
          timestamp: event.timestamp,
          ophash: event.ophash,
          level: event.level,
          creator_address: event.creator?.address,
          creator_alias: event.creator?.alias,
          creator_logo: event.creator?.logo,
          recipient_address: event.recipient?.address,
          recipient_alias: event.recipient?.alias,
          recipient_logo: event.recipient?.logo,
          token_id: event.token?.token_id,
          token_name: event.token?.name,
          token_description: event.token?.description,
          token_thumbnail_uri: event.token?.thumbnail_uri,
          token_display_uri: event.token?.display_uri,
          token_artifact_uri: event.token?.artifact_uri,
        };
      });

      return events;
    } catch (error) {
      console.error('Failed to get bootloader activity:', error);
      throw error;
    }
  }
}

export const objktService = new ObjktService();
