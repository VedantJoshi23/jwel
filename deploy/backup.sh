#!/usr/bin/env bash
#
# Nightly backup: database AND uploads volume, together.
#
# They must be taken as a pair — restoring a database without the matching
# uploads leaves every product_media row pointing at a file that isn't there
# (broken images); restoring uploads without the database leaves files nothing
# references. See deploy/README.md "Backups".
#
# Installed in ubuntu's crontab; see `crontab -l`.

set -euo pipefail

DEPLOY_DIR=/home/ubuntu/jwel/deploy
OUT="$DEPLOY_DIR/backups"
STAMP=$(date +%F)
RETAIN_DAYS=14

cd "$DEPLOY_DIR"

# -T: no TTY. Without it cron (which has no terminal) fails with
# "the input device is not a TTY".
docker compose -f docker-compose.postgres.yml exec -T postgres \
    pg_dump -U jwel jwel | gzip > "$OUT/db-$STAMP.sql.gz"

# Roles are CLUSTER-level and are NOT in a single-database pg_dump — but the
# dump's GRANT statements reference them by name. Restoring db-*.sql.gz into a
# fresh Postgres therefore aborts with `role "metabase_ro" does not exist`,
# which the 2026-08-07 restore drill found (RUNBOOK §11b). The data restores
# fine; the grants at the end of the file do not.
#
# Dump the role definitions alongside, so a restore is self-sufficient.
docker compose -f docker-compose.postgres.yml exec -T postgres \
    pg_dumpall -U jwel --roles-only | gzip > "$OUT/roles-$STAMP.sql.gz"

# Addressed by volume name, not by container — this keeps working across a
# redeploy that replaces the api container.
docker run --rm -v jwel_uploads:/data -v "$OUT":/out alpine \
    tar czf "/out/uploads-$STAMP.tar.gz" -C /data .

# Metabase (optional, M14/ADR-0006) is DIFFERENT from Grafana/Prometheus,
# which deliberately get no backup.sh coverage — their config is provisioned
# as files (dashboards-as-code) and a fresh volume rebuilds identically.
# Metabase's dashboards/saved questions are built by clicking in its UI with
# no provision-as-code equivalent in the open-source edition, so this is
# real, irreplaceable state. Conditional on the `metabase` database actually
# existing — Metabase is optional, and a host that never opted into it must
# not have its backups start failing because of a database that was never
# created.
if docker compose -f docker-compose.postgres.yml exec -T postgres \
    psql -U jwel -d jwel -tAc "SELECT 1 FROM pg_database WHERE datname = 'metabase'" | grep -q 1; then
    docker compose -f docker-compose.postgres.yml exec -T postgres \
        pg_dump -U jwel metabase | gzip > "$OUT/metabase-db-$STAMP.sql.gz"
fi

# A zero-byte dump means pg_dump failed but gzip still produced a file, so the
# pipeline's exit status was gzip's. Catch it here rather than discovering it
# during a restore.
for f in "$OUT/db-$STAMP.sql.gz" "$OUT/uploads-$STAMP.tar.gz"; do
    if [[ ! -s $f ]]; then
        echo "backup FAILED: $f is empty" >&2
        exit 1
    fi
done
if [[ -f "$OUT/metabase-db-$STAMP.sql.gz" && ! -s "$OUT/metabase-db-$STAMP.sql.gz" ]]; then
    echo "backup FAILED: $OUT/metabase-db-$STAMP.sql.gz is empty" >&2
    exit 1
fi

find "$OUT" -name 'db-*.sql.gz' -mtime +$RETAIN_DAYS -delete
find "$OUT" -name 'uploads-*.tar.gz' -mtime +$RETAIN_DAYS -delete
find "$OUT" -name 'metabase-db-*.sql.gz' -mtime +$RETAIN_DAYS -delete
find "$OUT" -name 'roles-*.sql.gz' -mtime +$RETAIN_DAYS -delete

echo "backup ok: $(du -h "$OUT/db-$STAMP.sql.gz" | cut -f1) db, $(du -h "$OUT/uploads-$STAMP.tar.gz" | cut -f1) uploads$([[ -f "$OUT/metabase-db-$STAMP.sql.gz" ]] && echo ", $(du -h "$OUT/metabase-db-$STAMP.sql.gz" | cut -f1) metabase-db")"
