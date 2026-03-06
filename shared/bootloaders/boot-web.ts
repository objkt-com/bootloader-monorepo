export const BOOT_WEB_SPEC = "boot:web@1.0.0";
export const BOOT_WEB_DEFAULT_ENTRY = "index.html";
export const BOOT_WEB_DEFAULT_CAPTURE_WIDTH = 800;
export const BOOT_WEB_DEFAULT_CAPTURE_HEIGHT = 800;
export const BOOT_WEB_DEFAULT_CAPTURE_DELAY_MS = 5000;
export const BOOT_WEB_DEFAULT_ANIMATION_DURATION_MS = 5000;
export const BOOT_WEB_DEFAULT_ANIMATION_FPS = 30;

export type BootWebCaptureMode = "auto" | "trigger";
export type BootWebCaptureTarget = "auto" | "viewport";

export interface BootWebCaptureConfig {
  mode?: BootWebCaptureMode;
  viewPortDimension?: { width: number; height: number };
  delayMs?: number;
  target?: BootWebCaptureTarget;
  selector?: string;
}

export interface BootWebAnimationConfig {
  duration?: number;
  fps?: number;
}

export type BootWebParamType =
  | "boolean"
  | "integer"
  | "number"
  | "string"
  | "array"
  | "object";

export interface BootWebParamUi {
  widget?: "checkbox" | "slider" | "dropdown" | "color" | "text" | "textarea";
}

export interface BootWebParamDefinition {
  id: string;
  type: BootWebParamType;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  enumLabels?: string[];
  ui?: BootWebParamUi;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: "color" | "url" | "textarea";
  items?: BootWebParamDefinition;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  properties?: Record<string, BootWebParamDefinition>;
  required?: string[];
}

export interface BootWebParameterSection {
  id?: string;
  title?: string;
  description?: string;
  schema: BootWebParamDefinition[];
}

export interface BootWebParametersConfig {
  schema?: BootWebParamDefinition[];
  sections?: BootWebParameterSection[];
}

export interface BootWebManifest {
  spec: string;
  entry?: string;
  capture?: BootWebCaptureConfig;
  animation?: BootWebAnimationConfig;
  parameters?: BootWebParametersConfig;
}

export interface ResolvedBootWebCaptureConfig {
  mode: BootWebCaptureMode;
  width: number;
  height: number;
  delayMs: number;
  target: BootWebCaptureTarget;
  selector: string | null;
}

export interface ResolvedBootWebAnimationConfig {
  durationMs: number;
  fps: number;
}

export interface ResolvedBootWebManifest {
  spec: typeof BOOT_WEB_SPEC;
  entry: string;
  capture: ResolvedBootWebCaptureConfig;
  animation: ResolvedBootWebAnimationConfig | null;
  parameters?: BootWebParametersConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function validateBootWebManifest(raw: unknown): BootWebManifest {
  if (!isRecord(raw)) {
    throw new Error("Manifest must be a JSON object");
  }

  const manifest = raw as Partial<BootWebManifest>;
  if (manifest.spec !== BOOT_WEB_SPEC) {
    throw new Error(`Manifest spec must be "${BOOT_WEB_SPEC}"`);
  }

  if (
    Object.prototype.hasOwnProperty.call(manifest, "entry") &&
    manifest.entry !== undefined &&
    manifest.entry !== BOOT_WEB_DEFAULT_ENTRY
  ) {
    throw new Error(
      `Manifest entry must be "${BOOT_WEB_DEFAULT_ENTRY}" when provided`
    );
  }

  return manifest as BootWebManifest;
}

export function parseBootWebManifest(text: string): BootWebManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("manifest.json must contain valid JSON");
  }

  return validateBootWebManifest(raw);
}

export function parseBootWebManifestBytes(content: Uint8Array): BootWebManifest {
  return parseBootWebManifest(new TextDecoder().decode(content));
}

export function getBootWebEntry(
  manifest?: BootWebManifest | null
): typeof BOOT_WEB_DEFAULT_ENTRY {
  return manifest?.entry === BOOT_WEB_DEFAULT_ENTRY
    ? BOOT_WEB_DEFAULT_ENTRY
    : BOOT_WEB_DEFAULT_ENTRY;
}

export function resolveBootWebCaptureConfig(
  config?: BootWebCaptureConfig | null
): ResolvedBootWebCaptureConfig {
  return {
    mode: config?.mode === "trigger" ? "trigger" : "auto",
    width: clampInt(
      Number(config?.viewPortDimension?.width ?? BOOT_WEB_DEFAULT_CAPTURE_WIDTH),
      1,
      8192
    ),
    height: clampInt(
      Number(
        config?.viewPortDimension?.height ?? BOOT_WEB_DEFAULT_CAPTURE_HEIGHT
      ),
      1,
      8192
    ),
    delayMs: Number.isFinite(config?.delayMs)
      ? Math.max(0, Number(config?.delayMs))
      : BOOT_WEB_DEFAULT_CAPTURE_DELAY_MS,
    target: config?.target === "viewport" ? "viewport" : "auto",
    selector:
      typeof config?.selector === "string" && config.selector.length > 0
        ? config.selector
        : null,
  };
}

export function resolveBootWebAnimationConfig(
  config?: BootWebAnimationConfig | null
): ResolvedBootWebAnimationConfig | null {
  if (!config) {
    return null;
  }

  return {
    durationMs: Number.isFinite(config.duration)
      ? Math.max(100, Number(config.duration))
      : BOOT_WEB_DEFAULT_ANIMATION_DURATION_MS,
    fps: Number.isFinite(config.fps)
      ? Math.max(1, Number(config.fps))
      : BOOT_WEB_DEFAULT_ANIMATION_FPS,
  };
}

export function resolveBootWebManifest(
  manifest?: BootWebManifest | null
): ResolvedBootWebManifest {
  return {
    spec: BOOT_WEB_SPEC,
    entry: getBootWebEntry(manifest),
    capture: resolveBootWebCaptureConfig(manifest?.capture),
    animation: resolveBootWebAnimationConfig(manifest?.animation),
    parameters: manifest?.parameters,
  };
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function resolveBootWebParamDefaults(
  schema?: BootWebParamDefinition[] | null
): Record<string, unknown> {
  if (!Array.isArray(schema)) {
    return {};
  }

  const defaults: Record<string, unknown> = {};
  for (const def of schema) {
    if (!def || typeof def.id !== "string" || def.default === undefined) {
      continue;
    }
    defaults[def.id] = cloneValue(def.default);
  }
  return defaults;
}

export function mergeBootWebParamValues(
  schema: BootWebParamDefinition[] | undefined | null,
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!overrides || Object.keys(overrides).length === 0) {
    return defaults;
  }

  const merged = { ...defaults };
  const allowedIds = new Set((schema ?? []).map((def) => def.id));

  for (const [key, value] of Object.entries(overrides)) {
    if (allowedIds.size === 0 || allowedIds.has(key)) {
      merged[key] = cloneValue(value);
    }
  }

  return merged;
}

export function normalizeArchivePath(path: string): string | null {
  const parts = path.split(/\\|\//).filter(Boolean);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === "." || part === "") {
      continue;
    }
    if (part === "..") {
      if (stack.length === 0) {
        return null;
      }
      stack.pop();
      continue;
    }
    stack.push(part);
  }

  return stack.join("/");
}

export function detectArchiveRootPrefix(
  paths: string[],
  explicitPrefix?: string | null
): string | null {
  if (!paths.length) {
    return null;
  }

  const cleanedExplicit = explicitPrefix
    ? normalizeArchivePath(explicitPrefix)
    : null;
  if (cleanedExplicit) {
    const explicitWithSlash = `${cleanedExplicit}/`;
    const matches = paths.every(
      (path) => path === cleanedExplicit || path.startsWith(explicitWithSlash)
    );
    return matches ? cleanedExplicit : null;
  }

  const firstSegments = paths.map((path) => path.split("/")[0]).filter(Boolean);
  if (firstSegments.length !== paths.length) {
    return null;
  }
  if (paths.some((path) => !path.includes("/"))) {
    return null;
  }

  const candidate = firstSegments[0];
  if (!candidate || !firstSegments.every((segment) => segment === candidate)) {
    return null;
  }

  return candidate;
}

export function stripArchivePrefix(
  path: string,
  prefix: string | null
): string {
  if (!prefix) {
    return path;
  }

  const prefixWithSlash = `${prefix}/`;
  if (!path.startsWith(prefixWithSlash)) {
    return path;
  }

  return path.slice(prefixWithSlash.length);
}
