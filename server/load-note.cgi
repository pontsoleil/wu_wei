#!/bin/sh
# load-note.cgi
#
# EC2 server CGI policy: shell/coreutils only. Portable/bundled note export is
# intentionally not assembled here; plain note JSON is returned.

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

read_request_params

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

json_base64=$(nameread json_base64 "$file" | strip_quotes || true)
if [ -n "${json_base64:-}" ]; then
  json=$(printf '%s' "$json_base64" | base64 -d 2>/dev/null || true)
  [ -n "${json:-}" ] || error_response 'ERROR JSON DECODE FAILED'
  json_response "$json"
fi

json=$(nameread json "$file" | strip_quotes || true)
[ -n "${json:-}" ] || error_response 'ERROR JSON NOT FOUND'
json=$(printf '%s' "$json" | tr '\006' ' ' | tr -d '\000-\010\013\014\016-\037')
json_response "$json"
