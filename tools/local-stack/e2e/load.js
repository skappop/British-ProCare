const http = require('http'); const fs = require('fs'); const { execSync } = require('child_process')
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 55432 -U postgres -tAc "${q}"`).toString().trim()
const pids = sql('select id from patients limit 50').split('\n')
const C = Number(process.argv[2] || 20), SECS = Number(process.argv[3] || 30)
const who = { owner: fs.readFileSync(require('path').join(__dirname,'..','.run','cookie-owner.txt'), 'utf8'), dentist: fs.readFileSync(require('path').join(__dirname,'..','.run','cookie-dentist.txt'), 'utf8'), reception: fs.readFileSync(require('path').join(__dirname,'..','.run','cookie-reception.txt'), 'utf8') }
const mix = [
  ['reception', () => '/reception'], ['reception', () => '/appointments'], ['dentist', () => '/appointments'],
  ['dentist', () => '/patients/' + pids[Math.floor(Math.random() * pids.length)]], ['dentist', () => '/patients'],
  ['reception', () => '/patients/' + pids[Math.floor(Math.random() * pids.length)] + '/billing'], ['owner', () => '/'],
  ['reception', () => '/stock'], ['dentist', () => '/chart'], ['owner', () => '/reports'],
]
const agent = new http.Agent({ keepAlive: true, maxSockets: C })
const stats = {}; let done = 0, errors = 0; const end = Date.now() + SECS * 1000
function one() {
  if (Date.now() > end) return Promise.resolve()
  const [role, path] = mix[Math.floor(Math.random() * mix.length)]; const url = path(); const key = url.replace(/[0-9a-f-]{36}/, '[id]')
  const t = Date.now()
  return new Promise((res) => {
    const req = http.get({ host: 'localhost', port: 3000, path: url, agent, headers: { cookie: who[role] } }, (r) => {
      r.resume(); r.on('end', () => { const ms = Date.now() - t; (stats[key] ??= []).push(ms); done++; if (r.statusCode >= 500 || (r.statusCode >= 300 && r.statusCode < 400 && String(r.headers.location).includes('login'))) { errors++; if (errors < 5) console.log('bad', r.statusCode, url, r.headers.location || '') } res() })
    }); req.on('error', (e) => { errors++; res() })
  }).then(one)
}
const pct = (a, p) => a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))]
Promise.all(Array.from({ length: C }, one)).then(() => {
  console.log(`${C} at once for ${SECS}s: ${done} pages, ${(done / SECS).toFixed(1)}/s, errors ${errors}`)
  for (const [k, a] of Object.entries(stats).sort()) console.log(`  ${k.padEnd(28)} n=${String(a.length).padStart(4)} p50=${pct(a, .5)}ms p95=${pct(a, .95)}ms max=${Math.max(...a)}ms`)
  process.exit(0)
})
