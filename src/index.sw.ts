const version = '1'
const assets = [
	'/',
	'/index.html',
	'/scripts/quagga.min.js',
	'/scripts/index.js',
	'/css/index.css',
	'/assets/beep.mp3',
]
const cacheName = `barcode-scanner-${version}`

self.addEventListener('install', (e: any) => {
	e.waitUntil((async () => {
		const cache = await caches.open(cacheName)
		cache.addAll(assets)
	})())
})

declare const clients: any
self.addEventListener('activate', (e: any) => {
	e.waitUntil((async () => {
		const names = await caches.keys()
		await Promise.all(
			names.map((name) => {
				if (name !== cacheName) {
					return caches.delete(name)
				}
			}),
		)
		await clients.claim()
	})())
})

self.addEventListener('fetch', (e: any) => {
	if (e.request.mode === 'navigate') {
		e.respondWith(caches.match('/'))
		return
	}

	e.respondWith((async () => {
		const cache = await caches.open(cacheName)
		const cachedResponse = await cache.match(e.request.url)
		if (cachedResponse) {
			return cachedResponse
		}
		return new Response(null, { status: 404 })
	})())
})