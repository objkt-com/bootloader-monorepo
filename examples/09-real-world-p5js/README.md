# Real-World p5.js Example: "Returns" by Aleksandra Jovanic

This example demonstrates how to integrate a real-world, production-grade generative artwork with the bootloader system without modifying the artist's code.

## About the Artwork

**"Returns"** is a complex p5.js artwork (1410 lines) that:
- Uses advanced p5.js features and custom rendering
- Originally built for objkt.com using objkt.js API
- Includes animation capabilities
- Exports both static PNG and animated GIF formats
- Has sophisticated layout and text rendering systems

## Integration Approach

Instead of rewriting the artist's code, we created a **compatibility layer** that maps the objkt.js `$o` API to our `$bootloader` API.

### Key Mappings

```javascript
// Seeds and PRNG
$o.seed → $bootloader.rnd
$o.seedGlobal → $bootloader.rndGlobal
$o.rnd() → $bootloader.rnd()

// Capture system
$o.capture() → $bootloader.capturePreview(canvas)
$o.isCapture → $bootloader.isCapture

// Exports and features
$o.registerExport() → $bootloader.registerDownloadable()
$o.registerFeatures() → $bootloader.setFeatures()
```

### Animation System Upgrade

The original artwork used the **gif.js** library to create animated GIFs. We upgraded this to use our bootloader's native animation recording system:

**Before (objkt.js + gif.js):**
```javascript
// Used gif.js library - large dependency, slow encoding
$o.registerExport({ mime: 'image/gif', resolution: { x: 400, y: 400 } }, createGif);

async function createGif({ resolution }) {
  const gif = new GIF({ workers: 2, quality: 10 });
  for (let i = 0; i < 30; i++) {
    resizeCanvas(resolution.x, resolution.y);
    rowscols();
    draw();
    gif.addFrame(canvas, { copy: true, delay: 50 });
  }
  gif.render();
  // ... convert to blob
}
```

**After (bootloader animation recorder):**
```javascript
// Uses native browser MediaRecorder API - no dependencies, hardware-accelerated
$bootloader.registerDownloadable({
  name: 'Animation (WebM)',
  mime: 'video/webm',
  handler: async (options) => {
    const recorder = $bootloader.createAnimationRecorder(canvas, {
      duration: 1500, // 30 frames * 50ms
      fps: 20,
      width: options.width,
      height: options.height
    });

    recorder.onComplete((result) => resolve(result.blob));
    recorder.start();

    // Record 30 frames
    let frameCount = 0;
    const frameInterval = setInterval(() => {
      window.redraw && window.redraw();
      if (++frameCount >= 30) {
        clearInterval(frameInterval);
        recorder.finish();
      }
    }, 50);
  }
});
```

### Benefits of the Upgrade

1. **No dependencies**: Removed gif.js library (minified 84KB)
2. **Hardware acceleration**: Uses native MediaRecorder API
3. **Better quality**: WebM with H.264 produces better quality at smaller file sizes
4. **Faster encoding**: No JavaScript-based encoding overhead
5. **Better format**: WebM is more widely supported and efficient than GIF

## Files

- [index.html](./index.html) - Integration layer with compatibility shim (replaces objkt.js)
- [returns.js](./returns.js) - Original artwork code (unmodified, 1410 lines)
- [manifest.json](./manifest.json) - Bootloader configuration
- [p5.min1.11.9.js](./p5.min1.11.9.js) - p5.js library (1.11.9)
- [ConsolaMono-Book.ttf](./ConsolaMono-Book.ttf) - Custom font used by artwork
- [test.html](./test.html) - Test page with live console output

**Removed dependencies:**
- ~~objkt.js~~ - Replaced with inline compatibility layer in index.html
- ~~gif.js~~ - Replaced with bootloader animation system (native MediaRecorder API)

## Running the Example

### Method 1: Direct View
```bash
# From examples/09-real-world-p5js/
python3 -m http.server 8000

# Open browser to view artwork
open http://localhost:8000/index.html
```

### Method 2: Test Page with Console
```bash
# Open test page with live console output
open http://localhost:8000/test.html
```

The artwork will:
1. Load manifest.json for configuration
2. Use deterministic seeds from URL or generate random ones
3. Render the complex p5.js generative artwork
4. Automatically capture preview when ready
5. Register PNG export and WebM animation download

## Testing Downloads

```bash
# Open test page with download UI (from bootloader-long-form directory)
open http://localhost:8000/test-download.html
# Then load: examples/09-real-world-p5js/index.html
```

You'll see two downloadable formats:
- **PNG (1024×1024)** - Static high-res image
- **Animation (WebM, 400×400)** - 30-frame animation loop (replaces original GIF)

## Manifest Configuration

```json
{
  "bootloader": {
    "capture": {
      "mode": "event-driven",
      "resolution": {
        "preview": { "width": 1200, "height": 1200 },
        "thumbnail": { "width": 400, "height": 400 }
      }
    },
    "animation": {
      "supported": true,
      "autoplay": true,
      "loop": true
    },
    "requirements": {
      "maxMemoryMB": 2048,
      "maxDurationSec": 300
    }
  }
}
```

## Lessons Learned

1. **Compatibility layers work**: Artist code doesn't need modification
2. **API design matters**: Similar APIs make migration easy
3. **Native browser APIs win**: MediaRecorder beats JavaScript GIF encoding
4. **Event-driven capture is flexible**: Works with complex rendering systems
5. **Real-world code is complex**: 1410 lines, custom fonts, sophisticated layouts

## Credits

Original artwork **"Returns"** by **Aleksandra Jovanic**
Originally published on objkt.com
Integration example for bootloader long-form system
