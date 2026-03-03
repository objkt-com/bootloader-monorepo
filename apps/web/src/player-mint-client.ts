import { TezosToolkit } from '@taquito/taquito'
import { BeaconWallet } from '@taquito/beacon-wallet'
import { NetworkType } from '@airgap/beacon-dapp'

type Bootloader = 'svg-js' | 'generic-web'
type Network = 'mainnet' | 'shadownet'

export type PlayerMintConfig = {
  bootloader: Bootloader
  network: Network
  rpcUrl: string
  contractAddress: string
  generatorId: number
  priceMutez: number
  listed: boolean
}

export type PlayerMintInitOptions = {
  mintConfig: PlayerMintConfig
  buttonId?: string
  labelId?: string
}

function randomEntropyHex(): string {
  const entropy = new Uint8Array(16)
  crypto.getRandomValues(entropy)
  let hex = '0x'
  for (const byte of entropy) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

function setLabel(labelEl: HTMLElement, value: string): void {
  labelEl.textContent = value
}

export async function mintFromGeneratorConfig(
  config: PlayerMintConfig
): Promise<string | null> {
  const toolkit = new TezosToolkit(config.rpcUrl)
  const wallet = new BeaconWallet({
    name: 'bootloader:',
    preferredNetwork:
      config.network === 'mainnet'
        ? NetworkType.MAINNET
        : (NetworkType.SHADOWNET || NetworkType.CUSTOM),
  })
  toolkit.setWalletProvider(wallet)

  await wallet.requestPermissions()

  const contract = await toolkit.wallet.at(config.contractAddress)
  const entropy = randomEntropyHex()
  const mintPayload =
    config.bootloader === 'generic-web'
      ? {
          generator_id: Number(config.generatorId),
          entropy,
          params: '',
        }
      : {
          generator_id: Number(config.generatorId),
          entropy,
        }

  const operation = await contract.methodsObject
    .mint(mintPayload)
    .send({
      amount: Number(config.priceMutez),
      mutez: true,
    })

  await operation.confirmation()
  return operation.opHash || null
}

export function init(options: PlayerMintInitOptions): void {
  const buttonId = options.buttonId || 'player-mint'
  const labelId = options.labelId || 'player-mint-label'
  const config = options.mintConfig

  const button = document.getElementById(buttonId)
  const label = document.getElementById(labelId)
  if (!(button instanceof HTMLButtonElement) || !(label instanceof HTMLElement)) {
    return
  }
  if (!config || config.listed !== true) {
    button.disabled = true
    return
  }

  const defaultLabel = label.textContent || 'Mint'

  button.addEventListener('click', async () => {
    if (button.disabled) return
    button.disabled = true
    setLabel(label, 'Connecting...')
    try {
      setLabel(label, 'Awaiting Wallet...')
      await mintFromGeneratorConfig(config)
      setLabel(label, 'Minted')
      button.classList.add('connected')
    } catch (error) {
      console.warn('[player-mint] mint failed', error)
      setLabel(label, 'Mint Failed')
      window.setTimeout(() => {
        setLabel(label, defaultLabel)
      }, 2200)
      button.disabled = false
    }
  })
}
