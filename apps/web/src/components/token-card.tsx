import { Link } from 'react-router-dom'
import { Link2, Cloud } from 'lucide-react'
import type { Token } from '@/types/generator'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getTokenThumbnailUrl } from '@/config'
import { getBootloader } from '@/lib/bootloader-registry'

interface TokenCardProps {
  token: Token
  className?: string
}

// Storage type badge component - exported for use in other cards
export function StorageBadge({ bootloaderId, className }: { bootloaderId: string; className?: string }) {
  const bootloader = getBootloader(bootloaderId as 'svg-js' | 'generic-web')
  if (!bootloader) return null

  const isOnchain = bootloader.features.storageType === 'onchain'

  return (
    <div
      className={cn(
        'absolute top-2 right-2 p-1 bg-background/80 backdrop-blur-sm border',
        className
      )}
      title={isOnchain ? 'Fully on-chain' : 'Stored on IPFS'}
    >
      {isOnchain ? (
        <Link2 className="h-3 w-3" />
      ) : (
        <Cloud className="h-3 w-3" />
      )}
    </div>
  )
}

export function TokenCard({ token, className }: TokenCardProps) {
  // Use thumbnail from media CDN - token thumbnails use /{bootloader}/v1/thumbnail/{tokenId}
  const thumbnailUrl = token.thumbnailUrl || getTokenThumbnailUrl(token.id, token.version, token.bootloaderId)

  // Display name: generator name + iteration, or just Token #id
  const displayName = token.generator?.name
    ? `${token.generator.name} #${token.iteration}`
    : `#${token.iteration || token.id}`

  return (
    <Link to={`/token/${token.bootloaderId}/${token.id}`}>
      <Card className={cn('h-full overflow-hidden transition-colors hover:bg-accent', className)}>
        <div className="aspect-square bg-muted relative overflow-hidden">
          <img
            src={thumbnailUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Hide broken image icon
              e.currentTarget.style.display = 'none'
            }}
          />
          <StorageBadge bootloaderId={token.bootloaderId} />
        </div>
        <CardContent className="p-3">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {token.ownerName || token.owner.slice(0, 8) + '...'}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function TokenCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('h-full overflow-hidden', className)}>
      <Skeleton className="aspect-square" />
      <CardContent className="p-3">
        <Skeleton className="h-4 w-12 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
}
