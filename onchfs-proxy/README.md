# OnchFS Cloudflare Worker Proxy

A proxy and cache for OnchFS (On-Chain File System) using Cloudflare Workers, Durable Objects, and R2 storage.

## Architecture

```
Client Request
    ↓
Edge Cache (Cloudflare CDN)
    ↓ (cache miss)
R2 Storage
    ↓ (not found)
Durable Object (synchronizes concurrent requests)
    ↓
TzKT API (fetch from blockchain)
    ↓
Store in R2 → Return to client
```

## Development Setup

```bash
npm install
wrangler r2 bucket create onchfs-cache
npm run dev
```

## Network Configuration

Each network has its own subdomain:

- **Mainnet**: `onchfs.bootloader.art`
- **Ghostnet**: `onchfs.ghostnet.bootloader.art`
- **Shadownet**: `onchfs.shadownet.bootloader.art`

Network detection is based on hostname (see [src/utils.ts](src/utils.ts:1)). Files are stored in R2 with network prefixes to prevent mixing: `{network}/{cid}` or `{network}/{cid}/{path}`.

Network bigmap IDs are configured in [src/types.ts](src/types.ts).
