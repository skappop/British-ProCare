# Walk-In Reception Flow

A guided, click-driven flow for registering a walk-in patient end-to-end without
hunting through menus. It is an **orchestration layer on top of existing features** —
nothing was removed or replaced. Every step reuses the app's existing server actions.

## Where it lives

Route: **`/reception`** (inside the `(dashboard)` group, so it inherits auth + sidebar).

Entry points added:
- **Sidebar:** a "Walk-In" item pinned to the top of the nav.
- **Dashboard:** a "Start Walk-In" button next to the greeting.

## The five steps

1. **Identify** — today's booked patients shown as one-tap cards, plus live search,
   plus inline "register new patient" (name + phone + file no.) without leaving the flow.
2. **Safety** — medical history / allergies / consent. If already on file, it's shown for
   a quick confirm; otherwise an inline edit form. Allergy & pregnancy flags stay pinned
   as a banner for the rest of the flow.
3. **Treatment** — reuses `logVisit` (RPC `log_visit_with_deduction`, which also deducts
   inventory), live BOM/stock preview, auto-fee from the selected procedures, ortho
   quick-log, and a "same as last visit" shortcut.
4. **Payment** — reuses `recordPayment`. Method chips, "pay in full" shortcut. Skippable.
5. **Done** — summary, print receipt (`/receipts/[visitId]`), inline "book next
   appointment" (prefilled from the ortho next-visit interval when present), open full
   profile, or start the next walk-in.

## How it reuses existing code (no duplication)

- `patients/[id]/actions.ts` → `logVisit`, `getBomPreview`, `getLastVisitSetup`,
  `getLastQuickLog`, `recordPayment`
- `appointments/actions.ts` → `createAppointment`, `searchPatientsForBooking`
- `patients/[id]/OrthoQuickLog.tsx` → the ortho quick-log UI + type

New thin server actions (return values instead of `redirect()`, so they work inside a
client wizard) live in `reception/receptionActions.ts`:
`searchWalkInPatients`, `quickCreatePatient`, `getPatientSafety`, `quickSaveIntake`,
`getLatestVisit`, `linkAppointmentToVisit`.

> `logVisit` doesn't return the new visit id, so after saving, `getLatestVisit(patientId)`
> fetches the newest visit to drive the receipt link and appointment linkage. If a patient
> was picked from a booked slot, `linkAppointmentToVisit` sets the appointment's `visit_id`
> and marks it completed.

## Files added

```
src/app/(dashboard)/reception/
  page.tsx              server component: loads active procedures + today's appointments
  ReceptionFlow.tsx     client orchestrator: progress rail, safety banner, step routing
  receptionActions.ts   wizard-friendly server actions (no redirects)
  types.ts              shared types + STEPS + PAYMENT_METHODS
  ui.tsx                shared Marble & Gold UI primitives
  steps/
    StepIdentify.tsx
    StepSafety.tsx
    StepVisit.tsx
    StepPayment.tsx
    StepDone.tsx
```

Modified (additive only): `src/components/SidebarNav.tsx` (nav item),
`src/app/(dashboard)/page.tsx` (CTA). One pre-existing React-19 form-action type error in
`staff/page.tsx` was given a behavior-preserving wrapper so `next build` passes cleanly.

## Setup

Same as the rest of the app: `npm install`, provide `.env.local` (see
`.env.local.example`), run the SQL in `migrations/` in order, set an owner role at
`/staff`. No new dependencies were added.
