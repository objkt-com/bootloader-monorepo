import { useMemo } from 'react'
import type { BootloaderViewerProps } from '@/types/bootloader'
import { cn } from '@/lib/utils'
import { CONFIG } from '@/config'
import { encodeParamsForQuery } from './param-encoder'

export function GenericWebViewer({
  generator,
  seed,
  iteration = 0,
  params,
  className,
  onReady,
  onError,
  isCapture = false,
}: BootloaderViewerProps & { isCapture?: boolean }) {
  const previewUrl = useMemo(() => {
    if (!generator.cid) {
      onError?.(new Error('Generator has no CID'))
      return null
    }

    const entry = generator.manifest?.entry || 'index.html'
    const searchParams = new URLSearchParams()
    searchParams.set('s', seed)
    if (Number.isFinite(iteration)) {
      searchParams.set('i', String(Math.trunc(iteration)))
    }

    const encodedParams = params ? encodeParamsForQuery(params) : null
    if (encodedParams) {
      searchParams.set('p', encodedParams)
    }

    // Pass capture mode to the artwork
    if (isCapture) {
      searchParams.set('c', 'true')
    }

    // Use sandbox worker URL or local proxy
    const baseUrl = CONFIG.sandboxWorkerUrl
    return `${baseUrl}/ipfs/${generator.cid}/${entry}?${searchParams.toString()}`
  }, [generator.cid, generator.manifest?.entry, seed, iteration, params, onError, isCapture])

  if (!previewUrl) {
    return (
      <div className={cn('flex items-center justify-center bg-muted', className)}>
        <span className="text-muted-foreground">No CID available</span>
      </div>
    )
  }

  return (
    <iframe
      src={previewUrl}
      title={generator.name}
      className={cn('preview-frame', className)}
      sandbox="allow-scripts allow-same-origin"
      onLoad={() => onReady?.()}
      onError={() => onError?.(new Error('Failed to load preview'))}
    />
  )
}
