const { launch } = require('./browser')
const { execSync } = require('child_process')
const B = 'http://localhost:3000'
const sql = (q) => execSync(`psql -q -h 127.0.0.1 -p 55432 -U postgres -tAc "${q}"`).toString().trim()
;(async () => {
  const b = await launch()
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage()
  await p.goto(B + '/login'); await p.fill('input[name=email]', 'dentist@test.local'); await p.fill('input[name=password]', 'Passw0rd!')
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login')), p.getByRole('button', { name: 'Enter Clinic' }).click()])
  let landed = 0
  const N = Number(process.argv[2] || 5), mode = process.argv[3] || 'refresh'
  for (let i = 0; i < N; i++) {
    const pid = sql(`insert into patients (full_name) values ('Nav Test ${Date.now()}') returning id`)
    sql(`insert into appointments (patient_id, scheduled_at, status, arrived_at) values ('${pid}', now(), 'in_chair', now())`)
    await p.goto(B + '/patients/' + pid, { waitUntil: 'load' }); await p.waitForTimeout(700)
    await p.getByRole('button', { name: /Examination/ }).first().click(); await p.waitForTimeout(500)
    await p.getByRole('button', { name: /^(Save visit|Save & finish visit)$/ }).click()
    if (mode === 'refresh') {
      // What the live listener does when the save's database changes arrive
      for (let k = 0; k < 8; k++) { await p.waitForTimeout(150); await p.evaluate(() => document.querySelector('button[aria-label="Refresh now"]')?.click()).catch(() => {}) }
    }
    await p.waitForTimeout(4000)
    const url = new URL(p.url()).pathname
    if (url === '/appointments') landed++
    console.log(`  run ${i + 1}: ${url}   visit saved: ${sql(`select count(*) from visits where patient_id='${pid}'`)}`)
  }
  console.log(`${landed}/${N} returned to the appointments board (${mode})`)
  await b.close()
})()
