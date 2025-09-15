export default {
  async fetch(request, env, ctx) {
    const workerCacheBuster = "v6"; // (typo fixed)
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Validate the path structure
    if (
      pathParts.length < 2 ||
      (pathParts[0] !== "thumbnail" && pathParts[0] !== "generator-thumbnail")
    ) {
      return new Response("Nothing here.", { status: 404 });
    }

    const type = pathParts[0];
    const id = pathParts[1];

    // Validate the ID
    if (!id || isNaN(Number(id))) {
      return new Response("Invalid ID. Must be a number.", { status: 400 });
    }

    // Extract query parameters
    const width = Number(url.searchParams.get("width")) || 400;
    const height = Number(url.searchParams.get("height")) || 400;
    const version = url.searchParams.get("v") || "v3";
    const network = url.searchParams.get("n") || "m";

    if (!["m", "g", "s"].includes(network)) {
      return new Response("wrong network", { status: 400 });
    }

    // Validate dimensions
    if (width > 1000 || height > 1000) {
      return new Response("Width and height must not exceed 1000px.", { status: 400 });
    }

    // Base URL for your hosted content
    const baseUrlMainnet = "https://bootloader.art";
    const baseUrlGhostnet = "https://ghostnet.bootloader.art";
    const baseUrlShadownet = "https://shadownet.bootloader.art";
    const baseUrl =
      network === "g" ? baseUrlGhostnet : network === "s" ? baseUrlShadownet : baseUrlMainnet;

    // Construct the target URL the browser renderer should visit
    const targetUrl = new URL(`/${type}/${id}`, baseUrl);
    targetUrl.searchParams.set("cb", `${version}-${workerCacheBuster}`);

    // --- Edge cache (keyed by target URL + size). IMPORTANT: use a real absolute URL.
    const cacheKeyUrl = new URL(targetUrl.toString());
    cacheKeyUrl.searchParams.set("size", `${width}x${height}`); // only affects cache key
    const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    // Cloudflare Browser Rendering API endpoint
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/screenshot`;

    // Request a JPEG at your exact viewport size, with DPR=1
    const body = {
      url: targetUrl.toString(),
      viewport: { width, height },
      waitForTimeout: 30000,
      screenshotOptions: {
        type: "png",
        captureBeyondViewport: false,
      },
    };

    try {
      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      // If the API returned JSON, it's probably an error payload — surface it.
      const ct = apiRes.headers.get("content-type") || "";
      if (!apiRes.ok || ct.includes("application/json")) {
        let msg = apiRes.statusText || "Screenshot API error";
        try {
          const json = await apiRes.json();
          msg =
            json?.errors?.[0]?.message ||
            json?.messages?.[0] ||
            json?.error ||
            msg;
          const code = json?.errors?.[0]?.code;
          msg = `${msg}${code ? ` (code ${code})` : ""}`;
        } catch { /* ignore parse errors */ }
        const status = apiRes.status === 429 ? 425 : apiRes.status || 500;
        return new Response(`Thumbnail not ready yet: ${msg}`, { status });
      }

      // Stream the image through
      const imageResp = new Response(apiRes.body, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400", // 1 day
          "Access-Control-Allow-Origin": "*",
        },
      });

      // Store in edge cache (don't await)
      ctx.waitUntil(cache.put(cacheKey, imageResp.clone()));

      return imageResp;
    } catch (err) {
      return new Response(`Thumbnail not ready yet: ${err?.message || "unknown error"}`, {
        status: 425,
      });
    }
  },
};
