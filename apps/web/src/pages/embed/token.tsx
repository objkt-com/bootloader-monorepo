import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { SvgJsViewer } from '@/bootloaders/svg-js/viewer'
import { GenericWebViewer } from '@/bootloaders/generic-web/viewer'
import { CONFIG } from '@/config'
import type { Generator, Token } from '@/types/generator'
import type { BootloaderId } from '@/types/bootloader'

/**
 * Embed page for rendering token previews full-screen.
 * Used by Screenshot One to capture thumbnails.
 *
 * URL: /embed/token/:bootloader/:tokenId
 * Query params:
 *   - c: capture mode (optional, signals this is for screenshot capture)
 *
 * Token's seed and iteration are fetched from the blockchain.
 */
export function EmbedTokenPage() {
  const { bootloader, tokenId } = useParams<{ bootloader: string; tokenId: string }>()
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState<Token | null>(null)
  const [generator, setGenerator] = useState<Generator | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isCaptureMode = searchParams.get('c') === 'true'

  useEffect(() => {
    async function fetchToken() {
      if (!tokenId || !bootloader) {
        setError('Missing token ID or bootloader')
        setLoading(false)
        return
      }

      try {
        const networkConfig = CONFIG.network === 'mainnet'
          ? { tzktApi: 'https://api.tzkt.io' }
          : { tzktApi: 'https://api.ghostnet.tzkt.io' }

        // Get contract address based on bootloader
        const contractAddress = bootloader === 'generic-web'
          ? CONFIG.genericWebContracts[CONFIG.network]
          : CONFIG.contracts[CONFIG.network]

        if (!contractAddress) {
          setError(`No contract configured for ${bootloader} on ${CONFIG.network}`)
          setLoading(false)
          return
        }

        // Fetch bigmaps
        const bigmapsRes = await fetch(
          `${networkConfig.tzktApi}/v1/contracts/${contractAddress}/bigmaps`
        )
        const bigmaps = await bigmapsRes.json()

        const tokenExtraBigMap = bigmaps.find((b: any) => b.path === 'token_extra')
        const tokenMetadataBigMap = bigmaps.find((b: any) => b.path === 'token_metadata')
        const generatorsBigMap = bigmaps.find((b: any) => b.path === 'generators')

        if (!tokenExtraBigMap || !tokenMetadataBigMap || !generatorsBigMap) {
          setError('Required bigmaps not found')
          setLoading(false)
          return
        }

        // Fetch token extra data (seed, iteration, generator_id)
        const tokenExtraRes = await fetch(
          `${networkConfig.tzktApi}/v1/bigmaps/${tokenExtraBigMap.ptr}/keys/${tokenId}`
        )

        if (!tokenExtraRes.ok) {
          setError('Token not found')
          setLoading(false)
          return
        }

        const tokenExtraData = await tokenExtraRes.json()
        const tokenExtra = tokenExtraData.value

        // Fetch token metadata (token-specific artifact URI/version pinning).
        const tokenMetadataRes = await fetch(
          `${networkConfig.tzktApi}/v1/bigmaps/${tokenMetadataBigMap.ptr}/keys/${tokenId}`
        )
        const tokenMetadataData = tokenMetadataRes.ok ? await tokenMetadataRes.json() : null
        const tokenInfo = tokenMetadataData?.value?.token_info || {}
        const artifactUriHex =
          tokenInfo.artifact_uri ||
          tokenInfo.artifactUri ||
          tokenInfo._artifact_uri ||
          tokenInfo._artifactUri ||
          ''
        const tokenArtifactUri = typeof artifactUriHex === 'string' ? hexToString(artifactUriHex) : ''
        const parsedArtifact = bootloader === 'generic-web'
          ? parseGenericWebArtifactUri(tokenArtifactUri)
          : null

        // Extract token data
        const generatorId = tokenExtra.generator_id || tokenExtra.generatorId
        // raw_seed is an option type, so it may be an object { Some: "..." } or null
        const rawSeedValue = tokenExtra.raw_seed?.Some || tokenExtra.raw_seed || tokenExtra.seed || ''
        const seedFromExtra = typeof rawSeedValue === 'string' ? rawSeedValue : ''
        const seed = parsedArtifact?.seedHex || seedFromExtra
        const iterationFromExtra = parseInt(tokenExtra.iteration_number || tokenExtra.iteration || '1', 10)
        const iterationFromArtifact = parsedArtifact?.iteration
        const iteration = Number.isFinite(iterationFromArtifact)
          ? Number(iterationFromArtifact)
          : (Number.isFinite(iterationFromExtra) ? iterationFromExtra : 1)
        // params is stored as hex-encoded bytes
        let params: Record<string, unknown> | undefined
        const paramsHex = parsedArtifact?.paramsHex || tokenExtra.params
        if (paramsHex && paramsHex !== '0x') {
          try {
            const decodedParams = hexToString(paramsHex)
            params = decodedParams ? JSON.parse(decodedParams) : undefined
          } catch {
            // Invalid params, ignore
          }
        }

        // Fetch generator data
        const genRes = await fetch(
          `${networkConfig.tzktApi}/v1/bigmaps/${generatorsBigMap.ptr}/keys/${generatorId}`
        )

        if (!genRes.ok) {
          setError('Generator not found')
          setLoading(false)
          return
        }

        const genData = await genRes.json()
        const genValue = genData.value

        // Decode name from hex
        const name = genValue.name ? hexToString(genValue.name) : `Generator #${generatorId}`

        // Build generator object based on bootloader type
        let gen: Generator
        if (bootloader === 'generic-web') {
          // Prefer token-specific artifact URI CID to avoid auto-upgrading older tokens
          // when generator gets updated.
          const rawCid = genValue.cid || genValue.artifact_cid
          const decodedGeneratorCid = rawCid ? hexToString(rawCid) : ''
          const effectiveCid = parsedArtifact?.cid || decodedGeneratorCid
          const cleanCid = stripIpfsPrefix(effectiveCid)

          // Try to fetch manifest
          let manifest = null
          if (cleanCid) {
            try {
              const manifestRes = await fetch(`${CONFIG.sandboxWorkerUrl}/ipfs/${cleanCid}/manifest.json`)
              if (manifestRes.ok) {
                manifest = await manifestRes.json()
              }
            } catch {
              // Manifest is optional
            }
          }

          gen = {
            id: generatorId,
            name,
            bootloaderId: 'generic-web',
            cid: cleanCid,
            manifest,
            creator: '',
          }
        } else {
          const code = genValue.code ? decodeUrlEncodedHex(genValue.code) : ''

          gen = {
            id: generatorId,
            name,
            bootloaderId: bootloader as BootloaderId,
            code,
            creator: '',
          }
        }

        setGenerator(gen)
        setToken({
          id: tokenId,
          generatorId,
          bootloaderId: bootloader as BootloaderId,
          seed,
          iteration,
          params,
          artifactUri: tokenArtifactUri || undefined,
          owner: '',
        })
        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch token:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch token')
        setLoading(false)
      }
    }

    fetchToken()
  }, [tokenId, bootloader])

  // Listen for bootloader messages from the iframe (capture and features)
  useEffect(() => {
    if (!isCaptureMode) return

    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (!message || typeof message.id !== 'string') return

      if (message.id === 'bootloader:capture') {
        // Artwork signals it's ready for capture
        const marker = document.getElementById('capture-marker')
        if (marker) {
          marker.setAttribute('data-capture-ready', 'true')
          marker.setAttribute('data-timestamp', String(Date.now()))
        }
      } else if (message.id === 'bootloader:features') {
        // Artwork sends its features/traits
        // Note: bootloader.js sends { id, data, timestamp } - payload is in 'data' field
        const traitsContainer = document.getElementById('traits-container')
        if (traitsContainer && message.data) {
          try {
            const json = JSON.stringify(message.data, null, 2)
            traitsContainer.textContent = json
            traitsContainer.setAttribute('data-features', json.replace(/"/g, '&quot;'))
          } catch (err) {
            console.warn('[embed] failed to serialize features', err)
          }
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isCaptureMode])

  // Fallback: mark ready on iframe load (for artworks that don't call capture)
  const handleReady = () => {
    // Don't mark ready immediately - wait for bootloader:capture message
    // This is just a fallback timeout for artworks that don't properly signal
    if (isCaptureMode) {
      setTimeout(() => {
        const marker = document.getElementById('capture-marker')
        if (marker && marker.getAttribute('data-capture-ready') !== 'true') {
          console.warn('[embed] Fallback: marking capture ready after timeout')
          marker.setAttribute('data-capture-ready', 'true')
        }
      }, 30000) // 30 second fallback
    }
  }

  const handleError = (err: Error) => {
    console.error('Viewer error:', err)
    setError(err.message)
  }

  if (loading) {
    return (
      <div className="embed-container">
        <div className="embed-loading">Loading...</div>
        <div id="capture-marker" data-capture-ready="false" />
      </div>
    )
  }

  if (error || !generator || !token) {
    return (
      <div className="embed-container">
        <div className="embed-error">{error || 'Token not found'}</div>
        <div id="capture-marker" data-capture-ready="false" />
      </div>
    )
  }

  const ViewerComponent = generator.bootloaderId === 'generic-web'
    ? GenericWebViewer
    : SvgJsViewer

  return (
    <div className="embed-container">
      <ViewerComponent
        generator={generator}
        seed={token.seed}
        iteration={token.iteration}
        params={token.params}
        className="embed-viewer"
        onReady={handleReady}
        onError={handleError}
        isCapture={isCaptureMode}
      />
      <div id="capture-marker" data-capture-ready="false" />
      <div id="traits-container" />
      <style>{`
        .embed-container {
          width: 100vw;
          height: 100vh;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #000;
        }
        .embed-viewer {
          width: 100%;
          height: 100%;
          border: none;
        }
        .embed-loading,
        .embed-error {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: #666;
          font-family: monospace;
        }
        .embed-error {
          color: #f66;
        }
        #capture-marker,
        #traits-container {
          position: absolute;
          width: 1px;
          height: 1px;
          top: -9999px;
          left: -9999px;
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}

// Helper functions (matching tzkt.ts implementations)
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

function stripIpfsPrefix(cid: string): string {
  if (cid.startsWith('ipfs://')) {
    return cid.slice(7)
  }
  return cid
}

function parseGenericWebArtifactUri(
  artifactUri: string
): { cid: string; seedHex?: string; paramsHex?: string; iteration?: number } | null {
  if (!artifactUri || !artifactUri.startsWith('ipfs://')) return null

  const withoutPrefix = artifactUri.slice('ipfs://'.length)
  const [cidPart, queryString = ''] = withoutPrefix.split('?')
  if (!cidPart) return null

  const query = new URLSearchParams(queryString)
  const seedHex = query.get('s') || undefined
  const paramsHex = query.get('p') || undefined
  const iterationRaw = query.get('i')
  const iteration =
    iterationRaw != null && iterationRaw.trim() !== '' && Number.isFinite(Number(iterationRaw))
      ? Math.trunc(Number(iterationRaw))
      : undefined

  return {
    cid: cidPart,
    seedHex,
    paramsHex,
    iteration,
  }
}
