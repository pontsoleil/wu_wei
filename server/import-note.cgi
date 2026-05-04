#!/bin/bash
# import-note.cgi
#
# Import either a plain note JSON file or a portable ZIP made by
# export-note.cgi. ZIP import restores upload/YYYY/MM/DD/{upload_uuid}/...
# and resource/YYYY/MM/DD/{resource_uuid}/... first, then stores the note JSON
# by reference.

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
UPLOAD_FILE="${Tmp}-upload"
EXTRACT_DIR="${Tmp}-extract"
NOTE_JSON="${Tmp}-note-data"

cleanup() {
  rm -f "$CGIVARS" "$UPLOAD_FILE" "$NOTE_JSON"
  rm -rf "$EXTRACT_DIR"
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

decode_note_payload() {
  src=$1
  dst=$2
  json_base64=$(nameread json_base64 "$src" | strip_quotes || true)
  if [ -n "${json_base64:-}" ]; then
    printf '%s' "$json_base64" | base64 -d > "$dst" 2>/dev/null || return 1
    return 0
  fi
  cp "$src" "$dst" || return 1
}

json_string_field() {
  key=$1
  file=$2
  awk -v k="$key" '
    BEGIN { RS=""; ORS="" }
    {
      pat = "\"" k "\"[ \t\r\n]*:[ \t\r\n]*\""
      p = match($0, pat)
      if (!p) exit
      s = substr($0, RSTART + RLENGTH)
      out = ""; esc = 0
      for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1)
        if (esc) { out = out c; esc = 0; continue }
        if (c == "\\") { out = out c; esc = 1; continue }
        if (c == "\"") break
        out = out c
      }
      print out
    }
  ' "$file"
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

archive_extract() {
  zip_file=$1
  out_dir=$2
  mkdir -p "$out_dir" || return 1
  if command -v unzip >/dev/null 2>&1; then
    unzip -qq "$zip_file" -d "$out_dir"
    return $?
  fi
  if command -v jar >/dev/null 2>&1; then
    (cd "$out_dir" && jar xf "$zip_file" >/dev/null 2>&1)
    return $?
  fi
  return 1
}

single_line_meta() {
  tr '\r\n\t' '   ' | sed 's/  */ /g; s/^ //; s/ $//'
}

cl=${CONTENT_LENGTH:-0}
[ "${cl:-0}" -gt 0 ] 2>/dev/null || error_response 'ERROR FILE NOT SPECIFIED'

head -c "$cl" > "$CGIVARS" < /dev/stdin || error_response 'ERROR REQUEST READ FAILED'
mime-read file "$CGIVARS" > "$UPLOAD_FILE" || error_response 'ERROR FILE READ FAILED'
user_id=$(mime-read user_id "$CGIVARS" 2>/dev/null | strip_quotes || true)

session_user_id=$(is-login || true)
if [ -z "${session_user_id:-}" ] || [ -z "${user_id:-}" ] || [ "$user_id" != "$session_user_id" ]; then
  error_response 'ERROR NOT LOGGED IN'
fi

note_base=$(resolve_env_path note "$user_id" || true)
upload_base=$(resolve_env_path upload "$user_id" || true)
resource_base=$(resolve_env_path resource "$user_id" || true)
[ -n "${note_base:-}" ] || error_response 'ERROR NOTE DIRECTORY NOT DEFINED'
[ -n "${upload_base:-}" ] || error_response 'ERROR UPLOAD DIRECTORY NOT DEFINED'
[ -n "${resource_base:-}" ] || error_response 'ERROR RESOURCE DIRECTORY NOT DEFINED'

if file -b "$UPLOAD_FILE" 2>/dev/null | grep -qi 'zip'; then
  archive_extract "$UPLOAD_FILE" "$EXTRACT_DIR" || error_response 'ERROR ZIP EXTRACT FAILED'
  found_note="$EXTRACT_DIR/note.txt"
  [ -f "${found_note:-}" ] || error_response 'ERROR NOTE TEXT NOT FOUND'
  decode_note_payload "$found_note" "$NOTE_JSON" || error_response 'ERROR NOTE JSON DECODE FAILED'

  if [ -d "$EXTRACT_DIR/upload" ]; then
    (cd "$EXTRACT_DIR/upload" && find . -mindepth 4 -maxdepth 4 -type d -name '_*' -print) |
    while IFS= read -r rel; do
      rel=${rel#./}
      case "$rel" in
        *..*|/*) continue ;;
      esac
      src="$EXTRACT_DIR/upload/$rel"
      dst="$upload_base/$rel"
      [ -d "$src" ] || continue
      if [ ! -d "$dst" ]; then
        mkdir -p "$(dirname "$dst")" || error_response 'ERROR UPLOAD DIRECTORY CREATE FAILED'
        cp -R "$src" "$dst" || error_response 'ERROR UPLOAD RESTORE FAILED'
      fi
    done
  fi

  if [ -d "$EXTRACT_DIR/resource" ]; then
    (cd "$EXTRACT_DIR/resource" && find . -mindepth 4 -maxdepth 4 -type d -name '_*' -print) |
    while IFS= read -r rel; do
      rel=${rel#./}
      case "$rel" in
        *..*|/*) continue ;;
      esac
      src="$EXTRACT_DIR/resource/$rel"
      dst="$resource_base/$rel"
      [ -d "$src" ] || continue
      if [ ! -d "$dst" ]; then
        mkdir -p "$(dirname "$dst")" || error_response 'ERROR RESOURCE DIRECTORY CREATE FAILED'
        cp -R "$src" "$dst" || error_response 'ERROR RESOURCE RESTORE FAILED'
      fi
    done
  fi
else
  decode_note_payload "$UPLOAD_FILE" "$NOTE_JSON" || error_response 'ERROR NOTE JSON DECODE FAILED'
fi

sed -i '1s/^\xEF\xBB\xBF//' "$NOTE_JSON"

note_id=$(json_string_field note_id "$NOTE_JSON")
[ -n "$note_id" ] || note_id=$(json_string_field note_uuid "$NOTE_JSON")
[ -n "$note_id" ] || error_response 'ERROR NOTE ID NOT FOUND'
case "$note_id" in
  _[0-9A-Fa-f-]*|new_note) ;;
  *) error_response 'ERROR INVALID NOTE ID' ;;
esac

year=$(date '+%Y')
month=$(date '+%m')
day=$(date '+%d')
saved_at=$(date '+%Y-%m-%dT%H:%M:%S%z')
note_name=$(json_string_field note_name "$NOTE_JSON" | single_line_meta)
description=$(json_string_field description "$NOTE_JSON" | single_line_meta)
json_base64=$(base64 < "$NOTE_JSON" | tr -d '\n')

note_dir="$note_base/$year/$month/$day/$note_id"
mkdir -p "$note_dir" || error_response 'ERROR NOTE DIRECTORY CREATE FAILED'
{
  printf 'format_version 2\n'
  printf 'id %s\n' "$note_id"
  printf 'user_id %s\n' "$user_id"
  printf 'name %s\n' "$note_name"
  printf 'description %s\n' "$description"
  printf 'thumbnail \n'
  printf 'saved_at %s\n' "$saved_at"
  printf 'json_encoding base64\n'
  printf 'json_base64 %s\n' "$json_base64"
} > "$note_dir/note.txt" || error_response 'ERROR NOTE SAVE FAILED'

json_response_file "$NOTE_JSON"
