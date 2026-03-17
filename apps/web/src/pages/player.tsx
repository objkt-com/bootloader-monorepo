import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useGenerator } from '@/hooks/use-generators'
import { CONFIG, getContractAddressForBootloader, getNetworkConfig } from '@/config'
import type { BootloaderId } from '@/types/bootloader'
import { mintFromGeneratorConfig } from '@/player-mint-client'
import { isSharedBootloaderId } from '../../../../shared/bootloaders/catalog'
import { GENERIC_WEB_SEED_BYTES, randomHex } from '../../../../shared/bootloaders/seed-hex'

type MintState = 'idle' | 'connecting' | 'awaiting' | 'minted' | 'failed'
const SVG_JS_PLAYER_SEED_BYTES = 16

export function PlayerPage() {
  const { kind, bootloader, id } = useParams<{
    kind: string
    bootloader: string
    id: string
  }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mintState, setMintState] = useState<MintState>('idle')
  const [generatedSeed] = useState(() =>
    randomHex(bootloader === 'generic-web' ? GENERIC_WEB_SEED_BYTES : SVG_JS_PLAYER_SEED_BYTES)
  )

  const isGenerator = kind === 'generator'
  const isToken = kind === 'token'
  const validBootloader = Boolean(bootloader && isSharedBootloaderId(bootloader))
  const bootloaderId = (validBootloader ? bootloader : undefined) as BootloaderId | undefined
  const idNumber = id ? Number(id) : NaN

  const { generator } = useGenerator(
    isGenerator && Number.isFinite(idNumber) ? id : undefined,
    bootloaderId,
  )

  const seed = searchParams.get('s') || generatedSeed
  const iteration = useMemo(() => {
    const raw = Number(searchParams.get('i') ?? '0')
    return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0
  }, [searchParams])

  useEffect(() => {
    if (!isGenerator || searchParams.get('s')) return
    const next = new URLSearchParams(searchParams)
    next.set('s', seed)
    if (!next.get('i')) {
      next.set('i', '0')
    }
    setSearchParams(next, { replace: true })
  }, [isGenerator, searchParams, seed, setSearchParams])

  const frameSrc = useMemo(() => {
    if (!validBootloader || !id) return ''
    const url = new URL(
      isGenerator
        ? `/embed/generator/${bootloader}/${id}`
        : `/embed/token/${bootloader}/${id}`,
      window.location.origin,
    )

    if (isGenerator) {
      url.searchParams.set('s', seed)
      url.searchParams.set('i', String(iteration))
      const params = searchParams.get('p')
      if (params) {
        url.searchParams.set('p', params)
      }
    }

    return `${url.pathname}${url.search}`
  }, [validBootloader, id, isGenerator, bootloader, seed, iteration, searchParams])

  const pageHref = useMemo(() => {
    if (!validBootloader || !id) return '#'
    const path = isGenerator
      ? `/generator/${bootloader}/${id}`
      : `/token/${bootloader}/${id}`
    const url = new URL(path, window.location.origin)
    if (isGenerator) {
      url.searchParams.set('s', seed)
      url.searchParams.set('i', String(iteration))
    }
    return url.toString()
  }, [validBootloader, id, isGenerator, bootloader, seed, iteration])

  const listed = Boolean(isGenerator && generator?.mintingOpen && (generator.price ?? 0) > 0)
  const mintLabel =
    mintState === 'connecting'
      ? 'Connecting...'
      : mintState === 'awaiting'
        ? 'Awaiting Wallet...'
        : mintState === 'minted'
          ? 'Minted'
          : mintState === 'failed'
            ? 'Mint Failed'
            : `Mint ${((generator?.price ?? 0) / 1_000_000).toFixed(2)} ꜩ`

  async function onMint() {
    if (!isGenerator || !validBootloader || !id || !listed) return

    const contractAddress = getContractAddressForBootloader(bootloaderId!)

    if (!contractAddress) {
      setMintState('failed')
      window.setTimeout(() => setMintState('idle'), 2200)
      return
    }

    setMintState('connecting')
    try {
      setMintState('awaiting')
      await mintFromGeneratorConfig({
        bootloader: bootloaderId!,
        network: CONFIG.network,
        rpcUrl: getNetworkConfig().rpcUrl,
        contractAddress,
        generatorId: Number(id),
        priceMutez: Number(generator?.price ?? 0),
        listed,
      })
      setMintState('minted')
    } catch (error) {
      console.warn('[player-mint] mint failed', error)
      setMintState('failed')
      window.setTimeout(() => setMintState('idle'), 2200)
    }
  }

  function onRandomizeSeed() {
    if (!isGenerator) return
    const next = new URLSearchParams(searchParams)
    next.set(
      's',
      randomHex(
        bootloader === 'generic-web' ? GENERIC_WEB_SEED_BYTES : SVG_JS_PLAYER_SEED_BYTES
      )
    )
    next.set('i', '0')
    setSearchParams(next, { replace: true })
  }

  if ((!isGenerator && !isToken) || !validBootloader || !id || !Number.isFinite(idNumber)) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', color: '#f66', display: 'grid', placeItems: 'center', fontFamily: 'monospace' }}>
        Invalid player route
      </div>
    )
  }

  return (
    <div className="player-root">
      <iframe id="player-frame" src={frameSrc} allow="autoplay; fullscreen" allowFullScreen />

      {listed ? (
        <button
          id="player-mint"
          type="button"
          onClick={() => void onMint()}
          disabled={mintState === 'connecting' || mintState === 'awaiting'}
          aria-label="Mint"
          title="Mint"
          className={mintState === 'minted' ? 'connected' : ''}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h16v12H4z" />
            <path d="M8 8V5h8v3" />
            <path d="M8 14h8" />
          </svg>
          <span>{mintLabel}</span>
        </button>
      ) : null}

      <a
        id="player-page-link"
        href={pageHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open artwork page"
        title="Open artwork page"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 5h5v5" />
          <path d="M10 14 19 5" />
          <path d="M19 13v6H5V5h6" />
        </svg>
      </a>

      {isGenerator ? (
        <button
          id="seed-randomizer"
          type="button"
          onClick={onRandomizeSeed}
          aria-label="Randomize seed"
          title="Randomize seed"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4.5" y="4.5" width="15" height="15" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="16" cy="8" r="1.2" />
            <circle cx="12" cy="12" r="1.2" />
            <circle cx="8" cy="16" r="1.2" />
            <circle cx="16" cy="16" r="1.2" />
          </svg>
        </button>
      ) : null}

      <style>{`
        html,
        body,
        #root,
        .player-root {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #000;
        }
        .player-root {
          position: fixed;
          inset: 0;
        }
        #player-frame {
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
          background: #000;
        }
        #seed-randomizer {
          position: fixed;
          right: 14px;
          bottom: 14px;
          width: 44px;
          height: 44px;
          border-radius: 0;
          border: 1px solid #fff;
          background: #000;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 9999;
          padding: 0;
        }
        #seed-randomizer:hover {
          background: #fff;
          color: #000;
        }
        #seed-randomizer svg {
          width: 24px;
          height: 24px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.6;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        #seed-randomizer svg circle {
          fill: currentColor;
          stroke: none;
        }
        #player-mint {
          position: fixed;
          top: 14px;
          right: 14px;
          height: 36px;
          min-width: 92px;
          border-radius: 0;
          border: 1px solid #fff;
          background: #000;
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          z-index: 9999;
          padding: 0 10px;
          font: 12px/1.2 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        #player-mint:hover {
          background: #fff;
          color: #000;
        }
        #player-mint.connected {
          border-color: #22c55e;
        }
        #player-mint:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        #player-mint svg {
          width: 14px;
          height: 14px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        #player-page-link {
          position: fixed;
          left: 14px;
          bottom: 14px;
          width: 44px;
          height: 44px;
          border-radius: 0;
          border: 1px solid #fff;
          background: #000;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 9999;
          padding: 0;
          text-decoration: none;
        }
        #player-page-link:hover {
          background: #fff;
          color: #000;
        }
        #player-page-link svg {
          width: 22px;
          height: 22px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
      `}</style>
    </div>
  )
}
