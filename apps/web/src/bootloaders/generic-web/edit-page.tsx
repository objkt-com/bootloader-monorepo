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
import {
  createGenericWebSession,
  createGenericWebSessionFromCid,
  GENERIC_WEB_MAX_RENDER_BATCH,
  GENERIC_WEB_MAX_RENDER_PER_MINUTE,
  generateGenericWebSeed,
  storeGenericWebMetadataRecord,
  uploadGenericWebMetadataJson,
} from "@/bootloaders/generic-web/workflow";
import { useGenericWebRenderJobs } from "@/bootloaders/generic-web/use-render-jobs";
import { buildGenericWebProjectUrl } from "@/bootloaders/generic-web/url";

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
  const [previewSeed, setPreviewSeed] = useState(() => generateGenericWebSeed());
  const [thumbnailSeed, setThumbnailSeed] = useState("");

  // Render state
  const [renderCount, setRenderCount] = useState(1);
  const [renderSpecificSeed, setRenderSpecificSeed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute preview URL - use new CID if uploaded, otherwise current generator CID
  const previewUrl = useMemo(() => {
    const cid = newCid || generator?.cid;
    if (!cid) return null;

    return buildGenericWebProjectUrl({
      cid,
      manifest: newCid ? null : generator?.manifest,
      entry: newCid ? defaultEntry : undefined,
      seed: previewSeed,
      iteration: 0,
    });
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

  const {
    activeRenderCount,
    handleJobClick,
    handleSelectThumbnail,
    isRendering,
    queueRenders,
    renderError,
    renderJobs,
    renderList,
    reset: resetRenderJobs,
    selectedThumbnail,
    setRenderError,
  } = useGenericWebRenderJobs({
    sessionId,
    authToken,
    onPreviewSeed: setPreviewSeed,
    onThumbnailSelected: (job) => {
      if (job.seed) {
        setThumbnailSeed(job.seed);
        setPreviewSeed(job.seed);
      }
    },
  });

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
      const d = await createGenericWebSessionFromCid(cid, authToken);
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

  const handleRender = useCallback(async () => {
    if (!sessionId || !newCid || !authToken) return;

    // In specific-seed mode, always render exactly 1 with the current preview seed
    const count = renderSpecificSeed
      ? 1
      : Math.max(1, Math.min(renderCount, GENERIC_WEB_MAX_RENDER_BATCH));

    await queueRenders({
      count,
      seed: renderSpecificSeed ? previewSeed : undefined,
    });
  }, [
    authToken,
    newCid,
    queueRenders,
    renderCount,
    renderSpecificSeed,
    previewSeed,
    sessionId,
  ]);

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
        const data = await createGenericWebSession(file, authToken);
        setSessionId(data.sessionId);
        setNewCid(data.cid);
        setDefaultEntry(data.defaultEntry);
        setFileCount(data.fileCount);
        resetRenderJobs();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to upload");
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

  const selectedThumbnailJob =
    selectedThumbnail ? renderJobs[selectedThumbnail] : undefined;
  const hasValidThumbnailSelection = Boolean(
    selectedThumbnailJob &&
      selectedThumbnailJob.state === "complete" &&
      selectedThumbnailJob.result?.thumbnailKey &&
      selectedThumbnailJob.seed
  );
  const hasUploadedNewVersion = Boolean(
    newCid &&
      generator?.cid &&
      newCid !== generator.cid
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!tezos || !generator || !id || !name.trim() || !user?.id || !authToken)
      return;

    if (hasUploadedNewVersion && !hasValidThumbnailSelection) {
      setSaveError(
        "Upload a new version, generate renders, and select a valid thumbnail before saving."
      );
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Determine which CID to use (new upload or existing)
      const artifactCid = newCid || generator.cid || "";

      const effectiveThumbnailSeed =
        selectedThumbnailJob?.seed
          ? selectedThumbnailJob.seed
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

      const metadataCid = await uploadGenericWebMetadataJson(
        authToken,
        metadataObj
      );

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
          await storeGenericWebMetadataRecord({
            generatorId: id,
            name: name.trim(),
            artifactCid,
            metadataCid: metadataCid || undefined,
            generatorDescription: generatorDescription.trim() || undefined,
            tokenDescription: tokenDescription.trim() || undefined,
            thumbnailSeed: effectiveThumbnailSeed || undefined,
            authToken,
            tezos,
          });
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
    hasUploadedNewVersion,
    hasValidThumbnailSelection,
    tokenDescription,
    thumbnailSeed,
    selectedThumbnailJob,
    user,
    authToken,
    navigate,
  ]);

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
                onClick={() => setPreviewSeed(generateGenericWebSeed())}
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
                      resetRenderJobs();
                      setRenderError(null);
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
                        activeRenderCount >= GENERIC_WEB_MAX_RENDER_BATCH ||
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
                        type="button"
                        size="sm"
                        onClick={handleRender}
                        disabled={
                          !sessionId ||
                          !newCid ||
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
                    <p className="text-xs text-muted-foreground mb-3">
                      Max {GENERIC_WEB_MAX_RENDER_BATCH} at once, {GENERIC_WEB_MAX_RENDER_PER_MINUTE}
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
                disabled={
                  !isConnected ||
                  !name.trim() ||
                  isSaving ||
                  (hasUploadedNewVersion && !hasValidThumbnailSelection)
                }
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : hasUploadedNewVersion && !hasValidThumbnailSelection ? (
                  "Select a thumbnail to save"
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
            {hasUploadedNewVersion && !hasValidThumbnailSelection && (
              <p className="text-xs text-muted-foreground">
                A completed render must be selected as the thumbnail before a
                new uploaded version can be saved.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
