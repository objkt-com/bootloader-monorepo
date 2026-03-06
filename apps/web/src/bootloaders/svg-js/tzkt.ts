import type { Generator, Token } from '@/types/generator'
import type { BootloaderId } from '@/types/bootloader'
import { decodeUrlEncodedHex, hexToString } from '@/lib/chain-codec'
import type { TzktClient } from '@/services/tzkt-client'

interface SvgJsGeneratorBigMapValue {
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

interface SvgJsTokenExtraBigMapValue {
  generator_id: string
  generator_version: string
  seed: string
  iteration_number: string
}

function mapBootloaderId(typeId: number): BootloaderId {
  switch (typeId) {
    case 0:
      return 'svg-js'
    case 1:
      return 'generic-web'
    default:
      return 'svg-js'
  }
}

function mapSvgJsGenerator(
  keyData: { key: string; value: SvgJsGeneratorBigMapValue; firstLevel?: number },
  includeLevels = true
): Generator {
  const gen = keyData.value
  const typeId = parseInt(gen.type_id || '0')
  const bootloaderId = mapBootloaderId(typeId)
  const flag = parseInt(gen.flag || '0')
  const sale = gen.sale
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
    price: sale ? parseInt(sale.price || '0') : undefined,
    mintingOpen,
    saleStartTime: sale?.start_time,
    flagged: flag > 0,
    flagReason: flag > 0 ? flag : undefined,
    firstLevel: includeLevels ? keyData.firstLevel : undefined,
  }
}

export async function getSvgJsGenerators(
  client: TzktClient,
  contractAddress: string
): Promise<Generator[]> {
  const generatorsBigMap = await client.getBigMapByPath('generators', contractAddress)
  if (!generatorsBigMap) {
    console.warn('Generators bigmap not found')
    return []
  }

  const keys = await client.getBigMapKeys<SvgJsGeneratorBigMapValue>(generatorsBigMap.ptr, {
    limit: 1000,
    sortDesc: 'firstLevel',
  })

  return keys.map((keyData) => mapSvgJsGenerator(keyData))
}

export async function getSvgJsGenerator(
  client: TzktClient,
  contractAddress: string,
  generatorId: string
): Promise<Generator | null> {
  const generatorsBigMap = await client.getBigMapByPath('generators', contractAddress)
  if (!generatorsBigMap) {
    throw new Error('Generators bigmap not found')
  }

  const keyData = await client.getBigMapKey<SvgJsGeneratorBigMapValue>(
    generatorsBigMap.ptr,
    generatorId
  )
  if (!keyData) {
    return null
  }

  return mapSvgJsGenerator(keyData, false)
}

export async function getSvgJsGeneratorMints(
  client: TzktClient,
  contractAddress: string,
  generatorId: string,
  limit = 10,
  generator?: Generator
): Promise<Token[]> {
  const tokenExtraBigMap = await client.getBigMapByPath('token_extra', contractAddress)
  if (!tokenExtraBigMap) {
    console.warn('Token extra bigmap not found')
    return []
  }

  const url = `${client.baseUrl}/v1/bigmaps/${tokenExtraBigMap.ptr}/keys?value.generator_id=${generatorId}&active=true&limit=${limit}&sort.desc=id`
  const generatorTokens = await client.fetchJson<Array<{ key: string; value: SvgJsTokenExtraBigMapValue }>>(url)

  if (generatorTokens.length === 0) {
    return []
  }

  const ledgerBigMap = await client.getBigMapByPath('ledger', contractAddress)
  if (!ledgerBigMap) {
    console.warn('Ledger bigmap not found')
    return []
  }

  const generatorData = generator || await getSvgJsGenerator(client, contractAddress, generatorId)

  const tokens: Token[] = []
  for (const tokenData of generatorTokens) {
    const tokenId = tokenData.key
    const extra = tokenData.value
    const ownerData = await client.getBigMapKey<string>(ledgerBigMap.ptr, tokenId)
    const owner = ownerData?.value || ''

    tokens.push({
      id: tokenId,
      generatorId,
      bootloaderId: 'svg-js',
      owner,
      seed: extra.seed,
      iteration: parseInt(extra.iteration_number || '0'),
      version: parseInt(extra.generator_version || '1'),
      generator: generatorData || undefined,
    })
  }

  return tokens
}

export async function getSvgJsToken(
  client: TzktClient,
  contractAddress: string,
  tokenId: string
): Promise<Token | null> {
  const tokenExtraBigMap = await client.getBigMapByPath('token_extra', contractAddress)
  if (!tokenExtraBigMap) {
    return null
  }

  const keyData = await client.getBigMapKey<SvgJsTokenExtraBigMapValue>(
    tokenExtraBigMap.ptr,
    tokenId
  )
  if (!keyData) {
    return null
  }

  const extra = {
    generatorId: keyData.value.generator_id,
    generatorVersion: parseInt(keyData.value.generator_version),
    seed: keyData.value.seed,
    iteration: parseInt(keyData.value.iteration_number || '0'),
  }

  const generator = await getSvgJsGenerator(client, contractAddress, extra.generatorId)
  if (!generator) {
    return null
  }

  const ledgerBigMap = await client.getBigMapByPath('ledger', contractAddress)
  let owner = ''
  if (ledgerBigMap) {
    const ownerData = await client.getBigMapKey<string>(ledgerBigMap.ptr, tokenId)
    owner = ownerData?.value || ''
  }

  const tokenMetadataBigMap = await client.getBigMapByPath('token_metadata', contractAddress)
  let artifactUri: string | undefined
  let code: string | undefined
  if (tokenMetadataBigMap) {
    const metaData = await client.getBigMapKey<{ token_id: string; token_info: Record<string, string> }>(
      tokenMetadataBigMap.ptr,
      tokenId
    )
    if (metaData?.value.token_info.artifactUri) {
      artifactUri = hexToString(metaData.value.token_info.artifactUri)
      code = artifactUri
    }
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
    artifactUri,
    code,
  }
}

export async function getSvgJsFragments(
  client: TzktClient,
  contractAddress: string
): Promise<string[]> {
  const fragsBigMap = await client.getBigMapByPath('frags', contractAddress)
  if (!fragsBigMap) {
    console.warn('Fragments bigmap not found')
    return []
  }

  const keys = await client.getBigMapKeys<string>(fragsBigMap.ptr, { limit: 10 })
  const fragments: string[] = []
  keys.forEach((keyData) => {
    const index = parseInt(keyData.key)
    fragments[index] = hexToString(keyData.value)
  })
  return fragments
}
