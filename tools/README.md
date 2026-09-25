# Testing tools

Everything here runs on a Linux machine (or a Claude Code cloud session) and
never touches the real clinic data.

## `local-stack/` — a private copy of the backend, and the website tests

```
cd tools/local-stack
./start.sh --app        # first time ~5 min: Postgres + all migrations + sample clinic,
                        # Supabase login server, database API, file storage, website on :3000
./start.sh --fresh --app   # throw the local data away and rebuild
```

Needs: Postgres 16 (`/usr/lib/postgresql/*/bin`), Node, `curl`; it downloads
PostgREST and Supabase Auth from GitHub on first run. Logins:
`owner@test.local`, `dentist@test.local`, `reception@test.local`, password
`Passw0rd!`. Bridge API key for the Dental Agent: `KEY`. Like real Supabase it
returns at most 1,000 rows per request, so "only the first 1,000" bugs show up.

What it cannot copy: Supabase Realtime (pages show "Offline"; the refresh
button and catch-up on focus still work) and the real `log_visit_with_deduction`
function (not in the repo; `base.sql` has a stand-in that behaves the same way).

### Browser tests (`local-stack/e2e/`)

Need `playwright-core` (`npm i -g playwright-core` or set `PLAYWRIGHT_CORE`
to its folder) and Chromium (`CHROME_PATH`, or `npx playwright install chromium`).

```
cd tools/local-stack/e2e
psql -h 127.0.0.1 -p 55432 -U postgres -f ../reset.sql   # stock back to a known state
node stock.js      # closing routine: containers, count, order, undo, two phones (36 checks)
node crawl.js      # every page as owner / dentist / reception: no crash, access rules
node writes.js     # 8 dentists saving at once, double-taps, two payment desks
node paystate.js   # "Paid" only when paid; price not set; no charge
node booking.js    # booking panel, clinic decided on arrival, check-in
node regbook.js    # online registration → booked
node register.js   # public form: double submit, family phone, bots, floods
node livechart.js  # chart from the phone shows on the doctor's screen
node savenav.js 5 refresh   # save visit returns to the board, even with live refreshes
node cookies.js && node load.js 20 30   # 20 devices at once for 30 s
./truth.sh         # Reports / Recall figures vs the database's own totals
```

Screenshots go to `local-stack/.run/shots/`.

### Database torture test

30 sessions mixing visit saves, container checks, counts, deliveries and
undos; afterwards every item's stock must equal its history.

```
cd tools/local-stack
psql -h 127.0.0.1 -p 55432 -U postgres -c "update inventory set stock = 5000; delete from inventory_transactions; delete from stock_events; update containers set last_checked_at = null; truncate torture_start; insert into torture_start select id, stock from inventory; truncate torture_log;"
pgbench -h 127.0.0.1 -p 55432 -U postgres -n -c 30 -j 4 -T 40 -f .run/worker.sql postgres
psql -h 127.0.0.1 -p 55432 -U postgres -c "select count(*) as mismatched from (select i.stock, t.stock + coalesce((select sum(change) from inventory_transactions x where x.inventory_id=i.id),0) + coalesce((select sum(quantity) from stock_events e where e.inventory_id=i.id and undone_at is null),0) e from inventory i join torture_start t on t.id=i.id) z where stock <> e"
```

## `agent-tests/` — the Dental Agent

Python 3.12 with `requests pystray Pillow pydicom numpy`; the tray test needs
a display (`xvfb-run`).

```
cd tools/agent-tests
python test_watcher.py      # which files become uploads, when
python test_xray_cases.py   # X-rays: deleted at once, reused names, DICOM-only, 18-film series
python test_shrink.py       # web copies (≤ 2400 px JPEG), originals untouched
xvfb-run -a python test_service.py   # the whole agent loop against a mock website
python agent_real.py        # the real agent against the local website (start.sh --app first)
python agent_xray_real.py   # same, X-rays with deleted files and a DICOM-only capture
```
