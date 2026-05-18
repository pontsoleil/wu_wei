#!/bin/sh
# load-note-v1.cgi
#
# Return the decoded JSON body from an app ver1 note file.  Model migration is
# handled in the browser by wuwei.note.v1.js.

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
JSON_OUT="${Tmp}-json"

cleanup() {
  rm -f "$CGIVARS" "$JSON_OUT" "$Tmp"-*
}
trap cleanup EXIT HUP INT TERM

error_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
  exit 0
}

json_response_file() {
  printf '%s\r\n' 'Content-Type: application/json; charset=UTF-8'
  printf '\r\n'
  cat "$1"
  exit 0
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

decode_minimal() {
  sed 's/+/ /g; s/%2[Ff]/\//g; s/%2[Dd]/-/g; s/%5[Ff]/_/g; s/%40/@/g'
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


raw_param() {
  key=$1
  printf '%s' "${QUERY_STRING:-}" |
    tr '&' '\n' |
    sed -n "s/^${key}=//p" |
    head -n 1 |
    decode_minimal
}

valid_simple_id() {
  case "$1" in
    ''|*/*|*..*|ERROR*) return 1 ;;
    *[!A-Za-z0-9._-]*) return 1 ;;
    *) return 0 ;;
  esac
}

valid_note_key() {
  case "$1" in
    ''|/*|*..*|*//*|ERROR*|*/note.json) return 1 ;;
    *[!A-Za-z0-9._/-]*) return 1 ;;
    *) return 0 ;;
  esac
}

normalise_note_key() {
  key=$1
  key=$(printf '%s' "$key" | sed 's#\\#/#g; s#^/*##; s#/*$##')
  case "$key" in
    */note.json) key= ;;
  esac
  printf '%s\n' "$key"
}

read_request_params() {
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
}

find_v1_note_file() {
  root=$1
  nid=${2:-}
  note_key=${3:-}

  if [ -n "$note_key" ]; then
    note_key=$(normalise_note_key "$note_key")
    valid_note_key "$note_key" || return 3
    key_base=$(basename "$note_key")
    if [ -n "$nid" ] && [ "$key_base" != "$nid" ]; then
      # The metadata id can still match, so leave final mismatch detection to JS/user.
      :
    fi
    if [ -f "$root/$note_key" ] && [ "${note_key##*/}" != 'note.json' ]; then
      printf '%s\n' "$root/$note_key"
      return 0
    fi
    return 1
  fi

  [ -n "$nid" ] || return 1
  valid_simple_id "$nid" || return 3

  if [ -f "$root/$nid" ]; then
    printf '%s\n' "$root/$nid"
    return 0
  fi

  found=$(find "$root" -type f ! -name note.json -name "$nid" -printf '%T@ %p\n' 2>/dev/null | sort -rn | sed 's/^[^ ]* //' || true)
  count=$(printf '%s\n' "$found" | sed '/^$/d' | wc -l | tr -d '[:space:]')
  case "$count" in
    0) return 1 ;;
    1) printf '%s\n' "$found"; return 0 ;;
    *) return 2 ;;
  esac
}

decode_ver1_json() {
  file=$1
  python3 - "$file" > "$JSON_OUT" <<'PY'
import base64, sys
from pathlib import Path
from urllib.parse import unquote_plus
path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8', errors='ignore').lstrip('\ufeff')
if text.strip().startswith('{'):
    print(text.strip(), end='')
    raise SystemExit(0)
values = {}
for raw in text.splitlines():
    line = raw.rstrip('\r\n')
    if not line or line.lstrip().startswith('#'):
        continue
    if ' ' in line:
        k, v = line.split(' ', 1)
    elif '=' in line:
        k, v = line.split('=', 1)
    else:
        continue
    values[k.strip()] = v.strip().strip('"')
if values.get('json_base64'):
    print(base64.b64decode(values['json_base64'].encode('ascii')).decode('utf-8'), end='')
elif values.get('json'):
    print(unquote_plus(values['json']), end='')
else:
    raise SystemExit('ERROR VER1 JSON NOT FOUND')
PY
}

read_request_params

session_user_id=$(is-login || true)
user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
[ -n "${user_id:-}" ] || user_id=$(raw_param user_id)

id=$(nameread id "$CGIVARS" | strip_quotes || true)
[ -n "${id:-}" ] || id=$(raw_param id)

note_key=$(nameread note_key "$CGIVARS" | strip_quotes || true)
[ -n "${note_key:-}" ] || note_key=$(nameread key "$CGIVARS" | strip_quotes || true)
[ -n "${note_key:-}" ] || note_key=$(nameread dir "$CGIVARS" | strip_quotes || true)
[ -n "${note_key:-}" ] || note_key=$(nameread path "$CGIVARS" | strip_quotes || true)
[ -n "${note_key:-}" ] || note_key=$(raw_param note_key)
[ -n "${note_key:-}" ] || note_key=$(raw_param key)
[ -n "${note_key:-}" ] || note_key=$(raw_param dir)
[ -n "${note_key:-}" ] || note_key=$(raw_param path)

case "${id:-}" in
  */*)
    [ -n "${note_key:-}" ] || note_key=$id
    id=$(basename "$(normalise_note_key "$id")")
    ;;
esac

[ -n "${id:-}${note_key:-}" ] || error_response 'ERROR NOTE NOT SPECIFIED'
if [ -n "${id:-}" ]; then
  valid_simple_id "$id" || error_response 'ERROR INVALID ID'
fi
if [ -n "${note_key:-}" ]; then
  note_key=$(normalise_note_key "$note_key")
  valid_note_key "$note_key" || error_response 'ERROR INVALID NOTE KEY'
fi

if [ "_${user_id:-}" = '_dd99d0a5-566b-41cf-934d-127a89e13ba1' ] ||
   [ "_${user_id:-}" = '_0dbfa104-accd-4188-8b1b-f2e25d38e638' ] ||
   [ "_${user_id:-}" = '_guest' ] ||
   [ "_${user_id:-}" = '_data' ]; then
  note_dir=$(resolve_env_path public || true)
else
  if [ -z "${session_user_id:-}" ] || [ -z "${user_id:-}" ] || [ "$user_id" != "$session_user_id" ]; then
    error_response 'ERROR NOT LOGGED IN'
  fi
  note_dir=$(resolve_env_path note "$user_id" || true)
fi

[ -n "${note_dir:-}" ] || error_response 'ERROR NOTE DIRECTORY NOT FOUND'
current_note_dir=$note_dir

# Legacy v1 note files are expected to be copied under the current data
# directory: wu_wei2/data/{user_id}/note/YYYY/MM/{note_id}.
# Do not search the old nginx alias directory ({user_id}/note/...).
set +e
file=$(find_v1_note_file "$current_note_dir" "${id:-}" "${note_key:-}")
rc=$?
set -e
case "$rc" in
  0) ;;
  2) error_response 'ERROR NOTE ID NOT UNIQUE' ;;
  3) error_response 'ERROR INVALID NOTE KEY' ;;
  *) error_response 'ERROR VER1 NOTE FILE NOT FOUND' ;;
esac

[ -f "$file" ] || error_response 'ERROR VER1 NOTE FILE NOT FOUND'
case "$file" in
  "$current_note_dir"/*|"$current_note_dir") ;;
  *) error_response 'ERROR INVALID NOTE PATH' ;;
esac
case "$file" in
  */note.json) error_response 'ERROR NOT VER1 NOTE' ;;
esac

if ! decode_ver1_json "$file"; then
  error_response 'ERROR VER1 JSON NOT FOUND'
fi
json_response_file "$JSON_OUT"
