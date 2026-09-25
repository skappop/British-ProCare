const { launch } = require('./browser')
const { execSync } = require('child_process')
const B = 'http://localhost:3000'
const sql = (q) => execSync(`psql -q -h 127.0.0.1 -p 55432 -U postgres -tAc "${q}"`).toString().trim()
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m) }
const mk = (name, fee, visit = true) => {
  const id = sql(`insert into patients (full_name) values ('${name}') returning id`)
  sql(`insert into appointments (patient_id, scheduled_at, status, arrived_at) values ('${id}', now(), 'completed', now())`)
  if (visit) sql(`insert into visits (patient_id, visit_date, fee_charged) values ('${id}', now(), ${fee})`)
  return id
}
;(async () => {
  const tag = Date.now().toString().slice(-5)
  const A = mk(`Nopri ${tag}`, 'null'), Bp = mk(`Owes ${tag}`, 300), C = mk(`Nothing ${tag}`, 0, false), D = mk(`Free ${tag}`, 'null')
  const b = await launch()
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  p.on('pageerror', (e) => { fail++; console.log('  ✗ page error', e.message) })
  await p.goto(B + '/login'); await p.fill('input[name=email]', 'reception@test.local'); await p.fill('input[name=password]', 'Passw0rd!')
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login')), p.getByRole('button', { name: 'Enter Clinic' }).click()])
  const rowText = async (name) => (await p.locator('a', { hasText: name }).first().innerText().catch(() => '')).replace(/\n/g, ' ')
  const inTodo = async (name) => (await p.locator('a[href$="/billing"].border-l-success', { hasText: name }).count()) > 0

  await p.goto(B + '/reception', { waitUntil: 'load' })
  ok(await inTodo(`Nopri ${tag}`) && /set the price/.test(await rowText(`Nopri ${tag}`)), 'visit with no price: on the to-do list, "set the price" — ' + await rowText(`Nopri ${tag}`))
  ok(await inTodo(`Owes ${tag}`) && /EGP 300/.test(await rowText(`Owes ${tag}`)), 'visit with a price: take payment EGP 300')
  ok(!(await inTodo(`Nothing ${tag}`)), 'seen with nothing recorded: not on the to-do list')
  await p.getByText(/Done today/).click()
  ok(/No charge/.test(await rowText(`Nothing ${tag}`)), 'and shown as "No charge", not "Paid" — ' + await rowText(`Nothing ${tag}`))
  await p.screenshot({ path: require('path').join(__dirname, '..', '.run', 'shots', 'reception-paystate.png'), fullPage: true })

  // Set the price for A on Billing, then take payment
  await p.goto(B + `/patients/${A}/billing`, { waitUntil: 'load' })
  ok(await p.getByText(/has no price yet/).isVisible() && await p.getByText('Price not set yet').isVisible() && !(await p.getByText('All paid').count()), 'billing: "has no price yet", header not "All paid"')
  await p.screenshot({ path: require('path').join(__dirname, '..', '.run', 'shots', 'billing-noprice.png'), fullPage: true })
  await p.getByLabel('Price for this visit').fill('450'); await p.getByRole('button', { name: 'Set price' }).click()
  await p.waitForTimeout(2000)
  ok(sql(`select fee_charged from visits where patient_id='${A}'`) === '450', 'price saved')
  ok((await p.locator('input[placeholder="0"]').inputValue()) === '450', 'amount to take filled in: 450')
  await p.getByRole('button', { name: /^Record EGP 450/ }).click(); await p.waitForTimeout(2000)
  await p.goto(B + '/reception', { waitUntil: 'load' })
  ok(!(await inTodo(`Nopri ${tag}`)), 'after payment: off the to-do list')
  await p.getByText(/Done today/).click()
  ok(/Paid ✓/.test(await rowText(`Nopri ${tag}`)), 'and shown as Paid ✓')

  // D: mark as free
  await p.goto(B + `/patients/${D}/billing`, { waitUntil: 'load' })
  p.once('dialog', (d) => d.accept())
  await p.getByRole('button', { name: 'No charge' }).click(); await p.waitForTimeout(2000)
  ok(sql(`select fee_charged from visits where patient_id='${D}'`) === '0', 'No charge: price set to 0')
  await p.goto(B + '/reception', { waitUntil: 'load' })
  ok(!(await inTodo(`Free ${tag}`)), 'free visit: off the to-do list')

  // Board shows the same
  await p.goto(B + '/appointments', { waitUntil: 'load' })
  const board = await p.locator('body').innerText()
  ok(/To pay · EGP 300/.test(board), 'appointments board: "To pay · EGP 300" for the one who owes')
  console.log(`${pass} passed, ${fail} failed`); await b.close()
})().catch((e) => { console.error(e); process.exit(2) })
