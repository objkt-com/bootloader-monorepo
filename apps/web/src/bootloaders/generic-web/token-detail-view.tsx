import {
  Check,
  ExternalLink,
  Eye,
  Maximize2,
  Share2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getContractAddressForBootloader, getNetworkConfig } from '@/config'
import type { BootloaderTokenDetailViewProps } from '@/bootloaders/page-types'

export function GenericWebTokenDetailView({
  token,
  generator,
  ViewerComponent,
  copied,
  tokenArtifactUrl,
  newVersionPreviewUrl,
  showNewVersionPreview,
  onToggleNewVersionPreview,
  onCopyLink,
  onOpenFullscreen,
}: BootloaderTokenDetailViewProps) {
  const config = getNetworkConfig()

  return (
    <div className="mb-8">
      <div className="border rounded-md overflow-hidden">
        <div className="h-10 px-3 border-b text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Artwork</span>
            {newVersionPreviewUrl && (
              <Badge
                variant={showNewVersionPreview ? 'default' : 'secondary'}
                className="text-xs"
              >
                {showNewVersionPreview
                  ? `v${generator.version} Preview`
                  : `v${token.version ?? 1}`}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {newVersionPreviewUrl && (
              <Button
                variant={showNewVersionPreview ? 'default' : 'outline'}
                size="sm"
                onClick={onToggleNewVersionPreview}
                className="h-7 px-2 text-xs"
                title={
                  showNewVersionPreview
                    ? 'View current version'
                    : 'Preview new version'
                }
              >
                <Eye className="h-3 w-3 mr-1" />
                {showNewVersionPreview ? 'Current' : `Preview v${generator.version}`}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenFullscreen}
              className="h-7 px-2"
              title="View fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="aspect-square md:aspect-[16/9] bg-black relative overflow-hidden">
          {showNewVersionPreview && newVersionPreviewUrl ? (
            <iframe
              src={newVersionPreviewUrl}
              title={`${generator.name} #${token.iteration} - v${generator.version} Preview`}
              className="absolute inset-0 w-full h-full border-0"
              sandbox="allow-scripts"
            />
          ) : tokenArtifactUrl ? (
            <iframe
              src={tokenArtifactUrl}
              title={`${generator.name} #${token.iteration}`}
              className="absolute inset-0 w-full h-full border-0"
              sandbox="allow-scripts"
            />
          ) : (
            <ViewerComponent
              generator={
                token.artifactCid ? { ...generator, cid: token.artifactCid } : generator
              }
              seed={token.seed}
              iteration={token.iteration}
              className="absolute inset-0"
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <Button variant="ghost" size="sm" onClick={onCopyLink}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Share2 className="mr-2 h-4 w-4" />
          )}
          {copied ? 'Copied!' : 'Share'}
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" asChild>
          <a
            href={`${config.objktUrl}/asset/${getContractAddressForBootloader(
              token.bootloaderId || 'svg-js'
            )}/${token.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on objkt
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}
