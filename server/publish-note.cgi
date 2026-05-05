#!/bin/bash
# publish-note.cgi
#
# Normal mode:
#   stderr is appended only to:
#     log/cgi.err
#
# Debug mode:
#   create the following flag file, then call this CGI:
#     log/.debug.publish-note.cgi
#
#   In debug mode, stderr is written to both:
#     log/cgi.err
#     log/publish-note.cgi.<pid>.log

# WW_CGI_BOOTSTRAP: stabilise cwd under fcgiwrap
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1

mkdir -p "$SCRIPT_DIR/log"

REQLOG=""
DEBUG_FILE="$SCRIPT_DIR/log/.debug.${0##*/}"

if [ -f "$DEBUG_FILE" ]; then
  REQLOG="$SCRIPT_DIR/log/${0##*/}.$$.log"
  # stderr -> both cgi.err and per-request log
  exec 2> >(tee -a "$SCRIPT_DIR/log/cgi.err" >>"$REQLOG")
  set -eu
  DEBUG=1
else
  # stderr -> cgi.err only
  exec 2>>"$SCRIPT_DIR/log/cgi.err"
  set -eu
  DEBUG=0
fi

export LC_ALL=C

type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"
CGIVARS="${Tmp}-cgivars"
CGIVARS_ORG="${Tmp}-cgivars-org"
JSON_FILE="${Tmp}-note-data"

cleanup() {
  rm -f "$CGIVARS" "$CGIVARS_ORG" "$JSON_FILE"
}
trap cleanup EXIT HUP INT TERM

year=$(date '+%Y')
month=$(date '+%m')
ACK=$(printf '\006')

error_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
  exit 0
}

ok_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
  exit 0
}

debug_log() {
  [ "${DEBUG:-0}" = "1" ] || return 0
  printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >&2
}

debug_preview() {
  label=$1
  value=$2
  [ "${DEBUG:-0}" = "1" ] || return 0
  len=$(printf '%s' "$value" | wc -c | tr -d ' ')
  head=$(printf '%s' "$value" | head -c 240 | tr '\r\n\t' '   ')
  printf '[%s] %s_len=%s %s_head=%s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$label" "$len" "$label" "$head" >&2
}

raw_form_value() {
  key=$1
  file=$2
  [ -f "$file" ] || return 0
  tr '&' '\n' < "$file" |
  sed -n "s/^${key}=//p" |
  head -n 1 |
  sed 's/+/ /g; s/%2[Dd]/-/g; s/%5[Ff]/_/g; s/%40/@/g'
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
    ''|ERROR*) error_response "ERROR INVALID ${name}" ;;
    *[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-]*)
      error_response "ERROR INVALID ${name}"
      ;;
  esac
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

ensure_note_json_file() {
  json_file=$1

  [ -s "$json_file" ] || {
    printf 'publish_note_json_error=JSON NOT SPECIFIED\n' >&2
    return 1
  }

  # publish-note.py validates full JSON. The EC2 shell version keeps this
  # deliberately small: require a JSON object with pages array, and ensure
  # resources, if present, is also an array.
  if ! grep -q '^[[:space:]]*{' "$json_file"; then
    printf 'publish_note_json_error=NOTE JSON MUST BE OBJECT\n' >&2
    return 1
  fi
  if ! grep -q '"pages"[[:space:]]*:[[:space:]]*\[' "$json_file"; then
    printf 'publish_note_json_error=NOTE JSON PAGES MUST BE ARRAY\n' >&2
    return 1
  fi
  if grep -q '"resources"[[:space:]]*:' "$json_file" &&
     ! grep -q '"resources"[[:space:]]*:[[:space:]]*\[' "$json_file"; then
    printf 'publish_note_json_error=NOTE JSON RESOURCES MUST BE ARRAY\n' >&2
    return 1
  fi

  return 0
}

normalize_json_structural_escapes() {
  # cgi-name may preserve form-field newlines as literal "\n". In JSON this is
  # valid only inside strings; outside strings it breaks JSON.parse. Convert
  # escaped whitespace only while the scanner is outside JSON strings.
  awk '
    BEGIN { ORS = ""; in_s = 0; esc = 0 }
    {
      line = $0
      for (i = 1; i <= length(line); i++) {
        c = substr(line, i, 1)
        n = substr(line, i + 1, 1)

        if (in_s) {
          printf "%s", c
          if (esc) {
            esc = 0
          } else if (c == "\\") {
            esc = 1
          } else if (c == "\"") {
            in_s = 0
          }
          continue
        }

        if (c == "\"") {
          in_s = 1
          printf "%s", c
          continue
        }

        if (c == "\\" && n == "n") {
          printf "\n"
          i++
        } else if (c == "\\" && n == "r") {
          i++
        } else if (c == "\\" && n == "t") {
          printf "\t"
          i++
        } else {
          printf "%s", c
        }
      }
      if (NR > 1) {
        printf "\n"
      }
    }
  '
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

# --- Collect CGI params from QUERY_STRING + POST body -------------------
qs=${QUERY_STRING:-}
body=""
cl=${CONTENT_LENGTH:-0}

if [ "${cl:-0}" -gt 0 ] 2>/dev/null; then
  # FastCGI provides exactly the request body on stdin. A single large
  # dd block can return a short read from a pipe, so read until EOF.
  body=$(cat || true)
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

# Keep save-note.cgi-compatible parsing. It is proven on EC2/fcgiwrap.
cgi-name -s"$ACK" < "$CGIVARS_ORG" > "$CGIVARS"

user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
[ -n "${user_id:-}" ] || user_id=$(raw_form_value user_id "$CGIVARS_ORG" | strip_quotes || true)
note_id=$(nameread id "$CGIVARS" | strip_quotes || true)
[ -n "${note_id:-}" ] || note_id=$(raw_form_value id "$CGIVARS_ORG" | strip_quotes || true)
json=$(nameread json "$CGIVARS" | strip_quotes || true)

debug_log "request user_id=${user_id:-} id=${note_id:-} content_length=${CONTENT_LENGTH:-0}"
debug_preview "json_raw" "$json"

validate_id "$user_id" "USER_ID"
validate_id "$note_id" "NOTE_ID"

note_dir=$(resolve_env_path note "$user_id" || true)
public_root=$(resolve_env_path public || true)

[ -n "${note_dir:-}" ] || error_response '500 Internal Server Error
FAILED TO READ NOTE DIRECTORY'
[ -n "${public_root:-}" ] || error_response '500 Internal Server Error
FAILED TO READ PUBLIC DIRECTORY'

public_dir="${public_root}/${year}/${month}"
public_note="${public_dir}/${note_id}"
mkdir -p "$public_dir" || error_response '500 Internal Server Error
FAILED TO CREATE PUBLIC DIRECTORY'

if [ -n "${json:-}" ]; then
  json=$(printf '%s' "$json" | restore_ack_to_space)
  json=$(printf '%s' "$json" | sed '1s/^\xEF\xBB\xBF//')
  json=$(printf '%s' "$json" | normalize_json_structural_escapes)
  debug_preview "json" "$json"

  printf '%s' "$json" > "$JSON_FILE"
  ensure_note_json_file "$JSON_FILE" || error_response 'ERROR NOTE JSON MUST BE OBJECT WITH PAGES ARRAY'
  printf '\n' >> "$JSON_FILE"
  cp "$JSON_FILE" "$public_note" || error_response '500 Internal Server Error
ERROR WHILE PUBLISHING NOTE'
  ok_response "${year}/${month}/${note_id}"
fi

note=$(resolve_note_file "$note_dir" "$note_id" || true)
[ -n "${note:-}" ] && [ -f "$note" ] || error_response "500 Internal Server Error
NOTE NOT FOUND: ${note_id}"

cp "$note" "$public_note" || error_response '500 Internal Server Error
ERROR WHILE PUBLISHING NOTE'
ok_response "${year}/${month}/${note_id}"

rm -f "$Tmp" "$Tmp"-*
exit 0
