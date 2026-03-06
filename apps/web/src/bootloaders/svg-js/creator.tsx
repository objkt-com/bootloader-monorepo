import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Dices, Play, Save, Eye, Code, Loader2 } from "lucide-react";
import Editor from "@monaco-editor/react";
import type { Bootloader } from "@/types/bootloader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  generateSvgDataUrl,
  calculateStorageCost,
  formatTez,
} from "./btldr-runtime";
import { getPrimarySaleFeePercent } from "@/config";
import { useWallet } from "@/hooks/use-wallet";
import { createGenerator } from "@/services/tezos";
import { useTheme } from "@/hooks/use-theme";

interface SvgJsCreatorProps {
  bootloader: Bootloader;
  className?: string;
}

const DEFAULT_CODE = `// Your SVG generative art code
// Available: BTLDR.rnd(), BTLDR.seed, BTLDR.svg

const svg = BTLDR.svg;
svg.setAttribute('viewBox', '0 0 100 100');

// Create a random pattern
for (let i = 0; i < 20; i++) {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(BTLDR.rnd() * 90));
  rect.setAttribute('y', String(BTLDR.rnd() * 90));
  rect.setAttribute('width', String(5 + BTLDR.rnd() * 10));
  rect.setAttribute('height', String(5 + BTLDR.rnd() * 10));
  rect.setAttribute('fill', \`hsl(\${BTLDR.rnd() * 360}, 70%, 50%)\`);
  svg.appendChild(rect);
}
`;

// Generate a random seed (0 to 999,999,999)
function generateRandomSeed(): string {
  return String(Math.floor(Math.random() * 1000000000));
}

export function SvgJsCreator({ className }: SvgJsCreatorProps) {
  const { isConnected, tezos } = useWallet();
  const { effectiveTheme } = useTheme();
  const navigate = useNavigate();

  // Monaco theme based on app theme
  const monacoTheme = effectiveTheme === "dark" ? "vs-dark" : "light";

  // State
  const [code, setCode] = useState(DEFAULT_CODE);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState(() => generateRandomSeed());
  const [iteration, setIteration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [mobileView, setMobileView] = useState<"code" | "preview">("code");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout>();

  // Calculate storage cost
  const storageCost = calculateStorageCost(code);
  const primarySaleFeePercent = getPrimarySaleFeePercent("svg-js");

  // Generate preview
  const updatePreview = useCallback(() => {
    try {
      const url = generateSvgDataUrl(code, seed, iteration);
      setPreviewUrl(url);
    } catch (error) {
      console.error("Preview error:", error);
    }
  }, [code, seed, iteration]);

  // Auto-refresh preview
  useEffect(() => {
    if (autoRefresh) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(updatePreview, 500);
    }
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, seed, iteration, autoRefresh, updatePreview]);

  // Initial preview
  useEffect(() => {
    updatePreview();
  }, []);

  const handleReroll = () => {
    setSeed(generateRandomSeed());
  };

  const handleRun = () => {
    updatePreview();
  };

  const handleSave = async () => {
    if (!tezos || !name.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // bootloaderId 0 = svg-js
      const result = await createGenerator(tezos, name.trim(), code, 0);

      if (result.success && result.generatorId) {
        // Navigate to the newly created generator
        navigate(`/generator/svg-js/${result.generatorId}`);
      } else {
        setSaveError(result.error || "Failed to create generator");
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  // Check if we're on mobile (reactive)
  const isMobile = useIsMobile();

  // Mobile layout with tabs
  if (isMobile) {
    return (
      <div className={cn("h-full flex flex-col", className)}>
        {/* Mobile tabs */}
        <div className="flex border-b">
          <button
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              mobileView === "code"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground"
            )}
            onClick={() => setMobileView("code")}
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
            onClick={() => setMobileView("preview")}
          >
            <Eye className="inline mr-2 h-4 w-4" />
            Preview
          </button>
        </div>

        <div className="px-3 py-2 border-b text-xs text-muted-foreground">
          Primary sale fee: {primarySaleFeePercent}%
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mobileView === "code" ? (
            <Editor
              height="100%"
              defaultLanguage="javascript"
              value={code}
              onChange={(value) => setCode(value || "")}
              theme={monacoTheme}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
              }}
            />
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex-1 bg-black">
                {previewUrl && (
                  <iframe
                    src={previewUrl}
                    title="Preview"
                    className="w-full h-full border-0"
                    sandbox="allow-scripts"
                  />
                )}
              </div>
              <div className="p-2 border-t flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleReroll}>
                  <Dices className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleRun}>
                  <Play className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatTez(storageCost.totalMutez)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop layout with resizable panels
  return (
    <div className={cn("h-full", className)}>
      <PanelGroup direction="horizontal">
        {/* Code Editor Panel */}
        <Panel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col">
            {/* Editor toolbar */}
            <div className="flex items-center gap-2 h-10 px-2 border-b">
              <Input
                placeholder="Generator name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="max-w-xs h-7 text-xs"
              />
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {storageCost.totalBytes} bytes •{" "}
                {formatTez(storageCost.totalMutez)} • Primary fee{" "}
                {primarySaleFeePercent}%
              </span>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1">
              <Editor
                height="100%"
                defaultLanguage="javascript"
                value={code}
                onChange={(value) => setCode(value || "")}
                theme={monacoTheme}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                }}
              />
            </div>
          </div>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-1 bg-border hover:bg-muted-foreground/30 transition-colors" />

        {/* Preview Panel */}
        <Panel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col">
            {/* Preview toolbar */}
            <div className="flex items-center gap-2 h-10 px-2 border-b">
              <Button
                size="sm"
                variant="outline"
                onClick={handleReroll}
                title="Random seed"
                className="h-7 w-7 p-0"
              >
                <Dices className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRun}
                title="Run (Ctrl+Enter)"
                className="h-7 w-7 p-0"
              >
                <Play className="h-4 w-4" />
              </Button>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto-refresh
              </label>
              <div className="flex-1" />
              {saveError && (
                <span className="text-xs text-destructive mr-2">
                  {saveError}
                </span>
              )}
              <Button
                size="sm"
                className="h-7"
                disabled={!isConnected || !name.trim() || isSaving}
                title={
                  !isConnected
                    ? "Connect wallet to save"
                    : !name.trim()
                    ? "Enter a name"
                    : "Save generator"
                }
                onClick={handleSave}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>

            {/* Preview frame */}
            <div className="flex-1 bg-black relative">
              {previewUrl && (
                <iframe
                  src={previewUrl}
                  title="Preview"
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                />
              )}
            </div>

            {/* Seed/iteration controls */}
            <div className="p-2 border-t flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Seed</Label>
                <Input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="w-48 font-mono text-xs h-8"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Iteration</Label>
                <Input
                  type="number"
                  value={iteration}
                  onChange={(e) => setIteration(parseInt(e.target.value) || 0)}
                  className="w-20 font-mono text-xs h-8"
                  min={0}
                />
              </div>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
