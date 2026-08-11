// creative-tracker Service Worker —— 提供离线打开能力
const CACHE = 'creative-tracker-v3';

self.addEventListener('install', e => {
  // 不在安装阶段预取资源，避免某个 URL 异常导致整个 SW 安装失败
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cachePut(req, res) {
  if (res && res.ok && req && req.method === 'GET') {
    caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 只处理同域

  if (req.mode === 'navigate') {
    // 页面导航：网络优先，离线时回退缓存（保证有网就拿最新，没网也能开）
    // 用稳定的 scope 字符串 URL 作为缓存主键，绕开导航请求缓存匹配的怪癖
    const shell = self.registration.scope;
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(shell, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(shell)
          .then(r => r || caches.match(shell + 'index.html'))
          .then(r => r || Response.error()))
    );
    return;
  }

  // 其它静态资源：缓存优先，后台更新（图标等首次联网后自动缓存）
  e.respondWith(
    caches.match(req).then(r =>
      r || fetch(req).then(res => { cachePut(req, res); return res; }).catch(() => r)
    )
  );
});
