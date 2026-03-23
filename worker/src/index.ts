import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  Bindings,
  RenderJobCreatePayload,
  RenderJobResultPayload,
  SessionInitResponse,
  SessionMeta,
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
import {
  BOOTLOADER_IDS,
  getSharedBootloaderCatalogEntry,
  isSharedBootloaderId,
  type SharedBootloaderId,
} from "../../shared/bootloaders/catalog";
import {
  buildViewerHtml,
  extractFeatures,
  processRenderJob,
} from "./lib/render-jobs";
import {
  fetchGenericWebGeneratorArtifactCid,
  fetchGenericWebGeneratorMetadata,
  fetchGenericWebTokenArtifactUri,
  fetchGenericWebTokenMetadata,
  fetchGenericWebTokenQueueInfo,
  fetchSvgJsGeneratorCode,
  fetchSvgJsTokenMetadata,
} from "./lib/bootloader-chain";
import {
  buildSocialMetaFromRoute,
  buildSocialMetaTags,
  injectTagsIntoHead,
  injectTitleAndDescription,
  resolveNetworkFromRequest,
} from "./lib/share-meta";

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

function parseBootloaderId(value: string): SharedBootloaderId | null {
  return isSharedBootloaderId(value) ? value : null;
}

function ensureTaquitoRuntimeGlobals(): void {
  if (!(globalThis as any).global) {
    (globalThis as any).global = globalThis;
  }

  if (!(globalThis as any).process) {
    (globalThis as any).process = {
      env: {},
      argv: [],
      version: "",
      versions: {},
      platform: "worker",
      release: { name: "node" },
      cwd: () => "/",
      nextTick: (cb: (...args: any[]) => void, ...args: any[]) => {
        queueMicrotask(() => cb(...args));
      },
    };
  }
}

function utf8ToHex(value: string): string {
  return Array.from(new TextEncoder().encode(value), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

let artifactSignerPromise: Promise<{ signer: any; packer: any }> | null = null;

async function getArtifactSigner(privateKey: string): Promise<{
  signer: any;
  packer: any;
}> {
  if (!artifactSignerPromise) {
    artifactSignerPromise = (async () => {
      ensureTaquitoRuntimeGlobals();

      const [taquitoModule, signerModule] = await Promise.all([
        import("@taquito/taquito"),
        import("@taquito/signer"),
      ]);

      const MichelCodecPacker =
        (taquitoModule as any).MichelCodecPacker ??
        (taquitoModule as any).default?.MichelCodecPacker ??
        (taquitoModule as any).default?.default?.MichelCodecPacker;
      const InMemorySigner =
        (signerModule as any).InMemorySigner ??
        (signerModule as any).default?.InMemorySigner ??
        (signerModule as any).default?.default?.InMemorySigner;

      if (!MichelCodecPacker || !InMemorySigner?.fromSecretKey) {
        throw new Error("Artifact signer dependencies unavailable in runtime");
      }

      return {
        signer: await InMemorySigner.fromSecretKey(privateKey),
        packer: new MichelCodecPacker(),
      };
    })();
  }

  return artifactSignerPromise;
}

async function signBootloaderArtifact(params: {
  privateKey: string;
  spec: string;
  artifactUri: string;
  author: string;
}): Promise<{ signature: string; publicKey: string; packed: string }> {
  const { signer, packer } = await getArtifactSigner(params.privateKey);
  const packed = (
    await packer.packData({
      type: {
        prim: "pair",
        args: [
          { prim: "bytes" },
          {
            prim: "pair",
            args: [{ prim: "bytes" }, { prim: "address" }],
          },
        ],
      },
      data: {
        prim: "Pair",
        args: [
          { bytes: utf8ToHex(params.spec) },
          {
            prim: "Pair",
            args: [
              { bytes: utf8ToHex(params.artifactUri) },
              { string: params.author },
            ],
          },
        ],
      },
    })
  ).packed;

  const signed = await signer.sign(packed);
  const publicKey = await signer.publicKey();
  return {
    signature: signed.prefixSig,
    publicKey,
    packed,
  };
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

app.post("/:bootloader/v1/artifacts/sign", async (c) => {
  const bootloader = parseBootloaderId(c.req.param("bootloader"));
  const network = (c.req.query("network") || "shadownet") as
    | "mainnet"
    | "shadownet";

  if (!bootloader) {
    return c.json({ error: "Invalid bootloader" }, 400);
  }

  if (network !== "mainnet" && network !== "shadownet") {
    return c.json({ error: "Invalid network" }, 400);
  }

  try {
    const authUser = await getAuthenticatedUser(c);
    const body = await c.req
      .json<{ artifactUri?: string; author?: string; chainId?: string }>()
      .catch(() => null);

    const artifactUri = body?.artifactUri?.trim();
    const author = (body?.author?.trim() || authUser.address).trim();
    if (!artifactUri) {
      return c.json({ error: "Missing artifactUri" }, 400);
    }

    if (author !== authUser.address && !isAdmin(authUser)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const privateKey = (c.env.ARTIFACT_SIGNER_PRIVATE_KEY || "").trim();
    if (!privateKey) {
      return c.json({ error: "Artifact signer is not configured" }, 503);
    }

    const spec = getSharedBootloaderCatalogEntry(bootloader).spec;
    const signed = await signBootloaderArtifact({
      privateKey,
      spec,
      artifactUri,
      author,
    });

    return c.json({
      bootloader,
      network,
      artifactUri,
      author,
      spec,
      signature: signed.signature,
      publicKey: signed.publicKey,
      packed: signed.packed,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    console.error("[artifacts/sign] Error:", error);
    return c.json({ error: "Failed to sign artifact" }, 500);
  }
});

// Manually trigger the web-project indexer for a specific token.
// Used by frontend immediately after mint to reduce lag before traits/metadata appear.
app.post("/:bootloader/v1/indexer/tokens/:id/trigger", async (c) => {
  const bootloader = parseBootloaderId(c.req.param("bootloader"));
  const tokenId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "shadownet") as
    | "mainnet"
    | "shadownet";
  const wait = c.req.query("wait") === "1";
  const dryRun = c.req.query("dryRun") === "1";

  if (!bootloader || (bootloader !== "generic-web" && bootloader !== "p5-js")) {
    return c.json({ error: "Invalid bootloader" }, 400);
  }

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
        bootloader,
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
      bootloader,
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
  const bootloader = parseBootloaderId(c.req.param("bootloader"));
  const tokenId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (!bootloader) {
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
  const bootloader = parseBootloaderId(c.req.param("bootloader"));
  const generatorId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (!bootloader) {
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
  const bootloader = parseBootloaderId(c.req.param("bootloader"));
  const generatorId = Number(c.req.param("id"));
  const attributeName = c.req.param("name");
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (!bootloader) {
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
  const bootloader = parseBootloaderId(c.req.param("bootloader"));
  const generatorId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";
  const limit = Math.min(Number(c.req.query("limit") || 100), 500);
  const offset = Number(c.req.query("offset") || 0);

  if (!bootloader) {
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
      isWebProjectBootloader(bootloader)
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
  const bootloader = parseBootloaderId(c.req.param("bootloader"));
  const generatorId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (!bootloader) {
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
  const bootloader = parseBootloaderId(c.req.param("bootloader"));
  const generatorId = Number(c.req.param("id"));
  const network = (c.req.query("network") || "mainnet") as
    | "mainnet"
    | "shadownet";

  if (!bootloader) {
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

// Create a session from an existing CID (re-uses the archived zip from R2)
app.post("/sessions/from-cid", async (c) => {
  let authUser: User;
  try {
    authUser = await getAuthenticatedUser(c);
  } catch (error) {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: "Authentication required" }, 401);
  }

  const body = await c.req.json<{ cid?: string }>().catch(() => ({}));
  const cid = body.cid?.trim();
  if (!cid) {
    return c.json({ error: "Missing cid" }, 400);
  }

  // Fetch the archived zip from R2
  const archiveKey = `archives/${cid}.zip`;
  const archiveObj = await c.env.R2_SANDBOX.get(archiveKey);
  if (!archiveObj) {
    return c.json({ error: "Archive not found for this CID" }, 404);
  }
  const archiveBuffer = await archiveObj.arrayBuffer();

  // Create a new session DO and initialize it with the archive
  const doId = c.env.SESSIONS.newUniqueId();
  const sessionId = doId.toString();
  const stub = c.env.SESSIONS.get(doId);

  const response = await stub.fetch("https://session/init", {
    method: "POST",
    body: archiveBuffer,
    headers: { "content-type": "application/octet-stream" },
  });

  if (!response.ok) {
    const error = await response.text();
    return new Response(JSON.stringify({ error }), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }

  const init = (await response.json()) as SessionInitResponse;
  const seed = randomSeed();

  try {
    const sessionService = new SessionService(c.env.DB);
    await sessionService.createSession({
      id: sessionId,
      userId: authUser.id,
      cid: init.cid || null,
    });
  } catch (error) {
    console.error("[sessions/from-cid] Failed to track session in DB:", error);
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

app.get("/:bootloader/v1/artifacts/:cid/sketch", async (c) => {
  const bootloader = parseBootloaderId(c.req.param("bootloader"));
  const cid = c.req.param("cid")?.trim();

  if (!bootloader || bootloader !== "p5-js") {
    return c.json({ error: "Invalid bootloader" }, 400);
  }

  if (!cid) {
    return c.json({ error: "Missing artifact CID" }, 400);
  }

  const key = `${cid}/sketch.js`;
  const object = await c.env.R2_SANDBOX.get(key);
  if (!object) {
    return c.json({ error: "Sketch not found" }, 404);
  }

  const headers = new Headers();
  headers.set("content-type", "application/javascript; charset=utf-8");
  headers.set("cache-control", "public, max-age=31536000, immutable");
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

type BootloaderType = SharedBootloaderId;

function isWebProjectBootloader(
  bootloader: BootloaderType
): bootloader is "generic-web" | "p5-js" {
  return bootloader === "generic-web" || bootloader === "p5-js";
}

const TZKT_API_BY_NETWORK: Record<"mainnet" | "shadownet", string> = {
  mainnet: "https://api.tzkt.io",
  shadownet: "https://api.shadownet.tzkt.io",
};

const SVG_JS_BIGMAP_POINTERS_CACHE_TTL_MS = 60_000;
const svgJsBigmapPointersCache = new Map<
  "mainnet" | "shadownet",
  { tokenMetadataPtr: number | null; generatorsPtr: number | null; cachedAtMs: number }
>();

const GENERIC_WEB_BIGMAP_POINTERS_CACHE_TTL_MS = 60_000;
const genericWebBigmapPointersCache = new Map<
  "mainnet" | "shadownet",
  {
    tokenExtraPtr: number;
    generatorsPtr: number | null;
    tokenMetadataPtr: number | null;
    ledgerPtr: number | null;
    cachedAtMs: number;
  }
>();

// =============================================================================
// NEW NAMESPACED ROUTES (v1)
// =============================================================================

for (const bootloader of BOOTLOADER_IDS) {
  app.get(`/${bootloader}/v1/thumbnail/:id`, async (c) => {
    return handleThumbnailRequest(c, "thumbnail", bootloader);
  });

  app.get(`/${bootloader}/v1/generator-thumbnail/:id`, async (c) => {
    return handleThumbnailRequest(c, "generator-thumbnail", bootloader);
  });
}

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

  const { networkCode: configuredNetworkCode } = resolveNetworkFromRequest(
    url,
    c.env
  );
  const network = configuredNetworkCode;

  const requestedVersion = parseThumbnailVersion(url.searchParams.get("v"));
  let resolvedVersion = requestedVersion;
  const tokenIdNumber = Number(id);
  const isShadownet = network === "s";
  const tokenNetwork = isShadownet ? "shadownet" : "mainnet";

  if (
    resolvedVersion == null &&
    type === "thumbnail" &&
    isWebProjectBootloader(bootloader) &&
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
  const forceFeatureRefresh =
    isTokenThumbnail && storeFeaturesSync && isWebProjectBootloader(bootloader);

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
      bootloader,
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
  // - media.shadownet.bootloader.art (new frontend for staging): has /embed/* routes, supports all bootloaders
  // - bootloader.art (old frontend): has /thumbnail/* and /generator-thumbnail/* routes, svg-js only
  const usesNewFrontend = isShadownet;
  const baseUrl = usesNewFrontend
    ? "https://media.shadownet.bootloader.art"
    : "https://bootloader.art";

  let targetUrl: URL;

  // For generic-web generator thumbnails, look up the stored thumbnail seed
  let thumbnailSeed: string | null = null;
  if (type === "generator-thumbnail" && isWebProjectBootloader(bootloader)) {
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
      isWebProjectBootloader(bootloader) &&
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
  const readR2FeaturesPayload = async (): Promise<string | null> => {
    const featuresObj = await c.env.R2_THUMBS.get(`${r2Key}.features.json`);
    if (!featuresObj) return null;
    return (await featuresObj.text().catch(() => null)) ?? null;
  };
  const edgeHit = await edgeCache.match(cacheKey);
  if (edgeHit) {
    let canServeEdgeHit = !forceFeatureRefresh;
    if (forceFeatureRefresh) {
      console.log(
        "[Thumbnail Proxy] sync_features forcing edge cache bypass",
        JSON.stringify({ tokenId: Number(id), network: tokenNetwork, r2Key })
      );
    }
    if (canServeEdgeHit && isTokenThumbnail && storeFeaturesSync) {
      const edgeFeaturesHeader = edgeHit.headers.get("X-Token-Features");
      if (edgeFeaturesHeader != null) {
        await persistFeatures(edgeFeaturesHeader, "edge");
      } else {
        const featuresJson = await readR2FeaturesPayload();
        if (featuresJson != null) {
          await persistFeatures(featuresJson, "r2");
        }
      }
    }
    if (!canServeEdgeHit) {
      await edgeHit.body?.cancel();
    } else {
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
  }

  // Check R2
  const object = await c.env.R2_THUMBS.get(r2Key);
  if (object) {
    let canServeR2Hit = !forceFeatureRefresh;
    if (forceFeatureRefresh) {
      console.log(
        "[Thumbnail Proxy] sync_features forcing R2 cache bypass",
        JSON.stringify({ tokenId: Number(id), network: tokenNetwork, r2Key })
      );
    }
    if (canServeR2Hit && isTokenThumbnail && storeFeaturesSync) {
      const featuresJson = await readR2FeaturesPayload();
      if (featuresJson != null) {
        await persistFeatures(featuresJson, "r2");
      }
    }
    if (canServeR2Hit) {
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
      forceRender: forceFeatureRefresh,
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

/**
 * Store token features in D1 database
 * This is called asynchronously after thumbnail generation
 */
async function storeTokenFeatures(
  env: Bindings,
  params: {
    tokenId: number;
    network: "mainnet" | "shadownet";
    bootloader: "svg-js" | "generic-web" | "p5-js";
    featuresJson: string;
  }
): Promise<void> {
  try {
    const parsed = JSON.parse(params.featuresJson) as unknown;
    const features =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};

    const tokenService = new TokenService(env.DB);
    let generatorId = 0;
    let iteration: number | null = null;
    let seed: string | null = null;
    let ownerAddress: string | null = null;

    if (isWebProjectBootloader(params.bootloader)) {
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
const SCREENSHOTONE_TIMEOUT_SECONDS = 90;

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

    const {
      r2Key,
      target,
      width,
      height,
      cacheControl,
      type,
      id,
      bootloader,
      forceRender,
    } = payload || {};
    if (!r2Key || !target || !width || !height) {
      return textResponse("Missing fields", 400);
    }

    if (this.inflight.has(r2Key)) {
      return this.inflight.get(r2Key)!.then((res) => res.clone());
    }

    const task = (async () => {
      const existing = await this.env.R2_THUMBS.get(r2Key);
      if (existing && forceRender !== true) {
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
      if (existing && forceRender === true) {
        console.log(
          "[RenderCoordinator] force render requested, bypassing cached thumbnail",
          JSON.stringify({ r2Key, type, bootloader })
        );
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
      if (isWebProjectBootloader(bootloader)) {
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
      const isGenericWebTokenThumbnail =
        type === "thumbnail" && isWebProjectBootloader(bootloader);
      let features: Record<string, unknown> | null = null;
      let featureExtractionReady = false;
      const contentUrl = json.content?.url ?? json.metadata?.content_url;
      console.log("[RenderCoordinator] Feature extraction check:", {
        contentUrl: !!contentUrl,
        type,
        bootloader,
      });
      if (contentUrl && isGenericWebTokenThumbnail) {
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
            features = extractFeatures(html) ?? {};
            featureExtractionReady = true;
            console.log("[RenderCoordinator] Extracted features:", features);
            // Store feature payload alongside thumbnail in R2, including empty payloads.
            // An empty object means "freshly extracted and no traits".
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

      if (
        forceRender === true &&
        isGenericWebTokenThumbnail &&
        !featureExtractionReady
      ) {
        return textResponse(
          "Feature extraction not ready for forced sync",
          503
        );
      }

      const responseHeaders = new Headers(
        makeImageHeaders(cacheControl, type, id)
      );
      if (featureExtractionReady && features) {
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

    // For SPA routing: serve index.html for non-file routes that didn't match a static file.
    const pageUrl = new URL(c.req.url);
    const isFileLikeRoute = /\.[a-z0-9]+$/i.test(pageUrl.pathname);
    if (!isFileLikeRoute) {
      try {
        const indexUrl = new URL("/index.html", c.req.url);
        const indexResponse = await c.env.ASSETS.fetch(
          new Request(indexUrl.toString())
        );
        if (indexResponse.ok) {
          const socialMeta = await buildSocialMetaFromRoute(c.env, pageUrl);
          if (!socialMeta) {
            return indexResponse;
          }

          const indexHtml = injectTitleAndDescription(
            await indexResponse.text(),
            socialMeta.title,
            socialMeta.description
          );
          const injectedHtml = injectTagsIntoHead(
            indexHtml,
            buildSocialMetaTags(socialMeta)
          );
          const headers = new Headers(indexResponse.headers);
          headers.set("content-type", "text/html; charset=utf-8");
          headers.set("cache-control", "public, max-age=300");
          return new Response(injectedHtml, {
            status: indexResponse.status,
            headers,
          });
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
