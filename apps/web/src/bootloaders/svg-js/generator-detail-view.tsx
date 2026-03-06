import Editor from '@monaco-editor/react'
import { Check, Code, Dices, Eye, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { BootloaderGeneratorDetailViewProps } from '@/bootloaders/page-types'

export function SvgJsGeneratorDetailView({
  generator,
  ViewerComponent,
  copied,
  revealModalOpen,
  seed,
  iteration,
  onSeedChange,
  onReroll,
  onCopyLink,
  mobileView = 'preview',
  onMobileViewChange,
  editorTheme = 'light',
  isEditing = false,
  code = '',
  onCodeChange,
}: BootloaderGeneratorDetailViewProps) {
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
            Code {isEditing && <span className="text-muted-foreground">(editing)</span>}
          </div>
          <div className="flex-1 min-h-[400px] md:min-h-[600px]">
            <Editor
              key={editorTheme}
              height="100%"
              defaultLanguage="javascript"
              value={code}
              onChange={(value) => onCodeChange?.(value || '')}
              theme={editorTheme}
              options={{
                readOnly: !isEditing,
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
              <span>Preview</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReroll}
                className="h-7 px-2"
              >
                <Dices className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 bg-muted/30 relative overflow-hidden min-h-[400px] md:min-h-[600px] flex items-center justify-center">
              <div className="w-full h-full max-w-full max-h-full aspect-square">
                {revealModalOpen ? (
                  <div className="w-full h-full bg-black" />
                ) : (
                  <ViewerComponent
                    generator={isEditing ? { ...generator, code } : generator}
                    seed={seed}
                    iteration={iteration}
                    className="w-full h-full"
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Seed</Label>
              <Input
                value={seed}
                maxLength={32}
                onChange={(event) => onSeedChange(event.target.value)}
                className="w-32 font-mono text-xs h-7"
              />
            </div>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyLink}
              className="h-7"
            >
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
