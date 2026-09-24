# British ProCare Dental Clinics

The clinics' own system: patients, appointments, charting, imaging, billing and
stock for both clinics. Staff use it in a browser on the clinic computers and on
their phones.

| Part | What it is | Where it runs |
|---|---|---|
| Website (`src/`) | Next.js 16 app | Vercel (deploys itself from `main`) |
| Database, logins, image storage | Supabase | Supabase (free plan) |
| Dental Agent (`Dental Agent/`) | Opens the intraoral camera / X-ray software and uploads images to the right patient | Each clinic PC with a camera or sensor |
| Backup (`backup/`) | Nightly copy of all records and images to a disk you own | One clinic PC |
| Database changes (`migrations/`) | SQL to run in Supabase, in order | Supabase SQL Editor |

## Who sees what

| | Owner | Dentist | Reception |
|---|---|---|---|
| Dashboard, reports, staff, settings, procedures & prices | ✓ | | |
| Patients, charting, appointments, lab work | ✓ | ✓ | ✓ |
| Fees, payments, receipts | ✓ | | ✓ |
| Walk-in desk | ✓ | | ✓ |
| Inventory, stock set-up | ✓ | ✓ | |
| Stock check (the closing routine) | ✓ | ✓ | ✓ |

The rules live in one file, `src/lib/auth/access.ts`: the menu and every page
use it. Staff roles are set on the Staff page (owner only).

## A day at the clinic

1. **Reception** books or checks the patient in (patients can also register
   themselves on `/register`; reception confirms the time).
2. **Dentist** opens the patient from the board: today's treatment, the chart,
   imaging, then *Save & finish visit*. That takes the procedures' materials
   off stock and sends the patient back to reception.
3. **Reception** takes payment and prints the receipt.
4. **At closing**, whoever closes up does the Stock check: each container
   (scan its sticker; everything starts as full, tap only what is short), a
   handful of cabinet items to count, and the To-order list with a ready
   WhatsApp message per supplier.

Mistakes are expected, so: saves ask before anything unusual (a big difference
in a count, the same payment twice), stock saves can be undone for a day, and
two phones can't refill the same container twice.

## Settings (Vercel → Project → Settings → Environment Variables)

| Name | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Self-registration, staff emails, the Dental Agent |
| `BRIDGE_API_KEY` | The Dental Agent (the same key goes in its Settings) |
| `CRON_SECRET` | Protects the scheduled jobs |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_RANGE` | Optional: Google Sheets patient import ([guide](docs/google-sheets-setup.md)) |
| `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM` | Optional: low-stock email |
| `ADMIN_API_KEY`, `NEXT_PUBLIC_ADMIN_API_KEY` | Optional: manual Sheets sync button |

## Changing the database

Every change is a numbered file in `migrations/`, run once in Supabase → SQL
Editor. They only add things and are safe to run again. See
[migrations/README.md](migrations/README.md) for the order and what each does.
Pages that need a migration that hasn't been run say so instead of breaking.

## For developers

```
npm install
npm run dev      # needs .env.local with the Supabase URL and anon key
npm run build    # what Vercel runs
npm run lint
```

This is Next.js 16: read `AGENTS.md` first. Pushing to `main` deploys.

Older notes and reports are in [docs/archive](docs/archive/README.md); they
describe earlier versions and are kept only for history.
