import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Copy,
  Check,
  FileArchive,
  Code,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { getBootloader } from "@/lib/bootloader-registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReadOnlyCodeEditor } from "@/components/read-only-code-editor";
import type { BootloaderId } from "@/types/bootloader";

function CodeBlock({
  code,
  language = "javascript",
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <ReadOnlyCodeEditor code={code} language={language} />
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-background/80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function GenericWebDocs() {
  return (
    <div className="space-y-12">
      {/* Quick Start */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
        <p className="text-muted-foreground mb-6">
          Get your first generator running in under 5 minutes. Download an
          example, modify it, and upload.
        </p>
        <div className="mb-6 border border-yellow-500/40 bg-yellow-500/10 rounded-lg p-4 text-sm text-muted-foreground">
          Generic-web is currently <strong className="text-foreground">Ghostnet-only</strong>.
          Zip uploads are capped at <strong className="text-foreground">50 MB</strong> for now,
          and parameter payloads are disabled in this rollout.
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold">Bootloader Snippet</h3>
        </div>
        <div className="mb-8">
          <a
            href="/snippet/bootloader.js"
            download="bootloader.js"
            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Code className="h-8 w-8 text-muted-foreground flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-medium mb-1">bootloader.js Snippet</h3>
              <p className="text-sm text-muted-foreground">
                Standalone runtime file only. Use this if you want just the
                latest bootloader script without an example zip.
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-primary mt-2">
                <Download className="h-3 w-3" /> Download .js
              </span>
            </div>
          </a>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold">Example Zips</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <a
            href="/examples/00-simplest.zip"
            download
            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <FileArchive className="h-8 w-8 text-muted-foreground flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-medium mb-1">00 - Simplest</h3>
              <p className="text-sm text-muted-foreground">
                Minimal example. Single color fill with one feature. Start here
                to understand the basics.
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-primary mt-2">
                <Download className="h-3 w-3" /> Download .zip
              </span>
            </div>
          </a>
          <a
            href="/examples/01-simple-static.zip"
            download
            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <FileArchive className="h-8 w-8 text-muted-foreground flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-medium mb-1">01 - Simple Static</h3>
              <p className="text-sm text-muted-foreground">
                Draws random circles using the seeded RNG. Good template for
                static artwork.
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-primary mt-2">
                <Download className="h-3 w-3" /> Download .zip
              </span>
            </div>
          </a>
          <a
            href="/examples/02-explicit-capture.zip"
            download
            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <FileArchive className="h-8 w-8 text-muted-foreground flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-medium mb-1">02 - Explicit Capture</h3>
              <p className="text-sm text-muted-foreground">
                Uses trigger mode to control when the thumbnail is captured. For
                complex renders.
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-primary mt-2">
                <Download className="h-3 w-3" /> Download .zip
              </span>
            </div>
          </a>
          <a
            href="/examples/03-animated-gif.zip"
            download
            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <FileArchive className="h-8 w-8 text-muted-foreground flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-medium mb-1">03 - Animated GIF</h3>
              <p className="text-sm text-muted-foreground">
                Animated particles with GIF thumbnail generation. Shows
                animation config.
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-primary mt-2">
                <Download className="h-3 w-3" /> Download .zip
              </span>
            </div>
          </a>
        </div>
      </section>

      {/* Project Structure */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Project Structure</h2>
        <p className="text-muted-foreground mb-6">
          Your project is a zip file containing your web files.{" "}
          <code className="px-1.5 py-0.5 bg-muted rounded-sm text-sm">
            index.html
          </code>{" "}
          and{" "}
          <code className="px-1.5 py-0.5 bg-muted rounded-sm text-sm">
            bootloader.js
          </code>{" "}
          are required.{" "}
          <code className="px-1.5 py-0.5 bg-muted rounded-sm text-sm">
            manifest.json
          </code>{" "}
          is optional.
        </p>

        <div className="bg-muted p-4 rounded-lg mb-6 font-mono text-sm">
          <div className="text-muted-foreground">your-project/</div>
          <div className="pl-4">
            ├── <span className="text-primary">index.html</span>{" "}
            <span className="text-muted-foreground">← required entrypoint</span>
          </div>
          <div className="pl-4">
            ├── <span className="text-primary">bootloader.js</span>{" "}
            <span className="text-muted-foreground">← required</span>
          </div>
          <div className="pl-4">
            ├── manifest.json{" "}
            <span className="text-muted-foreground">← optional</span>
          </div>
          <div className="pl-4">├── sketch.js</div>
          <div className="pl-4">
            └── ...{" "}
            <span className="text-muted-foreground">(any other files)</span>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Code className="h-5 w-5" />
              manifest.json (optional)
            </h3>
            <p className="text-muted-foreground mb-4">
              Configure capture settings and viewport size. The entrypoint is
              always <code className="px-1 bg-muted rounded-sm text-xs">index.html</code>.
              If you provide an{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">entry</code>{" "}
              field, it must be exactly{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">"index.html"</code>.
              Without a manifest, defaults are used: 800×800 viewport and auto
              capture after 5 seconds.
            </p>
            <CodeBlock
              language="json"
              code={`{
  "spec": "boot:web@1.0.0",
  "entry": "index.html",
  "capture": {
    "mode": "trigger",
    "viewPortDimension": { "width": 1200, "height": 1200 }
  }
}`}
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Code className="h-5 w-5" />
              bootloader.js
            </h3>
            <p className="text-muted-foreground mb-4">
              A small runtime script that provides the seed, random number
              generator, and API. Include it in your HTML before your own code.
            </p>
            <CodeBlock
              language="html"
              code={`<script src="./bootloader.js"></script>
<script src="./sketch.js"></script>`}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Get the latest bootloader.js from any of the example downloads
              above.
            </p>
          </div>
        </div>
      </section>

      {/* The $bootloader API */}
      <section>
        <h2 className="text-2xl font-bold mb-4">The $bootloader API</h2>
        <p className="text-muted-foreground mb-6">
          Once you include bootloader.js, you have access to the global{" "}
          <code className="px-1.5 py-0.5 bg-muted rounded-sm text-sm">
            $bootloader
          </code>{" "}
          object:
        </p>

        <div className="space-y-6">
          {/* Properties */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Properties</h3>
            <div className="border rounded-lg divide-y">
              <div className="p-4">
                <code className="text-primary font-medium">
                  $bootloader.hash
                </code>
                <span className="text-muted-foreground ml-2">: string</span>
                <p className="text-sm text-muted-foreground mt-1">
                  32-character hex string. The unique seed for this token. Same
                  seed = same output.
                </p>
              </div>
              <div className="p-4">
                <code className="text-primary font-medium">
                  $bootloader.rnd
                </code>
                <span className="text-muted-foreground ml-2">
                  : () =&gt; number
                </span>
                <p className="text-sm text-muted-foreground mt-1">
                  Seeded random number generator. Returns a value between 0 and
                  1. <strong>Use this instead of Math.random().</strong>
                </p>
              </div>
              <div className="p-4">
                <code className="text-primary font-medium">
                  $bootloader.iteration
                </code>
                <span className="text-muted-foreground ml-2">: number</span>
                <p className="text-sm text-muted-foreground mt-1">
                  Edition number of this token (1, 2, 3, ...). Useful for
                  edition-specific variations.
                </p>
              </div>
              <div className="p-4">
                <code className="text-primary font-medium">
                  $bootloader.isCapture
                </code>
                <span className="text-muted-foreground ml-2">: boolean</span>
                <p className="text-sm text-muted-foreground mt-1">
                  True when running in thumbnail capture mode. Use this to skip
                  animations or render at higher quality for the thumbnail.
                </p>
              </div>
            </div>
          </div>

          {/* Methods */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Methods</h3>
            <div className="border rounded-lg divide-y">
              <div className="p-4">
                <code className="text-primary font-medium">
                  $bootloader.capture()
                </code>
                <p className="text-sm text-muted-foreground mt-1">
                  Call this when your artwork is ready to be captured. Required
                  when using{" "}
                  <code className="px-1 bg-muted rounded-sm text-xs">
                    mode: "trigger"
                  </code>{" "}
                  in your manifest.
                </p>
              </div>
              <div className="p-4">
                <code className="text-primary font-medium">
                  $bootloader.setFeatures(obj)
                </code>
                <p className="text-sm text-muted-foreground mt-1">
                  Set the traits/attributes for this token. Pass an object like{" "}
                  <code className="px-1 bg-muted rounded-sm text-xs">{`{ "Color": "Blue", "Size": "Large" }`}</code>
                </p>
              </div>
              <div className="p-4">
                <code className="text-primary font-medium">
                  $bootloader.rnd.reset()
                </code>
                <p className="text-sm text-muted-foreground mt-1">
                  Reset the random number generator to its initial state. Useful
                  if you need to regenerate the same sequence.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Example */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Minimal Example</h2>
        <p className="text-muted-foreground mb-6">
          Here's a complete, working example that fills the canvas with a random
          color:
        </p>

        <CodeBlock
          language="html"
          code={`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="./bootloader.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Use viewport size (responsive)
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Generate a random hue using the seeded RNG
    const hue = $bootloader.rnd() * 360;

    // Fill the canvas
    ctx.fillStyle = \`hsl(\${hue}, 70%, 50%)\`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set features for this token
    $bootloader.setFeatures({
      'Hue': Math.round(hue),
      'Color': hue < 30 ? 'Red' : hue < 90 ? 'Yellow' : hue < 150 ? 'Green' :
               hue < 210 ? 'Cyan' : hue < 270 ? 'Blue' : hue < 330 ? 'Purple' : 'Red'
    });

    // Signal that we're ready for capture
    if ($bootloader.isCapture) {
      $bootloader.capture();
    }
  </script>
</body>
</html>`}
        />
      </section>

      {/* manifest.json Reference */}
      <section>
        <h2 className="text-2xl font-bold mb-4">manifest.json Reference</h2>

        <div className="space-y-8">
          {/* Core fields */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Core Fields</h3>
            <div className="border rounded-lg divide-y">
              <div className="p-4">
                <code className="text-primary font-medium">
                  "spec": "boot:web@1.0.0"
                </code>
                <p className="text-sm text-muted-foreground mt-1">
                  Always use this exact value. It tells the system which
                  bootloader to use.
                </p>
              </div>
              <div className="p-4">
                <code className="text-primary font-medium">
                  "entry": "index.html" (optional)
                </code>
                <p className="text-sm text-muted-foreground mt-1">
                  Optional override. If present, it must be exactly{" "}
                  <code className="px-1 bg-muted rounded-sm text-xs">"index.html"</code>.
                  Generic-web tokens always load root{" "}
                  <code className="px-1 bg-muted rounded-sm text-xs">index.html</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Capture settings */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Capture Settings</h3>
            <p className="text-muted-foreground mb-4">
              The{" "}
              <code className="px-1.5 py-0.5 bg-muted rounded-sm text-sm">
                capture
              </code>{" "}
              object controls how thumbnails are generated:
            </p>

            <CodeBlock
              language="json"
              code={`{
  "capture": {
    "mode": "trigger",
    "viewPortDimension": { "width": 1200, "height": 1200 },
    "delayMs": 5000,
    "target": "viewport"
  }
}`}
            />

            <div className="mt-4 border rounded-lg divide-y">
              <div className="p-4">
                <code className="text-primary font-medium">mode</code>
                <span className="text-muted-foreground ml-2">
                  : "auto" | "trigger"
                </span>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>auto</strong>: Captures after delayMs milliseconds.
                  <br />
                  <strong>trigger</strong>: Waits for your code to call{" "}
                  <code className="px-1 bg-muted rounded-sm text-xs">
                    $bootloader.capture()
                  </code>
                </p>
              </div>
              <div className="p-4">
                <code className="text-primary font-medium">
                  viewPortDimension
                </code>
                <span className="text-muted-foreground ml-2">
                  : {`{ width, height }`}
                </span>
                <p className="text-sm text-muted-foreground mt-1">
                  The browser viewport size when capturing the thumbnail.
                  Default is 800×800. Max is 8192×8192.
                </p>
              </div>
              <div className="p-4">
                <code className="text-primary font-medium">delayMs</code>
                <span className="text-muted-foreground ml-2">: number</span>
                <p className="text-sm text-muted-foreground mt-1">
                  Milliseconds to wait before capture (auto mode only). Default
                  is 5000 (5 seconds).
                </p>
              </div>
            </div>
          </div>

          {/* Animation settings */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Animation Settings (GIF)
            </h3>
            <p className="text-muted-foreground mb-4">
              Add an{" "}
              <code className="px-1.5 py-0.5 bg-muted rounded-sm text-sm">
                animation
              </code>{" "}
              object to generate an animated GIF thumbnail:
            </p>

            <CodeBlock
              language="json"
              code={`{
  "animation": {
    "duration": 3000,
    "fps": 15
  }
}`}
            />

            <div className="mt-4 border rounded-lg divide-y">
              <div className="p-4">
                <code className="text-primary font-medium">duration</code>
                <span className="text-muted-foreground ml-2">: number</span>
                <p className="text-sm text-muted-foreground mt-1">
                  How long to record in milliseconds. Min: 1000, Max: 30000.
                </p>
              </div>
              <div className="p-4">
                <code className="text-primary font-medium">fps</code>
                <span className="text-muted-foreground ml-2">: number</span>
                <p className="text-sm text-muted-foreground mt-1">
                  Frames per second. Max: 30. Lower values = smaller file size.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Important Rules */}
      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-yellow-500" />
          Important Rules
        </h2>

        <div className="space-y-4">
          <div className="border-l-4 border-yellow-500 pl-4 py-2">
            <h3 className="font-semibold mb-1">
              Use $bootloader.rnd() for all randomness
            </h3>
            <p className="text-sm text-muted-foreground">
              Never use{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                Math.random()
              </code>{" "}
              or{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                Date.now()
              </code>{" "}
              for decisions that affect the output. The same seed must produce
              the exact same artwork every time. This is what makes generative
              art collectible.
            </p>
          </div>

          <div className="border-l-4 border-yellow-500 pl-4 py-2">
            <h3 className="font-semibold mb-1">Bundle all your assets</h3>
            <p className="text-sm text-muted-foreground">
              Include all fonts, images, libraries, and other files in your zip.
              External URLs may not work in all environments. Use relative paths
              like{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                ./assets/font.woff2
              </code>
              .
            </p>
          </div>

          <div className="border-l-4 border-yellow-500 pl-4 py-2">
            <h3 className="font-semibold mb-1">Make your canvas responsive</h3>
            <p className="text-sm text-muted-foreground">
              Use{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                window.innerWidth
              </code>{" "}
              and{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                window.innerHeight
              </code>{" "}
              for canvas dimensions. Your artwork will be displayed at various
              sizes - in previews, on collection pages, and full-screen.
            </p>
          </div>

          <div className="border-l-4 border-yellow-500 pl-4 py-2">
            <h3 className="font-semibold mb-1">Set features for filtering</h3>
            <p className="text-sm text-muted-foreground">
              Call{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                $bootloader.setFeatures()
              </code>{" "}
              with meaningful traits. Collectors use these to filter and
              discover tokens with specific characteristics.
            </p>
          </div>

          <div className="border-l-4 border-yellow-500 pl-4 py-2">
            <h3 className="font-semibold mb-1">Call capture() when ready</h3>
            <p className="text-sm text-muted-foreground">
              If using trigger mode, make sure to call{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                $bootloader.capture()
              </code>{" "}
              when your artwork is complete. Check{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                $bootloader.isCapture
              </code>{" "}
              to avoid unnecessary work during live preview.
            </p>
          </div>
        </div>
      </section>

      {/* Generator Updates */}
      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <RefreshCw className="h-6 w-6 text-green-500" />
          Generator Updates
        </h2>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
          <p className="text-muted-foreground mb-4">
            <strong className="text-foreground">
              Generators are updatable.
            </strong>{" "}
            You can modify your code, descriptions, and settings at any time
            after publishing. Each update increments the version number (v1 → v2
            → v3...).
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>
                Fix bugs and improve your generator without affecting existing
                tokens
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>
                Token owners can choose to regenerate their NFTs to get the
                updated version
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>
                Original seed and iteration number are preserved when
                regenerating
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>New mints always use the latest version automatically</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Tips */}
      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-blue-500" />
          Tips
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Testing different seeds</h3>
            <p className="text-sm text-muted-foreground">
              In the create page, click the dice icon to generate new random
              seeds. This helps you see the variety in your outputs before
              publishing.
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Choosing a thumbnail seed</h3>
            <p className="text-sm text-muted-foreground">
              Use the "Render" button to generate multiple outputs. Select one
              as your generator's default thumbnail - this is what collectors
              see first.
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Avoid external API calls</h3>
            <p className="text-sm text-muted-foreground">
              Don't fetch data from external APIs. Your artwork should be fully
              self-contained. External services may go offline, making your art
              unrenderable in the future.
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Using p5.js or three.js</h3>
            <p className="text-sm text-muted-foreground">
              These libraries work great. Include them in your zip and use the
              bootloader's RNG by overriding{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                Math.random = $bootloader.rnd
              </code>{" "}
              early in your code.
            </p>
          </div>
        </div>
      </section>

      {/* Ready to Create */}
      <section className="text-center py-8 border-t">
        <h2 className="text-2xl font-bold mb-4">Ready to Create?</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Download an example, modify it to make it yours, and upload it to
          create your first generator.
        </p>
        <Button asChild size="lg">
          <Link to="/create?bootloader=generic-web">
            Create Generator
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}

function SvgJsDocs() {
  return (
    <div className="space-y-12">
      {/* Overview */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <p className="text-muted-foreground mb-4">
          SVG-JS is a lightweight bootloader for creating fully on-chain
          generative art. Your JavaScript code is stored directly on the Tezos
          blockchain - no IPFS, no external dependencies.
        </p>
        <p className="text-muted-foreground mb-4">
          Write code that manipulates an SVG element using the BTLDR runtime.
          Perfect for minimalist, vector-based artwork that will exist forever
          on-chain.
        </p>
        <p className="text-muted-foreground mb-6">
          The term "bootloader" comes from computing, where it describes the
          small program that starts up a computer. In the same way, your code
          acts as the minimal program that "boots" your artwork — a
          self-contained SVG that, combined with blockchain entropy, produces
          the final piece.
        </p>

        <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
          <HardDrive className="h-5 w-5 text-primary" />
          <span className="text-sm">
            <strong>Storage:</strong> Fully on-chain (~24KB max)
          </span>
        </div>
      </section>

      {/* How It Works */}
      <section>
        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
        <p className="text-muted-foreground mb-4">
          When collectors mint your generator, the contract assembles a complete
          SVG data URI by combining template fragments with your code and
          blockchain entropy. This becomes the NFT's{" "}
          <code className="px-1.5 py-0.5 bg-muted rounded-sm text-sm">
            artifactUri
          </code>
          , stored permanently on-chain.
        </p>
        <CodeBlock
          language="text"
          code={`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg">
<script><![CDATA[
  const SEED = 123456789012345678901234567890n; // ← Blockchain entropy
  // ... random number generator setup ...

  const BTLDR = {
    rnd: sfc32(a,b,c,d),           // Deterministic random (0-1)
    seed: SEED,                    // Raw BigInt from blockchain
    iterationNumber: n,            // Sequential mint number (1, 2, 3...)
    isPreview: n===0&&SEED===0n,   // True for thumbnail generation
    svg: document.documentElement, // Root SVG element
    v: 'svg-js:0.0.1'
  };

  ((BTLDR) => {
    // YOUR CODE RUNS HERE
  })(BTLDR);
]]></script>
</svg>`}
        />
      </section>

      {/* The BTLDR Object */}
      <section>
        <h2 className="text-2xl font-bold mb-4">The BTLDR Object</h2>
        <p className="text-muted-foreground mb-6">
          Your code has access to the BTLDR runtime object:
        </p>

        <div className="border rounded-lg divide-y">
          <div className="p-4">
            <code className="text-primary font-medium">BTLDR.rnd()</code>
            <span className="text-muted-foreground ml-2">: number</span>
            <p className="text-sm text-muted-foreground mt-1">
              Seeded random number generator. Returns a value between 0 and 1.{" "}
              <strong>Always use this instead of Math.random().</strong>
            </p>
          </div>
          <div className="p-4">
            <code className="text-primary font-medium">BTLDR.seed</code>
            <span className="text-muted-foreground ml-2">: BigInt</span>
            <p className="text-sm text-muted-foreground mt-1">
              The raw seed from the blockchain. Same seed always produces the
              same output.
            </p>
          </div>
          <div className="p-4">
            <code className="text-primary font-medium">
              BTLDR.iterationNumber
            </code>
            <span className="text-muted-foreground ml-2">: number</span>
            <p className="text-sm text-muted-foreground mt-1">
              Sequential mint number (1, 2, 3...). Use this to create variations
              that evolve across editions.
            </p>
          </div>
          <div className="p-4">
            <code className="text-primary font-medium">BTLDR.isPreview</code>
            <span className="text-muted-foreground ml-2">: boolean</span>
            <p className="text-sm text-muted-foreground mt-1">
              True when rendering thumbnails for bootloader: and objkt. Use to
              customize cover images.
            </p>
          </div>
          <div className="p-4">
            <code className="text-primary font-medium">BTLDR.svg</code>
            <span className="text-muted-foreground ml-2">: SVGElement</span>
            <p className="text-sm text-muted-foreground mt-1">
              The root SVG element. Append your shapes here using{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                BTLDR.svg.appendChild()
              </code>
            </p>
          </div>
        </div>
      </section>

      {/* Example */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Example</h2>
        <p className="text-muted-foreground mb-4">
          A simple generator that creates random colored circles:
        </p>
        <CodeBlock
          language="javascript"
          code={`BTLDR.svg.setAttribute('viewBox', '0 0 400 400');

// Create 5 random circles
for (let i = 0; i < 5; i++) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

  circle.setAttribute('cx', 60 + BTLDR.rnd() * 280);
  circle.setAttribute('cy', 60 + BTLDR.rnd() * 280);
  circle.setAttribute('r', 20 + BTLDR.rnd() * 40);
  circle.setAttribute('fill', \`hsl(\${BTLDR.rnd() * 360}, 70%, 60%)\`);
  circle.setAttribute('opacity', 0.8);

  BTLDR.svg.appendChild(circle);
}`}
        />
      </section>

      {/* Best Practices */}
      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-blue-500" />
          Best Practices
        </h2>

        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <h3 className="font-semibold mb-1">Use deterministic randomness</h3>
            <p className="text-sm text-muted-foreground">
              Always use{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                BTLDR.rnd()
              </code>{" "}
              instead of{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                Math.random()
              </code>{" "}
              to ensure reproducible results.
            </p>
          </div>

          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <h3 className="font-semibold mb-1">Optimize code size</h3>
            <p className="text-sm text-muted-foreground">
              Your code is stored on-chain, so keep it concise. Each byte costs
              storage fees (250 mutez per byte).
            </p>
          </div>

          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <h3 className="font-semibold mb-1">Design for different sizes</h3>
            <p className="text-sm text-muted-foreground">
              Use a viewBox and design your art to look good at various sizes
              and aspect ratios.
            </p>
          </div>

          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <h3 className="font-semibold mb-1">Avoid expensive operations</h3>
            <p className="text-sm text-muted-foreground">
              Don't use infinite loops or computationally expensive operations.
              Performance matters.
            </p>
          </div>

          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <h3 className="font-semibold mb-1">
              Use isPreview and iterationNumber
            </h3>
            <p className="text-sm text-muted-foreground">
              Customize covers with{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                BTLDR.isPreview
              </code>{" "}
              and create variations across editions with{" "}
              <code className="px-1 bg-muted rounded-sm text-xs">
                BTLDR.iterationNumber
              </code>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Technical Details */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Technical Details</h2>
        <div className="border rounded-lg divide-y">
          <div className="p-4 flex justify-between">
            <span className="text-muted-foreground">Max code size</span>
            <span className="font-medium">~24KB</span>
          </div>
          <div className="p-4 flex justify-between">
            <span className="text-muted-foreground">Output format</span>
            <span className="font-medium">SVG</span>
          </div>
          <div className="p-4 flex justify-between">
            <span className="text-muted-foreground">Screenshot timeout</span>
            <span className="font-medium">30 seconds</span>
          </div>
          <div className="p-4 flex justify-between">
            <span className="text-muted-foreground">Screenshot size</span>
            <span className="font-medium">400×400 pixels</span>
          </div>
          <div className="p-4 flex justify-between">
            <span className="text-muted-foreground">Storage cost</span>
            <span className="font-medium">250 mutez per byte</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Generators are updatable - you can modify code after publishing. Each
          update increments the version. Token owners can regenerate their NFTs
          when the generator has been updated.
        </p>
      </section>

      {/* Ready to Create */}
      <section className="text-center py-8 border-t">
        <h2 className="text-2xl font-bold mb-4">Ready to Create?</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Write your code in the built-in editor and see your artwork render in
          real-time.
        </p>
        <Button asChild size="lg">
          <Link to="/create?bootloader=svg-js">
            Create Generator
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}

export function BootloaderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bootloader = getBootloader(id as BootloaderId);

  if (!bootloader) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Bootloader not found</h1>
        <p className="text-muted-foreground mb-8">
          The bootloader "{id}" doesn't exist.
        </p>
        <Button asChild>
          <Link to="/bootloaders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bootloaders
          </Link>
        </Button>
      </div>
    );
  }

  const storageLabel =
    bootloader.features.storageType === "onchain"
      ? "On-chain"
      : bootloader.features.storageType === "ipfs"
      ? "IPFS"
      : "Hybrid";

  return (
    <div className="container py-8">
      {/* Back link */}
      <Link
        to="/bootloaders"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        All Bootloaders
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{bootloader.name}</h1>
          {bootloader.status === "coming-soon" && (
            <Badge variant="outline">Coming Soon</Badge>
          )}
        </div>
        <p className="font-mono text-sm text-muted-foreground mb-4">
          {bootloader.spec}
        </p>
        <p className="text-lg text-muted-foreground mb-4">
          {bootloader.description}
        </p>

        {/* Quick info badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-sm">
            <HardDrive className="h-3 w-3 mr-1" />
            {storageLabel}
          </Badge>
          {bootloader.features.hasParameterSupport && (
            <Badge variant="secondary" className="text-sm">
              <Sparkles className="h-3 w-3 mr-1" />
              Parameters
            </Badge>
          )}
          {bootloader.constraints.maxSize && (
            <Badge variant="secondary" className="text-sm">
              Max {Math.round(bootloader.constraints.maxSize / 1024)}KB
            </Badge>
          )}
          {bootloader.constraints.formats && (
            <Badge variant="secondary" className="text-sm">
              {bootloader.constraints.formats.join(", ").toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      {/* Bootloader-specific documentation */}
      {bootloader.id === "generic-web" && <GenericWebDocs />}
      {bootloader.id === "svg-js" && <SvgJsDocs />}
    </div>
  );
}
