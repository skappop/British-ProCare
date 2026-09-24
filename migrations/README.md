# Database changes

Each file is run **once**, in Supabase → **SQL Editor** → New query → paste the
whole file → **Run**. They only add tables, columns and functions; nothing is
removed, and running one again is safe.

If a page says something like *"run migrations/18_stock_routines.sql"*, that
file has not been run yet: run it and reload the page.

| File | Adds | Notes |
|---|---|---|
| `01_image_records.sql` | Patient images table | |
| `02_add_missing_columns.sql` | Columns on image records | |
| `02_appointments_recall.sql` | Appointments, recall | |
| `03_inventory_suppliers_po_batches.sql` | Suppliers, purchase orders, batches, stock history | |
| `04_clinical_odontogram_treatment_lab.sql` | Dental chart, treatment plans, lab cases | |
| `05_staff_roles_audit_intake.sql` | Staff profiles, intake fields | |
| `06_owner_hierarchy.sql` | Roles: owner / dentist / assistant (Reception) | Then set yourself to Owner on the Staff page |
| `07_appointments_workflow.sql` | Waiting / in-chair steps on the board | |
| `08_role_management_lockdown.sql` | Only the owner can change roles | Run after you are Owner |
| `09a_containers_structure.sql` | Procedure containers | Use this, **not** `09_containers_rapid_scan.sql` (its sample data does not fit every database) |
| `10_active_patient.sql` | "Patient in the chair" for imaging | |
| `11_image_records_columns.sql` | Columns the image upload writes | |
| `12_patient_images_storage_policies.sql` | Who can read and upload images | |
| `13_clinics_and_realtime.sql` | Clinic 1 / Clinic 2, live board | |
| `14_patient_registrations.sql` | Patient self-registration | |
| `15_imaging_sessions.sql` | Imaging started from the website (Dental Agent) | |
| `16_patients_realtime.sql` | Live chart between phone and computer | |
| `17_storage_usage.sql` | Storage gauge on the dashboard | |
| `18_stock_routines.sql` | Stock check: container refill, daily count, to-order list, undo | |
| `19_performance_indexes.sql` | Faster Recall, Reports and patient pages as history grows | Optional, recommended; changes no data |

`legacy/` holds one-off scripts from before this numbering (Google Sheets sync
columns, calibration settings, the original payments table). They have already
been applied where needed; they are kept for reference, not to be run again.

## Starting a fresh database

Run the numbered files in the order above. The very first tables (patients,
visits, procedures, inventory, payments) and the visit-saving function
`log_visit_with_deduction` were created in Supabase before this folder existed
and are not in these files. Keep the automatic Supabase backups on, and use the
nightly backup in `backup/` for your own copy.
