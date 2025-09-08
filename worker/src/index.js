import puppeteer from "@cloudflare/puppeteer";

export default {
  async fetch(request, env) {
    const workerCacheBuster = "v6";
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Validate path
    if (
      pathParts.length < 2 ||
      (pathParts[0] !== "thumbnail" && pathParts[0] !== "generator-thumbnail")
    ) {
      return new Response("Nothing here.", { status: 404 });
    }

    const type = pathParts[0];
    const id = pathParts[1];

    // Validate ID
    if (!id || isNaN(Number(id))) {
      return new Response("Invalid ID. Must be a number.", { status: 400 });
    }

    // Query params
    const width = Math.max(1, Math.min(1000, Number(url.searchParams.get("width")) || 500));
    const height = Math.max(1, Math.min(1000, Number(url.searchParams.get("height")) || 500));
    const version = url.searchParams.get("v") || "v3";
    const network = url.searchParams.get("n") || "m";

    if (!["m", "g", "s"].includes(network)) {
      return new Response("wrong network", { status: 400 });
    }

    // Base URLs
    const baseUrlMainnet = "https://bootloader.art";
    const baseUrlGhostnet = "https://ghostnet.bootloader.art";
    const baseUrlShadownet = "https://shadownet.bootloader.art";
    const baseUrl = network === "g" ? baseUrlGhostnet : network === "s" ? baseUrlShadownet : baseUrlMainnet;

    // Target to render
    const targetUrl = `${baseUrl}/${type}/${id}?cb=${version}-${workerCacheBuster}`;

    let browser;
    try {
      browser = await puppeteer.launch(env.MYBROWSER);

      const page = await browser.newPage();

      // Ensure exact requested dimensions (no DPR scaling)
      await page.setViewport({
        width,
        height,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      });

      // Load & wait for network to settle; tweak if your app needs more time
      await page.goto(targetUrl, {
        waitUntil: ["networkidle0", "domcontentloaded"],
        timeout: 25_000,
      });

      // Optional small settle for late paints; adjust/remove as needed
      await page.waitForTimeout(250);

      // Capture exactly the viewport (no fullPage)
      const jpeg = await page.screenshot({
        type: "jpeg",
        quality: 100, // decent balance size/quality
        captureBeyondViewport: false,
      });

      return new Response(jpeg, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=300", // 5 minutes
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      // 425 = Too Early / not ready yet (consistent with your old behavior)
      const message = err?.message || "unknown error";
      return new Response(`Thumbnail not ready yet: ${message}`, { status: 425 });
    } finally {
      try { if (browser) await browser.close(); } catch {}
    }
  },
};
