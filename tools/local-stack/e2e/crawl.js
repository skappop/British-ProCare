// Visit every page as each role: expect no crash, and access to match the rules.
const { launch } = require('./browser')
const { execSync } = require('child_process')
const B = 'http://localhost:3000'
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 55432 -U postgres -tAc "${q}"`).toString().trim()
const pid = sql("select patient_id from appointments where status='completed' limit 1")
const inv = sql('select id from inventory limit 1'), proc = sql('select id from procedures limit 1')
const cont = sql('select id from containers limit 1'), pay = sql('select id from payments limit 1')
const routes = ['/', '/admin/sheets', '/appointments', '/chart', `/chart/${pid}`, '/inventory', `/inventory/${inv}/edit`, '/inventory/containers',
  '/inventory/labels', '/inventory/labels/containers', '/inventory/new', '/inventory/purchase-orders', '/inventory/quick-add', '/inventory/rapid-scan',
  '/inventory/scan', '/inventory/suppliers', '/lab-cases', '/patients', `/patients/${pid}`, `/patients/${pid}/billing`, `/patients/${pid}/edit`,
  `/patients/${pid}/gallery`, `/patients/${pid}/intake`, '/patients/new', '/procedures', `/procedures/${proc}`, '/procedures/new', '/recall',
  `/receipts/payment/${pay}`, '/reception', '/reports', '/settings', '/staff', '/stock', `/stock/check/${cont}`, '/stock/count', '/stock/count?all=1',
  '/stock/order', '/stock/setup', '/stock/setup/labels']
const rules = [['/inventory/purchase-orders', ['owner']], ['/inventory', ['owner', 'dentist']], ['/procedures', ['owner']], ['/reception', ['owner', 'assistant']],
  ['/reports', ['owner']], ['/staff', ['owner']], ['/settings', ['owner']], ['/admin', ['owner']], ['/stock/setup', ['owner', 'dentist']]]
const allowed = (role, path) => {
  if (role === 'owner') return true
  path = path.split('?')[0]
  if (path === '/') return false
  if (/^\/patients\/[^/]+\/billing/.test(path)) return role === 'assistant'
  if (path.startsWith('/receipts')) return role !== 'dentist'
  const r = rules.find(([p]) => path === p || path.startsWith(p + '/'))
  return r ? r[1].includes(role) : true
}
;(async () => {
  const browser = await launch()
  let problems = 0
  for (const [who, role] of [['owner', 'owner'], ['dentist', 'dentist'], ['reception', 'assistant']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message))
    await page.goto(B + '/login')
    await page.fill('input[name=email]', `${who}@test.local`); await page.fill('input[name=password]', 'Passw0rd!')
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login')), page.getByRole('button', { name: 'Enter Clinic' }).click()])
    const out = []
    for (const r of routes) {
      errs.length = 0
      const t = Date.now()
      const res = await page.goto(B + r, { waitUntil: 'load' }).catch((e) => ({ status: () => 'ERR ' + e.message.slice(0, 40) })); await page.waitForTimeout(700)
      const ms = Date.now() - t
      const landed = new URL(page.url()).pathname
      const body = await page.locator('body').innerText().catch(() => '')
      const crashed = /Application error|Something went wrong|Internal Server Error|Unhandled Runtime Error|This page couldn’t load/i.test(body)
      const got = landed === r.split('?')[0]
      const want = allowed(role, r)
      let verdict = 'ok'
      if (crashed || String(res.status()).startsWith('5') || String(res.status()).startsWith('ERR')) verdict = 'CRASH'
      else if (got !== want && !(want && r.includes('/containers') || want && r.includes('/rapid-scan'))) verdict = got ? 'LEAK' : 'BLOCKED?'
      if (errs.length) verdict += ' +jsError'
      if (verdict !== 'ok') problems++
      out.push(`${verdict.padEnd(8)} ${String(res.status()).padEnd(4)} ${String(ms).padStart(5)}ms ${r}${got ? '' : ' → ' + landed}${errs.length ? '  ' + errs[0].slice(0, 90) : ''}`)
    }
    console.log(`\n== ${who}`); console.log(out.join('\n'))
    await ctx.close()
  }
  console.log('\nproblems:', problems)
  await browser.close()
})()
