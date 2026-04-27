#!/bin/sh
# list-note.cgi
#
# Normal mode:
#   stderr is appended only to:
#     log/cgi.err
#
# Debug mode:
#   create the following flag file, then call this CGI:
#     log/.debug.list-note.cgi
#
#   In debug mode, stderr is written to both:
#     log/cgi.err
#     log/list-note.cgi.<pid>.log
#
#   Enable debug:
#     touch log/.debug.list-note.cgi
#
#   Disable debug:
#     rm -f log/.debug.list-note.cgi

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
  set -eux
else
  # stderr -> cgi.err only
  exec 2>>"$SCRIPT_DIR/log/cgi.err"
  set -eu
fi

export LC_ALL=C

type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"

CGIVARS="${Tmp}-cgivars"
FOUND="${Tmp}-found.tsv"
SELECTED="${Tmp}-selected.tsv"
NOTES="${Tmp}-notes.json"

cleanup() {
  rm -f "$CGIVARS" "$FOUND" "$SELECTED" "$NOTES"
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

normalise_posint() {
  value=${1:-}
  default=${2:-1}
  case "$value" in
    ''|*[!0-9]*) printf '%s\n' "$default" ;;
    *)
      if [ "$value" -lt 1 ] 2>/dev/null; then
        printf '%s\n' "$default"
      else
        printf '%s\n' "$value"
      fi
      ;;
  esac
}

read_meta() {
  key=$1
  file=$2
  awk -v k="$key" '
    function unquote(s) {
      if (s ~ /^".*"$/) {
        return substr(s, 2, length(s) - 2)
      }
      return s
    }
    index($0, k " ") == 1 {
      print unquote(substr($0, length(k) + 2))
      exit
    }
    index($0, k "=") == 1 {
      print unquote(substr($0, length(k) + 2))
      exit
    }
  ' "$file"
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
req_user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)

# Public note owners allowed without login, matching load-note.cgi behaviour.
if [ "_${req_user_id:-}" = '_dd99d0a5-566b-41cf-934d-127a89e13ba1' ] ||
  [ "_${req_user_id:-}" = '_0dbfa104-accd-4188-8b1b-f2e25d38e638' ]; then
  user_id="$req_user_id"
  note_dir=$(resolve_env_path public || true)
else
  if [ -z "${session_user_id:-}" ]; then
    error_response 'ERROR NOT LOGGED IN'
  fi

  if [ -n "${req_user_id:-}" ] && [ "$req_user_id" != "$session_user_id" ]; then
    error_response 'ERROR USER MISMATCH'
  fi

  user_id="$session_user_id"
  note_dir=$(resolve_env_path note "$user_id" || true)
fi

[ -n "${note_dir:-}" ] || error_response 'ERROR NOTE DIR NOT DEFINED'
[ -d "$note_dir" ] || error_response 'ERROR NOTE DIR NOT DEFINED'

{
  find "$note_dir" -type f -name note.json -printf '%T+\t%P\t%s\n'
  find "$note_dir" -maxdepth 1 -type f -printf '%T+\t%P\t%s\n'
} | sort -r > "$FOUND"

total=$(wc -l < "$FOUND" | tr -d '[:space:]')
total=${total:-0}

start=$(nameread start "$CGIVARS" | strip_quotes || true)
start=$(normalise_posint "$start" 1)
count=$(nameread count "$CGIVARS" | strip_quotes || true)
count=$(normalise_posint "$count" 12)
count_org=$count

if [ "$total" -eq 0 ] 2>/dev/null; then
  count=0
else
  if [ "$start" -gt "$total" ] 2>/dev/null; then
    count=0
  else
    remaining=$((total - start + 1))
    if [ "$remaining" -lt "$count" ] 2>/dev/null; then
      count=$remaining
    fi
  fi
fi

: > "$SELECTED"
if [ "$count" -gt 0 ] 2>/dev/null; then
  head -n $((start + count - 1)) "$FOUND" | tail -n "$count" > "$SELECTED"
fi

{
  printf '$.total %s\n' "$total"
  printf '$.start %s\n' "$start"
  printf '$.count_org %s\n' "$count_org"
  printf '$.count %s\n' "$count"

  i=0
  if [ "$count" -gt 0 ] 2>/dev/null; then
    while IFS="$(printf '\t')" read -r timestamp relpath size; do
      [ -n "${relpath:-}" ] || continue

      abs_file="$note_dir/$relpath"
      dir=${relpath%/*}
      [ "$dir" = "$relpath" ] && dir='.'
      file=${relpath##*/}
      note_id=$(read_meta id "$abs_file" || true)
      [ -n "$note_id" ] || note_id=$(basename "$(dirname "$abs_file")")

      note_user_id=$(read_meta user_id "$abs_file" || true)
      note_name=$(read_meta name "$abs_file" || true)
      note_description=$(read_meta description "$abs_file" || true)
      note_thumbnail=$(read_meta thumbnail "$abs_file" || true)

      printf '$.note[%s].id %s\n' "$i" "$note_id"
      printf '$.note[%s].user_id %s\n' "$i" "$note_user_id"
      printf '$.note[%s].note_name %s\n' "$i" "$note_name"
      printf '$.note[%s].dir %s\n' "$i" "$dir"
      printf '$.note[%s].size %s\n' "$i" "$size"
      printf '$.note[%s].timestamp %s\n' "$i" "$timestamp"
      printf '$.note[%s].file %s\n' "$i" "$file"
      printf '$.note[%s].thumbnail %s\n' "$i" "$note_thumbnail"
      printf '$.note[%s].description %s\n' "$i" "$note_description"

      i=$((i + 1))
    done < "$SELECTED"
  fi
} | makrj.sh | sed 's/^\("[^":,]*":\),/\1null,/' > "$NOTES"

json_response_file "$NOTES"

rm -f "$Tmp" "$Tmp"-*
exit 0
