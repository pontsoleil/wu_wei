#!/bin/sh
# list-resource.cgi - shell implementation for Resource library listing

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
FOUND="${Tmp}-found"
trap 'rm -f "$CGIVARS" "$FOUND"' EXIT HUP INT TERM

text_response() {
  printf '%s\r\n\r\n%s\n' 'Content-Type: text/plain; charset=UTF-8' "$1"
  exit 0
}

json_header() {
  printf '%s\r\n\r\n' 'Content-Type: application/json; charset=UTF-8'
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

json_escape() {
  awk 'BEGIN{ORS=""}
    {
      gsub(/\\/,"\\\\"); gsub(/"/,"\\\"");
      gsub(/\r/,"\\r"); gsub(/\t/,"\\t"); gsub(/\f/,"\\f"); gsub(/\b/,"\\b");
      if (NR > 1) printf "\\n";
      printf "%s", $0;
    }'
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

url_encode() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
  elif command -v python >/dev/null 2>&1; then
    python -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
  else
    printf '%s' "$1" | sed 's/%/%25/g; s/ /%20/g; s#/#%2F#g; s/&/%26/g; s/?/%3F/g; s/=/%3D/g'
  fi
}

resource_rel_url() {
  uid=$1
  rel=$2
  printf '/wu_wei2/server/load-file.cgi?area=resource&path=%s&user_id=%s' \
    "$(url_encode "$rel")" "$(url_encode "$uid")"
}

file_rel_url() {
  uid=$1
  area=$2
  rel=$3
  [ -n "$area" ] || return 0
  [ -n "$rel" ] || return 0
  printf '/wu_wei2/server/load-file.cgi?area=%s&path=%s&user_id=%s' \
    "$(url_encode "$area")" "$(url_encode "$rel")" "$(url_encode "$uid")"
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
      out = ""
      esc = 0
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

json_object_field() {
  key=$1
  file=$2
  awk -v k="$key" '
    BEGIN { RS=""; ORS="" }
    {
      pat = "\"" k "\"[ \t\r\n]*:[ \t\r\n]*\\{"
      p = match($0, pat)
      if (!p) exit
      start = RSTART + RLENGTH - 1
      depth = 0; in_s = 0; esc = 0
      for (i = start; i <= length($0); i++) {
        c = substr($0, i, 1)
        if (in_s) {
          if (esc) esc = 0
          else if (c == "\\") esc = 1
          else if (c == "\"") in_s = 0
        } else {
          if (c == "\"") in_s = 1
          else if (c == "{") depth++
          else if (c == "}") {
            depth--
            if (depth == 0) { print substr($0, start, i - start + 1); exit }
          }
        }
      }
    }
  ' "$file"
}

json_file_field_for_role() {
  role=$1
  key=$2
  file=$3
  awk -v role="$role" -v key="$key" '
    BEGIN { RS=""; ORS="" }
    {
      for (i = 1; i <= length($0); i++) {
        c = substr($0, i, 1)
        if (in_s) {
          if (esc) esc = 0
          else if (c == "\\") esc = 1
          else if (c == "\"") in_s = 0
          continue
        }
        if (c == "\"") { in_s = 1; continue }
        if (c == "{") {
          if (depth == 0) start = i
          depth++
          continue
        }
        if (c == "}") {
          depth--
          if (depth == 0 && start > 0) {
            obj = substr($0, start, i - start + 1)
            role_pat = "\"role\"[ \t\r\n]*:[ \t\r\n]*\"" role "\""
            key_pat = "\"" key "\"[ \t\r\n]*:[ \t\r\n]*\""
            if (obj ~ role_pat && match(obj, key_pat)) {
              s = substr(obj, RSTART + RLENGTH)
              out = ""; esc2 = 0
              for (j = 1; j <= length(s); j++) {
                d = substr(s, j, 1)
                if (esc2) { out = out d; esc2 = 0; continue }
                if (d == "\\") { out = out d; esc2 = 1; continue }
                if (d == "\"") break
                out = out d
              }
              print out
              exit
            }
            start = 0
          }
        }
      }
    }
  ' "$file"
}

resource_date_from_rel() {
  rel=$1
  y=$(printf '%s' "$rel" | awk -F/ '{print $1}')
  m=$(printf '%s' "$rel" | awk -F/ '{print $2}')
  d=$(printf '%s' "$rel" | awk -F/ '{print $3}')
  case "$y-$m-$d" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) printf '%s-%s-%s\n' "$y" "$m" "$d" ;;
    *) printf '\n' ;;
  esac
}

emit_record() {
  root=$1
  path=$2
  uid=$3
  rel=${path#"$root"/}
  id=$(json_string_field id "$path")
  [ -n "$id" ] || id=$(basename "$(dirname "$path")")
  label=$(json_string_field label "$path")
  title=$(json_string_field title "$path")
  name=${label:-${title:-$id}}
  canonical=$(json_string_field canonicalUri "$path")
  uri=$(json_string_field uri "$path")
  source_uri=${canonical:-$uri}
  mime=$(json_string_field mimeType "$path")
  kind=$(json_string_field kind "$path")
  desc=$(json_object_field description "$path")
  desc_format=$(json_string_field format "$path")
  desc_body=$(json_string_field body "$path")
  [ -n "$desc" ] || desc='{}'

  option=upload
  viewer=
  case "$source_uri" in
    *youtube.com*|*youtu.be*) option=video; viewer=youtube ;;
    *vimeo.com*) option=video; viewer=vimeo ;;
    http://*|https://*) option=webpage; viewer=iframe ;;
  esac
  case "$kind:$mime" in
    video:*|*:video/*) option=video; [ -n "$viewer" ] || viewer=video ;;
    image:*|*:image/*) [ -n "$viewer" ] || viewer=image ;;
    *:application/pdf) [ -n "$viewer" ] || viewer=pdf ;;
  esac
  [ -n "$viewer" ] || viewer=iframe

  date=$(resource_date_from_rel "$rel")
  lastmod=$(json_string_field lastModifiedAt "$path")
  created=$(json_string_field createdAt "$path")
  ts=${lastmod:-${created:-${date}T00:00:00}}
  preview="$source_uri"
  thumb=$(json_string_field thumbnailUri "$path")
  res_url=$(resource_rel_url "$uid" "$rel")
  original_area=$(json_file_field_for_role original area "$path")
  original_path=$(json_file_field_for_role original path "$path")
  preview_area=$(json_file_field_for_role preview area "$path")
  preview_path=$(json_file_field_for_role preview path "$path")
  thumb_area=$(json_file_field_for_role thumbnail area "$path")
  thumb_path=$(json_file_field_for_role thumbnail path "$path")
  original_file_url=$(file_rel_url "$uid" "${original_area:-upload}" "$original_path")
  preview_file_url=$(file_rel_url "$uid" "${preview_area:-note}" "$preview_path")
  thumb_file_url=$(file_rel_url "$uid" "${thumb_area:-note}" "$thumb_path")
  [ -n "$preview_file_url" ] && preview="$preview_file_url"
  [ -z "$preview" ] && preview="$original_file_url"
  [ -n "$thumb_file_url" ] && thumb="$thumb_file_url"
  download_url=${original_file_url:-$source_uri}

  printf '{'
  printf '"id":"%s",' "$(printf '%s' "$id" | json_escape)"
  printf '"resource":'
  cat "$path"
  printf ','
  printf '"label":"%s",' "$(printf '%s' "$label" | json_escape)"
  printf '"description":%s,' "$desc"
  printf '"name":"%s",' "$(printf '%s' "$name" | json_escape)"
  printf '"option":"%s",' "$option"
  printf '"contenttype":"%s",' "$(printf '%s' "$mime" | json_escape)"
  printf '"uri":"%s",' "$(printf '%s' "$uri" | json_escape)"
  printf '"url":"%s",' "$(printf '%s' "$preview" | json_escape)"
  printf '"download_url":"%s",' "$(printf '%s' "$download_url" | json_escape)"
  printf '"preview_url":"%s",' "$(printf '%s' "$preview" | json_escape)"
  printf '"value":{'
  printf '"lastmodified":"%s",' "$(printf '%s' "$ts" | sed 's/T/ /' | json_escape)"
  printf '"totalsize":"",'
  printf '"viewerType":"%s",' "$viewer"
  printf '"previewUri":"%s",' "$(printf '%s' "$preview" | json_escape)"
  printf '"resource":{"uri":"%s","url":"%s"},' "$(printf '%s' "$res_url" | json_escape)" "$(printf '%s' "$res_url" | json_escape)"
  if [ -n "$thumb" ]; then
    printf '"thumbnail":{"uri":"%s"},' "$(printf '%s' "$thumb" | json_escape)"
  fi
  printf '"comment":"%s","file":""' "$(printf '%s' "$desc_body" | json_escape)"
  printf '}'
  printf '}'
}

read_params
session_user_id=$(is-login || true)
req_user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
[ -n "${session_user_id:-}" ] || text_response 'ERROR NOT LOGGED IN'
if [ -n "${req_user_id:-}" ] && [ "$req_user_id" != "$session_user_id" ]; then
  text_response 'ERROR USER MISMATCH'
fi
user_id=$session_user_id
resource_dir=$(resolve_env_path resource "$user_id" || true)
[ -n "${resource_dir:-}" ] || text_response 'ERROR RESOURCE DIR NOT DEFINED'
[ -d "$resource_dir" ] || mkdir -p "$resource_dir"

year=$(nameread year "$CGIVARS" | strip_quotes || true)
month=$(nameread month "$CGIVARS" | strip_quotes || true)
date_filter=$(nameread date "$CGIVARS" | strip_quotes || true)
term=$(nameread term "$CGIVARS" | strip_quotes || true)
month_key=""
if [ -n "${year:-}" ] && [ -n "${month:-}" ]; then
  month_key=$(printf '%04d-%02d' "$year" "$month" 2>/dev/null || true)
fi

find "$resource_dir" -type f -name resource.json -printf '%T@ %p\n' 2>/dev/null | sort -rn | awk '{sub(/^[^ ]+ /,""); print}' > "$FOUND"

json_header
printf '{"total":'
total=$(wc -l < "$FOUND" | tr -d '[:space:]')
printf '%s,' "${total:-0}"
printf '"start":0,"count_org":'

count=0
days=""
months=""
records_tmp="${Tmp}-records"
: > "$records_tmp"
while IFS= read -r path; do
  rel=${path#"$resource_dir"/}
  d=$(resource_date_from_rel "$rel")
  [ -n "$month_key" ] && case "$d" in "$month_key"-*) ;; *) continue ;; esac
  [ -n "$date_filter" ] && [ "$d" != "$date_filter" ] && continue
  [ -n "$term" ] && ! grep -Fqi -- "$term" "$path" && continue
  [ -n "$d" ] && case "_$days_" in *"_$d_"*) ;; *) days="${days}${days:+_}$d" ;; esac
  m=${d%-*}
  [ -n "$m" ] && case " $months " in *" $m "*) ;; *) months="${months}${months:+ }$m" ;; esac
  [ "$count" -gt 0 ] && printf ',' >> "$records_tmp"
  emit_record "$resource_dir" "$path" "$user_id" >> "$records_tmp"
  count=$((count + 1))
done < "$FOUND"

printf '%s,"count":%s,"year":"%s","month":"%s","date":"%s","days":"%s","months":[' "$count" "$count" "$(printf '%s' "$year" | json_escape)" "$(printf '%s' "$month" | json_escape)" "$(printf '%s' "$date_filter" | json_escape)" "$(printf '%s' "$days" | json_escape)"
mi=0
for m in $months; do
  [ "$mi" -gt 0 ] && printf ','
  printf '"%s"' "$(printf '%s' "$m" | json_escape)"
  mi=$((mi + 1))
done
printf '],"r":['
cat "$records_tmp"
printf ']}'
rm -f "$records_tmp"
