/** เซิร์ฟเวอร์ Netlify Blobs ปลอม (โปรโตคอล edgeURL) — ใช้ซ้อมระบบทะเบียนบนเครื่อง g1 เท่านั้น
 *  client จริง @netlify/blobs ยิง GET/PUT/DELETE ที่ /:siteID/:store/:key พร้อม Bearer token
 *  เก็บเป็นไฟล์ใต้ ROOT (คนละถังกับของจริงโดยสิ้นเชิง — ไม่มีคีย์จริงในระบบนี้)
 */
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

const ROOT = process.env.BLOBS_EDGE_DIR || './ซ้อม-blobs'
const PORT = Number(process.env.BLOBS_EDGE_PORT || 8977)

const pathOf = (url) => {
  const p = normalize(decodeURIComponent(url.split('?')[0])).replace(/^\/+/, '')
  if (p.includes('..')) return null
  return join(ROOT, p + '.blob')
}

createServer((req, res) => {
  console.log(new Date().toISOString().slice(11, 19), req.method, req.url)
  const f = pathOf(req.url || '/')
  if (!f) { res.writeHead(400); return res.end() }
  if (req.method === 'GET') {
    if (!existsSync(f)) { res.writeHead(404); return res.end() }
    res.writeHead(200); return res.end(readFileSync(f))
  }
  if (req.method === 'PUT') {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      mkdirSync(dirname(f), { recursive: true })
      writeFileSync(f, Buffer.concat(chunks))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
    return
  }
  if (req.method === 'DELETE') {
    rmSync(f, { force: true })
    res.writeHead(204); return res.end()
  }
  if (req.method === 'HEAD') {
    res.writeHead(existsSync(f) ? 200 : 404); return res.end()
  }
  res.writeHead(405); res.end()
}).listen(PORT, '127.0.0.1', () => console.log(`blobs-edge พร้อมที่ :${PORT} เก็บที่ ${ROOT}`))
