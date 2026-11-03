import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const root = new URL('../dist/', import.meta.url)
test('built worker precaches assets and serves root/deep navigation without network', async () => {
  const listeners = new Map()
  const stores = new Map()
  const scope = 'https://example.test/my-hiit/'
  const keyOf = req => new URL(typeof req === 'string' ? req : req.url ?? req.href, scope).href
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)
      return {
        async addAll(paths) {
          for (const path of paths) store.set(keyOf(path), await readFile(new URL(path, root)))
        },
        async match(req) { const bytes = store.get(keyOf(req)); return bytes && new Response(bytes) },
      }
    },
    async keys() { return [...stores.keys()] },
    async delete(key) { return stores.delete(key) },
  }
  vm.runInNewContext(await readFile(new URL('sw.js', root), 'utf8'), {
    self: { registration: { scope }, location: { origin: 'https://example.test' },
      addEventListener: (name, callback) => listeners.set(name, callback),
      skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches, URL, Response, fetch: async () => { throw Error('offline') },
  })
  let pending
  listeners.get('install')({ waitUntil(promise) { pending = promise } })
  await pending
  const current = [...stores.keys()][0]
  stores.set(`my-hiit-${scope}-old`, new Map())
  stores.set('my-hiit-https://example.test/another-app/-old', new Map())
  listeners.get('activate')({ waitUntil(promise) { pending = promise } })
  await pending
  assert(stores.has(current))
  assert(!stores.has(`my-hiit-${scope}-old`))
  assert(stores.has('my-hiit-https://example.test/another-app/-old'))
  for (const path of ['', 'session', 'index.html?from=homescreen']) {
    listeners.get('fetch')({ request: { method: 'GET', url: scope + path, mode: 'navigate' },
      respondWith(promise) { pending = promise } })
    const response = await pending
    assert.equal(response.status, 200)
    assert.match(await response.text(), /MY HIIT/)
  }
  listeners.get('fetch')({ request: { method: 'GET', url: scope + 'manifest.webmanifest' },
    respondWith(promise) { pending = promise } })
  assert.equal((await (await pending).json()).display, 'standalone')
})
