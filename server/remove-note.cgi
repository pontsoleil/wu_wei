#!/bin/sh
# remove-note.cgi
#
# Move a note to trash. Handles both complete notes
#   note/YYYY/MM/DD/{note_id}/note.json
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

valid_note_key() {
  case "$1" in
    ''|/*|*..*|*//*|ERROR*) return 1 ;;
    *[!A-Za-z0-9._/-]*) return 1 ;;
    *) return 0 ;;
  esac
}

find_note_target() {
  root=$1
  nid=$2
  note_key=${3:-}
  found=
  count=

  # Preferred path: delete the exact note directory selected in the list.
  # list-note.cgi returns this as "note_key" (for example: YYYY/MM/DD/{note_id}).
  # "dir" is accepted only for backward compatibility.
  if [ -n "$note_key" ]; then
    case "$note_key" in
      */note.json) note_key=${note_key%/note.json} ;;
    esac
    key_base=$(basename "$note_key")
    if [ -n "$nid" ] && [ "$key_base" != "$nid" ]; then
      return 1
    fi
    if [ -d "$root/$note_key" ] && [ -f "$root/$note_key/note.json" ]; then
      printf '%s\n' "$root/$note_key"
      return 0
    fi
    return 1
  fi

  # Backward-compatible fallback for old callers that send only id.
  if [ -d "$root/$nid" ] || [ -f "$root/$nid" ]; then
    printf '%s\n' "$root/$nid"
    return 0
  fi

  found=$(find "$root" -type d -name "$nid" -exec test -f '{}/note.json' \; -print 2>/dev/null || true)
  count=$(printf '%s\n' "$found" | sed '/^$/d' | wc -l | tr -d '[:space:]')

  case "$count" in
    0)
      return 1
      ;;
    1)
      printf '%s\n' "$found"
      return 0
      ;;
    *)
      # Ambiguous id/name.  Do not guess with head -n 1.
      return 2
      ;;
  esac
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

note_key=$(nameread note_key "$CGIVARS" | strip_quotes || true)
[ -n "${note_key:-}" ] || note_key=$(nameread key "$CGIVARS" | strip_quotes || true)
[ -n "${note_key:-}" ] || note_key=$(nameread dir "$CGIVARS" | strip_quotes || true)
[ -n "${note_key:-}" ] || note_key=$(nameread path "$CGIVARS" | strip_quotes || true)
[ -n "${note_key:-}" ] || note_key=$(raw_param note_key)
[ -n "${note_key:-}" ] || note_key=$(raw_param key)
[ -n "${note_key:-}" ] || note_key=$(raw_param dir)
[ -n "${note_key:-}" ] || note_key=$(raw_param path)

# Backward compatibility: allow a dated path to arrive in id.
case "${note_id:-}" in
  */*)
    [ -n "${note_key:-}" ] || note_key=$note_id
    case "$note_id" in */note.json) note_id=${note_id%/note.json} ;; esac
    note_id=$(basename "$note_id")
    ;;
esac

[ -n "${note_id:-}${note_key:-}" ] || error_response 'ERROR NOTE NOT SPECIFIED'
if [ -n "${note_id:-}" ]; then
  valid_simple_id "$note_id" || error_response 'ERROR INVALID NOTE'
fi
if [ -n "${note_key:-}" ]; then
  valid_note_key "$note_key" || error_response 'ERROR INVALID NOTE KEY'
fi

note_dir=$(resolve_env_path note "$user_id" || true)
trash_base=$(resolve_env_path trash "$user_id" || true)
[ -n "${note_dir:-}" ] || error_response 'ERROR NOTE DIRECTORY NOT DEFINED'
[ -n "${trash_base:-}" ] || error_response 'ERROR TRASH DIRECTORY NOT DEFINED'
[ -d "$note_dir" ] || error_response 'ERROR NOTE DIRECTORY NOT FOUND'

set +e
note=$(find_note_target "$note_dir" "$note_id" "$note_key")
rc=$?
set -e
case "$rc" in
  0) ;;
  2) error_response 'ERROR NOTE ID NOT UNIQUE' ;;
  *) error_response 'ERROR NOTE NOT FOUND' ;;
esac
[ -n "${note:-}" ] && [ -e "$note" ] || error_response 'ERROR NOTE NOT FOUND'

case "$note" in
  "$note_dir"/*|"$note_dir") ;;
  *) error_response 'ERROR INVALID NOTE PATH' ;;
esac

year=$(date '+%Y')
month=$(date '+%m')
trash_dir="$trash_base/$year/$month"
mkdir -p "$trash_dir" || error_response 'ERROR TRASH DIRECTORY CREATE FAILED'

trash_name=${note_id:-$(basename "$note")}
dest="$trash_dir/${trash_name}"
if [ -e "$dest" ]; then
  dest="$trash_dir/${trash_name}.$(date '+%Y%m%d%H%M%S').$$"
fi

if mv "$note" "$dest"; then
  ok_response 'SUCCESS NOTE REMOVED'
fi

error_response 'ERROR WHILE REMOVING NOTE'
