#!/bin/sh
# update-resource.cgi - shell implementation for updating Resource resource.json

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
RESOURCE_JSON="${Tmp}-resource.json"
trap 'rm -f "$CGIVARS" "$RESOURCE_JSON" "${Tmp}-resource-merged.json" "${Tmp}-resource-merged.json.tmp"' EXIT HUP INT TERM

text_response() {
  printf '%s\r\n\r\n%s\n' 'Content-Type: text/plain; charset=UTF-8' "$1"
  exit 0
}

json_response() {
  printf '%s\r\n\r\n%s' 'Content-Type: application/json; charset=UTF-8' "$1"
  exit 0
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

json_escape() {
  awk 'BEGIN{ORS=""}{gsub(/\\/,"\\\\");gsub(/"/,"\\\"");gsub(/\r/,"\\r");if(NR>1)printf "\\n";printf "%s",$0}'
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

sed_repl_escape() {
  sed 's/[\/&]/\\&/g'
}

resource_identity_key() {
  file=$1
  v=$(json_string_field canonicalUri "$file")
  [ -n "$v" ] || v=$(json_string_field uri "$file")
  [ -n "$v" ] || v=$(json_string_field sourcePath "$file")
  printf '%s\n' "$v"
}

resource_date_path() {
  file=$1
  ts=$(json_string_field createdAt "$file")
  [ -n "$ts" ] || ts=$(json_string_field lastModifiedAt "$file")
  date_part=$(printf '%s' "$ts" | sed -n 's/^\([0-9][0-9][0-9][0-9]\)-\([0-9][0-9]\)-\([0-9][0-9]\).*/\1\/\2\/\3/p')
  [ -n "$date_part" ] || date_part=$(date '+%Y/%m/%d')
  printf '%s\n' "$date_part"
}

read_params
session_user_id=$(is-login || true)
req_user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
resource_id=$(nameread id "$CGIVARS" | strip_quotes || true)
encoded=$(nameread resource_json_base64 "$CGIVARS" | strip_quotes || true)

[ -n "${session_user_id:-}" ] || text_response 'ERROR NOT LOGGED IN'
if [ -n "${req_user_id:-}" ] && [ "$req_user_id" != "$session_user_id" ]; then
  text_response 'ERROR USER MISMATCH'
fi
case "$resource_id" in
  ''|*[!A-Za-z0-9_.-]*|.*) text_response 'ERROR INVALID RESOURCE ID' ;;
esac
[ -n "${encoded:-}" ] || text_response 'ERROR RESOURCE JSON NOT SPECIFIED'

printf '%s' "$encoded" | base64 -d > "$RESOURCE_JSON" 2>/dev/null || text_response 'ERROR RESOURCE JSON DECODE FAILED'
decoded_id=$(json_string_field id "$RESOURCE_JSON")
[ "$decoded_id" = "$resource_id" ] || text_response 'ERROR RESOURCE ID MISMATCH'

resource_dir=$(resolve_env_path resource "$session_user_id" || true)
[ -n "${resource_dir:-}" ] || text_response 'ERROR RESOURCE DIR NOT DEFINED'
[ -d "$resource_dir" ] || text_response 'ERROR RESOURCE DIR NOT FOUND'

target=$(find "$resource_dir" -path "*/$resource_id/resource.json" -type f | head -n 1)
if [ -z "${target:-}" ]; then
  target=$(find "$resource_dir" -type f -name resource.json -exec awk -v id="$resource_id" '
    BEGIN { RS=""; found=0 }
    index($0, "\"id\"") && index($0, "\"" id "\"") { found=1 }
    END { exit found ? 0 : 1 }
  ' {} \; -print | head -n 1)
fi

if [ -z "${target:-}" ]; then
  incoming_key=$(resource_identity_key "$RESOURCE_JSON")
  [ -n "$incoming_key" ] || text_response 'ERROR RESOURCE NOT FOUND'
  date_path=$(resource_date_path "$RESOURCE_JSON")
  target_dir="$resource_dir/$date_path/$resource_id"
  mkdir -p "$target_dir" || text_response 'ERROR RESOURCE UPDATE FAILED'
  target="$target_dir/resource.json"
fi

incoming_key=$(resource_identity_key "$RESOURCE_JSON")
existing_key=""
[ -f "$target" ] && existing_key=$(resource_identity_key "$target")
if [ -z "$incoming_key" ] && [ -n "$existing_key" ]; then
  existing_uri=$(json_string_field uri "$target")
  existing_canonical=$(json_string_field canonicalUri "$target")
  if [ -n "$existing_uri" ] || [ -n "$existing_canonical" ]; then
    MERGED_JSON="${Tmp}-resource-merged.json"
    cp "$RESOURCE_JSON" "$MERGED_JSON" || text_response 'ERROR RESOURCE UPDATE FAILED'
    if [ -n "$existing_uri" ]; then
      uri_esc=$(printf '%s' "$existing_uri" | sed_repl_escape)
      sed "s/\"uri\"[[:space:]]*:[[:space:]]*\"\"/\"uri\": \"$uri_esc\"/g" "$MERGED_JSON" > "${MERGED_JSON}.tmp" &&
        mv "${MERGED_JSON}.tmp" "$MERGED_JSON"
    fi
    if [ -n "$existing_canonical" ]; then
      canonical_esc=$(printf '%s' "$existing_canonical" | sed_repl_escape)
      sed "s/\"canonicalUri\"[[:space:]]*:[[:space:]]*\"\"/\"canonicalUri\": \"$canonical_esc\"/g" "$MERGED_JSON" > "${MERGED_JSON}.tmp" &&
        mv "${MERGED_JSON}.tmp" "$MERGED_JSON"
    fi
    RESOURCE_JSON="$MERGED_JSON"
  fi
fi
cp "$RESOURCE_JSON" "$target" || text_response 'ERROR RESOURCE UPDATE FAILED'

json_response "{\"type\":\"success\",\"message\":\"Saved\",\"id\":\"$(printf '%s' "$resource_id" | json_escape)\"}"
