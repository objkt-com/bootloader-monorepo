import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  GeneratorCard,
  GeneratorCardSkeleton,
} from "@/components/generator-card";
import { getAllBootloaders } from "@/lib/bootloader-registry";
import { useGenerators } from "@/hooks/use-generators";
import { useTokenCardSize } from "@/hooks/use-token-card-size";
import type { BootloaderId } from "@/types/bootloader";

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bootloaders = getAllBootloaders();
  const { isLarge: useLargeCards } = useTokenCardSize();

  // Filter state from URL params
  const bootloaderFilter = searchParams.get(
    "bootloader"
  ) as BootloaderId | null;
  const mintStatus = searchParams.get("status");
  const searchQuery = searchParams.get("q") || "";
  const sortBy = searchParams.get("sort") || "created";

  // Local state for search input
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Fetch generators from chain
  const { generators, isLoading } = useGenerators({
    bootloaderId: bootloaderFilter || undefined,
  });

  // Helper to check if a generator has an upcoming scheduled drop
  const hasScheduledDrop = (gen: (typeof generators)[0]) => {
    if (!gen.saleStartTime) return false;
    return new Date(gen.saleStartTime).getTime() > Date.now();
  };

  // Filter and sort generators
  const filteredGenerators = useMemo(() => {
    let filtered = generators.filter((gen) => {
      if (mintStatus === "open" && !gen.mintingOpen) return false;
      if (mintStatus === "closed" && gen.mintingOpen) return false;
      if (mintStatus === "scheduled" && !hasScheduledDrop(gen)) return false;
      if (
        searchQuery &&
        !gen.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });

    // Apply sorting
    switch (sortBy) {
      case "supply":
        // Most minted first
        filtered = [...filtered].sort(
          (a, b) => (b.supply ?? 0) - (a.supply ?? 0)
        );
        break;
      case "price":
        // Price low to high
        filtered = [...filtered].sort(
          (a, b) => (a.price ?? 0) - (b.price ?? 0)
        );
        break;
      case "created":
      default:
        // Newest first (already sorted by ID descending from API)
        break;
    }

    return filtered;
  }, [generators, mintStatus, searchQuery, sortBy]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams);
    if (localSearch) {
      params.set("q", localSearch);
    } else {
      params.delete("q");
    }
    setSearchParams(params);
  };

  const handleBootloaderChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("bootloader");
    } else {
      params.set("bootloader", value);
    }
    setSearchParams(params);
  };

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    setSearchParams(params);
  };

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("sort", value);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
    setLocalSearch("");
  };

  const hasActiveFilters = bootloaderFilter || mintStatus || searchQuery;
  const generatorGridClass = useLargeCards
    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4"
    : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4";

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Explore Generators</h1>
        <p className="text-muted-foreground">
          Discover generative art from the bootloader: community
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search generators..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} variant="secondary">
            Search
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select
            value={bootloaderFilter || "all"}
            onValueChange={handleBootloaderChange}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Bootloader" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bootloaders</SelectItem>
              {bootloaders.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={mintStatus || "all"}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Minting Open</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="closed">Minting Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px]">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Newest</SelectItem>
              <SelectItem value="supply">Most Minted</SelectItem>
              <SelectItem value="price">Price: Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filters */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {bootloaderFilter && (
            <Badge variant="secondary">
              Bootloader:{" "}
              {bootloaders.find((b) => b.id === bootloaderFilter)?.name}
            </Badge>
          )}
          {mintStatus && (
            <Badge variant="secondary">Status: {mintStatus}</Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary">Search: "{searchQuery}"</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className={generatorGridClass}>
          {[...Array(8)].map((_, i) => (
            <GeneratorCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredGenerators.length > 0 ? (
        <div className={generatorGridClass}>
          {filteredGenerators.map((generator) => (
            <GeneratorCard
              key={`${generator.bootloaderId}-${generator.id}`}
              generator={generator}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground border">
          <p>No generators found matching your filters.</p>
          {hasActiveFilters && (
            <Button variant="link" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
