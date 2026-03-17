import { Check, Dices, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BootloaderGeneratorDetailViewProps } from '@/bootloaders/page-types'
import { GENERIC_WEB_SEED_HEX_LENGTH } from '../../../../../shared/bootloaders/seed-hex'

export function GenericWebGeneratorDetailView({
  generator,
  ViewerComponent,
  copied,
  revealModalOpen,
  seed,
  iteration,
  onSeedChange,
  onReroll,
  onCopyLink,
}: BootloaderGeneratorDetailViewProps) {
  return (
    <div className="mb-8">
      <div className="w-full aspect-square md:aspect-[16/9] bg-black border relative overflow-hidden">
        {revealModalOpen ? (
          <div className="absolute inset-0 bg-black" />
        ) : (
          <ViewerComponent
            generator={generator}
            seed={seed}
            iteration={iteration}
            className="absolute inset-0"
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <Button variant="outline" size="sm" onClick={onReroll}>
          <Dices className="mr-2 h-4 w-4" />
          Random Seed
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <Label className="text-xs shrink-0">Seed</Label>
          <Input
            value={seed}
            maxLength={GENERIC_WEB_SEED_HEX_LENGTH}
            onChange={(event) => onSeedChange(event.target.value)}
            className="w-48 sm:w-80 font-mono text-xs h-8"
          />
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onCopyLink}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Share2 className="mr-2 h-4 w-4" />
          )}
          {copied ? 'Copied!' : 'Share'}
        </Button>
      </div>
    </div>
  )
}
