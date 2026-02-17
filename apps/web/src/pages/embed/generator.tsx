import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { SvgJsViewer } from '@/bootloaders/svg-js/viewer'
import { GenericWebViewer } from '@/bootloaders/generic-web/viewer'
import { CONFIG } from '@/config'
import type { Generator } from '@/types/generator'
import type { BootloaderId } from '@/types/bootloader'
import { decodeParamsFromQuery } from '@/bootloaders/generic-web/param-encoder'

/**
 * Embed page for rendering generator previews full-screen.
 * Used by Screenshot One to capture thumbnails.
 *
 * URL: /embed/generator/:bootloader/:id
 * Query params:
 *   - s: seed (required)
 *   - i: iteration (optional, default 1)
 *   - p: params (optional, base64url encoded JSON for generic-web)
 *   - c: capture mode (optional, signals this is for screenshot capture)
 */
export function EmbedGeneratorPage() {
  const { bootloader, id } = useParams<{ bootloader: string; id: string }>()
  const [searchParams] = useSearchParams()
  const [generator, setGenerator] = useState<Generator | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const seed = searchParams.get('s') || CONFIG.defaultPreviewSeed
  const iteration = parseInt(searchParams.get('i') || '1', 10)
  const isCaptureMode = searchParams.get('c') === 'true'

  // Decode params for generic-web
  const params = useMemo(() => {
    const encoded = searchParams.get('p')
    if (!encoded) return undefined
    try {
      return decodeParamsFromQuery(encoded) ?? undefined
    } catch {
      return undefined
    }
  }, [searchParams])

  useEffect(() => {
    async function fetchGenerator() {
      if (!id || !bootloader) {
        setError('Missing generator ID or bootloader')
        setLoading(false)
        return
      }

      try {
        const networkConfig = CONFIG.network === 'mainnet'
          ? { tzktApi: 'https://api.tzkt.io' }
          : { tzktApi: 'https://api.shadownet.tzkt.io' }

        // Get contract address based on bootloader
        const contractAddress = bootloader === 'generic-web'
          ? CONFIG.genericWebContracts[CONFIG.network]
          : CONFIG.contracts[CONFIG.network]

        if (!contractAddress) {
          setError(`No contract configured for ${bootloader} on ${CONFIG.network}`)
          setLoading(false)
          return
        }

        // Fetch generator data from TzKT
        const bigmapsRes = await fetch(
          `${networkConfig.tzktApi}/v1/contracts/${contractAddress}/bigmaps`
        )
        const bigmaps = await bigmapsRes.json()
        const generatorsBigMap = bigmaps.find((b: any) => b.path === 'generators')

        if (!generatorsBigMap) {
          setError('Generators bigmap not found')
          setLoading(false)
          return
        }

        const genRes = await fetch(
          `${networkConfig.tzktApi}/v1/bigmaps/${generatorsBigMap.ptr}/keys/${id}`
        )

        if (!genRes.ok) {
          setError('Generator not found')
          setLoading(false)
          return
        }

        const genData = await genRes.json()
        const value = genData.value

        // Decode name from hex
        const name = value.name ? hexToString(value.name) : `Generator #${id}`

        // Build generator object based on bootloader type
        if (bootloader === 'generic-web') {
          // Generic-web: fetch CID and manifest
          // CID is stored as hex-encoded string on-chain (e.g., "ipfs://bafy...")
          const rawCid = value.cid || value.artifact_cid
          const decodedCid = rawCid ? hexToString(rawCid) : ''
          const cleanCid = stripIpfsPrefix(decodedCid)

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

          setGenerator({
            id,
            name,
            bootloaderId: 'generic-web',
            cid: cleanCid,
            manifest,
            creator: '',
          })
        } else {
          // SVG-JS: decode code from hex
          const code = value.code ? decodeUrlEncodedHex(value.code) : ''

          setGenerator({
            id,
            name,
            bootloaderId: bootloader as BootloaderId,
            code,
            creator: '',
          })
        }

        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch generator:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch generator')
        setLoading(false)
      }
    }

    fetchGenerator()
  }, [id, bootloader])

  // Signal capture ready for Screenshot One
  const handleReady = () => {
    if (isCaptureMode) {
      // Add capture marker for Screenshot One to detect
      const marker = document.getElementById('capture-marker')
      if (marker) {
        marker.setAttribute('data-capture-ready', 'true')
      }
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

  if (error || !generator) {
    return (
      <div className="embed-container">
        <div className="embed-error">{error || 'Generator not found'}</div>
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
        seed={seed}
        iteration={iteration}
        params={params}
        className="embed-viewer"
        onReady={handleReady}
        onError={handleError}
      />
      <div id="capture-marker" data-capture-ready="false" />
      <style>{`
        html,
        body,
        #root {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          scrollbar-gutter: auto !important;
        }
        .embed-container {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #000;
        }
        .embed-viewer {
          display: block;
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
        #capture-marker {
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
