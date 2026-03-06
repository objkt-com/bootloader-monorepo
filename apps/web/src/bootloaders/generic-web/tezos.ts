import type { TezosToolkit } from '@taquito/taquito'
import { getRngContractAddress } from '@/config'
import {
  CreateGeneratorResult,
  DeleteGeneratorResult,
  generateEntropy,
  loadBootloaderContract,
  MintResult,
  RegenerateTokenResult,
  SetSaleResult,
  stringToBytes,
  UpdateGeneratorResult,
} from '@/services/tezos-shared'

export async function createGenericWebGeneratorContract(
  tezos: TezosToolkit,
  name: string,
  artifactCid: string,
  metadataCid = '',
  reservedEditions = 0,
  allowBlMetadataUpdate = true
): Promise<CreateGeneratorResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'generic-web')
    const rngContract = getRngContractAddress()
    if (!rngContract) {
      throw new Error('RNG contract not configured for this network')
    }

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

    let generatorId: string | undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = operationResults?.[0] as any
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

    return { success: true, hash: operation.opHash, generatorId }
  } catch (error) {
    console.error('Failed to create generic-web generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function updateGenericWebGeneratorContract(
  tezos: TezosToolkit,
  generatorId: string | number,
  name: string,
  artifactCid: string,
  metadataCid = '',
  reservedEditions = 0,
  allowBlMetadataUpdate = true
): Promise<UpdateGeneratorResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'generic-web')
    const rngContract = getRngContractAddress()
    if (!rngContract) {
      throw new Error('RNG contract not configured for this network')
    }

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
    return { success: true, hash: operation.opHash }
  } catch (error) {
    console.error('Failed to update generic-web generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function setGenericWebGeneratorSale(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number,
  editions: number,
  paused = false,
  startTime: string | null = null,
  maxPerWallet: number | null = null
): Promise<SetSaleResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'generic-web')
    const operation = await contract.methodsObject
      .set_sale({
        generator_id: Number(generatorId),
        start_time: startTime,
        price,
        paused,
        editions,
        max_per_wallet: maxPerWallet,
      })
      .send()

    await operation.confirmation()
    return { success: true, hash: operation.opHash }
  } catch (error) {
    console.error('Failed to set generic-web sale:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function mintGenericWebToken(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number,
  params = ''
): Promise<MintResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'generic-web')
    const entropy = generateEntropy()

    const operation = await contract.methodsObject
      .mint({
        generator_id: Number(generatorId),
        entropy,
        params: stringToBytes(params),
      })
      .send({ amount: price, mutez: true })

    await operation.confirmation()
    const operationResults = await operation.operationResults()

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

      for (const diff of diffs) {
        const rawSeed = diff?.diff?.updates?.[0]?.value?.raw_seed
        if (rawSeed) {
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

export async function deleteGenericWebGeneratorContract(
  tezos: TezosToolkit,
  generatorId: string | number
): Promise<DeleteGeneratorResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'generic-web')
    const operation = await contract.methodsObject
      .delete_generator(Number(generatorId))
      .send()

    await operation.confirmation()
    return { success: true, hash: operation.opHash }
  } catch (error) {
    console.error('Failed to delete generic-web generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function regenerateGenericWebGeneratorToken(
  tezos: TezosToolkit,
  tokenId: string | number
): Promise<RegenerateTokenResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'generic-web')
    const operation = await contract.methodsObject
      .regenerate_token(Number(tokenId))
      .send()

    await operation.confirmation()
    return { success: true, hash: operation.opHash }
  } catch (error) {
    console.error('Failed to regenerate generic-web token:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
