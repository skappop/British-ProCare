@AGENTS.md

# British ProCare Dental Clinics — project brief for Claude

Read this first. It is what earlier sessions learned about the clinic, the
system and how the owner likes to work. Keep it up to date when something
here changes.

## Who you are working for

The owner of **British ProCare Dental Clinics**: two clinics (Clinic 1 and
Clinic 2) in Egypt, Cairo time. Staff: the owner, dentists, and reception
(called `assistant` in the database). The owner often writes by voice
dictation (expect "uh", typos, run-on sentences) and sends screenshots with
red arrows. Not a developer, but sharp about how the clinic really runs.

How they want things done:
- **Simple, practical, few taps.** Staff are busy and tired; anything that is
  not needed gets removed ("no need for all of this"). Reception decides
  *when*, the doctor decides *what treatment* — don't ask reception clinical
  questions. Default to the choice that never forces a guess.
- **Account for laziness and human error.** Undo instead of "are you sure",
  sensible defaults, caps on impossible numbers, ask only before something
  unusual (a big count difference, the same payment twice, a second booking
  the same day). Money is hidden from dentists.
- **Never break what works.** Migrations only add, are safe to run twice,
  and pages say which migration is missing instead of failing. Test before
  pushing (see "Testing"). If unsure what they meant, build the most
  reasonable reading and say how you read it.
- **Push to `main`** when a change is done and verified (Vercel deploys it).
  Commit messages explain the *why* in plain words.
- **Explain in plain language**, short, no jargon: what changed, what they
  must do (e.g. "run migrations/18_… in Supabase → SQL Editor"), what you
  could not test. Say honestly when something is uncertain.

## The system

| Part | Where | Notes |
|---|---|---|
| Website `src/` | Next.js 16 on Vercel, deploys from `main` | App Router, server actions, React Compiler lint rules |
| Database / logins / images | Supabase (free plan) | RLS `authenticated_full_access` pattern; images in bucket `patient-images` via signed URLs |
| Dental Agent `Dental Agent/` | Python on each Windows PC with a camera (Osstem One2) or X-ray sensor (EzDent-i) | Tray app; updates itself from GitHub `main` when `python setup_agent.py` is run |
| Backup `backup/` | Python on one clinic PC | Nightly CSV/JSON + images to a local disk |
| Migrations `migrations/` | Run by hand in Supabase SQL Editor | See migrations/README.md |

Roles and access live in **one place**: `src/lib/auth/access.ts` (`canOpen`,
`HOME`), used by the menu and by `guardPage()` in section layouts. Owner sees
everything; dentist: patients, charting, appointments, lab, inventory, stock
set-up, no dashboard or money; reception: walk-in desk, appointments, patients,
billing and receipts, stock check.

## Things that are not obvious

- **Next.js 16**: read `node_modules/next/dist/docs/` before using an API.
  `params`/`searchParams` are Promises; `'use server'` files may only export
  async functions; lint forbids setState in effect bodies, `Date.now()` in
  render (use `useState(() => Date.now())`), reassigning during render.
- **Supabase returns at most 1,000 rows per request.** Anything that needs
  "all" rows (reports, recall) must page: `src/lib/supabase/fetchAll.ts`.
- **Clinic day** = midnight to midnight Cairo time: `clinicDayRange()` in
  `src/lib/clinicDay.ts`.
- The oldest tables (patients, visits, visit_procedures, procedures,
  procedure_bom, inventory, payments) and the RPC `log_visit_with_deduction`
  (saves a visit and takes procedure materials off stock) were created in
  Supabase before `migrations/` existed. Their source is not in the repo;
  `tools/local-stack/base.sql` is a stand-in reconstructed from the code.
- **Saving a visit** (`patients/[id]/actions.ts → logVisit`) marks today's
  appointment seen and, from the doctor's page, redirects to /appointments
  *in the server action* (a client `router.push` got cancelled by live refreshes).
- **Payment status** everywhere comes from `src/lib/payStatus.ts` +
  `payState.ts`: owes / price not set / check payment / paid / no charge. A
  zero balance alone is never "paid" (a visit can be saved without a price).
- **Booking**: one panel, `src/components/BookSlot.tsx` — day, time, clinic
  (default "Decide when they arrive" = `clinic_id` null; chosen at check-in).
  Always 30 min; no treatment choice for reception.
- **Stock** (`/stock`, migration 18): nothing recorded during the day. At
  closing: container check (everything starts full; tap what is short;
  refill takes it off cabinet stock unless a procedure's materials already
  did — never twice), a daily count of 5 items (blind; big differences ask
  for a recount), a To-order list by supplier with WhatsApp. Every save can
  be undone for 24 h. SQL functions lock rows in a fixed order (no deadlocks)
  and refuse a second check of the same container from another phone.
- **Live updates**: `LiveRefresh` (Supabase Realtime) plus a catch-up refresh
  when a page comes back into focus. The dental chart highlights teeth charted
  on another device and scrolls into view when the doctor returns from the
  camera software.
- **Dental Agent X-rays** (3.2): EzDent-i writes several temp files per X-ray,
  may delete them within a second and may reuse names. The agent copies them
  into `captures/` as they appear (checked every 0.3 s), sends one *picture*
  per X-ray (never the DICOM; a DICOM-only X-ray is turned into a JPEG with
  pydicom), and logs every file it sees in `agent.log`. Exact EzDent file
  behaviour on the clinic PC is still unconfirmed — ask for `agent.log` if
  X-rays misbehave.
- Web copies of images: max 2400 px JPEG; originals stay on the clinic PCs.

## Testing

`tools/README.md`. In short: `tools/local-stack/start.sh --app` builds a
private copy of the backend (Postgres + all migrations + sample clinic,
Supabase Auth, PostgREST with the 1,000-row cap, a storage stand-in) and the
website, then `tools/local-stack/e2e/*.js` drive it in a real browser as
owner / dentist / reception, and `tools/agent-tests/` covers the Dental Agent,
including the real agent uploading to the local website. Run the relevant
suites before pushing; add a test for every bug fixed. `npm run build` must
pass with no environment variables set (Vercel/Cloudflare build step).

About 90 lint problems in older files are known style issues (`any`, quotes);
keep new code clean, don't mass-fix old files without a reason.

## Open items (update as they are done)

- Owner to confirm migrations 14, 16, 17, 18 and 19 have been run in Supabase
  (15 is confirmed).
- Dental Agent 3.2 to be installed on the X-ray PC (`python setup_agent.py`);
  then check `agent.log` after the first X-rays.
- Procedures without prices make visits show "Price not set" at reception —
  prices can be set on the Procedures page.
