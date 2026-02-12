import { Link } from "react-router-dom";
import {
  Book,
  Code,
  Cpu,
  Gamepad2,
  ArrowRight,
  ExternalLink,
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

export function DocsPage() {
  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Documentation</h1>
        <p className="text-muted-foreground max-w-2xl">
          Learn how to create generative art with bootloader:. From simple SVG
          patterns to complex web-based projects and hardware-compatible ROMs.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="hover:bg-accent transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <Book className="h-6 w-6 mb-2" />
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Create your first generator in minutes
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <Code className="h-6 w-6 mb-2" />
            <CardTitle className="text-lg">SVG JavaScript</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Learn the BTLDR runtime for on-chain art
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <Cpu className="h-6 w-6 mb-2" />
            <CardTitle className="text-lg">Generic Web</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Build with HTML, CSS, and JavaScript zip projects
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <Gamepad2 className="h-6 w-6 mb-2" />
            <CardTitle className="text-lg">Game Boy</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Create art for real hardware</CardDescription>
          </CardContent>
        </Card>
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
                images, bootloader: stores your generative code on-chain,
                allowing infinite unique outputs.
              </p>
              <p className="text-muted-foreground mt-4">
                Each <strong className="text-foreground">bootloader</strong> is
                a runtime environment with specific constraints. Artists choose
                a bootloader that matches their creative vision, whether that's
                lightweight SVG, full web projects, or hardware-compatible ROMs.
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
                  capabilities (capture modes, storage type, hardware support). Choose based on
                  your artistic needs.
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
        </div>

        {/* Right column - Links */}
        <div className="space-y-6">
          <div className="border p-6">
            <h3 className="font-medium mb-4">Resources</h3>
            <ul className="space-y-3">
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
              <li>
                <Link
                  to="/bootloaders"
                  className="text-sm underline hover:text-foreground"
                >
                  Bootloader Reference
                </Link>
              </li>
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
