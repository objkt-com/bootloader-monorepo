import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import type { Generator } from "@/types/generator";
import { getBootloader } from "@/lib/bootloader-registry";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getGeneratorThumbnailUrl } from "@/config";
import { StorageBadge } from "@/components/token-card";
import { useCountdown, formatCountdownCompact } from "@/hooks/use-countdown";

interface GeneratorCardProps {
  generator: Generator;
  className?: string;
}

export function GeneratorCard({ generator, className }: GeneratorCardProps) {
  const bootloader = getBootloader(generator.bootloaderId);
  const countdown = useCountdown(generator.saleStartTime);
  const hasUpcomingDrop = generator.saleStartTime && !countdown.isExpired;
  const priceMutez = generator.price ?? null;
  const priceLabel =
    priceMutez === null || priceMutez === undefined
      ? null
      : priceMutez === 0
        ? "Free"
        : `${(priceMutez / 1_000_000).toFixed(2)} XTZ`;

  // Use thumbnail from media CDN - generator thumbnails use /{bootloader}/v1/generator-thumbnail/{id}
  const thumbnailUrl =
    generator.thumbnailUrl ||
    getGeneratorThumbnailUrl(
      generator.id,
      generator.version,
      generator.bootloaderId
    );

  return (
    <Link to={`/generator/${generator.bootloaderId}/${generator.id}`}>
      <Card
        className={cn(
          "h-full overflow-hidden transition-colors hover:bg-accent",
          className
        )}
      >
        {/* Thumbnail */}
        <div className="aspect-square bg-muted relative overflow-hidden">
          <img
            src={thumbnailUrl}
            alt={generator.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Hide broken image icon
              e.currentTarget.style.display = "none";
            }}
          />

          {/* Bootloader badge overlay */}
          {bootloader && (
            <div className="absolute top-2 left-2">
              <Badge
                variant="secondary"
                className="bg-background/80 backdrop-blur-sm text-xs"
              >
                {bootloader.name}
              </Badge>
            </div>
          )}

          {/* Storage type badge */}
          <StorageBadge bootloaderId={generator.bootloaderId} />

          {/* Mint status overlay */}
          {generator.mintingOpen && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="default" className="text-xs">
                Minting Open
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-3">
          <h3 className="font-medium truncate">{generator.name}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {generator.creatorName || generator.creator.slice(0, 8) + "..."}
          </p>

          {/* Countdown for scheduled drops - replaces progress bar */}
          {hasUpcomingDrop ? (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Clock className="h-3 w-3 text-primary" />
              <span className="font-mono font-medium">
                {formatCountdownCompact(countdown)}
              </span>
              {priceLabel && (
                <span className="text-muted-foreground ml-auto">{priceLabel}</span>
              )}
            </div>
          ) : (
            <>
              {/* Progress bar for limited editions */}
              {(generator.maxSupply ?? 0) > 0 && (
                <div className="mt-2">
                  <Progress
                    value={
                      ((generator.supply ?? 0) / (generator.maxSupply ?? 1)) *
                      100
                    }
                    className="h-1.5"
                  />
                </div>
              )}

              {/* Stats row - only show if there's something meaningful to display */}
              {(generator.supply ?? 0) > 0 ||
              (generator.maxSupply ?? 0) > 0 ||
              priceLabel !== null ? (
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  {(generator.maxSupply ?? 0) > 0 ? (
                    <span>
                      {generator.supply ?? 0}/{generator.maxSupply} minted
                    </span>
                  ) : (generator.supply ?? 0) > 0 ? (
                    <span>{generator.supply} minted</span>
                  ) : null}
                  {priceLabel && <span>{priceLabel}</span>}
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function GeneratorCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("h-full overflow-hidden", className)}>
      <Skeleton className="aspect-square" />
      <CardContent className="p-3">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}
