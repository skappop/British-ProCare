const { launch } = require('./browser')
const { execSync } = require('child_process')
const B = 'http://localhost:3000'
const sql = (q) => execSync(`psql -q -h 127.0.0.1 -p 55432 -U postgres -tAc "${q}"`).toString().trim()
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m) }
async function login(browser, who, phone) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage(); p.on('pageerror', (e) => { fail++; console.log('  ✗ page error', e.message) })
  await p.goto(B + '/login'); await p.fill('input[name=email]', `${who}@test.local`); await p.fill('input[name=password]', 'Passw0rd!')
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login')), p.getByRole('button', { name: 'Enter Clinic' }).click()])
  return p
}
const chartInView = (p) => p.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((e) => e.textContent === 'Dental chart'); const r = h.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight / 2 })
;(async () => {
  const b = await launch()
  const pid = sql("insert into patients (full_name) values ('Live Chart Test') returning id")
  const doc = await login(b, 'dentist'), asst = await login(b, 'reception', true)
  await doc.goto(B + '/patients/' + pid, { waitUntil: 'load' }); await doc.waitForTimeout(1000)
  await doc.evaluate(() => { window.__away = false; Document.prototype.hasFocus = function () { return !window.__away } })
  // Doctor goes down to imaging and opens the camera software
  await doc.evaluate(() => [...document.querySelectorAll('*')].find((e) => /Imaging/.test(e.textContent) && e.children.length === 0 && e.tagName.match(/^H/))?.scrollIntoView())
  ok(!(await chartInView(doc)), 'doctor is looking at imaging, chart out of view')
  await doc.evaluate(() => { window.__away = true; window.dispatchEvent(new Event('blur')) })

  // Assistant charts on the phone
  await asst.goto(B + '/chart/' + pid, { waitUntil: 'load' }); await asst.waitForTimeout(800)
  await asst.locator('[data-fdi="16"]').click(); await asst.getByRole('button', { name: 'C2', exact: true }).click()
  await asst.locator('[data-fdi="26"]').click(); await asst.getByRole('button', { name: /^Filling$|^F$/ }).first().click()
  await asst.getByText(/Saved/).first().waitFor({ timeout: 10000 }).catch(() => {})
  await asst.waitForTimeout(1500)
  ok(sql(`select odontogram ? '16' and odontogram ? '26' from patients where id='${pid}'`) === 't', 'assistant’s findings saved')

  // Doctor closes the camera: back to the browser
  await doc.evaluate(() => { window.__away = false; window.dispatchEvent(new Event('focus')) })
  await doc.waitForTimeout(3000)
  ok(await chartInView(doc), 'chart brought into view on return')
  ok(await doc.getByText('Just charted on another device:').isVisible(), 'banner says what arrived')
  const line = await doc.locator('text=Just charted on another device:').locator('..').innerText()
  console.log('   banner:', line.replace(/\n/g, ' '))
  ok(/UR6/.test(line) && /UL6/.test(line), 'both teeth listed')
  ok((await doc.locator('[data-fdi="16"]').getAttribute('class')).includes('ring-gold'), 'tooth 16 highlighted')
  await doc.screenshot({ path: require('path').join(__dirname, '..', '.run', 'shots', 'livechart-doctor.png') })

  // Tapping a highlighted tooth clears its highlight
  await doc.locator('[data-fdi="16"]').click()
  ok(!(await doc.locator('[data-fdi="16"]').getAttribute('class')).includes('ring-gold'), 'tapping a highlighted tooth marks it seen')
  await doc.keyboard.press('Escape')

  // Doctor working on the page: a new change only highlights, no jump
  await doc.evaluate(() => document.querySelector('[data-fdi="46"]').closest('div.bg-white')?.parentElement?.nextElementSibling?.scrollIntoView())
  await doc.evaluate(() => window.scrollBy(0, 400))
  const y0 = await doc.evaluate(() => scrollY)
  await asst.locator('[data-fdi="36"]').click(); await asst.getByRole('button', { name: 'C2', exact: true }).click(); await asst.waitForTimeout(2000)
  await doc.evaluate(() => document.querySelector('button[aria-label="Refresh now"]').click())
  await doc.waitForTimeout(2500)
  ok((await doc.locator('[data-fdi="36"]').getAttribute('class')).includes('ring-gold'), 'change while doctor is on the page: highlighted')
  const y1 = await doc.evaluate(() => scrollY); const chartTop = await doc.evaluate(() => [...document.querySelectorAll('h2')].find((e) => e.textContent === 'Dental chart').getBoundingClientRect().top); console.log('   scroll', y0, '->', y1, ' chart heading at', Math.round(chartTop), 'px from top')
  ok(chartTop < -100, 'and the page was not pulled back up to the chart')

  // Doctor's own charting is never flagged as "from another device"
  await doc.locator('[data-fdi="11"]').click(); await doc.getByRole('button', { name: 'C1', exact: true }).first().click(); await doc.waitForTimeout(2000)
  await doc.evaluate(() => document.querySelector('button[aria-label="Refresh now"]').click()); await doc.waitForTimeout(2500)
  ok(!(await doc.locator('[data-fdi="11"]').getAttribute('class')).includes('ring-gold'), 'own charting not highlighted as someone else’s')
  console.log(`${pass} passed, ${fail} failed`); await b.close()
})().catch((e) => { console.error(e); process.exit(2) })
