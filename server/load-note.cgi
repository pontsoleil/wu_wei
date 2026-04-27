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
  body=$(dd bs="$cl" count=1 2>/dev/null || true)
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
  file=$(find "$note_dir" -path "*/$id/note.json" -type f | head -n 1)
fi
[ -f "$file" ] || error_response 'ERROR NOTE FILE NOT FOUND'

# New format: json_base64
json_base64=$(nameread json_base64 "$file" | strip_quotes || true)
if [ -n "${json_base64:-}" ]; then
  json=$(printf '%s' "$json_base64" | base64 -d 2>/dev/null || true)
  [ -n "${json:-}" ] || error_response 'ERROR JSON DECODE FAILED'
  json_response "$json"
fi

# Backward compatibility: old raw json line
json=$(nameread json "$file" | strip_quotes || true)
[ -n "${json:-}" ] || error_response 'ERROR JSON NOT FOUND'

# Repair old files that preserved ACK(0x06) in place of spaces.
json=$(printf '%s' "$json" | tr '\006' ' ' | tr -d '\000-\010\013\014\016-\037')
json_response "$json"

rm -f "$Tmp" "$Tmp"-*
exit 0
