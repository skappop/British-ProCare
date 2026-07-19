-- 07 — Appointment patient-tracking workflow
-- Adds two in-day pipeline states (arrived → in_chair) between "scheduled" and
-- "completed", plus timestamps so the Day Tracker can show wait / chair times.
-- Backwards compatible: existing rows keep their current status.

alter table appointments
  drop constraint if exists appointments_status_check;

alter table appointments
  add constraint appointments_status_check
  check (status in ('scheduled', 'arrived', 'in_chair', 'completed', 'no_show', 'cancelled'));

alter table appointments add column if not exists arrived_at timestamptz;
alter table appointments add column if not exists seated_at timestamptz;

-- Helpful for the day board (already have scheduled_at + status indexes).
create index if not exists appointments_status_scheduled_idx
  on appointments (status, scheduled_at);
