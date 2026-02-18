import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  Bindings,
  RenderJobCreatePayload,
  RenderJobResultPayload,
  SessionInitResponse,
  SessionMeta,
  BootloaderManifest,
  CaptureConfig,
  AnimationConfig,
  ParamDefinition,
  CaptureMode,
  CaptureTarget,
  User,
} from "./types";
import {
  randomSeed,
  decodeBase64,
  clamp,
  clampInt,
  guessContentType,
} from "./utils";
import {
  AuthService,
  AuthError,
  SessionService,
  TokenService,
  GeneratorService,
  createSignaturePayload,
  isAdmin,
} from "./services";
import { IpfsJsonError, storeJsonToIpfs } from "./ipfs-json";
import { runGenericWebMetadataIndexer } from "./indexer";
import {
  getAuthTokenTtlSeconds,
  signAuthToken,
  verifyAuthToken,
} from "./auth-token";

const app = new Hono<{ Bindings: Bindings }>();
const MAX_SESSION_INIT_REQUEST_BYTES = 80 * 1024 * 1024;

// CORS middleware for all routes
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: [
      "X-Worker-Cache",
      "X-Worker-Key",
      "X-Worker-Note",
      "X-Worker-Status",
      "X-Token-Features",
    ],
  })
);

// Debug middleware - log all requests
app.use("*", async (c, next) => {
  console.log("[request]", c.req.method, c.req.path);
  await next();
});

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function readBearerToken(c: any): string | null {
  const authHeader = c.req.header("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }
  return null;
}

function readAuthTokenFromHeaderOrQuery(c: any): string | null {
  const headerToken = readBearerToken(c);
  if (headerToken) return headerToken;
  const queryToken = c.req.query("auth");
  return queryToken && queryToken.trim() ? queryToken.trim() : null;
}

async function getAuthenticatedUser(
  c: any,
  options?: { allowQueryToken?: boolean }
): Promise<User> {
  const token = options?.allowQueryToken
    ? readAuthTokenFromHeaderOrQuery(c)
    : readBearerToken(c);
  if (!token) {
    throw new HttpError(401, "Authentication required");
  }

  const secret = c.env.AUTH_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new HttpError(500, "AUTH_TOKEN_SECRET is not configured");
  }

  const claims = await verifyAuthToken(token, secret);
  if (!claims) {
    throw new HttpError(401, "Invalid or expired auth token");
  }

  const authService = new AuthService(c.env.DB);
  const user = await authService.getUserById(claims.sub);
  if (!user) {
    throw new HttpError(401, "Authenticated user not found");
  }

  if (user.address !== claims.address) {
    throw new HttpError(401, "Auth token does not match user");
  }

  return user;
}

async function getAuthenticatedUserOptional(c: any): Promise<User | null> {
  const token = readAuthTokenFromHeaderOrQuery(c);
  if (!token) return null;
  return getAuthenticatedUser(c, { allowQueryToken: true });
}

async function requireSessionReadAccess(
  c: any,
  sessionId: string
): Promise<void> {
  const user = await getAuthenticatedUserOptional(c);
  const sessionService = new SessionService(c.env.DB);
  const allowed = await sessionService.canUserAccessSession(
    sessionId,
    user?.id ?? null
  );
  if (!allowed) {
    throw new HttpError(403, "Forbidden");
  }
}

async function requireSessionWriteAccess(
  c: any,
  sessionId: string
): Promise<User> {
  const user = await getAuthenticatedUser(c);
  const sessionService = new SessionService(c.env.DB);
  const owner = await sessionService.isSessionOwner(sessionId, user.id);
  if (!owner && !isAdmin(user)) {
    throw new HttpError(403, "Forbidden");
  }
  return user;
}

// =============================================================================
// AUTHENTICATION ROUTES
// =============================================================================

// Request a sign-in challenge - wallet MUST sign this to connect
// Flow: 1) Connect wallet 2) Call /auth/challenge 3) Sign payload 4) Call /auth/verify
app.post("/auth/challenge", async (c) => {
  const body = await c.req.json<{ publicKey: string }>().catch(() => null);
  if (!body?.publicKey) {
    return c.json({ error: "Missing publicKey" }, 400);
  }

  const authService = new AuthService(c.env.DB);
  try {
    const { nonce, address } = await authService.registerLoginNonce(
      body.publicKey
    );
    // Return the exact payload the wallet needs to sign
    const payload = createSignaturePayload(address, nonce);
    return c.json({ nonce, address, payload });
  } catch (error) {
    console.error("[auth/challenge] Error:", error);
    return c.json({ error: "Failed to generate challenge" }, 500);
  }
});

// Verify signature and complete sign-in
app.post("/auth/verify", async (c) => {
  const body = await c.req
    .json<{ publicKey: string; signature: string }>()
    .catch(() => null);
  if (!body?.publicKey || !body?.signature) {
    return c.json({ error: "Missing publicKey or signature" }, 400);
  }

  const authService = new AuthService(c.env.DB);
  try {
    const user = await authService.login(body.publicKey, body.signature);
    const secret = c.env.AUTH_TOKEN_SECRET?.trim();
    if (!secret) {
      return c.json({ error: "AUTH_TOKEN_SECRET is not configured" }, 500);
    }
    const ttlSeconds = getAuthTokenTtlSeconds(c.env.AUTH_TOKEN_TTL_SECONDS);
    const token = await signAuthToken(user, secret, ttlSeconds);
    return c.json({
      user,
      token,
      tokenType: "Bearer",
      expiresIn: ttlSeconds,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, 401);
    }
    console.error("[auth/verify] Error:", error);
    return c.json({ error: "Verification failed" }, 500);
  }
});

// Get currently authenticated user from bearer token
app.get("/auth/me", async (c) => {
  try {
    const user = await getAuthenticatedUser(c);
    return c.json({ user });
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    console.error("[auth/me] Error:", error);
    return c.json({ error: "Failed to fetch authenticated user" }, 500);
  }
});

// Get current user by address or public key
app.get("/auth/user", async (c) => {
  const address = c.req.query("address");
  const publicKey = c.req.query("publicKey");

  if (!address && !publicKey) {
    return c.json(
      { error: "Missing address or publicKey query parameter" },
      400
    );
  }

  const authService = new AuthService(c.env.DB);
  try {
    let user: User | null = null;
    if (address) {
      user = await authService.findUserByAddress(address);
    } else if (publicKey) {
      user = await authService.findUserByPublicKey(publicKey);
    }

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ user });
  } catch (error) {
    console.error("[auth/user] Error:", error);
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

// Update user profile (display name, avatar)
app.patch("/auth/user/:userId", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req
    .json<{ displayName?: string; avatarUrl?: string }>()
    .catch(() => null);

  if (!body) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const authService = new AuthService(c.env.DB);
  try {
    const authUser = await getAuthenticatedUser(c);
    if (authUser.id !== userId && !isAdmin(authUser)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await authService.updateUserProfile(userId, body);
    const user = await authService.getUserById(userId);
    return c.json({ user });
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    console.error("[auth/user] Error:", error);
    return c.json({ error: "Failed to update user" }, 500);
  }
});

// Manually trigger generic-web indexer for a specific token.
// Used by frontend immediately after mint to reduce lag before traits/metadata appear.
app.post("/generic-web/v1/indexer/tokens/:id/trigger", async (c) => {
  const tokenId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "shadownet") as
    | "mainnet"
    | "shadownet";
  const wait = c.req.query("wait") === "1";
  const dryRun = c.req.query("dryRun") === "1";

  if (Number.isNaN(tokenId) || tokenId < 0) {
    return c.json({ error: "Invalid token ID" }, 400);
  }

  if (network !== "shadownet") {
    return c.json({ error: "Indexer currently supports shadownet only" }, 400);
  }

  try {
    const user = await getAuthenticatedUser(c);
    const tokenInfo = await fetchGenericWebTokenQueueInfo(network, tokenId, {
      includeOwner: true,
    });
    if (!tokenInfo) {
      return c.json({ error: "Token not found" }, 404);
    }

    if (
      tokenInfo.ownerAddress &&
      tokenInfo.ownerAddress !== user.address &&
      !isAdmin(user)
    ) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const runPromise = runGenericWebMetadataIndexer(c.env, {
      source: "manual",
      limit: 1,
      tokenId,
      dryRun,
    });

    if (wait) {
      const summary = await runPromise;
      return c.json({
        accepted: true,
        tokenId,
        network,
        summary,
      });
    }

    c.executionCtx.waitUntil(
      runPromise
        .then((summary) => {
          console.log(
            "[indexer] manual trigger finished",
            JSON.stringify({ tokenId, summary })
          );
        })
        .catch((error) => {
          console.error("[indexer] manual trigger failed", { tokenId, error });
        })
    );

    return c.json({
      accepted: true,
      tokenId,
      network,
      queued: true,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    console.error("[indexer/trigger] Error:", error);
    return c.json({ error: "Failed to trigger indexer" }, 500);
  }
});

// =============================================================================
// TOKEN ATTRIBUTES ROUTES
// =============================================================================

// Get attributes for a specific token (with bootloader namespace)
app.get("/:bootloader/v1/tokens/:id/attributes", async (c) => {
  const bootloader = c.req.param("bootloader") as "svg-js" | "generic-web";
  const tokenId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (!["svg-js", "generic-web"].includes(bootloader)) {
    return c.json({ error: "Invalid bootloader" }, 400);
  }

  if (Number.isNaN(tokenId)) {
    return c.json({ error: "Invalid token ID" }, 400);
  }

  const tokenService = new TokenService(c.env.DB);
  try {
    const tokenWithAttrs = await tokenService.getTokenWithAttributes(
      tokenId,
      network,
      bootloader
    );
    if (!tokenWithAttrs) {
      return c.json({ error: "Token not found" }, 404);
    }
    return c.json({
      tokenId: tokenWithAttrs.id,
      generatorId: tokenWithAttrs.generatorId,
      network: tokenWithAttrs.network,
      bootloader: tokenWithAttrs.bootloader,
      attributes: tokenWithAttrs.attributes,
    });
  } catch (error) {
    console.error("[tokens/attributes] Error:", error);
    return c.json({ error: "Failed to fetch token attributes" }, 500);
  }
});

// Get attributes for a specific token (legacy - no bootloader filter)
app.get("/tokens/:id/attributes", async (c) => {
  const tokenId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (Number.isNaN(tokenId)) {
    return c.json({ error: "Invalid token ID" }, 400);
  }

  const tokenService = new TokenService(c.env.DB);
  try {
    const tokenWithAttrs = await tokenService.getTokenWithAttributes(
      tokenId,
      network
    );
    if (!tokenWithAttrs) {
      return c.json({ error: "Token not found" }, 404);
    }
    return c.json({
      tokenId: tokenWithAttrs.id,
      generatorId: tokenWithAttrs.generatorId,
      network: tokenWithAttrs.network,
      bootloader: tokenWithAttrs.bootloader,
      attributes: tokenWithAttrs.attributes,
    });
  } catch (error) {
    console.error("[tokens/attributes] Error:", error);
    return c.json({ error: "Failed to fetch token attributes" }, 500);
  }
});

// Get all attribute names for a generator/collection (with bootloader namespace)
app.get("/:bootloader/v1/generators/:id/attributes", async (c) => {
  const bootloader = c.req.param("bootloader") as "svg-js" | "generic-web";
  const generatorId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (!["svg-js", "generic-web"].includes(bootloader)) {
    return c.json({ error: "Invalid bootloader" }, 400);
  }

  if (Number.isNaN(generatorId)) {
    return c.json({ error: "Invalid generator ID" }, 400);
  }

  const tokenService = new TokenService(c.env.DB);
  try {
    const attributeNames =
      await tokenService.getAttributeNamesForGeneratorByBootloader(
        generatorId,
        network,
        bootloader
      );
    return c.json({
      generatorId,
      network,
      bootloader,
      attributes: attributeNames,
    });
  } catch (error) {
    console.error("[generators/attributes] Error:", error);
    return c.json({ error: "Failed to fetch attribute names" }, 500);
  }
});

// Get all values for a specific attribute in a collection (with bootloader namespace)
app.get("/:bootloader/v1/generators/:id/attributes/:name/values", async (c) => {
  const bootloader = c.req.param("bootloader") as "svg-js" | "generic-web";
  const generatorId = Number(c.req.param("id"));
  const attributeName = c.req.param("name");
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (!["svg-js", "generic-web"].includes(bootloader)) {
    return c.json({ error: "Invalid bootloader" }, 400);
  }

  if (Number.isNaN(generatorId)) {
    return c.json({ error: "Invalid generator ID" }, 400);
  }

  const tokenService = new TokenService(c.env.DB);
  try {
    const values =
      await tokenService.getAttributeValuesForGeneratorByBootloader(
        generatorId,
        network,
        attributeName,
        bootloader
      );
    return c.json({
      generatorId,
      network,
      bootloader,
      attribute: attributeName,
      values,
    });
  } catch (error) {
    console.error("[generators/attributes/values] Error:", error);
    return c.json({ error: "Failed to fetch attribute values" }, 500);
  }
});

// Search tokens by attributes (with bootloader namespace)
app.post("/:bootloader/v1/generators/:id/tokens/search", async (c) => {
  const bootloader = c.req.param("bootloader") as "svg-js" | "generic-web";
  const generatorId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";
  const limit = Math.min(Number(c.req.query("limit") || 100), 500);
  const offset = Number(c.req.query("offset") || 0);

  if (!["svg-js", "generic-web"].includes(bootloader)) {
    return c.json({ error: "Invalid bootloader" }, 400);
  }

  if (Number.isNaN(generatorId)) {
    return c.json({ error: "Invalid generator ID" }, 400);
  }

  const body = await c.req
    .json<{ filters?: Array<{ name: string; value: string }> }>()
    .catch(() => null);
  const filters = body?.filters || [];

  const tokenService = new TokenService(c.env.DB);
  try {
    const result = await tokenService.searchByAttributes(
      generatorId,
      network,
      filters,
      limit,
      offset,
      bootloader
    );
    const tokens =
      bootloader === "generic-web"
        ? await Promise.all(
            result.tokens.map(async (token) => {
              const queueInfo = await fetchGenericWebTokenQueueInfo(
                network,
                token.id
              );
              return {
                ...token,
                version: queueInfo?.generatorVersion ?? null,
              };
            })
          )
        : result.tokens;

    return c.json({
      generatorId,
      network,
      bootloader,
      filters,
      tokens,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[generators/tokens/search] Error:", error);
    return c.json({ error: "Failed to search tokens" }, 500);
  }
});

// Get all attribute names for a generator/collection
app.get("/generators/:id/attributes", async (c) => {
  const generatorId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (Number.isNaN(generatorId)) {
    return c.json({ error: "Invalid generator ID" }, 400);
  }

  const tokenService = new TokenService(c.env.DB);
  try {
    const attributeNames = await tokenService.getAttributeNamesForGenerator(
      generatorId,
      network
    );
    return c.json({ generatorId, network, attributes: attributeNames });
  } catch (error) {
    console.error("[generators/attributes] Error:", error);
    return c.json({ error: "Failed to fetch attribute names" }, 500);
  }
});

// Get all values for a specific attribute in a collection
app.get("/generators/:id/attributes/:name/values", async (c) => {
  const generatorId = Number(c.req.param("id"));
  const attributeName = c.req.param("name");
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (Number.isNaN(generatorId)) {
    return c.json({ error: "Invalid generator ID" }, 400);
  }

  const tokenService = new TokenService(c.env.DB);
  try {
    const values = await tokenService.getAttributeValuesForGenerator(
      generatorId,
      network,
      attributeName
    );
    return c.json({ generatorId, network, attribute: attributeName, values });
  } catch (error) {
    console.error("[generators/attributes/values] Error:", error);
    return c.json({ error: "Failed to fetch attribute values" }, 500);
  }
});

// Search tokens by attributes
app.post("/generators/:id/tokens/search", async (c) => {
  const generatorId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";
  const limit = Math.min(Number(c.req.query("limit") || 100), 500);
  const offset = Number(c.req.query("offset") || 0);

  if (Number.isNaN(generatorId)) {
    return c.json({ error: "Invalid generator ID" }, 400);
  }

  const body = await c.req
    .json<{ filters?: Array<{ name: string; value: string }> }>()
    .catch(() => null);
  const filters = body?.filters || [];

  const tokenService = new TokenService(c.env.DB);
  try {
    const result = await tokenService.searchByAttributes(
      generatorId,
      network,
      filters,
      limit,
      offset
    );
    return c.json({
      generatorId,
      network,
      filters,
      tokens: result.tokens,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[generators/tokens/search] Error:", error);
    return c.json({ error: "Failed to search tokens" }, 500);
  }
});

// =============================================================================
// GENERATOR METADATA ROUTES
// =============================================================================

// Get generator metadata (with bootloader namespace)
app.get("/:bootloader/v1/generators/:id/metadata", async (c) => {
  const bootloader = c.req.param("bootloader") as "svg-js" | "generic-web";
  const generatorId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (!["svg-js", "generic-web"].includes(bootloader)) {
    return c.json({ error: "Invalid bootloader" }, 400);
  }

  if (Number.isNaN(generatorId)) {
    return c.json({ error: "Invalid generator ID" }, 400);
  }

  const generatorService = new GeneratorService(c.env.DB);
  try {
    const generator = await generatorService.getGenerator(
      generatorId,
      network,
      bootloader
    );
    if (!generator) {
      return c.json({ error: "Generator not found" }, 404);
    }
    return c.json({
      id: generator.id,
      network: generator.network,
      bootloader: generator.bootloader,
      name: generator.name,
      artifactCid: generator.artifactCid,
      metadataCid: generator.metadataCid,
      generatorDescription: generator.generatorDescription,
      tokenDescription: generator.tokenDescription,
      creatorAddress: generator.creatorAddress,
      thumbnailSeed: generator.thumbnailSeed,
    });
  } catch (error) {
    console.error("[generators/metadata] Error:", error);
    return c.json({ error: "Failed to fetch generator metadata" }, 500);
  }
});

// Store or update generator metadata
app.post("/:bootloader/v1/generators/:id/metadata", async (c) => {
  const bootloader = c.req.param("bootloader") as "svg-js" | "generic-web";
  const generatorId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (!["svg-js", "generic-web"].includes(bootloader)) {
    return c.json({ error: "Invalid bootloader" }, 400);
  }

  if (Number.isNaN(generatorId)) {
    return c.json({ error: "Invalid generator ID" }, 400);
  }

  const body = await c.req
    .json<{
      name?: string;
      artifactCid?: string;
      metadataCid?: string;
      generatorDescription?: string;
      tokenDescription?: string;
      creatorAddress?: string;
      thumbnailSeed?: string;
    }>()
    .catch(() => null);

  if (!body) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const generatorService = new GeneratorService(c.env.DB);
  try {
    const authUser = await getAuthenticatedUser(c);
    const existing = await generatorService.getGenerator(
      generatorId,
      network,
      bootloader
    );
    const claimedCreator = body.creatorAddress?.toLowerCase();
    const authAddress = authUser.address.toLowerCase();

    if (
      claimedCreator &&
      claimedCreator !== authAddress &&
      !isAdmin(authUser)
    ) {
      return c.json({ error: "Forbidden: creator address mismatch" }, 403);
    }
    if (
      existing?.creatorAddress &&
      existing.creatorAddress.toLowerCase() !== authAddress &&
      !isAdmin(authUser)
    ) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await generatorService.storeGenerator({
      id: generatorId,
      network,
      bootloader,
      name: body.name,
      artifactCid: body.artifactCid,
      metadataCid: body.metadataCid,
      generatorDescription: body.generatorDescription,
      tokenDescription: body.tokenDescription,
      creatorAddress: body.creatorAddress,
      thumbnailSeed: body.thumbnailSeed,
    });
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    console.error("[generators/metadata] Error:", error);
    return c.json({ error: "Failed to store generator metadata" }, 500);
  }
});

// =============================================================================
// IPFS JSON UPLOAD ROUTE
// =============================================================================

/**
 * Upload JSON content to IPFS (R2 storage with CID-based key)
 * Used for generator metadata JSON files
 */
app.post("/ipfs/json", async (c) => {
  try {
    const authUser = await getAuthenticatedUser(c);
    const actor = authUser.id;
    const body = await c.req.json();
    const stored = await storeJsonToIpfs(c.env, body, actor);
    return c.json(stored);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    if (error instanceof IpfsJsonError) {
      return c.json({ error: error.message }, error.status);
    }
    console.error("[ipfs/json] Upload error:", error);
    return c.json({ error: "Failed to upload JSON" }, 500);
  }
});

// =============================================================================
// SANDBOX/SESSION ROUTES (from open-poc worker)
// =============================================================================

app.post("/sessions", async (c) => {
  let authUser: User;
  try {
    authUser = await getAuthenticatedUser(c);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Authentication required" }, 401);
  }

  const contentLengthRaw = c.req.header("content-length");
  if (contentLengthRaw) {
    const contentLength = Number(contentLengthRaw);
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_SESSION_INIT_REQUEST_BYTES
    ) {
      return c.json(
        {
          error: `Upload request too large (${contentLength} bytes). Max ${MAX_SESSION_INIT_REQUEST_BYTES} bytes.`,
        },
        413
      );
    }
  }

  const contentType = c.req.header("content-type") ?? "";
  const id = c.env.SESSIONS.newUniqueId();
  const sessionId = id.toString();
  const stub = c.env.SESSIONS.get(id);

  let response: Response;

  if (contentType.includes("application/json")) {
    const payload = await c.req.json();
    response = await stub.fetch("https://session/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } else {
    const formData = await c.req.formData();
    const file = formData.get("file") as any;
    if (!file || typeof file.arrayBuffer !== "function") {
      return c.json({ error: "Missing project payload" }, 400);
    }
    const buffer = await file.arrayBuffer();
    response = await stub.fetch("https://session/init", {
      method: "POST",
      body: buffer,
      headers: {
        "content-type": "application/octet-stream",
      },
    });
  }

  if (!response.ok) {
    const error = await response.text();
    return new Response(JSON.stringify({ error }), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }

  const init = (await response.json()) as SessionInitResponse;
  const seed = randomSeed();

  // Track session in D1 database (optionally linked to user)
  const sessionService = new SessionService(c.env.DB);
  try {
    await sessionService.createSession({
      id: sessionId,
      userId: authUser.id,
      cid: init.cid || null,
    });
  } catch (error) {
    console.error("[sessions] Failed to track session in DB:", error);
    // Don't fail the request if DB tracking fails - session DO still works
  }

  return c.json({
    sessionId,
    defaultEntry: init.defaultEntry,
    fileCount: init.fileCount,
    cid: init.cid,
    upload: init.upload,
    seed,
  });
});

// Get sessions for a user
app.get("/users/:userId/sessions", async (c) => {
  const userId = c.req.param("userId");
  const sessionService = new SessionService(c.env.DB);

  try {
    const authUser = await getAuthenticatedUser(c);
    if (authUser.id !== userId && !isAdmin(authUser)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const sessions = await sessionService.getUserSessions(userId);
    return c.json({ sessions });
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    console.error("[users/sessions] Error:", error);
    return c.json({ error: "Failed to fetch sessions" }, 500);
  }
});

// Link an existing session to a user
app.post("/sessions/:sessionId/link", async (c) => {
  const sessionId = c.req.param("sessionId");

  const sessionService = new SessionService(c.env.DB);
  try {
    const authUser = await getAuthenticatedUser(c);
    const existingSession = await sessionService.getSession(sessionId);
    if (!existingSession) {
      return c.json({ error: "Session not found" }, 404);
    }
    if (
      existingSession.userId &&
      existingSession.userId !== authUser.id &&
      !isAdmin(authUser)
    ) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await sessionService.linkSessionToUser(sessionId, authUser.id);
    const linkedSession = await sessionService.getSession(sessionId);
    return c.json({ session: linkedSession });
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    console.error("[sessions/link] Error:", error);
    return c.json({ error: "Failed to link session" }, 500);
  }
});

// Update session metadata (name, description, public status)
app.patch("/sessions/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const body = await c.req
    .json<{ name?: string; description?: string; isPublic?: boolean }>()
    .catch(() => null);

  if (!body) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const sessionService = new SessionService(c.env.DB);
  try {
    await requireSessionWriteAccess(c, sessionId);
    await sessionService.updateSession(sessionId, body);
    const session = await sessionService.getSession(sessionId);
    return c.json({ session });
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    console.error("[sessions/update] Error:", error);
    return c.json({ error: "Failed to update session" }, 500);
  }
});

app.get("/sessions/:sessionId/meta", async (c) => {
  const sessionId = c.req.param("sessionId");
  try {
    await requireSessionReadAccess(c, sessionId);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Forbidden" }, 403);
  }
  const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromString(sessionId));
  const res = await stub.fetch("https://session/meta");
  return res;
});

app.get("/sessions/:sessionId/upload", async (c) => {
  const sessionId = c.req.param("sessionId");
  try {
    await requireSessionReadAccess(c, sessionId);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Forbidden" }, 403);
  }
  const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromString(sessionId));
  const res = await stub.fetch("https://session/upload/status");
  return res;
});

app.post("/sessions/:sessionId/upload", async (c) => {
  const sessionId = c.req.param("sessionId");
  try {
    await requireSessionWriteAccess(c, sessionId);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Forbidden" }, 403);
  }
  const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromString(sessionId));
  const res = await stub.fetch("https://session/upload", { method: "POST" });
  return res;
});

app.get("/sessions/:sessionId/archive", async (c) => {
  const sessionId = c.req.param("sessionId");
  try {
    await requireSessionReadAccess(c, sessionId);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Forbidden" }, 403);
  }
  const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromString(sessionId));
  const res = await stub.fetch("https://session/archive");
  return res;
});

app.post("/sessions/:sessionId/render", async (c) => {
  const sessionId = c.req.param("sessionId");
  const body = await c.req
    .json<{
      seed?: string;
      useGpu?: boolean;
      params?: Record<string, unknown> | null;
    }>()
    .catch(
      () =>
        ({} as {
          seed?: string;
          useGpu?: boolean;
          params?: Record<string, unknown> | null;
        })
    );
  const { seed, useGpu, params } = body;
  const jobId = crypto.randomUUID();
  const effectiveSeed = seed ?? randomSeed();

  try {
    await requireSessionWriteAccess(c, sessionId);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Forbidden" }, 403);
  }

  const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromString(sessionId));
  const metaRes = await stub.fetch("https://session/meta");
  if (!metaRes.ok) {
    const error = await metaRes.text();
    return new Response(JSON.stringify({ error }), {
      status: metaRes.status,
      headers: { "content-type": "application/json" },
    });
  }
  const meta = (await metaRes.json()) as SessionMeta;
  if (meta.upload?.state !== "complete" || !meta.upload?.cid) {
    return c.json({ error: "Project upload not complete." }, 400);
  }

  const payload: RenderJobCreatePayload = {
    jobId,
    seed: effectiveSeed,
    useGpu,
    params: params ?? null,
  };
  const createRes = await stub.fetch("https://session/render-jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    const contentType = createRes.headers.get("content-type") || "";
    if (contentType.toLowerCase().includes("application/json")) {
      const body = await createRes
        .json<{ error?: string; message?: string }>()
        .catch(() => null);
      return c.json(
        {
          error:
            body?.error?.trim() ||
            body?.message?.trim() ||
            "Render request failed",
        },
        createRes.status
      );
    }
    const error = (await createRes.text()) || "Render request failed";
    return c.json({ error }, createRes.status);
  }

  await stub.fetch(`https://session/render-jobs/${jobId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      state: "processing",
      completedAt: undefined,
    } satisfies RenderJobResultPayload),
  });

  c.executionCtx.waitUntil(
    processRenderJob({
      env: c.env,
      sessionId,
      jobId,
      seed: effectiveSeed,
      useGpu: !!useGpu,
      params: params ?? null,
    })
  );

  return c.json({ jobId, seed: effectiveSeed, state: "processing" });
});

app.get("/sessions/:sessionId/render/:jobId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const jobId = c.req.param("jobId");
  try {
    await requireSessionReadAccess(c, sessionId);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Forbidden" }, 403);
  }
  const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromString(sessionId));
  const res = await stub.fetch(`https://session/render-jobs/${jobId}`);
  return res;
});

// Serve render thumbnail from R2
app.get("/sessions/:sessionId/render/:jobId/thumbnail", async (c) => {
  const sessionId = c.req.param("sessionId");
  const jobId = c.req.param("jobId");
  try {
    await requireSessionReadAccess(c, sessionId);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Forbidden" }, 403);
  }

  const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromString(sessionId));
  const jobRes = await stub.fetch(`https://session/render-jobs/${jobId}`);
  if (!jobRes.ok) {
    return c.json({ error: "Job not found" }, 404);
  }

  const job = (await jobRes.json()) as any;
  const thumbnailKey = job.result?.thumbnailKey;
  if (!thumbnailKey) {
    return c.json({ error: "Thumbnail not available" }, 404);
  }

  const object = await c.env.R2_SANDBOX.get(thumbnailKey);
  if (!object) {
    return c.json({ error: "Thumbnail not found in storage" }, 404);
  }

  const headers = new Headers();
  const meta = object.httpMetadata;
  if (meta?.contentType) headers.set("content-type", meta.contentType);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});

// Serve render full-res from R2
app.get("/sessions/:sessionId/render/:jobId/full-res", async (c) => {
  const sessionId = c.req.param("sessionId");
  const jobId = c.req.param("jobId");
  try {
    await requireSessionReadAccess(c, sessionId);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Forbidden" }, 403);
  }

  const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromString(sessionId));
  const jobRes = await stub.fetch(`https://session/render-jobs/${jobId}`);
  if (!jobRes.ok) {
    return c.json({ error: "Job not found" }, 404);
  }

  const job = (await jobRes.json()) as any;
  const fullResKey = job.result?.fullResKey;
  if (!fullResKey) {
    return c.json({ error: "Full resolution not available" }, 404);
  }

  const object = await c.env.R2_SANDBOX.get(fullResKey);
  if (!object) {
    return c.json({ error: "Full resolution not found in storage" }, 404);
  }

  const headers = new Headers();
  const meta = object.httpMetadata;
  if (meta?.contentType) headers.set("content-type", meta.contentType);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});

// Viewer page for ScreenshotOne
app.get("/viewer", (c) => {
  const url = new URL(c.req.url);
  const params = url.searchParams;
  const cid = params.get("cid");
  const sessionId = params.get("session");
  const example = params.get("example");
  const entryParam = params.get("entry") ?? "index.html";
  const entry = entryParam.replace(/^\/+/, "");

  let basePath: string | null = null;
  if (cid) {
    basePath = `/ipfs/${cid}`;
  } else if (sessionId) {
    basePath = `/sessions/${sessionId}`;
  } else if (example) {
    basePath = `/examples/${example.replace(/^\/+/, "")}`;
  }

  if (!basePath) {
    return c.text("Missing viewer source", 400);
  }

  const iframeQuery = new URLSearchParams();
  iframeQuery.set("c", "true");

  const passThrough = ["s", "cm", "d", "selector", "i", "p"];

  for (const key of passThrough) {
    const value = params.get(key);
    if (value) {
      iframeQuery.set(key, value);
    }
  }

  const iframeSrc = `${basePath.replace(
    /\/$/,
    ""
  )}/${entry}?${iframeQuery.toString()}`;
  const html = buildViewerHtml(iframeSrc);

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
});

// IPFS proxy - serve files from R2 by CID
app.get("/ipfs/:cid/*", async (c) => {
  const cid = c.req.param("cid");
  const fullPath = c.req.path;
  const pathAfterCid = fullPath
    .replace(`/ipfs/${cid}/`, "")
    .replace(`/ipfs/${cid}`, "");
  const filePath = pathAfterCid || "index.html";
  const key = `${cid}/${filePath}`;

  console.log("[ipfs-proxy] fetching", { cid, fullPath, filePath, key });

  const object = await c.env.R2_SANDBOX.get(key);
  if (!object) {
    console.log("[ipfs-proxy] not found", key);
    return c.json({ error: "Not found", key }, 404, {
      "Cache-Control": "no-store",
    });
  }

  const headers = new Headers();
  const meta = object.httpMetadata;
  if (meta?.contentType) headers.set("content-type", meta.contentType);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  console.log("[ipfs-proxy] serving", { key, contentType: meta?.contentType });
  return new Response(object.body, { headers });
});

// Session file serving
app.get("/sessions/:sessionId/*", async (c) => {
  const sessionId = c.req.param("sessionId");
  try {
    await requireSessionReadAccess(c, sessionId);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.text(error.message, error.status);
    }
    return c.text("Forbidden", 403);
  }
  const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromString(sessionId));

  const prefix = `/sessions/${sessionId}/`;
  let path = c.req.path.startsWith(prefix)
    ? c.req.path.slice(prefix.length)
    : "";
  if (!path || path === "") {
    const metaRes = await stub.fetch("https://session/meta");
    if (!metaRes.ok) return new Response("Not initialized", { status: 404 });
    const meta = (await metaRes.json()) as { defaultEntry: string | null };
    path = meta.defaultEntry ?? "index.html";
  }

  const res = await stub.fetch(
    `https://session/files/${encodeURIComponent(path)}`
  );
  return res;
});

// =============================================================================
// THUMBNAIL ROUTES
// =============================================================================

const EDGE_TTL_SECONDS = 86400;
const WORKER_CACHE_BUSTER = "wcb-v7";
const CACHE_CONTROL_HEADER = `public, max-age=${EDGE_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=86400, stale-if-error=604800`;
const TRANSPARENT_PNG = decodeBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
);

type BootloaderType = "svg-js" | "generic-web";

const TZKT_API_BY_NETWORK: Record<"mainnet" | "shadownet", string> = {
  mainnet: "https://api.tzkt.io",
  shadownet: "https://api.shadownet.tzkt.io",
};

const GENERIC_WEB_CONTRACT_BY_NETWORK: Record<
  "mainnet" | "shadownet",
  string | null
> = {
  mainnet: null,
  shadownet: "KT1SskwiH2dSmeFH7scqvQ58YXTVt7DECuD5",
};

const GENERIC_WEB_BIGMAP_POINTERS_CACHE_TTL_MS = 60_000;
const genericWebBigmapPointersCache = new Map<
  "mainnet" | "shadownet",
  { tokenExtraPtr: number; ledgerPtr: number | null; cachedAtMs: number }
>();

// =============================================================================
// NEW NAMESPACED ROUTES (v1)
// =============================================================================

// SVG-JS routes (use Screenshot One)
app.get("/svg-js/v1/thumbnail/:id", async (c) => {
  return handleThumbnailRequest(c, "thumbnail", "svg-js");
});

app.get("/svg-js/v1/generator-thumbnail/:id", async (c) => {
  return handleThumbnailRequest(c, "generator-thumbnail", "svg-js");
});

// Generic-web routes (use Screenshot One)
app.get("/generic-web/v1/thumbnail/:id", async (c) => {
  return handleThumbnailRequest(c, "thumbnail", "generic-web");
});

app.get("/generic-web/v1/generator-thumbnail/:id", async (c) => {
  return handleThumbnailRequest(c, "generator-thumbnail", "generic-web");
});

// =============================================================================
// LEGACY ROUTES (backwards compatibility - maps to svg-js)
// =============================================================================

app.get("/thumbnail/:id", async (c) => {
  return handleThumbnailRequest(c, "thumbnail", "svg-js");
});

app.get("/generator-thumbnail/:id", async (c) => {
  return handleThumbnailRequest(c, "generator-thumbnail", "svg-js");
});

async function handleThumbnailRequest(
  c: any,
  type: "thumbnail" | "generator-thumbnail",
  bootloader: BootloaderType = "svg-js"
) {
  const request = c.req.raw;
  const id = c.req.param("id");
  const url = new URL(c.req.url);
  const isImg = isImageRequest(request);

  if (!id || Number.isNaN(Number(id))) {
    if (isImg) {
      return imageErrorResponse({
        status: 200,
        cacheControl: "no-store",
        type,
        id,
        request,
        note: "invalid-id",
        originalStatus: 400,
      });
    }
    return textResponse("Invalid ID. Must be a number.", 400);
  }

  const network = url.searchParams.get("n") || "m";
  if (!network || !["m", "g", "s"].includes(network)) {
    if (isImg) {
      return imageErrorResponse({
        status: 200,
        cacheControl: "no-store",
        type,
        id,
        request,
        note: "invalid-network",
        originalStatus: 400,
      });
    }
    return textResponse("wrong network", 400);
  }

  const requestedVersion = parseThumbnailVersion(url.searchParams.get("v"));
  let resolvedVersion = requestedVersion;
  const tokenIdNumber = Number(id);
  // Accept legacy "g" code for shadownet, but "s" is the canonical code.
  const isShadownet = network === "s" || network === "g";
  const tokenNetwork = isShadownet ? "shadownet" : "mainnet";

  if (
    resolvedVersion == null &&
    type === "thumbnail" &&
    bootloader === "generic-web" &&
    Number.isFinite(tokenIdNumber)
  ) {
    const queueInfo = await fetchGenericWebTokenQueueInfo(
      tokenNetwork,
      tokenIdNumber
    );
    if (queueInfo?.generatorVersion != null && queueInfo.generatorVersion > 0) {
      resolvedVersion = queueInfo.generatorVersion;
    }
  }

  const version = String(resolvedVersion ?? 1);
  const width = quantize(parseDimension(url.searchParams.get("width"), 400));
  const height = quantize(parseDimension(url.searchParams.get("height"), 400));
  const isTokenThumbnail = type === "thumbnail";
  const storeFeaturesSync =
    url.searchParams.get("sync_features") === "1" ||
    url.searchParams.get("sf") === "1";

  const persistFeatures = async (
    featuresJson: string | null,
    source: "edge" | "r2" | "do"
  ): Promise<void> => {
    if (!isTokenThumbnail || !featuresJson) return;
    console.log(
      "[Thumbnail Proxy] feature payload found",
      JSON.stringify({ source, tokenId: Number(id) })
    );
    const storePromise = storeTokenFeatures(c.env, {
      tokenId: Number(id),
      network: tokenNetwork,
      bootloader: bootloader as "svg-js" | "generic-web",
      featuresJson,
    });
    if (storeFeaturesSync) {
      await storePromise;
      console.log(
        "[Thumbnail Proxy] Features stored synchronously",
        JSON.stringify({ source, tokenId: Number(id), network })
      );
    } else {
      c.executionCtx.waitUntil(storePromise);
    }
  };

  // Determine the base URL and whether to use new embed routes or legacy routes
  // - shadownet.bootloader.art (new frontend): has /embed/* routes, supports all bootloaders
  // - bootloader.art (old frontend): has /thumbnail/* and /generator-thumbnail/* routes, svg-js only
  const usesNewFrontend = isShadownet;
  const baseUrl = usesNewFrontend
    ? "https://shadownet.bootloader.art"
    : "https://bootloader.art";

  let targetUrl: URL;

  // For generic-web generator thumbnails, look up the stored thumbnail seed
  let thumbnailSeed: string | null = null;
  if (type === "generator-thumbnail" && bootloader === "generic-web") {
    try {
      const generatorService = new GeneratorService(c.env.DB);
      const dbNetwork = tokenNetwork;
      const generator = await generatorService.getGenerator(
        Number(id),
        dbNetwork,
        bootloader
      );
      thumbnailSeed = generator?.thumbnailSeed ?? null;
    } catch (error) {
      // If local D1 schema is missing (e.g. generators table not migrated), keep rendering.
      // We only lose the preferred thumbnail seed fallback.
      console.warn(
        "[thumbnail] failed to load generic-web thumbnail seed from D1",
        { id, network, error }
      );
      thumbnailSeed = null;
    }
  }

  if (usesNewFrontend) {
    // New frontend with embed routes - supports both svg-js and generic-web
    const embedType = type === "generator-thumbnail" ? "generator" : "token";
    targetUrl = new URL(`/embed/${embedType}/${bootloader}/${id}`, baseUrl);
    targetUrl.searchParams.set("c", "true"); // capture mode
    targetUrl.searchParams.set("cb", `${version}-${WORKER_CACHE_BUSTER}`);
    // For svg-js generator thumbnails, use seed=0 and iteration=0 to match old frontend behavior
    // The old frontend's GeneratorThumbnailRenderer uses: generateSVG(code, 0, 0, 0)
    if (type === "generator-thumbnail" && bootloader === "svg-js") {
      targetUrl.searchParams.set("s", "0"); // seed
      targetUrl.searchParams.set("i", "0"); // iteration
    }
    // For generic-web generator thumbnails, use the stored thumbnail seed
    if (
      type === "generator-thumbnail" &&
      bootloader === "generic-web" &&
      thumbnailSeed
    ) {
      targetUrl.searchParams.set("s", thumbnailSeed);
    }
  } else {
    // Old frontend with legacy routes - svg-js only
    // For generic-web on old frontend, this will fail gracefully (404 or error page)
    // Legacy routes: /thumbnail/:id or /generator-thumbnail/:id (no bootloader param)
    const legacyPath =
      type === "generator-thumbnail"
        ? `/generator-thumbnail/${id}`
        : `/thumbnail/${id}`;
    targetUrl = new URL(legacyPath, baseUrl);
    targetUrl.searchParams.set("cb", `${version}-${WORKER_CACHE_BUSTER}`);
  }

  const { cacheKey, cacheKeyUrl, r2Key } = buildKeys({
    bootloader,
    type,
    id,
    network,
    version,
    width,
    height,
    targetUrl,
  });

  // Purge support
  if (url.searchParams.get("purge") === "1") {
    if (isImg) {
      return imageErrorResponse({
        status: 200,
        cacheControl: "no-store",
        type,
        id,
        request,
        note: "purge-disabled",
        originalStatus: 403,
      });
    }
    return textResponse("Purge endpoint disabled", 403);
  }

  // Check edge cache
  const edgeCache = caches.default;
  const edgeHit = await edgeCache.match(cacheKey);
  if (edgeHit) {
    if (isTokenThumbnail && storeFeaturesSync) {
      const edgeFeaturesHeader = edgeHit.headers.get("X-Token-Features");
      await persistFeatures(edgeFeaturesHeader, "edge");
      if (!edgeFeaturesHeader) {
        const featuresObj = await c.env.R2_THUMBS.get(`${r2Key}.features.json`);
        if (featuresObj) {
          const featuresJson = await featuresObj.text().catch(() => null);
          await persistFeatures(featuresJson, "r2");
        }
      }
    }
    const headers = new Headers(edgeHit.headers);
    headers.delete("X-Token-Features");
    headers.set("X-Worker-Cache", "EDGE_HIT");
    headers.set("X-Worker-Key", cacheKeyUrl.toString());
    if (request.method === "HEAD") {
      await edgeHit.body?.cancel();
    }
    return new Response(request.method === "HEAD" ? null : edgeHit.body, {
      status: edgeHit.status,
      headers,
    });
  }

  // Check R2
  const object = await c.env.R2_THUMBS.get(r2Key);
  if (object) {
    if (isTokenThumbnail && storeFeaturesSync) {
      const featuresObj = await c.env.R2_THUMBS.get(`${r2Key}.features.json`);
      if (featuresObj) {
        const featuresJson = await featuresObj.text().catch(() => null);
        await persistFeatures(featuresJson, "r2");
      }
    }
    const r2Response = r2ToResponse(object, CACHE_CONTROL_HEADER);
    c.executionCtx.waitUntil(edgeCache.put(cacheKey, r2Response.clone()));
    const headers = new Headers(r2Response.headers);
    headers.set("X-Worker-Cache", "R2_HIT");
    headers.set("X-Worker-Key", cacheKeyUrl.toString());
    if (request.method === "HEAD") {
      await r2Response.body?.cancel();
      return new Response(null, {
        status: r2Response.status,
        headers,
      });
    }
    return new Response(r2Response.body, {
      status: r2Response.status,
      headers,
    });
  }

  // HEAD request with no cached content
  if (request.method === "HEAD") {
    const headers = new Headers({
      "Cache-Control": "no-store",
    });
    headers.set("X-Worker-Cache", "MISS_NO_RENDER");
    headers.set("X-Worker-Key", cacheKeyUrl.toString());
    return new Response(null, { status: 204, headers });
  }

  // Trigger render via Durable Object
  const coordinatorId = c.env.RENDO.idFromName(r2Key);
  const coordinator = c.env.RENDO.get(coordinatorId);
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
      bootloader,
    }),
  });

  if (!doResponse.ok) {
    const text = await doResponse.text().catch(() => "");
    const status = doResponse.status || 500;
    if (isImg) {
      return imageErrorResponse({
        status: 200,
        cacheControl: "no-store",
        type,
        id,
        request,
        note: `render-error-${status}`,
        originalStatus: status,
      });
    }
    return textResponse(text || "Thumbnail render failed", status, "no-store");
  }

  const renderResponse = new Response(doResponse.body, {
    status: doResponse.status,
    headers: new Headers(doResponse.headers),
  });
  const cacheCopy = renderResponse.clone();
  c.executionCtx.waitUntil(edgeCache.put(cacheKey, cacheCopy));
  const headers = new Headers(renderResponse.headers);
  headers.set("X-Worker-Cache", "DO_RENDER");
  headers.set("X-Worker-Key", cacheKeyUrl.toString());

  await persistFeatures(doResponse.headers.get("X-Token-Features"), "do");

  // Remove features header from client response (it can be large)
  headers.delete("X-Token-Features");

  if (request.method === "HEAD") {
    await renderResponse.body?.cancel();
    return new Response(null, {
      status: renderResponse.status,
      headers,
    });
  }
  return new Response(renderResponse.body, {
    status: renderResponse.status,
    headers,
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function parseDimension(value: string | null, fallback: number): number {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseThumbnailVersion(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase().startsWith("v")
    ? trimmed.slice(1)
    : trimmed;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function quantize(value: number, step = 16): number {
  const clamped = clamp(Math.floor(value), 1, 1000);
  const buckets = Math.floor(clamped / step) * step;
  return clamp(buckets > 0 ? buckets : step, 1, 1000);
}

function buildKeys({
  bootloader,
  type,
  id,
  network,
  version,
  width,
  height,
  targetUrl,
}: {
  bootloader: BootloaderType;
  type: string;
  id: string;
  network: string;
  version: string;
  width: number;
  height: number;
  targetUrl: URL;
}) {
  // R2 key structure: {network}/{bootloader}/{type}/{id}/{version}-{cache_buster}/{width}x{height}.png
  const r2Key = `${network}/${bootloader}/${type}/${id}/${version}-${WORKER_CACHE_BUSTER}/${width}x${height}.png`;
  const cacheKeyUrl = new URL(targetUrl.toString());
  cacheKeyUrl.searchParams.set("size", `${width}x${height}`);
  cacheKeyUrl.searchParams.set("bl", bootloader);
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });
  return { r2Key, cacheKey, cacheKeyUrl };
}

function r2ToResponse(object: any, cacheControl: string) {
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

function makeImageHeaders(cacheControl: string, type: string, id: string) {
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

function extractBytesFromOption(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return value.startsWith("0x") ? value.slice(2) : value;
  }

  if (typeof value === "object") {
    const asRecord = value as Record<string, unknown>;
    const someValue =
      asRecord.Some ?? asRecord.some ?? asRecord.bytes ?? asRecord.value;
    if (typeof someValue === "string") {
      return someValue.startsWith("0x") ? someValue.slice(2) : someValue;
    }
  }

  return null;
}

async function fetchGenericWebTokenQueueInfo(
  network: "mainnet" | "shadownet",
  tokenId: number,
  options?: { includeOwner?: boolean }
): Promise<{
  generatorId: number | null;
  generatorVersion: number | null;
  iteration: number | null;
  seed: string | null;
  ownerAddress: string | null;
} | null> {
  const contract = GENERIC_WEB_CONTRACT_BY_NETWORK[network];
  if (!contract) return null;

  const tzktBase = TZKT_API_BY_NETWORK[network];
  const includeOwner = options?.includeOwner === true;

  try {
    const now = Date.now();
    const cachedPointers = genericWebBigmapPointersCache.get(network);
    let tokenExtraPtr: number | null = null;
    let ledgerPtr: number | null = null;

    if (
      cachedPointers &&
      now - cachedPointers.cachedAtMs <=
        GENERIC_WEB_BIGMAP_POINTERS_CACHE_TTL_MS
    ) {
      tokenExtraPtr = cachedPointers.tokenExtraPtr;
      ledgerPtr = cachedPointers.ledgerPtr;
    } else {
      const bigmapsResponse = await fetch(
        `${tzktBase}/v1/contracts/${contract}/bigmaps`
      );
      if (!bigmapsResponse.ok) return null;
      const bigmaps = (await bigmapsResponse.json()) as Array<{
        path?: string;
        ptr?: number;
      }>;
      const tokenExtraMap = bigmaps.find(
        (entry) => entry.path === "token_extra"
      );
      const ledgerMap = bigmaps.find((entry) => entry.path === "ledger");
      tokenExtraPtr = tokenExtraMap?.ptr ?? null;
      ledgerPtr = ledgerMap?.ptr ?? null;
      if (tokenExtraPtr == null) return null;
      genericWebBigmapPointersCache.set(network, {
        tokenExtraPtr,
        ledgerPtr,
        cachedAtMs: now,
      });
    }

    if (tokenExtraPtr == null) return null;

    const extraResponse = await fetch(
      `${tzktBase}/v1/bigmaps/${tokenExtraPtr}/keys/${tokenId}`
    );
    if (!extraResponse.ok) return null;
    const extraPayload = (await extraResponse.json()) as {
      value?: Record<string, unknown>;
    };
    const value = extraPayload.value || {};

    const generatorIdRaw = value.generator_id ?? value.generatorId;
    const generatorVersionRaw =
      value.generator_version ?? value.generatorVersion;
    const iterationRaw = value.iteration_number ?? value.iteration;
    const seedRaw = value.raw_seed ?? value.seed;

    const generatorId = Number.isFinite(Number(generatorIdRaw))
      ? Number(generatorIdRaw)
      : null;
    const generatorVersion = Number.isFinite(Number(generatorVersionRaw))
      ? Number(generatorVersionRaw)
      : null;
    const iteration = Number.isFinite(Number(iterationRaw))
      ? Number(iterationRaw)
      : null;
    const seed = extractBytesFromOption(seedRaw);

    let ownerAddress: string | null = null;
    if (includeOwner && ledgerPtr != null) {
      const ownerResponse = await fetch(
        `${tzktBase}/v1/bigmaps/${ledgerPtr}/keys/${tokenId}`
      );
      if (ownerResponse.ok) {
        const ownerPayload = (await ownerResponse.json()) as { value?: string };
        ownerAddress = ownerPayload.value || null;
      }
    }

    return {
      generatorId,
      generatorVersion,
      iteration,
      seed,
      ownerAddress,
    };
  } catch (error) {
    console.warn("[fetchGenericWebTokenQueueInfo] Failed:", {
      network,
      tokenId,
      error,
    });
    return null;
  }
}

/**
 * Store token features in D1 database
 * This is called asynchronously after thumbnail generation
 */
async function storeTokenFeatures(
  env: Bindings,
  params: {
    tokenId: number;
    network: "mainnet" | "shadownet";
    bootloader: "svg-js" | "generic-web";
    featuresJson: string;
  }
): Promise<void> {
  try {
    const features = JSON.parse(params.featuresJson) as Record<string, unknown>;
    if (!features || Object.keys(features).length === 0) {
      return;
    }

    const tokenService = new TokenService(env.DB);
    let generatorId = 0;
    let iteration: number | null = null;
    let seed: string | null = null;
    let ownerAddress: string | null = null;

    if (params.bootloader === "generic-web") {
      const queueInfo = await fetchGenericWebTokenQueueInfo(
        params.network,
        params.tokenId,
        { includeOwner: true }
      );
      if (queueInfo?.generatorId != null) {
        generatorId = queueInfo.generatorId;
      }
      iteration = queueInfo?.iteration ?? null;
      seed = queueInfo?.seed ?? null;
      ownerAddress = queueInfo?.ownerAddress ?? null;
    }

    await tokenService.storeToken({
      id: params.tokenId,
      generatorId,
      network: params.network,
      bootloader: params.bootloader,
      iteration,
      seed,
      ownerAddress,
      features,
    });

    console.log(
      `[storeTokenFeatures] Stored ${
        Object.keys(features).length
      } features for token ${params.tokenId}`
    );
  } catch (error) {
    console.error("[storeTokenFeatures] Failed to store features:", error);
  }
}

function textResponse(
  message: string,
  status: number,
  cacheControl = "no-store"
) {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": cacheControl,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function isImageRequest(request: Request): boolean {
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
}: {
  status?: number;
  cacheControl?: string;
  type: string;
  id: string;
  request: Request;
  note?: string;
  originalStatus?: number;
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

// =============================================================================
// RENDER JOB PROCESSING (for sandbox sessions)
// =============================================================================

const SCREENSHOTONE_TAKE_URL = "https://api.screenshotone.com/take";
const SCREENSHOTONE_ANIMATE_URL = "https://api.screenshotone.com/animate";
const SCREENSHOTONE_WAIT_SELECTOR =
  '#capture-marker[data-capture-ready="true"]';
const DEFAULT_CAPTURE_WIDTH = 800;
const DEFAULT_CAPTURE_HEIGHT = 800;
const DEFAULT_CAPTURE_DELAY_MS = 5000;
const DEFAULT_ANIMATION_DURATION_MS = 5000;
const DEFAULT_ANIMATION_FPS = 30;
const SCREENSHOTONE_TIMEOUT_SECONDS = 90;

interface ResolvedCaptureConfig {
  mode: CaptureMode;
  width: number;
  height: number;
  delayMs: number;
  target: CaptureTarget;
  selector: string | null;
}

interface ResolvedAnimationConfig {
  durationMs: number;
  fps: number;
}

async function processRenderJob({
  env,
  sessionId,
  jobId,
  seed,
  useGpu,
  params,
}: {
  env: Bindings;
  sessionId: string;
  jobId: string;
  seed: string;
  useGpu: boolean;
  params: Record<string, unknown> | null;
}) {
  const stub = env.SESSIONS.get(env.SESSIONS.idFromString(sessionId));

  const markError = async (message: string) => {
    await stub.fetch(`https://session/render-jobs/${jobId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state: "error",
        completedAt: Date.now(),
        error: message,
      } satisfies RenderJobResultPayload),
    });
  };

  try {
    const metaRes = await stub.fetch("https://session/meta");
    if (!metaRes.ok) {
      await markError("Session metadata unavailable");
      return;
    }

    const sessionMeta = (await metaRes.json()) as SessionMeta;
    const entryPath = sessionMeta.defaultEntry ?? "index.html";
    const cid = sessionMeta.cid ?? sessionMeta.upload?.cid;
    if (!cid) {
      await markError("Project upload incomplete");
      return;
    }

    const manifest = await loadManifest(env, cid, entryPath);
    const capture = resolveCaptureConfig(manifest?.capture);
    const animation = resolveAnimationConfig(manifest?.animation);
    const defaults = resolveParamDefaults(manifest?.parameters?.schema);
    const effectiveParams = mergeParamValues(
      manifest?.parameters?.schema,
      defaults,
      params
    );

    let viewerUrl: string;
    try {
      viewerUrl = buildViewerUrl({
        baseUrl: ensureWorkerUrl(env),
        cid,
        entryPath,
        capture,
        params: effectiveParams,
        seed,
      });
    } catch (error) {
      await markError(error instanceof Error ? error.message : String(error));
      return;
    }

    console.log("[worker] viewer URL for ScreenshotOne:", viewerUrl);

    const { screenshotUrl, contentUrl } = await requestScreenshotOne(env, {
      url: viewerUrl,
      capture,
      animation,
    });

    if (!screenshotUrl) {
      await markError("ScreenshotOne did not return a screenshot URL");
      return;
    }

    const asset = await downloadBinary(screenshotUrl);
    const ext = mimeToExtension(asset.mime);
    const assetKey = `renders/${sessionId}/${jobId}/capture.${ext}`;

    await env.R2_SANDBOX.put(assetKey, asset.bytes, {
      httpMetadata: {
        contentType: asset.mime,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: { sessionId, jobId },
    });

    let features: Record<string, unknown> | null = null;
    let featuresKey: string | undefined;
    if (contentUrl) {
      const html = await downloadText(contentUrl);
      if (html) {
        features = extractFeatures(html);
      }
    }

    if (features && Object.keys(features).length > 0) {
      featuresKey = `renders/${sessionId}/${jobId}/features.json`;
      await env.R2_SANDBOX.put(featuresKey, JSON.stringify(features), {
        httpMetadata: {
          contentType: "application/json",
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: { sessionId, jobId },
      });
    }

    const paramsForResult =
      Object.keys(effectiveParams).length > 0 ? effectiveParams : null;

    const payload: RenderJobResultPayload = {
      state: "complete",
      completedAt: Date.now(),
      result: {
        fullResKey: assetKey,
        thumbnailKey: assetKey,
        mime: asset.mime,
        fullResolution: { x: capture.width, y: capture.height },
        thumbnailResolution: { x: capture.width, y: capture.height },
        features: features ?? null,
        params: paramsForResult,
        featuresKey,
        metadata: {
          hash: seed,
          iteration: 1,
          hasAnimation: !!animation,
          animationFrameCount: animation
            ? Math.round((animation.durationMs / 1000) * animation.fps)
            : undefined,
        },
      },
    };

    await stub.fetch(`https://session/render-jobs/${jobId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[worker] render failed", { sessionId, jobId, message });
    await markError(message);
  }
}

function resolveCaptureConfig(
  config?: CaptureConfig | null
): ResolvedCaptureConfig {
  const mode: CaptureMode = config?.mode === "trigger" ? "trigger" : "auto";
  const width = clampInt(
    config?.viewPortDimension?.width ?? DEFAULT_CAPTURE_WIDTH,
    1,
    8192
  );
  const height = clampInt(
    config?.viewPortDimension?.height ?? DEFAULT_CAPTURE_HEIGHT,
    1,
    8192
  );
  const delayMs = Number.isFinite(config?.delayMs)
    ? Math.max(0, Number(config?.delayMs))
    : DEFAULT_CAPTURE_DELAY_MS;
  const target: CaptureTarget =
    config?.target === "viewport" ? "viewport" : "auto";
  const selector =
    typeof config?.selector === "string" && config.selector.length > 0
      ? config.selector
      : null;
  return { mode, width, height, delayMs, target, selector };
}

function resolveAnimationConfig(
  config?: AnimationConfig | null
): ResolvedAnimationConfig | null {
  if (!config) return null;
  const durationMs = Number.isFinite(config.duration)
    ? Math.max(100, Number(config.duration))
    : DEFAULT_ANIMATION_DURATION_MS;
  const fps = Number.isFinite(config.fps)
    ? Math.max(1, Number(config.fps))
    : DEFAULT_ANIMATION_FPS;
  return { durationMs, fps };
}

async function loadManifest(
  env: Bindings,
  cid: string,
  entryPath: string
): Promise<BootloaderManifest | null> {
  const candidates = new Set<string>();
  const entryDirIndex = entryPath.lastIndexOf("/");
  if (entryDirIndex > -1) {
    candidates.add(`${cid}/${entryPath.slice(0, entryDirIndex)}/manifest.json`);
  }
  candidates.add(`${cid}/manifest.json`);

  for (const key of candidates) {
    try {
      const object = await env.R2_SANDBOX.get(key);
      if (!object) continue;
      const text = await object.text();
      const manifest = JSON.parse(text) as BootloaderManifest;
      if (
        manifest &&
        typeof manifest === "object" &&
        typeof manifest.spec === "string"
      ) {
        return manifest;
      }
    } catch (error) {
      console.warn("[worker] failed to load manifest candidate", key, error);
    }
  }
  return null;
}

function resolveParamDefaults(
  schema?: ParamDefinition[] | null
): Record<string, unknown> {
  if (!Array.isArray(schema)) return {};
  const result: Record<string, unknown> = {};
  for (const def of schema) {
    if (!def || typeof def.id !== "string") continue;
    if (def.default === undefined) continue;
    result[def.id] = cloneValue(def.default);
  }
  return result;
}

function mergeParamValues(
  schema: ParamDefinition[] | undefined | null,
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown> | null
): Record<string, unknown> {
  if (!overrides || Object.keys(overrides).length === 0) {
    return defaults;
  }

  const merged = { ...defaults };
  const allowedIds = new Set((schema ?? []).map((def) => def.id));

  for (const [key, value] of Object.entries(overrides)) {
    if (allowedIds.size === 0 || allowedIds.has(key)) {
      merged[key] = cloneValue(value);
    }
  }

  return merged;
}

function encodeParamsForQuery(values: Record<string, unknown>): string | null {
  if (!values || Object.keys(values).length === 0) return null;
  const encoded = encodeParamValue(values);
  const json = JSON.stringify(encoded);
  const bytes = new TextEncoder().encode(json);
  return base64UrlEncode(bytes);
}

function encodeParamValue(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return value;
    }
    return { "@f": floatToToken(value) };
  }
  if (Array.isArray(value)) {
    return value.map(encodeParamValue);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = encodeParamValue(inner);
    }
    return out;
  }
  return value;
}

function floatToToken(value: number): string {
  return Number(value).toPrecision(17);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function ensureWorkerUrl(env: Bindings): string {
  const base = env.WORKER_URL?.trim();
  if (!base) {
    throw new Error(
      "WORKER_URL binding is required for ScreenshotOne extraction"
    );
  }
  return base.endsWith("/") ? base : `${base}`;
}

function buildViewerUrl({
  baseUrl,
  cid,
  entryPath,
  capture,
  params,
  seed,
}: {
  baseUrl: string;
  cid: string;
  entryPath: string;
  capture: ResolvedCaptureConfig;
  params: Record<string, unknown>;
  seed: string;
}): string {
  const url = new URL("/viewer", baseUrl);
  url.searchParams.set("cid", cid);
  url.searchParams.set("entry", entryPath.replace(/^\/+/, ""));
  url.searchParams.set("s", seed);
  url.searchParams.set("cm", capture.mode);
  url.searchParams.set("d", String(capture.delayMs));
  if (capture.selector) {
    url.searchParams.set("selector", capture.selector);
  }
  url.searchParams.set("i", "1");

  const encodedParams = encodeParamsForQuery(params);
  if (encodedParams) {
    url.searchParams.set("p", encodedParams);
  }

  return url.toString();
}

async function requestScreenshotOne(
  env: Bindings,
  opts: {
    url: string;
    capture: ResolvedCaptureConfig;
    animation: ResolvedAnimationConfig | null;
  }
): Promise<{ screenshotUrl: string; contentUrl?: string }> {
  if (!env.SO_ACCESS_KEY) {
    throw new Error("SO_ACCESS_KEY binding is missing");
  }

  const params = new URLSearchParams({
    access_key: env.SO_ACCESS_KEY,
    url: opts.url,
    response_type: "json",
    viewport_width: String(opts.capture.width),
    viewport_height: String(opts.capture.height),
    device_scale_factor: "1",
    block_ads: "true",
    block_cookie_banners: "true",
    block_banners_by_heuristics: "true",
    metadata_content: "true",
    wait_for_selector: SCREENSHOTONE_WAIT_SELECTOR,
    timeout: String(SCREENSHOTONE_TIMEOUT_SECONDS),
  });

  if (opts.capture.selector && opts.capture.target !== "viewport") {
    params.set("selector", opts.capture.selector);
  }

  if (opts.capture.delayMs > 0) {
    params.set("delay", (opts.capture.delayMs / 1000).toFixed(2));
  }

  let endpoint = SCREENSHOTONE_TAKE_URL;
  if (opts.animation) {
    endpoint = SCREENSHOTONE_ANIMATE_URL;
    const durationSeconds = Math.max(
      1,
      Math.min(30, Math.round(opts.animation.durationMs / 1000))
    );
    params.set("format", "gif");
    params.set("duration", String(durationSeconds));
  } else {
    params.set("format", "png");
  }

  const response = await fetch(`${endpoint}?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`ScreenshotOne request failed: ${text}`);
  }

  interface ScreenshotOneResponseBody {
    screenshot_url?: string;
    content?: { url?: string };
    metadata?: { content_url?: string };
  }

  const body = (await response.json()) as ScreenshotOneResponseBody;
  return {
    screenshotUrl: body.screenshot_url ?? "",
    contentUrl: body.content?.url ?? body.metadata?.content_url,
  };
}

async function downloadBinary(
  url: string
): Promise<{ bytes: Uint8Array; mime: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Failed to download screenshot: ${text || response.status}`
    );
  }
  const buffer = await response.arrayBuffer();
  const mime =
    response.headers.get("content-type") ?? "application/octet-stream";
  return { bytes: new Uint8Array(buffer), mime };
}

async function downloadText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.warn("[worker] failed to download metadata content", error);
    return null;
  }
}

function extractFeatures(html: string): Record<string, unknown> | null {
  const attrMatch = html.match(
    /id="traits-container"[^>]*data-features="([^"]*)"/i
  );
  if (attrMatch) {
    try {
      const decoded = decodeHtmlEntities(attrMatch[1]);
      return JSON.parse(decoded);
    } catch {
      // Non-fatal: HTML serializers may mutate attribute encoding.
      // We keep a fallback parser using inner text below.
    }
  }

  const contentMatch = html.match(
    /<div[^>]*id="traits-container"[^>]*>([\s\S]*?)<\/div>/i
  );
  if (contentMatch) {
    const text = contentMatch[1].trim();
    if (text.length) {
      try {
        return JSON.parse(text);
      } catch (error) {
        console.warn("[worker] failed to parse traits inner text", error);
      }
    }
  }
  return null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function cloneValue<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function mimeToExtension(mime: string): string {
  if (mime.startsWith("image/png")) return "png";
  if (mime.startsWith("image/jpeg")) return "jpg";
  if (mime.startsWith("image/gif")) return "gif";
  if (mime.startsWith("image/webp")) return "webp";
  if (mime.startsWith("video/mp4")) return "mp4";
  if (mime.startsWith("video/webm")) return "webm";
  return "bin";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildViewerHtml(iframeSrc: string): string {
  const safeSrc = escapeHtml(iframeSrc);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bootloader Viewer</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
      }
      #capture-marker,
      #traits-container {
        position: absolute;
        width: 1px;
        height: 1px;
        top: -9999px;
        left: -9999px;
        opacity: 0;
        pointer-events: none;
      }
    </style>
  </head>
  <body>
    <iframe id="content-frame" src="${safeSrc}"></iframe>
    <div id="capture-marker" data-capture-ready="false"></div>
    <div id="traits-container"></div>
    <script>
      (function () {
        const iframe = document.getElementById('content-frame');
        const captureMarker = document.getElementById('capture-marker');
        const traitsContainer = document.getElementById('traits-container');

        function markCapture(data) {
          if (!captureMarker) return;
          captureMarker.setAttribute('data-capture-ready', 'true');
          captureMarker.setAttribute('data-timestamp', String(Date.now()));
          if (data && data.resolution) {
            if (data.resolution.width) {
              captureMarker.setAttribute('data-width', String(data.resolution.width));
            }
            if (data.resolution.height) {
              captureMarker.setAttribute('data-height', String(data.resolution.height));
            }
          }
        }

        function storeFeatures(payload) {
          if (!traitsContainer || !payload) return;
          try {
            const json = JSON.stringify(payload, null, 2);
            traitsContainer.textContent = json;
            traitsContainer.setAttribute('data-features', json.replace(/"/g, '&quot;'));
          } catch (error) {
            console.warn('[viewer] failed to serialize features', error);
          }
        }

        window.addEventListener('message', (event) => {
          if (!iframe || event.source !== iframe.contentWindow) return;
          const message = event.data;
          if (!message || typeof message.id !== 'string') return;

          if (message.id === 'bootloader:capture') {
            markCapture(message.data || {});
          }

          if (message.id === 'bootloader:features') {
            storeFeatures(message.data);
          }

        });

        if (iframe) {
          iframe.addEventListener('load', () => {
            if (captureMarker) {
              captureMarker.setAttribute('data-frame-loaded', String(Date.now()));
            }
          });
        }
      })();
    </script>
  </body>
</html>`;
}

// =============================================================================
// RENDER COORDINATOR DURABLE OBJECT (for thumbnail rendering)
// =============================================================================

export class RenderCoordinator {
  private state: DurableObjectState;
  private env: Bindings;
  private inflight: Map<string, Promise<Response>>;

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.env = env;
    this.inflight = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/render") {
      return textResponse("Not found", 404);
    }

    let payload: any;
    try {
      payload = await request.json();
    } catch {
      return textResponse("Bad JSON", 400);
    }

    const { r2Key, target, width, height, cacheControl, type, id, bootloader } =
      payload || {};
    if (!r2Key || !target || !width || !height) {
      return textResponse("Missing fields", 400);
    }

    if (this.inflight.has(r2Key)) {
      return this.inflight.get(r2Key)!.then((res) => res.clone());
    }

    const task = (async () => {
      const existing = await this.env.R2_THUMBS.get(r2Key);
      if (existing) {
        // Check if we have stored features for this r2Key
        const featuresKey = `${r2Key}.features.json`;
        const featuresObj = await this.env.R2_THUMBS.get(featuresKey);
        const response = r2ToResponse(existing, cacheControl);
        if (featuresObj) {
          const featuresText = await featuresObj.text();
          const headers = new Headers(response.headers);
          headers.set("X-Token-Features", featuresText);
          return new Response(response.body, {
            status: response.status,
            headers,
          });
        }
        return response;
      }

      // Use Screenshot One for all bootloader types
      if (!this.env.SO_ACCESS_KEY) {
        return textResponse("SO_ACCESS_KEY binding is missing", 500);
      }

      const params = new URLSearchParams({
        access_key: this.env.SO_ACCESS_KEY,
        url: target,
        response_type: "json",
        viewport_width: String(width),
        viewport_height: String(height),
        device_scale_factor: "1",
        format: "png",
        block_ads: "true",
        block_cookie_banners: "true",
        block_banners_by_heuristics: "true",
        timeout: "60",
        // Request HTML content for feature extraction (generic-web tokens)
        metadata_content: "true",
      });

      // For svg-js, we wait for the page to load; for generic-web, wait for capture marker
      if (bootloader === "generic-web") {
        params.set(
          "wait_for_selector",
          '#capture-marker[data-capture-ready="true"]'
        );
      } else {
        // svg-js: wait for SVG to render (use delay)
        params.set("delay", "3");
      }

      let apiResponse: Response;
      try {
        apiResponse = await fetch(
          `${SCREENSHOTONE_TAKE_URL}?${params.toString()}`
        );
      } catch (error: any) {
        return textResponse(
          `Screenshot network error: ${error?.message || "unknown"}`,
          502
        );
      }

      if (!apiResponse.ok) {
        const text = await apiResponse.text().catch(() => "Unknown error");
        return textResponse(
          `Screenshot One request failed: ${text}`,
          apiResponse.status || 500
        );
      }

      interface ScreenshotOneResponse {
        screenshot_url?: string;
        content?: { url?: string };
        metadata?: { content_url?: string };
      }

      const json = (await apiResponse.json()) as ScreenshotOneResponse;
      console.log(
        "[RenderCoordinator] Screenshot One response:",
        JSON.stringify(json, null, 2)
      );
      const screenshotUrl = json.screenshot_url;
      if (!screenshotUrl) {
        return textResponse(
          "Screenshot One did not return a screenshot URL",
          500
        );
      }

      // Download the screenshot
      const imageResponse = await fetch(screenshotUrl);
      if (!imageResponse.ok) {
        return textResponse(
          `Failed to download screenshot: ${imageResponse.status}`,
          502
        );
      }

      const bytes = new Uint8Array(await imageResponse.arrayBuffer());

      await this.env.R2_THUMBS.put(r2Key, bytes, {
        httpMetadata: {
          contentType: "image/png",
          cacheControl,
        },
      });

      // Extract features from content URL (for generic-web tokens)
      let features: Record<string, unknown> | null = null;
      const contentUrl = json.content?.url ?? json.metadata?.content_url;
      console.log("[RenderCoordinator] Feature extraction check:", {
        contentUrl: !!contentUrl,
        type,
        bootloader,
      });
      if (contentUrl && type === "thumbnail" && bootloader === "generic-web") {
        try {
          console.log("[RenderCoordinator] Fetching content URL:", contentUrl);
          const contentResponse = await fetch(contentUrl);
          if (contentResponse.ok) {
            const html = await contentResponse.text();
            console.log(
              "[RenderCoordinator] HTML content length:",
              html.length
            );
            console.log(
              "[RenderCoordinator] Has traits-container:",
              html.includes("traits-container")
            );
            console.log(
              "[RenderCoordinator] Has data-features:",
              html.includes("data-features")
            );
            features = extractFeatures(html);
            console.log("[RenderCoordinator] Extracted features:", features);
            // Store features alongside thumbnail in R2
            if (features && Object.keys(features).length > 0) {
              const featuresKey = `${r2Key}.features.json`;
              await this.env.R2_THUMBS.put(
                featuresKey,
                JSON.stringify(features),
                {
                  httpMetadata: {
                    contentType: "application/json",
                    cacheControl,
                  },
                }
              );
              console.log(
                "[RenderCoordinator] Stored features in R2:",
                featuresKey
              );
            }
          } else {
            console.warn(
              "[RenderCoordinator] Content fetch failed:",
              contentResponse.status
            );
          }
        } catch (error) {
          console.warn(
            "[RenderCoordinator] Failed to extract features:",
            error
          );
        }
      }

      const responseHeaders = new Headers(
        makeImageHeaders(cacheControl, type, id)
      );
      if (features && Object.keys(features).length > 0) {
        responseHeaders.set("X-Token-Features", JSON.stringify(features));
      }

      return new Response(bytes, {
        status: 200,
        headers: responseHeaders,
      });
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

// =============================================================================
// SPA CATCH-ALL (serves frontend for non-API routes)
// =============================================================================

// Catch-all: serve static assets or index.html for SPA routing
app.get("*", async (c) => {
  // Try to serve from assets
  if (c.env.ASSETS) {
    try {
      // First try the exact path
      const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
      if (assetResponse.ok) {
        return assetResponse;
      }
    } catch (error) {
      console.error("[assets] Error serving exact path:", error);
    }

    // For SPA routing: serve index.html for any path that didn't match a file
    // Check if request accepts HTML (browser navigation)
    const acceptHeader = c.req.header("accept") || "";
    if (acceptHeader.includes("text/html")) {
      try {
        const indexUrl = new URL("/index.html", c.req.url);
        const indexResponse = await c.env.ASSETS.fetch(
          new Request(indexUrl.toString())
        );
        if (indexResponse.ok) {
          return indexResponse;
        }
      } catch (error) {
        console.error("[assets] Error serving index.html:", error);
      }
    }
  }

  return c.text("Not found", 404);
});

// =============================================================================
// EXPORTS
// =============================================================================

const worker: ExportedHandler<Bindings> = {
  fetch: app.fetch,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      runGenericWebMetadataIndexer(env, { source: "cron" })
        .then((summary) => {
          console.log("[indexer] cron run finished", JSON.stringify(summary));
        })
        .catch((error) => {
          console.error("[indexer] cron run failed", error);
        })
    );
  },
};

export default worker;
export { SessionDurableObject } from "./session-do";
