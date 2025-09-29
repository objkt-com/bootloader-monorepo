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
  - `g`: Ghostnet (ghostnet.bootloader.art)
  - `s`: Shadownet (shadownet.bootloader.art)

#### Examples

```bash
GET /generator-thumbnail/123
GET /thumbnail/456?width=300&height=200&n=g
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
