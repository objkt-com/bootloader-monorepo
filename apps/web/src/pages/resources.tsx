import { Link } from "react-router-dom";
import {
  Code,
  Cpu,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Palette,
  Sparkles,
  Video,
  HardDrive,
  Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReadOnlyCodeEditor } from "@/components/read-only-code-editor";

export function ResourcesPage() {
  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Resources</h1>
        <p className="text-muted-foreground max-w-2xl">
          Learn how to create generative art with bootloader:. Documentation,
          tutorials, and recommended reading for artists of all skill levels.
        </p>
      </div>

      {/* Quick Links - Bootloaders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link to="/bootloaders/svg-js">
          <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <Code className="h-6 w-6" />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <HardDrive className="h-3 w-3" />
                  On-chain
                </div>
              </div>
              <CardTitle className="text-lg">SVG JavaScript</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Fully on-chain generative art. Your code is stored directly on
                Tezos. Perfect for lightweight, permanent artwork.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link to="/bootloaders/generic-web">
          <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-6 w-6" />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Cloud className="h-3 w-3" />
                  IPFS
                </div>
              </div>
              <CardTitle className="text-lg">Generic Web</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                HTML, CSS, JS with any library. Use p5.js, three.js, canvas,
                WebGL - the full power of the browser.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Guides */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">What is bootloader:?</h2>
            <div className="max-w-none">
              <p className="text-muted-foreground">
                bootloader: is an open-source platform for creating and
                collecting long-form generative art on the Tezos blockchain.
                Unlike traditional NFT platforms where you upload finished
                images, bootloader: stores your generative code, allowing
                infinite unique outputs.
              </p>
              <p className="text-muted-foreground mt-4">
                Each <strong className="text-foreground">bootloader</strong> is
                a runtime environment with specific constraints. Artists choose
                a bootloader that matches their creative vision, whether that's
                lightweight on-chain SVG or full web projects with IPFS storage.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Key Concepts</h2>
            <div className="space-y-4">
              <div className="border p-4">
                <h3 className="font-medium mb-2">Generators</h3>
                <p className="text-sm text-muted-foreground">
                  A generator is your artwork's code stored on-chain. It defines
                  how outputs are created but doesn't produce a fixed image.
                  Each time someone mints, they get a unique output based on a
                  random seed.
                </p>
              </div>
              <div className="border p-4">
                <h3 className="font-medium mb-2">Seeds</h3>
                <p className="text-sm text-muted-foreground">
                  Seeds are random numbers that determine the output of a
                  generator. The same seed always produces the same output
                  (deterministic), but different seeds create different
                  variations.
                </p>
              </div>
              <div className="border p-4">
                <h3 className="font-medium mb-2">Bootloaders</h3>
                <p className="text-sm text-muted-foreground">
                  Bootloaders are runtime environments. Each has different
                  constraints (resolution, file size, output format) and
                  capabilities (capture modes, storage type). Choose based on your
                  artistic needs.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">
              SVG JavaScript Example
            </h2>
            <div className="max-w-none">
              <p className="text-muted-foreground mb-4">
                The simplest way to get started. Your code has access to the
                BTLDR object with a seeded random number generator:
              </p>
              <ReadOnlyCodeEditor
                language="javascript"
                code={`// Available: BTLDR.rnd(), BTLDR.seed, BTLDR.svg

const svg = BTLDR.svg;
svg.setAttribute('viewBox', '0 0 100 100');

// Create random circles
for (let i = 0; i < 50; i++) {
  const circle = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'circle'
  );
  circle.setAttribute('cx', BTLDR.rnd() * 100);
  circle.setAttribute('cy', BTLDR.rnd() * 100);
  circle.setAttribute('r', 1 + BTLDR.rnd() * 5);
  circle.setAttribute('fill', \`hsl(\${BTLDR.rnd()*360}, 70%, 50%)\`);
  svg.appendChild(circle);
}`}
              />
            </div>
          </section>

          {/* Getting Started with Creative Coding Section */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Getting Started with Creative Coding
            </h2>
            <p className="text-muted-foreground mb-6">
              New to creative coding? Here are some resources to help you get
              started on your generative art journey.
            </p>

            <div className="space-y-6">
              {/* Online Courses */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Online Courses
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <a
                    href="https://thecodingtrain.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          The Coding Train
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Daniel Shiffman's excellent video tutorials on
                          creative coding with p5.js
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                  <a
                    href="https://www.kadenze.com/courses/introduction-to-programming-for-the-visual-arts-with-p5-js/info"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          Kadenze: Intro to Visual Arts with p5.js
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Free course from UCLA covering fundamentals of
                          creative coding
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                </div>
              </div>

              {/* Books */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Recommended Books
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <a
                    href="https://natureofcode.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          The Nature of Code
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Daniel Shiffman's book on simulating natural systems
                          with code (free online)
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                  <a
                    href="https://www.manning.com/books/generative-design"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          Generative Design
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Comprehensive book with p5.js examples for visualizing
                          data and generative art
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                  <a
                    href="https://mitpress.mit.edu/9780262542043/code-as-creative-medium/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          Code as Creative Medium
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By Golan Levin & Tega Brain - essential reading for
                          computational artists
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                  <a
                    href="https://10print.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          10 PRINT
                        </p>
                        <p className="text-xs text-muted-foreground">
                          A collaborative book that uses a one-line Commodore
                          64 BASIC program to explore creative computing,
                          code-in-culture, repetition, and randomness.
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                </div>
              </div>

              {/* Tools & Frameworks */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Tools & Frameworks
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <a
                    href="https://p5js.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          p5.js
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JavaScript library for creative coding, perfect for
                          beginners
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                  <a
                    href="https://threejs.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          three.js
                        </p>
                        <p className="text-xs text-muted-foreground">
                          3D library for WebGL - create stunning 3D generative
                          art
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                  <a
                    href="https://editor.p5js.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          p5.js Web Editor
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Browser-based editor for quick experimentation
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                  <a
                    href="https://www.shadertoy.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          Shadertoy
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Create and share GLSL shaders in the browser
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                </div>
              </div>

              {/* Inspiration */}
              <div>
                <h3 className="font-medium mb-3">Inspiration & Community</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <a
                    href="https://openprocessing.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          OpenProcessing
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Community platform for sharing Processing/p5.js
                          sketches
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                  <a
                    href="https://www.reddit.com/r/generative/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium group-hover:underline">
                          r/generative
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Active Reddit community for generative art
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right column - Links */}
        <div className="space-y-6">
          <div className="border p-6">
            <h3 className="font-medium mb-4">Documentation</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/bootloaders/svg-js"
                  className="text-sm underline hover:text-foreground"
                >
                  SVG-JS Documentation
                </Link>
              </li>
              <li>
                <Link
                  to="/bootloaders/generic-web"
                  className="text-sm underline hover:text-foreground"
                >
                  Generic Web Documentation
                </Link>
              </li>
              <li>
                <Link
                  to="/bootloaders"
                  className="text-sm underline hover:text-foreground"
                >
                  All Bootloaders
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/objkt-com/bootloader-monorepo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline hover:text-foreground flex items-center"
                >
                  GitHub Repository
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          <div className="border p-6">
            <h3 className="font-medium mb-4">Browse</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/explore"
                  className="text-sm underline hover:text-foreground"
                >
                  All Generators
                </Link>
              </li>
            </ul>
          </div>

          <div className="border p-6">
            <h3 className="font-medium mb-4">Need Help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Join our Discord community for support, feedback, and
              collaboration.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <a
                href="https://discord.gg/uYye4UY6Ax"
                target="_blank"
                rel="noopener noreferrer"
              >
                Join Discord
              </a>
            </Button>
          </div>

          <div className="border p-6">
            <h3 className="font-medium mb-4">Ready to Create?</h3>
            <Button asChild size="sm" className="w-full">
              <Link to="/create">
                Start Creating
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
