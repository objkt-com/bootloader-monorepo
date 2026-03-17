import { CAREncoderStream, createDirectoryEncoderStream } from 'ipfs-car';
import { generateGenericWebSeedHex } from '../../shared/bootloaders/seed-hex';

type UnixFsBlock = {
  cid: {
    bytes: Uint8Array;
    toV1: () => { toString: () => string };
  };
  bytes: Uint8Array;
};

const MIME_OVERRIDES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

export function guessContentType(path: string): string {
  const match = /\.([^.]+)$/.exec(path);
  if (!match) return 'application/octet-stream';
  const ext = `.${match[1].toLowerCase()}`;
  return MIME_OVERRIDES[ext] ?? 'application/octet-stream';
}

export async function calculateDirectoryCid(files: { path: string; content: Uint8Array }[]): Promise<string> {
  const built = await buildDirectoryCar(files);
  return built.cid;
}

export async function buildDirectoryCar(
  files: { path: string; content: Uint8Array }[]
): Promise<{ cid: string; car: Uint8Array }> {
  if (!files.length) throw new Error('No files provided');

  const carFiles = files.map((file) => ({
    name: file.path,
    stream: () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(file.content);
          controller.close();
        },
      }),
  }));

  const blockReader = createDirectoryEncoderStream(carFiles).getReader();
  const blocks: UnixFsBlock[] = [];

  while (true) {
    const { done, value } = await blockReader.read();
    if (done) break;
    if (value) {
      blocks.push(value as UnixFsBlock);
    }
  }

  const rootBlock = blocks[blocks.length - 1];
  if (!rootBlock?.cid) {
    throw new Error('Failed to calculate directory root CID');
  }

  // Encode CAR after the root CID is known so header roots are correct.
  const blockStream = new ReadableStream<UnixFsBlock>({
    start(controller) {
      for (const block of blocks) {
        controller.enqueue(block);
      }
      controller.close();
    },
  });

  const reader = blockStream
    .pipeThrough(new CAREncoderStream([rootBlock.cid as any]))
    .getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLength += value.length;
    }
  }

  const car = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    car.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    cid: rootBlock.cid.toV1().toString(),
    car,
  };
}

export function randomSeed(): string {
  return generateGenericWebSeedHex();
}

export function decodeBase64(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function clampInt(value: number, min: number, max: number): number {
  const normalized = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, normalized));
}
