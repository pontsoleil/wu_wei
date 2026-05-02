#!/bin/sh
# publish-note.cgi
# POSIX sh CGI for publishing the latest note JSON.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1

mkdir -p "$SCRIPT_DIR/log" || exit 1
exec 2>>"$SCRIPT_DIR/log/cgi.err"

set -eu
export LC_ALL=C
export UNIX_STD=2003

if command -v getconf >/dev/null 2>&1; then
  PATH="./bin:$(command -p getconf PATH)${PATH+:$PATH}"
  export PATH
fi

Tmp=$(mktemp "/tmp/${0##*/}.XXXXXX") || exit 1
CGIVARS_ORG="${Tmp}-org"
CGIVARS="${Tmp}-cgivars"
ACK=$(printf '\006')

cleanup() {
  rm -f "$Tmp" "$CGIVARS_ORG" "$CGIVARS"
}
trap cleanup EXIT HUP INT TERM

error500_exit() {
  cat <<EOF
Status: 500 Internal Server Error
Content-Type: text/plain; charset=UTF-8

500 Internal Server Error
$*
EOF
  exit 1
}

error_exit() {
  cat <<EOF
Content-Type: text/plain; charset=UTF-8

ERROR $*
EOF
  exit 0
}

ok_response() {
  cat <<EOF
Content-Type: text/plain; charset=UTF-8

$1
EOF
  exit 0
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

restore_ack_to_space() {
  tr '\006' ' '
}

single_line_meta() {
  tr '\r\n\t' '   ' | sed 's/  */ /g; s/^ //; s/ $//'
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || error500_exit "COMMAND NOT FOUND: $1"
}

validate_id() {
  value=$1
  name=$2
  case "$value" in
    ''|ERROR*) error_exit "INVALID ${name}" ;;
    *[!A-Za-z0-9._-]*) error_exit "INVALID ${name}" ;;
  esac
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

require_cmd cgi-name
require_cmd nameread
require_cmd sed
require_cmd cp
require_cmd mkdir
require_cmd date
require_cmd mktemp
require_cmd base64

year=$(date '+%Y')
month=$(date '+%m')
saved_at=$(date '+%Y-%m-%dT%H:%M:%S%z')

qs=${QUERY_STRING:-}
body=""
cl=${CONTENT_LENGTH:-0}

if [ "${cl:-0}" -gt 0 ] 2>/dev/null; then
  body=$(dd bs="$cl" count=1 2>/dev/null || true)
fi

if [ -n "$qs" ] && [ -n "$body" ]; then
  printf '%s&%s' "$qs" "$body" > "$CGIVARS_ORG"
elif [ -n "$qs" ]; then
  printf '%s' "$qs" > "$CGIVARS_ORG"
elif [ -n "$body" ]; then
  printf '%s' "$body" > "$CGIVARS_ORG"
else
  : > "$CGIVARS_ORG"
fi

cgi-name -s"$ACK" < "$CGIVARS_ORG" > "$CGIVARS" \
  || error500_exit "FAILED TO PARSE REQUEST"

user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
note_id=$(nameread id "$CGIVARS" | strip_quotes || true)
name=$(nameread name "$CGIVARS" | strip_quotes || true)
description=$(nameread description "$CGIVARS" | strip_quotes || true)
thumbnail=$(nameread thumbnail "$CGIVARS" | strip_quotes || true)
json=$(nameread json "$CGIVARS" | strip_quotes || true)

validate_id "$user_id" "USER_ID"
validate_id "$note_id" "NOTE_ID"

note_dir=$(resolve_env_path note "$user_id" || true)
public_root=$(nameread public data/environment | strip_quotes || true)

[ -n "$note_dir" ] || error500_exit "NOTE DIRECTORY IS EMPTY"
[ -n "$public_root" ] || error500_exit "PUBLIC DIRECTORY IS EMPTY"

public_dir="${public_root}/${year}/${month}"
public_note="${public_dir}/${note_id}"
mkdir -p "$public_dir" || error500_exit "FAILED TO CREATE PUBLIC DIRECTORY"

if [ -n "${json:-}" ]; then
  name=$(printf '%s' "$name" | restore_ack_to_space | single_line_meta)
  description=$(printf '%s' "$description" | restore_ack_to_space | single_line_meta)
  thumbnail=$(printf '%s' "$thumbnail" | restore_ack_to_space | single_line_meta)
  json=$(printf '%s' "$json" | restore_ack_to_space | sed '1s/^\xEF\xBB\xBF//')

  json_base64=$(printf '%s' "$json" | base64 | tr -d '\n')
  [ -n "${json_base64:-}" ] || error500_exit "ERROR JSON ENCODE FAILED"

  {
    printf 'format_version 2\n'
    printf 'id %s\n' "$note_id"
    printf 'user_id %s\n' "$user_id"
    printf 'name %s\n' "$name"
    printf 'description %s\n' "$description"
    printf 'thumbnail %s\n' "$thumbnail"
    printf 'saved_at %s\n' "$saved_at"
    printf 'json_encoding base64\n'
    printf 'json_base64 %s\n' "$json_base64"
  } > "$public_note" || error500_exit "ERROR WHILE PUBLISHING NOTE"

  ok_response "${year}/${month}/${note_id}"
fi

note=$(find "$note_dir" \( -type f -name "$note_id" -o -type f -path "*/${note_id}/note.txt" \) -print 2>/dev/null | head -n 1)
[ -n "$note" ] && [ -f "$note" ] || error500_exit "NOTE NOT FOUND: ${note_id}"

cp "$note" "$public_note" || error500_exit "ERROR WHILE PUBLISHING NOTE"
ok_response "${year}/${month}/${note_id}"
