import { TezosToolkit, WalletContract } from '@taquito/taquito'
import { getContractAddress, getGenericWebContractAddress, getRngContractAddress } from '@/config'

/**
 * Tezos contract service for bootloader operations
 * Handles all write operations to the smart contract
 */

// Utility: Convert string to hex bytes (0x prefixed)
export function stringToBytes(str: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Utility: Convert hex bytes to string
export function bytesToString(bytes: string): string {
  try {
    let hex = bytes
    if (hex.startsWith('0x')) {
      hex = hex.slice(2)
    }
    if (!/^[0-9a-fA-F]*$/.test(hex)) {
      return bytes
    }
    const byteArray = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      byteArray[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return new TextDecoder().decode(byteArray)
  } catch {
    return bytes
  }
}

// Utility: Generate random entropy (16 bytes as hex string)
export function generateEntropy(): string {
  const entropy = new Uint8Array(16)
  crypto.getRandomValues(entropy)
  return '0x' + Array.from(entropy, (b) => b.toString(16).padStart(2, '0')).join('')
}

export interface CreateGeneratorResult {
  success: boolean
  hash?: string
  generatorId?: string
  error?: string
}

export interface UpdateGeneratorResult {
  success: boolean
  hash?: string
  error?: string
}

export interface SetSaleResult {
  success: boolean
  hash?: string
  error?: string
}

export interface DeleteGeneratorResult {
  success: boolean
  hash?: string
  error?: string
}

export interface MintResult {
  success: boolean
  hash?: string
  tokenId?: string
  entropy?: string
  /** For SVG-JS: the complete data URI containing the rendered SVG */
  artifactUri?: string
  /** For generic-web: the seed from the RNG contract (extracted from operation results) */
  seed?: string
  error?: string
}

export interface RegenerateTokenResult {
  success: boolean
  hash?: string
  error?: string
}

/**
 * Load the bootloader contract (svg-js)
 */
export async function loadContract(tezos: TezosToolkit): Promise<WalletContract> {
  const contractAddress = getContractAddress()
  return await tezos.wallet.at(contractAddress)
}

/**
 * Load the generic-web bootloader contract
 */
export async function loadGenericWebContract(tezos: TezosToolkit): Promise<WalletContract> {
  const contractAddress = getGenericWebContractAddress()
  if (!contractAddress) {
    throw new Error('Generic-web contract not configured for this network')
  }
  return await tezos.wallet.at(contractAddress)
}

/**
 * Create a new generator on-chain
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param name - Generator name
 * @param code - Generator code (will be URL-encoded)
 * @param bootloaderId - Bootloader type ID (0 = svg-js, 1 = generic-web)
 * @param reservedEditions - Number of editions to reserve (default 0)
 * @param description - Optional description
 */
export async function createGenerator(
  tezos: TezosToolkit,
  name: string,
  code: string,
  bootloaderId: number = 0,
  reservedEditions: number = 0,
  description: string = ''
): Promise<CreateGeneratorResult> {
  try {
    const contract = await loadContract(tezos)
    const userAddress = await tezos.wallet.pkh()

    // URL encode the code before converting to bytes (matches old frontend behavior)
    const encodedCode = encodeURIComponent(code)

    const operation = await contract.methodsObject
      .create_generator({
        name: stringToBytes(name),
        description: stringToBytes(description),
        code: stringToBytes(encodedCode),
        author_bytes: stringToBytes(userAddress),
        reserved_editions: reservedEditions,
        bootloader_id: bootloaderId,
      })
      .send()

    await operation.confirmation()
    const operationResults = await operation.operationResults()

    // Extract generator ID from operation results
    // The ID is in the lazy_storage_diff of the generators bigmap
    let generatorId: string | undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = operationResults?.[0] as any
      generatorId = result?.metadata?.operation_result?.lazy_storage_diff?.[6]?.diff?.updates?.[0]?.key?.int
    } catch {
      console.warn('Could not extract generator ID from operation results')
    }

    return {
      success: true,
      hash: operation.opHash,
      generatorId,
    }
  } catch (error) {
    console.error('Failed to create generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update an existing generator
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param generatorId - ID of the generator to update
 * @param name - New generator name
 * @param code - New generator code (will be URL-encoded)
 * @param reservedEditions - Number of editions to reserve
 * @param description - Optional description
 */
export async function updateGenerator(
  tezos: TezosToolkit,
  generatorId: string | number,
  name: string,
  code: string,
  reservedEditions: number = 0,
  description: string = ''
): Promise<UpdateGeneratorResult> {
  try {
    const contract = await loadContract(tezos)
    const userAddress = await tezos.wallet.pkh()

    // URL encode the code before converting to bytes
    const encodedCode = encodeURIComponent(code)

    const operation = await contract.methodsObject
      .update_generator({
        generator_id: Number(generatorId),
        name: stringToBytes(name),
        description: stringToBytes(description),
        code: stringToBytes(encodedCode),
        author_bytes: stringToBytes(userAddress),
        reserved_editions: reservedEditions,
      })
      .send()

    await operation.confirmation()

    return {
      success: true,
      hash: operation.opHash,
    }
  } catch (error) {
    console.error('Failed to update generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Configure or update sale parameters for a generator
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param generatorId - ID of the generator
 * @param price - Price in mutez (1 XTZ = 1,000,000 mutez)
 * @param editions - Maximum number of editions (0 for unlimited)
 * @param paused - Whether the sale is paused
 * @param startTime - Optional start time (ISO string or null for immediate)
 * @param maxPerWallet - Optional max mints per wallet (null for no limit)
 */
export async function setSale(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number,
  editions: number,
  paused: boolean = false,
  startTime: string | null = null,
  maxPerWallet: number | null = null
): Promise<SetSaleResult> {
  try {
    const contract = await loadContract(tezos)

    const operation = await contract.methodsObject
      .set_sale({
        generator_id: Number(generatorId),
        start_time: startTime,
        price: price,
        paused: paused,
        editions: editions,
        max_per_wallet: maxPerWallet,
      })
      .send()

    await operation.confirmation()

    return {
      success: true,
      hash: operation.opHash,
    }
  } catch (error) {
    console.error('Failed to set sale:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete a generator (only works if no tokens have been minted)
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param generatorId - ID of the generator to delete
 */
export async function deleteGenerator(
  tezos: TezosToolkit,
  generatorId: string | number
): Promise<DeleteGeneratorResult> {
  try {
    const contract = await loadContract(tezos)

    const operation = await contract.methodsObject
      .delete_generator(Number(generatorId))
      .send()

    await operation.confirmation()

    return {
      success: true,
      hash: operation.opHash,
    }
  } catch (error) {
    console.error('Failed to delete generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Mint a token from a generator
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param generatorId - ID of the generator to mint from
 * @param price - Price in mutez to send with the transaction
 */
export async function mint(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number
): Promise<MintResult> {
  try {
    const contract = await loadContract(tezos)

    // Generate random entropy (16 bytes)
    const entropy = generateEntropy()

    const operation = await contract.methodsObject
      .mint({
        generator_id: Number(generatorId),
        entropy: entropy,
      })
      .send({ amount: price, mutez: true })

    await operation.confirmation()
    const operationResults = await operation.operationResults()

    // Extract token ID and artifactUri from operation results
    let tokenId: string | undefined
    let artifactUri: string | undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = operationResults?.[0] as any
      tokenId = result?.metadata?.operation_result?.lazy_storage_diff?.[0]?.diff?.updates?.[0]?.key?.int

      // Extract artifactUri from internal operation results (the on-chain generated SVG data URI)
      const artifactUriHex = result?.metadata?.internal_operation_results?.[3]?.result?.lazy_storage_diff?.[0]?.diff?.updates?.[0]?.value?.args?.[1]?.[0]?.args?.[1]
      if (artifactUriHex) {
        const hexValue = artifactUriHex.bytes || artifactUriHex
        artifactUri = bytesToString(hexValue)
      }
    } catch {
      console.warn('Could not extract token ID or artifactUri from operation results')
    }

    return {
      success: true,
      hash: operation.opHash,
      tokenId,
      entropy,
      artifactUri,
    }
  } catch (error) {
    console.error('Failed to mint token:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Regenerate a token with the latest generator version
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param tokenId - ID of the token to regenerate
 */
export async function regenerateToken(
  tezos: TezosToolkit,
  tokenId: string | number
): Promise<RegenerateTokenResult> {
  try {
    const contract = await loadContract(tezos)

    const operation = await contract.methodsObject
      .regenerate_token(Number(tokenId))
      .send()

    await operation.confirmation()

    return {
      success: true,
      hash: operation.opHash,
    }
  } catch (error) {
    console.error('Failed to regenerate token:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// Generic-Web Bootloader Functions
// ============================================================================

/**
 * Create a new generic-web generator on-chain
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param name - Generator name
 * @param artifactCid - IPFS CID of the project archive
 * @param metadataCid - IPFS CID of the metadata JSON (contains descriptions)
 * @param reservedEditions - Number of editions to reserve for the artist (default 0)
 * @param allowBlMetadataUpdate - Whether bootloader can update metadata (default true)
 */
export async function createGenericWebGenerator(
  tezos: TezosToolkit,
  name: string,
  artifactCid: string,
  metadataCid: string = '',
  reservedEditions: number = 0,
  allowBlMetadataUpdate: boolean = true
): Promise<CreateGeneratorResult> {
  try {
    const contract = await loadGenericWebContract(tezos)

    const rngContract = getRngContractAddress()
    if (!rngContract) {
      throw new Error('RNG contract not configured for this network')
    }

    // Ensure CIDs have ipfs:// prefix
    const fullArtifactCid = artifactCid.startsWith('ipfs://') ? artifactCid : `ipfs://${artifactCid}`
    const fullMetadataCid = metadataCid
      ? (metadataCid.startsWith('ipfs://') ? metadataCid : `ipfs://${metadataCid}`)
      : ''

    const operation = await contract.methodsObject
      .create_generator({
        name: stringToBytes(name),
        artifact_cid: stringToBytes(fullArtifactCid),
        metadata_cid: stringToBytes(fullMetadataCid),
        rng_contract: rngContract,
        reserved_editions: reservedEditions,
        allow_bl_metadata_update: allowBlMetadataUpdate,
      })
      .send()

    await operation.confirmation()
    const operationResults = await operation.operationResults()

    // Extract generator ID from operation results
    let generatorId: string | undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = operationResults?.[0] as any
      // Try to find the generator ID in lazy_storage_diff
      const diffs = result?.metadata?.operation_result?.lazy_storage_diff || []
      for (const diff of diffs) {
        if (diff?.diff?.updates?.[0]?.key?.int) {
          generatorId = diff.diff.updates[0].key.int
          break
        }
      }
    } catch {
      console.warn('Could not extract generator ID from operation results')
    }

    return {
      success: true,
      hash: operation.opHash,
      generatorId,
    }
  } catch (error) {
    console.error('Failed to create generic-web generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update an existing generic-web generator
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param generatorId - ID of the generator to update
 * @param name - New generator name
 * @param artifactCid - New IPFS CID for the project archive
 * @param metadataCid - New IPFS CID for the metadata JSON
 * @param reservedEditions - Number of editions to reserve
 * @param allowBlMetadataUpdate - Whether bootloader can update metadata
 */
export async function updateGenericWebGenerator(
  tezos: TezosToolkit,
  generatorId: string | number,
  name: string,
  artifactCid: string,
  metadataCid: string = '',
  reservedEditions: number = 0,
  allowBlMetadataUpdate: boolean = true
): Promise<UpdateGeneratorResult> {
  try {
    const contract = await loadGenericWebContract(tezos)

    const rngContract = getRngContractAddress()
    if (!rngContract) {
      throw new Error('RNG contract not configured for this network')
    }

    // Ensure CIDs have ipfs:// prefix
    const fullArtifactCid = artifactCid.startsWith('ipfs://') ? artifactCid : `ipfs://${artifactCid}`
    const fullMetadataCid = metadataCid
      ? (metadataCid.startsWith('ipfs://') ? metadataCid : `ipfs://${metadataCid}`)
      : ''

    const operation = await contract.methodsObject
      .update_generator({
        generator_id: Number(generatorId),
        name: stringToBytes(name),
        artifact_cid: stringToBytes(fullArtifactCid),
        metadata_cid: stringToBytes(fullMetadataCid),
        rng_contract: rngContract,
        reserved_editions: reservedEditions,
        allow_bl_metadata_update: allowBlMetadataUpdate,
      })
      .send()

    await operation.confirmation()

    return {
      success: true,
      hash: operation.opHash,
    }
  } catch (error) {
    console.error('Failed to update generic-web generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Configure sale for a generic-web generator
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param generatorId - ID of the generator
 * @param price - Price in mutez (1 XTZ = 1,000,000 mutez)
 * @param editions - Maximum number of editions (0 for unlimited)
 * @param paused - Whether the sale is paused
 * @param startTime - Optional start time (ISO string or null for immediate)
 * @param maxPerWallet - Optional max mints per wallet (null for no limit)
 */
export async function setGenericWebSale(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number,
  editions: number,
  paused: boolean = false,
  startTime: string | null = null,
  maxPerWallet: number | null = null
): Promise<SetSaleResult> {
  try {
    const contract = await loadGenericWebContract(tezos)

    const operation = await contract.methodsObject
      .set_sale({
        generator_id: Number(generatorId),
        start_time: startTime,
        price: price,
        paused: paused,
        editions: editions,
        max_per_wallet: maxPerWallet,
      })
      .send()

    await operation.confirmation()

    return {
      success: true,
      hash: operation.opHash,
    }
  } catch (error) {
    console.error('Failed to set generic-web sale:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Mint a token from a generic-web generator
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param generatorId - ID of the generator to mint from
 * @param price - Price in mutez to send with the transaction
 * @param params - Optional parameters to pass to the generator
 */
export async function mintGenericWeb(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number,
  params: string = ''
): Promise<MintResult> {
  try {
    const contract = await loadGenericWebContract(tezos)

    // Generate random entropy (16 bytes)
    const entropy = generateEntropy()

    const operation = await contract.methodsObject
      .mint({
        generator_id: Number(generatorId),
        entropy: entropy,
        params: stringToBytes(params),
      })
      .send({ amount: price, mutez: true })

    await operation.confirmation()
    const operationResults = await operation.operationResults()

    // Extract token ID and seed from operation results
    let tokenId: string | undefined
    let seed: string | undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = operationResults?.[0] as any
      const diffs = result?.metadata?.operation_result?.lazy_storage_diff || []
      for (const diff of diffs) {
        if (diff?.diff?.updates?.[0]?.key?.int) {
          tokenId = diff.diff.updates[0].key.int
          break
        }
      }

      // Try to extract the raw_seed from token_extra bigmap update
      // The seed is stored as raw_seed in the token_extra bigmap
      for (const diff of diffs) {
        const rawSeed = diff?.diff?.updates?.[0]?.value?.raw_seed
        if (rawSeed) {
          // raw_seed may be stored as hex string, decode if needed
          seed = rawSeed.startsWith('0x') ? rawSeed.slice(2) : rawSeed
          break
        }
      }
    } catch {
      console.warn('Could not extract token ID or seed from operation results')
    }

    return {
      success: true,
      hash: operation.opHash,
      tokenId,
      entropy,
      seed,
    }
  } catch (error) {
    console.error('Failed to mint generic-web token:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete a generic-web generator (only works if no tokens have been minted)
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param generatorId - ID of the generator to delete
 */
export async function deleteGenericWebGenerator(
  tezos: TezosToolkit,
  generatorId: string | number
): Promise<DeleteGeneratorResult> {
  try {
    const contract = await loadGenericWebContract(tezos)

    const operation = await contract.methodsObject
      .delete_generator(Number(generatorId))
      .send()

    await operation.confirmation()

    return {
      success: true,
      hash: operation.opHash,
    }
  } catch (error) {
    console.error('Failed to delete generic-web generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Regenerate a generic-web token with the latest generator version
 *
 * @param tezos - TezosToolkit instance with wallet provider set
 * @param tokenId - ID of the token to regenerate
 */
export async function regenerateGenericWebToken(
  tezos: TezosToolkit,
  tokenId: string | number
): Promise<RegenerateTokenResult> {
  try {
    const contract = await loadGenericWebContract(tezos)

    const operation = await contract.methodsObject
      .regenerate_token(Number(tokenId))
      .send()

    await operation.confirmation()

    return {
      success: true,
      hash: operation.opHash,
    }
  } catch (error) {
    console.error('Failed to regenerate generic-web token:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
