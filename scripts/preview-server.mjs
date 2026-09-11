// Minimal static file server for local mockup preview.
// Usage: node scripts/preview-server.mjs [port] [rootDir]
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const port = Number(process.argv[2] ?? 8899)
const root = resolve(process.argv[3] ?? process.cwd())

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
    let rel = decodeURIComponent(url.pathname)
    if (rel.endsWith('/')) rel += 'index.html'
    const target = normalize(join(root, rel))
    if (!target.startsWith(root)) {
      res.writeHead(403).end('forbidden')
      return
    }
    const info = await stat(target)
    if (info.isDirectory()) {
      res.writeHead(302, { location: rel + '/' }).end()
      return
    }
    const body = await readFile(target)
    res.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(body)
  } catch (error) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`not found: ${error?.message ?? error}`)
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`preview server listening on http://127.0.0.1:${port}/  root=${root}`)
})
