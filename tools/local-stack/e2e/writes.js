const { launch } = require('./browser')
const { execSync } = require('child_process')
const B = 'http://localhost:3000'
const sql = (q) => execSync(`psql -h 127.0.0.1 -p 55432 -U postgres -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim()
let pass = 0, fail = 0
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m) }
async function login(browser, who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(B + '/login'); await page.fill('input[name=email]', `${who}@test.local`); await page.fill('input[name=password]', 'Passw0rd!')
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login')), page.getByRole('button', { name: 'Enter Clinic' }).click()])
  return page
}
;(async () => {
  const browser = await launch()
  sql("update inventory set stock = 50 where name in ('Composite A2','Anaesthetic cartridge')")
  // Nine brand-new patients (no visits yet), whatever the database already holds.
  const tag = Date.now().toString().slice(-6)
  const pts = sql(`insert into patients (full_name) select 'Writes ${tag} ' || g from generate_series(1, 9) g returning id`).split('\n')

  console.log('8 dentists save a filling at the same moment')
  const pages = await Promise.all(pts.slice(0, 8).map(() => login(browser, 'dentist')))
  await Promise.all(pages.map((p, k) => p.goto(B + '/patients/' + pts[k], { waitUntil: 'load' })))
  await Promise.all(pages.map((p) => p.getByRole('button', { name: /Composite filling/ }).first().click()))
  await Promise.all(pages.map((p) => p.waitForTimeout(800)))
  const c0 = Number(sql("select stock from inventory where name='Composite A2'")), a0 = Number(sql("select stock from inventory where name='Anaesthetic cartridge'"))
  await Promise.all(pages.map((p) => p.getByRole('button', { name: /^(Save visit|Save & finish visit)$/ }).click()))
  await Promise.all(pages.map((p) => p.waitForURL('**/appointments', { timeout: 30000 }).catch(() => {})))
  const n = Number(sql(`select count(*) from visits where patient_id in ('${pts.slice(0, 8).join("','")}')`))
  ok(n === 8, `8 visits saved (${n})`)
  ok(Number(sql("select stock from inventory where name='Composite A2'")) === c0 - 8, `composite taken off exactly 8: ${c0} → ${sql("select stock from inventory where name='Composite A2'")}`)
  ok(Number(sql("select stock from inventory where name='Anaesthetic cartridge'")) === a0 - 8, 'anaesthetic taken off exactly 8')
  ok(pages.every((p) => p.url().endsWith('/appointments')), 'every dentist returned to the appointments board')

  console.log('Double-tap on Save visit')
  const p9 = pages[0]
  await p9.goto(B + '/patients/' + pts[8], { waitUntil: 'load' })
  await p9.getByRole('button', { name: /Examination/ }).first().click()
  await p9.waitForTimeout(800)
  await p9.getByRole('button', { name: /^(Save visit|Save & finish visit)$/ }).dblclick()
  await p9.waitForURL('**/appointments', { timeout: 30000 }).catch(() => {})
  await p9.waitForTimeout(1500)
  ok(sql(`select count(*) from visits where patient_id='${pts[8]}'`) === '1', 'double-tap saves the visit once (' + sql(`select count(*) from visits where patient_id='${pts[8]}'`) + ')')

  console.log('Reception: double-tap and two desks taking payment')
  const r1 = await login(browser, 'reception'), r2 = await login(browser, 'reception')
  const payFor = pts[0]
  const before = Number(sql(`select count(*) from payments where patient_id='${payFor}'`))
  await r1.goto(B + `/patients/${payFor}/billing`, { waitUntil: 'load' })
  await r1.locator('input[placeholder="0"]').fill('500')
  await r1.getByRole('button', { name: /^Record EGP 500/ }).dblclick()
  await r1.waitForTimeout(2500)
  ok(Number(sql(`select count(*) from payments where patient_id='${payFor}'`)) === before + 1, 'double-tap records the payment once')
  await r1.screenshot({ path: require('path').join(__dirname, '..', '.run', 'shots', 'pay-double.png'), fullPage: true })

  // A second desk enters the same amount a moment later: asked, not silently doubled.
  await r2.goto(B + `/patients/${payFor}/billing`, { waitUntil: 'load' })
  await r2.locator('input[placeholder="0"]').fill('500')
  await r2.getByRole('button', { name: /^Record EGP 500/ }).click()
  await r2.getByText(/was already recorded for this patient/).waitFor({ timeout: 10000 }).catch(() => {})
  ok(await r2.getByText(/was already recorded for this patient/).isVisible(), 'second desk is asked about the same amount')
  ok(Number(sql(`select count(*) from payments where patient_id='${payFor}'`)) === before + 1, 'nothing recorded until they answer')
  await r2.screenshot({ path: require('path').join(__dirname, '..', '.run', 'shots', 'pay-duplicate.png'), fullPage: true })
  await r2.getByRole('button', { name: 'Yes, record it' }).click()
  await r2.getByText(/EGP 500 received/).waitFor({ timeout: 10000 }).catch(() => {})
  ok(Number(sql(`select count(*) from payments where patient_id='${payFor}'`)) === before + 2, '"Yes, record it" records a genuine second payment')

  // Truly simultaneous: both saved, and both are told about the other
  await Promise.all([r1, r2].map((p) => p.goto(B + `/patients/${payFor}/billing`, { waitUntil: 'load' })))
  for (const p of [r1, r2]) await p.locator('input[placeholder="0"]').fill('250')
  await Promise.all([r1, r2].map((p) => p.getByRole('button', { name: /^Record EGP 250/ }).click()))
  await r1.waitForTimeout(3000)
  const n250 = Number(sql(`select count(*) from payments where patient_id='${payFor}' and amount=250`))
  const warned = (await r1.getByText(/also recorded|already recorded/).count()) + (await r2.getByText(/also recorded|already recorded/).count())
  ok(n250 <= 2 && warned >= 1, `simultaneous same amount: ${n250} saved, ${warned} desk(s) warned`)

  console.log(`\n${pass} passed, ${fail} failed`)
  await browser.close(); process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
