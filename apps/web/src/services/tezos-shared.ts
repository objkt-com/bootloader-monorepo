import { TezosToolkit, WalletContract } from '@taquito/taquito'
import { getContractAddressForBootloader } from '@/config'
import type { BootloaderId } from '@/types/bootloader'

export function stringToBytes(str: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

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
  artifactUri?: string
  seed?: string
  error?: string
}

export interface RegenerateTokenResult {
  success: boolean
  hash?: string
  error?: string
}

export async function loadBootloaderContract(
  tezos: TezosToolkit,
  bootloaderId: BootloaderId
): Promise<WalletContract> {
  const contractAddress = getContractAddressForBootloader(bootloaderId)
  if (!contractAddress) {
    throw new Error(`${bootloaderId} contract not configured for this network`)
  }
  return tezos.wallet.at(contractAddress)
}
