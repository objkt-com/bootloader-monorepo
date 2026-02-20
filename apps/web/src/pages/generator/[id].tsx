import { useState, useMemo, useEffect } from "react";
import {
  useParams,
  Link,
  useNavigate,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import {
  ArrowLeft,
  Dices,
  Share2,
  Check,
  Loader2,
  Settings,
  Trash2,
  Pencil,
  Save,
  X,
  Code,
  Eye,
  Info,
  Clock,
  SlidersHorizontal,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getBootloader } from "@/lib/bootloader-registry";
import type { BootloaderId } from "@/types/bootloader";
import { CONFIG, getPrimarySaleFeePercent } from "@/config";
import { useWallet } from "@/hooks/use-wallet";
import { useGenerator, useGeneratorMetadata } from "@/hooks/use-generators";
import {
  useGeneratorTokens,
  useGeneratorFeatureOptions,
  type GeneratorTokenFilter,
} from "@/hooks/use-tokens";
import { useTheme } from "@/hooks/use-theme";
import { useCountdown, formatCountdown } from "@/hooks/use-countdown";
import { useTokenCardSize } from "@/hooks/use-token-card-size";
import { TokenCard, TokenCardSkeleton } from "@/components/token-card";
import {
  mint,
  setSale,
  deleteGenerator,
  updateGenerator,
  setGenericWebSale,
  mintGenericWeb,
  deleteGenericWebGenerator,
  updateGenericWebGenerator,
} from "@/services/tezos";

// Storage cost constants (matching on-chain behavior)
const MUTEZ_PER_BYTE = 250;
const BASE_MINT_BYTES = 1915;

function getByteLength(str: string): number {
  return new TextEncoder().encode(str || "").length;
}

function estimateMintCost(
  nameBytes: number,
  codeBytes: number,
  authorBytes = 36
) {
  const bytes = BASE_MINT_BYTES + codeBytes + nameBytes + 2 * authorBytes;
  const mutez = bytes * MUTEZ_PER_BYTE;
  return { bytes, mutez, tez: mutez / 1_000_000 };
}

function formatStorageCost(cost: { tez: number; mutez: number }): string {
  if (cost.tez >= 0.01) {
    return `~${cost.tez.toFixed(3)} ꜩ`;
  }
  return `~${cost.mutez.toLocaleString()} μꜩ`;
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { MintSuccessModal } from "@/components/mint-success-modal";
import {
  DropdownMenuCheckboxItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FEATURE_FILTER_ALL = "__bl_filter_all__";
const FEATURE_FILTER_EMPTY = "__bl_filter_empty__";
const GENERATOR_PENDING_RETRY_MAX_ATTEMPTS = 10;
const GENERATOR_PENDING_RETRY_DELAY_MS = 1500;

function generateRandomSeed(): string {
  // Generate a 256-bit (64 char) hex seed like the on-chain format
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function GeneratorDetailPage() {
  const { bootloader: bootloaderParam, id } = useParams<{
    bootloader: string;
    id: string;
  }>();
  const { isConnected, isConnecting, connect, tezos, address, authToken } =
    useWallet();
  const { effectiveTheme } = useTheme();
  const { isLarge: useLargeTokenCards } = useTokenCardSize();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isPendingCreateNavigation = Boolean(
    (location.state as { pendingCreate?: boolean } | null)?.pendingCreate
  );

  // Fetch generator from chain - pass bootloader ID from URL to query the right contract
  const bootloaderId = bootloaderParam as BootloaderId | undefined;
  const { generator, isLoading, error, refetch } = useGenerator(
    id,
    bootloaderId
  );

  const [featureFilters, setFeatureFilters] = useState<Record<string, string>>(
    {}
  );

  const activeFeatureFilters = useMemo<GeneratorTokenFilter[]>(() => {
    if (generator?.bootloaderId !== "generic-web") return [];
    return Object.entries(featureFilters)
      .filter(([, value]) => value && value !== FEATURE_FILTER_ALL)
      .map(([name, value]) => ({
        name,
        value: value === FEATURE_FILTER_EMPTY ? "" : value,
      }));
  }, [featureFilters, generator?.bootloaderId]);

  const {
    options: featureOptions,
    hasFeatures,
    isLoading: featureOptionsLoading,
  } = useGeneratorFeatureOptions(id, generator?.bootloaderId);

  // Fetch tokens/editions for this generator - pass generator to avoid re-fetching
  const {
    tokens,
    total: tokenTotal,
    isLoading: tokensLoading,
    refetch: refetchTokens,
  } = useGeneratorTokens(
    id,
    generator?.bootloaderId,
    12,
    generator,
    activeFeatureFilters
  );

  // Fetch generator metadata from D1 (for descriptions)
  const { metadata: generatorMetadata } = useGeneratorMetadata(
    id,
    bootloaderId
  );

  const [seed, setSeedValue] = useState(() => generateRandomSeed());
  const [iteration] = useState(0);
  const [copied, setCopied] = useState(false);

  // Minting state
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  // Sale configuration state
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [salePrice, setSalePrice] = useState("");
  const [saleEditions, setSaleEditions] = useState("");
  const [salePaused, setSalePaused] = useState(false);
  const [saleStartTime, setSaleStartTime] = useState<string>("");
  const [isSettingSale, setIsSettingSale] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline editing state (for SVG-JS generators)
  const [isEditing, setIsEditing] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Mobile view toggle for code/preview
  const [mobileView, setMobileView] = useState<"code" | "preview">("preview");

  // Reveal modal state
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);
  const [mintedEntropy, setMintedEntropy] = useState<string>("");
  const [mintedIteration, setMintedIteration] = useState<number>(0);
  const [mintedArtifactUri, setMintedArtifactUri] = useState<
    string | undefined
  >();
  const [mintedSeed, setMintedSeed] = useState<string | undefined>();
  const [isRevealPreview, setIsRevealPreview] = useState(false);
  const [hasConsumedMockPurchaseParam, setHasConsumedMockPurchaseParam] =
    useState(false);
  const [pendingRetryAttempt, setPendingRetryAttempt] = useState(0);

  useEffect(() => {
    setPendingRetryAttempt(0);
  }, [id, bootloaderId]);

  const shouldWaitForNewGenerator =
    bootloaderId === "generic-web" &&
    isPendingCreateNavigation &&
    !generator &&
    !error &&
    !isLoading &&
    pendingRetryAttempt < GENERATOR_PENDING_RETRY_MAX_ATTEMPTS;

  useEffect(() => {
    if (!shouldWaitForNewGenerator) return;

    const timeoutId = window.setTimeout(() => {
      setPendingRetryAttempt((prev) => prev + 1);
      void refetch();
    }, GENERATOR_PENDING_RETRY_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [shouldWaitForNewGenerator, refetch]);

  useEffect(() => {
    if (generator?.bootloaderId !== "generic-web") {
      setFeatureFilters({});
      return;
    }

    setFeatureFilters((previous) => {
      const validSelections = new Map<string, Set<string>>();
      for (const option of featureOptions) {
        const values = new Set<string>([FEATURE_FILTER_ALL]);
        for (const item of option.values) {
          values.add(item.value === "" ? FEATURE_FILTER_EMPTY : item.value);
        }
        validSelections.set(option.name, values);
      }

      const next: Record<string, string> = {};
      for (const [name, selected] of Object.entries(previous)) {
        const allowed = validSelections.get(name);
        if (!allowed) continue;
        if (allowed.has(selected)) {
          next[name] = selected;
        }
      }

      return next;
    });
  }, [featureOptions, generator?.bootloaderId]);

  // Check if current user is the creator
  const isCreator =
    address && generator?.creator && address === generator.creator;

  const mockPurchaseEnabled =
    searchParams.get("mockPurchase") === "1" ||
    searchParams.get("mockMint") === "1";
  const mockPurchaseSeed = searchParams.get("mockSeed")?.trim();
  const mockPurchaseIteration = Number.parseInt(
    searchParams.get("mockIteration") || "",
    10
  );

  // Countdown for scheduled drops
  const countdown = useCountdown(generator?.saleStartTime);
  const hasUpcomingDrop = generator?.saleStartTime && !countdown.isExpired;

  // Get bootloader info (needed for inscription fee calculation)
  const bootloader = generator ? getBootloader(generator.bootloaderId) : null;
  const hasSvgCode = bootloader?.features.hasCodeEditor && generator?.code;
  const primarySaleFeePercent =
    generator?.bootloaderId &&
    getPrimarySaleFeePercent(generator.bootloaderId);

  // Calculate inscription fee for SVG-JS generators (must be called before early returns)
  const inscriptionFee = useMemo(() => {
    if (!hasSvgCode || !generator?.code) return "";
    const nameBytes = getByteLength(
      generator.name || `Generator #${generator.id}`
    );
    const encodedCode = encodeURIComponent(generator.code);
    const codeBytes = getByteLength(encodedCode);
    const cost = estimateMintCost(nameBytes, codeBytes);
    return formatStorageCost(cost);
  }, [hasSvgCode, generator?.code, generator?.name, generator?.id]);

  const handleReroll = () => {
    setSeedValue(generateRandomSeed());
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerIndexerForToken = async (tokenId: string) => {
    if (!authToken) return;
    if (CONFIG.network !== "shadownet") return;

    try {
      const baseUrl = CONFIG.sandboxWorkerUrl || "";
      const response = await fetch(
        `${baseUrl}/generic-web/v1/indexer/tokens/${encodeURIComponent(
          tokenId
        )}/trigger?network=shadownet`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.warn(
          "[mint] failed to trigger manual indexer",
          response.status,
          body.slice(0, 200)
        );
      }
    } catch (error) {
      console.warn("[mint] failed to trigger manual indexer", error);
    }
  };

  const handleMint = async () => {
    if (!tezos || !generator || !id) return;

    setIsMinting(true);
    setMintError(null);

    try {
      // Use the correct mint function based on bootloader type
      const result =
        generator.bootloaderId === "generic-web"
          ? await mintGenericWeb(tezos, id, generator.price || 0)
          : await mint(tezos, id, generator.price || 0);

      if (result.success) {
        if (generator.bootloaderId === "generic-web" && result.tokenId) {
          await triggerIndexerForToken(result.tokenId);
          setTimeout(() => {
            void refetchTokens();
          }, 2500);
          setTimeout(() => {
            void refetchTokens();
          }, 7000);
        }

        // Show the reveal modal with the minted token
        if (result.tokenId && result.entropy) {
          setIsRevealPreview(false);
          setMintedTokenId(result.tokenId);
          setMintedEntropy(result.entropy);
          // Iteration is the next number after current supply
          setMintedIteration((generator?.supply ?? 0) + 1);
          // Store artifactUri for SVG-JS and seed for generic-web (from operation results)
          setMintedArtifactUri(result.artifactUri);
          setMintedSeed(result.seed);
          setRevealModalOpen(true);
        } else {
          // Only refresh immediately if we are not showing the reveal modal.
          await refetchTokens();
          await refetch();
        }
      } else {
        setMintError(result.error || "Failed to mint");
      }
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsMinting(false);
    }
  };

  useEffect(() => {
    setHasConsumedMockPurchaseParam(false);
  }, [id, mockPurchaseEnabled, mockPurchaseIteration, mockPurchaseSeed]);

  useEffect(() => {
    if (!generator) return;
    if (!mockPurchaseEnabled) return;
    if (hasConsumedMockPurchaseParam) return;

    const previewEntropy = (() => {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      return `0x${Array.from(bytes, (value) =>
        value.toString(16).padStart(2, "0")
      ).join("")}`;
    })();

    const fallbackIteration = (generator.supply ?? 0) + 1;
    const previewIteration =
      Number.isFinite(mockPurchaseIteration) && mockPurchaseIteration > 0
        ? mockPurchaseIteration
        : fallbackIteration;

    setIsRevealPreview(true);
    setMintedTokenId(`preview-${generator.id}`);
    setMintedEntropy(previewEntropy);
    setMintedIteration(previewIteration);
    setMintedArtifactUri(undefined);
    setMintedSeed(mockPurchaseSeed || seed);
    setRevealModalOpen(true);
    setHasConsumedMockPurchaseParam(true);
  }, [
    generator,
    hasConsumedMockPurchaseParam,
    mockPurchaseEnabled,
    mockPurchaseIteration,
    mockPurchaseSeed,
    seed,
  ]);

  const handleSetSale = async () => {
    if (!tezos || !id || !generator) return;

    setIsSettingSale(true);
    setSaleError(null);

    try {
      const priceInMutez = Math.floor(parseFloat(salePrice || "0") * 1_000_000);
      const editions = parseInt(saleEditions || "0");
      // Convert local datetime to ISO string for the contract
      const startTimeIso = saleStartTime
        ? new Date(saleStartTime).toISOString()
        : null;

      // Use the correct sale function based on bootloader type
      const result =
        generator.bootloaderId === "generic-web"
          ? await setGenericWebSale(
              tezos,
              id,
              priceInMutez,
              editions,
              salePaused,
              startTimeIso
            )
          : await setSale(
              tezos,
              id,
              priceInMutez,
              editions,
              salePaused,
              startTimeIso
            );

      if (result.success) {
        setSaleDialogOpen(false);
        await refetch();
      } else {
        setSaleError(result.error || "Failed to set sale");
      }
    } catch (err) {
      setSaleError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSettingSale(false);
    }
  };

  const handleDelete = async () => {
    if (!tezos || !id || !generator) return;

    setIsDeleting(true);

    try {
      // Use the correct delete function based on bootloader type
      const result =
        generator.bootloaderId === "generic-web"
          ? await deleteGenericWebGenerator(tezos, id)
          : await deleteGenerator(tezos, id);

      if (result.success) {
        navigate("/explore");
      } else {
        alert(result.error || "Failed to delete generator");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Initialize sale form when dialog opens
  const openSaleDialog = () => {
    if (generator) {
      setSalePrice(
        generator.price ? (generator.price / 1_000_000).toString() : "0"
      );
      setSaleEditions(
        generator.maxSupply !== undefined && generator.maxSupply !== null
          ? generator.maxSupply.toString()
          : "100"
      );
      // Default to current state, but don't enable pause by default for new generators
      setSalePaused(
        generator.mintingOpen === false &&
          generator.supply !== undefined &&
          generator.supply > 0
      );
      // Initialize start time from existing value or empty
      setSaleStartTime(generator.saleStartTime || "");
      setSaleError(null);
    }
    setSaleDialogOpen(true);
  };

  // Inline edit handlers for SVG-JS generators
  const startEditing = () => {
    if (generator) {
      setEditName(generator.name);
      setEditCode(generator.code || "");
      setEditError(null);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditCode("");
    setEditName("");
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!tezos || !id || !editName.trim() || !generator) return;

    setIsSavingEdit(true);
    setEditError(null);

    try {
      // Use the correct update function based on bootloader type
      // For generic-web, we need to pass the CID instead of code
      const result =
        generator.bootloaderId === "generic-web"
          ? await updateGenericWebGenerator(
              tezos,
              id,
              editName.trim(),
              generator.cid || ""
            )
          : await updateGenerator(tezos, id, editName.trim(), editCode);

      if (result.success) {
        setIsEditing(false);
        await refetch();
      } else {
        setEditError(result.error || "Failed to update generator");
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSavingEdit(false);
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
            Back to Explore
          </Link>
        </div>
        <div className="container pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Skeleton className="aspect-video" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error or not found
  if (shouldWaitForNewGenerator) {
    return (
      <div className="container py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-4">Finalizing generator</h1>
        <p className="text-muted-foreground mb-8">
          The transaction is confirmed, but indexing can take a few seconds.
          This page will refresh automatically.
        </p>
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

  if (!bootloader) {
    return (
      <div className="container py-16 text-center">
        <p className="text-muted-foreground">Unknown bootloader type</p>
      </div>
    );
  }

  const ViewerComponent = bootloader.ViewerComponent;
  const tokenGridClass = useLargeTokenCards
    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4";

  // For editing, use editCode; otherwise use generator.code
  const displayCode = isEditing ? editCode : generator.code || "";

  return (
    <div className="min-h-screen">
      {/* Back link */}
      <div className="container py-4">
        <Link
          to="/explore"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Explore
        </Link>
      </div>

      <div className="container pb-16">
        {/* Header with title and edit controls */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold mb-2 h-auto py-1"
                placeholder="Generator name"
              />
            ) : (
              <h1 className="text-2xl font-bold mb-2 break-words">
                {generator.name}
              </h1>
            )}
            <p className="text-muted-foreground">
              by{" "}
              <Link
                to={`/profile/${generator.creator}`}
                className="hover:text-foreground"
              >
                {generator.creatorName ||
                  generator.creator.slice(0, 10) + "..."}
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{bootloader.name}</Badge>
            {isCreator && hasSvgCode && !isEditing && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {isCreator && generator.bootloaderId === "generic-web" && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/generator/generic-web/${generator.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
            {isEditing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEditing}
                  disabled={isSavingEdit}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveEdit}
                  disabled={isSavingEdit || !editName.trim()}
                >
                  {isSavingEdit ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isSavingEdit ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>

        {editError && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive border border-destructive/20 text-sm">
            {editError}
          </div>
        )}

        {/* Main content: Side-by-side for SVG-JS, or just preview for others */}
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

            {/* Side-by-side layout for desktop, toggled for mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {/* Code Editor */}
              <div
                className={`border rounded-md overflow-hidden flex flex-col ${
                  mobileView === "preview" ? "hidden md:flex" : ""
                }`}
              >
                <div className="h-10 flex items-center px-3 border-b text-sm font-medium flex-shrink-0">
                  Code{" "}
                  {isEditing && (
                    <span className="text-muted-foreground">(editing)</span>
                  )}
                </div>
                <div className="flex-1 min-h-[400px] md:min-h-[600px]">
                  <Editor
                    key={effectiveTheme}
                    height="100%"
                    defaultLanguage="javascript"
                    value={displayCode}
                    onChange={(value) => isEditing && setEditCode(value || "")}
                    theme={effectiveTheme === "dark" ? "vs-dark" : "light"}
                    options={{
                      readOnly: !isEditing,
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
                    <span>Preview</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReroll}
                        className="h-7 px-2"
                      >
                        <Dices className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 bg-muted/30 relative overflow-hidden min-h-[400px] md:min-h-[600px] flex items-center justify-center">
                    <div className="w-full h-full max-w-full max-h-full aspect-square">
                      {revealModalOpen ? (
                        <div className="w-full h-full bg-black" />
                      ) : (
                        <ViewerComponent
                          generator={
                            isEditing
                              ? { ...generator, code: editCode }
                              : generator
                          }
                          seed={seed}
                          iteration={iteration}
                          className="w-full h-full"
                        />
                      )}
                    </div>
                  </div>
                </div>
                {/* Preview controls */}
                <div className="flex items-center gap-4 mt-3 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Seed</Label>
                    <Input
                      value={seed}
                      onChange={(e) => setSeedValue(e.target.value)}
                      className="w-32 font-mono text-xs h-7"
                    />
                  </div>
                  <div className="flex-1" />
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
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Non-SVG generators: full-width preview */
          <div className="mb-8">
            <div className="w-full aspect-square md:aspect-[16/9] bg-black border relative overflow-hidden">
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
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button variant="outline" size="sm" onClick={handleReroll}>
                <Dices className="mr-2 h-4 w-4" />
                Random Seed
              </Button>
              <div className="flex items-center gap-2 min-w-0">
                <Label className="text-xs shrink-0">Seed</Label>
                <Input
                  value={seed}
                  onChange={(e) => setSeedValue(e.target.value)}
                  className="w-32 sm:w-40 font-mono text-xs h-8"
                />
              </div>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={handleCopyLink}>
                {copied ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Share2 className="mr-2 h-4 w-4" />
                )}
                {copied ? "Copied!" : "Share"}
              </Button>
            </div>
          </div>
        )}

        {/* Mint Section - Primary action area */}
        <div className="mb-8 border rounded-lg p-6 bg-card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Price and supply info OR countdown */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {hasUpcomingDrop ? (
                <>
                  {/* Countdown for scheduled drops */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Drops in
                    </p>
                    <div className="flex items-center gap-1.5 font-mono text-2xl font-bold">
                      <Clock className="h-5 w-5 text-primary" />
                      <span>{formatCountdown(countdown)}</span>
                    </div>
                  </div>
                  {generator.price !== undefined && generator.price > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        Price
                      </p>
                      <p className="text-2xl font-bold">
                        {(generator.price / 1_000_000).toFixed(2)} ꜩ
                      </p>
                    </div>
                  )}
                  {(generator.maxSupply ?? 0) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        Supply
                      </p>
                      <p className="text-2xl font-bold">
                        {generator.maxSupply}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Normal minting stats */}
                  {generator.mintingOpen && generator.price !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        Price
                      </p>
                      <p className="text-2xl font-bold">
                        {(generator.price / 1_000_000).toFixed(2)} ꜩ
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Minted
                    </p>
                    <p className="text-2xl font-bold">
                      {generator.supply ?? 0}
                      {generator.maxSupply ? ` / ${generator.maxSupply}` : ""}
                    </p>
                  </div>
                  {(generator.maxSupply ?? 0) > 0 && (
                    <div className="hidden md:block w-64 lg:w-80">
                      <Progress
                        value={
                          ((generator.supply ?? 0) /
                            (generator.maxSupply ?? 1)) *
                          100
                        }
                        className="h-2"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: Mint button and controls */}
            <div className="flex flex-wrap items-center gap-3">
              {generator.mintingOpen ? (
                <>
                  <Button
                    size="lg"
                    disabled={isMinting || isConnecting}
                    onClick={() => {
                      if (!isConnected) {
                        void connect();
                        return;
                      }
                      void handleMint();
                    }}
                  >
                    {isMinting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Minting...
                      </>
                    ) : isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : isConnected ? (
                      (generator.price ?? 0) > 0
                        ? `Mint for ${(generator.price! / 1_000_000).toFixed(2)} ꜩ`
                        : "Mint for Free"
                    ) : (
                      "Connect Wallet"
                    )}
                  </Button>
                  {hasSvgCode && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Info className="h-3 w-3" />
                      <span>+{inscriptionFee} inscription</span>
                    </div>
                  )}
                </>
              ) : hasUpcomingDrop ? (
                <Badge variant="outline" className="text-base px-4 py-2">
                  Scheduled
                </Badge>
              ) : generator.maxSupply &&
                (generator.supply ?? 0) >= generator.maxSupply ? (
                <Badge variant="secondary" className="text-base px-4 py-2">
                  Sold Out
                </Badge>
              ) : generator.price !== undefined && generator.price > 0 ? (
                <Badge variant="outline" className="text-base px-4 py-2">
                  Minting Paused
                </Badge>
              ) : (
                <Badge variant="outline" className="text-base px-4 py-2">
                  Not For Sale
                </Badge>
              )}

              {/* Creator controls */}
              {isCreator && !isEditing && (
                <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={openSaleDialog}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-xl">
                        Configure Sale
                      </DialogTitle>
                      <DialogDescription>
                        Set pricing, supply limits, and schedule your drop.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                      {/* Pricing Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                          Pricing
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="salePrice" className="text-sm">
                              Price
                            </Label>
                            <div className="relative">
                              <Input
                                id="salePrice"
                                type="number"
                                step="0.01"
                                min="0"
                                value={salePrice}
                                onChange={(e) => setSalePrice(e.target.value)}
                                placeholder="0.00"
                                className="pr-8"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                ꜩ
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="saleEditions" className="text-sm">
                              Max Editions
                            </Label>
                            <Input
                              id="saleEditions"
                              type="number"
                              min="0"
                              value={saleEditions}
                              onChange={(e) => setSaleEditions(e.target.value)}
                              placeholder="0 = unlimited"
                            />
                          </div>
                        </div>
                        {primarySaleFeePercent !== undefined && (
                          <p className="text-xs text-muted-foreground">
                            Primary sale fee: {primarySaleFeePercent}% of each
                            mint.
                          </p>
                        )}
                      </div>

                      {/* Schedule Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                          Schedule
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="saleStartTime" className="text-sm">
                              Start Date & Time
                            </Label>
                            <input
                              id="saleStartTime"
                              type="datetime-local"
                              value={saleStartTime}
                              onChange={(e) => setSaleStartTime(e.target.value)}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert"
                            />
                            <p className="text-xs text-muted-foreground">
                              Leave empty to start immediately when unpaused.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Status Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                          Status
                        </div>
                        <label
                          htmlFor="salePaused"
                          className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            id="salePaused"
                            checked={salePaused}
                            onChange={(e) => setSalePaused(e.target.checked)}
                            className="h-4 w-4 border-input"
                          />
                          <div>
                            <div className="font-medium text-sm">
                              Pause Minting
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Temporarily disable minting while keeping settings
                              intact.
                            </div>
                          </div>
                        </label>
                      </div>

                      {saleError && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20">
                          <p className="text-sm text-destructive">
                            {saleError}
                          </p>
                        </div>
                      )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button
                        variant="outline"
                        onClick={() => setSaleDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSetSale} disabled={isSettingSale}>
                        {isSettingSale ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {/* Delete button for creators with no mints */}
              {isCreator && !isEditing && generator.supply === 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Generator?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete the generator from the blockchain.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          {mintError && (
            <p className="text-sm text-destructive mt-4">{mintError}</p>
          )}
        </div>

        {/* Description Section */}
        {(generator.description || generatorMetadata?.generatorDescription) && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              About
            </h3>
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {generator.description || generatorMetadata?.generatorDescription}
            </p>
          </div>
        )}

        {/* Details Grid */}
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Bootloader
            </p>
            <p className="font-medium">{bootloader.name}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Version
            </p>
            <p className="font-medium font-mono">{generator.version ?? 1}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Generator ID
            </p>
            <p className="font-medium font-mono">#{generator.id}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Edition Type
            </p>
            <p className="font-medium">
              {generator.maxSupply ? "Limited" : "Open"}
            </p>
          </div>
        </div>

        {/* Editions section */}
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Editions</h2>
            {generator.bootloaderId === "generic-web" &&
              (featureOptionsLoading || hasFeatures) && (
                <div className="flex items-center gap-2">
                  {activeFeatureFilters.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-6">
                      {activeFeatureFilters.length}
                    </Badge>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 px-3">
                        <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                        Features
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuLabel>Features</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {featureOptionsLoading ? (
                        <DropdownMenuItem disabled>
                          Loading indexed features...
                        </DropdownMenuItem>
                      ) : featureOptions.length === 0 ? (
                        <DropdownMenuItem disabled>
                          No indexed features yet
                        </DropdownMenuItem>
                      ) : (
                        <>
                          {activeFeatureFilters.length > 0 && (
                            <>
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault();
                                  setFeatureFilters({});
                                }}
                              >
                                Clear All Filters
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {featureOptions.map((option) => (
                            <DropdownMenuSub key={option.name}>
                              <DropdownMenuSubTrigger>
                                {option.name}
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-64 max-h-72 overflow-y-auto">
                                <DropdownMenuCheckboxItem
                                  checked={
                                    !featureFilters[option.name] ||
                                    featureFilters[option.name] ===
                                      FEATURE_FILTER_ALL
                                  }
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    setFeatureFilters((previous) => ({
                                      ...previous,
                                      [option.name]: FEATURE_FILTER_ALL,
                                    }));
                                  }}
                                >
                                  All
                                </DropdownMenuCheckboxItem>
                                {option.values.map((item) => {
                                  const value =
                                    item.value === ""
                                      ? FEATURE_FILTER_EMPTY
                                      : item.value;
                                  const label =
                                    item.value === "" ? "(empty)" : item.value;
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={`${option.name}:${value}`}
                                      checked={
                                        featureFilters[option.name] === value
                                      }
                                      onSelect={(event) => {
                                        event.preventDefault();
                                        setFeatureFilters((previous) => ({
                                          ...previous,
                                          [option.name]: value,
                                        }));
                                      }}
                                    >
                                      {label} ({item.count})
                                    </DropdownMenuCheckboxItem>
                                  );
                                })}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
          </div>
          {tokensLoading ? (
            <div className={tokenGridClass}>
              {[...Array(6)].map((_, i) => (
                <TokenCardSkeleton key={i} />
              ))}
            </div>
          ) : tokens.length > 0 ? (
            <div className={tokenGridClass}>
              {tokens.map((token) => (
                <TokenCard key={token.id} token={token} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground border">
              <p>
                {activeFeatureFilters.length > 0
                  ? "No editions match the selected filters"
                  : "No editions minted yet"}
              </p>
              {generator.bootloaderId === "generic-web" &&
                typeof tokenTotal === "number" &&
                tokenTotal > 0 &&
                activeFeatureFilters.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setFeatureFilters({})}
                  >
                    Clear Filters
                  </Button>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Mint Success Modal */}
      {generator && (
        <MintSuccessModal
          isOpen={revealModalOpen && Boolean(mintedTokenId) && Boolean(mintedEntropy)}
          onClose={() => {
            setRevealModalOpen(false);
            setMintedTokenId(null);
            setMintedEntropy("");
            setMintedIteration(0);
            setMintedArtifactUri(undefined);
            setMintedSeed(undefined);
            setIsRevealPreview(false);
            void refetchTokens();
            void refetch();
          }}
          tokenId={mintedTokenId || ""}
          generator={generator}
          entropy={mintedEntropy || "0x"}
          iteration={mintedIteration}
          artifactUri={mintedArtifactUri}
          seed={mintedSeed}
          authorDisplayName={generator.creatorName}
          isPreview={isRevealPreview}
        />
      )}
    </div>
  );
}
