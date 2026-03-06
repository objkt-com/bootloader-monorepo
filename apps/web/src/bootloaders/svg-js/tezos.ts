import type { TezosToolkit } from '@taquito/taquito'
import {
  bytesToString,
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

export async function createSvgJsGenerator(
  tezos: TezosToolkit,
  name: string,
  code: string,
  bootloaderId = 0,
  reservedEditions = 0,
  description = ''
): Promise<CreateGeneratorResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'svg-js')
    const userAddress = await tezos.wallet.pkh()
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

    let generatorId: string | undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = operationResults?.[0] as any
      generatorId = result?.metadata?.operation_result?.lazy_storage_diff?.[6]?.diff?.updates?.[0]?.key?.int
    } catch {
      console.warn('Could not extract generator ID from operation results')
    }

    return { success: true, hash: operation.opHash, generatorId }
  } catch (error) {
    console.error('Failed to create generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function updateSvgJsGenerator(
  tezos: TezosToolkit,
  generatorId: string | number,
  name: string,
  code: string,
  reservedEditions = 0,
  description = ''
): Promise<UpdateGeneratorResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'svg-js')
    const userAddress = await tezos.wallet.pkh()
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
    return { success: true, hash: operation.opHash }
  } catch (error) {
    console.error('Failed to update generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function setSvgJsSale(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number,
  editions: number,
  paused = false,
  startTime: string | null = null,
  maxPerWallet: number | null = null
): Promise<SetSaleResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'svg-js')
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
    console.error('Failed to set sale:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function deleteSvgJsGenerator(
  tezos: TezosToolkit,
  generatorId: string | number
): Promise<DeleteGeneratorResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'svg-js')
    const operation = await contract.methodsObject
      .delete_generator(Number(generatorId))
      .send()

    await operation.confirmation()
    return { success: true, hash: operation.opHash }
  } catch (error) {
    console.error('Failed to delete generator:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function mintSvgJsToken(
  tezos: TezosToolkit,
  generatorId: string | number,
  price: number
): Promise<MintResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'svg-js')
    const entropy = generateEntropy()

    const operation = await contract.methodsObject
      .mint({
        generator_id: Number(generatorId),
        entropy,
      })
      .send({ amount: price, mutez: true })

    await operation.confirmation()
    const operationResults = await operation.operationResults()

    let tokenId: string | undefined
    let artifactUri: string | undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = operationResults?.[0] as any
      tokenId = result?.metadata?.operation_result?.lazy_storage_diff?.[0]?.diff?.updates?.[0]?.key?.int
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

export async function regenerateSvgJsToken(
  tezos: TezosToolkit,
  tokenId: string | number
): Promise<RegenerateTokenResult> {
  try {
    const contract = await loadBootloaderContract(tezos, 'svg-js')
    const operation = await contract.methodsObject
      .regenerate_token(Number(tokenId))
      .send()

    await operation.confirmation()
    return { success: true, hash: operation.opHash }
  } catch (error) {
    console.error('Failed to regenerate token:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
