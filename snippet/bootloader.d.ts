/**
 * Bootloader 1.0.0 TypeScript Definitions
 */

// ---------------------------------------------
// Manifest definitions
// ---------------------------------------------

export type BootloaderCaptureMode = 'auto' | 'trigger';
export type BootloaderCaptureTarget = 'auto' | 'viewport';

export interface BootloaderViewPortDimension {
  width: number;
  height: number;
}

export interface BootloaderCaptureConfig {
  mode?: BootloaderCaptureMode;
  viewPortDimension?: BootloaderViewPortDimension;
  delayMs?: number;
  target?: BootloaderCaptureTarget;
  selector?: string;
}

export interface BootloaderAnimationConfig {
  duration: number;
  fps: number;
}

export interface BootloaderManifest {
  spec: 'boot:web@1.0.0';
  entry: string;
  capture?: BootloaderCaptureConfig;
  animation?: BootloaderAnimationConfig;
}

// ---------------------------------------------
// Runtime API
// ---------------------------------------------

export type BootloaderFeatures = Record<string, unknown>;

export interface BootloaderRng {
  (): number;
  reset(): void;
}

export interface Bootloader {
  version: string;
  hash: string;
  rnd: BootloaderRng;
  iteration: number;
  isCapture: boolean;

  setFeatures(features: BootloaderFeatures | null | undefined): void;
  capture(): void;

  /** @internal */
  _captured: boolean;
}

export type BootloaderMessageId =
  | 'bootloader:ready'
  | 'bootloader:capture'
  | 'bootloader:features';

export interface BootloaderMessage<TData = unknown> {
  id: BootloaderMessageId;
  data: TData;
  timestamp: number;
}

// ---------------------------------------------
// Globals
// ---------------------------------------------

declare global {
  const $bootloader: Bootloader;

  interface Window {
    $bootloader: Bootloader;
  }
}

export {};
