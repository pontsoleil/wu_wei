#!/bin/sh
# load-file.cgi - protected shell file endpoint for WuWei managed data.
# Resolves logical upload paths directly and through _index/path without
# delegating to Python.

export PATH=".:./bin:/bin:/usr/bin${PATH+:}${PATH-}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1
mkdir -p log
exec 2>>"$SCRIPT_DIR/log/cgi.err"

set -eu
export LC_ALL=C
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"
CGIVARS="${Tmp}-cgivars"
trap 'rm -f "$CGIVARS"' EXIT HUP INT TERM

error_response() {
  status=${2:-}
  [ -n "$status" ] && printf '%s\r\n' "Status: $status"
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
  exit 0
}

strip_quotes() { sed 's/^"\(.*\)"$/\1/'; }
decode_minimal() { sed 's/+/ /g; s/%2[Ff]/\//g; s/%2[Dd]/-/g; s/%5[Ff]/_/g; s/%40/@/g; s/%3[Aa]/:/g; s/%20/ /g'; }

raw_param() {
  key=$1
  printf '%s' "${QUERY_STRING:-}" | tr '&' '\n' | sed -n "s/^${key}=//p" | head -n 1 | decode_minimal
}

read_request_params() {
  qs=${QUERY_STRING:-}
  body=""
  cl=${CONTENT_LENGTH:-0}
  if [ "${cl:-0}" -gt 0 ] 2>/dev/null; then body=$(cat || true); fi
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
  uid=${2:-}
  tpl=$(nameread "$key" data/environment | strip_quotes || true)
  [ -n "$tpl" ] || return 1
  if [ -n "$uid" ]; then
    tpl=$(printf '%s' "$tpl" | sed "s#/*\\*/*#/${uid}/#; s#\\*#${uid}#")
  fi
  case "$tpl" in
    [A-Za-z]:/*|[A-Za-z]:\\*) printf '%s\n' "$tpl" ;;
    /*) printf '%s\n' "$tpl" ;;
    wu_wei2/*) printf '%s/%s\n' "$(dirname "$SCRIPT_DIR")" "${tpl#wu_wei2/}" ;;
    *) printf '%s/%s\n' "$SCRIPT_DIR" "$tpl" ;;
  esac
}

safe_rel_path() {
  rel=$(printf '%s' "$1" | sed 's#\\#/#g; s#^/*##; s#/*$##')
  case "$rel" in
    ''|/*|*'/../'*|'../'*|*'/..'|'.'|'..'|*'//'*) return 1 ;;
    *[!A-Za-z0-9._/@+-]*) return 1 ;;
    *) printf '%s\n' "$rel" ;;
  esac
}

mime_for_name() {
  case "$(printf '%s' "$1" | sed 's/.*\.//' | tr A-Z a-z)" in
    pdf) printf '%s\n' 'application/pdf' ;;
    jpg|jpeg) printf '%s\n' 'image/jpeg' ;;
    png) printf '%s\n' 'image/png' ;;
    gif) printf '%s\n' 'image/gif' ;;
    svg) printf '%s\n' 'image/svg+xml' ;;
    html|htm) printf '%s\n' 'text/html; charset=UTF-8' ;;
    txt|adoc|md) printf '%s\n' 'text/plain; charset=UTF-8' ;;
    json) printf '%s\n' 'application/json; charset=UTF-8' ;;
    mp4) printf '%s\n' 'video/mp4' ;;
    mp3) printf '%s\n' 'audio/mpeg' ;;
    *) printf '%s\n' 'application/octet-stream' ;;
  esac
}

json_value() {
  key=$1
  file=$2
  awk -v key="$key" '
    BEGIN { RS="\001" }
    {
      pat="\"" key "\"[[:space:]]*:[[:space:]]*\""
      if (match($0, pat)) {
        s=substr($0, RSTART + RLENGTH)
        sub(/".*/, "", s)
        print s
      }
    }
  ' "$file" | head -n 1
}

role_file_from_manifest() {
  manifest=$1
  role=$2
  awk -v role="$role" '
    BEGIN { RS="[{}]" }
    $0 ~ "\"role\"[[:space:]]*:[[:space:]]*\"" role "\"" {
      if (match($0, /"file"[[:space:]]*:[[:space:]]*"[^"]+"/)) {
        s=substr($0, RSTART, RLENGTH); sub(/^.*:"/, "", s); sub(/"$/, "", s); print s; exit
      }
      if (match($0, /"path"[[:space:]]*:[[:space:]]*"[^"]+"/)) {
        s=substr($0, RSTART, RLENGTH); sub(/^.*:"/, "", s); sub(/"$/, "", s); print s; exit
      }
    }
  ' "$manifest"
}

resolve_upload_index_target() {
  base=$1
  rel=$2
  role=$3
  idx="$base/_index/path/$rel.json"
  [ -f "$idx" ] || return 1
  manifest_rel=$(json_value manifest "$idx")
  [ -n "$manifest_rel" ] || return 1
  manifest_rel=$(safe_rel_path "$manifest_rel") || return 1
  manifest_file="$base/$manifest_rel"
  [ -f "$manifest_file" ] || return 1
  target_name=$(role_file_from_manifest "$manifest_file" "$role")
  [ -n "$target_name" ] || target_name=$(role_file_from_manifest "$manifest_file" original)
  [ -n "$target_name" ] || return 1
  target_name=$(safe_rel_path "$target_name") || return 1
  case "$target_name" in
    */*) printf '%s\n' "$base/$target_name" ;;
    *) printf '%s\n' "$(dirname "$manifest_file")/$target_name" ;;
  esac
}

read_request_params
session_user_id=$(is-login || true)
[ -n "${session_user_id:-}" ] || error_response 'ERROR NOT LOGGED IN' '403 Forbidden'

area=$(nameread area "$CGIVARS" | strip_quotes || true)
[ -n "${area:-}" ] || area=$(raw_param area)
path=$(nameread path "$CGIVARS" | strip_quotes || true)
[ -n "${path:-}" ] || path=$(raw_param path)
role=$(nameread role "$CGIVARS" | strip_quotes || true)
[ -n "${role:-}" ] || role=$(raw_param role)
[ -n "${role:-}" ] || role=original
area=$(printf '%s' "$area" | tr A-Z a-z)
role=$(printf '%s' "$role" | tr A-Z a-z)

case "$area" in upload|note|resource|thumbnail|content) ;; *) error_response 'ERROR INVALID FILE REQUEST' '400 Bad Request' ;; esac
rel=$(safe_rel_path "$path") || error_response 'ERROR INVALID FILE REQUEST' '400 Bad Request'

base=$(resolve_env_path "$area" "$session_user_id" || true)
if [ -z "$base" ] && [ "$area" = content ]; then
  upload_base=$(resolve_env_path upload "$session_user_id" || true)
  [ -n "$upload_base" ] && base="$(dirname "$upload_base")/content"
fi
[ -n "$base" ] || error_response 'ERROR AREA NOT DEFINED' '404 Not Found'

target="$base/$rel"
if [ "$area" = upload ] && { [ ! -f "$target" ] || [ "$role" != original ]; }; then
  resolved=$(resolve_upload_index_target "$base" "$rel" "$role" || true)
  [ -n "$resolved" ] && target="$resolved"
fi

[ -f "$target" ] || error_response 'ERROR FILE NOT FOUND' '404 Not Found'
case "$target" in "$base"/*) ;; *) error_response 'ERROR INVALID FILE PATH' '403 Forbidden' ;; esac

mime=$(mime_for_name "$target")
printf '%s\r\n' "Content-Type: $mime"
printf '%s\r\n' 'Cache-Control: no-store'
printf '%s\r\n' "Content-Disposition: inline; filename=\"$(basename "$target" | sed 's/"/_/g')\""
printf '%s\r\n' "Content-Length: $(wc -c < "$target" | tr -d '[:space:]')"
printf '\r\n'
cat "$target"
