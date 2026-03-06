import Editor from '@monaco-editor/react'
import {
  Check,
  Code,
  ExternalLink,
  Eye,
  Maximize2,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getContractAddressForBootloader, getNetworkConfig } from '@/config'
import type { BootloaderTokenDetailViewProps } from '@/bootloaders/page-types'

export function SvgJsTokenDetailView({
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
  mobileView = 'preview',
  onMobileViewChange,
  editorTheme = 'light',
}: BootloaderTokenDetailViewProps) {
  const config = getNetworkConfig()

  return (
    <>
      <div className="md:hidden flex border-b">
        <button
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors',
            mobileView === 'code'
              ? 'border-b-2 border-foreground text-foreground'
              : 'text-muted-foreground'
          )}
          onClick={() => onMobileViewChange?.('code')}
        >
          <Code className="inline mr-2 h-4 w-4" />
          Code
        </button>
        <button
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors',
            mobileView === 'preview'
              ? 'border-b-2 border-foreground text-foreground'
              : 'text-muted-foreground'
          )}
          onClick={() => onMobileViewChange?.('preview')}
        >
          <Eye className="inline mr-2 h-4 w-4" />
          Preview
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div
          className={`border rounded-md overflow-hidden flex flex-col ${
            mobileView === 'preview' ? 'hidden md:flex' : ''
          }`}
        >
          <div className="h-10 flex items-center px-3 border-b text-sm font-medium flex-shrink-0">
            Code
          </div>
          <div className="flex-1 min-h-[400px] md:min-h-[600px]">
            <Editor
              key={editorTheme}
              height="100%"
              defaultLanguage="javascript"
              value={generator.code}
              theme={editorTheme}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </div>
        </div>

        <div
          className={`flex flex-col ${
            mobileView === 'code' ? 'hidden md:flex' : ''
          }`}
        >
          <div className="border rounded-md overflow-hidden flex-1 flex flex-col">
            <div className="h-10 px-3 border-b text-sm font-medium flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span>Preview</span>
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
            <div className="flex-1 bg-muted/30 relative overflow-hidden min-h-[400px] md:min-h-[600px] flex items-center justify-center">
              <div className="w-full h-full max-w-full max-h-full aspect-square">
                {showNewVersionPreview && newVersionPreviewUrl === 'use-viewer' ? (
                  <ViewerComponent
                    generator={generator}
                    seed={token.seed}
                    iteration={token.iteration}
                    className="w-full h-full"
                  />
                ) : tokenArtifactUrl ? (
                  <iframe
                    src={tokenArtifactUrl}
                    title={`${generator.name} #${token.iteration}`}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts"
                  />
                ) : (
                  <ViewerComponent
                    generator={
                      token.artifactCid ? { ...generator, cid: token.artifactCid } : generator
                    }
                    seed={token.seed}
                    iteration={token.iteration}
                    className="w-full h-full"
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyLink}
              className="h-7"
            >
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="h-7" asChild>
              <a
                href={`${config.objktUrl}/asset/${getContractAddressForBootloader(
                  token.bootloaderId || 'svg-js'
                )}/${token.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                objkt
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
