const EDGE_TTL_SECONDS = 86400;
const WORKER_CACHE_BUSTER = "wcb-v3";
const CACHE_CONTROL_HEADER = `public, max-age=${EDGE_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=86400, stale-if-error=604800`;
const TRANSPARENT_PNG = decodeBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
);

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.split("/").filter(Boolean);
      const isImg = isImageRequest(request);
      const type = segments[0] || "thumbnail";
      const id = segments[1] || "unknown";

      if (
        segments.length < 2 ||
        (type !== "thumbnail" && type !== "generator-thumbnail")
      ) {
        if (isImg) {
          return withCORS(
            imageErrorResponse({
              status: 200,
              cacheControl: "no-store",
              type,
              id,
              request,
              note: "invalid-path",
              originalStatus: 404,
            })
          );
        }

        return withCORS(textResponse("Nothing here.", 404));
      }

      if (!id || Number.isNaN(Number(id))) {
        if (isImg) {
          return withCORS(
            imageErrorResponse({
              status: 200,
              cacheControl: "no-store",
              type,
              id,
              request,
              note: "invalid-id",
              originalStatus: 400,
            })
          );
        }

        return withCORS(textResponse("Invalid ID. Must be a number.", 400));
      }

      const network = url.searchParams.get("n") || "m";
      if (!network || !["m", "g", "s"].includes(network)) {
        if (isImg) {
          return withCORS(
            imageErrorResponse({
              status: 200,
              cacheControl: "no-store",
              type,
              id,
              request,
              note: "invalid-network",
              originalStatus: 400,
            })
          );
        }

        return withCORS(textResponse("wrong network", 400));
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
          if (isImg) {
            return withCORS(
              imageErrorResponse({
                status: 200,
                cacheControl: "no-store",
                type,
                id,
                request,
                note: "unauthorized",
                originalStatus: 401,
              })
            );
          }

          return withCORS(textResponse("Unauthorized", 401));
        }

        await env.R2_THUMBS.delete(r2Key);
        try {
          await caches.default.delete(cacheKey);
        } catch {
          // best-effort edge purge
        }

        if (isImg) {
          return withCORS(
            imageErrorResponse({
              status: 200,
              cacheControl: "no-store",
              type,
              id,
              request,
              note: "purged",
              originalStatus: 200,
            })
          );
        }

        return withCORS(textResponse(`Purged ${r2Key}`, 200, "no-store"));
      }

      const edgeCache = caches.default;
      const edgeHit = await edgeCache.match(cacheKey);
      if (edgeHit) {
        const headers = new Headers(edgeHit.headers);
        headers.set("X-Worker-Cache", "EDGE_HIT");
        headers.set("X-Worker-Key", cacheKeyUrl.toString());
        if (request.method === "HEAD") {
          await edgeHit.body?.cancel();
        }
        return withCORS(
          new Response(request.method === "HEAD" ? null : edgeHit.body, {
            status: edgeHit.status,
            headers,
          })
        );
      }

      const object = await env.R2_THUMBS.get(r2Key);
      if (object) {
        const r2Response = r2ToResponse(object, CACHE_CONTROL_HEADER);
        ctx.waitUntil(edgeCache.put(cacheKey, r2Response.clone()));
        const headers = new Headers(r2Response.headers);
        headers.set("X-Worker-Cache", "R2_HIT");
        headers.set("X-Worker-Key", cacheKeyUrl.toString());
        if (request.method === "HEAD") {
          await r2Response.body?.cancel();
          return withCORS(
            new Response(null, {
              status: r2Response.status,
              headers,
            })
          );
        }
        return withCORS(
          new Response(r2Response.body, {
            status: r2Response.status,
            headers,
          })
        );
      }

      if (request.method === "HEAD") {
        const headers = new Headers({
          "Cache-Control": "no-store",
        });
        headers.set("X-Worker-Cache", "MISS_NO_RENDER");
        headers.set("X-Worker-Key", cacheKeyUrl.toString());
        return withCORS(new Response(null, { status: 204, headers }));
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
        if (isImg) {
          return withCORS(
            imageErrorResponse({
              status: 200,
              cacheControl: "no-store",
              type,
              id,
              request,
              note: `render-error-${status}`,
              originalStatus: status,
            })
          );
        }

        return withCORS(
          textResponse(
            text || "Thumbnail render failed",
            status,
            "no-store"
          )
        );
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
      if (request.method === "HEAD") {
        await renderResponse.body?.cancel();
        return withCORS(
          new Response(null, {
            status: renderResponse.status,
            headers,
          })
        );
      }
      return withCORS(
        new Response(renderResponse.body, {
          status: renderResponse.status,
          headers,
        })
      );
    } catch (err) {
      if (isImageRequest(request)) {
        return withCORS(
          imageErrorResponse({
            status: 200,
            cacheControl: "no-store",
            type: "thumbnail",
            id: "error",
            request,
            note: "unhandled-error",
            originalStatus: 500,
          })
        );
      }

      return withCORS(
        textResponse(
          `Unhandled error: ${err?.message || "unknown"}`,
          500,
          "no-store"
        )
      );
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
      return withCORS(textResponse("Not found", 404));
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return withCORS(textResponse("Bad JSON", 400));
    }

    const { r2Key, target, width, height, cacheControl, type, id } =
      payload || {};
    if (!r2Key || !target || !width || !height) {
      return withCORS(textResponse("Missing fields", 400));
    }

    if (this.inflight.has(r2Key)) {
      return this.inflight.get(r2Key).then((res) => res.clone());
    }

    const task = (async () => {
      const existing = await this.env.R2_THUMBS.get(r2Key);
      if (existing) {
        return withCORS(r2ToResponse(existing, cacheControl));
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
        return withCORS(
          textResponse(
            `Screenshot network error: ${error?.message || "unknown"}`,
            502
          )
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
        return withCORS(
          new Response(`Thumbnail not ready yet: ${message}`, {
            status,
            headers,
          })
        );
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
          return withCORS(
            textResponse(
              `Unexpected content-type from screenshot API: ${
                error?.message || "unknown"
              }`,
              502
            )
          );
        }
      }

      await this.env.R2_THUMBS.put(r2Key, bytes, {
        httpMetadata: {
          contentType: "image/png",
          cacheControl,
        },
      });

      return withCORS(
        new Response(bytes, {
          status: 200,
          headers: makeImageHeaders(cacheControl, type, id),
        })
      );
    })();

    this.inflight.set(r2Key, task);
    try {
      const response = await task;
      return response;
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
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { status: 200, headers });
}

function makeImageHeaders(cacheControl, type, id) {
  const resolvedType = type === "generator-thumbnail" ? type : "thumbnail";
  const resolvedId = id != null ? id : "unknown";
  const filename =
    resolvedType === "generator-thumbnail"
      ? `generator-${resolvedId}-thumb.png`
      : `token-${resolvedId}-thumb.png`;

  return {
    "Content-Type": "image/png",
    "Cache-Control": cacheControl,
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Timing-Allow-Origin": "*",
    "Content-Disposition": `inline; filename="${filename}"`,
    "X-Content-Type-Options": "nosniff",
  };
}

function textResponse(message, status, cacheControl = "no-store") {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": cacheControl,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function isImageRequest(request) {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest) {
    return dest === "image";
  }
  const accept = request.headers.get("accept") || "";
  return accept.includes("image/");
}

function imageErrorResponse({
  status = 200,
  cacheControl = "no-store",
  type,
  id,
  request,
  note,
  originalStatus,
}) {
  const headers = new Headers(makeImageHeaders(cacheControl, type, id));
  if (note) {
    headers.set("X-Worker-Note", note);
  }
  if (originalStatus != null) {
    headers.set("X-Worker-Status", String(originalStatus));
  }
  return new Response(request.method === "HEAD" ? null : TRANSPARENT_PNG, {
    status,
    headers,
  });
}

function withCORS(response) {
  if (!response) {
    return response;
  }

  const headers = new Headers(response.headers || undefined);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  headers.set("Timing-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function decodeBase64(value) {
  const binary = globalThis.atob(value);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
