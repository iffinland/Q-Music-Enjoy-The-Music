#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/BACKUPS"

usage() {
  cat <<'EOF'
Kasutus: scripts/restore.sh [faili_nimi_voi_taht]

Ilma argumendita küsitakse interaktiivselt, millist varukoopiat taastada.
Võib anda kas täisraja või BACKUPS kataloogis oleva faili nime.
EOF
}

choose_backup() {
  local input="${1:-}"
  local files

  IFS=$'\n' read -r -d '' -a files < <(ls -1t "$BACKUP_DIR"/*.tar.gz 2>/dev/null && printf '\0') || true

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "Viga: BACKUPS kaustas pole ühtegi varukoopiat." >&2
    exit 1
  fi

  if [[ -n "$input" ]]; then
    if [[ -f "$input" ]]; then
      echo "$input"
      return
    fi
    if [[ -f "$BACKUP_DIR/$input" ]]; then
      echo "$BACKUP_DIR/$input"
      return
    fi
    echo "Viga: ei leidnud varukopia faili: $input" >&2
    exit 1
  fi

  echo "Vali taastatav varukoopia (uuemad ees):" >&2
  local i=1
  for f in "${files[@]}"; do
    echo "  $i) $(basename "$f")" >&2
    ((i++))
  done

  local choice
  while true; do
    printf "Sisesta number [1]: " >&2
    read -r choice
    choice=${choice:-1}
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#files[@]} )); then
      echo "${files[$((choice-1))]}"
      return
    fi
    echo "Palun vali number vahemikus 1..${#files[@]}." >&2
  done
}

create_safety_backup() {
  mkdir -p "$BACKUP_DIR"
  local ts="pre-restore-$(date +%Y%m%d-%H%M%S)"
  local out="$BACKUP_DIR/$ts.tar.gz"
  tar --exclude='.git' \
      --exclude='node_modules' \
      --exclude='dist' \
      --exclude='BACKUPS' \
      -czf "$out" \
      -C "$PROJECT_DIR" .
  echo "Loodud enne-taastamist varukoopia: $out"
}

restore_from_backup() {
  local backup_path="$1"
  local tmpdir=""

  tmpdir="$(mktemp -d)"
  trap '[[ -n "${tmpdir:-}" ]] && rm -rf "$tmpdir"' EXIT

  echo "Lahtipakkimine: $backup_path"
  tar -xzf "$backup_path" -C "$tmpdir"

  echo "Sünkroonin varukoopia projekti kausta (kustutab vahepeal lisatud failid, hoiab BACKUPS alles)."
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --exclude 'BACKUPS' "$tmpdir"/ "$PROJECT_DIR"/
  else
    echo "Hoiatus: rsync puudub, kasutan Python fallback'i." >&2
    TMPDIR_SRC="$tmpdir" PROJECT_DST="$PROJECT_DIR" python3 - <<'PY'
import os, shutil
src = os.environ["TMPDIR_SRC"]
dst = os.environ["PROJECT_DST"]
keep_roots = {"BACKUPS"}

def rel(path, base):
    r = os.path.relpath(path, base)
    return "." if r == "." else r

source_paths = set()
for root, dirs, files in os.walk(src):
    rel_root = rel(root, src)
    for d in dirs:
        source_paths.add(os.path.join(rel_root, d) if rel_root != "." else d)
    for f in files:
        source_paths.add(os.path.join(rel_root, f) if rel_root != "." else f)

# Copy/update
for root, dirs, files in os.walk(src):
    rel_root = rel(root, src)
    dest_root = dst if rel_root == "." else os.path.join(dst, rel_root)
    os.makedirs(dest_root, exist_ok=True)
    for d in dirs:
        os.makedirs(os.path.join(dest_root, d), exist_ok=True)
    for f in files:
        shutil.copy2(os.path.join(root, f), os.path.join(dest_root, f))

# Delete extras (protect keep_roots)
for root, dirs, files in os.walk(dst, topdown=False):
    rel_root = rel(root, dst)
    head = None if rel_root == "." else rel_root.split(os.sep)[0]
    if head in keep_roots:
        continue
    for f in files:
        rel_path = f if rel_root == "." else os.path.join(rel_root, f)
        if rel_path.split(os.sep)[0] in keep_roots:
            continue
        if rel_path not in source_paths:
            os.remove(os.path.join(root, f))
    for d in dirs:
        rel_path = d if rel_root == "." else os.path.join(rel_root, d)
        if rel_path.split(os.sep)[0] in keep_roots:
            continue
        if rel_path not in source_paths:
            shutil.rmtree(os.path.join(root, d))
PY
  fi

  echo "Taastamine valmis. Soovitus: käivita npm install && npm run build."
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  mkdir -p "$BACKUP_DIR"

  local backup_path
  backup_path="$(choose_backup "${1:-}")"

  create_safety_backup
  restore_from_backup "$backup_path"
}

main "$@"
