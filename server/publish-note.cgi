#!/bin/sh
# publish-note.cgi
# POSIX sh CGI for publishing a note JSON.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1

mkdir -p "$SCRIPT_DIR/log" 2>/dev/null || :
if ( : >> "$SCRIPT_DIR/log/cgi.err" ) 2>/dev/null; then
  exec 2>>"$SCRIPT_DIR/log/cgi.err"
else
  exec 2>/dev/null
fi

set -u
export LC_ALL=C
export UNIX_STD=2003

if command -v getconf >/dev/null 2>&1; then
  PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
  export PATH
fi

Tmp="/tmp/${0##*/}.$$"
CGIVARS_ORG="${Tmp}-org"
CGIVARS="${Tmp}-cgivars"
JSON_FILE="${Tmp}-json"
BODY_FILE="${Tmp}-body"
ACK=$(printf '\006')

cleanup() {
  rm -f "$CGIVARS_ORG" "$CGIVARS" "$JSON_FILE" "$BODY_FILE"
}
trap cleanup EXIT HUP INT TERM

text_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
  exit 0
}

error_response() {
  text_response "ERROR $1"
}

internal_error() {
  text_response "500 Internal Server Error
$1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || internal_error "COMMAND NOT FOUND: $1"
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

restore_ack_to_space() {
  tr '\006' ' '
}

validate_id() {
  value=$1
  name=$2
  case "$value" in
    ''|ERROR*) error_response "INVALID ${name}" ;;
  esac
  printf '%s' "$value" | grep -Eq '^[A-Za-z0-9._-]+$' ||
    error_response "INVALID ${name}"
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
  cl=${CONTENT_LENGTH:-0}

  if [ "${cl:-0}" -gt 0 ] 2>/dev/null; then
    cat > "$BODY_FILE" || internal_error "FAILED TO READ REQUEST BODY"
  else
    : > "$BODY_FILE"
  fi

  if [ -n "$qs" ] && [ -s "$BODY_FILE" ]; then
    printf '%s&' "$qs" > "$CGIVARS_ORG"
    cat "$BODY_FILE" >> "$CGIVARS_ORG"
  elif [ -n "$qs" ]; then
    printf '%s' "$qs" > "$CGIVARS_ORG"
  elif [ -s "$BODY_FILE" ]; then
    cat "$BODY_FILE" > "$CGIVARS_ORG"
  else
    : > "$CGIVARS_ORG"
  fi

  form_length=$(wc -c < "$CGIVARS_ORG" | tr -d ' ')
  CONTENT_LENGTH=$form_length cgi-name -s"$ACK" < "$CGIVARS_ORG" > "$CGIVARS" ||
    internal_error "FAILED TO PARSE REQUEST"
}

ensure_note_json_file() {
  file=$1
  awk '
    BEGIN { RS=""; ok = 1 }
    {
      s = $0
      sub(/^\xef\xbb\xbf/, "", s)
      sub(/^[ \t\r\n]*/, "", s)
      sub(/[ \t\r\n]*$/, "", s)
      if (s !~ /^\{/) ok = 0
      if (s !~ /"pages"[ \t\r\n]*:[ \t\r\n]*\[/) ok = 0
      if (s ~ /"resources"[ \t\r\n]*:/ && s !~ /"resources"[ \t\r\n]*:[ \t\r\n]*\[/) ok = 0
    }
    END { exit(ok ? 0 : 1) }
  ' "$file"
}

resolve_note_file() {
  note_root=$1
  note_id=$2

  if [ -f "$note_root/$note_id" ]; then
    printf '%s\n' "$note_root/$note_id"
    return 0
  fi

  if [ -f "$note_root/$note_id/note.json" ]; then
    printf '%s\n' "$note_root/$note_id/note.json"
    return 0
  fi

  find "$note_root" \( -type f -name "$note_id" -o -type f -path "*/${note_id}/note.json" \) -print 2>/dev/null |
    head -n 1
}

require_cmd cgi-name
require_cmd nameread
require_cmd sed
require_cmd awk
require_cmd cp
require_cmd mkdir
require_cmd date
require_cmd find
require_cmd grep
require_cmd head
require_cmd tr
require_cmd wc

read_request_params

user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
note_id=$(nameread id "$CGIVARS" | strip_quotes || true)
json=$(nameread json "$CGIVARS" | strip_quotes || true)

validate_id "$user_id" "USER_ID"
validate_id "$note_id" "NOTE_ID"

note_dir=$(resolve_env_path note "$user_id" || true)
public_root=$(resolve_env_path public || true)

[ -n "$note_dir" ] || internal_error "FAILED TO READ NOTE DIRECTORY"
[ -n "$public_root" ] || internal_error "FAILED TO READ PUBLIC DIRECTORY"

year=$(date '+%Y')
month=$(date '+%m')
public_dir="${public_root}/${year}/${month}"
public_note="${public_dir}/${note_id}"

mkdir -p "$public_dir" || internal_error "FAILED TO CREATE PUBLIC DIRECTORY"

if [ -n "${json:-}" ]; then
  printf '%s' "$json" | restore_ack_to_space > "$JSON_FILE"
  ensure_note_json_file "$JSON_FILE" || error_response "NOTE JSON MUST BE OBJECT WITH PAGES ARRAY"
  printf '\n' >> "$JSON_FILE"
  cp "$JSON_FILE" "$public_note" || internal_error "ERROR WHILE PUBLISHING NOTE"
  text_response "${year}/${month}/${note_id}"
fi

note=$(resolve_note_file "$note_dir" "$note_id" || true)
[ -n "${note:-}" ] && [ -f "$note" ] || internal_error "NOTE NOT FOUND: ${note_id}"

cp "$note" "$public_note" || internal_error "ERROR WHILE PUBLISHING NOTE"
text_response "${year}/${month}/${note_id}"
