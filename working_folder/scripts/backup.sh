#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/BACKUPS"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_PATH="$BACKUP_DIR/$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

tar --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='BACKUPS' \
    -czf "$ARCHIVE_PATH" \
    -C "$PROJECT_DIR" .

echo "Backup created: $ARCHIVE_PATH"

# Hoia alles ainult neli kõige värskemat koopiat
old_backups=$(ls -1t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +5 || true)
if [[ -n "$old_backups" ]]; then
  echo "$old_backups" | xargs -r rm --
fi
