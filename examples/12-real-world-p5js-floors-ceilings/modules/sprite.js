import { Canvas2D } from './canvas2d.js';

export class Sprite {
    constructor(img, width, height, displayOptions = false){
        this.img = img;
        this.w = width;
        this.h = height;
        this.Nframes = img.width/this.w;
        this.displayOptions = {
            centered: displayOptions.centered || false,
            rotation:   displayOptions.rotation || 0,
            isReversed: displayOptions.isReversed || false,
            isMirrored: displayOptions.isMirrored || false,
        };
    }

    static async load(url, w, h, displayOptions){
        const sprite = loadImage(url).then(
            (img) => {
                return new Sprite(img, w, h, displayOptions);
            },
            (reason) => {
                console.error(reason); // Error!
            }
        )
        return sprite;
    }

    copy(){
        return new Sprite(this.img, this.w, this.h, this.displayOptions);
    }

    flippedVertically(){
        const w = this.img.width, h = this.img.height;
        const C = new Canvas2D(w, h);
        C.ctx.save();
        C.ctx.translate(0, h);
        C.ctx.scale(1, -1);
        C.ctx.drawImage(this.img, 0, 0, w, h);
        C.ctx.restore();
        return new Sprite(C.canvas, this.w, this.h, this.displayOptions);
    }

    draw(ctx, x, y, f){
        const { w, h, img } = this;
        f = f % this.Nframes;

        ctx.save();
            ctx.translate(x, y);
            ctx.drawImage(img, w*f, 0, w, h, 0, 0, w, h);
        ctx.restore();
    }
}

export async function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`Image load failed: ${url}`));
        img.src = url;
    });
}