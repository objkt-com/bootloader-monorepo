import { useMemo } from 'react'
import type { BootloaderViewerProps } from '@/types/bootloader'
import { cn } from '@/lib/utils'
import { buildGenericWebProjectUrl } from './url'

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

    return buildGenericWebProjectUrl({
      cid: generator.cid,
      manifest: generator.manifest,
      seed,
      iteration,
      params,
      isCapture,
    })
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
