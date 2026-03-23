import JSZip from "jszip";
import { CONFIG } from "@/config";
import {
  BOOT_WEB_DEFAULT_CAPTURE_HEIGHT,
  BOOT_WEB_DEFAULT_CAPTURE_WIDTH,
  BOOT_WEB_SPEC,
} from "../../../../../shared/bootloaders/boot-web";

const PREVIEW_P5_LIB_URL = "/bootloaders/p5-js/libs/p5.min.js";
const PREVIEW_P5_SOUND_LIB_URL = "/bootloaders/p5-js/libs/p5.sound.min.js";
const PREVIEW_BOOTLOADER_URL = "/snippet/bootloader.js";
const P5_RUNTIME_BRIDGE_FILENAME = "bootloader-p5.js";

const TEMPLATE_STYLE = `html,
body {
  margin: 0;
  padding: 0;
  background: #0f0f14;
  min-height: 100%;
}

canvas {
  display: block;
}`;

function escapeInlineScript(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script");
}

function buildManifestJson(): string {
  return JSON.stringify(
    {
      spec: BOOT_WEB_SPEC,
      entry: "index.html",
      capture: {
        mode: "trigger",
        viewPortDimension: {
          width: BOOT_WEB_DEFAULT_CAPTURE_WIDTH,
          height: BOOT_WEB_DEFAULT_CAPTURE_HEIGHT,
        },
        target: "viewport",
      },
    },
    null,
    2
  );
}

function buildIndexHtml(params: {
  p5LibPath: string;
  p5SoundLibPath: string;
  bootloaderPath: string;
  runtimeBridgePath: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>bootloader: p5.js sketch</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main id="app"></main>
    <script src="${params.p5LibPath}"></script>
    <script src="${params.p5SoundLibPath}"></script>
    <script src="${params.bootloaderPath}"></script>
    <script src="sketch.js"></script>
    <script src="${params.runtimeBridgePath}"></script>
  </body>
</html>`;
}

export const P5_BOOTLOADER_API_SNIPPET = `// bootloader: p5 helpers available inside sketch.js
// random() and noise() are already seeded for you.
// $bootloader.hash       -> stable 64-char seed hex
// $bootloader.rnd()      -> deterministic float in [0, 1)
// $bootloader.iteration  -> edition number
// $bootloader.isCapture  -> true while thumbnail capture is active
// $bootloader.setFeatures({ key: value })
// $bootloader.capture()`;

export const DEFAULT_P5_SKETCH = `/*
  bootloader seeds p5's random() and noise() automatically.
*/

let bg, palette, shapes, pad, active = -1;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  colorMode(HSL, 360, 100, 100, 255);
  noLoop();

  const baseHue = random(360);
  bg = color((baseHue + 210) % 360, 24, 95);
  palette = Array.from({ length: 5 }, (_, i) =>
    color((baseHue + i * random(18, 42)) % 360, random(55, 90), random(42, 70), 220)
  );
  pad = min(width, height) * random(0.08, 0.14);
  shapes = Array.from({ length: floor(random(7, 12)) }, (_, id) => ({
    id,
    kind: random(["circle", "square", "bar"]),
    x: random(0.16, 0.84),
    y: random(0.16, 0.84),
    size: random(0.12, 0.24),
    width: random(0.8, 1.7),
    fill: random(palette),
    freq: random([196, 220, 246.94, 261.63, 293.66, 329.63, 392]) * random([0.75, 1, 1.5, 2]),
  }));

  $bootloader.setFeatures({
    Palette: palette
      .map((c) => {
        const h = round(hue(c));
        const s = round(saturation(c));
        const l = round(lightness(c));
        return "hsl(" + h + " " + s + "% " + l + "%)";
      })
      .join(", "),
    Shapes: shapes.length,
  });
}

function draw() {
  background(bg);
  const box = min(width, height) - pad * 2;
  const ox = (width - box) * 0.5;
  const oy = (height - box) * 0.5;

  noStroke();
  for (let i = 0; i < 3; i++) {
    const c = color(palette[i]);
    c.setAlpha(32 + i * 12);
    fill(c);
    push();
    translate(width * random(0.22, 0.78), height * random(0.2, 0.8));
    rotate(random(-PI * 0.25, PI * 0.25));
    rectMode(CENTER);
    rect(0, 0, random(box * 0.55, box * 0.9), random(box * 0.08, box * 0.16), box * 0.04);
    pop();
  }

  blendMode(MULTIPLY);
  for (const s of shapes) {
    const x = ox + s.x * box;
    const y = oy + s.y * box;
    const size = s.size * box;
    const selected = s.id === active;
    const c = color(s.fill);
    c.setAlpha(selected ? 255 : 220);
    fill(c);
    noStroke();

    if (s.kind === "circle") {
      circle(x, y, size);
    } else if (s.kind === "bar") {
      rectMode(CENTER);
      rect(x, y, size * s.width, size * 0.28, size * 0.08);
    } else {
      rectMode(CENTER);
      rect(x, y, size, size, size * 0.08);
    }

    if (selected) {
      stroke(0, 0, 10);
      strokeWeight(max(2, box * 0.004));
      noFill();
      if (s.kind === "circle") {
        circle(x, y, size * 1.08);
      } else if (s.kind === "bar") {
        rectMode(CENTER);
        rect(x, y, size * s.width * 1.08, size * 0.32, size * 0.1);
      } else {
        rectMode(CENTER);
        rect(x, y, size * 1.08, size * 1.08, size * 0.1);
      }
    }
  }
  blendMode(BLEND);

  noStroke();
  fill(0, 0, 10);
  textFont("monospace");
  textSize(max(14, box * 0.03));
  textAlign(CENTER, CENTER);
  text("click a shape to hear it", width * 0.5, height - pad * 0.55);
  textSize(max(12, box * 0.022));
  text("seed " + $bootloader.hash, width * 0.5, oy - pad * 0.3);

  if ($bootloader.isCapture) {
    $bootloader.capture();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  redraw();
}

function mousePressed() {
  trigger(mouseX, mouseY);
}

function touchStarted() {
  trigger(mouseX, mouseY);
  return false;
}

function trigger(px, py) {
  const box = min(width, height) - pad * 2;
  const ox = (width - box) * 0.5;
  const oy = (height - box) * 0.5;
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    const x = ox + s.x * box;
    const y = oy + s.y * box;
    const size = s.size * box;
    const hit =
      s.kind === "circle"
        ? dist(px, py, x, y) <= size * 0.5
        : s.kind === "bar"
        ? abs(px - x) <= (size * s.width) * 0.5 && abs(py - y) <= size * 0.14
        : abs(px - x) <= size * 0.5 && abs(py - y) <= size * 0.5;

    if (hit) {
      active = s.id;
      playTone(s);
      redraw();
      return;
    }
  }
}

async function playTone(shape) {
  const ctx = getAudioContext();
  if (ctx.state !== "running") {
    await userStartAudio();
    if (ctx.state !== "running" && typeof ctx.resume === "function") {
      await ctx.resume();
    }
  }

  const base = shape.freq;
  const detune = random(-8, 8);
  const wave =
    shape.kind === "circle"
      ? "sine"
      : shape.kind === "bar"
      ? "square"
      : "triangle";

  const osc = new p5.Oscillator();
  osc.setType(wave);
  osc.amp(0);
  osc.start();
  osc.freq(base + detune, 0.02);
  osc.amp(0.18, 0.015);
  osc.amp(0, 0.32);
  window.setTimeout(() => {
    osc.stop();
    osc.dispose?.();
  }, 420);
}`;

const P5_RUNTIME_BRIDGE_SOURCE = `(function () {
  "use strict";

  let applied = false;
  let mathRandomApplied = false;

  function toSeed(hex, start) {
    const value = (hex || "").slice(start, start + 8);
    const parsed = Number.parseInt(value || "1", 16);
    return Number.isFinite(parsed) ? parsed : 1;
  }

  function createDeterministicRandom(hash) {
    let a = toSeed(hash, 0);
    let b = toSeed(hash, 8);
    let c = toSeed(hash, 16);
    let d = toSeed(hash, 24);

    return function () {
      a |= 0;
      b |= 0;
      c |= 0;
      d |= 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  function installMathRandomSeed(hash) {
    if (mathRandomApplied) return;
    mathRandomApplied = true;

    const deterministicRandom = createDeterministicRandom(hash);
    Math.random = function () {
      return deterministicRandom();
    };
  }

  function applySeed() {
    if (applied) return;
    applied = true;

    const hash =
      window.$bootloader && typeof window.$bootloader.hash === "string"
        ? window.$bootloader.hash
        : "0000000100000001";

    installMathRandomSeed(hash);

    if (typeof window.randomSeed === "function") {
      window.randomSeed(toSeed(hash, 0));
    }
    if (typeof window.noiseSeed === "function") {
      window.noiseSeed(toSeed(hash, 8));
    }
  }

  function wrapLifecycle(name) {
    const original = window[name];
    if (typeof original !== "function") return false;

    window[name] = function () {
      applySeed();
      return original.apply(this, arguments);
    };
    return true;
  }

  const wrapped =
    wrapLifecycle("preload") ||
    wrapLifecycle("setup") ||
    wrapLifecycle("draw");

  if (!wrapped && document.readyState === "complete") {
    applySeed();
  } else if (!wrapped) {
    window.addEventListener(
      "load",
      function handleLoad() {
        applySeed();
      },
      { once: true }
    );
  }
})();`;

export const P5_RUNTIME_INFO_TEXT = `bootloader seeds p5's random() and noise()
before setup() runs, so sketches stay deterministic without boilerplate.

Use p5's native random() / noise() normally.
Math.random() is also seeded so library code such as p5.sound noise sources
stays deterministic inside the sketch iframe.

Extra runtime helpers:
- $bootloader.hash: 64-char seed hex
- $bootloader.rnd(): deterministic float generator
- $bootloader.iteration: edition number
- $bootloader.isCapture: true during thumbnail capture
- $bootloader.setFeatures({...}): publish traits
- $bootloader.capture(): signal capture readiness`;

interface TemplateAssets {
  bootloaderSource: string;
  p5LibBytes: ArrayBuffer;
  p5SoundLibBytes: ArrayBuffer;
}

let templateAssetsPromise: Promise<TemplateAssets> | null = null;

async function loadTemplateAssets(): Promise<TemplateAssets> {
  if (!templateAssetsPromise) {
    templateAssetsPromise = (async () => {
      const [bootloaderSource, p5LibBytes, p5SoundLibBytes] = await Promise.all([
        fetch(PREVIEW_BOOTLOADER_URL).then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to load bootloader runtime");
          }
          return response.text();
        }),
        fetch(PREVIEW_P5_LIB_URL).then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to load p5 library");
          }
          return response.arrayBuffer();
        }),
        fetch(PREVIEW_P5_SOUND_LIB_URL).then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to load p5.sound library");
          }
          return response.arrayBuffer();
        }),
      ]);

      return {
        bootloaderSource,
        p5LibBytes,
        p5SoundLibBytes,
      };
    })();
  }

  return templateAssetsPromise;
}

export function buildP5PreviewHtml(params: {
  sketchCode: string;
  seed: string;
  iteration?: number;
  isCapture?: boolean;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>bootloader: p5 preview</title>
    <style>${TEMPLATE_STYLE}</style>
  </head>
  <body>
    <main id="app"></main>
    <script>
      window.__BOOTLOADER_PREVIEW__ = {
        seed: ${JSON.stringify(params.seed)},
        iteration: ${Number.isFinite(params.iteration) ? Math.trunc(params.iteration || 1) : 1},
        isCapture: ${params.isCapture === true ? "true" : "false"},
      };
    </script>
    <script src="${PREVIEW_P5_LIB_URL}"></script>
    <script src="${PREVIEW_P5_SOUND_LIB_URL}"></script>
    <script src="${PREVIEW_BOOTLOADER_URL}"></script>
    <script>${escapeInlineScript(params.sketchCode)}</script>
    <script>${P5_RUNTIME_BRIDGE_SOURCE}</script>
  </body>
</html>`;
}

export async function buildP5TemplateZip(
  sketchCode: string
): Promise<File> {
  const assets = await loadTemplateAssets();
  const zip = new JSZip();

  zip.file(
    "index.html",
    buildIndexHtml({
      p5LibPath: "libs/p5.min.js",
      p5SoundLibPath: "libs/p5.sound.min.js",
      bootloaderPath: "bootloader.js",
      runtimeBridgePath: P5_RUNTIME_BRIDGE_FILENAME,
    })
  );
  zip.file("manifest.json", buildManifestJson());
  zip.file("style.css", TEMPLATE_STYLE);
  zip.file("bootloader.js", assets.bootloaderSource);
  zip.file(P5_RUNTIME_BRIDGE_FILENAME, P5_RUNTIME_BRIDGE_SOURCE);
  zip.file("sketch.js", sketchCode);
  zip.file("libs/p5.min.js", assets.p5LibBytes);
  zip.file("libs/p5.sound.min.js", assets.p5SoundLibBytes);

  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "bootloader-p5-template.zip", {
    type: "application/zip",
  });
}

export async function fetchP5SketchSource(cid: string): Promise<string> {
  const normalizedCid = cid.startsWith("ipfs://") ? cid.slice(7) : cid;
  const response = await fetch(`${CONFIG.sandboxWorkerUrl}/ipfs/${normalizedCid}/sketch.js`);
  if (!response.ok) {
    throw new Error("Failed to load sketch.js from the published artifact");
  }
  return response.text();
}
