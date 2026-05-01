#!/bin/bash
# save-note.cgi
#
# Normal mode:
#   stderr is appended only to:
#     log/cgi.err
#
# Debug mode:
#   create the following flag file, then call this CGI:
#     log/.debug.save-note.cgi
#
#   In debug mode, stderr is written to both:
#     log/cgi.err
#     log/save-note.cgi.<pid>.log
#
#   Enable debug:
#     touch log/.debug.save-note.cgi
#
#   Disable debug:
#     rm -f log/.debug.save-note.cgi

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

cleanup() {
  rm -f "$CGIVARS" "$CGIVARS_ORG"
  rm -rf "${RESOURCE_TMP:-}"
}
trap cleanup EXIT HUP INT TERM

year=$(date '+%Y')
month=$(date '+%m')
day=$(date '+%d')
saved_at=$(date '+%Y-%m-%dT%H:%M:%S%z')
ACK=$(printf '\006')
DRAFT_NOTE_ID="new_note"

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

json_escape() {
  sed 's/\\/\\\\/g; s/"/\\"/g; s/\r/\\r/g; s/\t/\\t/g' |
  awk '{ if (NR > 1) printf "\\n"; printf "%s", $0 }'
}

new_note_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    printf '_%s\n' "$(uuidgen | tr 'A-F' 'a-f')"
  else
    printf '_%s-%s\n' "$(date '+%Y%m%d%H%M%S')" "$$"
  fi
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

single_line_meta() {
  tr '\r\n\t' '   ' | sed 's/  */ /g; s/^ //; s/ $//'
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

json_string_values() {
  key=$1
  file=$2
  awk -v k="$key" '
    BEGIN { RS=""; ORS="\n" }
    {
      rest = $0
      pat = "\"" k "\"[ \t\r\n]*:[ \t\r\n]*\""
      while (match(rest, pat)) {
        s = substr(rest, RSTART + RLENGTH)
        out = ""; esc = 0
        for (i = 1; i <= length(s); i++) {
          c = substr(s, i, 1)
          if (esc) { out = out c; esc = 0; continue }
          if (c == "\\") { out = out c; esc = 1; continue }
          if (c == "\"") break
          out = out c
        }
        print out
        rest = substr(s, i + 1)
      }
    }
  ' "$file"
}

json_svg_thumbnail() {
  file=$1
  awk '
    BEGIN { RS=""; ORS="" }
    function unescape_json(s,    i,c,out,esc,u) {
      out = ""; esc = 0
      for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1)
        if (esc) {
          if (c == "\"" || c == "\\" || c == "/") out = out c
          else if (c == "n") out = out "\n"
          else if (c == "r") out = out "\r"
          else if (c == "t") out = out "\t"
          else if (c == "u") {
            u = substr(s, i + 1, 4)
            if (u == "003c") out = out "<"
            else if (u == "003e") out = out ">"
            else if (u == "0026") out = out "&"
            else out = out "\\u" u
            i += 4
          }
          else out = out c
          esc = 0
          continue
        }
        if (c == "\\") { esc = 1; continue }
        out = out c
      }
      return out
    }
    {
      rest = $0
      pat = "\"thumbnail\"[ \t\r\n]*:[ \t\r\n]*\""
      while (match(rest, pat)) {
        s = substr(rest, RSTART + RLENGTH)
        out = ""; esc = 0
        for (i = 1; i <= length(s); i++) {
          c = substr(s, i, 1)
          if (esc) { out = out "\\" c; esc = 0; continue }
          if (c == "\\") { esc = 1; continue }
          if (c == "\"") break
          out = out c
        }
        value = unescape_json(out)
        if (value ~ /^<svg/) {
          print value
          exit
        }
        rest = substr(s, i + 1)
      }
    }
  ' "$file"
}

extract_note_resources() {
  json_file=$1
  out_dir=$2
  awk -v out="$out_dir" '
    BEGIN { RS=""; n=0 }
    {
      p = match($0, "\"resources\"[ \t\r\n]*:[ \t\r\n]*\\[")
      if (!p) exit
      i = RSTART + RLENGTH
      arr_depth = 1; obj_depth = 0; in_s = 0; esc = 0; start = 0
      for (; i <= length($0); i++) {
        c = substr($0, i, 1)
        if (in_s) {
          if (esc) esc = 0
          else if (c == "\\") esc = 1
          else if (c == "\"") in_s = 0
          continue
        }
        if (c == "\"") { in_s = 1; continue }
        if (c == "[") { arr_depth++; continue }
        if (c == "]") {
          if (obj_depth == 0) arr_depth--
          if (arr_depth == 0) exit
          continue
        }
        if (c == "{") {
          if (obj_depth == 0) start = i
          obj_depth++
          continue
        }
        if (c == "}") {
          obj_depth--
          if (obj_depth == 0 && start > 0) {
            n++
            print substr($0, start, i - start + 1) > (out "/resource_" n ".json")
            close(out "/resource_" n ".json")
            start = 0
          }
        }
      }
    }
  ' "$json_file"
}

resource_identity_key() {
  file=$1
  v=$(json_string_field canonicalUri "$file")
  [ -n "$v" ] || v=$(json_string_field uri "$file")
  printf '%s\n' "$v"
}

copy_resource_files() {
  # Note save stores references only. Upload bodies, thumbnails and previews
  # remain under upload/YYYY/MM/DD/{upload_uuid}/ and are collected only during
  # explicit note export/download.
  return 0
}

save_note_resources() {
  # Note save stores references only. Upload bodies, thumbnails and previews
  # remain under upload/YYYY/MM/DD/{upload_uuid}/ and are collected only during
  # explicit note export/download.
  return 0
}

process_note_json() {
  json_file=$1
  note_id_arg=$2
  tmp_file="${json_file}.tmp"

  [ -s "$json_file" ] || {
    printf 'note_json_process_error=JSON NOT SPECIFIED\n' >&2
    return 1
  }

  # Front-end save emits compact one-line JSON. Keep server-side processing
  # intentionally small: validate the envelope and rewrite draft identifiers.
  if ! grep -q '"pages"[[:space:]]*:[[:space:]]*\[' "$json_file"; then
    printf 'note_json_process_error=NOTE JSON PAGES MUST BE ARRAY\n' >&2
    return 1
  fi

  sed \
    -e "s#/${DRAFT_NOTE_ID}/#/${note_id_arg}/#g" \
    -e "s#/_note_uuid/#/${note_id_arg}/#g" \
    -e "s#/note_uuid/#/${note_id_arg}/#g" \
    -e "s#\"note_id\"[[:space:]]*:[[:space:]]*\"${DRAFT_NOTE_ID}\"#\"note_id\":\"${note_id_arg}\"#g" \
    -e "s#\"note_uuid\"[[:space:]]*:[[:space:]]*\"${DRAFT_NOTE_ID}\"#\"note_uuid\":\"${note_id_arg}\"#g" \
    "$json_file" > "$tmp_file" || return 1

  if ! grep -q '"note_uuid"[[:space:]]*:' "$tmp_file"; then
    sed "0,/\"note_id\"[[:space:]]*:[[:space:]]*\"${note_id_arg}\"/s//\"note_id\":\"${note_id_arg}\",\"note_uuid\":\"${note_id_arg}\"/" "$tmp_file" > "${tmp_file}.2" &&
      mv "${tmp_file}.2" "$tmp_file"
  fi

  mv "$tmp_file" "$json_file"
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

# Keep current cgi-name based parsing, but do NOT persist its output as-is.
cgi-name -s"$ACK" < "$CGIVARS_ORG" > "$CGIVARS"

session_user_id=$(is-login || true)
user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
[ -n "${user_id:-}" ] || user_id=$(raw_form_value user_id "$CGIVARS_ORG" | strip_quotes || true)

if [ -z "${session_user_id:-}" ] || [ -z "${user_id:-}" ] || [ "$user_id" != "$session_user_id" ]; then
  debug_log "not_logged_in session_user_id=${session_user_id:-} user_id=${user_id:-}"
  error_response 'ERROR NOT LOGGED IN'
fi

note_base=$(resolve_env_path note "$user_id" || true)
resource_base=$(resolve_env_path resource "$user_id" || true)

[ -n "${note_base:-}" ] || error_response 'ERROR NOTE DIRECTORY NOT DEFINED'
[ -n "${resource_base:-}" ] || error_response 'ERROR RESOURCE DIRECTORY NOT DEFINED'

id=$(nameread id "$CGIVARS" | strip_quotes || true)
name=$(nameread name "$CGIVARS" | strip_quotes || true)
description=$(nameread description "$CGIVARS" | strip_quotes || true)
thumbnail=$(nameread thumbnail "$CGIVARS" | strip_quotes || true)
json=$(nameread json "$CGIVARS" | strip_quotes || true)
debug_log "request user_id=$user_id id=$id name=$name content_length=${CONTENT_LENGTH:-0}"
debug_preview "json_raw" "$json"

[ -n "${id:-}" ] || error_response 'ERROR ID NOT SPECIFIED'
[ -n "${json:-}" ] || error_response 'ERROR JSON NOT SPECIFIED'
requested_id=$id
if [ "$id" = "$DRAFT_NOTE_ID" ]; then
  id=$(new_note_uuid)
fi

# Restore placeholders introduced by cgi-name -s and normalise metadata to single lines.
name=$(printf '%s' "$name" | restore_ack_to_space | single_line_meta)
description=$(printf '%s' "$description" | restore_ack_to_space | single_line_meta)
thumbnail=$(printf '%s' "$thumbnail" | restore_ack_to_space | single_line_meta)
json=$(printf '%s' "$json" | restore_ack_to_space)

# Remove BOM only. JSON content itself should remain unchanged.
json=$(printf '%s' "$json" | sed '1s/^\xEF\xBB\xBF//')
debug_preview "json" "$json"

note_dir="$note_base/$year/$month/$day/$id"
note_resource_dir="$note_dir/resource"
mkdir -p "$note_dir" || error_response 'ERROR NOTE DIRECTORY CREATE FAILED'

JSON_FILE="${Tmp}-note.json"
printf '%s' "$json" > "$JSON_FILE"
process_note_json "$JSON_FILE" "$id" || error_response 'ERROR NOTE JSON PROCESS FAILED'
json=$(cat "$JSON_FILE")
if [ -z "${thumbnail:-}" ]; then
  thumbnail=$(json_svg_thumbnail "$JSON_FILE" | single_line_meta || true)
fi

json_base64=$(printf '%s' "$json" | base64 | tr -d '\n')
[ -n "${json_base64:-}" ] || error_response 'ERROR JSON ENCODE FAILED'
debug_log "json_base64_len=$(printf '%s' "$json_base64" | wc -c | tr -d ' ') note_dir=$note_dir"

outfile="$note_dir/note.json"
{
  printf 'format_version 2\n'
  printf 'id %s\n' "$id"
  printf 'user_id %s\n' "$user_id"
  printf 'name %s\n' "$name"
  printf 'description %s\n' "$description"
  printf 'thumbnail %s\n' "$thumbnail"
  printf 'saved_at %s\n' "$saved_at"
  printf 'json_encoding base64\n'
  printf 'json_base64 %s\n' "$json_base64"
} > "$outfile" || error_response 'ERROR SAVE FAILED'

escaped_name=$(printf '%s' "$name" | json_escape)
escaped_id=$(printf '%s' "$id" | json_escape)
ok_response "{\"name\":\"$escaped_name\",\"note_id\":\"$escaped_id\"}"

rm -f "$Tmp" "$Tmp"-*
exit 0
