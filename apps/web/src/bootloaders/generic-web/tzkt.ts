import type { Generator, Token } from '@/types/generator'
import type { BootloaderId } from '@/types/bootloader'
import { stripIpfsPrefix, hexToString } from '@/lib/chain-codec'
import { parseGenericWebArtifactUri } from './artifact-uri'
import type { TzktClient } from '@/services/tzkt-client'
import { SHARED_BOOTLOADER_CATALOG } from '../../../../../shared/bootloaders/catalog'

interface GenericWebGeneratorBigMapValue {
  name: string
  author: string
  artifact_uri: string
  bootloader_spec_id: string
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

interface GenericWebTokenExtraBigMapValue {
  generator_id: string
  generator_version: string
  raw_seed: string | null
  params: string
  iteration_number: string
}

function readGenericWebArtifactUri(
  tokenInfo: Record<string, string>
): string | undefined {
  if (tokenInfo.artifactUri) {
    return hexToString(tokenInfo.artifactUri)
  }

  // During the pre-finalization placeholder state the contract emits `_artifactUri`.
  if (tokenInfo._artifactUri) {
    return hexToString(tokenInfo._artifactUri)
  }

  return undefined
}

function mapWebProjectBootloaderId(specHex: string): BootloaderId | null {
  const spec = hexToString(specHex)
  const match = Object.values(SHARED_BOOTLOADER_CATALOG).find(
    (entry) => entry.spec === spec
  )
  return (match?.id as BootloaderId | undefined) || null
}

function mapGenericWebGenerator(
  keyData: { key: string; value: GenericWebGeneratorBigMapValue; firstLevel?: number },
  includeLevels = true
): Generator | null {
  const gen = keyData.value
  const bootloaderId = mapWebProjectBootloaderId(gen.bootloader_spec_id)
  if (!bootloaderId) {
    return null
  }
  const flag = parseInt(gen.flag || '0')
  const sale = gen.sale
  const supply = parseInt(gen.n_tokens || '0')
  const maxSupply = sale ? parseInt(sale.editions || '0') : 0
  const notPaused = sale ? !sale.paused : false
  const notSoldOut = maxSupply === 0 || supply < maxSupply
  const startTimePassed = !sale?.start_time || new Date(sale.start_time) <= new Date()
  const mintingOpen = sale !== null && notPaused && notSoldOut && startTimePassed
  const artifactUriBase = hexToString(gen.artifact_uri)

  return {
    id: keyData.key,
    name: hexToString(gen.name),
    creator: gen.author,
    bootloaderId,
    cid: stripIpfsPrefix(artifactUriBase),
    createdAt: '',
    updatedAt: '',
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

export async function getGenericWebGenerators(
  client: TzktClient,
  contractAddress: string
): Promise<Generator[]> {
  const generatorsBigMap = await client.getBigMapByPath('generators', contractAddress)
  if (!generatorsBigMap) {
    console.warn('Generic-web generators bigmap not found')
    return []
  }

  const keys = await client.getBigMapKeys<GenericWebGeneratorBigMapValue>(generatorsBigMap.ptr, {
    limit: 1000,
    sortDesc: 'firstLevel',
  })

  return keys
    .map((keyData) => mapGenericWebGenerator(keyData))
    .filter((generator): generator is Generator => Boolean(generator))
}

export async function getGenericWebGenerator(
  client: TzktClient,
  contractAddress: string,
  generatorId: string,
  bootloaderId?: BootloaderId
): Promise<Generator | null> {
  const generatorsBigMap = await client.getBigMapByPath('generators', contractAddress)
  if (!generatorsBigMap) {
    return null
  }

  const keyData = await client.getBigMapKey<GenericWebGeneratorBigMapValue>(
    generatorsBigMap.ptr,
    generatorId
  )
  if (!keyData) {
    return null
  }

  const generator = mapGenericWebGenerator(keyData, false)
  if (!generator) {
    return null
  }
  if (bootloaderId && generator.bootloaderId !== bootloaderId) {
    return null
  }
  return generator
}

export async function getGenericWebGeneratorMints(
  client: TzktClient,
  contractAddress: string,
  generatorId: string,
  limit = 10,
  generator?: Generator
): Promise<Token[]> {
  const tokenExtraBigMap = await client.getBigMapByPath('token_extra', contractAddress)
  if (!tokenExtraBigMap) {
    console.warn('Generic-web token extra bigmap not found')
    return []
  }

  const url = `${client.baseUrl}/v1/bigmaps/${tokenExtraBigMap.ptr}/keys?value.generator_id=${generatorId}&active=true&limit=${limit}&sort.desc=id`
  const generatorTokens = await client.fetchJson<Array<{ key: string; value: GenericWebTokenExtraBigMapValue }>>(url)
  if (generatorTokens.length === 0) {
    return []
  }

  const ledgerBigMap = await client.getBigMapByPath('ledger', contractAddress)
  if (!ledgerBigMap) {
    console.warn('Generic-web ledger bigmap not found')
    return []
  }

  const generatorData = generator || await getGenericWebGenerator(client, contractAddress, generatorId)
  const tokens: Token[] = []
  for (const tokenData of generatorTokens) {
    const tokenId = tokenData.key
    const extra = tokenData.value
    const ownerData = await client.getBigMapKey<string>(ledgerBigMap.ptr, tokenId)
    const owner = ownerData?.value || ''

    tokens.push({
      id: tokenId,
      generatorId,
      bootloaderId: generatorData?.bootloaderId || 'generic-web',
      owner,
      seed: extra.raw_seed || '',
      iteration: parseInt(extra.iteration_number || '0'),
      version: parseInt(extra.generator_version || '1'),
      generator: generatorData || undefined,
    })
  }

  return tokens
}

export async function getGenericWebToken(
  client: TzktClient,
  contractAddress: string,
  tokenId: string,
  bootloaderId?: BootloaderId
): Promise<Token | null> {
  const tokenExtraBigMap = await client.getBigMapByPath('token_extra', contractAddress)
  if (!tokenExtraBigMap) {
    return null
  }

  const extraData = await client.getBigMapKey<GenericWebTokenExtraBigMapValue>(
    tokenExtraBigMap.ptr,
    tokenId
  )
  if (!extraData) {
    return null
  }

  const extra = {
    generatorId: extraData.value.generator_id,
    generatorVersion: parseInt(extraData.value.generator_version),
    seed: extraData.value.raw_seed || '',
    iteration: parseInt(extraData.value.iteration_number || '0'),
  }

  const generator = await getGenericWebGenerator(client, contractAddress, extra.generatorId)
  if (!generator) {
    return null
  }

  if (bootloaderId && generator.bootloaderId !== bootloaderId) {
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
  let artifactCid: string | undefined
  let params: Record<string, unknown> | undefined
  if (tokenMetadataBigMap) {
    const metaData = await client.getBigMapKey<{ token_id: string; token_info: Record<string, string> }>(
      tokenMetadataBigMap.ptr,
      tokenId
    )
    const tokenInfo = metaData?.value.token_info || {}
    artifactUri = readGenericWebArtifactUri(tokenInfo)
    if (artifactUri) {
      const parsedArtifact = artifactUri ? parseGenericWebArtifactUri(artifactUri) : null
      artifactCid = parsedArtifact?.cid
      params = parsedArtifact?.params
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
    artifactCid,
    params,
  }
}
