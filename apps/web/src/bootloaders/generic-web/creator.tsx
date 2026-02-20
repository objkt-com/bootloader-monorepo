import { useState, useCallback, useRef, useEffect } from "react";
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
import JSZip from "jszip";
import type { Bootloader, BootloaderManifest } from "@/types/bootloader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { CONFIG, getPrimarySaleFeePercent } from "@/config";
import { useWallet } from "@/hooks/use-wallet";
import { createGenericWebGenerator } from "@/services/tezos";

interface GenericWebCreatorProps {
  bootloader: Bootloader;
  className?: string;
}

// Render job types
type RenderJobResult = {
  fullResKey: string;
  thumbnailKey: string;
  mime: string;
  fullResolution?: { x: number; y: number };
  thumbnailResolution?: { x: number; y: number };
  features?: Record<string, unknown> | null;
  params?: Record<string, unknown> | null;
};

type RenderJob = {
  jobId: string;
  state: "pending" | "processing" | "complete" | "error";
  requestedAt?: number;
  completedAt?: number;
  error?: string;
  seed?: string;
  params?: Record<string, unknown> | null;
  result?: RenderJobResult;
};

const MB = 1024 * 1024;
const MAX_ARCHIVE_SIZE_BYTES = 50 * MB;
const MAX_FILES_PER_ARCHIVE = 2000;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 80 * MB;
const MAX_RENDER_BATCH = 5;
const MAX_RENDER_PER_MINUTE = 10;

function formatMegabytes(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`;
}

function normalizeArchivePath(path: string): string | null {
  const parts = path.split(/\\|\//).filter(Boolean);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }

  return stack.join("/");
}

function detectArchiveRootPrefix(paths: string[]): string | null {
  if (!paths.length) return null;

  const firstSegments = paths.map((path) => path.split("/")[0]).filter(Boolean);
  if (firstSegments.length !== paths.length) return null;
  if (paths.some((path) => !path.includes("/"))) return null;

  const candidate = firstSegments[0];
  if (!candidate || !firstSegments.every((segment) => segment === candidate)) {
    return null;
  }
  return candidate;
}

function stripArchivePrefix(path: string, prefix: string | null): string {
  if (!prefix) return path;
  const prefixWithSlash = `${prefix}/`;
  if (!path.startsWith(prefixWithSlash)) return path;
  return path.slice(prefixWithSlash.length);
}

// Generate a random seed
function generateRandomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Validate manifest.json
function validateManifest(raw: unknown): BootloaderManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Manifest must be a JSON object");
  }

  const manifest = raw as Partial<BootloaderManifest>;
  if (manifest.spec !== "boot:web@1.0.0") {
    throw new Error('Manifest spec must be "boot:web@1.0.0"');
  }
  if (manifest.entry !== undefined && manifest.entry !== "index.html") {
    throw new Error('Manifest entry must be "index.html" when provided');
  }

  return manifest as BootloaderManifest;
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
  const [seed, setSeed] = useState(() => generateRandomSeed());
  const [previewNonce, setPreviewNonce] = useState(0);

  // Render state
  const [renderJobs, setRenderJobs] = useState<Record<string, RenderJob>>({});
  const [isRendering, setIsRendering] = useState(false);
  const [renderCount, setRenderCount] = useState(1);
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(
    null
  );
  const pollersRef = useRef<Record<string, boolean>>({});

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
      ? (() => {
          const entry = (defaultEntry ?? "index.html").replace(/^\/+/, "");
          const params = new URLSearchParams();
          params.set("s", seed);
          params.set("i", "0");
          params.set("_", previewNonce.toString());
          return `${
            CONFIG.sandboxWorkerUrl
          }/ipfs/${cid}/${entry}?${params.toString()}`;
        })()
      : null;

  // Cleanup pollers on unmount
  useEffect(() => {
    return () => {
      pollersRef.current = {};
    };
  }, []);

  // Update render job
  const updateRenderJob = useCallback((jobId: string, job: RenderJob) => {
    setRenderJobs((prev) => ({ ...prev, [jobId]: { ...job, jobId } }));
  }, []);

  // Poll for job status
  const pollJob = useCallback(
    (jobId: string) => {
      if (!sessionId || !authToken) return;
      pollersRef.current[jobId] = true;

      const poll = async () => {
        if (!pollersRef.current[jobId]) return;
        try {
          const res = await fetch(
            `${CONFIG.sandboxWorkerUrl}/sessions/${sessionId}/render/${jobId}`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            }
          );
          if (res.status === 404) {
            setTimeout(poll, 1500);
            return;
          }
          if (!res.ok) {
            throw new Error(await res.text());
          }
          const job = (await res.json()) as RenderJob;
          updateRenderJob(jobId, job);
          if (job.state === "complete" || job.state === "error") {
            pollersRef.current[jobId] = false;
          } else {
            setTimeout(poll, 2000);
          }
        } catch (error) {
          console.error("Polling failed", error);
          pollersRef.current[jobId] = false;
        }
      };

      poll();
    },
    [authToken, sessionId, updateRenderJob]
  );

  // Handle render request
  const handleRender = useCallback(async () => {
    if (!sessionId || !cid || !authToken) return;

    const count = Math.max(1, Math.min(renderCount, MAX_RENDER_BATCH));

    try {
      setIsRendering(true);
      const payload = {};

      for (let i = 0; i < count; i++) {
        const res = await fetch(
          `${CONFIG.sandboxWorkerUrl}/sessions/${sessionId}/render`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Render request failed");
        }
        const jobId = data.jobId as string;
        updateRenderJob(jobId, {
          jobId,
          state: "processing",
          requestedAt: Date.now(),
          seed: data.seed,
        });
        pollJob(jobId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render request failed");
      console.error("Render request failed", err);
    } finally {
      setIsRendering(false);
    }
  }, [authToken, sessionId, cid, renderCount, pollJob, updateRenderJob]);

  // Handle file upload
  const handleFile = useCallback(async (file: File) => {
    try {
      setError(null);
      setIsUploading(true);
      setRenderJobs({});
      setSelectedThumbnail(null);

      if (!file.name.toLowerCase().endsWith(".zip")) {
        throw new Error("Please upload a .zip archive");
      }

      if (file.size > MAX_ARCHIVE_SIZE_BYTES) {
        throw new Error(
          `Archive is too large (${formatMegabytes(
            file.size
          )}). Max ${formatMegabytes(
            MAX_ARCHIVE_SIZE_BYTES
          )} per upload until direct uploads are enabled.`
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const entries = Object.entries(zip.files).filter(
        ([path, entry]) => !entry.dir && !path.startsWith("__MACOSX/")
      );

      if (entries.length === 0) {
        throw new Error("Archive contains no files");
      }

      if (entries.length > MAX_FILES_PER_ARCHIVE) {
        throw new Error(
          `Archive has too many files (${entries.length}). Max ${MAX_FILES_PER_ARCHIVE} files per upload.`
        );
      }

      const normalizedEntries: Array<{ path: string; entry: JSZip.JSZipObject }> = [];
      for (const [rawPath, entry] of entries) {
        const normalizedPath = normalizeArchivePath(rawPath.replace(/\\/g, "/"));
        if (!normalizedPath) continue;
        normalizedEntries.push({ path: normalizedPath, entry });
      }

      if (normalizedEntries.length === 0) {
        throw new Error("Archive contains no valid files");
      }

      const rootPrefix = detectArchiveRootPrefix(
        normalizedEntries.map((item) => item.path)
      );
      const projectEntries = normalizedEntries.map((item) => ({
        path: stripArchivePrefix(item.path, rootPrefix),
        entry: item.entry,
      }));

      if (!projectEntries.some((item) => item.path === "index.html")) {
        throw new Error("Archive must include index.html at the project root");
      }

      const manifestEntry = projectEntries.find(
        (item) => item.path === "manifest.json"
      );
      if (manifestEntry) {
        const raw = JSON.parse(await manifestEntry.entry.async("text"));
        validateManifest(raw);
      }

      let totalUncompressedBytes = 0;
      for (const { entry } of normalizedEntries) {
        const content = await entry.async("uint8array");
        totalUncompressedBytes += content.length;
        if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          throw new Error(
            `Archive expands to ${formatMegabytes(
              totalUncompressedBytes
            )}. Max ${formatMegabytes(
              MAX_TOTAL_UNCOMPRESSED_BYTES
            )} uncompressed content per upload.`
          );
        }
      }

      // Upload to sandbox worker (requires authentication)
      if (!user?.id || !authToken) {
        throw new Error("Please sign in to upload projects");
      }

      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `${CONFIG.sandboxWorkerUrl}/sessions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
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
  }, [authToken, user]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleReroll = () => {
    setSeed(generateRandomSeed());
    setPreviewNonce((n) => n + 1);
  };

  const handleReload = () => {
    setPreviewNonce((n) => n + 1);
  };

  // Load seed from a render job
  const handleJobClick = useCallback((job: RenderJob) => {
    if (!job.seed) return;
    setSeed(job.seed);
    setPreviewNonce((n) => n + 1);
  }, []);

  // Select a render as the thumbnail and load its seed
  const handleSelectThumbnail = useCallback(
    (jobId: string) => {
      setSelectedThumbnail(jobId);
      // Also load the seed from the selected thumbnail
      const job = renderJobs[jobId];
      if (job?.seed) {
        setSeed(job.seed);
        setPreviewNonce((n) => n + 1);
      }
    },
    [renderJobs]
  );

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

      // Upload metadata to IPFS if we have any content
      let metadataCid = "";
      if (Object.keys(metadata).length > 0) {
        const metadataRes = await fetch(
          `${CONFIG.sandboxWorkerUrl}/ipfs/json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(metadata),
          }
        );

        if (!metadataRes.ok) {
          const errorText = await metadataRes.text();
          throw new Error(`Failed to upload metadata: ${errorText}`);
        }

        const metadataData = (await metadataRes.json()) as { cid: string };
        metadataCid = metadataData.cid;
      }

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
          const userAddress = await tezos.wallet.pkh();
          await fetch(
            `${CONFIG.sandboxWorkerUrl}/generic-web/v1/generators/${result.generatorId}/metadata?network=${CONFIG.network}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                name: name.trim(),
                artifactCid: cid.startsWith("ipfs://") ? cid : `ipfs://${cid}`,
                metadataCid: metadataCid || undefined,
                generatorDescription: generatorDescription.trim() || undefined,
                tokenDescription: tokenDescription.trim() || undefined,
                creatorAddress: userAddress,
                thumbnailSeed: thumbnailSeed || undefined,
              }),
            }
          );
        } catch (dbError) {
          // Don't fail the whole operation if D1 storage fails
          console.warn("Failed to store generator metadata in D1:", dbError);
        }

        // Navigate to the newly created generator.
        // Contract indexing can lag briefly, so mark this navigation as pending.
        navigate(`/generator/generic-web/${result.generatorId}?pendingCreate=1`, {
          state: {
            pendingCreate: true,
            createdAt: Date.now(),
          },
        });
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

  // Get sorted render list
  const renderList = Object.entries(renderJobs)
    .map(([jobId, job]) => ({ ...job, jobId }))
    .sort((a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0));

  const completedRenders = renderList.filter((job) => job.state === "complete");
  const activeRenderCount = renderList.filter(
    (job) => job.state === "pending" || job.state === "processing"
  ).length;

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
                setRenderJobs({});
                setSelectedThumbnail(null);
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
                Publishing creates your generator on-chain. You can configure
                minting settings after publishing.
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
            <div className="flex items-center gap-2 mb-4">
              <Input
                type="number"
                min="1"
                max={MAX_RENDER_BATCH}
                value={renderCount}
                onChange={(e) =>
                  setRenderCount(
                    Math.max(
                      1,
                      Math.min(
                        Number.parseInt(e.target.value, 10) || 1,
                        MAX_RENDER_BATCH
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
                  activeRenderCount >= MAX_RENDER_BATCH
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
              Max {MAX_RENDER_BATCH} submissions at once, {MAX_RENDER_PER_MINUTE} per minute.
            </p>

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
                          src={`${CONFIG.sandboxWorkerUrl}/sessions/${sessionId}/render/${job.jobId}/thumbnail?auth=${encodeURIComponent(
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
