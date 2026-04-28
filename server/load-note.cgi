#!/bin/sh
# WW_CGI_BOOTSTRAP: stabilise cwd under fcgiwrap and capture stderr
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1
mkdir -p log
exec 2>>"$SCRIPT_DIR/log/cgi.err"

set -eu
export LC_ALL=C

type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"
CGIVARS="${Tmp}-cgivars"

cleanup() {
  rm -f "$CGIVARS"
}
trap cleanup EXIT HUP INT TERM

exec 2>"$SCRIPT_DIR/log/${0##*/}.$$.log"

error_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
  exit 0
}

json_response() {
  printf '%s\r\n' 'Content-Type: application/json; charset=UTF-8'
  printf '\r\n'
  printf '%s' "$1"
  exit 0
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

resolve_env_path() {
  key=$1
  uid=${2:-}
  tpl=$(nameread "$key" data/environment | strip_quotes || true)
  [ -n "$tpl" ] || return 1
  if [ -n "$uid" ]; then
    tpl=$(printf '%s' "$tpl" | sed "s#/\*/#/${uid}/#; s#\*#${uid}#")
  fi
  case "$tpl" in
    /*) printf '%s\n' "$tpl" ;;
    wu_wei2/*) printf '%s/%s\n' "$(dirname "$SCRIPT_DIR")" "${tpl#wu_wei2/}" ;;
    *) printf '%s/%s\n' "$SCRIPT_DIR" "$tpl" ;;
  esac
}

# --- Collect CGI params from QUERY_STRING + POST body -------------------
qs=${QUERY_STRING:-}
body=""
cl=${CONTENT_LENGTH:-0}

if [ "${cl:-0}" -gt 0 ] 2>/dev/null; then
  body=$(cat || true)
fi

if [ -n "$qs" ] && [ -n "$body" ]; then
  printf '%s&%s' "$qs" "$body" | cgi-name > "$CGIVARS"
elif [ -n "$qs" ]; then
  printf '%s' "$qs" | cgi-name > "$CGIVARS"
elif [ -n "$body" ]; then
  printf '%s' "$body" | cgi-name > "$CGIVARS"
else
  : > "$CGIVARS"
fi

session_user_id=$(is-login || true)
user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
id=$(nameread id "$CGIVARS" | strip_quotes || true)

[ -n "${id:-}" ] || error_response 'ERROR ID NOT SPECIFIED'

if [ "_${user_id:-}" = '_dd99d0a5-566b-41cf-934d-127a89e13ba1' ] ||
   [ "_${user_id:-}" = '_0dbfa104-accd-4188-8b1b-f2e25d38e638' ]; then
  note_dir=$(resolve_env_path public || true)
else
  if [ -z "${session_user_id:-}" ] || [ -z "${user_id:-}" ] || [ "$user_id" != "$session_user_id" ]; then
    error_response 'ERROR NOT LOGGED IN'
  fi

  note_dir=$(resolve_env_path note "$user_id" || true)
  [ -d "$note_dir" ] || error_response 'ERROR NOTE DIRECTORY NOT FOUND'
fi

file="$note_dir/$id"
if [ ! -f "$file" ]; then
  file=$(find "$note_dir" -path "*/$id/note.json" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | sed 's/^[^ ]* //' | head -n 1)
fi
[ -f "$file" ] || error_response 'ERROR NOTE FILE NOT FOUND'

# New format: json_base64
json_base64=$(nameread json_base64 "$file" | strip_quotes || true)
if [ -n "${json_base64:-}" ]; then
  json=$(printf '%s' "$json_base64" | base64 -d 2>/dev/null || true)
  [ -n "${json:-}" ] || error_response 'ERROR JSON DECODE FAILED'
  bundle=$(nameread bundle "$CGIVARS" | strip_quotes || true)
  portable=$(nameread portable "$CGIVARS" | strip_quotes || true)
  if [ "$bundle" = 1 ] || [ "$bundle" = true ] || [ "$portable" = 1 ] || [ "$portable" = true ]; then
    if command -v python3 >/dev/null 2>&1; then
      bundled=$(printf '%s' "$json" | python3 - "$file" <<'PY' || true
import base64
import hashlib
import json
import mimetypes
import sys
from pathlib import Path

note_file = Path(sys.argv[1])
text = sys.stdin.read()
note = json.loads(text)
note_dir = note_file.parent
resource_root = note_dir / "resource"
files = []
resources = note.get("resources") if isinstance(note.get("resources"), list) else []
known_ids = {
    str(resource.get("id") or "")
    for resource in resources
    if isinstance(resource, dict) and str(resource.get("id") or "")
}
if resource_root.is_dir():
    for resource_dir in sorted(p for p in resource_root.iterdir() if p.is_dir()):
        rid = resource_dir.name
        if known_ids and rid not in known_ids:
            continue
        try:
            resource_doc = json.loads((resource_dir / "resource.json").read_text(encoding="utf-8", errors="strict"))
        except Exception:
            resource_doc = {}
        storage = resource_doc.get("storage") if isinstance(resource_doc.get("storage"), dict) else {}
        storage_files = storage.get("files") if isinstance(storage.get("files"), list) else []
        identity = resource_doc.get("identity") if isinstance(resource_doc.get("identity"), dict) else {}
        for item in storage_files:
            if not isinstance(item, dict) or str(item.get("role") or "original") != "original":
                continue
            source_hint = " ".join([
                str(item.get("sourcePath") or ""),
                str(item.get("path") or ""),
                str(identity.get("uri") or ""),
                str(identity.get("canonicalUri") or ""),
            ]).replace("\\", "/").lower()
            if "/upload/" not in source_hint:
                continue
            rel = str(item.get("path") or "").replace("\\", "/").strip("/")
            if not rel:
                continue
            path = resource_dir / rel
            if not path.is_file():
                continue
            payload = path.read_bytes()
            files.append({
                "resourceId": rid,
                "role": "original",
                "path": rel,
                "mimeType": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
                "size": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "base64": base64.b64encode(payload).decode("ascii"),
            })
note["portable"] = {"type": "wuwei.note.bundle", "version": 1, "files": files}
print(json.dumps(note, ensure_ascii=False, indent=2), end="")
PY
)
      [ -n "${bundled:-}" ] && json=$bundled
    fi
  fi
  json_response "$json"
fi

# Backward compatibility: old raw json line
json=$(nameread json "$file" | strip_quotes || true)
[ -n "${json:-}" ] || error_response 'ERROR JSON NOT FOUND'

# Repair old files that preserved ACK(0x06) in place of spaces.
json=$(printf '%s' "$json" | tr '\006' ' ' | tr -d '\000-\010\013\014\016-\037')
bundle=$(nameread bundle "$CGIVARS" | strip_quotes || true)
portable=$(nameread portable "$CGIVARS" | strip_quotes || true)
if [ "$bundle" = 1 ] || [ "$bundle" = true ] || [ "$portable" = 1 ] || [ "$portable" = true ]; then
  if command -v python3 >/dev/null 2>&1; then
    bundled=$(printf '%s' "$json" | python3 - "$file" <<'PY' || true
import base64
import hashlib
import json
import mimetypes
import sys
from pathlib import Path

note_file = Path(sys.argv[1])
text = sys.stdin.read()
note = json.loads(text)
note_dir = note_file.parent
resource_root = note_dir / "resource"
files = []
resources = note.get("resources") if isinstance(note.get("resources"), list) else []
known_ids = {
    str(resource.get("id") or "")
    for resource in resources
    if isinstance(resource, dict) and str(resource.get("id") or "")
}
if resource_root.is_dir():
    for resource_dir in sorted(p for p in resource_root.iterdir() if p.is_dir()):
        rid = resource_dir.name
        if known_ids and rid not in known_ids:
            continue
        try:
            resource_doc = json.loads((resource_dir / "resource.json").read_text(encoding="utf-8", errors="strict"))
        except Exception:
            resource_doc = {}
        storage = resource_doc.get("storage") if isinstance(resource_doc.get("storage"), dict) else {}
        storage_files = storage.get("files") if isinstance(storage.get("files"), list) else []
        identity = resource_doc.get("identity") if isinstance(resource_doc.get("identity"), dict) else {}
        for item in storage_files:
            if not isinstance(item, dict) or str(item.get("role") or "original") != "original":
                continue
            source_hint = " ".join([
                str(item.get("sourcePath") or ""),
                str(item.get("path") or ""),
                str(identity.get("uri") or ""),
                str(identity.get("canonicalUri") or ""),
            ]).replace("\\", "/").lower()
            if "/upload/" not in source_hint:
                continue
            rel = str(item.get("path") or "").replace("\\", "/").strip("/")
            if not rel:
                continue
            path = resource_dir / rel
            if not path.is_file():
                continue
            payload = path.read_bytes()
            files.append({
                "resourceId": rid,
                "role": "original",
                "path": rel,
                "mimeType": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
                "size": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "base64": base64.b64encode(payload).decode("ascii"),
            })
note["portable"] = {"type": "wuwei.note.bundle", "version": 1, "files": files}
print(json.dumps(note, ensure_ascii=False, indent=2), end="")
PY
)
    [ -n "${bundled:-}" ] && json=$bundled
  fi
fi
json_response "$json"

rm -f "$Tmp" "$Tmp"-*
exit 0
