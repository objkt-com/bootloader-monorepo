import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Share2, ExternalLink, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getNetworkConfig, getContractAddressForBootloader } from '@/config'
import type { Generator } from '@/types/generator'
import { getBootloader } from '@/lib/bootloader-registry'
import { tzktService } from '@/services/tzkt'

interface MintSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  tokenId: string
  generator: Generator
  entropy: string // The entropy used for minting (hex string with 0x prefix) - used as fallback
  iteration: number // The iteration number for this token
  /** For SVG-JS: the complete data URI containing the rendered SVG from operation results */
  artifactUri?: string
  /** For generic-web: the seed from RNG contract extracted from operation results */
  seed?: string
  authorDisplayName?: string
  /** Preview-only mode for UI testing without a real mint */
  isPreview?: boolean
}

export function MintSuccessModal({
  isOpen,
  onClose,
  tokenId,
  generator,
  entropy,
  iteration,
  artifactUri,
  seed: seedFromMint,
  authorDisplayName,
  isPreview = false,
}: MintSuccessModalProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [seed, setSeed] = useState<string | null>(seedFromMint || null)
  const [isLoadingSeed, setIsLoadingSeed] = useState(false)
  const config = getNetworkConfig()
  const bootloader = getBootloader(generator.bootloaderId)

  // For SVG-JS, we use the artifactUri directly (no seed needed)
  // For generic-web, we use the seed from operation results or fetch from chain
  const isSvgJs = generator.bootloaderId === 'svg-js'
  const isGenericWeb = generator.bootloaderId === 'generic-web'

  // Update seed when seedFromMint prop changes
  useEffect(() => {
    if (seedFromMint) {
      setSeed(seedFromMint)
    }
  }, [seedFromMint])

  // Only fetch seed from chain if needed (generic-web without seed from operation results)
  useEffect(() => {
    // Skip if modal not open, no tokenId, or we already have what we need
    if (!isOpen || !tokenId) return
    if (isPreview) return
    if (isSvgJs && artifactUri) return // SVG-JS with artifactUri doesn't need seed
    if (!isSvgJs && seed) return // Generic-web already has seed

    let cancelled = false

    async function fetchSeed() {
      setIsLoadingSeed(true)
      try {
        // Fetch the token from the chain to get the actual seed
        const token = await tzktService.getToken(tokenId, generator.bootloaderId)
        if (!cancelled && token?.seed) {
          setSeed(token.seed)
        }
      } catch (error) {
        console.error('Failed to fetch token seed:', error)
        // Fallback to using entropy (without 0x prefix) if chain fetch fails
        if (!cancelled && !seed) {
          const cleanHex = entropy.startsWith('0x') ? entropy.slice(2) : entropy
          setSeed(cleanHex)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSeed(false)
        }
      }
    }

    fetchSeed()

    return () => {
      cancelled = true
    }
  }, [isOpen, tokenId, generator.bootloaderId, entropy, isSvgJs, artifactUri, isPreview, seed])

  // Set iframe src when artifactUri is available (for SVG-JS)
  useEffect(() => {
    if (!isOpen) {
      setSeed(seedFromMint || null)
      return
    }
    if (seedFromMint) {
      setSeed(seedFromMint)
      return
    }
    // Avoid double render for generic-web: wait for the real chain seed
    // instead of eagerly falling back to entropy.
    if (!seed && (!isGenericWeb || isPreview)) {
      const cleanHex = entropy.startsWith('0x') ? entropy.slice(2) : entropy
      setSeed(cleanHex)
    }
  }, [isOpen, seedFromMint, entropy, seed, isGenericWeb, isPreview])

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true)
      // Auto-hide confetti after animation
      const timer = setTimeout(() => setShowConfetti(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const confettiBits = useMemo(() => {
    if (!showConfetti) {
      return []
    }
    return Array.from({ length: 360 }, (_, index) => {
      const char = Math.random() > 0.5 ? '1' : '0'
      const delay = `${Math.random() * 0.08}s`
      const duration = `${2.1 + Math.random() * 0.9}s`
      const fontSize = `${10 + Math.random() * 12}px`
      const opacity = 0.45 + Math.random() * 0.5
      const color = [
        '#111111',
        '#232323',
        '#3a3a3a',
        '#525252',
        '#6b6b6b',
        '#868686',
        '#a2a2a2',
        '#bfbfbf',
        '#d9d9d9',
        '#f1f1f1',
      ][Math.floor(Math.random() * 10)]

      // Bias launch vectors upward while still keeping lateral spread.
      const angle = (Math.random() - 0.5) * Math.PI * 1.1 - Math.PI / 2
      const distance = 260 + Math.random() * 860
      const burstX = Math.cos(angle) * distance
      const upwardLift = 460 + Math.random() * 620
      const burstY = Math.sin(angle) * distance - upwardLift
      const gravityDrop = 760 + Math.random() * 1240
      const spinStart = `${Math.random() * 360}deg`
      const spinMid = `${360 + Math.random() * 360}deg`
      const spinEnd = `${720 + Math.random() * 540}deg`

      return {
        id: `${tokenId}-${index}`,
        char,
        style: {
          left: '50%',
          top: '56%',
          animationDelay: delay,
          animationDuration: duration,
          fontSize,
          opacity,
          color,
          ['--burst-x' as string]: `${burstX.toFixed(2)}px`,
          ['--burst-y' as string]: `${burstY.toFixed(2)}px`,
          ['--gravity-drop' as string]: `${gravityDrop.toFixed(2)}px`,
          ['--spin-start' as string]: spinStart,
          ['--spin-mid' as string]: spinMid,
          ['--spin-end' as string]: spinEnd,
        } as CSSProperties,
      }
    })
  }, [showConfetti, tokenId])

  const tokenName = `${generator.name} #${iteration}`
  const displayAuthor = authorDisplayName || generator.creator.slice(0, 8) + '...'

  const svgArtifactUri = useMemo(() => {
    if (!artifactUri || !artifactUri.startsWith('data:image/svg+xml')) {
      return artifactUri
    }

    const commaIndex = artifactUri.indexOf(',')
    if (commaIndex < 0) {
      return artifactUri
    }

    const prefix = artifactUri.slice(0, commaIndex + 1)
    const encodedPayload = artifactUri.slice(commaIndex + 1)
    try {
      const decodedPayload = decodeURIComponent(encodedPayload)
      if (decodedPayload.includes('BigInt.prototype.toJSON')) {
        return artifactUri
      }

      const polyfill =
        "if(typeof BigInt!=='undefined'&&!BigInt.prototype.toJSON){BigInt.prototype.toJSON=function(){return this.toString();};}"
      const patchedPayload = decodedPayload.replace(
        '<![CDATA[',
        `<![CDATA[${polyfill}`
      )
      return `${prefix}${encodeURIComponent(patchedPayload)}`
    } catch {
      return artifactUri
    }
  }, [artifactUri])

  const handleShareOnX = () => {
    const tokenUrl = `https://bootloader.art/token/${generator.bootloaderId}/${tokenId}`
    const tweetText =
      generator.bootloaderId === 'generic-web'
        ? `I just minted "${tokenName}" by ${displayAuthor}. A long-form generative artwork via @bootloader_art ${tokenUrl}`
        : `I just minted "${tokenName}" by ${displayAuthor}. A long-form generative on-chain artwork via @bootloader_art ${tokenUrl}`
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    window.open(tweetUrl, '_blank', 'noopener,noreferrer')
  }

  const objktUrl = `${config.objktUrl}/asset/${getContractAddressForBootloader(generator.bootloaderId)}/${tokenId}`

  // Get the viewer component to show the preview (for generic-web)
  const ViewerComponent = bootloader?.ViewerComponent

  // Determine what to render in the preview
  const renderPreview = () => {
    if (!isOpen) {
      return <div className="absolute inset-0 bg-black" />
    }

    if (isSvgJs) {
      // For SVG-JS, render the artifactUri directly in an iframe
      if (svgArtifactUri) {
        return (
          <iframe
            src={svgArtifactUri}
            className="absolute inset-0 w-full h-full border-none"
            title={tokenName}
            sandbox="allow-scripts"
          />
        )
      }

      // Preview mode fallback for SVG-JS without minted artifact URI.
      if (ViewerComponent && seed) {
        return (
          <ViewerComponent
            generator={generator}
            seed={seed}
            iteration={iteration}
            className="absolute inset-0"
          />
        )
      }

      // Fallback: still loading or no artifactUri
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    // For generic-web, use the viewer component with seed
    if (isLoadingSeed) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    if (ViewerComponent && seed) {
      return (
        <ViewerComponent
          generator={generator}
          seed={seed}
          iteration={iteration}
          className="absolute inset-0"
        />
      )
    }

    return (
      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
        Loading artwork...
      </div>
    )
  }

  return (
    <>
      {/* Full-screen confetti overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[55] overflow-hidden">
          {confettiBits.map((bit) => (
            <span
              key={bit.id}
              className="absolute animate-confetti font-mono font-semibold"
              style={bit.style}
            >
              {bit.char}
            </span>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent forceMount className="sm:max-w-md z-[60]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-500" />
              Mint Successful!
            </DialogTitle>
            <DialogDescription className="sr-only">
              Preview and sharing options for your newly minted token.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Artwork Preview */}
            <div className="aspect-square bg-black border relative overflow-hidden">
              {renderPreview()}
            </div>

            {/* Token Info */}
            <div className="text-center">
              <h3 className="font-bold text-lg">
                {tokenName}
                {isPreview && <span className="text-muted-foreground"> (Preview)</span>}
              </h3>
              <p className="text-muted-foreground text-sm">by {displayAuthor}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {isPreview ? (
                <Button onClick={onClose} className="w-full">
                  Close Preview
                </Button>
              ) : (
                <>
                  <Button onClick={handleShareOnX} variant="outline" className="w-full">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share on 𝕏
                  </Button>

                  <div className="flex gap-2">
                    <Button asChild className="flex-1">
                      <Link to={`/token/${generator.bootloaderId}/${tokenId}`} onClick={onClose}>
                        View Artwork
                      </Link>
                    </Button>

                    <Button asChild variant="outline" className="flex-1">
                      <a
                        href={objktUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on objkt
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confetti animation styles */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translate3d(0, 0, 0) rotate(var(--spin-start));
            opacity: 1;
          }
          5% {
            transform: translate3d(
              calc(var(--burst-x) * 0.24),
              calc(var(--burst-y) * 0.24 + var(--gravity-drop) * 0.0121),
              0
            ) rotate(var(--spin-start));
            opacity: 0.99;
          }
          12% {
            transform: translate3d(
              calc(var(--burst-x) * 0.42),
              calc(var(--burst-y) * 0.42 + var(--gravity-drop) * 0.0625),
              0
            ) rotate(calc(var(--spin-start) + 70deg));
            opacity: 0.97;
          }
          22% {
            transform: translate3d(
              calc(var(--burst-x) * 0.6),
              calc(var(--burst-y) * 0.6 + var(--gravity-drop) * 0.2025),
              0
            ) rotate(calc(var(--spin-start) + 150deg));
            opacity: 0.94;
          }
          40% {
            transform: translate3d(
              calc(var(--burst-x) * 0.78),
              calc(var(--burst-y) * 0.78 + var(--gravity-drop) * 0.4624),
              0
            ) rotate(var(--spin-mid));
            opacity: 0.86;
          }
          64% {
            transform: translate3d(
              calc(var(--burst-x) * 0.9),
              calc(var(--burst-y) * 0.9 + var(--gravity-drop) * 0.7225),
              0
            ) rotate(calc(var(--spin-mid) + 220deg));
            opacity: 0.62;
          }
          100% {
            transform: translate3d(
              var(--burst-x),
              calc(var(--burst-y) + var(--gravity-drop)),
              0
            ) rotate(var(--spin-end));
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti-fall linear forwards;
          will-change: transform, opacity;
        }
      `}</style>
    </>
  )
}
