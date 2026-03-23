/*
  Edit this file only.

  The template is set up in classic p5 global mode, like a normal p5 sketch.
  Local libraries are included in index.html, so the project is self-contained.

  Useful helpers:
    BOOTLOADER.hash      -> stable seed string from ?seed=... or #seed=...
    BOOTLOADER.rnd()  -> deterministic random number in [0, 1)

  Example test URL:
    index.html?s=bootloader-demo-001
*/

let cols = [];
let osc = null;
let audioStarted = false;

function setup() {
  createCanvas(900, 900);
  pixelDensity(1);
  noLoop();

  // Make p5's own random()/noise() deterministic as well.
  randomSeed(hashToInt($bootloader.hash));
  noiseSeed(hashToInt($bootloader.hash + "-noise"));

  cols = makePalette();
}

function draw() {
  background(245);

  const pad = width * 0.08;
  const cells = 14;
  const step = (width - pad * 2) / cells;

  noStroke();
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const px = pad + x * step + step * 0.5;
      const py = pad + y * step + step * 0.5;
      const n = noise(x * 0.18, y * 0.18);
      const d = step * (0.12 + 0.85 * n);
      fill(cols[(x + y) % cols.length]);
      circle(px, py, d);
    }
  }

  stroke(15);
  noFill();
  strokeWeight(2);
  rect(pad, pad, width - pad * 2, height - pad * 2);

  noStroke();
  fill(20);
  textFont("monospace");
  textSize(16);
  text("seed: " + $bootloader.hash, pad, height - pad * 0.35);
  text("click/tap to start a test tone", pad, pad * 0.6);
}

function mousePressed() {
  startOrPingTone();
  redraw();
}

function touchStarted() {
  startOrPingTone();
  redraw();
  return false;
}

async function startOrPingTone() {
  // p5.sound needs a user gesture in many browsers.
  if (!audioStarted) {
    await userStartAudio();
    osc = new p5.Oscillator("sine");
    osc.amp(0);
    osc.start();
    audioStarted = true;
  }

  const freq = map($bootloader.rnd(), 0, 1, 180, 760);
  console.log(freq);
  osc.freq(freq, 0.02);
  osc.amp(0.12, 0.02);
  osc.amp(0, 0.18);
}

function makePalette() {
  const paletteBank = [
    ["#101820", "#f2aa4c", "#ef476f", "#118ab2"],
    ["#0b132b", "#1c2541", "#5bc0be", "#f3f3f3"],
    ["#201e1f", "#ff4000", "#faaa8d", "#feefdd"],
    ["#111111", "#e63946", "#f1faee", "#457b9d"],
    ["#2d3142", "#4f5d75", "#bfc0c0", "#ef8354"],
  ];
  return paletteBank[hashToInt($bootloader.hash) % paletteBank.length];
}

function hashToInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
