const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto')
const routes = [['/auth/v1', 9999], ['/rest/v1', 3001]]
const ROOT = path.join(__dirname, '.run', 'objects')
const stats = { puts: 0, bytes: 0, signs: 0, gets: 0, deletes: 0 }
const file = (b, p) => path.join(ROOT, b, decodeURIComponent(p))
function json(res, code, body) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
function body(req) { return new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))) }) }
async function storage(req, res, url) {
  const u = new URL(url, 'http://x'); const p = u.pathname.replace('/storage/v1', '')
  let m
  if (p === '/_stats') return json(res, 200, stats)
  if ((m = p.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/))) {
    if (req.method === 'POST') { await body(req); stats.signs++; return json(res, 200, { url: `/object/upload/sign/${m[1]}/${m[2]}?token=${crypto.randomUUID()}` }) }
    if (req.method === 'PUT') { const b = await body(req); fs.appendFileSync(path.join(__dirname,'.run','puts.log'), new Date().toISOString()+' '+crypto.createHash('md5').update(b).digest('hex')+' '+b.length+'\n'); const f = file(m[1], m[2]); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); stats.puts++; stats.bytes += b.length; return json(res, 200, { Key: `${m[1]}/${m[2]}` }) }
  }
  if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'POST') { await body(req); return json(res, 200, { signedURL: `/object/public-read/${m[1]}/${m[2]}` }) }
  if ((m = p.match(/^\/object\/sign\/([^/]+)$/)) && req.method === 'POST') { const b = JSON.parse(await body(req) || '{}'); return json(res, 200, (b.paths || []).map((x) => ({ path: x, signedURL: `/object/public-read/${m[1]}/${x}`, error: null }))) }
  if ((m = p.match(/^\/object\/public-read\/([^/]+)\/(.+)$/))) { const f = file(m[1], m[2]); if (!fs.existsSync(f)) return json(res, 404, { error: 'not found' }); stats.gets++; res.writeHead(200, { 'content-type': 'image/jpeg' }); return res.end(fs.readFileSync(f)) }
  if ((m = p.match(/^\/object\/([^/]+)$/)) && req.method === 'DELETE') { const b = JSON.parse(await body(req) || '{}'); for (const x of b.prefixes || []) { try { fs.unlinkSync(file(m[1], x)); stats.deletes++ } catch {} } return json(res, 200, (b.prefixes || []).map((name) => ({ name }))) }
  if ((m = p.match(/^\/object\/([^/]+)\/(.+)$/)) && (req.method === 'POST' || req.method === 'PUT')) { const b = await body(req); const f = file(m[1], m[2]); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); stats.puts++; stats.bytes += b.length; return json(res, 200, { Key: `${m[1]}/${m[2]}` }) }
  json(res, 404, { error: 'storage stub: ' + req.method + ' ' + p })
}
http.createServer((req, res) => {
  if (req.url.startsWith('/storage/v1')) return storage(req, res, req.url).catch((e) => json(res, 500, { error: String(e) }))
  const r = routes.find(([p]) => req.url.startsWith(p))
  if (!r) return json(res, 404, { message: 'not available locally' })
  const p = http.request({ host: '127.0.0.1', port: r[1], path: req.url.slice(r[0].length) || '/', method: req.method, headers: req.headers }, (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res) })
  p.on('error', (e) => { res.writeHead(502); res.end(String(e)) })
  req.pipe(p)
}).listen(54321, () => console.log('proxy on 54321'))
