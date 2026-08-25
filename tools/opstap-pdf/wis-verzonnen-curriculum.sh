#!/usr/bin/env bash
# Runs wis-verzonnen-curriculum.sql against both dev databases, after backing them up.
#
# Separate from the .sql because three things have to line up on this machine and none of them fit in
# a one-liner: psql is not on PATH, the password lives in .NET user-secrets rather than in the repo,
# and Npgsql only reaches this server over 127.0.0.1.
#
#   bash tools/opstap-pdf/wis-verzonnen-curriculum.sh
#
# EVERY STEP ANNOUNCES ITSELF BEFORE IT RUNS, and no step hides its own stderr. The first version of
# this script did neither, and it failed at the user-secrets lookup and printed NOTHING AT ALL:
# `set -euo pipefail` aborted on the failing pipeline, `2>/dev/null` swallowed the reason, and there
# was no echo above it, so the run was indistinguishable from a command that never started. It cost a
# round trip in which the only evidence was the database being unchanged.
set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSQL="/c/Program Files/PostgreSQL/17/bin/psql.exe"
PGDUMP="/c/Program Files/PostgreSQL/17/bin/pg_dump.exe"
BACKUP="$HIER/backup"
TABELLEN=(-t leerplandoelen -t minimumdoelen -t themadoelen -t subdoelen
          -t '"activiteiten_Doelkoppelingen"' -t thema_doelsuggesties)

echo "wis-verzonnen-curriculum: start"

for exe in "$PSQL" "$PGDUMP"; do
  echo "  controleer $exe"
  [[ -x "$exe" ]] || { echo "  NIET GEVONDEN: $exe" >&2; exit 1; }
done

# `cd` plus a RELATIVE --project, deliberately. dotnet is a native Windows exe and chokes on the MSYS
# form of an absolute path (/c/source/...), which is exactly how the first version failed.
echo "  haal het wachtwoord uit user-secrets"
PGPASSWORD="$(cd "$HIER/../../backend" && dotnet user-secrets list --project src/Jaarplanner.Api \
  | sed -n 's/.*Password=\([^;]*\).*/\1/p')"
[[ -n "$PGPASSWORD" ]] || { echo "  geen Password= in user-secrets gevonden" >&2; exit 1; }
export PGPASSWORD
echo "  wachtwoord gevonden (${#PGPASSWORD} tekens)"

mkdir -p "$BACKUP"
for DB in jaarplanner_ov jaarplanner; do
  echo
  echo "=== $DB ==="
  echo "  back-up -> $BACKUP/curriculum-$DB.sql"
  "$PGDUMP" -h 127.0.0.1 -U jaarplanner -d "$DB" "${TABELLEN[@]}" \
    --data-only --column-inserts -f "$BACKUP/curriculum-$DB.sql"
  echo "  $(wc -l < "$BACKUP/curriculum-$DB.sql") regels bewaard"

  echo "  wis de verzonnen doelen"
  "$PSQL" -h 127.0.0.1 -U jaarplanner -d "$DB" -f "$HIER/wis-verzonnen-curriculum.sql"

  echo "  wat blijft staan:"
  "$PSQL" -h 127.0.0.1 -U jaarplanner -d "$DB" -At -F' | ' -c "
    select 'leerplandoelen', count(*) from leerplandoelen
    union all select 'minimumdoelen', count(*) from minimumdoelen
    union all select 'themas', count(*) from themas
    union all select 'subthemas', count(*) from subthemas
    union all select 'activiteiten', count(*) from activiteiten
    union all select 'themaplaatsingen', count(*) from themaplaatsingen
    union all select 'activiteitplaatsingen', count(*) from activiteitplaatsingen;" | sed 's/^/    /'
done

echo
echo "Klaar. Terugdraaien kan met:"
echo "  \"$PSQL\" -h 127.0.0.1 -U jaarplanner -d <db> -f \"$BACKUP/curriculum-<db>.sql\""
