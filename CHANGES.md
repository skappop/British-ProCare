# What was added in this session

Full detail was given phase-by-phase in chat. This is a quick index.

## Genuinely new (Phases 12, 14, 15, 16)
- **Appointments & Recall**: `src/app/(dashboard)/appointments/`, `recall/page.tsx`
  — day/week calendar, booking, recall engine (6-month + ortho next-visit-weeks logic),
  WhatsApp click-to-chat reminders
- **Inventory + QR**: `inventory/scan/`, `inventory/purchase-orders/`, `inventory/suppliers/`,
  `inventory/QRLabel.tsx`, `inventory/poActions.ts`, `inventory/scanActions.ts`,
  `api/cron/stock-alerts/route.ts` — QR-based stock pull, suppliers, purchase orders,
  expiry tracking, low-stock email cron
- **Clinical depth**: `patients/[id]/Odontogram.tsx`, `TreatmentPlanPanel.tsx`,
  `PatientLabCases.tsx`, `lab-cases/` — FDI tooth chart, ortho phase tracking,
  lab case tracking
- **Operational**: `staff/`, `receipts/[visitId]/`, `patients/[id]/intake/` —
  staff roles (UI only, RLS not yet enforced — see note below), printable
  receipts, medical history/consent intake

## Pre-existing, touched only where necessary
- `patients/[id]/page.tsx` — added Odontogram, TreatmentPlanPanel, PatientLabCases,
  allergy banner, intake link, receipt links. Your original `PaymentLedger` and
  `LogVisitForm` wiring is untouched.
- `(dashboard)/page.tsx` (dashboard home) — added today's appointments widget;
  today's-visits and today's-revenue stats still source from your real tables.
- `inventory/page.tsx` — added expiring-batches banner and links to scan/PO pages.
- `inventory/[id]/edit/page.tsx` — added a QR label print button.
- `components/SidebarNav.tsx` — added Appointments, Recall, Lab Cases, Staff links.
  Your original Reports link is preserved as-is.

## Explicitly NOT touched
- `patients/[id]/PaymentLedger.tsx`, `patients/[id]/actions.ts` (payments/ledger part),
  `reports/page.tsx`, the `payments` table — these already existed and work; I built
  a redundant duplicate early in this session by mistake and have since backed it
  out everywhere. See the note in migrations/README.md about a `note`/`notes` column
  discrepancy I found while double-checking this — please verify against your live
  Supabase schema.
- `log_visit_with_deduction` RPC — never modified; I don't have its source, so
  batch/FEFO-aware deduction wasn't attempted (see migrations/README.md).
- RLS policies on any pre-existing table (`patients`, `visits`, `inventory`,
  `procedures`) — untouched. New tables all use a blanket
  "any authenticated user" policy matching your existing pattern. Staff **roles
  exist and are recorded, but nothing is actually restricted by role yet** —
  that needs a separate pass through your real RLS policies.

## Before you deploy
1. Run `migrations/02` through `05` in order in Supabase SQL Editor.
2. Verify the `payments.notes` vs `payments.note` column name (see migrations/README.md).
3. Set Resend env vars if you want the stock-alert cron to actually send email
   (it no-ops safely if unset).
4. `npm install` — no new dependencies were added; the QR system uses an external
   image API (api.qrserver.com) instead of a package.

---

# Session 3 — Odontogram, PDF reports, appointment tracker

## Enhanced odontogram (anatomical)
Replaced the blocky polygon/rect teeth with smooth, anatomically-styled tooth
glyphs (crown + roots, soft inner highlight, occlusal detail), colour-coded by
status in the Marble & Gold palette. Added a **primary-dentition toggle**
(deciduous teeth). Kept the existing **FDI numbering** and the same data model
(`patients.odontogram` jsonb) and `updateTooth` server action — no data change.
- New shared component: `src/components/dental/` (`toothGeometry.ts`,
  `toothStatus.ts`, `ToothGlyph.tsx`, `DentalChart.tsx`).
- `patients/[id]/Odontogram.tsx` is now a thin wrapper over `DentalChart`.
- The chart is embedded in the Walk-In (Treatment step) as a collapsible panel so
  teeth can be marked mid-visit; it self-saves through the same action.

## Patient report (PDF)
A one-click professional PDF built with jsPDF + jspdf-autotable, with the clinic
logo, patient info, medical alerts, a Treatment-History table (date · procedures ·
notes) and Dental-Chart-Findings table. **No fees** — those stay on the receipt.
- New: `src/components/PatientReportButton.tsx`,
  `patients/[id]/reportActions.ts` (`getPatientReportData`).
- Available on the patient profile header ("Download report") and the Walk-In
  "Done" step.
- New dependencies: `jspdf`, `jspdf-autotable`.

## Appointments remap — Day Tracker
The day view is now a **patient-flow board**: Scheduled → Waiting → In chair →
Done, with counts, live wait/chair timers, one-tap status advance, and a
"Start visit" hand-off that deep-links into the Walk-In preselected to the patient
(`/reception?patient=…&appt=…`). No-shows/cancellations sit in an "undo"-able
off-ramp. The Week view (planner) and booking form are unchanged.
- New: `appointments/DayBoard.tsx`; rewrote `appointments/page.tsx` and
  `appointments/actions.ts` (status timestamps).
- New migration `07_appointments_workflow.sql` — adds `arrived`/`in_chair`
  statuses + `arrived_at`/`seated_at`. **Run it** after 02–06.
