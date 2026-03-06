import type { ComponentType } from 'react'
import type { BootloaderViewerProps } from '@/types/bootloader'
import type { Generator, Token } from '@/types/generator'

export interface BootloaderGeneratorDetailViewProps {
  generator: Generator
  ViewerComponent: ComponentType<BootloaderViewerProps>
  copied: boolean
  revealModalOpen: boolean
  seed: string
  iteration: number
  onSeedChange: (seed: string) => void
  onReroll: () => void
  onCopyLink: () => void
  mobileView?: 'code' | 'preview'
  onMobileViewChange?: (view: 'code' | 'preview') => void
  editorTheme?: string
  isEditing?: boolean
  code?: string
  onCodeChange?: (value: string) => void
}

export interface BootloaderTokenDetailViewProps {
  token: Token
  generator: Generator
  ViewerComponent: ComponentType<BootloaderViewerProps>
  copied: boolean
  tokenArtifactUrl: string | null
  newVersionPreviewUrl: string | null
  showNewVersionPreview: boolean
  onToggleNewVersionPreview: () => void
  onCopyLink: () => void
  onOpenFullscreen: () => void
  mobileView?: 'code' | 'preview'
  onMobileViewChange?: (view: 'code' | 'preview') => void
  editorTheme?: string
}
