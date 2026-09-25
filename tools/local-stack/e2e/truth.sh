#!/bin/bash
# Page figures vs the database's own totals
cd "$(dirname "$0")" && node cookies.js >/dev/null 2>&1
Q="psql -q -h 127.0.0.1 -p 55432 -U postgres -tAc"
for M in 2026-08 2026-09; do
  S="$M-01"; E=$(date -d "$S +1 month" +%F)
  html=$(curl -s -H "cookie: $(cat ../.run/cookie-owner.txt)" "localhost:3000/reports?month=$M")
  page=$(echo "$html" | grep -oE 'EGP <!-- -->[0-9,]+|EGP [0-9,]+' | head -2 | sed 's/EGP <!-- -->//; s/EGP //' | tr '\n' ' ')
  echo "reports $M  page: charged/collected = $page   database: $($Q "select to_char(sum(fee_charged),'FM999,999,999') from visits where visit_date >= '$S' and visit_date < '$E'") / $($Q "select to_char(sum(amount),'FM999,999,999') from payments where paid_at >= '$S' and paid_at < '$E'")   ($($Q "select count(*) from visits where visit_date >= '$S' and visit_date < '$E'") visits)"
done
page=$(curl -s -H "cookie: $(cat ../.run/cookie-owner.txt)" localhost:3000/recall | grep -oE '[0-9]+(<!-- -->)? patient(<!-- -->)?s?(<!-- -->)? overdue' | head -1 | grep -oE '^[0-9]+')
truth=$($Q "with last as (select distinct on (patient_id) patient_id, visit_date, ortho_quick_log from visits order by patient_id, visit_date desc)
 select count(*) from patients p join last l on l.patient_id = p.id
 where p.id not in (select patient_id from appointments where status='scheduled' and scheduled_at >= now())
   and ((not coalesce(p.is_ortho,false) and l.visit_date < now() - interval '180 days')
     or (p.is_ortho and (l.ortho_quick_log->>'next_visit_weeks') is not null and l.visit_date + ((l.ortho_quick_log->>'next_visit_weeks')::int * interval '7 days') < now()))")
echo "recall  page: $page overdue   database: $truth"
