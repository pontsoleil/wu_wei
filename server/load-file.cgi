#!/bin/sh
# load-file.cgi - protected file endpoint for WuWei managed data.
# Keep this behavior aligned with cgi-bin/load-file.py: validate the request,
# resolve the managed file, and stream the file body from the CGI process.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1
mkdir -p log
exec 2>>"$SCRIPT_DIR/log/cgi.err"
set -eu

export LC_ALL=C
type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"

Tmp="/tmp/${0##*/}.$$"
CGIVARS="${Tmp}-cgivars"
trap 'rm -f "$CGIVARS"' EXIT HUP INT TERM

text_response() {
  status=${2:-}
  [ -n "$status" ] && printf 'Status: %s\r\n' "$status"
  printf '%s\r\n\r\n%s\n' 'Content-Type: text/plain; charset=UTF-8' "$1"
  exit 0
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

read_params() {
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
}

resolve_env_path() {
  key=$1
  uid=$2
  tpl=$(nameread "$key" data/environment | strip_quotes || true)
  if [ -z "$tpl" ] && [ "$key" = "note" ]; then
    tpl=$(nameread upload data/environment | strip_quotes || true)
    [ -n "$tpl" ] || return 1
    tpl=$(printf '%s' "$tpl" | sed "s#/\*/#/${uid}/#; s#\*#${uid}#")
    case "$tpl" in
      /*) printf '%s\n' "$(dirname "$tpl")/note" ;;
      wu_wei2/*) printf '%s\n' "$(dirname "$(dirname "$SCRIPT_DIR")/${tpl#wu_wei2/}")/note" ;;
      *) printf '%s\n' "$(dirname "$SCRIPT_DIR/$tpl")/note" ;;
    esac
    return 0
  fi
  [ -n "$tpl" ] || return 1
  tpl=$(printf '%s' "$tpl" | sed "s#/\*/#/${uid}/#; s#\*#${uid}#")
  case "$tpl" in
    /*) printf '%s\n' "$tpl" ;;
    wu_wei2/*) printf '%s/%s\n' "$(dirname "$SCRIPT_DIR")" "${tpl#wu_wei2/}" ;;
    *) printf '%s/%s\n' "$SCRIPT_DIR" "$tpl" ;;
  esac
}

safe_rel() {
  rel=$(printf '%s' "$1" | tr '\\' '/' | sed 's#^/*##; s#/*$##')
  case "$rel" in
    ""|/*|*"/../"*|../*|*".."|*"./"*|./*) return 1 ;;
  esac
  printf '%s\n' "$rel"
}

mime_for_path() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    *.html|*.htm) printf 'text/html; charset=UTF-8' ;;
    *.txt|*.text|*.md|*.adoc|*.csv|*.tsv) printf 'text/plain; charset=UTF-8' ;;
    *.json) printf 'application/json; charset=UTF-8' ;;
    *.pdf) printf 'application/pdf' ;;
    *.png) printf 'image/png' ;;
    *.jpg|*.jpeg) printf 'image/jpeg' ;;
    *.gif) printf 'image/gif' ;;
    *.svg) printf 'image/svg+xml' ;;
    *.webp) printf 'image/webp' ;;
    *.mp4) printf 'video/mp4' ;;
    *.webm) printf 'video/webm' ;;
    *.mp3) printf 'audio/mpeg' ;;
    *.wav) printf 'audio/wav' ;;
    *.doc) printf 'application/msword' ;;
    *.docx) printf 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ;;
    *.xls) printf 'application/vnd.ms-excel' ;;
    *.xlsx) printf 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ;;
    *.ppt) printf 'application/vnd.ms-powerpoint' ;;
    *.pptx) printf 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ;;
    *) printf 'application/octet-stream' ;;
  esac
}

header_filename() {
  # Avoid quotes, CR/LF, and backslashes in the response header filename.
  printf '%s' "$1" | tr '\\' '/' | sed 's#.*/##; s/["\r\n]//g'
}

read_params
session_user_id=$(is-login || true)
req_user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
[ -n "${session_user_id:-}" ] || text_response 'ERROR NOT LOGGED IN' '403 Forbidden'
if [ -n "${req_user_id:-}" ] && [ "$req_user_id" != "$session_user_id" ]; then
  text_response 'ERROR USER MISMATCH' '403 Forbidden'
fi
user_id=$session_user_id
area=$(nameread area "$CGIVARS" | strip_quotes | tr '[:upper:]' '[:lower:]' || true)
path=$(nameread path "$CGIVARS" | strip_quotes || true)
case "$area" in upload|note|resource|thumbnail|content) ;; *) text_response 'ERROR INVALID AREA' '400 Bad Request' ;; esac
rel=$(safe_rel "$path" || true)
[ -n "$rel" ] || text_response 'ERROR INVALID PATH' '400 Bad Request'
base=$(resolve_env_path "$area" "$user_id" || true)
[ -n "$base" ] || text_response 'ERROR AREA NOT DEFINED' '404 Not Found'
target="$base/$rel"
if [ ! -f "$target" ] && [ "$area" = "note" ]; then
  upload_base=$(resolve_env_path upload "$user_id" || true)
  if [ -n "$upload_base" ]; then
    alt_base="$(dirname "$upload_base")/note"
    alt_target="$alt_base/$rel"
    if [ -f "$alt_target" ]; then
      base="$alt_base"
      target="$alt_target"
    fi
  fi
fi
[ -f "$target" ] || text_response 'ERROR FILE NOT FOUND' '404 Not Found'

printf 'Content-Type: %s\r\n' "$(mime_for_path "$rel")"
printf 'Cache-Control: no-store\r\n'
printf 'Content-Disposition: inline; filename="%s"\r\n' "$(header_filename "$rel")"
if command -v wc >/dev/null 2>&1; then
  bytes=$(wc -c < "$target" | tr -d ' ')
  [ -n "$bytes" ] && printf 'Content-Length: %s\r\n' "$bytes"
fi
printf '\r\n'
cat "$target"
