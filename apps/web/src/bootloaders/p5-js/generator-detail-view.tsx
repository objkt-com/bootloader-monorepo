import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { Check, Code, Dices, Eye, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { BootloaderGeneratorDetailViewProps } from "@/bootloaders/page-types";
import { fetchP5SketchSource } from "./template";

export function P5JsGeneratorDetailView({
  generator,
  ViewerComponent,
  copied,
  revealModalOpen,
  seed,
  iteration,
  onSeedChange,
  onReroll,
  onCopyLink,
  mobileView = "preview",
  onMobileViewChange,
  editorTheme = "light",
}: BootloaderGeneratorDetailViewProps) {
  const [code, setCode] = useState<string | null>(null);
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSketch() {
      if (!generator.cid) {
        setCode(null);
        return;
      }

      try {
        setIsLoadingCode(true);
        const source = await fetchP5SketchSource(generator.cid);
        if (!cancelled) {
          setCode(source);
        }
      } catch (error) {
        console.warn("Failed to load p5 generator sketch source:", error);
        if (!cancelled) {
          setCode(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCode(false);
        }
      }
    }

    void loadSketch();
    return () => {
      cancelled = true;
    };
  }, [generator.cid]);

  return (
    <>
      <div className="md:hidden flex border-b">
        <button
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors",
            mobileView === "code"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground"
          )}
          onClick={() => onMobileViewChange?.("code")}
        >
          <Code className="inline mr-2 h-4 w-4" />
          Code
        </button>
        <button
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors",
            mobileView === "preview"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground"
          )}
          onClick={() => onMobileViewChange?.("preview")}
        >
          <Eye className="inline mr-2 h-4 w-4" />
          Preview
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div
          className={cn(
            "border rounded-md overflow-hidden flex flex-col",
            mobileView === "preview" ? "hidden md:flex" : ""
          )}
        >
          <div className="h-10 flex items-center px-3 border-b text-sm font-medium flex-shrink-0">
            sketch.js
          </div>
          <div className="flex-1 min-h-[420px] md:min-h-[680px]">
            {isLoadingCode && !code ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading sketch.js…
              </div>
            ) : (
              <Editor
                key={editorTheme}
                height="100%"
                defaultLanguage="javascript"
                value={code || "// sketch.js unavailable"}
                theme={editorTheme}
                options={{
                  readOnly: true,
                  domReadOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                }}
              />
            )}
          </div>
        </div>

        <div
          className={cn("flex flex-col", mobileView === "code" ? "hidden md:flex" : "")}
        >
          <div className="border rounded-md overflow-hidden flex-1 flex flex-col">
            <div className="h-10 px-3 border-b text-sm font-medium flex items-center justify-between flex-shrink-0">
              <span>Preview</span>
              <Button variant="ghost" size="sm" onClick={onReroll} className="h-7 px-2">
                <Dices className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 bg-muted/30 relative overflow-hidden min-h-[420px] md:min-h-[680px]">
              {revealModalOpen ? (
                <div className="absolute inset-0 bg-black" />
              ) : (
                <ViewerComponent
                  generator={generator}
                  seed={seed}
                  iteration={iteration}
                  className="absolute inset-0"
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Seed</Label>
              <Input
                value={seed}
                onChange={(event) => onSeedChange(event.target.value)}
                className="w-52 font-mono text-xs h-8"
              />
            </div>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={onCopyLink} className="h-7">
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
