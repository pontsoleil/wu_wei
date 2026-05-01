#!/bin/bash
# export-note.cgi
#
# Build a portable note ZIP on demand:
#   note.json
#   upload/YYYY/MM/DD/{upload_uuid}/...
#
# Normal save/load stays reference-only. This endpoint collects referenced
# upload directories only when the user explicitly downloads a note bundle.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1

mkdir -p "$SCRIPT_DIR/log"
exec 2>>"$SCRIPT_DIR/log/cgi.err"
set -eu

export LC_ALL=C
type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"
CGIVARS="${Tmp}-cgivars"
BUNDLE_DIR="${Tmp}-bundle"
NOTE_JSON="${Tmp}-note.json"
REFS="${Tmp}-upload-refs"
ZIP_FILE="${Tmp}.zip"

cleanup() {
  rm -f "$CGIVARS" "$NOTE_JSON" "$REFS" "$ZIP_FILE"
  rm -rf "$BUNDLE_DIR"
}
trap cleanup EXIT HUP INT TERM

error_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
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

read_note_json() {
  note_file=$1
  json_base64=$(nameread json_base64 "$note_file" | strip_quotes || true)
  if [ -n "${json_base64:-}" ]; then
    printf '%s' "$json_base64" | base64 -d 2>/dev/null || return 1
    return 0
  fi

  json=$(nameread json "$note_file" | strip_quotes || true)
  [ -n "${json:-}" ] || return 1
  printf '%s' "$json" | tr '\006' ' ' | tr -d '\000-\010\013\014\016-\037'
}

archive_create() {
  src_dir=$1
  out_file=$2
  if command -v zip >/dev/null 2>&1; then
    (cd "$src_dir" && zip -qr "$out_file" .)
    return $?
  fi
  if command -v jar >/dev/null 2>&1; then
    (cd "$src_dir" && jar cf "$out_file" . >/dev/null 2>&1)
    return $?
  fi
  return 1
}

header_filename() {
  value=$1
  printf '%s' "$value" | tr -c 'A-Za-z0-9._-' '_'
}

read_request_params

session_user_id=$(is-login || true)
user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
id=$(nameread id "$CGIVARS" | strip_quotes || true)

[ -n "${id:-}" ] || error_response 'ERROR ID NOT SPECIFIED'

if [ -z "${session_user_id:-}" ] || [ -z "${user_id:-}" ] || [ "$user_id" != "$session_user_id" ]; then
  error_response 'ERROR NOT LOGGED IN'
fi

note_dir=$(resolve_env_path note "$user_id" || true)
upload_dir=$(resolve_env_path upload "$user_id" || true)
[ -d "${note_dir:-}" ] || error_response 'ERROR NOTE DIRECTORY NOT FOUND'
[ -d "${upload_dir:-}" ] || error_response 'ERROR UPLOAD DIRECTORY NOT FOUND'

note_file="$note_dir/$id"
if [ ! -f "$note_file" ]; then
  note_file=$(find "$note_dir" -path "*/$id/note.json" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | sed 's/^[^ ]* //' | head -n 1)
fi
[ -f "$note_file" ] || error_response 'ERROR NOTE FILE NOT FOUND'

mkdir -p "$BUNDLE_DIR/upload"
read_note_json "$note_file" > "$NOTE_JSON" || error_response 'ERROR NOTE JSON NOT FOUND'
cp "$NOTE_JSON" "$BUNDLE_DIR/note.json" || error_response 'ERROR NOTE COPY FAILED'

grep -Eo '[0-9]{4}/[0-9]{2}/[0-9]{2}/_[0-9A-Fa-f-]+' "$NOTE_JSON" | sort -u > "$REFS" || true
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  case "$rel" in
    *..*|/*) continue ;;
  esac
  src="$upload_dir/$rel"
  [ -d "$src" ] || continue
  dst="$BUNDLE_DIR/upload/$rel"
  mkdir -p "$(dirname "$dst")" || error_response 'ERROR BUNDLE DIRECTORY CREATE FAILED'
  cp -R "$src" "$dst" || error_response 'ERROR BUNDLE UPLOAD COPY FAILED'
done < "$REFS"

archive_create "$BUNDLE_DIR" "$ZIP_FILE" || error_response 'ERROR ZIP COMMAND NOT FOUND'
[ -s "$ZIP_FILE" ] || error_response 'ERROR ZIP CREATE FAILED'

bytes=$(wc -c < "$ZIP_FILE" | tr -d ' ')
filename="$(header_filename "${id}.zip")"
printf '%s\r\n' 'Content-Type: application/zip'
printf '%s\r\n' 'Cache-Control: no-store'
printf 'Content-Disposition: attachment; filename="%s"\r\n' "$filename"
printf 'Content-Length: %s\r\n' "$bytes"
printf '\r\n'
cat "$ZIP_FILE"
exit 0
