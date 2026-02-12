import { useMemo, useEffect } from 'react'
import type { BootloaderViewerProps } from '@/types/bootloader'
import { cn } from '@/lib/utils'
import { generateSvgDataUrl } from './btldr-runtime'

export function SvgJsViewer({
  generator,
  seed,
  iteration = 0,
  className,
  onReady,
  onError,
}: BootloaderViewerProps) {
  // Generate the SVG URL synchronously using useMemo
  const svgUrl = useMemo(() => {
    if (!generator.code) {
      return null
    }
    try {
      return generateSvgDataUrl(generator.code, seed, iteration)
    } catch (error) {
      console.error('Failed to generate SVG:', error)
      return null
    }
  }, [generator.code, seed, iteration])

  // Handle callbacks
  useEffect(() => {
    if (!generator.code) {
      onError?.(new Error('Generator has no code'))
    } else if (svgUrl) {
      onReady?.()
    }
  }, [generator.code, svgUrl, onReady, onError])

  if (!svgUrl) {
    return (
      <div className={cn('flex items-center justify-center bg-muted', className)}>
        <span className="text-muted-foreground">Loading...</span>
      </div>
    )
  }

  // Use key to force iframe recreation when URL changes
  // This ensures clean state for each new SVG
  return (
    <iframe
      key={svgUrl}
      src={svgUrl}
      title={generator.name}
      className={cn('w-full h-full border-0', className)}
      sandbox="allow-scripts"
    />
  )
}
