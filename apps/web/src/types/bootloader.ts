import type { ComponentType } from 'react'
import type { Generator } from './generator'

export type BootloaderId = 'generic-web' | 'svg-js'

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

// Re-export manifest types
export type CaptureMode = 'auto' | 'trigger' | 'manual'
export type CaptureTarget = 'auto' | 'viewport'
export type AnimationMode = 'auto' | 'manual'

export interface CaptureConfig {
  mode?: CaptureMode
  viewPortDimension?: { width: number; height: number }
  delayMs?: number
  target?: CaptureTarget
  selector?: string
}

export interface AnimationConfig {
  mode?: AnimationMode
  duration?: number
  fps?: number
}

export type ParamType = 'boolean' | 'integer' | 'number' | 'string' | 'array' | 'object'

export interface ParamUi {
  widget?: 'checkbox' | 'slider' | 'dropdown' | 'color' | 'text' | 'textarea'
}

export interface ParamDefinition {
  id: string
  type: ParamType
  title?: string
  description?: string
  default?: unknown
  enum?: unknown[]
  enumLabels?: string[]
  ui?: ParamUi
  min?: number
  max?: number
  step?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: 'color' | 'url' | 'textarea'
  items?: ParamDefinition
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  properties?: Record<string, ParamDefinition>
  required?: string[]
}

export interface ParameterSection {
  id?: string
  title?: string
  description?: string
  schema: ParamDefinition[]
}

export interface ParametersConfig {
  schema?: ParamDefinition[]
  sections?: ParameterSection[]
}

export interface BootloaderManifest {
  spec: string
  entry?: string
  capture?: CaptureConfig
  animation?: AnimationConfig
  parameters?: ParametersConfig
}
