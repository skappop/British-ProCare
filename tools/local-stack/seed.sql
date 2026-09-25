-- A believable clinic: a stocked cabinet, four procedure containers, three
-- procedures (two with materials), 300 patients, a day of appointments and
-- some history. Staff logins are created by start.sh through GoTrue.
insert into suppliers (name, whatsapp) values ('Dental Supply Co', '+201001234567'), ('Cairo Medical', null);
insert into inventory (name, unit, stock, reorder_level, category) values
 ('Gloves (M)', 'box', 12, 4, 'PPE'), ('Cotton rolls', 'pack', 30, 10, 'Consumable'), ('Anaesthetic cartridge', 'pcs', 60, 20, 'Consumable'),
 ('Composite A2', 'syringe', 3, 2, 'Restorative'), ('Bonding agent', 'bottle', 2, 1, 'Restorative'), ('Etching gel', 'syringe', 4, 2, 'Restorative'),
 ('Mirror', 'pcs', 6, 2, 'Instrument'), ('Probe', 'pcs', 6, 2, 'Instrument'), ('K-file 25', 'pack', 5, 2, 'Endo'), ('Gutta percha', 'box', 1, 2, 'Endo'),
 ('Paper points', 'box', 8, 3, 'Endo'), ('Saliva ejector', 'pcs', 100, 30, 'Consumable'), ('Bracket kit', 'kit', 4, 2, 'Ortho'), ('Ortho wire 014', 'pcs', 20, 5, 'Ortho');
update inventory set supplier_id = (select id from suppliers where name = 'Dental Supply Co') where category in ('Restorative', 'Endo');
update inventory set shelf = 'Shelf ' || (1 + (abs(hashtext(name)) % 3));
insert into procedures (code, name, category, base_fee) values ('EXAM', 'Examination', 'General', 300), ('FILL', 'Composite filling', 'Restorative', 1200), ('RCT', 'Root canal', 'Endo', 3500);
insert into procedure_bom (procedure_id, inventory_id, quantity)
  select p.id, i.id, q from (values ('FILL', 'Composite A2', 1), ('FILL', 'Anaesthetic cartridge', 1), ('RCT', 'Anaesthetic cartridge', 2), ('RCT', 'Paper points', 1)) v(c, n, q)
  join procedures p on p.code = v.c join inventory i on i.name = v.n;
insert into containers (name) select n from (values ('Restorative'), ('Endo'), ('Ortho'), ('Crown')) v(n)
  where not exists (select 1 from containers c where c.name = v.n);
insert into container_items (container_id, inventory_id, baseline_quantity, current_quantity, reusable)
  select c.id, i.id, v.qty, v.qty, v.reus from (values
   ('Restorative', 'Composite A2', 2, false), ('Restorative', 'Bonding agent', 1, false), ('Restorative', 'Etching gel', 2, false), ('Restorative', 'Anaesthetic cartridge', 5, false),
   ('Restorative', 'Mirror', 2, true), ('Restorative', 'Probe', 2, true), ('Restorative', 'Cotton rolls', 3, false),
   ('Endo', 'K-file 25', 2, false), ('Endo', 'Gutta percha', 1, false), ('Endo', 'Paper points', 1, false), ('Endo', 'Anaesthetic cartridge', 5, false), ('Endo', 'Mirror', 1, true),
   ('Ortho', 'Bracket kit', 1, false), ('Ortho', 'Ortho wire 014', 4, false), ('Ortho', 'Mirror', 1, true),
   ('Crown', 'Cotton rolls', 2, false), ('Crown', 'Gloves (M)', 1, false)) v(c, n, qty, reus)
  join containers c on c.name = v.c join inventory i on i.name = v.n;
insert into patients (full_name, phone, file_number) select 'Patient ' || g, '0100000' || lpad(g::text, 4, '0'), 'F' || g from generate_series(1, 300) g;
insert into patients (full_name, phone) select 'Load Test ' || g, '0111000' || lpad(g::text, 4, '0') from generate_series(1, 40) g;
insert into appointments (patient_id, scheduled_at, status, clinic_id, arrived_at)
  select p.id, date_trunc('hour', now()) + (g % 10) * interval '30 minutes' - interval '2 hours',
    (array['scheduled', 'arrived', 'in_chair', 'completed'])[1 + g % 4], (select id from clinics order by sort_order limit 1 offset (g % 2)),
    case when g % 4 in (1, 2, 3) then now() - interval '30 minutes' end
  from generate_series(1, 40) g join lateral (select id from patients where full_name like 'Patient %' order by full_name offset g limit 1) p on true;
insert into visits (patient_id, visit_date, fee_charged, notes)
  select (select id from patients where full_name like 'Patient %' offset (g % 300) limit 1), now() - (g || ' hours')::interval, 300 + (g % 5) * 400, 'seed'
  from generate_series(1, 2000) g;
insert into visit_procedures (visit_id, procedure_id, fee) select v.id, (select id from procedures where code = 'EXAM'), 300 from visits v;
insert into payments (patient_id, visit_id, amount, method, paid_at) select patient_id, id, fee_charged, 'cash', visit_date from visits where random() < 0.75;
