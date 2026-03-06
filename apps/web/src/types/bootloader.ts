import type { ComponentType } from 'react'
import type { Generator } from './generator'
import type {
  BootWebAnimationConfig,
  BootWebCaptureConfig,
  BootWebCaptureMode,
  BootWebCaptureTarget,
  BootWebManifest,
  BootWebParamDefinition,
  BootWebParameterSection,
  BootWebParametersConfig,
  BootWebParamType,
  BootWebParamUi,
} from '../../../../shared/bootloaders/boot-web'
import type { SharedBootloaderId } from '../../../../shared/bootloaders/catalog'

export type BootloaderId = SharedBootloaderId

export type PreviewType = 'iframe' | 'emulator' | 'svg'

export type StorageType = 'onchain' | 'ipfs' | 'hybrid'

export interface BootloaderConstraints {
  /** Resolution constraints */
  resolution?: { width: number; height: number }
  /** Color palette (e.g., DMG 4-color palette) */
  palette?: string[]
  /** Maximum file/ROM size in bytes */
  maxSize?: number
  /** Supported output formats */
  formats?: string[]
}

export interface BootloaderFeatures {
  /** Shows Monaco code editor in create view */
  hasCodeEditor: boolean
  /** Supports parameter schema */
  hasParameterSupport: boolean
  /** Allows zip file upload */
  hasZipUpload: boolean
  /** Can run on physical hardware */
  hasHardwareSupport: boolean
  /** Type of preview rendering */
  previewType: PreviewType
  /** Where the artwork data is stored */
  storageType: StorageType
}

export interface BootloaderViewerProps {
  /** Generator data */
  generator: Generator
  /** Current seed for deterministic output */
  seed: string
  /** Current iteration number */
  iteration?: number
  /** Parameter values */
  params?: Record<string, unknown>
  /** Signals capture mode for runtimes that need to adjust output */
  isCapture?: boolean
  /** Callback when preview is ready */
  onReady?: () => void
  /** Callback when preview errors */
  onError?: (error: Error) => void
  /** Additional className */
  className?: string
}

export interface BootloaderCreatorProps {
  /** Bootloader configuration */
  bootloader: Bootloader
  /** Callback when generator is ready to save/mint */
  onSave?: (data: CreatorSaveData) => void
  /** Callback for preview updates */
  onPreviewUpdate?: (previewUrl: string) => void
  /** Additional className */
  className?: string
}

export interface CreatorSaveData {
  name: string
  description?: string
  /** For svg-js: inline code */
  code?: string
  /** For generic-web: IPFS CID */
  cid?: string
  /** Manifest for generic-web */
  manifest?: BootloaderManifest
  /** Thumbnail data URL or URL */
  thumbnail?: string
}

export interface Bootloader {
  /** Unique identifier */
  id: BootloaderId
  /** Current runtime/protocol version */
  currentVersion: string
  /** Spec version string (e.g., 'boot:web@1.0.0') */
  spec: string
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Long description for detail page */
  longDescription?: string
  /** Constraint configuration */
  constraints: BootloaderConstraints
  /** Feature flags */
  features: BootloaderFeatures
  /** Component for viewing/previewing generators */
  ViewerComponent: ComponentType<BootloaderViewerProps>
  /** Component for creating generators */
  CreatorComponent: ComponentType<BootloaderCreatorProps>
  /** Icon component or emoji */
  icon?: string
  /** Status: active, coming-soon, deprecated */
  status: 'active' | 'coming-soon' | 'deprecated'
}

export type CaptureMode = BootWebCaptureMode
export type CaptureTarget = BootWebCaptureTarget
export type CaptureConfig = BootWebCaptureConfig
export type AnimationConfig = BootWebAnimationConfig
export type ParamType = BootWebParamType
export type ParamUi = BootWebParamUi
export type ParamDefinition = BootWebParamDefinition
export type ParameterSection = BootWebParameterSection
export type ParametersConfig = BootWebParametersConfig
export type BootloaderManifest = BootWebManifest
