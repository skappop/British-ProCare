#!/usr/bin/env bash
# A private copy of the clinic's backend on this machine — Postgres with every
# migration, Supabase's login server (GoTrue), its database API (PostgREST)
# and a stand-in for its file storage — plus the website pointed at it.
# Nothing here touches the real Supabase project. See README.md.
#
#   ./start.sh          start (first run builds everything, ~2 min)
#   ./start.sh --app    also build and start the website on :3000
#   ./start.sh --fresh  throw the local database away and start again
set -euo pipefail
trap "" HUP

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
RUN="$HERE/.run"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PGPORT=55432
# Postgres refuses to run as root; when we are root it runs as "postgres",
# which needs a data folder it can reach.
if [ "$(id -u)" = 0 ]; then PGDATA="${PGDATA:-/var/lib/postgresql/procare-local}"; else PGDATA="${PGDATA:-$RUN/pgdata}"; fi
POSTGREST_VERSION=v12.2.3
AUTH_VERSION=v2.177.0
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long

APP=0; FRESH=0
for arg in "$@"; do
  case "$arg" in --app) APP=1 ;; --fresh) FRESH=1 ;; esac
done

mkdir -p "$RUN/shots" "$RUN/objects"
psql_() { psql -q -h 127.0.0.1 -p "$PGPORT" -U postgres -v ON_ERROR_STOP=1 "$@"; }
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
wait_for() { for _ in $(seq 1 40); do curl -s -o /dev/null "$1" && return 0; sleep 0.5; done; echo "  ! $2 did not start (see $RUN/*.log)"; exit 1; }

echo "Tools"
if [ ! -x "$RUN/postgrest" ]; then
  echo "  . downloading PostgREST $POSTGREST_VERSION"
  curl -sSL -o "$RUN/pgrst.tar.xz" "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz"
  tar xf "$RUN/pgrst.tar.xz" -C "$RUN"
fi
if [ ! -x "$RUN/auth/auth" ]; then
  echo "  . downloading Supabase Auth $AUTH_VERSION"
  mkdir -p "$RUN/auth"
  curl -sSL -o "$RUN/auth.tar.gz" "https://github.com/supabase/auth/releases/download/$AUTH_VERSION/auth-$AUTH_VERSION-x86.tar.gz"
  tar xzf "$RUN/auth.tar.gz" -C "$RUN/auth"
fi

# Keys the website and tests use (signed with the local secret above).
node -e '
const c=require("crypto"),s=process.argv[1],b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const t=r=>{const h=b({alg:"HS256",typ:"JWT"}),p=b({role:r,iss:"supabase",iat:1700000000,exp:2000000000});return h+"."+p+"."+c.createHmac("sha256",s).update(h+"."+p).digest("base64url")};
console.log("ANON="+t("anon"));console.log("SERVICE="+t("service_role"))' "$JWT_SECRET" > "$RUN/keys.env"
. "$RUN/keys.env"

echo "Database"
stop_all() { for p in 3000 3001 9999 54321; do fuser -k $p/tcp >/dev/null 2>&1 || true; done; }
if [ "$FRESH" = 1 ]; then
  stop_all
  as_pg "$PGBIN/pg_ctl -D $PGDATA stop -m fast" >/dev/null 2>&1 || true
  rm -rf "$PGDATA" "$RUN/objects"; mkdir -p "$RUN/objects"
fi
NEW=0
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  NEW=1
  mkdir -p "$PGDATA"; [ "$(id -u)" = 0 ] && chown postgres "$PGDATA"
  as_pg "$PGBIN/initdb -D $PGDATA -A trust -U postgres" >/dev/null
fi
if ! pg_isready -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1; then
  as_pg "$PGBIN/pg_ctl -D $PGDATA -o '-p $PGPORT -c wal_level=logical -c max_connections=300 -c unix_socket_directories=/tmp' -l $PGDATA/log start" >/dev/null
  sleep 2
fi
[ "$NEW" = 1 ] && psql_ -f "$HERE/roles.sql" && echo "  + Supabase roles and schemas"

echo "Login server"
cat > "$RUN/gotrue.env" <<EOF
GOTRUE_API_HOST=127.0.0.1
PORT=9999
API_EXTERNAL_URL=http://localhost:54321/auth/v1
GOTRUE_DB_DRIVER=postgres
DATABASE_URL="postgres://supabase_auth_admin:pw@127.0.0.1:$PGPORT/postgres?search_path=auth&sslmode=disable"
GOTRUE_SITE_URL=http://localhost:3000
GOTRUE_JWT_SECRET=$JWT_SECRET
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
# Deprecated in name only: without it signed-in users get an empty role.
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_RATE_LIMIT_EMAIL_SENT=1000
GOTRUE_RATE_LIMIT_TOKEN_REFRESH=100000
GOTRUE_RATE_LIMIT_VERIFY=100000
GOTRUE_LOG_LEVEL=warn
EOF
fuser -k 9999/tcp >/dev/null 2>&1 || true
(cd "$RUN/auth" && set -a && . ../gotrue.env && set +a && exec ./auth) < /dev/null > "$RUN/auth.log" 2>&1 &
wait_for http://localhost:9999/health "GoTrue"

if [ "$NEW" = 1 ]; then
  psql_ -f "$HERE/after-auth.sql"
  echo "Schema"
  psql_ -f "$HERE/base.sql" >/dev/null && echo "  + base tables (patients, visits, inventory…)"
  cd "$REPO/migrations"
  for f in legacy/00_your_existing_payments_migration_REFERENCE_ONLY.sql legacy/create_clinic_configuration_safe.sql \
           legacy/add_insert_policy_clinic_config.sql legacy/add_sheets_sync.sql 01_image_records.sql legacy/add_image_category.sql \
           02_add_missing_columns.sql 02_appointments_recall.sql 03_inventory_suppliers_po_batches.sql \
           04_clinical_odontogram_treatment_lab.sql 05_staff_roles_audit_intake.sql 06_owner_hierarchy.sql \
           07_appointments_workflow.sql 08_role_management_lockdown.sql 09a_containers_structure.sql \
           1[0-9]_*.sql; do
    psql -q -h 127.0.0.1 -p "$PGPORT" -U postgres -f "$f" >/dev/null 2>"$RUN/migration.err" || true
    if grep -q ERROR "$RUN/migration.err"; then echo "  ! $f:"; grep ERROR "$RUN/migration.err" | head -3; else echo "  + $f"; fi
  done
  cd "$HERE"
  psql_ -f "$HERE/seed.sql" >/dev/null && echo "  + sample clinic data"
fi

echo "Database API and storage"
cat > "$RUN/pgrst.conf" <<EOF
db-uri = "postgres://authenticator:pw@127.0.0.1:$PGPORT/postgres"
db-schemas = "public,storage"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 3001
db-pool = 20
db-max-rows = 1000
log-level = "error"
EOF
fuser -k 3001/tcp 54321/tcp >/dev/null 2>&1 || true
(cd "$RUN" && exec ./postgrest pgrst.conf) < /dev/null > "$RUN/postgrest.log" 2>&1 &
(cd "$HERE" && exec node proxy.js) < /dev/null > "$RUN/proxy.log" 2>&1 &
wait_for http://localhost:54321/storage/v1/_stats "the proxy"
sleep 1

if [ "$NEW" = 1 ]; then
  echo "Staff logins"
  for who in owner dentist reception; do
    curl -s -X POST localhost:54321/auth/v1/admin/users -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
      -H 'content-type: application/json' -d "{\"email\":\"$who@test.local\",\"password\":\"Passw0rd!\",\"email_confirm\":true}" >/dev/null
  done
  psql_ -c "update auth.users set role = 'authenticated' where coalesce(role, '') = ''"
  psql_ -c "insert into profiles (id, full_name, role) select id, split_part(email,'@',1), case split_part(email,'@',1) when 'owner' then 'owner' when 'dentist' then 'dentist' else 'assistant' end from auth.users on conflict (id) do update set role = excluded.role, full_name = excluded.full_name"
  psql_ -f "$HERE/torture.sql" >/dev/null
  echo "  + owner@test.local, dentist@test.local, reception@test.local (password Passw0rd!)"
fi
RECEPTION_ID=$(psql -h 127.0.0.1 -p "$PGPORT" -U postgres -tAc "select id from auth.users where email='reception@test.local'")
sed "s/__USER__/$RECEPTION_ID/" "$HERE/worker.sql" > "$RUN/worker.sql"

if [ "$APP" = 1 ]; then
  echo "Website"
  fuser -k 3000/tcp >/dev/null 2>&1 || true
  cd "$REPO"
  export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_ROLE_KEY="$SERVICE" BRIDGE_API_KEY=KEY
  npm run build > "$RUN/build.log" 2>&1 || { echo "  ! build failed: see $RUN/build.log"; exit 1; }
  (exec npx next start -p 3000) < /dev/null > "$RUN/next.log" 2>&1 &
  wait_for http://localhost:3000/login "the website"
  echo "  + http://localhost:3000 (Bridge API key: KEY)"
fi
echo "Ready."
