import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))
  return nested.flat()
}
const assets = (await files(dist)).filter(file => !file.endsWith('sw.js'))
const resources = assets.map(file => `./${relative(dist, file).replaceAll('\\', '/')}`)
const hash = createHash('sha256')
for (const file of assets) hash.update(await readFile(file))
const version = hash.digest('hex').slice(0, 12)
const worker = `const CACHE = 'my-hiit-' + self.registration.scope + '-${version}';
const PREFIX = 'my-hiit-' + self.registration.scope + '-';
const ASSETS = ${JSON.stringify(resources)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request).catch(async () => {
    if (event.request.mode === 'navigate') return caches.open(CACHE).then(cache => cache.match(new URL('./index.html', self.registration.scope)));
    return Response.error();
  })));
});
`
await writeFile(join(dist, 'sw.js'), worker)
