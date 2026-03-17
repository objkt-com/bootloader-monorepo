import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CONFIG } from "@/config";
import type { Generator } from "@/types/generator";
import type { BootloaderId } from "@/types/bootloader";
import { decodeParamsFromQuery } from "@/bootloaders/generic-web/param-encoder";
import { getBootloader } from "@/lib/bootloader-registry";
import { tzktService } from "@/services/tzkt";
import { GENERIC_WEB_PREVIEW_SEED } from "../../../../../shared/bootloaders/seed-hex";

/**
 * Embed page for rendering generator previews full-screen.
 * Used by Screenshot One to capture thumbnails.
 *
 * URL: /embed/generator/:bootloader/:id
 * Query params:
 *   - s: seed (required)
 *   - i: iteration (optional, default 1)
 *   - p: params (optional, base64url encoded JSON for generic-web)
 *   - c: capture mode (optional, signals this is for screenshot capture)
 */
export function EmbedGeneratorPage() {
  const { bootloader, id } = useParams<{ bootloader: string; id: string }>();
  const [searchParams] = useSearchParams();
  const [generator, setGenerator] = useState<Generator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const seed =
    searchParams.get("s") ||
    (bootloader === "generic-web"
      ? GENERIC_WEB_PREVIEW_SEED
      : CONFIG.defaultPreviewSeed);
  const iteration = parseInt(searchParams.get("i") || "1", 10);
  const isCaptureMode = searchParams.get("c") === "true";
  const captureMode =
    generator?.bootloaderId === "generic-web"
      ? generator.manifest?.capture?.mode || "auto"
      : "trigger";
  const captureDelayMs =
    generator?.bootloaderId === "generic-web"
      ? generator.manifest?.capture?.delayMs ?? 5000
      : 0;

  // Decode params for generic-web
  const params = useMemo(() => {
    const encoded = searchParams.get("p");
    if (!encoded) return undefined;
    try {
      return decodeParamsFromQuery(encoded) ?? undefined;
    } catch {
      return undefined;
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchGenerator() {
      if (!id || !bootloader) {
        setError("Missing generator ID or bootloader");
        setLoading(false);
        return;
      }

      try {
        const data = await tzktService.getGeneratorByBootloader(
          id,
          bootloader as BootloaderId
        );

        if (!data) {
          setError("Generator not found");
          setLoading(false);
          return;
        }

        let manifest = data.manifest;
        if (data.bootloaderId === "generic-web" && data.cid) {
          try {
            const manifestRes = await fetch(
              `${CONFIG.sandboxWorkerUrl}/ipfs/${data.cid}/manifest.json`
            );
            if (manifestRes.ok) {
              manifest = await manifestRes.json();
            }
          } catch {
            // Manifest is optional
          }
        }

        setGenerator({
          ...data,
          manifest,
        });
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch generator:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch generator"
        );
        setLoading(false);
      }
    }

    fetchGenerator();
  }, [id, bootloader]);

  useEffect(() => {
    if (!isCaptureMode) return;

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message.id !== "string") return;

      if (message.id === "bootloader:capture") {
        markCaptureReady();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isCaptureMode]);

  const markCaptureReady = () => {
    const marker = document.getElementById("capture-marker");
    if (marker) {
      marker.setAttribute("data-capture-ready", "true");
      marker.setAttribute("data-timestamp", String(Date.now()));
    }
  };

  const handleReady = () => {
    if (!isCaptureMode) {
      return;
    }

    if (
      generator?.bootloaderId === "generic-web" &&
      captureMode === "trigger"
    ) {
      window.setTimeout(() => {
        const marker = document.getElementById("capture-marker");
        if (marker && marker.getAttribute("data-capture-ready") !== "true") {
          console.warn("[embed] Fallback: marking capture ready after timeout");
          marker.setAttribute("data-capture-ready", "true");
        }
      }, 30000);
      return;
    }

    const delay = Math.max(0, captureDelayMs);
    window.setTimeout(markCaptureReady, delay);
  };

  const handleError = (err: Error) => {
    console.error("Viewer error:", err);
    setError(err.message);
  };

  if (loading) {
    return (
      <div className="embed-container">
        <div className="embed-loading">Loading...</div>
        <div id="capture-marker" data-capture-ready="false" />
      </div>
    );
  }

  if (error || !generator) {
    return (
      <div className="embed-container">
        <div className="embed-error">{error || "Generator not found"}</div>
        <div id="capture-marker" data-capture-ready="false" />
      </div>
    );
  }

  const ViewerComponent = getBootloader(
    generator.bootloaderId
  )?.ViewerComponent;

  return (
    <div className="embed-container">
      {ViewerComponent && (
        <ViewerComponent
          generator={generator}
          seed={seed}
          iteration={iteration}
          params={params}
          className="embed-viewer"
          onReady={handleReady}
          onError={handleError}
          isCapture={isCaptureMode}
        />
      )}
      <div id="capture-marker" data-capture-ready="false" />
      <style>{`
        html,
        body,
        #root {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          scrollbar-gutter: auto !important;
        }
        .embed-container {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #000;
        }
        .embed-viewer {
          display: block;
          width: 100%;
          height: 100%;
          border: none;
        }
        .embed-loading,
        .embed-error {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: #666;
          font-family: monospace;
        }
        .embed-error {
          color: #f66;
        }
        #capture-marker {
          position: absolute;
          width: 1px;
          height: 1px;
          top: -9999px;
          left: -9999px;
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
