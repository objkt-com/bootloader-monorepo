export const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>bootloader</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      height: 100%;
      overflow: auto;
    }
    body {
      background: #000;
      color: #fff;
      font-family: 'Fixedsys Excelsior', 'IBM Plex Mono', 'Courier New', 'Courier', monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    pre {
      font-family: 'Fixedsys Excelsior', 'IBM Plex Mono', 'Courier New', 'Courier', monospace;
      line-height: 1.6;
      font-size: 16px;
      max-width: 100%;
    }
    @media (max-width: 600px) {
      body {
        padding: 15px;
      }
      pre {
        font-size: 12px;
        line-height: 1.5;
      }
    }
  </style>
</head>
<body>
  <pre>bootloader:
    mov r0, onchfs://cid
    mov r1, cf_worker_cache
    cache_check r1, r0; jnz respond

    mov r2, r2_storage
    cache_check r2, r0; jnz store_edge_and_respond

    lock durable_object
    fetch r3, tzkt_api, r0
    store r2, r3
    unlock durable_object

store_edge_and_respond:
    store r1, r0
respond:
    return r0</pre>
</body>
</html>`;
