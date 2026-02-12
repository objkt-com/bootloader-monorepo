// floors & ceilings
// (c) Kerim Safa <contact@kerimsafa.com> & loackme <loic@loack.me>; all rights reserved

import { Canvas2D } from './modules/canvas2d.js';
import { CanvasWEBGL2 } from './modules/webgl2.js';
import { Random } from './modules/random.js';
import { vertexSource, fragmentSource, getPatternsPeriod } from './modules/shader.js';
import { getTileset } from './sprites/importeHexTiles.js';
import { HexagonalGrid } from './modules/hexagonalGrid.js';
import { exportPNG, exportGIF, download, gif } from './modules/export.js';
import { toggleFullScreen } from './modules/fullscreen.js';

setPerformanceCheck();

const { round, ceil, floor, min, max } = Math;
const map = (v, a, b, c, d) => (d - c) * (v - a) / (b - a) + c;
const query = new URLSearchParams(window.location.search);
const R = new Random($bootloader.rnd);
const D = {
  fps: parseInt(query.get('fps')) || 30,
  totalFrames: parseInt(query.get('frames')) || ($bootloader.isCapture ? 128 : 256),
  frameCount: 0,
  debug: !!parseInt(query.get('debug')),
  verbose : !!parseInt(query.get('verbose')),
  drawBuffer: true,
  exportDensity: parseInt(query.get('exportDensity')) || 1,
  exportMargin: parseInt(query.get('exportMargin')) || 0,
  paused: false,
  togglePause: function() {
    this.paused = !this.paused;
    if (!this.paused) renderLoop();
  }
};

let C, CW;
let hexTiles, hexGrid;

window.addEventListener('DOMContentLoaded', () => {
  setup().then(renderLoop);
});

window.addEventListener('resize', resizeThrottler);

// Bootloader capture handled automatically

async function setup() {
  consoleMessages();
  setParameters();
  setCanvases();
  await setTiles();
  setHexGrid();
  resize(window.innerWidth, window.innerHeight, false);
  mouse();
  keyboard();

  document.dispatchEvent(new Event('setupDone'));

  function setParameters(){
    D.setDim = function(w, h){
      if (w % 2 == 1) w++;
      if (h % 2 == 1) h++;
      D.pixelSize = parseInt(query.get('pixelSize')) || max(1, floor(min(w, h) / 450));
      D.W = w / D.pixelSize;
      D.H = h / D.pixelSize;
      return [w, h]
    }
    D.setDim(window.innerWidth, window.innerHeight);
    D.scrolling = R.rb(0.5);
    if (D.scrolling) {
      D.scrollPeriod = R.randomPick([60, 90, 120]);
    }
    D.baseScaling = R.randomPick([2, 3, 4], [3, 3, 1]);
    D.NX = parseInt(query.get('x')) ||
      (!D.scrolling
      ? max(3, ceil(R.randomUniform(6,14) / D.baseScaling))
      : max(3, ceil(R.randomUniform(6,28) / D.baseScaling))
      );
    D.NY = parseInt(query.get('y')) ||
      (!D.scrolling
      ? max(3, ceil(R.randomUniform(6,14) / D.baseScaling))
      : round(D.H / D.baseScaling / 30) + 4
      );

    $bootloader.setFeatures({
      'structure': D.scrolling ? 'scrolling' : 'static',
    });

    if (D.verbose) console.table(D);
    window.D = D;
  }

  function setCanvases() {
    C = new Canvas2D(D.W, D.H);
    C.noSmooth();
    if (D.debug) C.appendTo(document.body);
    CW = new CanvasWEBGL2(window.innerWidth, window.innerHeight, {preserveDrawingBuffer: true});
    CW.canvas.setAttribute('id', 'mainCanvas');
    CW.setShader(vertexSource, fragmentSource(R, D.scrolling));
    CW.createTexture('uTexture');
    CW.appendTo(document.body);
    if (D.verbose) console.log('Period:', getPatternsPeriod());
    if (!D.scrolling) D.totalFrames = getPatternsPeriod();
  }

  async function setTiles() {
    const type = D.scrolling ? (R.rb(0.5) ? 'bottom-up' : 'top-down') : 'dual-perspective';
    hexTiles = await getTileset(type, D.verbose);

    hexTiles.forEach(t => {
      t.setWeight(R.randomUniform(1, 5));
    });

    const isBig = D.NX > 3 && D.NY > 3;
    if (isBig) {
      const flatFactor = R.randomPick([0, 2, D.scrolling ? 5 : 0], [4, 2, 1]);
      if (D.verbose) console.log('Flat factor:', flatFactor)
      if (flatFactor > 0) {
        hexTiles.forEach(t => {
          if (t.edges.N === '00' && t.edges.S === '00') {
            t.adjustWeight(flatFactor);
          }
        });
      }
    }

    const weights = [.1, 1, 5, 10];
    if (isBig) weights.push(30);
    const w0 = R.randomPick(weights);
    hexTiles[0].setWeight(w0);
    if (D.verbose) console.log('Weight 0:', w0);
  }

  function setHexGrid() {
    const { tileWidth, tileHeight, dx, dy } = hexTiles;
    let attempts = 0, maxAttempts = 10000;
    while (attempts++ < maxAttempts) {
      hexGrid = new HexagonalGrid(D.NX, D.NY, tileWidth, tileHeight, dx, dy, D.scrolling);
      let ok;
      if (D.scrolling) {
        ok = hexGrid.fill(hexTiles, R, 0, D.NY);
      } else {
        ok = hexGrid.wfc(hexTiles, R);
      }
      if (ok && [...hexGrid.grid.values()].filter(t => t.sprite).length > 3)
        break;
    }
    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate a valid hex grid after many attempts.");
    }
    window.hexGrid = hexGrid;
  }

  function consoleMessages() {
    const about = `
floors & ceilings
(c) Kerim Safa <contact@kerimsafa.com> & 
    loackme <loic@loack.me>;
    all rights reserved

`;
    const controls = `
Controls
SPACE/click — pause/play
G — GIF export
S — PNG export
F — fullscreen

`;
    console.log(about);
    console.log(controls);
  }
}


function draw() {
  if (D.scrolling){
    if (D.frameCount % D.scrollPeriod == 0) {
        hexGrid.update(hexTiles, R);
    }
  }

  if (D.drawBuffer) {
    updateBuffer(C);
    D.drawBuffer = D.scrolling;
    if (C.canvas.width > 0 && C.canvas.height > 0) {
      CW.updateTexture('uTexture', C.canvas);
    }
  }

  CW.setUniform('uTime', D.frameCount);
  CW.render();

  // Capture using bootloader after a few frames
  if ($bootloader.isCapture && D.frameCount === 30) {
    $bootloader.capture();
  }

  if (D.verbose && D.frameCount == 0) console.log('First render done');
}

function updateBuffer(C) {
    const s = D.baseScaling;
    const offset = hexGrid.getOffset();
    const scrollY = D.scrolling ? map(D.frameCount % D.scrollPeriod, 0, D.scrollPeriod, 0, hexGrid.dy) : 0;
    C.ctx.fillStyle = "#000000";
    C.ctx.fillRect(0, 0, D.W, D.H);
    C.ctx.save();
    C.noSmooth();
    C.ctx.translate(
      round(D.W / 2 - s * offset.w / 2),
      round(D.H / 2 - s * offset.h / 2 - s * scrollY)
    );
    C.ctx.scale(s, s);
    hexGrid.draw(C.ctx, D.frameCount);
    C.ctx.restore();
}

async function renderLoop() {
  let lastTime = performance.now();
  const interval = 1000 / D.fps;
  while (true) {
    await new Promise(requestAnimationFrame);
    const now = performance.now();
    if (now - lastTime >= interval) {
        lastTime = now;
        if (!D.paused) {
            draw();
            if (gif) gif.handling(D.totalFrames, D.fps);
            D.frameCount++;
        } else {
          break;
        }
    }
  }
}

let resizeTimeout;
function resizeThrottler() {
  if (!resizeTimeout) {
    resizeTimeout = setTimeout(() => {
      resizeTimeout = null;
      resize(window.innerWidth, window.innerHeight);
    }, 100);
  }
}

function resize(w, h, redraw = true) {
  [w, h] = D.setDim(w, h);
  C.canvas.width = D.W;
  C.canvas.height = D.H;
  CW.canvas.width = w;
  CW.canvas.height = h;
  CW.setUniform('uResolution', [D.W, D.H]);
  CW.setUniform('uPixelSize', D.pixelSize);
  if (D.scrolling) {
    const requiredRows = round(D.H / (D.baseScaling * 30)) + 4;
    if (hexGrid.height < requiredRows) {
      const rowsToAdd = requiredRows - hexGrid.height;
      hexGrid.addRows(rowsToAdd, hexTiles, R);
    }
  }

  const pixelRatio = window.devicePixelRatio || 1;
  if (floor(pixelRatio) === pixelRatio) {
    CW.canvas.classList.add('pixelated');
  } else {
    CW.canvas.classList.remove('pixelated');
  }

  D.drawBuffer = true;
  if (redraw) draw();
}

function mouse(){
  document.addEventListener('mousedown', mousedown);

  function mousedown(){
    D.togglePause();
  }
}

function keyboard(){
  const keys = [];

  document.addEventListener('keydown', keyDownHandler);
  document.addEventListener('keyup', keyUpHandler);

  function keyDownHandler(e) {
    if (!e.repeat) {
      keys.push(e.key);
      switch (keys.join('').toUpperCase()){
          case ' ': D.togglePause(); break;
          case 'G': if (D.paused) D.togglePause();
            exportGIF(
              CW.canvas,
              blob => download(URL.createObjectURL(blob), `floors_and_ceilings_${$bootloader.hash}.gif`)
            ); break;
          case 'S': exportPNG(
              CW.canvas,
              D.exportDensity,
              D.exportMargin,
              url => download(url, `floors_and_ceilings_${$bootloader.hash}.png`)
            ); break;
          case 'F': case 'ESCAPE': toggleFullScreen(); break;
          case String.fromCharCode(67, 82, 84): DSU(); break;
          default:
      }
    }
  }

  function keyUpHandler() {
    keys.splice(0, keys.length);
  }

  function DSU(){
    let overlay = document.querySelector('.dsu');
    if (!overlay){
      overlay = document.createElement('div');
      overlay.classList.add('overlay', 'dsu');
      overlay.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.target.remove();
      });
      document.body.appendChild(overlay);
    } else {
      overlay.remove();
    }
  }
}

function setPerformanceCheck(){
  let beginTime = Date.now();
  document.addEventListener('setupDone', () => {
    let time = (Date.now() - beginTime) / 1000;
    if (D.verbose) console.log(`Setup done in ${time}s!`);
  });
}
