export class Canvas2D {
    constructor(width = 100, height = 100, options = {}) {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', options);
        this.canvas.width = width;
        this.canvas.height = height;
    }

    getContext() {
        return this.ctx;
    }

    getCanvas() {
        return this.canvas;
    }

    appendTo(elt) {
        elt.appendChild(this.canvas);
    }

    noSmooth() {
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
        this.ctx.imageSmoothingEnabled = false;
    }
}