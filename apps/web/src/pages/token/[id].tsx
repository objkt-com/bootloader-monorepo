import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Share2,
  Check,
  RefreshCw,
  Loader2,
  Maximize2,
  X,
  Code,
  Eye,
} from "lucide-react";
import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getBootloader } from "@/lib/bootloader-registry";
import type { BootloaderId } from "@/types/bootloader";
import { useToken, useTokenFeatures } from "@/hooks/use-tokens";
import { useGeneratorMetadata } from "@/hooks/use-generators";
import { useWallet } from "@/hooks/use-wallet";
import {
  getNetworkConfig,
  getContractAddressForBootloader,
  CONFIG,
} from "@/config";
import { regenerateToken, regenerateGenericWebToken } from "@/services/tezos";
import { useTheme } from "@/hooks/use-theme";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function TokenDetailPage() {
  const { bootloader: bootloaderParam, tokenId } = useParams<{
    bootloader: string;
    tokenId: string;
  }>();
  // Pass bootloader ID from URL to query the right contract
  const bootloaderId = bootloaderParam as BootloaderId | undefined;
  const { token, isLoading, error, refetch } = useToken(tokenId, bootloaderId);
  const { features } = useTokenFeatures(tokenId, bootloaderId);
  const { metadata: generatorMetadata } = useGeneratorMetadata(
    token?.generatorId,
    bootloaderId
  );
  const { address, tezos } = useWallet();
  const { effectiveTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [mobileView, setMobileView] = useState<"code" | "preview">("preview");
  const [showNewVersionPreview, setShowNewVersionPreview] = useState(false);

  const bootloader = token?.generator
    ? getBootloader(token.generator.bootloaderId)
    : null;
  const config = getNetworkConfig();

  // Check if current user is the owner
  const isOwner = address && token?.owner && address === token.owner;

  // Determine Monaco editor theme based on app theme
  const monacoTheme = effectiveTheme === "dark" ? "vs-dark" : "light";

  // Handle escape key for fullscreen
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showFullscreen) {
        setShowFullscreen(false);
      }
    };

    if (showFullscreen) {
      document.addEventListener("keydown", handleEscapeKey);
      return () => document.removeEventListener("keydown", handleEscapeKey);
    }
  }, [showFullscreen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!tezos || !tokenId || !bootloaderId) return;

    setIsRegenerating(true);
    try {
      // Use the correct regenerate function based on bootloader type
      const result =
        bootloaderId === "generic-web"
          ? await regenerateGenericWebToken(tezos, tokenId)
          : await regenerateToken(tezos, tokenId);
      if (result.success) {
        await refetch();
      } else {
        alert(result.error || "Failed to regenerate token");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRegenerating(false);
    }
  };

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
        <div className="container pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="aspect-video" />
            <Skeleton className="h-[500px]" />
          </div>
        </div>
      </div>
    );
  }

  // Error or not found
  if (error || !token || !token.generator) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Token not found</h1>
        <p className="text-muted-foreground mb-8">
          {error?.message || `Token #${tokenId} doesn't exist.`}
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

  if (!bootloader) {
    return (
      <div className="container py-16 text-center">
        <p className="text-muted-foreground">Unknown bootloader type</p>
      </div>
    );
  }

  const generator = token.generator;
  const ViewerComponent = bootloader.ViewerComponent;
  const hasSvgCode = bootloader.features.hasCodeEditor && generator.code;

  // Check if regeneration is possible (newer version available)
  const canRegenerate = (generator.version ?? 1) > (token.version ?? 1);

  // Convert artifact URI to a displayable URL
  // For SVG-JS: artifactUri is a data URI or full URL
  // For generic-web: artifactUri is ipfs://CID?s=SEED&i=ITERATION&p=PARAMS format, needs conversion
  const tokenArtifactUrl = (() => {
    if (!token.artifactUri) return null;

    if (bootloaderId === "generic-web") {
      // Parse the IPFS artifact URI: ipfs://CID?s=SEED&i=ITERATION&p=PARAMS
      // Convert to sandbox worker URL: /ipfs/CID/index.html?s=SEED&i=ITERATION&p=PARAMS
      const artifactUri = token.artifactUri;
      if (artifactUri.startsWith("ipfs://")) {
        const withoutPrefix = artifactUri.slice(7); // Remove 'ipfs://'
        const [cidPart, queryPart] = withoutPrefix.split("?");
        const entry = generator.manifest?.entry || "index.html";
        const baseUrl = CONFIG.sandboxWorkerUrl;
        return queryPart
          ? `${baseUrl}/ipfs/${cidPart}/${entry}?${queryPart}`
          : `${baseUrl}/ipfs/${cidPart}/${entry}`;
      }
    }

    // For SVG-JS and others, use the artifact URI directly
    return token.artifactUri;
  })();

  // URL for previewing the new generator version (using generator's current code/CID)
  const newVersionPreviewUrl = (() => {
    if (!canRegenerate) return null;

    if (bootloaderId === "generic-web" && generator.cid) {
      // For generic-web: use the generator's current CID
      const entry = generator.manifest?.entry || "index.html";
      const baseUrl = CONFIG.sandboxWorkerUrl;
      const params = new URLSearchParams();
      params.set("s", token.seed);
      if (Number.isFinite(token.iteration)) {
        params.set("i", String(Math.trunc(token.iteration)));
      }
      if (token.params) {
        params.set("p", btoa(JSON.stringify(token.params)));
      }
      return `${baseUrl}/ipfs/${generator.cid}/${entry}?${params.toString()}`;
    }

    // For SVG-JS: we can use the ViewerComponent with the generator's current code
    // Return a marker value to indicate we should use the ViewerComponent
    if (bootloaderId === "svg-js" && generator.code) {
      return "use-viewer";
    }

    return null;
  })();

  return (
    <div className="min-h-screen">
      {/* Back link */}
      <div className="container py-4">
        <Link
          to={`/generator/${generator.bootloaderId}/${generator.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {generator.name}
        </Link>
      </div>

      <div className="container pb-16">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold mb-2 break-words">
              {generator.name} #{token.iteration}
            </h1>
            <p className="text-muted-foreground">
              from{" "}
              <Link
                to={`/generator/${generator.bootloaderId}/${generator.id}`}
                className="hover:text-foreground"
              >
                {generator.name}
              </Link>
            </p>
          </div>
          <Badge variant="secondary">{bootloader.name}</Badge>
        </div>

        {/* Main content: Side-by-side for SVG-JS, or preview + info for others */}
        {hasSvgCode ? (
          <>
            {/* Mobile view toggle */}
            <div className="md:hidden flex border-b">
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

            {/* Side-by-side layout for SVG-JS tokens */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {/* Code Editor */}
              <div
                className={`border rounded-md overflow-hidden flex flex-col ${
                  mobileView === "preview" ? "hidden md:flex" : ""
                }`}
              >
                <div className="h-10 flex items-center px-3 border-b text-sm font-medium flex-shrink-0">
                  Code
                </div>
                <div className="flex-1 min-h-[400px] md:min-h-[600px]">
                  <Editor
                    key={monacoTheme}
                    height="100%"
                    defaultLanguage="javascript"
                    value={generator.code}
                    theme={monacoTheme}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                    }}
                  />
                </div>
              </div>

              {/* Preview */}
              <div
                className={`flex flex-col ${
                  mobileView === "code" ? "hidden md:flex" : ""
                }`}
              >
                <div className="border rounded-md overflow-hidden flex-1 flex flex-col">
                  <div className="h-10 px-3 border-b text-sm font-medium flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span>Preview</span>
                      {newVersionPreviewUrl && (
                        <Badge
                          variant={
                            showNewVersionPreview ? "default" : "secondary"
                          }
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
                          variant={
                            showNewVersionPreview ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() =>
                            setShowNewVersionPreview(!showNewVersionPreview)
                          }
                          className="h-7 px-2 text-xs"
                          title={
                            showNewVersionPreview
                              ? "View current version"
                              : "Preview new version"
                          }
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {showNewVersionPreview
                            ? "Current"
                            : `Preview v${generator.version}`}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFullscreen(true)}
                        className="h-7 px-2"
                        title="View fullscreen"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 bg-muted/30 relative overflow-hidden min-h-[400px] md:min-h-[600px] flex items-center justify-center">
                    <div className="w-full h-full max-w-full max-h-full aspect-square">
                      {/* For SVG-JS tokens: show new version preview or the minted version */}
                      {showNewVersionPreview &&
                      newVersionPreviewUrl === "use-viewer" ? (
                        <ViewerComponent
                          generator={generator}
                          seed={token.seed}
                          iteration={token.iteration}
                          className="w-full h-full"
                        />
                      ) : tokenArtifactUrl ? (
                        <iframe
                          src={tokenArtifactUrl}
                          title={`${generator.name} #${token.iteration}`}
                          className="w-full h-full border-0"
                          sandbox="allow-scripts"
                        />
                      ) : (
                        <ViewerComponent
                          generator={
                            token.artifactCid
                              ? { ...generator, cid: token.artifactCid }
                              : generator
                          }
                          seed={token.seed}
                          iteration={token.iteration}
                          className="w-full h-full"
                        />
                      )}
                    </div>
                  </div>
                </div>
                {/* Preview actions */}
                <div className="flex items-center gap-2 mt-3 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLink}
                    className="h-7"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Share2 className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" className="h-7" asChild>
                    <a
                      href={`${
                        config.objktUrl
                      }/asset/${getContractAddressForBootloader(
                        token?.bootloaderId || "svg-js"
                      )}/${tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      objkt
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Non-SVG tokens: full-width preview + info below */
          <>
            <div className="mb-8">
              {/* Full-width artwork */}
              <div className="border rounded-md overflow-hidden">
                <div className="h-10 px-3 border-b text-sm font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>Artwork</span>
                    {newVersionPreviewUrl && (
                      <Badge
                        variant={
                          showNewVersionPreview ? "default" : "secondary"
                        }
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
                        onClick={() =>
                          setShowNewVersionPreview(!showNewVersionPreview)
                        }
                        className="h-7 px-2 text-xs"
                        title={
                          showNewVersionPreview
                            ? "View current version"
                            : "Preview new version"
                        }
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {showNewVersionPreview
                          ? "Current"
                          : `Preview v${generator.version}`}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFullscreen(true)}
                      className="h-7 px-2"
                      title="View fullscreen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="aspect-square md:aspect-[16/9] bg-black relative overflow-hidden">
                  {showNewVersionPreview && newVersionPreviewUrl ? (
                    <iframe
                      src={newVersionPreviewUrl}
                      title={`${generator.name} #${token.iteration} - v${generator.version} Preview`}
                      className="absolute inset-0 w-full h-full border-0"
                      sandbox="allow-scripts"
                    />
                  ) : tokenArtifactUrl ? (
                    <iframe
                      src={tokenArtifactUrl}
                      title={`${generator.name} #${token.iteration}`}
                      className="absolute inset-0 w-full h-full border-0"
                      sandbox="allow-scripts"
                    />
                  ) : (
                    <ViewerComponent
                      generator={
                        token.artifactCid
                          ? { ...generator, cid: token.artifactCid }
                          : generator
                      }
                      seed={token.seed}
                      iteration={token.iteration}
                      className="absolute inset-0"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <Button variant="ghost" size="sm" onClick={handleCopyLink}>
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Share2 className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Copied!" : "Share"}
                </Button>
                <div className="flex-1" />
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`${
                      config.objktUrl
                    }/asset/${getContractAddressForBootloader(
                      token?.bootloaderId || "svg-js"
                    )}/${tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on objkt
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Regenerate banner for owners */}
            {isOwner && canRegenerate && (
              <div className="mb-6 border border-orange-500/30 bg-orange-500/5 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-orange-600 dark:text-orange-400">
                      New Version Available
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Update from v{token.version ?? 1} to v{generator.version}.
                      Your seed stays the same.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isRegenerating}
                        className="border-orange-500/50 hover:bg-orange-500/10 shrink-0"
                      >
                        {isRegenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Regenerate
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Regenerate Token?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will update your token from v{token.version ?? 1}{" "}
                          to v{generator.version ?? 1}. The seed will remain the
                          same, but the visual output may change.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerate}>
                          Regenerate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* Details Grid */}
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Owner
                </p>
                <Link
                  to={`/profile/${token.owner}`}
                  className="font-medium text-sm hover:underline"
                >
                  {token.ownerName ||
                    token.owner.slice(0, 6) + "..." + token.owner.slice(-4)}
                </Link>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Iteration
                </p>
                <p className="font-medium">#{token.iteration}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Version
                </p>
                <p className="font-medium font-mono">{token.version ?? 1}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Creator
                </p>
                <Link
                  to={`/profile/${generator.creator}`}
                  className="font-medium text-sm hover:underline"
                >
                  {generator.creatorName ||
                    generator.creator.slice(0, 6) +
                      "..." +
                      generator.creator.slice(-4)}
                </Link>
              </div>
            </div>

            {/* Seed - collapsible or subtle */}
            <div className="mb-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Seed
              </p>
              <p className="text-xs text-muted-foreground font-mono break-all bg-muted/50 p-3 rounded-lg">
                {token.seed}
              </p>
            </div>

            {/* Token description from generator metadata */}
            {generatorMetadata?.tokenDescription && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  About This Token
                </p>
                <p className="text-base leading-relaxed whitespace-pre-wrap">
                  {generatorMetadata.tokenDescription}
                </p>
              </div>
            )}

            {/* Generator description */}
            {generatorMetadata?.generatorDescription && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  About {generator.name}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {generatorMetadata.generatorDescription}
                </p>
              </div>
            )}

            {/* Features/Attributes for generic-web tokens */}
            {features && Object.keys(features).length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Attributes
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(features).map(([key, value]) => (
                    <div key={key} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        {key}
                      </p>
                      <p
                        className="text-sm font-medium truncate"
                        title={String(value)}
                      >
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Info section for SVG-JS (shown below the preview/code grid) */}
        {hasSvgCode && (
          <>
            {/* Regenerate banner for owners */}
            {isOwner && canRegenerate && (
              <div className="mb-6 border border-orange-500/30 bg-orange-500/5 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-orange-600 dark:text-orange-400">
                      New Version Available
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Update from v{token.version ?? 1} to v{generator.version}.
                      Your seed stays the same.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isRegenerating}
                        className="border-orange-500/50 hover:bg-orange-500/10 shrink-0"
                      >
                        {isRegenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Regenerate
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Regenerate Token?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will update your token from v{token.version ?? 1}{" "}
                          to v{generator.version ?? 1}. The seed will remain the
                          same, but the visual output may change.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerate}>
                          Regenerate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* Details Grid */}
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Owner
                </p>
                <Link
                  to={`/profile/${token.owner}`}
                  className="font-medium text-sm hover:underline"
                >
                  {token.ownerName ||
                    token.owner.slice(0, 6) + "..." + token.owner.slice(-4)}
                </Link>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Iteration
                </p>
                <p className="font-medium">#{token.iteration}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Version
                </p>
                <p className="font-medium font-mono">{token.version ?? 1}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Creator
                </p>
                <Link
                  to={`/profile/${generator.creator}`}
                  className="font-medium text-sm hover:underline"
                >
                  {generator.creatorName ||
                    generator.creator.slice(0, 6) +
                      "..." +
                      generator.creator.slice(-4)}
                </Link>
              </div>
            </div>

            {/* Seed */}
            <div className="mb-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Seed
              </p>
              <p className="text-xs text-muted-foreground font-mono break-all bg-muted/50 p-3 rounded-lg">
                {token.seed}
              </p>
            </div>

            {/* Generator description if available */}
            {generator.description && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  About {generator.name}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {generator.description}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setShowFullscreen(false)}
        >
          <div
            className="relative w-full h-full max-w-[min(90vh,100vw)] max-h-[90vh] m-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 bg-black/50 text-white px-4 py-2 flex items-center justify-between z-10">
              <h2 className="font-medium">
                {generator.name} #{token.iteration}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullscreen(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Artwork */}
            <div className="w-full h-full">
              {tokenArtifactUrl ? (
                <iframe
                  src={tokenArtifactUrl}
                  title={`${generator.name} #${token.iteration}`}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                />
              ) : (
                <ViewerComponent
                  generator={
                    token.artifactCid
                      ? { ...generator, cid: token.artifactCid }
                      : generator
                  }
                  seed={token.seed}
                  iteration={token.iteration}
                  className="w-full h-full"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
