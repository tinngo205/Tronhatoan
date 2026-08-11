// Tăng version mỗi khi deploy để buộc SW cũ bị xóa
const CACHE_VERSION = "v3";
const CACHE_NAME = `cobuy-cache-${CACHE_VERSION}`;

// Chỉ cache static assets — KHÔNG cache HTML pages
const STATIC_ASSETS = [
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// ─── INSTALL: Pre-cache static assets ────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Dùng individual try/catch để 1 asset lỗi không block toàn bộ
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`[SW] Failed to cache ${asset}:`, err);
          })
        )
      );
    })
  );
  // Kích hoạt ngay, không chờ tab cũ đóng
  self.skipWaiting();
});

// ─── ACTIVATE: Xóa cache cũ ──────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("cobuy-cache-") && name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ─── FETCH: Network-first cho HTML, Cache-first cho static assets ─────────────
self.addEventListener("fetch", (event) => {
  // Chỉ xử lý GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Bỏ qua hoàn toàn (để trình duyệt xử lý trực tiếp):
  if (
    url.pathname.startsWith("/api") ||       // API routes
    url.pathname.startsWith("/_next") ||     // Next.js internals
    url.hostname.includes("supabase.co") ||  // Supabase DB/Auth
    url.hostname !== self.location.hostname  // Requests tới domain khác
  ) {
    return;
  }

  const isHTMLRequest =
    event.request.headers.get("accept")?.includes("text/html") ||
    url.pathname === "/" ||
    !url.pathname.includes(".");

  if (isHTMLRequest) {
    // ── HTML Pages: Network-first, KHÔNG cache ──
    // Luôn fetch từ network để đảm bảo lấy đúng trang (có auth redirect)
    event.respondWith(
      fetch(event.request).catch(() => {
        // Chỉ fallback về offline page nếu mất mạng hoàn toàn
        return caches.match("/offline.html").then(
          (cached) =>
            cached ||
            new Response(
              `<!DOCTYPE html>
              <html lang="vi">
                <head><meta charset="UTF-8"><title>Offline - CoBuy</title>
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <style>
                  body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#333;text-align:center;padding:20px}
                  .icon{font-size:64px;margin-bottom:16px}
                  h1{font-size:24px;font-weight:800;margin:0 0 8px}
                  p{color:#666;margin:0 0 24px;max-width:300px}
                  button{background:#0ea5e9;color:white;border:none;padding:12px 24px;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer}
                </style>
                </head>
                <body>
                  <div class="icon">📡</div>
                  <h1>Không có kết nối</h1>
                  <p>Vui lòng kiểm tra kết nối mạng và thử lại.</p>
                  <button onclick="location.reload()">Thử lại</button>
                </body>
              </html>`,
              { headers: { "Content-Type": "text/html; charset=utf-8" } }
            )
        );
      })
    );
    return;
  }

  // ── Static Assets (icons, manifest...): Cache-first ──
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Chỉ cache response hợp lệ (status 200, không phải opaque)
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});
