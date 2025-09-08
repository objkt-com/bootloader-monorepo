export default {
  async fetch(request, env, ctx) {
    const wokerCacheBuster = "v6";
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
    const width = Number(url.searchParams.get("width")) || 500;
    const height = Number(url.searchParams.get("height")) || 500;
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

    // Construct the target URL
    const targetUrl = `${baseUrl}/${type}/${id}?cb=${version}-${wokerCacheBuster}`;

    // Optional: add edge caching (keyed by URL+size) so repeated hits don’t re-render
    const cacheKey = new Request(`${request.method}:${targetUrl}:${width}x${height}`, {
      method: "GET",
    });
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    // Call Cloudflare Browser Rendering REST API
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/screenshot`;

    // We’ll request a JPEG at your exact viewport size, with DPR=1
    const body = {
      url: targetUrl,
      viewport: { width, height },
      gotoOptions: {
        waitUntil: "networkidle0",
        timeout: 25000,
      },
      screenshotOptions: {
        type: "jpeg",
        quality: 85,
        captureBeyondViewport: false,
        // fullPage: false // default; include if you want strictly the viewport
      },
      // You can also use `selector` if you ever want element-cropping
      // selector: "#some-element"
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

      const ct = apiRes.headers.get("content-type") || "";

      // If the API returned JSON, it’s likely an error payload
      if (ct.includes("application/json")) {
        const json = await apiRes.json().catch(() => ({}));
        const msg =
          json?.errors?.[0]?.message ||
          json?.messages?.[0] ||
          json?.error ||
          apiRes.statusText ||
          "Screenshot API error";
        const code = json?.errors?.[0]?.code;
        // Mirror the old “not ready yet” tone for transient problems
        const status = apiRes.status === 429 ? 425 : apiRes.status || 500;
        return new Response(`Thumbnail not ready yet: ${msg}${code ? ` (code ${code})` : ""}`, {
          status,
        });
      }

      // Otherwise, stream the image through
      const imageResp = new Response(apiRes.body, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*",
        },
      });

      // Store in edge cache
      ctx.waitUntil(cache.put(cacheKey, imageResp.clone()));

      return imageResp;
    } catch (err) {
      return new Response(`Thumbnail not ready yet: ${err?.message || "unknown error"}`, {
        status: 425,
      });
    }
  },
};
