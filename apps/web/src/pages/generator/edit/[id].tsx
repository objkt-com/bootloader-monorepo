import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  Loader2,
  Save,
  FileArchive,
  RefreshCw,
  Image,
  Check,
  X,
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useWallet } from "@/hooks/use-wallet";
import { useGenerator, useGeneratorMetadata } from "@/hooks/use-generators";
import { updateGenericWebGenerator } from "@/services/tezos";
import { CONFIG } from "@/config";
import type { BootloaderManifest } from "@/types/bootloader";

// Generate a random seed for preview (16 bytes = 32 hex chars, matching worker format)
function generateRandomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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

const MB = 1024 * 1024;
const MAX_ARCHIVE_SIZE_BYTES = 50 * MB;
const MAX_FILES_PER_ARCHIVE = 2000;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 80 * MB;
const MAX_RENDER_BATCH = 5;
const MAX_RENDER_PER_MINUTE = 10;

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

function formatMegabytes(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`;
}

export function GeneratorEditPage() {
  const { bootloader: bootloaderParam, id } = useParams<{
    bootloader: string;
    id: string;
  }>();
  const { isConnected, tezos, address, user, authToken } = useWallet();
  const navigate = useNavigate();

  // Fetch generator from chain
  const { generator, isLoading, error } = useGenerator(
    id,
    bootloaderParam as "generic-web"
  );

  // Fetch metadata from D1
  const { metadata } = useGeneratorMetadata(id, "generic-web");

  // Form state
  const [name, setName] = useState("");
  const [generatorDescription, setGeneratorDescription] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [newCid, setNewCid] = useState<string | null>(null);
  const [defaultEntry, setDefaultEntry] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Preview state
  const [previewSeed, setPreviewSeed] = useState(() => generateRandomSeed());
  const [thumbnailSeed, setThumbnailSeed] = useState("");

  // Render state
  const [renderJobs, setRenderJobs] = useState<Record<string, RenderJob>>({});
  const [renderCount, setRenderCount] = useState(1);
  const [renderSpecificSeed, setRenderSpecificSeed] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(
    null
  );
  const pollersRef = useRef<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup render pollers on unmount
  useEffect(() => {
    return () => {
      pollersRef.current = {};
    };
  }, []);

  // Compute preview URL - use new CID if uploaded, otherwise current generator CID
  const previewUrl = useMemo(() => {
    const cid = newCid || generator?.cid;
    if (!cid) return null;

    const entry = newCid
      ? defaultEntry || "index.html"
      : generator?.manifest?.entry || "index.html";
    const baseUrl = CONFIG.sandboxWorkerUrl;
    return `${baseUrl}/ipfs/${cid}/${entry}?s=${previewSeed}&i=0`;
  }, [
    newCid,
    defaultEntry,
    generator?.cid,
    generator?.manifest?.entry,
    previewSeed,
  ]);

  // Initialize form with existing data
  useEffect(() => {
    if (generator) {
      setName(generator.name || "");
    }
  }, [generator]);

  useEffect(() => {
    if (metadata) {
      setGeneratorDescription(metadata.generatorDescription || "");
      setTokenDescription(metadata.tokenDescription || "");
      if (metadata.thumbnailSeed?.trim()) {
        setThumbnailSeed(metadata.thumbnailSeed.trim());
      }
    }
  }, [metadata]);

  useEffect(() => {
    setThumbnailSeed((current) => current || previewSeed);
  }, [previewSeed]);

  // Check if current user is the creator
  const isCreator =
    address && generator?.creator && address === generator.creator;

  // Initialize a render session from the existing CID (no new zip needed)
  const [isInitializingSession, setIsInitializingSession] = useState(false);
  const initSessionFromCid = useCallback(async () => {
    const cid = generator?.cid;
    if (!cid || !authToken || sessionId) return;

    setIsInitializingSession(true);
    setRenderError(null);
    try {
      const res = await fetch(`${CONFIG.sandboxWorkerUrl}/sessions/from-cid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ cid }),
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Failed to initialize session" }));
        throw new Error(
          (data as { error?: string }).error || "Failed to initialize session"
        );
      }
      const data = await res.json();
      const d = data as {
        sessionId: string;
        cid: string;
        defaultEntry: string;
        fileCount: number;
      };
      setSessionId(d.sessionId);
      setNewCid(d.cid);
      setDefaultEntry(d.defaultEntry);
      setFileCount(d.fileCount);
    } catch (err) {
      setRenderError(
        err instanceof Error ? err.message : "Failed to initialize session"
      );
    } finally {
      setIsInitializingSession(false);
    }
  }, [generator?.cid, authToken, sessionId]);

  const updateRenderJob = useCallback((jobId: string, job: RenderJob) => {
    setRenderJobs((prev) => ({ ...prev, [jobId]: { ...job, jobId } }));
  }, []);

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
          console.error("Polling render job failed", error);
          pollersRef.current[jobId] = false;
        }
      };

      poll();
    },
    [authToken, sessionId, updateRenderJob]
  );

  const handleRender = useCallback(async () => {
    if (!sessionId || !newCid || !authToken) return;

    // In specific-seed mode, always render exactly 1 with the current preview seed
    const count = renderSpecificSeed
      ? 1
      : Math.max(1, Math.min(renderCount, MAX_RENDER_BATCH));

    try {
      setIsRendering(true);
      setRenderError(null);
      for (let i = 0; i < count; i++) {
        const payload: { seed?: string } = {};
        if (renderSpecificSeed) {
          payload.seed = previewSeed;
        }

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
    } catch (error) {
      setRenderError(
        error instanceof Error ? error.message : "Render request failed"
      );
      console.error("Render request failed", error);
    } finally {
      setIsRendering(false);
    }
  }, [
    authToken,
    newCid,
    pollJob,
    renderCount,
    renderSpecificSeed,
    previewSeed,
    sessionId,
    updateRenderJob,
  ]);

  const handleJobClick = useCallback((job: RenderJob) => {
    if (!job.seed) return;
    setPreviewSeed(job.seed);
  }, []);

  const handleSelectThumbnail = useCallback(
    (jobId: string) => {
      setSelectedThumbnail(jobId);
      const job = renderJobs[jobId];
      if (job?.seed) {
        setThumbnailSeed(job.seed);
        setPreviewSeed(job.seed);
      }
    },
    [renderJobs]
  );

  // Handle file upload
  const handleFile = useCallback(
    async (file: File) => {
      if (!user?.id || !authToken) {
        setUploadError("Please sign in to upload");
        return;
      }

      try {
        setUploadError(null);
        setRenderError(null);
        setIsUploading(true);

        if (!file.name.toLowerCase().endsWith(".zip")) {
          throw new Error("Please upload a .zip archive");
        }

        if (file.size > MAX_ARCHIVE_SIZE_BYTES) {
          throw new Error(
            `Archive is too large (${formatMegabytes(
              file.size
            )}). Max ${formatMegabytes(MAX_ARCHIVE_SIZE_BYTES)} per upload.`
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

        const normalizedEntries: Array<{
          path: string;
          entry: JSZip.JSZipObject;
        }> = [];
        for (const [rawPath, entry] of entries) {
          const normalizedPath = normalizeArchivePath(
            rawPath.replace(/\\/g, "/")
          );
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
          throw new Error(
            "Archive must include index.html at the project root"
          );
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

        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${CONFIG.sandboxWorkerUrl}/sessions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = await res.json();
        setSessionId(data.sessionId);
        setNewCid(data.cid);
        setDefaultEntry(data.defaultEntry);
        setFileCount(data.fileCount);
        setRenderJobs({});
        setSelectedThumbnail(null);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to upload");
        console.error("Upload error:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [authToken, user]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!tezos || !generator || !id || !name.trim() || !user?.id || !authToken)
      return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // Determine which CID to use (new upload or existing)
      const artifactCid = newCid || generator.cid || "";

      const effectiveThumbnailSeed =
        selectedThumbnail && renderJobs[selectedThumbnail]?.seed
          ? renderJobs[selectedThumbnail].seed
          : thumbnailSeed.trim();

      // Create metadata JSON with descriptions
      const metadataObj: {
        generator_description?: string;
        token_description?: string;
        thumbnail_seed?: string;
      } = {};

      if (generatorDescription.trim()) {
        metadataObj.generator_description = generatorDescription.trim();
      }
      if (tokenDescription.trim()) {
        metadataObj.token_description = tokenDescription.trim();
      }
      if (effectiveThumbnailSeed) {
        metadataObj.thumbnail_seed = effectiveThumbnailSeed;
      }

      // Upload metadata to IPFS if we have any descriptions
      let metadataCid = "";
      if (Object.keys(metadataObj).length > 0) {
        const metadataRes = await fetch(
          `${CONFIG.sandboxWorkerUrl}/ipfs/json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(metadataObj),
          }
        );

        if (!metadataRes.ok) {
          const errorText = await metadataRes.text();
          throw new Error(`Failed to upload metadata: ${errorText}`);
        }

        const metadataData = (await metadataRes.json()) as { cid: string };
        metadataCid = metadataData.cid;
      }

      // Call the contract update function
      const result = await updateGenericWebGenerator(
        tezos,
        id,
        name.trim(),
        artifactCid,
        metadataCid
      );

      if (result.success) {
        // Update D1 database
        try {
          const userAddress = await tezos.wallet.pkh();
          await fetch(
            `${CONFIG.sandboxWorkerUrl}/generic-web/v1/generators/${id}/metadata?network=${CONFIG.network}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                name: name.trim(),
                artifactCid: artifactCid.startsWith("ipfs://")
                  ? artifactCid
                  : `ipfs://${artifactCid}`,
                metadataCid: metadataCid || undefined,
                generatorDescription: generatorDescription.trim() || undefined,
                tokenDescription: tokenDescription.trim() || undefined,
                thumbnailSeed: effectiveThumbnailSeed || undefined,
                creatorAddress: userAddress,
              }),
            }
          );
        } catch (dbError) {
          console.warn("Failed to update generator metadata in D1:", dbError);
        }

        // Navigate back to generator page
        navigate(`/generator/generic-web/${id}`);
      } else {
        setSaveError(result.error || "Failed to update generator");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  }, [
    tezos,
    generator,
    id,
    name,
    newCid,
    generatorDescription,
    tokenDescription,
    thumbnailSeed,
    selectedThumbnail,
    renderJobs,
    user,
    authToken,
    navigate,
  ]);

  const renderList = Object.entries(renderJobs)
    .map(([jobId, job]) => ({ ...job, jobId }))
    .sort((a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0));
  const activeRenderCount = renderList.filter(
    (job) => job.state === "pending" || job.state === "processing"
  ).length;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="container py-4">
          <Link
            to="/explore"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </div>
        <div className="container max-w-2xl pb-16">
          <Skeleton className="h-8 w-1/2 mb-8" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // Error or not found
  if (error || !generator) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Generator not found</h1>
        <p className="text-muted-foreground mb-8">
          {error?.message || `The generator "${id}" doesn't exist.`}
        </p>
        <Button asChild>
          <Link to="/explore">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Explore
          </Link>
        </Button>
      </div>
    );
  }

  // Only generic-web generators can be edited here
  if (generator.bootloaderId !== "generic-web") {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Not supported</h1>
        <p className="text-muted-foreground mb-8">
          This edit page is only for generic-web generators.
        </p>
        <Button asChild>
          <Link to={`/generator/${generator.bootloaderId}/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Generator
          </Link>
        </Button>
      </div>
    );
  }

  // Not the creator
  if (!isCreator) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Access denied</h1>
        <p className="text-muted-foreground mb-8">
          Only the creator can edit this generator.
        </p>
        <Button asChild>
          <Link to={`/generator/generic-web/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Generator
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Back link */}
      <div className="container py-4">
        <Link
          to={`/generator/generic-web/${id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Generator
        </Link>
      </div>

      <div className="container pb-16">
        <h1 className="text-2xl font-bold mb-8">Edit Generator</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Preview Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Preview</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewSeed(generateRandomSeed())}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                New Seed
              </Button>
            </div>
            <div className="border rounded-md overflow-hidden aspect-square bg-black">
              {previewUrl ? (
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  title="Generator Preview"
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No preview available
                </div>
              )}
            </div>
            {newCid && (
              <p className="text-sm text-green-600">
                Previewing new uploaded version
              </p>
            )}
            {!newCid && generator?.cid && (
              <p className="text-sm text-muted-foreground">
                Previewing current version
              </p>
            )}
            <div>
              <Label className="block mb-2">Preview Seed</Label>
              <Input
                value={previewSeed}
                maxLength={32}
                onChange={(e) => setPreviewSeed(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Form Section */}
          <div className="space-y-6">
            {/* Name */}
            <div>
              <Label className="block mb-2">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Generator name"
              />
            </div>

            {/* Generator Description */}
            <div>
              <Label className="block mb-2">Generator Description</Label>
              <Textarea
                placeholder="Describe your generator..."
                value={generatorDescription}
                onChange={(e) => setGeneratorDescription(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* Token Description */}
            <div>
              <Label className="block mb-2">Token Description</Label>
              <Textarea
                placeholder="Describe how each token is unique..."
                value={tokenDescription}
                onChange={(e) => setTokenDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will be shown on individual token pages.
              </p>
            </div>

            {/* Thumbnail seed */}
            <div>
              <Label className="block mb-2">Thumbnail Seed</Label>
              <div className="flex gap-2">
                <Input
                  value={thumbnailSeed}
                  maxLength={32}
                  onChange={(e) => setThumbnailSeed(e.target.value)}
                  placeholder="Seed used for generator thumbnail"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setThumbnailSeed(previewSeed)}
                >
                  Use Preview
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This seed controls which output is used for the generator card
                thumbnail.
              </p>
              {!sessionId && !newCid && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={initSessionFromCid}
                  disabled={
                    isInitializingSession || !generator?.cid || !authToken
                  }
                >
                  {isInitializingSession ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Render new thumbnail"
                  )}
                </Button>
              )}
              {renderError && !sessionId && (
                <p className="text-sm text-destructive mt-2">{renderError}</p>
              )}
            </div>

            {/* Upload new project */}
            <div>
              <Label className="block mb-2">
                Update Project Files (optional)
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Upload a new .zip file to replace the generator's code. Leave
                empty to keep the current version.
              </p>

              {newCid ? (
                <div className="border p-4 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <FileArchive className="h-5 w-5 text-foreground" />
                    <span className="font-medium">New project uploaded</span>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Files: {fileCount}</p>
                    <p className="font-mono text-xs break-all">CID: {newCid}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setSessionId(null);
                      setNewCid(null);
                      setDefaultEntry(null);
                      setFileCount(0);
                      setRenderJobs({});
                      setRenderError(null);
                      setSelectedThumbnail(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed cursor-pointer hover:border-foreground transition-colors"
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
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Uploading...
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm">
                        Drop a .zip file or click to browse (max 50 MB)
                      </p>
                    </>
                  )}
                </div>
              )}
              {uploadError && (
                <p className="text-sm text-destructive mt-2">{uploadError}</p>
              )}
            </div>

            {/* Render previews - show when session is active */}
            {sessionId && newCid && (
              <div>
                <Label className="block mb-2 flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Render Previews
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Render candidates and pick one as thumbnail seed.
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
                  <div className="mb-3">
                    <Input
                      value={previewSeed}
                      maxLength={32}
                      onChange={(e) => setPreviewSeed(e.target.value)}
                      placeholder="Seed to render"
                      className="font-mono text-xs h-8 mb-2"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={handleRender}
                      disabled={
                        !sessionId ||
                        !newCid ||
                        !authToken ||
                        isRendering ||
                        activeRenderCount >= MAX_RENDER_BATCH ||
                        !previewSeed.trim()
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
                        type="button"
                        size="sm"
                        onClick={handleRender}
                        disabled={
                          !sessionId ||
                          !newCid ||
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
                    <p className="text-xs text-muted-foreground mb-3">
                      Max {MAX_RENDER_BATCH} at once, {MAX_RENDER_PER_MINUTE}
                      /min.
                    </p>
                  </>
                )}
                {renderError && (
                  <p className="text-sm text-destructive mb-3">{renderError}</p>
                )}
                {renderList.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {renderList.map((job) => (
                      <div
                        key={job.jobId}
                        className={cn(
                          "aspect-square border relative cursor-pointer overflow-hidden group",
                          selectedThumbnail === job.jobId &&
                            "ring-2 ring-primary",
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
                        {job.state === "complete" &&
                          job.result?.thumbnailKey && (
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
                                  type="button"
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
                {renderList.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3 border border-dashed">
                    No renders yet. Click "Render" to generate previews.
                  </p>
                )}
                {renderError && (
                  <p className="text-sm text-destructive mt-2">{renderError}</p>
                )}
              </div>
            )}

            {/* Current CID info */}
            <div className="text-sm text-muted-foreground border-t pt-4">
              <p>
                Current CID:{" "}
                <span className="font-mono text-xs break-all">
                  {generator.cid}
                </span>
              </p>
            </div>

            {/* Save button */}
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link to={`/generator/generic-web/${id}`}>Cancel</Link>
              </Button>
              <Button
                onClick={handleSave}
                disabled={!isConnected || !name.trim() || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
