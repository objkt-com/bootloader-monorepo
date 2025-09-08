# Thumbnail Renderer Worker

A Cloudflare Worker that generates thumbnails by taking screenshots of web pages using Puppeteer. This worker is designed to create thumbnail images for generators and other content hosted on bootloader.art.

## Features

- **Multi-network support**: Supports mainnet, ghostnet, and shadownet
- **Configurable dimensions**: Width and height parameters (1-1000px range)
- **Caching**: Built-in cache control headers for performance
- **Error handling**: Graceful error handling with appropriate HTTP status codes
- **CORS support**: Cross-origin resource sharing enabled

## API Endpoints

### Generate Thumbnail

```
GET /{type}/{id}?width={width}&height={height}&v={version}&n={network}
```

#### Path Parameters

- `type`: Either `thumbnail` or `generator-thumbnail`
- `id`: Numeric ID of the content to render

#### Query Parameters

- `width` (optional): Thumbnail width in pixels (1-1000, default: 500)
- `height` (optional): Thumbnail height in pixels (1-1000, default: 500)
- `v` (optional): Version parameter for cache busting (default: "v3")
- `n` (optional): Network selection (default: "m")
  - `m`: Mainnet (bootloader.art)
  - `g`: Ghostnet (ghostnet.bootloader.art)
  - `s`: Shadownet (shadownet.bootloader.art)

#### Example Requests

```bash
# Generate a 500x500 thumbnail for generator ID 123 on mainnet
GET /generator-thumbnail/123

# Generate a 300x200 thumbnail for content ID 456 on ghostnet
GET /thumbnail/456?width=300&height=200&n=g

# Generate thumbnail with specific version and network
GET /generator-thumbnail/789?width=400&height=400&v=v4&n=s
```

## Response Format

### Success Response (200)

- **Content-Type**: `image/jpeg`
- **Cache-Control**: `public, max-age=300` (5 minutes)
- **Access-Control-Allow-Origin**: `*`
- **Body**: JPEG image data

### Error Responses

- **404**: Invalid path or missing parameters
- **400**: Invalid ID (must be numeric) or invalid network parameter
- **425**: Thumbnail not ready yet (page failed to load or render)

## Configuration

### Environment Variables

The worker expects the following environment bindings:

- `MYBROWSER`: Puppeteer browser binding (configured in wrangler.toml)

### Wrangler Configuration

The `wrangler.toml` file includes:

```toml
[browser]
binding = "MYBROWSER"
```

This enables Puppeteer browser functionality in the Cloudflare Worker environment.

## Development

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your wrangler.toml with appropriate values:
   - Update KV namespace IDs if using caching
   - Set environment variables as needed

3. Run locally:
   ```bash
   npm run dev
   ```

4. Deploy to Cloudflare:
   ```bash
   npm run deploy
   ```

### Local Development

When running locally with `wrangler dev`, the worker will be available at `http://localhost:8787`.

## Technical Details

### Screenshot Configuration

- **Format**: JPEG with 85% quality for optimal size/quality balance
- **Viewport**: Exact dimensions as requested (no device pixel ratio scaling)
- **Timeout**: 25 seconds for page load
- **Wait Strategy**: Waits for network idle and DOM content loaded
- **Settle Time**: Additional 250ms wait for late paint operations

### Performance Considerations

- Browser instances are properly closed after each request
- Screenshots capture only the viewport (not full page) for faster processing
- Cache headers encourage client-side caching for 5 minutes
- Error responses use appropriate HTTP status codes for client handling

### Security

- Input validation on all parameters
- Dimension limits prevent resource exhaustion
- Network parameter validation prevents arbitrary URL access
- Proper error handling prevents information leakage

## Troubleshooting

### Common Issues

1. **425 "Thumbnail not ready yet"**: The target page failed to load or render properly
   - Check if the target URL is accessible
   - Verify network connectivity
   - Consider increasing timeout values

2. **400 "Invalid ID"**: The ID parameter is not a valid number
   - Ensure the ID is numeric
   - Check URL encoding

3. **404 "Nothing here"**: Invalid path structure
   - Verify the path follows the pattern `/{type}/{id}`
   - Ensure type is either `thumbnail` or `generator-thumbnail`

### Debugging

Enable debug logging by checking the Cloudflare Workers dashboard for real-time logs and error details.
