import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useActivity } from "@/hooks/use-activity";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  getTokenThumbnailUrl,
  getTzktExplorerBaseUrl,
} from "@/config";
import { formatAddress } from "@/services/objkt";

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const eventTime = new Date(timestamp);
  const diffInSeconds = Math.floor(
    (now.getTime() - eventTime.getTime()) / 1000
  );

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h`;
  } else {
    return `${Math.floor(diffInSeconds / 86400)}d`;
  }
}

export function ActivityPage() {
  const { events, isLoading, error } = useActivity({ limit: 50 });
  const tzktExplorerBaseUrl = getTzktExplorerBaseUrl();

  if (error) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Error loading activity</h1>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Activity</h1>
          <p className="text-muted-foreground">Recent mints and sales</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 bg-green-500"></span>
          </span>
          Live
        </div>
      </div>

      {/* Activity Feed */}
      {isLoading ? (
        <div className="border divide-y">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-12 w-12 shrink-0" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border">
          <p>No recent activity found.</p>
        </div>
      ) : (
        <div className="border divide-y">
          {events.map((event) => {
            // Use bootloaderId from event (determined by contract address)
            const thumbnailUrl = getTokenThumbnailUrl(
              event.tokenId,
              event.generatorVersion,
              event.bootloaderId
            );
            const isMint = event.eventType === "mint";

            return (
              <div
                key={event.id}
                className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors"
              >
                {/* Thumbnail */}
                <Link
                  to={`/token/${event.bootloaderId}/${event.tokenId}`}
                  className="shrink-0"
                >
                  <div className="h-12 w-12 bg-muted overflow-hidden">
                    <img
                      src={thumbnailUrl}
                      alt={event.tokenName || `Token #${event.tokenId}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                </Link>

                {/* Bootloader badge */}
                <div className="shrink-0 hidden sm:block">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {event.bootloaderId === "generic-web"
                      ? "web"
                      : event.bootloaderId}
                  </Badge>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/token/${event.bootloaderId}/${event.tokenId}`}
                      className="font-medium hover:underline truncate text-sm"
                    >
                      {event.tokenName || `#${event.tokenId}`}
                    </Link>
                    {event.amount > 1 && (
                      <span className="text-muted-foreground text-xs">
                        ×{event.amount}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {isMint ? "Minted by " : "Sold by "}
                    <Link
                      to={`/profile/${
                        isMint
                          ? event.recipientAddress || event.creatorAddress
                          : event.creatorAddress
                      }`}
                      className="hover:underline"
                    >
                      {isMint
                        ? event.recipientAddress
                          ? event.recipientAlias ||
                            formatAddress(event.recipientAddress)
                          : event.creatorAlias ||
                            formatAddress(event.creatorAddress || "")
                        : event.creatorAlias ||
                          formatAddress(event.creatorAddress || "")}
                    </Link>
                    {!isMint && event.recipientAddress && (
                      <>
                        {" → "}
                        <Link
                          to={`/profile/${event.recipientAddress}`}
                          className="hover:underline"
                        >
                          {event.recipientAlias ||
                            formatAddress(event.recipientAddress)}
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="text-sm font-medium shrink-0 min-w-[60px] text-right">
                  {(() => {
                    const price = event.priceXtz || event.price;
                    if (price === undefined || price === null) {
                      return isMint ? "Free" : "—";
                    }
                    if (price === 0) {
                      return "Free";
                    }
                    return `${(price / 1000000).toFixed(2)} ꜩ`;
                  })()}
                </div>

                {/* Time */}
                <div className="text-xs text-muted-foreground shrink-0 w-8 text-right">
                  {formatTimeAgo(event.timestamp)}
                </div>

                {/* TzKT link */}
                {event.ophash && (
                  <a
                    href={`${tzktExplorerBaseUrl}/${event.ophash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0 hidden sm:block"
                    title="View on TzKT"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
