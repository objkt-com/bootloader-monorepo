import { Link } from 'react-router-dom'
import { HardDrive, Cloud } from 'lucide-react'
import type { Bootloader } from '@/types/bootloader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface BootloaderCardProps {
  bootloader: Bootloader
  className?: string
}

export function BootloaderCard({ bootloader, className }: BootloaderCardProps) {
  const isComingSoon = bootloader.status === 'coming-soon'

  return (
    <Link
      to={isComingSoon ? '#' : `/bootloaders/${bootloader.id}`}
      className={cn(isComingSoon && 'cursor-not-allowed', className)}
    >
      <Card
        className={cn(
          'h-full transition-colors',
          isComingSoon ? 'opacity-60' : 'hover:bg-accent',
          className
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{bootloader.name}</CardTitle>
            {isComingSoon && (
              <Badge variant="outline" className="text-xs">
                Coming Soon
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs font-mono text-muted-foreground">
            {bootloader.spec}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {bootloader.description}
          </p>

          {/* Constraints chips */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              {bootloader.features.storageType === 'onchain' ? (
                <><HardDrive className="h-3 w-3 mr-1" />On-chain</>
              ) : bootloader.features.storageType === 'ipfs' ? (
                <><Cloud className="h-3 w-3 mr-1" />IPFS</>
              ) : (
                <>Hybrid</>
              )}
            </Badge>
            {bootloader.constraints.resolution && (
              <Badge variant="secondary" className="text-xs">
                {bootloader.constraints.resolution.width}x{bootloader.constraints.resolution.height}
              </Badge>
            )}
            {bootloader.constraints.palette && (
              <Badge variant="secondary" className="text-xs">
                {bootloader.constraints.palette.length}-color
              </Badge>
            )}
            {bootloader.features.hasParameterSupport && (
              <Badge variant="secondary" className="text-xs">
                Parameters
              </Badge>
            )}
            {bootloader.features.hasHardwareSupport && (
              <Badge variant="secondary" className="text-xs">
                Hardware
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
