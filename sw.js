/* 오프라인 지원: 먼저 인터넷에서 받아 오고, 안 되면 저장해 둔 사본을 보여 줍니다.
   저장되는 자료는 암호화된 파일이라 키 없이는 읽을 수 없습니다. */
const CACHE = "hb-v5";
const SHELL = ["./", "index.html", "assets/app.js", "assets/lock.js", "manifest.webmanifest", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "secure/meta.json", "secure/data.enc"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (new URL(req.url).pathname.endsWith("/secure/source.enc")) return; // 원본 백업은 앱에서 쓰지 않음
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
