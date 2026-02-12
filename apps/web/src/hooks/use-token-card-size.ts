import { useCallback, useEffect, useState } from "react";

const TOKEN_CARD_SIZE_KEY = "token-card-size";
const TOKEN_CARD_SIZE_EVENT = "token-card-size-change";

export type TokenCardSize = "large" | "small";

function readStoredTokenCardSize(): TokenCardSize {
  if (typeof window === "undefined") return "large";
  const stored = window.localStorage.getItem(TOKEN_CARD_SIZE_KEY);
  return stored === "small" ? "small" : "large";
}

export function useTokenCardSize() {
  const [size, setSize] = useState<TokenCardSize>(() =>
    readStoredTokenCardSize()
  );

  const applySize = useCallback((next: TokenCardSize) => {
    setSize(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_CARD_SIZE_KEY, next);
      window.dispatchEvent(
        new CustomEvent<TokenCardSize>(TOKEN_CARD_SIZE_EVENT, {
          detail: next,
        })
      );
    }
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_CARD_SIZE_KEY) return;
      setSize(event.newValue === "small" ? "small" : "large");
    };

    const onTokenCardSizeChange = (event: Event) => {
      const detail = (event as CustomEvent<TokenCardSize>).detail;
      setSize(detail === "small" ? "small" : "large");
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(TOKEN_CARD_SIZE_EVENT, onTokenCardSizeChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(TOKEN_CARD_SIZE_EVENT, onTokenCardSizeChange);
    };
  }, []);

  return {
    size,
    isLarge: size === "large",
    setSize: applySize,
    toggle: () => applySize(size === "large" ? "small" : "large"),
  };
}
