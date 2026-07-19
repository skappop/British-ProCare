# SQL Migrations

Run these in order in your Supabase SQL Editor. Each is idempotent (`if not exists` /
`create or replace`) so re-running is safe.

1. `01_payments_ledger.sql` — NOT NEEDED. Your `payments` table and ledger system
   already existed before this batch of work; nothing to run here. Kept out
   intentionally — see CHANGES.md.
2. `02_appointments_recall.sql` — appointments table
3. `03_inventory_suppliers_po_batches.sql` — suppliers, purchase orders, batches, stock movements
4. `04_clinical_odontogram_treatment_lab.sql` — odontogram column, treatment plans, lab cases
5. `05_staff_roles_audit_intake.sql` — profiles, audit columns, patient intake fields

Run 02 through 05 in order.

## Important: column name discrepancy

`00_your_existing_payments_migration_REFERENCE_ONLY.sql` is your original migration
(kept here for reference only — do not re-run it, the table already exists).

That file defines a `note` (singular) column, but the live code actually wired into
your app (`patients/[id]/actions.ts` → `getPatientLedger`/`recordPayment`, used by
`PaymentLedger.tsx`) queries `notes` (plural). These disagree. Before trusting the
ledger, open Supabase → Table Editor → `payments` and confirm which column name is
actually there, and make sure the column name in `actions.ts` matches it exactly.

6. `06_owner_hierarchy.sql` — updates staff roles to owner/dentist/assistant.
   After running it, go to /staff in the app and set your own account to "Owner".
7. `07_appointments_workflow.sql` — adds `arrived`/`in_chair` appointment statuses
   plus `arrived_at`/`seated_at` timestamps. Powers the new Appointments "Day
   Tracker" (Scheduled → Waiting → In chair → Done). Safe to re-run; existing
   appointments keep their status.
8. `08_role_management_lockdown.sql` — restricts profile role changes to the Owner
   at the database level (RLS), so assistants can't promote themselves. Run this
   **after** you've made yourself Owner (via SQL). Profiles stay readable; only
   owners can write roles.
