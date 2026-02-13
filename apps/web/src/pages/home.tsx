import { Link } from "react-router-dom";
import {
  ArrowRight,
  Github,
  MessageCircle,
  Cpu,
  Code,
  Gamepad2,
  Sparkles,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BootloaderCard } from "@/components/bootloader-card";
import {
  GeneratorCard,
  GeneratorCardSkeleton,
} from "@/components/generator-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllBootloaders } from "@/lib/bootloader-registry";
import { useGenerators } from "@/hooks/use-generators";
import { useActivity } from "@/hooks/use-activity";
import { getTokenThumbnailUrl } from "@/config";
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

export function HomePage() {
  const bootloaders = getAllBootloaders();
  const { generators, isLoading } = useGenerators();
  const { events: recentActivity, isLoading: activityLoading } = useActivity({
    limit: 8,
  });

  // Featured generators: minting open, sorted by most minted (supply)
  const featuredGenerators = generators
    .filter((g) => g.mintingOpen)
    .sort((a, b) => (b.supply ?? 0) - (a.supply ?? 0))
    .slice(0, 6);

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container relative overflow-hidden py-10 md:py-24 lg:py-32">
        <div className="relative z-10 flex flex-col items-center space-y-6 text-center md:space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            bootloader<span className="text-muted-foreground">:</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">
            code based art on the web and beyond.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg">
              <Link to="/explore">
                Explore Generators
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/bootloaders">Browse Bootloaders</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/create">Create</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Generators - Now first */}
      <section className="container border-t py-10 md:py-16">
        <div className="mb-6 flex items-center justify-between md:mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-2">Featured Generators</h2>
            <p className="text-muted-foreground">
              Discover artwork from the community
            </p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/explore">
              Explore all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {isLoading
            ? [...Array(6)].map((_, i) => <GeneratorCardSkeleton key={i} />)
            : featuredGenerators.length > 0
            ? featuredGenerators.map((generator) => (
                <GeneratorCard
                  key={`${generator.bootloaderId}-${generator.id}`}
                  generator={generator}
                />
              ))
            : [...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-muted border flex items-center justify-center text-muted-foreground"
                >
                  <span className="text-sm">No generators yet</span>
                </div>
              ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="container border-t py-10 md:py-16">
        <div className="mb-6 flex items-center justify-between md:mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-2">Recent Activity</h2>
            <p className="text-muted-foreground">Latest mints and sales</p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/activity">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {activityLoading ? (
            [...Array(8)].map((_, i) => (
              <div key={i} className="border">
                <Skeleton className="aspect-square" />
                <div className="p-2 space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))
          ) : recentActivity.length > 0 ? (
            recentActivity.map((event) => {
              // Use bootloaderId from event (determined by contract address)
              const thumbnailUrl = getTokenThumbnailUrl(
                event.tokenId,
                event.generatorVersion,
                event.bootloaderId
              );
              const isMint = event.eventType === "mint";
              const minterLabel = event.recipientAddress
                ? event.recipientAlias || formatAddress(event.recipientAddress)
                : event.creatorAlias || formatAddress(event.creatorAddress || "");

              return (
                <Link
                  key={event.id}
                  to={`/token/${event.bootloaderId}/${event.tokenId}`}
                  className="border hover:bg-accent/50 transition-colors block"
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    <img
                      src={thumbnailUrl}
                      alt={event.tokenName || `Token #${event.tokenId}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="absolute top-1 right-1 p-1 bg-background/80 backdrop-blur-sm border">
                      {isMint ? (
                        <Sparkles className="h-3 w-3 text-yellow-500" />
                      ) : (
                        <Coins className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">
                      {event.tokenName || `#${event.tokenId}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {minterLabel}
                      {" · "}
                      {formatTimeAgo(event.timestamp)}
                    </p>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="col-span-full text-center py-16 text-muted-foreground border">
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </div>
      </section>

      {/* Bootloaders Grid */}
      <section className="container border-t py-10 md:py-16">
        <div className="mb-6 flex items-center justify-between md:mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-2">Bootloaders</h2>
            <p className="text-muted-foreground">
              Choose a runtime for your generative artwork
            </p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/bootloaders">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {bootloaders.map((bootloader) => (
            <BootloaderCard key={bootloader.id} bootloader={bootloader} />
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="container border-t py-10 md:py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">How it Works</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 border flex items-center justify-center">
              <Cpu className="h-8 w-8" />
            </div>
            <h3 className="font-semibold">1. Pick a Bootloader</h3>
            <p className="text-sm text-muted-foreground">
              Choose a runtime that fits your artwork. Each bootloader has
              unique constraints and capabilities.
            </p>
          </div>

          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 border flex items-center justify-center">
              <Code className="h-8 w-8" />
            </div>
            <h3 className="font-semibold">2. Create Your Generator</h3>
            <p className="text-sm text-muted-foreground">
              Write code or upload your project. Preview different outputs with
              different seeds.
            </p>
          </div>

          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 border flex items-center justify-center">
              <Gamepad2 className="h-8 w-8" />
            </div>
            <h3 className="font-semibold">3. Mint & Run</h3>
            <p className="text-sm text-muted-foreground">
              Mint your artwork on-chain. Collectors can view it in emulators or
              on real hardware.
            </p>
          </div>
        </div>
      </section>

      {/* Community CTA */}
      <section className="container border-t py-10 md:py-16">
        <div className="border p-8 md:p-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Open Source</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            bootloader: is fully open source. Contribute generators, build
            bootloader ports, design hardware, or help improve the platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild variant="outline">
              <a
                href="https://github.com/objkt-com/bootloader-monorepo"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://discord.gg/uYye4UY6Ax"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Discord
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
