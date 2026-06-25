#!/usr/bin/env bash
#
# Back up the ReFx Business Manager data: the SQLite database file and the
# /uploads media+documents folder, into a single timestamped tarball with the
# layout  refx-data/{prisma/dev.db, uploads/...}.
#
# Usage:   ./scripts/backup.sh [output-dir]      (default: ./backups)
#
# Restore: stop the app, then from the project root:
#   tar -xzf backups/refx-backup-YYYYMMDD-HHMMSS.tar.gz
#   cp -r refx-data/prisma/dev.db prisma/dev.db
#   cp -r refx-data/uploads ./uploads
#   (restart the app)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT/backups}"
mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$OUT_DIR/refx-backup-$STAMP.tar.gz"

# Derive the SQLite file path from DATABASE_URL (defaults to prisma/dev.db).
DB_FILE="prisma/dev.db"
if [ -f "$ROOT/.env" ]; then
  URL="$(grep -E '^DATABASE_URL=' "$ROOT/.env" | head -1 | sed -E 's/^DATABASE_URL=//; s/"//g')"
  case "$URL" in
    file:*) DB_FILE="prisma/${URL#file:./}" ;;
  esac
fi

cd "$ROOT"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/refx-data/$(dirname "$DB_FILE")"

if command -v sqlite3 >/dev/null 2>&1 && [ -f "$DB_FILE" ]; then
  # Online backup — safe even while the app is running.
  sqlite3 "$DB_FILE" ".backup '$STAGE/refx-data/$DB_FILE'"
elif [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$STAGE/refx-data/$DB_FILE"
fi

[ -d uploads ] && cp -r uploads "$STAGE/refx-data/uploads"

tar -czf "$ARCHIVE" -C "$STAGE" refx-data
echo "Backed up DB ($DB_FILE) + uploads/ -> $ARCHIVE"
