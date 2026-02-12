import { getNetworkConfig, getContractAddress, getGenericWebContractAddress } from '@/config'
import type { Generator, Token } from '@/types/generator'
import type { BootloaderId } from '@/types/bootloader'

// Utility functions
function hexToString(hex: string): string {
  if (!hex) return ''
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) return hex

  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

function decodeUrlEncodedHex(hex: string): string {
  const str = hexToString(hex)
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

// Strip ipfs:// prefix from CID if present
function stripIpfsPrefix(cid: string): string {
  if (cid.startsWith('ipfs://')) {
    return cid.slice(7)
  }
  return cid
}

// Map on-chain type_id to our bootloader IDs
function mapBootloaderId(typeId: number): BootloaderId {
  // Type 0 = svg-js (the original on-chain SVG bootloader)
  // Future types can be mapped here
  switch (typeId) {
    case 0:
      return 'svg-js'
    case 1:
      return 'generic-web'
    default:
      return 'svg-js'
  }
}

interface GeneratorBigMapValue {
  name: string
  description: string
  author: string
  code: string
  created: string
  last_update: string
  n_tokens: string
  sale: {
    editions: string
    paused: boolean
    price: string
    start_time?: string
    max_per_wallet?: string | null
  } | null
  version: string
  type_id: string
  flag: string
}

interface TokenExtraBigMapValue {
  generator_id: string
  generator_version: string
  seed: string
  iteration_number: string
}

// Generic-web token extra uses raw_seed instead of seed
interface GenericWebTokenExtraBigMapValue {
  generator_id: string
  generator_version: string
  raw_seed: string | null
  params: string
  iteration_number: string
}

// Generic-web bigmap value structure (different from svg-js)
interface GenericWebGeneratorBigMapValue {
  name: string
  description: string
  author: string
  artifact_cid: string
  n_tokens: string
  sale: {
    editions: string
    paused: boolean
    price: string
    start_time?: string
    max_per_wallet?: string | null
  } | null
  version: string
  flag: string
  rng_contract: string
}

class TzKTService {
  private baseUrl: string
  private contractAddress: string
  private genericWebContractAddress: string

  constructor() {
    const config = getNetworkConfig()
    this.baseUrl = config.tzktApi
    this.contractAddress = getContractAddress()
    this.genericWebContractAddress = getGenericWebContractAddress()
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }

  private async getBigMapByPath(path: string, contractAddress?: string): Promise<{ ptr: number } | null> {
    const contract = contractAddress || this.contractAddress
    const url = `${this.baseUrl}/v1/bigmaps?contract=${contract}&path=${path}&active=true`
    const bigmaps = await this.fetchJson<Array<{ ptr: number }>>(url)
    return bigmaps.length > 0 ? bigmaps[0] : null
  }

  private async getBigMapKeys<T>(
    bigmapId: number,
    options: {
      limit?: number
      offset?: number
      sortDesc?: string  // Field to sort by descending (e.g., 'firstLevel')
      sortAsc?: string   // Field to sort by ascending
      select?: string
    } = {}
  ): Promise<Array<{ key: string; value: T; firstLevel?: number; lastLevel?: number }>> {
    const params = new URLSearchParams()
    params.append('active', 'true')
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.offset) params.append('offset', options.offset.toString())
    if (options.sortDesc) params.append('sort.desc', options.sortDesc)
    if (options.sortAsc) params.append('sort.asc', options.sortAsc)
    if (options.select) params.append('select', options.select)

    const url = `${this.baseUrl}/v1/bigmaps/${bigmapId}/keys?${params.toString()}`
    return this.fetchJson(url)
  }

  private async getBigMapKey<T>(
    bigmapId: number,
    key: string
  ): Promise<{ key: string; value: T } | null> {
    const url = `${this.baseUrl}/v1/bigmaps/${bigmapId}/keys/${encodeURIComponent(key)}`
    try {
      return await this.fetchJson(url)
    } catch {
      return null
    }
  }

  async getGenerators(): Promise<Generator[]> {
    const generatorsBigMap = await this.getBigMapByPath('generators')
    if (!generatorsBigMap) {
      console.warn('Generators bigmap not found')
      return []
    }

    // Fetch with firstLevel for proper cross-contract sorting
    const keys = await this.getBigMapKeys<GeneratorBigMapValue>(generatorsBigMap.ptr, {
      limit: 1000,
      sortDesc: 'firstLevel',
    })

    const generators: Generator[] = keys.map((keyData) => {
      const gen = keyData.value
      const typeId = parseInt(gen.type_id || '0')
      const bootloaderId = mapBootloaderId(typeId)
      const flag = parseInt(gen.flag || '0')
      const sale = gen.sale

      // Minting is open if: sale exists AND not paused AND not sold out AND (no start time OR start time has passed)
      const supply = parseInt(gen.n_tokens || '0')
      const maxSupply = sale ? parseInt(sale.editions || '0') : 0
      const notPaused = sale ? !sale.paused : false
      const notSoldOut = maxSupply === 0 || supply < maxSupply
      const startTimePassed = !sale?.start_time || new Date(sale.start_time) <= new Date()
      const mintingOpen = sale !== null && notPaused && notSoldOut && startTimePassed

      return {
        id: keyData.key,
        name: hexToString(gen.name),
        description: hexToString(gen.description),
        creator: gen.author,
        bootloaderId,
        code: bootloaderId === 'svg-js' ? decodeUrlEncodedHex(gen.code) : undefined,
        cid: bootloaderId === 'generic-web' ? hexToString(gen.code) : undefined,
        createdAt: gen.created,
        updatedAt: gen.last_update,
        version: parseInt(gen.version || '1'),
        supply,
        maxSupply,
        price: sale ? parseInt(sale.price || '0') : 0,
        mintingOpen,
        saleStartTime: sale?.start_time,
        flagged: flag > 0,
        flagReason: flag > 0 ? flag : undefined,
        firstLevel: keyData.firstLevel,
      }
    })

    return generators
  }

  /**
   * Get all generators from the generic-web contract
   */
  async getGenericWebGenerators(): Promise<Generator[]> {
    if (!this.genericWebContractAddress) {
      return []
    }

    const generatorsBigMap = await this.getBigMapByPath('generators', this.genericWebContractAddress)
    if (!generatorsBigMap) {
      console.warn('Generic-web generators bigmap not found')
      return []
    }

    // Fetch with firstLevel for proper cross-contract sorting
    const keys = await this.getBigMapKeys<GenericWebGeneratorBigMapValue>(generatorsBigMap.ptr, {
      limit: 1000,
      sortDesc: 'firstLevel',
    })

    const generators: Generator[] = keys.map((keyData) => {
      const gen = keyData.value
      const flag = parseInt(gen.flag || '0')
      const sale = gen.sale

      // Minting is open if: sale exists AND not paused AND not sold out AND (no start time OR start time has passed)
      const supply = parseInt(gen.n_tokens || '0')
      const maxSupply = sale ? parseInt(sale.editions || '0') : 0
      const notPaused = sale ? !sale.paused : false
      const notSoldOut = maxSupply === 0 || supply < maxSupply
      const startTimePassed = !sale?.start_time || new Date(sale.start_time) <= new Date()
      const mintingOpen = sale !== null && notPaused && notSoldOut && startTimePassed

      return {
        id: keyData.key,
        name: hexToString(gen.name),
        description: hexToString(gen.description),
        creator: gen.author,
        bootloaderId: 'generic-web' as BootloaderId,
        cid: stripIpfsPrefix(hexToString(gen.artifact_cid)),
        createdAt: '', // generic-web contract may not have created field
        updatedAt: '',
        version: parseInt(gen.version || '1'),
        supply,
        maxSupply,
        price: sale ? parseInt(sale.price || '0') : 0,
        mintingOpen,
        saleStartTime: sale?.start_time,
        flagged: flag > 0,
        flagReason: flag > 0 ? flag : undefined,
        firstLevel: keyData.firstLevel,
      }
    })

    return generators
  }

  /**
   * Get all generators from both contracts
   */
  async getAllGenerators(): Promise<Generator[]> {
    const [svgJsGenerators, genericWebGenerators] = await Promise.all([
      this.getGenerators(),
      this.getGenericWebGenerators(),
    ])

    // Combine and sort by firstLevel (block level) descending - newest first
    // This properly interleaves generators from both contracts by creation time
    const allGenerators = [...svgJsGenerators, ...genericWebGenerators]
    allGenerators.sort((a, b) => (b.firstLevel ?? 0) - (a.firstLevel ?? 0))

    return allGenerators
  }

  async getGenerator(generatorId: string): Promise<Generator | null> {
    const generatorsBigMap = await this.getBigMapByPath('generators')
    if (!generatorsBigMap) {
      throw new Error('Generators bigmap not found')
    }

    const keyData = await this.getBigMapKey<GeneratorBigMapValue>(
      generatorsBigMap.ptr,
      generatorId
    )
    if (!keyData) {
      return null
    }

    const gen = keyData.value
    const typeId = parseInt(gen.type_id || '0')
    const bootloaderId = mapBootloaderId(typeId)
    const flag = parseInt(gen.flag || '0')
    const sale = gen.sale

    // Minting is open if: sale exists AND not paused AND not sold out AND (no start time OR start time has passed)
    const supply = parseInt(gen.n_tokens || '0')
    const maxSupply = sale ? parseInt(sale.editions || '0') : 0
    const notPaused = sale ? !sale.paused : false
    const notSoldOut = maxSupply === 0 || supply < maxSupply
    const startTimePassed = !sale?.start_time || new Date(sale.start_time) <= new Date()
    const mintingOpen = sale !== null && notPaused && notSoldOut && startTimePassed

    return {
      id: keyData.key,
      name: hexToString(gen.name),
      description: hexToString(gen.description),
      creator: gen.author,
      bootloaderId,
      code: bootloaderId === 'svg-js' ? decodeUrlEncodedHex(gen.code) : undefined,
      cid: bootloaderId === 'generic-web' ? hexToString(gen.code) : undefined,
      createdAt: gen.created,
      updatedAt: gen.last_update,
      version: parseInt(gen.version || '1'),
      supply,
      maxSupply,
      price: sale ? parseInt(sale.price || '0') : 0,
      mintingOpen,
      saleStartTime: sale?.start_time,
      flagged: flag > 0,
      flagReason: flag > 0 ? flag : undefined,
    }
  }

  /**
   * Get a single generator from the generic-web contract
   */
  async getGenericWebGenerator(generatorId: string): Promise<Generator | null> {
    if (!this.genericWebContractAddress) {
      return null
    }

    const generatorsBigMap = await this.getBigMapByPath('generators', this.genericWebContractAddress)
    if (!generatorsBigMap) {
      return null
    }

    const keyData = await this.getBigMapKey<GenericWebGeneratorBigMapValue>(
      generatorsBigMap.ptr,
      generatorId
    )
    if (!keyData) {
      return null
    }

    const gen = keyData.value
    const flag = parseInt(gen.flag || '0')
    const sale = gen.sale

    // Minting is open if: sale exists AND not paused AND not sold out AND (no start time OR start time has passed)
    const supply = parseInt(gen.n_tokens || '0')
    const maxSupply = sale ? parseInt(sale.editions || '0') : 0
    const notPaused = sale ? !sale.paused : false
    const notSoldOut = maxSupply === 0 || supply < maxSupply
    const startTimePassed = !sale?.start_time || new Date(sale.start_time) <= new Date()
    const mintingOpen = sale !== null && notPaused && notSoldOut && startTimePassed

    return {
      id: keyData.key,
      name: hexToString(gen.name),
      description: hexToString(gen.description),
      creator: gen.author,
      bootloaderId: 'generic-web' as BootloaderId,
      cid: stripIpfsPrefix(hexToString(gen.artifact_cid)),
      createdAt: '',
      updatedAt: '',
      version: parseInt(gen.version || '1'),
      supply,
      maxSupply,
      price: sale ? parseInt(sale.price || '0') : 0,
      mintingOpen,
      saleStartTime: sale?.start_time,
      flagged: flag > 0,
      flagReason: flag > 0 ? flag : undefined,
    }
  }

  async getGeneratorMints(generatorId: string, bootloaderId: BootloaderId, limit = 10, generator?: Generator): Promise<Token[]> {
    // Use appropriate contract based on bootloader
    if (bootloaderId === 'generic-web') {
      return this.getGenericWebGeneratorMints(generatorId, limit, generator)
    }

    const tokenExtraBigMap = await this.getBigMapByPath('token_extra')
    if (!tokenExtraBigMap) {
      console.warn('Token extra bigmap not found')
      return []
    }

    // Use TzKT API filtering to get tokens for this generator
    const url = `${this.baseUrl}/v1/bigmaps/${tokenExtraBigMap.ptr}/keys?value.generator_id=${generatorId}&active=true&limit=${limit}&sort.desc=id`
    const generatorTokens = await this.fetchJson<Array<{ key: string; value: TokenExtraBigMapValue }>>(url)

    if (generatorTokens.length === 0) {
      return []
    }

    // Get ledger bigmap for owner info
    const ledgerBigMap = await this.getBigMapByPath('ledger')
    if (!ledgerBigMap) {
      console.warn('Ledger bigmap not found')
      return []
    }

    // Get the generator info for the token names if not passed
    const generatorData = generator || await this.getGenerator(generatorId)

    const tokens: Token[] = []
    for (const tokenData of generatorTokens) {
      const tokenId = tokenData.key
      const extra = tokenData.value

      // Get owner
      const ownerData = await this.getBigMapKey<string>(ledgerBigMap.ptr, tokenId)
      const owner = ownerData?.value || ''

      tokens.push({
        id: tokenId,
        generatorId,
        bootloaderId,
        owner,
        seed: extra.seed,
        iteration: parseInt(extra.iteration_number || '0'),
        version: parseInt(extra.generator_version || '1'),
        generator: generatorData || undefined,
      })
    }

    return tokens
  }

  /**
   * Get token mints for a generic-web generator
   */
  async getGenericWebGeneratorMints(generatorId: string, limit = 10, generator?: Generator): Promise<Token[]> {
    if (!this.genericWebContractAddress) {
      return []
    }

    const tokenExtraBigMap = await this.getBigMapByPath('token_extra', this.genericWebContractAddress)
    if (!tokenExtraBigMap) {
      console.warn('Generic-web token extra bigmap not found')
      return []
    }

    // Use TzKT API filtering to get tokens for this generator
    const url = `${this.baseUrl}/v1/bigmaps/${tokenExtraBigMap.ptr}/keys?value.generator_id=${generatorId}&active=true&limit=${limit}&sort.desc=id`
    const generatorTokens = await this.fetchJson<Array<{ key: string; value: GenericWebTokenExtraBigMapValue }>>(url)

    if (generatorTokens.length === 0) {
      return []
    }

    // Get ledger bigmap for owner info
    const ledgerBigMap = await this.getBigMapByPath('ledger', this.genericWebContractAddress)
    if (!ledgerBigMap) {
      console.warn('Generic-web ledger bigmap not found')
      return []
    }

    // Get the generator info for the token names if not passed
    const generatorData = generator || await this.getGenericWebGenerator(generatorId)

    const tokens: Token[] = []
    for (const tokenData of generatorTokens) {
      const tokenId = tokenData.key
      const extra = tokenData.value

      // Get owner
      const ownerData = await this.getBigMapKey<string>(ledgerBigMap.ptr, tokenId)
      const owner = ownerData?.value || ''

      tokens.push({
        id: tokenId,
        generatorId,
        bootloaderId: 'generic-web',
        owner,
        seed: extra.raw_seed || '',
        iteration: parseInt(extra.iteration_number || '0'),
        version: parseInt(extra.generator_version || '1'),
        generator: generatorData || undefined,
      })
    }

    return tokens
  }

  async getTokenExtra(tokenId: string): Promise<{
    generatorId: string
    generatorVersion: number
    seed: string
    iteration: number
  } | null> {
    const tokenExtraBigMap = await this.getBigMapByPath('token_extra')
    if (!tokenExtraBigMap) {
      return null
    }

    const keyData = await this.getBigMapKey<TokenExtraBigMapValue>(
      tokenExtraBigMap.ptr,
      tokenId
    )
    if (!keyData) {
      return null
    }

    return {
      generatorId: keyData.value.generator_id,
      generatorVersion: parseInt(keyData.value.generator_version),
      seed: keyData.value.seed,
      iteration: parseInt(keyData.value.iteration_number || '0'),
    }
  }

  async getTokenMetadata(tokenId: string): Promise<{
    artifactUri?: string
    displayUri?: string
    thumbnailUri?: string
  } | null> {
    const tokenMetadataBigMap = await this.getBigMapByPath('token_metadata')
    if (!tokenMetadataBigMap) {
      return null
    }

    const keyData = await this.getBigMapKey<{
      token_id: string
      token_info: Record<string, string>
    }>(tokenMetadataBigMap.ptr, tokenId)
    if (!keyData) {
      return null
    }

    const tokenInfo = keyData.value.token_info
    return {
      artifactUri: tokenInfo.artifactUri ? hexToString(tokenInfo.artifactUri) : undefined,
      displayUri: tokenInfo.displayUri ? hexToString(tokenInfo.displayUri) : undefined,
      thumbnailUri: tokenInfo.thumbnailUri ? hexToString(tokenInfo.thumbnailUri) : undefined,
    }
  }

  async getToken(tokenId: string, bootloaderId?: BootloaderId): Promise<Token | null> {
    // If bootloaderId is specified and it's generic-web, use the generic-web contract
    if (bootloaderId === 'generic-web') {
      return this.getGenericWebToken(tokenId)
    }

    // Try svg-js contract first
    const extra = await this.getTokenExtra(tokenId)
    if (!extra) {
      // If not found in svg-js, try generic-web
      if (!bootloaderId) {
        return this.getGenericWebToken(tokenId)
      }
      return null
    }

    // Get the generator to determine bootloaderId
    const generator = await this.getGenerator(extra.generatorId)
    if (!generator) {
      return null
    }

    // Get owner from ledger
    const ledgerBigMap = await this.getBigMapByPath('ledger')
    let owner = ''
    if (ledgerBigMap) {
      const ownerData = await this.getBigMapKey<string>(ledgerBigMap.ptr, tokenId)
      owner = ownerData?.value || ''
    }

    // Get token metadata for artifactUri (contains the actual SVG for this token)
    const metadata = await this.getTokenMetadata(tokenId)

    // For SVG-JS tokens, extract the code from the artifactUri
    // The artifactUri is a data URL containing the full SVG with embedded code
    let tokenCode: string | undefined
    if (generator.bootloaderId === 'svg-js' && metadata?.artifactUri) {
      tokenCode = metadata.artifactUri
    }

    return {
      id: tokenId,
      generatorId: extra.generatorId,
      bootloaderId: generator.bootloaderId,
      owner,
      seed: extra.seed,
      iteration: extra.iteration,
      version: extra.generatorVersion,
      generator,
      artifactUri: metadata?.artifactUri,
      code: tokenCode,
    }
  }

  /**
   * Get a token from the generic-web contract
   */
  async getGenericWebToken(tokenId: string): Promise<Token | null> {
    if (!this.genericWebContractAddress) {
      return null
    }

    // Get token extra data
    const tokenExtraBigMap = await this.getBigMapByPath('token_extra', this.genericWebContractAddress)
    if (!tokenExtraBigMap) {
      return null
    }

    const extraData = await this.getBigMapKey<GenericWebTokenExtraBigMapValue>(tokenExtraBigMap.ptr, tokenId)
    if (!extraData) {
      return null
    }

    const extra = {
      generatorId: extraData.value.generator_id,
      generatorVersion: parseInt(extraData.value.generator_version),
      seed: extraData.value.raw_seed || '',
      iteration: parseInt(extraData.value.iteration_number || '0'),
    }

    // Get the generator
    const generator = await this.getGenericWebGenerator(extra.generatorId)
    if (!generator) {
      return null
    }

    // Get owner from ledger
    const ledgerBigMap = await this.getBigMapByPath('ledger', this.genericWebContractAddress)
    let owner = ''
    if (ledgerBigMap) {
      const ownerData = await this.getBigMapKey<string>(ledgerBigMap.ptr, tokenId)
      owner = ownerData?.value || ''
    }

    // Get token metadata for artifactUri
    const tokenMetadataBigMap = await this.getBigMapByPath('token_metadata', this.genericWebContractAddress)
    let artifactUri: string | undefined
    let artifactCid: string | undefined
    if (tokenMetadataBigMap) {
      const metaData = await this.getBigMapKey<{ token_id: string; token_info: Record<string, string> }>(
        tokenMetadataBigMap.ptr,
        tokenId
      )
      if (metaData?.value.token_info.artifact_uri) {
        artifactUri = hexToString(metaData.value.token_info.artifact_uri)
        // Extract the CID from the artifact URI (format: ipfs://CID?s=SEED&i=ITERATION&p=PARAMS)
        if (artifactUri.startsWith('ipfs://')) {
          const withoutPrefix = artifactUri.slice(7) // Remove 'ipfs://'
          const cidPart = withoutPrefix.split('?')[0] // Get CID before query params
          artifactCid = cidPart
        }
      }
    }

    return {
      id: tokenId,
      generatorId: extra.generatorId,
      bootloaderId: 'generic-web',
      owner,
      seed: extra.seed,
      iteration: extra.iteration,
      version: extra.generatorVersion,
      generator,
      artifactUri,
      artifactCid,
    }
  }

  async getFragments(): Promise<string[]> {
    const fragsBigMap = await this.getBigMapByPath('frags')
    if (!fragsBigMap) {
      console.warn('Fragments bigmap not found')
      return []
    }

    const keys = await this.getBigMapKeys<string>(fragsBigMap.ptr, { limit: 10 })

    const fragments: string[] = []
    keys.forEach((keyData) => {
      const index = parseInt(keyData.key)
      fragments[index] = hexToString(keyData.value)
    })

    return fragments
  }
}

export const tzktService = new TzKTService()
