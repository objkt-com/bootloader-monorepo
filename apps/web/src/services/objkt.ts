import { getNetworkConfig, getContractAddress, getGenericWebContractAddress } from '@/config'
import type { BootloaderId } from '@/types/bootloader'

// Cache for user profiles to avoid repeated API calls
const userProfileCache = new Map<string, UserProfile | null>()
const tokenVersionCache = new Map<string, number | null>()
const tokenExtraPtrCache = new Map<string, number | null>()

export interface UserProfile {
  address: string
  alias?: string
  description?: string
  twitter?: string
  tzdomain?: string
  logo?: string
}

export interface ActivityEvent {
  id: string
  eventType: 'mint' | 'sale'
  marketplaceEventType?: string
  amount: number
  price?: number
  priceXtz?: number
  timestamp: string
  ophash?: string
  level?: number
  creatorAddress?: string
  creatorAlias?: string
  recipientAddress?: string
  recipientAlias?: string
  tokenId: string
  tokenName?: string
  tokenDescription?: string
  tokenThumbnailUri?: string
  tokenDisplayUri?: string
  tokenArtifactUri?: string
  generatorId?: string
  generatorVersion?: number
  faContract?: string
  bootloaderId: BootloaderId
}

export interface OwnedToken {
  tokenId: number
  pk: string
  name: string
  description?: string
  artifactUri?: string
  displayUri?: string
  thumbnailUri?: string
  timestamp?: string
  quantity: number
  creators: Array<{ creator_address: string; verified?: boolean }>
  faContract: string
  bootloaderId: BootloaderId
}

/**
 * Gets the correct objkt API URL based on network configuration
 */
function getObjktApiUrl(): string {
  const networkConfig = getNetworkConfig()
  // Use shadownet API for shadownet, mainnet API for mainnet
  return networkConfig.tzktApi.includes('shadownet')
    ? 'https://data.shadownet.objkt.com/v3/graphql'
    : 'https://data.objkt.com/v3/graphql'
}

async function getTokenExtraBigMapPtr(faContract: string): Promise<number | null> {
  const cached = tokenExtraPtrCache.get(faContract)
  if (cached !== undefined) return cached

  try {
    const networkConfig = getNetworkConfig()
    const response = await fetch(`${networkConfig.tzktApi}/v1/contracts/${faContract}/bigmaps`)
    if (!response.ok) {
      tokenExtraPtrCache.set(faContract, null)
      return null
    }

    const bigmaps = (await response.json()) as Array<{ path?: string; ptr?: number }>
    const tokenExtra = bigmaps.find((entry) => entry.path === 'token_extra')
    const ptr = typeof tokenExtra?.ptr === 'number' ? tokenExtra.ptr : null
    tokenExtraPtrCache.set(faContract, ptr)
    return ptr
  } catch {
    tokenExtraPtrCache.set(faContract, null)
    return null
  }
}

async function fetchTokenGeneratorVersion(
  faContract: string | undefined,
  tokenId: string | undefined
): Promise<number | undefined> {
  if (!faContract || !tokenId) return undefined
  const cacheKey = `${faContract}:${tokenId}`
  const cached = tokenVersionCache.get(cacheKey)
  if (cached !== undefined) return cached ?? undefined

  const tokenExtraPtr = await getTokenExtraBigMapPtr(faContract)
  if (!tokenExtraPtr) return undefined

  try {
    const networkConfig = getNetworkConfig()
    const response = await fetch(
      `${networkConfig.tzktApi}/v1/bigmaps/${tokenExtraPtr}/keys/${encodeURIComponent(tokenId)}`
    )
    if (!response.ok) return undefined

    const payload = (await response.json()) as {
      value?: { generator_version?: string | number }
    }
    const parsed = Number(payload.value?.generator_version)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      tokenVersionCache.set(cacheKey, null)
      return undefined
    }

    const version = Math.trunc(parsed)
    tokenVersionCache.set(cacheKey, version)
    return version
  } catch {
    tokenVersionCache.set(cacheKey, null)
    return undefined
  }
}

function getCachedTokenGeneratorVersion(
  faContract: string | undefined,
  tokenId: string | undefined
): number | undefined {
  if (!faContract || !tokenId) return undefined
  const cacheKey = `${faContract}:${tokenId}`
  const cached = tokenVersionCache.get(cacheKey)
  return cached === null || cached === undefined ? undefined : cached
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

async function batchFetchTokenGeneratorVersions(
  faContract: string,
  tokenIds: string[]
): Promise<void> {
  if (tokenIds.length === 0) return

  const tokenExtraPtr = await getTokenExtraBigMapPtr(faContract)
  if (!tokenExtraPtr) return

  const networkConfig = getNetworkConfig()
  const uniqueTokenIds = Array.from(new Set(tokenIds))
  const uncachedTokenIds = uniqueTokenIds.filter((tokenId) => {
    const cacheKey = `${faContract}:${tokenId}`
    return !tokenVersionCache.has(cacheKey)
  })
  if (uncachedTokenIds.length === 0) return

  const chunks = chunkArray(uncachedTokenIds, 80)

  await Promise.all(
    chunks.map(async (chunk) => {
      const query = encodeURIComponent(chunk.join(','))
      const url = `${networkConfig.tzktApi}/v1/bigmaps/${tokenExtraPtr}/keys?active=true&select=key,value.generator_version&key.in=${query}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Batch fetch failed with status ${response.status}`)
      }

      const payload = (await response.json()) as Array<{
        key?: string | number
        value?: { generator_version?: string | number }
      }>
      const found = new Set<string>()

      payload.forEach((entry) => {
        const key = String(entry.key ?? '')
        if (!key) return
        found.add(key)

        const parsed = Number(entry.value?.generator_version)
        const cacheKey = `${faContract}:${key}`
        if (Number.isFinite(parsed) && parsed > 0) {
          tokenVersionCache.set(cacheKey, Math.trunc(parsed))
        } else {
          tokenVersionCache.set(cacheKey, null)
        }
      })

      // Mark keys missing from batch response as absent to avoid refetch loops.
      chunk.forEach((tokenId) => {
        if (!found.has(tokenId)) {
          tokenVersionCache.set(`${faContract}:${tokenId}`, null)
        }
      })
    })
  )
}

async function primeTokenGeneratorVersions(
  events: Array<{ fa_contract: string; token?: { token_id?: string } }>
): Promise<void> {
  const tokenIdsByContract = new Map<string, string[]>()

  events.forEach((event) => {
    const tokenId = event.token?.token_id
    if (!tokenId || !event.fa_contract) return
    const current = tokenIdsByContract.get(event.fa_contract) || []
    current.push(tokenId)
    tokenIdsByContract.set(event.fa_contract, current)
  })

  await Promise.all(
    Array.from(tokenIdsByContract.entries()).map(async ([faContract, tokenIds]) => {
      try {
        await batchFetchTokenGeneratorVersions(faContract, tokenIds)
      } catch {
        // Batch may fail on unsupported params or transient backend issues.
        // We'll lazily fall back to per-token lookup during event mapping.
      }
    })
  )
}

/**
 * Fetches user profile from objkt API
 */
export async function fetchUserProfile(address: string): Promise<UserProfile | null> {
  if (!address) return null

  // Check cache first
  if (userProfileCache.has(address)) {
    return userProfileCache.get(address) ?? null
  }

  try {
    const query = `
      query GetHolder($address: String!) {
        holder(where: {address: {_eq: $address}}) {
          address
          alias
          description
          twitter
          tzdomain
          logo
        }
      }
    `

    const response = await fetch(getObjktApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { address },
      }),
    })

    const data = await response.json()
    const holder = data.data?.holder

    // Handle case where holder is an array (GraphQL returns array) or null/undefined
    const profile =
      holder && Array.isArray(holder) && holder.length > 0 ? holder[0] : null

    // Cache the result (even if null)
    userProfileCache.set(address, profile)

    return profile
  } catch (err) {
    console.error('Failed to fetch user profile:', err)
    userProfileCache.set(address, null)
    return null
  }
}

/**
 * Fetches multiple user profiles in a single batch request
 */
export async function fetchUserProfilesBatch(
  addresses: string[]
): Promise<Map<string, UserProfile | null>> {
  if (!addresses || addresses.length === 0) {
    return new Map()
  }

  // Filter out addresses that are already cached
  const uncachedAddresses = addresses.filter(
    (address) => !userProfileCache.has(address)
  )
  const results = new Map<string, UserProfile | null>()

  // Add cached results first
  addresses.forEach((address) => {
    if (userProfileCache.has(address)) {
      results.set(address, userProfileCache.get(address) ?? null)
    }
  })

  // If all addresses are cached, return early
  if (uncachedAddresses.length === 0) {
    return results
  }

  try {
    const query = `
      query GetHolders($addresses: [String!]!) {
        holder(where: {address: {_in: $addresses}}) {
          address
          alias
          description
          twitter
          tzdomain
          logo
        }
      }
    `

    const response = await fetch(getObjktApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { addresses: uncachedAddresses },
      }),
    })

    const data = await response.json()
    const holders = data.data?.holder || []

    // Create a map of found profiles
    const foundProfiles = new Map<string, UserProfile>()
    holders.forEach((holder: UserProfile) => {
      foundProfiles.set(holder.address, holder)
    })

    // Process all uncached addresses
    uncachedAddresses.forEach((address) => {
      const profile = foundProfiles.get(address) || null
      userProfileCache.set(address, profile)
      results.set(address, profile)
    })

    return results
  } catch (err) {
    console.error('Failed to fetch user profiles batch:', err)

    // Cache null for all failed addresses to prevent repeated failures
    uncachedAddresses.forEach((address) => {
      userProfileCache.set(address, null)
      results.set(address, null)
    })

    return results
  }
}

/**
 * Formats an address to a shortened version
 */
export function formatAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Gets the best display name for a user based on priority:
 * 1. alias
 * 2. tzdomain
 * 3. address shortened
 */
export function getDisplayName(
  profile: UserProfile | null,
  address?: string
): string {
  if (!profile && !address) return ''

  if (profile) {
    // Priority 1: alias
    if (profile.alias && profile.alias.trim()) {
      return profile.alias.trim()
    }

    // Priority 2: tzdomain
    if (profile.tzdomain && profile.tzdomain.trim()) {
      return profile.tzdomain.trim()
    }
  }

  // Priority 3: shortened address
  return formatAddress(address || profile?.address || '')
}

/**
 * Clears the user profile cache
 */
export function clearUserProfileCache(): void {
  userProfileCache.clear()
}

/**
 * Gets all bootloader contract addresses that are configured
 */
function getAllContractAddresses(): Array<{ address: string; bootloaderId: BootloaderId }> {
  const contracts: Array<{ address: string; bootloaderId: BootloaderId }> = []

  const svgJsContract = getContractAddress()
  if (svgJsContract) {
    contracts.push({ address: svgJsContract, bootloaderId: 'svg-js' })
  }

  const genericWebContract = getGenericWebContractAddress()
  if (genericWebContract) {
    contracts.push({ address: genericWebContract, bootloaderId: 'generic-web' })
  }

  return contracts
}

/**
 * Maps a contract address to its bootloader ID
 */
function getBootloaderIdForContract(faContract: string): BootloaderId {
  const genericWebContract = getGenericWebContractAddress()

  if (faContract === genericWebContract) {
    return 'generic-web'
  }
  // Default to svg-js for the main contract
  return 'svg-js'
}

/**
 * Fetches bootloader activity (mints and marketplace events) from all bootloader contracts
 */
export async function fetchBootloaderActivity(
  limit = 50,
  sinceTimestamp?: string
): Promise<ActivityEvent[]> {
  const contracts = getAllContractAddresses()

  if (contracts.length === 0) {
    throw new Error('No contract addresses configured for current network')
  }

  // Get just the addresses for the query
  const contractAddresses = contracts.map(c => c.address)

  // Build where clause for filtering - only mints and specific marketplace events
  // Query all bootloader contracts using _in operator
  const whereClause: Record<string, unknown> = {
    fa_contract: { _in: contractAddresses },
    _or: [
      { event_type: { _eq: 'mint' } },
      {
        marketplace_event_type: {
          _in: [
            'dutch_auction_buy',
            'offer_accept',
            'offer_floor_accept',
            'english_auction_settle',
            'list_buy',
          ],
        },
      },
    ],
  }

  // Add timestamp filter for polling new events
  if (sinceTimestamp) {
    whereClause.timestamp = { _gt: sinceTimestamp }
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
        fa_contract
        creator {
          address
          alias
        }
        recipient {
          address
          alias
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
  `

  try {
    const response = await fetch(getObjktApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { whereClause, limit },
      }),
    })

    const data = await response.json()
    const events = data.data?.event || []

    // Prime token generator versions with batched bigmap key lookups.
    // This avoids one /keys/{tokenId} request per activity item.
    await primeTokenGeneratorVersions(events)

    // Transform the data to match our expected format
    return Promise.all(events.map(
      async (event: {
        id: string
        event_type: string
        marketplace_event_type?: string
        amount?: number
        price?: number
        price_xtz?: number
        timestamp: string
        ophash?: string
        level?: number
        fa_contract: string
        creator?: { address: string; alias?: string }
        recipient?: { address: string; alias?: string }
        token?: {
          pk: string
          token_id: string
          name?: string
          description?: string
          thumbnail_uri?: string
          display_uri?: string
          artifact_uri?: string
        }
      }): Promise<ActivityEvent> => {
        const isMint = event.event_type === 'mint'
        const bootloaderId = getBootloaderIdForContract(event.fa_contract)
        const tokenId = event.token?.token_id || ''
        const generatorVersion =
          getCachedTokenGeneratorVersion(event.fa_contract, tokenId) ??
          (await fetchTokenGeneratorVersion(event.fa_contract, tokenId))

        return {
          id: event.id,
          eventType: isMint ? 'mint' : 'sale',
          marketplaceEventType: event.marketplace_event_type,
          amount: event.amount || 1,
          price: event.price,
          priceXtz: event.price_xtz,
          timestamp: event.timestamp,
          ophash: event.ophash,
          level: event.level,
          faContract: event.fa_contract,
          bootloaderId,
          creatorAddress: event.creator?.address,
          creatorAlias: event.creator?.alias,
          recipientAddress: event.recipient?.address,
          recipientAlias: event.recipient?.alias,
          tokenId,
          generatorVersion,
          tokenName: event.token?.name,
          tokenDescription: event.token?.description,
          tokenThumbnailUri: event.token?.thumbnail_uri,
          tokenDisplayUri: event.token?.display_uri,
          tokenArtifactUri: event.token?.artifact_uri,
        }
      }
    ))
  } catch (err) {
    console.error('Failed to fetch bootloader activity:', err)
    throw err
  }
}

/**
 * Fetches tokens owned by a specific address from all bootloader contracts
 */
export async function fetchOwnedTokens(
  ownerAddress: string,
  limit = 50,
  offset = 0
): Promise<OwnedToken[]> {
  const contracts = getAllContractAddresses()

  if (contracts.length === 0) {
    throw new Error('No contract addresses configured for current network')
  }

  const contractAddresses = contracts.map(c => c.address)

  const query = `
    query GetOwnedTokens($ownerAddress: String!, $contractAddresses: [String!]!, $limit: Int!, $offset: Int!) {
      token_holder(
        where: {
          holder_address: { _eq: $ownerAddress }
          quantity: { _gt: "0" }
          token: {
            fa_contract: { _in: $contractAddresses }
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
          timestamp
          fa_contract
          creators {
            creator_address
            verified
          }
        }
      }
    }
  `

  try {
    const response = await fetch(getObjktApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { ownerAddress, contractAddresses, limit, offset },
      }),
    })

    const data = await response.json()
    const holders = data.data?.token_holder || []

    return holders.map(
      (holder: {
        quantity: string
        token: {
          pk: string
          token_id: string
          name?: string
          description?: string
          artifact_uri?: string
          display_uri?: string
          thumbnail_uri?: string
          timestamp?: string
          fa_contract: string
          creators?: Array<{ creator_address: string; verified?: boolean }>
        }
      }): OwnedToken => ({
        tokenId: parseInt(holder.token.token_id),
        pk: holder.token.pk,
        name: holder.token.name || `Token #${holder.token.token_id}`,
        description: holder.token.description,
        artifactUri: holder.token.artifact_uri,
        displayUri: holder.token.display_uri,
        thumbnailUri: holder.token.thumbnail_uri,
        timestamp: holder.token.timestamp,
        quantity: parseFloat(holder.quantity),
        creators: holder.token.creators || [],
        faContract: holder.token.fa_contract,
        bootloaderId: getBootloaderIdForContract(holder.token.fa_contract),
      })
    )
  } catch (err) {
    console.error('Failed to fetch owned tokens:', err)
    throw err
  }
}

/**
 * Fetches the count of tokens owned by a specific address from all bootloader contracts
 * Uses pagination-based counting since objkt API doesn't support aggregate queries
 */
export async function fetchOwnedTokensCount(ownerAddress: string): Promise<number> {
  const contracts = getAllContractAddresses()

  if (contracts.length === 0) {
    return 0
  }

  const contractAddresses = contracts.map((c) => c.address)

  let totalCount = 0
  let offset = 0
  const limit = 100 // Higher limit for faster counting
  let hasMore = true

  const query = `
    query GetOwnedTokensPkOnly($ownerAddress: String!, $contractAddresses: [String!]!, $limit: Int!, $offset: Int!) {
      token_holder(
        where: {
          holder_address: { _eq: $ownerAddress }
          quantity: { _gt: "0" }
          token: {
            fa_contract: { _in: $contractAddresses }
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
  `

  try {
    while (hasMore) {
      const response = await fetch(getObjktApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { ownerAddress, contractAddresses, limit, offset },
        }),
      })

      const data = await response.json()
      const batch = data.data?.token_holder || []

      totalCount += batch.length
      hasMore = batch.length === limit
      offset += limit
    }

    return totalCount
  } catch (err) {
    console.error('Failed to fetch owned tokens count:', err)
    return 0
  }
}
