const EDGE_TTL_SECONDS = 86400;
const WORKER_CACHE_BUSTER = "wcb-v1";
const CACHE_CONTROL_HEADER = `public, max-age=${EDGE_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=86400, stale-if-error=604800`;

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.split("/").filter(Boolean);

      if (
        segments.length < 2 ||
        (segments[0] !== "thumbnail" && segments[0] !== "generator-thumbnail")
      ) {
        return new Response("Nothing here.", { status: 404 });
      }

      const type = segments[0];
      const id = segments[1];
      if (!id || Number.isNaN(Number(id))) {
        return new Response("Invalid ID. Must be a number.", { status: 400 });
      }

      const network = url.searchParams.get("n") || "m";
      if (!network || !["m", "g", "s"].includes(network)) {
        return new Response("wrong network", { status: 400 });
      }

      const version = url.searchParams.get("v") || "v1";
      const width = quantize(
        parseDimension(url.searchParams.get("width"), 400)
      );
      const height = quantize(
        parseDimension(url.searchParams.get("height"), 400)
      );

      const baseUrl =
        network === "g"
          ? "https://ghostnet.bootloader.art"
          : network === "s"
          ? "https://shadownet.bootloader.art"
          : "https://bootloader.art";

      const targetUrl = new URL(`/${type}/${id}`, baseUrl);
      targetUrl.searchParams.set("cb", `${version}-${WORKER_CACHE_BUSTER}`);

      const { cacheKey, cacheKeyUrl, r2Key } = buildKeys({
        type,
        id,
        network,
        version,
        width,
        height,
        targetUrl,
      });

      if (url.searchParams.get("purge") === "1") {
        const authHeader = request.headers.get("authorization") || "";
        if (authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        await env.R2_THUMBS.delete(r2Key);
        try {
          await caches.default.delete(cacheKey);
        } catch {
          // best-effort edge purge
        }

        return new Response(`Purged ${r2Key}`, { status: 200 });
      }

      const edgeCache = caches.default;
      const edgeHit = await edgeCache.match(cacheKey);
      if (edgeHit) {
        const headers = new Headers(edgeHit.headers);
        headers.set("X-Worker-Cache", "EDGE_HIT");
        headers.set("X-Worker-Key", cacheKeyUrl.toString());
        return new Response(edgeHit.body, {
          status: edgeHit.status,
          headers,
        });
      }

      const object = await env.R2_THUMBS.get(r2Key);
      if (object) {
        const r2Response = r2ToResponse(object, CACHE_CONTROL_HEADER);
        const cacheCopy = r2Response.clone();
        ctx.waitUntil(edgeCache.put(cacheKey, cacheCopy));
        const headers = new Headers(r2Response.headers);
        headers.set("X-Worker-Cache", "R2_HIT");
        headers.set("X-Worker-Key", cacheKeyUrl.toString());
        return new Response(r2Response.body, {
          status: r2Response.status,
          headers,
        });
      }

      const coordinatorId = env.RENDO.idFromName(r2Key);
      const coordinator = env.RENDO.get(coordinatorId);
      const doResponse = await coordinator.fetch("https://internal/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          r2Key,
          target: targetUrl.toString(),
          width,
          height,
          cacheControl: CACHE_CONTROL_HEADER,
          type,
          id,
        }),
      });

      if (!doResponse.ok) {
        const text = await doResponse.text().catch(() => "");
        const status = doResponse.status || 500;
        const headers = new Headers({
          "Cache-Control": "no-store",
        });
        return new Response(text || "Thumbnail render failed", {
          status,
          headers,
        });
      }

      const renderResponse = new Response(doResponse.body, {
        status: doResponse.status,
        headers: new Headers(doResponse.headers),
      });
      const cacheCopy = renderResponse.clone();
      ctx.waitUntil(edgeCache.put(cacheKey, cacheCopy));
      const headers = new Headers(renderResponse.headers);
      headers.set("X-Worker-Cache", "DO_RENDER");
      headers.set("X-Worker-Key", cacheKeyUrl.toString());
      return new Response(renderResponse.body, {
        status: renderResponse.status,
        headers,
      });
    } catch (err) {
      return new Response(`Unhandled error: ${err?.message || "unknown"}`, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }
  },
};

export class RenderCoordinator {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.inflight = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/render") {
      return new Response("Not found", { status: 404 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }

    const { r2Key, target, width, height, cacheControl, type, id } =
      payload || {};
    if (!r2Key || !target || !width || !height) {
      return new Response("Missing fields", { status: 400 });
    }

    if (this.inflight.has(r2Key)) {
      return this.inflight.get(r2Key).then((res) => res.clone());
    }

    const task = (async () => {
      const existing = await this.env.R2_THUMBS.get(r2Key);
      if (existing) {
        return r2ToResponse(existing, cacheControl);
      }

      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.env.CF_ACCOUNT_ID}/browser-rendering/screenshot?cacheTTL=86400`;
      const body = {
        url: target,
        viewport: { width, height },
        waitForTimeout: 30000,
        screenshotOptions: {
          type: "png",
          captureBeyondViewport: false,
        },
      };

      let apiResponse;
      try {
        apiResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.env.CF_API_TOKEN}`,
            "Content-Type": "application/json",
            Accept: "image/png",
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        return new Response(
          `Screenshot network error: ${error?.message || "unknown"}`,
          {
            status: 502,
            headers: { "Cache-Control": "no-store" },
          }
        );
      }

      if (!apiResponse.ok) {
        let message = apiResponse.statusText || "Screenshot API error";
        try {
          const json = await apiResponse.clone().json();
          message =
            json?.errors?.[0]?.message ||
            json?.messages?.[0] ||
            json?.error ||
            message;
          const code = json?.errors?.[0]?.code;
          if (code) {
            message = `${message} (code ${code})`;
          }
        } catch {
          // ignored
        }
        const status = apiResponse.status || 500;
        const headers = new Headers({ "Cache-Control": "no-store" });
        if (status === 429) {
          headers.set("Retry-After", "15");
        }
        return new Response(`Thumbnail not ready yet: ${message}`, {
          status,
          headers,
        });
      }

      let bytes;
      const contentType = apiResponse.headers.get("content-type") || "";
      if (/^image\//i.test(contentType)) {
        bytes = new Uint8Array(await apiResponse.arrayBuffer());
      } else {
        try {
          const json = await apiResponse.json();
          const base64 = json?.result?.image;
          if (!base64) {
            throw new Error("No image in payload");
          }
          bytes = decodeBase64(base64);
        } catch (error) {
          return new Response(
            `Unexpected content-type from screenshot API: ${
              error?.message || "unknown"
            }`,
            {
              status: 502,
              headers: { "Cache-Control": "no-store" },
            }
          );
        }
      }

      await this.env.R2_THUMBS.put(r2Key, bytes, {
        httpMetadata: {
          contentType: "image/png",
          cacheControl,
        },
      });

      return new Response(bytes, {
        status: 200,
        headers: makeImageHeaders(cacheControl, type, id),
      });
    })();

    this.inflight.set(r2Key, task);
    try {
      const response = await task;
      return response.clone();
    } finally {
      this.inflight.delete(r2Key);
    }
  }
}

function parseDimension(value, fallback) {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function quantize(value, step = 16) {
  const clamped = clamp(Math.floor(value), 1, 1000);
  const buckets = Math.floor(clamped / step) * step;
  return clamp(buckets > 0 ? buckets : step, 1, 1000);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildKeys({ type, id, network, version, width, height, targetUrl }) {
  const r2Key = `${network}/${type}/${id}/${version}-${WORKER_CACHE_BUSTER}/${width}x${height}.png`;
  const cacheKeyUrl = new URL(targetUrl.toString());
  cacheKeyUrl.searchParams.set("size", `${width}x${height}`);
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });
  return { r2Key, cacheKey, cacheKeyUrl };
}

function r2ToResponse(object, cacheControl) {
  const headers = new Headers();
  if (typeof object.writeHttpMetadata === "function") {
    object.writeHttpMetadata(headers);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "image/png");
  }
  headers.set("Cache-Control", cacheControl);
  return new Response(object.body, { status: 200, headers });
}

function makeImageHeaders(cacheControl, type, id) {
  const filename =
    type === "generator-thumbnail"
      ? `generator-${id}-thumb.png`
      : `token-${id}-thumb.png`;

  return {
    "Content-Type": "image/png",
    "Cache-Control": cacheControl,
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Timing-Allow-Origin": "*",
    "Content-Disposition": `inline; filename="${filename}"`,
  };
}

function decodeBase64(value) {
  const binary = Buffer.from(str, "base64");
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
