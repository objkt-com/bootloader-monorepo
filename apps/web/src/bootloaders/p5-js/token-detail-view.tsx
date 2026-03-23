import Editor from "@monaco-editor/react";
import {
  Check,
  Code,
  ExternalLink,
  Eye,
  Loader2,
  Maximize2,
  Share2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getContractAddressForBootloader, getNetworkConfig } from "@/config";
import type { BootloaderTokenDetailViewProps } from "@/bootloaders/page-types";

export function P5JsTokenDetailView({
  token,
  generator,
  ViewerComponent,
  code,
  isCodeLoading = false,
  copied,
  tokenArtifactUrl,
  newVersionPreviewUrl,
  showNewVersionPreview,
  onToggleNewVersionPreview,
  onCopyLink,
  onOpenFullscreen,
  mobileView = "preview",
  onMobileViewChange,
  editorTheme = "light",
}: BootloaderTokenDetailViewProps) {
  const config = getNetworkConfig();

  const previewPanel = (
    <div className="flex flex-col">
      <div className="border rounded-md overflow-hidden flex-1 flex flex-col">
        <div className="h-10 px-3 border-b text-sm font-medium flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span>Artwork</span>
            {newVersionPreviewUrl && (
              <Badge
                variant={showNewVersionPreview ? "default" : "secondary"}
                className="text-xs"
              >
                {showNewVersionPreview
                  ? `v${generator.version} Preview`
                  : `v${token.version ?? 1}`}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {newVersionPreviewUrl && (
              <Button
                variant={showNewVersionPreview ? "default" : "outline"}
                size="sm"
                onClick={onToggleNewVersionPreview}
                className="h-7 px-2 text-xs"
                title={
                  showNewVersionPreview
                    ? "View current version"
                    : "Preview new version"
                }
              >
                <Eye className="h-3 w-3 mr-1" />
                {showNewVersionPreview ? "Current" : `Preview v${generator.version}`}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenFullscreen}
              className="h-7 px-2"
              title="View fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 bg-muted/30 relative overflow-hidden min-h-[420px] md:min-h-[680px]">
          {showNewVersionPreview && newVersionPreviewUrl ? (
            <iframe
              src={newVersionPreviewUrl}
              title={`${generator.name} #${token.iteration} - v${generator.version} Preview`}
              className="absolute inset-0 w-full h-full border-0"
              allow="accelerometer; gyroscope; magnetometer"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : tokenArtifactUrl ? (
            <iframe
              src={tokenArtifactUrl}
              title={`${generator.name} #${token.iteration}`}
              className="absolute inset-0 w-full h-full border-0"
              allow="accelerometer; gyroscope; magnetometer"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <ViewerComponent
              generator={
                token.artifactCid ? { ...generator, cid: token.artifactCid } : generator
              }
              seed={token.seed}
              iteration={token.iteration}
              className="absolute inset-0"
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={onCopyLink} className="h-7">
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-7" asChild>
          <a
            href={`${config.objktUrl}/asset/${getContractAddressForBootloader(
              token.bootloaderId || "svg-js"
            )}/${token.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            objkt
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </div>
    </div>
  );

  const codePanel = (
    <div className="border rounded-md overflow-hidden flex flex-col w-full min-w-0">
      <div className="h-10 flex items-center px-3 border-b text-sm font-medium flex-shrink-0">
        sketch.js
      </div>
      <div className="flex-1 min-h-[420px] md:min-h-[680px]">
        {isCodeLoading && !code ? (
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
  );

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
            "flex flex-col min-w-0",
            mobileView === "preview" ? "hidden md:flex" : ""
          )}
        >
          {codePanel}
        </div>
        <div
          className={cn(
            "flex flex-col min-w-0",
            mobileView === "code" ? "hidden md:flex" : ""
          )}
        >
          {previewPanel}
        </div>
      </div>
    </>
  );
}
