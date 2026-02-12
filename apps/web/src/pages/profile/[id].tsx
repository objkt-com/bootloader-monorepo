import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Twitter,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GeneratorCard,
  GeneratorCardSkeleton,
} from "@/components/generator-card";
import { useWallet } from "@/hooks/use-wallet";
import { useProfile } from "@/hooks/use-profile";
import { useTokenCardSize } from "@/hooks/use-token-card-size";
import {
  fetchUserProfilesBatch,
  getDisplayName,
  formatAddress,
} from "@/services/objkt";
import { getNetworkConfig, getTokenThumbnailUrl } from "@/config";

export function ProfilePage() {
  const { address } = useParams<{ address: string }>();
  const { address: connectedAddress } = useWallet();
  const {
    profile,
    generators,
    ownedTokens,
    ownedTokensCount,
    isLoading,
    isLoadingTokens,
    hasMoreTokens,
    error,
    loadMoreTokens,
  } = useProfile(address);
  const [copied, setCopied] = useState(false);
  const [creatorDisplayNames, setCreatorDisplayNames] = useState<
    Record<string, string>
  >({});
  const { isLarge: useLargeTokenCards } = useTokenCardSize();
  const config = getNetworkConfig();
  const createdGeneratorGridClass = useLargeTokenCards
    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4"
    : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4";
  const collectedTokenGridClass = useLargeTokenCards
    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4"
    : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4";

  const isOwnProfile = address === connectedAddress;
  const displayName = getDisplayName(profile, address);

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Get objkt domain based on network
  const objktDomain = config.tzktApi.includes("ghostnet")
    ? "ghostnet.objkt.com"
    : "objkt.com";

  useEffect(() => {
    let cancelled = false;

    const creatorAddresses = Array.from(
      new Set(
        ownedTokens.flatMap((token) =>
          token.creators.map((creator) => creator.creator_address)
        )
      )
    ).filter(Boolean);

    if (creatorAddresses.length === 0) {
      setCreatorDisplayNames({});
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const profiles = await fetchUserProfilesBatch(creatorAddresses);
        if (cancelled) return;

        const nextNames: Record<string, string> = {};
        for (const creatorAddress of creatorAddresses) {
          nextNames[creatorAddress] = getDisplayName(
            profiles.get(creatorAddress) || null,
            creatorAddress
          );
        }
        setCreatorDisplayNames(nextNames);
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to resolve token creator display names:", error);
          setCreatorDisplayNames({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownedTokens]);

  if (error) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Error loading profile</h1>
        <p className="text-muted-foreground mb-8">{error.message}</p>
        <Button asChild>
          <Link to="/explore">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Explore
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Link
        to="/explore"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Explore
      </Link>

      {/* Profile header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {profile?.logo ? (
            <img
              src={
                profile.logo.startsWith("ipfs://")
                  ? profile.logo.replace("ipfs://", "https://ipfs.io/ipfs/")
                  : profile.logo
              }
              alt={displayName}
              className="w-16 h-16 bg-muted object-cover"
            />
          ) : (
            <div className="w-16 h-16 bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div>
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-40 mb-2" />
                <Skeleton className="h-4 w-60" />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-2">
                  {displayName}
                  {isOwnProfile && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      (you)
                    </span>
                  )}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-sm text-muted-foreground">
                    {formatAddress(address || "")}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={handleCopyAddress}
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  {profile?.tzdomain && (
                    <span className="text-sm text-muted-foreground">
                      {profile.tzdomain}
                    </span>
                  )}
                </div>
                {profile?.description && (
                  <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                    {profile.description}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Profile links */}
        <div className="flex items-center gap-2 flex-wrap">
          {profile?.twitter && (
            <Button asChild variant="outline" size="sm">
              <a
                href={
                  profile.twitter.startsWith("http")
                    ? profile.twitter
                    : `https://x.com/${profile.twitter}`
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter className="mr-2 h-4 w-4" />
                {profile.twitter.startsWith("http")
                  ? profile.twitter.replace(
                      /^https?:\/\/(x\.com|twitter\.com)\//,
                      ""
                    )
                  : profile.twitter}
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <a
              href={
                profile?.tzdomain
                  ? `https://${objktDomain}/@${profile.tzdomain.replace(
                      ".tez",
                      ""
                    )}`
                  : `https://${objktDomain}/users/${address}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              objkt
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`https://tzkt.io/${address}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              TzKT
            </a>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="created">
        <TabsList>
          <TabsTrigger value="created">
            Created {!isLoading && `(${generators.length})`}
          </TabsTrigger>
          <TabsTrigger value="collected">
            Collected {!isLoading && `(${ownedTokensCount})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="mt-6">
          {isLoading ? (
            <div className={createdGeneratorGridClass}>
              {[...Array(6)].map((_, i) => (
                <GeneratorCardSkeleton key={i} />
              ))}
            </div>
          ) : generators.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border">
              <p>No generators created yet</p>
              {isOwnProfile && (
                <Button asChild variant="link" className="mt-4">
                  <Link to="/create">Create your first generator</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className={createdGeneratorGridClass}>
              {generators.map((generator) => (
                <GeneratorCard
                  key={`${generator.bootloaderId}-${generator.id}`}
                  generator={generator}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="collected" className="mt-6">
          {isLoading ? (
            <div className={collectedTokenGridClass}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="border">
                  <Skeleton className="aspect-square" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : ownedTokens.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border">
              <p>No tokens collected yet</p>
              <Button asChild variant="link" className="mt-4">
                <Link to="/explore">Explore generators</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className={collectedTokenGridClass}>
                {ownedTokens.map((token) => {
                  // Always use our thumbnail service for bootloader tokens
                  const thumbnailUrl = getTokenThumbnailUrl(
                    token.tokenId.toString(),
                    undefined,
                    token.bootloaderId
                  );

                  return (
                    <Link
                      key={token.pk}
                      to={`/token/${token.bootloaderId}/${token.tokenId}`}
                      className="border hover:bg-accent/50 transition-colors block"
                    >
                      <div className="aspect-square bg-muted relative overflow-hidden">
                        <img
                          src={thumbnailUrl}
                          alt={token.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium truncate">
                          {token.name}
                        </p>
                        {token.creators.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            by{" "}
                            {creatorDisplayNames[
                              token.creators[0].creator_address
                            ] ||
                              formatAddress(token.creators[0].creator_address)}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Load more / pagination */}
              {(hasMoreTokens || isLoadingTokens) && (
                <div className="text-center mt-8">
                  <p className="text-sm text-muted-foreground mb-4">
                    Showing {ownedTokens.length} of {ownedTokensCount} tokens
                  </p>
                  {hasMoreTokens && (
                    <Button
                      variant="outline"
                      onClick={loadMoreTokens}
                      disabled={isLoadingTokens}
                    >
                      {isLoadingTokens ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
