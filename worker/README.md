# Thumbnail Renderer Worker

A Cloudflare Worker that generates thumbnails using browser rendering API.

## API Specification

### Endpoints

```
GET /{type}/{id}
```

#### Path Parameters

- `type`: `thumbnail` or `generator-thumbnail`
- `id`: Numeric ID

#### Query Parameters

- `width` (optional): Width in pixels (1-1000, default: 400)
- `height` (optional): Height in pixels (1-1000, default: 400)
- `v` (optional): Version for cache busting (default: "v3")
- `n` (optional): Network (default: "m")
  - `m`: Mainnet (bootloader.art)
  - `s`: Shadownet (shadownet.bootloader.art)
  - `g`: Legacy shadownet alias (supported for backwards compatibility)

#### Examples

```bash
GET /generator-thumbnail/123
GET /thumbnail/456?width=300&height=200&n=s
```

### Responses

#### Success (200)
- **Content-Type**: `image/png`
- **Cache-Control**: `public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=604800`
- **Body**: PNG image data

#### Errors
- **400**: Invalid ID or network parameter
- **404**: Invalid path
- **425**: Thumbnail not ready yet

### Environment Variables

- `CF_ACCOUNT_ID`: Cloudflare account ID
- `CF_API_TOKEN`: Cloudflare API token with browser rendering permissions
- `WORKER_NETWORK` (optional): `mainnet` or `shadownet`; when set, worker routes resolve against this configured network

## Generic-Web Indexer (Shadownet)

The worker includes a cron-driven generic-web metadata indexer (staging only, shadownet-only rollout).

### Required secrets

- `AUTH_TOKEN_SECRET` (required for wallet-authenticated API bearer tokens)
- `INDEXER_PRIVATE_KEY` (Tezos key used to sign `set_offchain_metadata`)
- `FILEBASE_ACCESS_KEY`
- `FILEBASE_SECRET_KEY`
- `FILEBASE_BUCKET`

### Optional vars

- `AUTH_TOKEN_TTL_SECONDS`
- `INDEXER_GENERIC_WEB_CONTRACT`
- `INDEXER_RPC_URL`
- `INDEXER_TZKT_API`
- `INDEXER_LIMIT`
- `INDEXER_SLEEP_MS`
- `INDEXER_ATTRIBUTE_RETRIES`
- `INDEXER_ATTRIBUTE_RETRY_DELAY_MS`
- `INDEXER_CONFIRMATIONS`
- `INDEXER_DRY_RUN`

Indexer execution is cron-driven via Wrangler triggers.
Private upload/session endpoints expect `Authorization: Bearer <token>` from `/auth/verify`.
