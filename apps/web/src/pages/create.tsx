import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowRight, Upload, Code, Gamepad2 } from "lucide-react";
import { getBootloader, getActiveBootloaders } from "@/lib/bootloader-registry";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BootloaderId } from "@/types/bootloader";

// Import bootloader-specific creators
import { SvgJsCreator } from "@/bootloaders/svg-js";
import { GenericWebCreator } from "@/bootloaders/generic-web";

const creatorComponents: Record<BootloaderId, React.ComponentType<any>> = {
  "svg-js": SvgJsCreator,
  "generic-web": GenericWebCreator,
};

export function CreatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bootloaderParam = searchParams.get("bootloader") as BootloaderId | null;

  const bootloader = bootloaderParam ? getBootloader(bootloaderParam) : null;
  const activeBootloaders = getActiveBootloaders();

  // If a valid bootloader is selected and active, show its creator
  if (bootloader && bootloader.status === "active") {
    const CreatorComponent = creatorComponents[bootloader.id];
    return <CreatorComponent bootloader={bootloader} />;
  }

  // Otherwise, show bootloader selection
  return (
    <div className="h-full overflow-auto">
      <div className="container py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create a Generator</h1>
          <p className="text-muted-foreground">
            Choose a bootloader to get started. Each bootloader has different
            constraints and capabilities for your generative artwork.
          </p>
        </div>

        <div className="grid gap-6">
          {activeBootloaders.map((bl) => (
            <Card
              key={bl.id}
              className="cursor-pointer transition-colors hover:bg-accent"
              onClick={() => navigate(`/create?bootloader=${bl.id}`)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{bl.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {bl.spec}
                    </CardDescription>
                  </div>
                  <Button size="sm">
                    Select
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {bl.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {bl.features.hasCodeEditor && (
                    <Badge variant="secondary" className="text-xs">
                      <Code className="mr-1 h-3 w-3" />
                      Code Editor
                    </Badge>
                  )}
                  {bl.features.hasZipUpload && (
                    <Badge variant="secondary" className="text-xs">
                      <Upload className="mr-1 h-3 w-3" />
                      Zip Upload
                    </Badge>
                  )}
                  {bl.features.hasParameterSupport && (
                    <Badge variant="secondary" className="text-xs">
                      Parameters
                    </Badge>
                  )}
                  {bl.features.hasHardwareSupport && (
                    <Badge variant="secondary" className="text-xs">
                      <Gamepad2 className="mr-1 h-3 w-3" />
                      Hardware
                    </Badge>
                  )}
                  {bl.constraints.resolution && (
                    <Badge variant="outline" className="text-xs">
                      {bl.constraints.resolution.width}x
                      {bl.constraints.resolution.height}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Coming soon */}
        <div className="mt-12 text-center text-muted-foreground">
          <p className="text-sm">
            More bootloaders coming soon. Want to contribute?{" "}
            <a
              href="https://github.com/objkt-com/bootloader-monorepo"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Check out the docs
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
