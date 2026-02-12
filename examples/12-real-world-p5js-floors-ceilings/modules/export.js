// /!\ Don't forget to load gif.js in index.html 
if (typeof GIF === 'undefined') {
  console.log('GIF.js is not loaded. Please include gif.js in your HTML file.');
}

import { Canvas2D } from "./canvas2d.js";

export let gif = false;

const workerScriptLocation = './gif/gif.worker.js';
const palette = [
    0, 0, 0,
    255, 255, 255
];

document.addEventListener("gifDone", () => {console.log('GIF done!')},false);

export const  download = (url, fileName) => {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
};
  
const createOverlay = (message = false) => {
    const overlay = document.createElement('div');
    overlay.classList.add('overlay', 'gif');
    if (message) overlay.innerHTML = `<p>${message}</p>`;
    overlay.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        overlay.remove();
    });
    return overlay;
};

export function exportPNG(canvas, exportDensity = 1, margin = 0, callback = (url) => url) {
    const d = exportDensity;
    const w = (canvas.width + 2 * margin) * d;
    const h = (canvas.height + 2 * margin) * d;
    const buffer = new Canvas2D(w, h);
    buffer.noSmooth();
    buffer.ctx.fillStyle = '#fff';
    buffer.ctx.fillRect(0, 0, w, h);
    buffer.ctx.scale(d, d);
    buffer.ctx.drawImage(canvas, margin, margin);
    const url = buffer.canvas.toDataURL('image/png');
    return callback(url);
}

export function GIFhandling(Nframes, fps) {
    if (gif && !gif.rendering) {
        if (gif.currentFrame < Nframes) {
            gif.addFrame(gif.canvas, { delay: 1000 / fps | 0, copy: true });
            gif.currentFrame++;
        } else {
            gif.render();
            gif.rendering = true;
        }
      }
}
  
export async function exportGIF(canvas, callback = (blob) => blob) {
    if (gif || document.querySelector('.gif')) return false;
    if (!window.Worker) {
        const overlay = createOverlay("Your browser doesn't support web workers.\nClick to dismiss this message.");
        document.body.appendChild(overlay);
        return false;
    } 
    try {new Worker('<script></script>')} catch (e) { 
        const overlay = createOverlay("Cannot export GIF. Please open in a dedicated window.\nClick to dismiss this message.");
        document.body.appendChild(overlay);
        return false;
    }

    gif = new GIF({
        workers: 4,
        quality: 10,
        width: canvas.width,
        height: canvas.height,
        globalPalette: palette,
        workerScript: workerScriptLocation
    });
    gif.canvas = canvas;
    gif.currentFrame = 0;
    gif.rendering = false;
    gif.handling = (Nframes, fps) => GIFhandling(Nframes, fps);
    gif.overlay = createOverlay("Exporting GIF...");
    document.body.appendChild(gif.overlay);

    return new Promise((resolve) => {
        gif.on('finished', (blob) => {
            resolve(blob);
        });
    }).then((blob) => {
        gif.overlay.remove();
        gif = false;
        document.dispatchEvent(new Event("gifDone"));
        return callback(blob);
    })
}