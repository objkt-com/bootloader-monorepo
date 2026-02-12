import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGenerators } from "@/hooks/use-generators";
import { getBootloader } from "@/lib/bootloader-registry";
import { getGeneratorThumbnailUrl } from "@/config";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Generator } from "@/types/generator";

interface GeneratorSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  generator: Generator;
  score: number;
}

const MAX_RESULTS = 16;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function getSearchScore(generator: Generator, query: string): number {
  const name = normalize(generator.name);
  const creatorName = normalize(generator.creatorName || "");
  const creatorAddress = normalize(generator.creator);
  const bootloaderName = normalize(
    getBootloader(generator.bootloaderId)?.name || generator.bootloaderId
  );
  const id = normalize(String(generator.id));

  if (!query) {
    return 0;
  }

  let score = 0;

  if (name === query) score += 120;
  else if (name.startsWith(query)) score += 100;
  else if (name.includes(query)) score += 70;

  if (creatorName.startsWith(query) || creatorAddress.startsWith(query)) {
    score += 40;
  } else if (creatorName.includes(query) || creatorAddress.includes(query)) {
    score += 20;
  }

  if (bootloaderName.startsWith(query)) score += 20;
  else if (bootloaderName.includes(query)) score += 10;

  if (id === query) score += 50;
  else if (id.startsWith(query)) score += 30;

  return score;
}

function formatCreator(generator: Generator): string {
  if (generator.creatorName) {
    return generator.creatorName;
  }
  return `${generator.creator.slice(0, 6)}...${generator.creator.slice(-4)}`;
}

export function GeneratorSearchDialog({
  open,
  onOpenChange,
}: GeneratorSearchDialogProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { generators, isLoading, error } = useGenerators({ excludeFlagged: true });

  const normalizedQuery = normalize(query);

  const results = useMemo((): SearchResult[] => {
    if (!normalizedQuery) {
      return [...generators]
        .sort((a, b) => (b.firstLevel ?? 0) - (a.firstLevel ?? 0))
        .slice(0, MAX_RESULTS)
        .map((generator) => ({ generator, score: 0 }));
    }

    return generators
      .map((generator) => ({
        generator,
        score: getSearchScore(generator, normalizedQuery),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.generator.firstLevel ?? 0) - (a.generator.firstLevel ?? 0);
      })
      .slice(0, MAX_RESULTS);
  }, [generators, normalizedQuery]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    setQuery("");
    setSelectedIndex(0);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [normalizedQuery, results.length]);

  useEffect(() => {
    if (!open || results.length === 0) return;
    const selectedElement = resultsContainerRef.current?.querySelector<HTMLElement>(
      `[data-search-result-index="${selectedIndex}"]`
    );
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex, results.length]);

  const openGenerator = (generator: Generator) => {
    onOpenChange(false);
    navigate(`/generator/${generator.bootloaderId}/${generator.id}`);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length === 0) return;
      setSelectedIndex((current) => (current + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      setSelectedIndex((current) =>
        current === 0 ? results.length - 1 : current - 1
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        openGenerator(selected.generator);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[max(10vh,calc(50%-280px))] flex max-h-[min(80vh,560px)] max-w-2xl translate-y-0 flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Search Generators</DialogTitle>
        <DialogDescription className="sr-only">
          Search generators by name, creator, or bootloader.
        </DialogDescription>

        <div className="border-b p-3">
          <div className="flex items-center gap-2 rounded-md border bg-background pl-3 pr-1">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search generators, creators, or bootloaders..."
              className="h-10 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 self-center items-center justify-center text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
              >
                <X className="h-[18px] w-[18px] translate-y-px" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>
        </div>

        <div className="px-2 pb-2">
          {error ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Could not load generators right now.
            </div>
          ) : isLoading ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Loading generators...
            </div>
          ) : results.length > 0 ? (
            <ScrollArea className="max-h-[420px]">
              <div ref={resultsContainerRef} className="py-2">
                {results.map((result, index) => {
                  const { generator } = result;
                  const isSelected = index === selectedIndex;
                  const bootloaderName =
                    getBootloader(generator.bootloaderId)?.name ||
                    generator.bootloaderId;
                  const thumbnailUrl =
                    generator.thumbnailUrl ||
                    getGeneratorThumbnailUrl(
                      generator.id,
                      generator.version,
                      generator.bootloaderId
                    );

                  return (
                    <button
                      key={`${generator.bootloaderId}-${generator.id}`}
                      data-search-result-index={index}
                      type="button"
                      onClick={() => openGenerator(generator)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                        isSelected ? "bg-accent" : "hover:bg-accent/60"
                      )}
                    >
                      <div className="h-12 w-12 rounded-md bg-muted overflow-hidden shrink-0">
                        <img
                          src={thumbnailUrl}
                          alt={generator.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{generator.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatCreator(generator)} • {bootloaderName}
                        </p>
                      </div>

                      <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
                        #{generator.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No generators found for "{query}".
            </div>
          )}

          <div className="mt-1 flex items-center justify-between border-t px-3 pt-2 text-xs text-muted-foreground">
            <span>Use ↑↓ to navigate and Enter to open</span>
            <button
              type="button"
              className="underline-offset-4 hover:underline"
              onClick={() => {
                onOpenChange(false);
                const params = new URLSearchParams();
                if (query.trim()) {
                  params.set("q", query.trim());
                }
                navigate({
                  pathname: "/explore",
                  search: params.toString(),
                });
              }}
            >
              View all on Explore
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
