import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CONFIG } from '@/config'
import type { Generator, Token } from '@/types/generator'
import type { BootloaderId } from '@/types/bootloader'
import { getBootloader } from '@/lib/bootloader-registry'
import { tzktService } from '@/services/tzkt'
import { buildGenericWebProjectUrl } from '@/bootloaders/generic-web/url'

/**
 * Embed page for rendering token previews full-screen.
 * Used by Screenshot One to capture thumbnails.
 *
 * URL: /embed/token/:bootloader/:tokenId
 * Query params:
 *   - c: capture mode (optional, signals this is for screenshot capture)
 *
 * Token's seed and iteration are fetched from the shared TzKT read adapter.
 */
export function EmbedTokenPage() {
  const { bootloader, tokenId } = useParams<{ bootloader: string; tokenId: string }>()
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState<Token | null>(null)
  const [generator, setGenerator] = useState<Generator | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isCaptureMode = searchParams.get('c') === 'true'
  const captureMode =
    generator?.bootloaderId === 'generic-web'
      ? generator.manifest?.capture?.mode || 'auto'
      : 'trigger'
  const captureDelayMs =
    generator?.bootloaderId === 'generic-web'
      ? generator.manifest?.capture?.delayMs ?? 5000
      : 0

  useEffect(() => {
    async function fetchToken() {
      if (!tokenId || !bootloader) {
        setError('Missing token ID or bootloader')
        setLoading(false)
        return
      }

      try {
        const data = await tzktService.getToken(
          tokenId,
          bootloader as BootloaderId
        )

        if (!data || !data.generator) {
          setError('Token not found')
          setLoading(false)
          return
        }

        let manifest = data.generator.manifest
        if (data.generator.bootloaderId === 'generic-web' && data.generator.cid) {
          try {
            const manifestRes = await fetch(
              `${CONFIG.sandboxWorkerUrl}/ipfs/${data.generator.cid}/manifest.json`
            )
            if (manifestRes.ok) {
              manifest = await manifestRes.json()
            }
          } catch {
            // Manifest is optional
          }
        }

        setGenerator({
          ...data.generator,
          manifest,
        })
        setToken(data)
        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch token:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch token')
        setLoading(false)
      }
    }

    fetchToken()
  }, [tokenId, bootloader])

  useEffect(() => {
    if (!isCaptureMode) return

    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (!message || typeof message.id !== 'string') return

      if (message.id === 'bootloader:capture') {
        const marker = document.getElementById('capture-marker')
        if (marker) {
          marker.setAttribute('data-capture-ready', 'true')
          marker.setAttribute('data-timestamp', String(Date.now()))
        }
      } else if (message.id === 'bootloader:features') {
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

  const markCaptureReady = () => {
    const marker = document.getElementById('capture-marker')
    if (marker) {
      marker.setAttribute('data-capture-ready', 'true')
      marker.setAttribute('data-timestamp', String(Date.now()))
    }
  }

  const handleReady = () => {
    if (!isCaptureMode) {
      return
    }

    if (generator?.bootloaderId === 'generic-web' && captureMode === 'trigger') {
      // Wait for explicit $bootloader.capture(), but keep a last-resort escape hatch.
      window.setTimeout(() => {
        const marker = document.getElementById('capture-marker')
        if (marker && marker.getAttribute('data-capture-ready') !== 'true') {
          console.warn('[embed] Fallback: marking capture ready after timeout')
          marker.setAttribute('data-capture-ready', 'true')
        }
      }, 30000)
      return
    }

    const delay = Math.max(0, captureDelayMs)
    window.setTimeout(markCaptureReady, delay)
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

  const ViewerComponent = getBootloader(generator.bootloaderId)?.ViewerComponent
  const tokenArtifactUrl = (() => {
    if (!token.artifactUri) {
      return null
    }

    if (token.bootloaderId === 'generic-web' && token.artifactUri.startsWith('ipfs://')) {
      const withoutPrefix = token.artifactUri.slice(7)
      const [cidPart, queryPart] = withoutPrefix.split('?')
      const query = new URLSearchParams(queryPart || '')
      return buildGenericWebProjectUrl({
        cid: cidPart,
        manifest: generator.manifest,
        seed: query.get('s') || token.seed,
        iteration: Number.parseInt(query.get('i') || String(token.iteration), 10),
        params: token.params,
        isCapture: isCaptureMode,
      })
    }

    return token.artifactUri
  })()

  const handleArtifactLoad = () => {
    if (token.bootloaderId === 'svg-js') {
      markCaptureReady()
      return
    }

    handleReady()
  }

  return (
    <div className="embed-container">
      {tokenArtifactUrl ? (
        <iframe
          src={tokenArtifactUrl}
          title={`${generator.name} #${token.iteration}`}
          className="embed-viewer"
          sandbox="allow-scripts allow-same-origin"
          onLoad={handleArtifactLoad}
        />
      ) : (
        ViewerComponent && (
          <ViewerComponent
            generator={
              token.artifactCid
                ? { ...generator, cid: token.artifactCid }
                : generator
            }
            seed={token.seed}
            iteration={token.iteration}
            params={token.params}
            className="embed-viewer"
            onReady={handleReady}
            onError={handleError}
            isCapture={isCaptureMode}
          />
        )
      )}
      <div id="capture-marker" data-capture-ready="false" />
      <div id="traits-container" />
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
