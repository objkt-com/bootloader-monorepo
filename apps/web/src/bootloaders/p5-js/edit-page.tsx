import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  Check,
  Dices,
  Eye,
  FileCode2,
  Image,
  Info,
  Loader2,
  Save,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWallet } from "@/hooks/use-wallet";
import { useGenerator, useGeneratorMetadata } from "@/hooks/use-generators";
import { useEditorLayout } from "@/layouts/editor-layout";
import { updateP5JsGenerator } from "@/services/tezos";
import {
  createGenericWebSession,
  GENERIC_WEB_MAX_RENDER_BATCH,
  generateGenericWebSeed,
  storeGenericWebMetadataRecord,
  uploadGenericWebMetadataJson,
} from "@/bootloaders/generic-web/workflow";
import { useGenericWebRenderJobs } from "@/bootloaders/generic-web/use-render-jobs";
import { buildGenericWebProjectUrl } from "@/bootloaders/generic-web/url";
import {
  buildP5PreviewHtml,
  buildP5TemplateZip,
  DEFAULT_P5_SKETCH,
  fetchP5SketchSource,
} from "./template";
import { P5JsInfoDialog } from "./info-dialog";
import { CONFIG } from "@/config";

export function P5JsEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setHeader } = useEditorLayout();
  const { effectiveTheme } = useTheme();
  const { address, authToken, isConnected, isConnecting, connect, tezos, user } =
    useWallet();
  const isMobile = useIsMobile();
  const monacoTheme = effectiveTheme === "dark" ? "vs-dark" : "light";

  const { generator, isLoading, error, refetch } = useGenerator(id, "p5-js");
  const { metadata } = useGeneratorMetadata(id, "p5-js");

  const [step, setStep] = useState<"edit" | "save">("edit");
  const [mobileView, setMobileView] = useState<"code" | "preview">("code");
  const [name, setName] = useState("");
  const [generatorDescription, setGeneratorDescription] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [code, setCode] = useState(DEFAULT_P5_SKETCH);
  const [seed, setSeed] = useState(() => generateGenericWebSeed());
  const [previewDoc, setPreviewDoc] = useState(() =>
    buildP5PreviewHtml({ sketchCode: DEFAULT_P5_SKETCH, seed })
  );
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingRender, setIsPreparingRender] = useState(false);
  const [renderSessionId, setRenderSessionId] = useState<string | null>(null);
  const [renderCid, setRenderCid] = useState<string | null>(null);
  const [renderEntry, setRenderEntry] = useState<string | null>(null);
  const [renderSessionCode, setRenderSessionCode] = useState("");
  const [pendingRenderRequest, setPendingRenderRequest] = useState<{
    count: number;
    seed?: string;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
  } = useGenericWebRenderJobs({
    sessionId: renderSessionId,
    authToken,
    onPreviewSeed: setSeed,
    onThumbnailSelected: (job) => {
      if (job.seed) {
        setSeed(job.seed);
      }
    },
  });

  const isCreator =
    Boolean(address && generator?.creator) && address === generator?.creator;

  useEffect(() => {
    setHeader({
      title: step === "edit" ? "Write Code" : "Configure Metadata",
      onBack: step === "save" ? () => setStep("edit") : null,
    });

    return () => {
      setHeader({ title: "Edit Generator", onBack: null });
    };
  }, [setHeader, step]);

  useEffect(() => {
    if (generator?.name) {
      setName(generator.name);
    }
  }, [generator?.name]);

  useEffect(() => {
    if (metadata) {
      setGeneratorDescription(metadata.generatorDescription || "");
      setTokenDescription(metadata.tokenDescription || "");
      if (metadata.thumbnailSeed?.trim()) {
        setSeed(metadata.thumbnailSeed.trim());
      }
    }
  }, [metadata]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPreviewDoc(buildP5PreviewHtml({ sketchCode: code, seed }));
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [code, seed]);

  useEffect(() => {
    async function loadSketch() {
      if (!generator?.cid) {
        return;
      }

      try {
        setIsLoadingCode(true);
        const source = await fetchP5SketchSource(generator.cid);
        setCode(source);
      } catch (loadError) {
        console.warn("Failed to load existing sketch source:", loadError);
      } finally {
        setIsLoadingCode(false);
      }
    }

    void loadSketch();
  }, [generator?.cid]);

  useEffect(() => {
    if (renderSessionCode && renderSessionCode !== code) {
      setRenderSessionId(null);
      setRenderCid(null);
      setRenderEntry(null);
      setRenderSessionCode("");
      setPendingRenderRequest(null);
      resetRenderJobs();
    }
  }, [code, renderSessionCode, resetRenderJobs]);

  useEffect(() => {
    if (!pendingRenderRequest || !renderSessionId || !authToken) {
      return;
    }
    const request = pendingRenderRequest;
    setPendingRenderRequest(null);
    void queueRenders(request);
  }, [authToken, pendingRenderRequest, queueRenders, renderSessionId]);

  const handleReroll = () => {
    setSeed(generateGenericWebSeed());
  };

  const ensureRenderSession = useCallback(async () => {
    if (!authToken || !user?.id) {
      throw new Error("Connect wallet to render previews");
    }
    if (renderSessionId && renderSessionCode === code) {
      return;
    }

    setIsPreparingRender(true);
    try {
      const archive = await buildP5TemplateZip(code);
      const session = await createGenericWebSession(archive, authToken);
      resetRenderJobs();
      setRenderSessionId(session.sessionId);
      setRenderCid(session.cid);
      setRenderEntry(session.defaultEntry);
      setRenderSessionCode(code);
    } finally {
      setIsPreparingRender(false);
    }
  }, [authToken, code, renderSessionCode, renderSessionId, resetRenderJobs, user]);

  const handleRenderCurrent = useCallback(async () => {
    try {
      if (!isConnected) {
        await connect();
        return;
      }
      await ensureRenderSession();
      setPendingRenderRequest({ count: 1, seed });
    } catch (renderSetupError) {
      setSaveError(
        renderSetupError instanceof Error
          ? renderSetupError.message
          : "Failed to prepare render"
      );
    }
  }, [connect, ensureRenderSession, isConnected, seed]);

  const handleRenderRandom = useCallback(async () => {
    try {
      if (!isConnected) {
        await connect();
        return;
      }
      await ensureRenderSession();
      setPendingRenderRequest({ count: 1 });
    } catch (renderSetupError) {
      setSaveError(
        renderSetupError instanceof Error
          ? renderSetupError.message
          : "Failed to prepare render"
      );
    }
  }, [connect, ensureRenderSession, isConnected]);

  const handleSave = async () => {
    if (!tezos || !authToken || !user?.id || !id || !name.trim()) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await ensureRenderSession();
      const artifactCid = renderCid;
      if (!artifactCid) {
        throw new Error("Artifact upload is not ready yet");
      }

      const metadataPayload: {
        generator_description?: string;
        token_description?: string;
        thumbnail_seed?: string;
      } = {};
      if (generatorDescription.trim()) {
        metadataPayload.generator_description = generatorDescription.trim();
      }
      if (tokenDescription.trim()) {
        metadataPayload.token_description = tokenDescription.trim();
      }
      if (selectedThumbnail && renderJobs[selectedThumbnail]?.seed) {
        metadataPayload.thumbnail_seed = renderJobs[selectedThumbnail].seed;
      } else if (seed) {
        metadataPayload.thumbnail_seed = seed;
      }

      const metadataCid = await uploadGenericWebMetadataJson(
        authToken,
        metadataPayload
      );
      const result = await updateP5JsGenerator(
        tezos,
        id,
        name.trim(),
        artifactCid,
        metadataCid,
        authToken
      );

      if (!result.success) {
        setSaveError(result.error || "Failed to update generator");
        return;
      }

      try {
        await storeGenericWebMetadataRecord({
          generatorId: id,
          bootloaderId: "p5-js",
          name: name.trim(),
          artifactCid,
          metadataCid: metadataCid || undefined,
          generatorDescription: generatorDescription.trim() || undefined,
          tokenDescription: tokenDescription.trim() || undefined,
          thumbnailSeed:
            (selectedThumbnail && renderJobs[selectedThumbnail]?.seed) ||
            seed ||
            undefined,
          authToken,
          tezos,
        });
      } catch (dbError) {
        console.warn("Failed to update p5-js metadata in D1:", dbError);
      }

      await refetch();
      navigate(`/generator/p5-js/${id}`);
    } catch (saveFailure) {
      setSaveError(
        saveFailure instanceof Error ? saveFailure.message : "Unknown error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenSaveStep = () => {
    setSaveError(null);
    setStep("save");
    if (!renderCid || renderSessionCode !== code) {
      void ensureRenderSession().catch((renderSetupError) => {
        setSaveError(
          renderSetupError instanceof Error
            ? renderSetupError.message
            : "Failed to prepare save step"
        );
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    );
  }

  if (error || !generator) {
    return (
      <div className="container py-10">
        <p className="text-destructive">{error?.message || "Generator not found"}</p>
      </div>
    );
  }

  if (generator.bootloaderId !== "p5-js") {
    return (
      <div className="container py-10">
        <p className="text-muted-foreground">
          This edit page only supports p5-js generators.
        </p>
      </div>
    );
  }

  if (!isCreator) {
    return (
      <div className="container py-10">
        <p className="text-muted-foreground">
          Only the original creator can edit this generator.
        </p>
      </div>
    );
  }

  const metadataSummaryCount =
    Number(Boolean(generatorDescription.trim())) +
    Number(Boolean(tokenDescription.trim()));

  const savePreviewUrl =
    renderCid && step === "save"
      ? buildGenericWebProjectUrl({
          cid: renderCid,
          entry: renderEntry,
          seed,
          iteration: 1,
        })
      : null;

  const renderTiles =
    renderList.length > 0 && renderSessionId ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {renderList.map((job) => (
          <div
            key={job.jobId}
            className={cn(
              "aspect-square border relative cursor-pointer overflow-hidden group",
              selectedThumbnail === job.jobId && "ring-2 ring-primary",
              job.state === "error" && "bg-destructive/10"
            )}
            onClick={() => job.state === "complete" && handleJobClick(job)}
          >
            {job.state === "processing" && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {job.state === "complete" && job.result?.thumbnailKey && (
              <>
                <img
                  src={`${CONFIG.sandboxWorkerUrl}/sessions/${renderSessionId}/render/${job.jobId}/thumbnail?auth=${encodeURIComponent(
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
                      "Use as cover"
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
    ) : null;

  const editStep = (
    <>
      <div className="h-full flex flex-col">
        <div className="h-11 border-b px-3 flex items-center gap-2">
          <span className="text-sm font-medium">sketch.js</span>
          <div className="flex-1" />
          {isLoadingCode && (
            <span className="text-xs text-muted-foreground">
              Loading sketch.js…
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0">
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
              automaticLayout: true,
            }}
          />
        </div>
      </div>

      <div className="h-full flex flex-col">
        <div className="h-11 border-b px-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSeed(generateGenericWebSeed())}
            className="h-8"
          >
            <Dices className="mr-2 h-4 w-4" />
            Reroll
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <Label className="text-xs text-muted-foreground">Seed</Label>
            <Input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              className="h-8 w-52 font-mono text-xs"
            />
          </div>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsInfoDialogOpen(true)}
            className="h-8"
          >
            <Info className="mr-2 h-4 w-4" />
            Info
          </Button>
          <Button size="sm" onClick={handleOpenSaveStep} className="h-8">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Save
            {metadataSummaryCount > 0 ? ` (${metadataSummaryCount})` : ""}
          </Button>
        </div>
        {saveError && (
          <div className="border-b px-3 py-2 text-sm text-destructive">
            {saveError}
          </div>
        )}
        <div className="flex-1 min-h-[640px] bg-black">
          <iframe
            title="p5.js preview"
            srcDoc={previewDoc}
            className="w-full h-full border-0"
            allow="accelerometer; gyroscope; magnetometer"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </>
  );

  const saveStep = (
    <>
      <div className="h-full flex flex-col border-r">
        <div className="h-11 border-b px-3 flex items-center gap-2">
          <span className="text-sm font-medium">Preview</span>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Seed</Label>
            <Input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              className="h-8 w-56 font-mono text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleReroll}
              className="h-8"
            >
              <Dices className="mr-2 h-4 w-4" />
              Reroll
            </Button>
          </div>
        </div>
        <div className="border-b px-3 py-2 text-xs text-muted-foreground">
          {renderCid ? (
            <span className="font-mono break-all">IPFS CID: {renderCid}</span>
          ) : (
            "Uploading artifact…"
          )}
        </div>
        <div className="flex-1 min-h-0 bg-background flex items-center justify-center">
          <div className="aspect-square h-full max-h-full max-w-full w-full">
            {savePreviewUrl ? (
              <iframe
                title="p5.js save preview"
                src={savePreviewUrl}
                className="w-full h-full border-0"
                allow="accelerometer; gyroscope; magnetometer"
                sandbox="allow-scripts"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading artifact…
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-full min-h-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            <div className="border rounded-md p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="generator-title">Title</Label>
                <Input
                  id="generator-title"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Generator title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-description">
                  Collection Page Description
                </Label>
                <Textarea
                  id="collection-description"
                  value={generatorDescription}
                  onChange={(event) => setGeneratorDescription(event.target.value)}
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="per-token-description">Per-token Description</Label>
                <Textarea
                  id="per-token-description"
                  value={tokenDescription}
                  onChange={(event) => setTokenDescription(event.target.value)}
                  rows={5}
                />
              </div>
            </div>

            <div className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Cover Image
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Render a few variations and choose one image that will be used as the generator preview.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void handleRenderCurrent();
                    }}
                    disabled={
                      isPreparingRender ||
                      isRendering ||
                      isConnecting ||
                      !renderCid
                    }
                  >
                    {isPreparingRender || isRendering ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Render Current Seed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void handleRenderRandom();
                    }}
                    disabled={
                      isPreparingRender ||
                      isRendering ||
                      isConnecting ||
                      activeRenderCount >= GENERIC_WEB_MAX_RENDER_BATCH ||
                      !renderCid
                    }
                  >
                    {isPreparingRender || isRendering ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Render Random Seed
                  </Button>
                </div>
              </div>
              {renderError && <p className="text-sm text-destructive">{renderError}</p>}
              {!renderCid ? (
                <p className="text-xs text-muted-foreground">
                  Uploading the current sketch first. Rendering unlocks as soon as the artifact is ready.
                </p>
              ) : (
                renderTiles || (
                  <p className="text-xs text-muted-foreground">
                    Render a few images and choose one as the generator preview.
                  </p>
                )
              )}
            </div>

            <div className="border rounded-md p-4 space-y-3">
              <div className="text-sm font-medium">Ready to Save</div>
              <p className="text-xs text-muted-foreground">
                When everything looks right, save the updated artifact and use the selected cover image.
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setStep("edit")} disabled={isSaving}>
                  Back
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!isConnected || !name.trim() || isSaving || !renderCid}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {!renderCid ? "Waiting for Upload" : "Save"}
                </Button>
              </div>
              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  );

  if (isMobile) {
    if (step === "save") {
      return (
        <div className="h-full flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <div className="border rounded-md overflow-hidden">
                <div className="h-10 px-3 border-b text-sm font-medium flex items-center justify-between">
                  <span>Preview</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReroll}
                    className="h-8"
                  >
                    <Dices className="mr-2 h-4 w-4" />
                    Reroll
                  </Button>
                </div>
                <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                  {renderCid ? (
                    <span className="font-mono break-all">IPFS CID: {renderCid}</span>
                  ) : (
                    "Uploading artifact…"
                  )}
                </div>
                <div className="aspect-square bg-black">
                  {savePreviewUrl ? (
                    <iframe
                      title="p5.js save preview"
                      src={savePreviewUrl}
                      className="w-full h-full border-0"
                      allow="accelerometer; gyroscope; magnetometer"
                      sandbox="allow-scripts"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading artifact…
                    </div>
                  )}
                </div>
              </div>
              <div className="border rounded-md p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile-generator-title">Title</Label>
                  <Input
                    id="mobile-generator-title"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile-generator-description">
                    Collection Page Description
                  </Label>
                  <Textarea
                    id="mobile-generator-description"
                    value={generatorDescription}
                    onChange={(event) => setGeneratorDescription(event.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile-token-description">Per-token Description</Label>
                  <Textarea
                    id="mobile-token-description"
                    value={tokenDescription}
                    onChange={(event) => setTokenDescription(event.target.value)}
                    rows={4}
                  />
                </div>
              </div>
              <div className="border rounded-md p-4 space-y-3">
                <div className="text-sm font-medium">Cover Image</div>
                <p className="text-xs text-muted-foreground">
                  Render a few variations and choose one image that will be used as the generator preview.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void handleRenderCurrent();
                    }}
                    disabled={
                      isPreparingRender ||
                      isRendering ||
                      isConnecting ||
                      !renderCid
                    }
                  >
                    {isPreparingRender || isRendering ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Current
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void handleRenderRandom();
                    }}
                    disabled={
                      isPreparingRender ||
                      isRendering ||
                      isConnecting ||
                      activeRenderCount >= GENERIC_WEB_MAX_RENDER_BATCH ||
                      !renderCid
                    }
                  >
                    {isPreparingRender || isRendering ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Random
                  </Button>
                </div>
                {renderError && <p className="text-sm text-destructive">{renderError}</p>}
                {!renderCid ? (
                  <p className="text-xs text-muted-foreground">
                    Uploading the current sketch first. Rendering unlocks as soon as the artifact is ready.
                  </p>
                ) : (
                  renderTiles || (
                    <p className="text-xs text-muted-foreground">
                      Render a few images and choose one as the generator preview.
                    </p>
                  )
                )}
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleSave}
                  disabled={!isConnected || !name.trim() || isSaving || !renderCid}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {!renderCid ? "Waiting for Upload" : "Save"}
                </Button>
                {saveError && <p className="text-sm text-destructive">{saveError}</p>}
              </div>
            </div>
          </ScrollArea>
          <P5JsInfoDialog
            open={isInfoDialogOpen}
            onOpenChange={setIsInfoDialogOpen}
          />
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
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
            <FileCode2 className="inline mr-2 h-4 w-4" />
            Sketch
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
        <div className="flex-1 min-h-0">
          {mobileView === "code" ? editStep.props.children[0] : editStep.props.children[1]}
        </div>
        <P5JsInfoDialog
          open={isInfoDialogOpen}
          onOpenChange={setIsInfoDialogOpen}
        />
      </div>
    );
  }

  return (
    <div className="h-full">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={step === "edit" ? 48 : 55} minSize={28}>
          {step === "edit" ? editStep.props.children[0] : saveStep.props.children[0]}
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-muted-foreground/30 transition-colors" />
        <Panel defaultSize={step === "edit" ? 52 : 45} minSize={28}>
          {step === "edit" ? editStep.props.children[1] : saveStep.props.children[1]}
        </Panel>
      </PanelGroup>
      <P5JsInfoDialog
        open={isInfoDialogOpen}
        onOpenChange={setIsInfoDialogOpen}
      />
    </div>
  );
}
