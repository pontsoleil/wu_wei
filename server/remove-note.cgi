#!/bin/sh
# remove-note.cgi
#
# Move a note to trash. Handles both complete notes
#   note/YYYY/MM/DD/{note_id}/note.txt
# and failed-save leftovers where only the {note_id}/ directory exists.

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
  msg=$1
  case "$msg" in ERROR*) text=$msg ;; *) text="ERROR $msg" ;; esac
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$text"
  exit 0
}

ok_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
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
  uid=$2
  tpl=$(nameread "$key" data/environment | strip_quotes || true)
  [ -n "$tpl" ] || return 1
  tpl=$(printf '%s' "$tpl" | sed "s#/\*/#/${uid}/#; s#\*#${uid}#")
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

find_note_target() {
  root=$1
  nid=$2

  if [ -d "$root/$nid" ] || [ -f "$root/$nid" ]; then
    printf '%s\n' "$root/$nid"
    return 0
  fi

  found=$(find "$root" \( -type d -o -type f \) -name "$nid" -print 2>/dev/null | head -n 1)
  if [ -n "$found" ]; then
    printf '%s\n' "$found"
    return 0
  fi

  found=$(find "$root" -type f -name note.txt -path "*/$nid/note.txt" -print 2>/dev/null | head -n 1)
  if [ -n "$found" ]; then
    dirname "$found"
    return 0
  fi

  return 1
}

read_request_params

session_user_id=$(is-login || true)
user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
[ -n "${user_id:-}" ] || user_id=$(raw_param user_id)

if [ -z "${session_user_id:-}" ] || [ -z "${user_id:-}" ] || [ "$user_id" != "$session_user_id" ]; then
  error_response 'ERROR NOT LOGGED IN'
fi
valid_simple_id "$user_id" || error_response 'ERROR INVALID USER'

note_id=$(nameread id "$CGIVARS" | strip_quotes || true)
[ -n "${note_id:-}" ] || note_id=$(raw_param id)
valid_simple_id "$note_id" || error_response 'ERROR INVALID NOTE'

note_dir=$(resolve_env_path note "$user_id" || true)
trash_base=$(resolve_env_path trash "$user_id" || true)
[ -n "${note_dir:-}" ] || error_response 'ERROR NOTE DIRECTORY NOT DEFINED'
[ -n "${trash_base:-}" ] || error_response 'ERROR TRASH DIRECTORY NOT DEFINED'
[ -d "$note_dir" ] || error_response 'ERROR NOTE DIRECTORY NOT FOUND'

note=$(find_note_target "$note_dir" "$note_id" || true)
[ -n "${note:-}" ] && [ -e "$note" ] || error_response 'ERROR NOTE NOT FOUND'

case "$note" in
  "$note_dir"/*|"$note_dir") ;;
  *) error_response 'ERROR INVALID NOTE PATH' ;;
esac

year=$(date '+%Y')
month=$(date '+%m')
trash_dir="$trash_base/$year/$month"
mkdir -p "$trash_dir" || error_response 'ERROR TRASH DIRECTORY CREATE FAILED'

dest="$trash_dir/${note_id}"
if [ -e "$dest" ]; then
  dest="$trash_dir/${note_id}.$(date '+%Y%m%d%H%M%S').$$"
fi

if mv "$note" "$dest"; then
  ok_response 'SUCCESS NOTE REMOVED'
fi

error_response 'ERROR WHILE REMOVING NOTE'
