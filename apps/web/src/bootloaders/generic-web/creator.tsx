import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  Upload,
  Dices,
  RotateCw,
  HelpCircle,
  Eye,
  FileArchive,
  Image,
  Check,
  Loader2,
  X,
  Save,
  Download,
} from "lucide-react";
import type { Bootloader } from "@/types/bootloader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { CONFIG, getPrimarySaleFeePercent } from "@/config";
import { useWallet } from "@/hooks/use-wallet";
import { createGenericWebGenerator } from "@/services/tezos";
import {
  createGenericWebSession,
  GENERIC_WEB_MAX_RENDER_BATCH,
  GENERIC_WEB_MAX_RENDER_PER_MINUTE,
  generateGenericWebSeed,
  storeGenericWebMetadataRecord,
  uploadGenericWebMetadataJson,
} from "./workflow";
import { useGenericWebRenderJobs } from "./use-render-jobs";
import { buildGenericWebProjectUrl } from "./url";

interface GenericWebCreatorProps {
  bootloader: Bootloader;
  className?: string;
}

export function GenericWebCreator({ className }: GenericWebCreatorProps) {
  const { isConnected, tezos, user, authToken } = useWallet();
  const navigate = useNavigate();
  const primarySaleFeePercent = getPrimarySaleFeePercent("generic-web");

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [defaultEntry, setDefaultEntry] = useState<string | null>(null);

  // Generator metadata
  const [name, setName] = useState("");
  const [generatorDescription, setGeneratorDescription] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");

  // Preview state
  const [seed, setSeed] = useState(() => generateGenericWebSeed());
  const [previewNonce, setPreviewNonce] = useState(0);

  // Render state
  const [renderCount, setRenderCount] = useState(1);
  const [renderSpecificSeed, setRenderSpecificSeed] = useState(false);

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // UI state
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<
    "upload" | "preview" | "renders"
  >("upload");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build preview URL
  const previewUrl =
    sessionId && cid
      ? buildGenericWebProjectUrl({
          cid,
          entry: defaultEntry,
          seed,
          iteration: 0,
          cacheBust: previewNonce,
        })
      : null;

  const {
    activeRenderCount,
    handleJobClick,
    handleSelectThumbnail,
    isRendering,
    queueRenders,
    renderJobs,
    renderList,
    renderError,
    reset: resetRenderJobs,
    selectedThumbnail,
  } = useGenericWebRenderJobs({
    sessionId,
    authToken,
    onPreviewSeed: (nextSeed) => {
      setSeed(nextSeed);
      setPreviewNonce((value) => value + 1);
    },
    onThumbnailSelected: (job) => {
      if (!job.seed) return;
      setSeed(job.seed);
      setPreviewNonce((value) => value + 1);
    },
  });

  // Handle render request
  const handleRender = useCallback(async () => {
    if (!sessionId || !cid || !authToken) return;

    // In specific-seed mode, always render exactly 1 with the current preview seed
    const count = renderSpecificSeed
      ? 1
      : Math.max(1, Math.min(renderCount, GENERIC_WEB_MAX_RENDER_BATCH));

    await queueRenders({
      count,
      seed: renderSpecificSeed ? seed : undefined,
    });
  }, [
    authToken,
    cid,
    queueRenders,
    renderCount,
    renderSpecificSeed,
    seed,
    sessionId,
  ]);

  // Handle file upload
  const handleFile = useCallback(
    async (file: File) => {
      try {
        setError(null);
        setIsUploading(true);
        if (!user?.id || !authToken) {
          throw new Error("Please sign in to upload projects");
        }
        resetRenderJobs();

        const data = await createGenericWebSession(file, authToken);
        setSessionId(data.sessionId);
        setCid(data.cid);
        setDefaultEntry(data.defaultEntry);
        setFileCount(data.fileCount);

        setPreviewNonce((n) => n + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload");
        console.error("Upload error:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [authToken, resetRenderJobs, user]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleReroll = () => {
    setSeed(generateGenericWebSeed());
    setPreviewNonce((n) => n + 1);
  };

  const handleReload = () => {
    setPreviewNonce((n) => n + 1);
  };

  // Publish generator on-chain
  const handlePublish = useCallback(async () => {
    if (!tezos || !cid || !name.trim() || !user?.id || !authToken) return;

    setIsPublishing(true);
    setPublishError(null);

    try {
      // Get the thumbnail seed - either from selected render or current preview seed
      const thumbnailSeed =
        selectedThumbnail && renderJobs[selectedThumbnail]?.seed
          ? renderJobs[selectedThumbnail].seed
          : seed;

      // Create metadata JSON with descriptions and thumbnail seed
      const metadata: {
        generator_description?: string;
        token_description?: string;
        thumbnail_seed?: string;
      } = {};

      if (generatorDescription.trim()) {
        metadata.generator_description = generatorDescription.trim();
      }
      if (tokenDescription.trim()) {
        metadata.token_description = tokenDescription.trim();
      }
      if (thumbnailSeed) {
        metadata.thumbnail_seed = thumbnailSeed;
      }

      const metadataCid = await uploadGenericWebMetadataJson(authToken, metadata);

      // Use the generic-web specific contract function with metadata CID
      const result = await createGenericWebGenerator(
        tezos,
        name.trim(),
        cid,
        metadataCid
      );

      if (result.success && result.generatorId) {
        // Store metadata in D1 database for fast retrieval
        try {
          await storeGenericWebMetadataRecord({
            generatorId: result.generatorId,
            name: name.trim(),
            artifactCid: cid,
            metadataCid: metadataCid || undefined,
            generatorDescription: generatorDescription.trim() || undefined,
            tokenDescription: tokenDescription.trim() || undefined,
            thumbnailSeed: thumbnailSeed || undefined,
            authToken,
            tezos,
          });
        } catch (dbError) {
          // Don't fail the whole operation if D1 storage fails
          console.warn("Failed to store generator metadata in D1:", dbError);
        }

        // Navigate to the newly created generator.
        // Contract indexing can lag briefly, so mark this navigation as pending.
        navigate(
          `/generator/generic-web/${result.generatorId}?pendingCreate=1`,
          {
            state: {
              pendingCreate: true,
              createdAt: Date.now(),
            },
          }
        );
      } else {
        setPublishError(result.error || "Failed to create generator");
      }
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsPublishing(false);
    }
  }, [
    tezos,
    cid,
    name,
    generatorDescription,
    tokenDescription,
    user,
    authToken,
    navigate,
    selectedThumbnail,
    renderJobs,
    seed,
  ]);

  const isMobile = useIsMobile();

  const completedRenders = renderList.filter((job) => job.state === "complete");

  // Sidebar content (params or upload zone)
  const renderSidebar = () => (
    <div className="h-full flex flex-col">
      {!sessionId ? (
        // Upload zone - requires sign-in
        !isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed m-4 border-muted">
            <Upload className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="font-medium mb-2 text-muted-foreground">
              Sign in to upload
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Connect your wallet and sign in to upload projects
            </p>
          </div>
        ) : (
          <>
            <div
              className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed m-4 cursor-pointer hover:border-foreground transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-foreground border-t-transparent mb-4" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="font-medium mb-2">Drop a .zip file</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse (max 50 MB)
                  </p>
                </>
              )}
            </div>
            {/* Example downloads */}
            {!isUploading && (
              <div className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Download examples:
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/examples/00-simplest.zip"
                    download
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border hover:bg-muted transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    Simplest
                  </a>
                  <a
                    href="/examples/01-simple-static.zip"
                    download
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border hover:bg-muted transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    Static
                  </a>
                  <a
                    href="/examples/02-explicit-capture.zip"
                    download
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border hover:bg-muted transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    Explicit Capture
                  </a>
                  <a
                    href="/examples/03-animated-gif.zip"
                    download
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border hover:bg-muted transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    Animated GIF
                  </a>
                </div>
              </div>
            )}
          </>
        )
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Project info */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <FileArchive className="h-5 w-5 text-foreground" />
              <span className="font-medium">Project loaded</span>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Files: {fileCount}</p>
              <p>Entry: {defaultEntry || "index.html"}</p>
              <p className="font-mono text-xs break-all">CID: {cid}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSessionId(null);
                setCid(null);
                resetRenderJobs();
                setName("");
                setGeneratorDescription("");
                setTokenDescription("");
              }}
            >
              Upload different file
            </Button>
          </div>

          {/* Generator name & publish */}
          <div className="p-4 border-b">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Save className="h-4 w-4" />
              Publish
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="block mb-2 text-muted-foreground">
                  Generator Name
                </Label>
                <Input
                  placeholder="My Generator"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="block mb-2 text-muted-foreground">
                  Generator Description
                </Label>
                <Textarea
                  placeholder="Describe your generator..."
                  value={generatorDescription}
                  onChange={(e) => setGeneratorDescription(e.target.value)}
                />
              </div>
              <div>
                <Label className="block mb-2 text-muted-foreground">
                  Token Description
                </Label>
                <Textarea
                  placeholder="Describe how each token is unique..."
                  value={tokenDescription}
                  onChange={(e) => setTokenDescription(e.target.value)}
                  className="min-h-[60px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will be shown on individual token pages.
                </p>
              </div>
              {publishError && (
                <p className="text-sm text-destructive">{publishError}</p>
              )}
              <Button
                className="w-full"
                disabled={!isConnected || !cid || !name.trim() || isPublishing}
                onClick={handlePublish}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : !isConnected ? (
                  "Connect wallet to publish"
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Publish Generator
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Publishing creates your generator on-chain. You'll be able to
                set up pricing and editions right after.
              </p>
              <p className="text-xs text-muted-foreground">
                Primary sale fee: {primarySaleFeePercent}% of each mint.
              </p>
            </div>
          </div>

          {/* Render controls */}
          <div className="p-4">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Image className="h-4 w-4" />
              Renders
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate renders to preview outputs and select a thumbnail for
              your generator.
            </p>
            <div className="flex rounded-md border mb-4 text-sm overflow-hidden">
              <button
                type="button"
                className={cn(
                  "flex-1 py-1.5 px-3 text-center transition-colors",
                  !renderSpecificSeed
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setRenderSpecificSeed(false)}
              >
                Random Seeds
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 py-1.5 px-3 text-center transition-colors border-l",
                  renderSpecificSeed
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setRenderSpecificSeed(true)}
              >
                Specific Seed
              </button>
            </div>
            {renderSpecificSeed ? (
              <div className="mb-4">
                <Input
                  value={seed}
                  maxLength={32}
                  onChange={(e) => {
                    setSeed(e.target.value);
                    setPreviewNonce((n) => n + 1);
                  }}
                  placeholder="Seed to render"
                  className="font-mono text-xs h-8 mb-2"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleRender}
                    disabled={
                      !sessionId ||
                      !cid ||
                      !authToken ||
                      isRendering ||
                      activeRenderCount >= GENERIC_WEB_MAX_RENDER_BATCH ||
                      !seed.trim()
                    }
                  >
                  {isRendering ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Rendering...
                    </>
                  ) : (
                    "Render This Seed"
                  )}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    type="number"
                    min="1"
                    max={GENERIC_WEB_MAX_RENDER_BATCH}
                    value={renderCount}
                    onChange={(e) =>
                      setRenderCount(
                        Math.max(
                          1,
                          Math.min(
                            Number.parseInt(e.target.value, 10) || 1,
                            GENERIC_WEB_MAX_RENDER_BATCH
                          )
                        )
                      )
                    }
                    className="w-20 h-8"
                  />
                  <Button
                    size="sm"
                    onClick={handleRender}
                    disabled={
                      !sessionId ||
                      !cid ||
                      !authToken ||
                      isRendering ||
                      activeRenderCount >= GENERIC_WEB_MAX_RENDER_BATCH
                    }
                  >
                    {isRendering ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Rendering...
                      </>
                    ) : (
                      "Render"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Max {GENERIC_WEB_MAX_RENDER_BATCH} at once, {GENERIC_WEB_MAX_RENDER_PER_MINUTE}/min.
                </p>
              </>
            )}

            {renderError && (
              <p className="text-sm text-destructive mb-4">{renderError}</p>
            )}

            {/* Render grid */}
            {renderList.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {renderList.map((job) => (
                  <div
                    key={job.jobId}
                    className={cn(
                      "aspect-square border relative cursor-pointer overflow-hidden group",
                      selectedThumbnail === job.jobId && "ring-2 ring-primary",
                      job.state === "error" && "bg-destructive/10"
                    )}
                    onClick={() =>
                      job.state === "complete" && handleJobClick(job)
                    }
                  >
                    {job.state === "processing" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {job.state === "complete" && job.result?.thumbnailKey && (
                      <>
                        <img
                          src={`${
                            CONFIG.sandboxWorkerUrl
                          }/sessions/${sessionId}/render/${
                            job.jobId
                          }/thumbnail?auth=${encodeURIComponent(
                            authToken || ""
                          )}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectThumbnail(job.jobId);
                            }}
                          >
                            {selectedThumbnail === job.jobId ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Selected
                              </>
                            ) : (
                              "Use as thumbnail"
                            )}
                          </Button>
                          {job.result?.features &&
                            Object.keys(job.result.features).length > 0 && (
                              <div className="text-[10px] text-white/80 text-center max-h-16 overflow-y-auto w-full">
                                {Object.entries(job.result.features).map(
                                  ([key, value]) => (
                                    <div key={key} className="truncate">
                                      {key}: {String(value)}
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                        {selectedThumbnail === job.jobId && (
                          <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </>
                    )}
                    {job.state === "error" && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <X className="h-6 w-6 text-destructive" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {completedRenders.length === 0 && renderList.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 border border-dashed">
                No renders yet. Click "Render" to generate previews.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 border-t">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );

  // Preview content
  const renderPreview = () => (
    <div className="h-full flex flex-col">
      {/* Preview toolbar */}
      <div className="flex items-center gap-2 p-2 border-b">
        <Button
          size="sm"
          variant="outline"
          onClick={handleReroll}
          disabled={!sessionId}
        >
          <Dices className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReload}
          disabled={!sessionId}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <a
          href="/bootloaders/generic-web"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          title="Documentation"
        >
          <HelpCircle className="h-4 w-4" />
        </a>
      </div>

      {/* Preview frame */}
      <div className="flex-1 bg-black relative">
        {previewUrl ? (
          <iframe
            src={previewUrl}
            title="Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <p>Upload a .zip to preview</p>
          </div>
        )}
      </div>

      {/* Seed display */}
      {sessionId && (
        <div className="p-2 border-t flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Seed:</span>
          <Input
            value={seed}
            maxLength={32}
            onChange={(e) => {
              setSeed(e.target.value);
              setPreviewNonce((n) => n + 1);
            }}
            className="flex-1 font-mono text-xs h-7"
          />
        </div>
      )}
    </div>
  );

  // Mobile layout
  if (isMobile) {
    return (
      <div className={cn("h-full flex flex-col", className)}>
        <div className="flex border-b">
          <button
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              mobileView === "upload"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground"
            )}
            onClick={() => setMobileView("upload")}
          >
            <Upload className="inline mr-2 h-4 w-4" />
            Upload
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
          <button
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              mobileView === "renders"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground"
            )}
            onClick={() => setMobileView("renders")}
          >
            <Image className="inline mr-2 h-4 w-4" />
            Renders
            {renderList.length > 0 && (
              <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {renderList.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {mobileView === "upload"
            ? renderSidebar()
            : mobileView === "preview"
            ? renderPreview()
            : renderSidebar()}
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={cn("h-full", className)}>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20} maxSize={50}>
          {renderSidebar()}
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-muted-foreground/30 transition-colors" />
        <Panel defaultSize={70} minSize={40}>
          {renderPreview()}
        </Panel>
      </PanelGroup>
    </div>
  );
}
