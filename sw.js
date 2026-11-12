const CACHE = 'medhistorial-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'precache') return;
    e.waitUntil(caches.open(CACHE).then(c => Promise.all(e.data.urls.map(u => {
        try {
            const same = new URL(u).origin === self.location.origin;
            return fetch(new Request(u, { mode: same ? 'same-origin' : 'no-cors' }))
                .then(r => (r.status === 200 || r.type === 'opaque') ? c.put(u, r) : null).catch(() => null);
        } catch (_) { return null; }
    }))));
});
self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.hostname.endsWith('supabase.co') || !/^https?:$/.test(url.protocol)) return;
    e.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
        const net = fetch(req).then(res => {
            if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
            return res;
        }).catch(() => null);
        if (hit) { e.waitUntil(net); return hit; }
        const res = await net;
        if (res) return res;
        if (req.mode === 'navigate') { const home = await cache.match(self.registration.scope); if (home) return home; }
        return Response.error();
    })());
});
