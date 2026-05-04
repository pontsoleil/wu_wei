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
SEEN="${Tmp}-seen"
trap 'rm -f "$CGIVARS" "$FOUND" "$SEEN"' EXIT HUP INT TERM

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
  printf '%s' "$1" | sed 's/%/%25/g; s/ /%20/g; s#/#%2F#g; s/&/%26/g; s/?/%3F/g; s/=/%3D/g'
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

json_nested_string_field() {
  parent=$1
  key=$2
  file=$3
  json_object_field "$parent" "$file" | awk -v k="$key" '
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
  '
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

json_number_field() {
  key=$1
  file=$2
  awk -v k="$key" '
    BEGIN { RS=""; ORS="" }
    {
      pat = "\"" k "\"[ \t\r\n]*:[ \t\r\n]*"
      p = match($0, pat)
      if (!p) exit
      s = substr($0, RSTART + RLENGTH)
      if (match(s, /^-?[0-9]+(\.[0-9]+)?/)) print substr(s, RSTART, RLENGTH)
    }
  ' "$file"
}

storage_file_value() {
  role=$1
  key=$2
  file=$3
  awk -v role="$role" -v key="$key" '
    function emit_value(obj,    pat,p,s,i,c,out,esc) {
      pat = "\"" key "\"[ \t\r\n]*:[ \t\r\n]*"
      p = match(obj, pat)
      if (!p) return
      s = substr(obj, RSTART + RLENGTH)
      if (substr(s, 1, 1) == "\"") {
        s = substr(s, 2)
        out = ""; esc = 0
        for (i = 1; i <= length(s); i++) {
          c = substr(s, i, 1)
          if (esc) { out = out c; esc = 0; continue }
          if (c == "\\") { out = out c; esc = 1; continue }
          if (c == "\"") break
          out = out c
        }
        print out
      } else {
        if (match(s, /^[^,}\r\n]+/)) {
          out = substr(s, RSTART, RLENGTH)
          gsub(/^[ \t]+|[ \t]+$/, "", out)
          print out
        }
      }
    }
    /"files"[ \t\r\n]*:/ { in_files = 1 }
    in_files {
      if (!in_obj && $0 ~ /\{/) { in_obj = 1; obj = $0 "\n"; next }
      if (in_obj) {
        obj = obj $0 "\n"
        if ($0 ~ /\}/) {
          if (obj ~ "\"" "role" "\"[ \t\r\n]*:[ \t\r\n]*\"" role "\"") {
            emit_value(obj)
            exit
          }
          in_obj = 0
          obj = ""
        }
      }
    }
  ' "$file"
}

resource_hidden() {
  file=$1
  awk '
    BEGIN { RS=""; hidden=0 }
    /"hiddenFromHome"[ \t\r\n]*:[ \t\r\n]*true/ { hidden=1 }
    /"home"[ \t\r\n]*:[ \t\r\n]*\{/ && /"hidden"[ \t\r\n]*:[ \t\r\n]*true/ { hidden=1 }
    END { exit hidden ? 0 : 1 }
  ' "$file"
}

resource_current_format() {
  file=$1
  awk '
    BEGIN { RS=""; ok=1 }
    /"storage"[ \t\r\n]*:[ \t\r\n]*\{/ && /"files"[ \t\r\n]*:[ \t\r\n]*\[/ && !/"area"[ \t\r\n]*:/ { ok=0 }
    END { exit ok ? 0 : 1 }
  ' "$file"
}

emit_resource_record() {
  root=$1
  path=$2
  uid=$3
  rel=${path#"$root"/}
  id=$(json_string_field id "$path")
  [ -n "$id" ] || id=$(basename "$(dirname "$path")")
  title=$(json_nested_string_field identity title "$path")
  label=$(json_string_field label "$path")
  name=${label:-${title:-$id}}
  kind=$(json_nested_string_field media kind "$path")
  mime=$(json_nested_string_field media mimeType "$path")
  [ -n "$kind" ] || kind=general
  [ -n "$mime" ] || mime=application/octet-stream
  created=$(json_nested_string_field audit createdAt "$path")
  modified=$(json_nested_string_field audit lastModifiedAt "$path")
  date=$(resource_date_from_rel "$rel")
  ts=${modified:-${created:-${date}T00:00:00}}

  original_area=$(storage_file_value original area "$path")
  original_path=$(storage_file_value original path "$path")
  original_size=$(storage_file_value original size "$path")
  thumb_area=$(storage_file_value thumbnail area "$path")
  thumb_path=$(storage_file_value thumbnail path "$path")
  preview_area=$(storage_file_value preview area "$path")
  preview_path=$(storage_file_value preview path "$path")
  original_url=$(file_rel_url "$uid" "$original_area" "$original_path")
  thumb_url=$(file_rel_url "$uid" "$thumb_area" "$thumb_path")
  preview_url=$(file_rel_url "$uid" "$preview_area" "$preview_path")
  embed_url=$(json_nested_string_field embed uri "$path")
  identity_uri=$(json_nested_string_field identity uri "$path")
  canonical_uri=$(json_nested_string_field identity canonicalUri "$path")
  public_url=${embed_url:-${identity_uri:-$canonical_uri}}
  [ -n "$original_url" ] || original_url=$public_url
  [ -n "$preview_url" ] || preview_url=$original_url
  [ -n "$thumb_url" ] || thumb_url=$(json_string_field thumbnailUri "$path")
  [ -n "$original_size" ] || original_size=0
  viewer=iframe
  case "$kind:$mime" in
    video:*|*:video/*) viewer=video ;;
    image:*|*:image/*) viewer=image ;;
    *:application/pdf) viewer=pdf ;;
  esac
  option=upload
  case "$kind" in
    video:*) option=video ;;
  esac
  if [ "$option" = "upload" ] && [ -z "$original_path" ]; then
    case "$public_url" in http://*|https://*) option=webpage ;; esac
  fi
  desc_obj=$(json_object_field description "$path")
  [ -n "$desc_obj" ] || desc_obj='{}'

  printf '{'
  printf '"id":"%s",' "$(printf '%s' "$id" | json_escape)"
  printf '"resource":'
  cat "$path"
  printf ','
  printf '"label":"%s",' "$(printf '%s' "$name" | json_escape)"
  printf '"description":%s,' "$desc_obj"
  printf '"name":"%s",' "$(printf '%s' "$name" | json_escape)"
  printf '"option":"%s",' "$(printf '%s' "$option" | json_escape)"
  printf '"contenttype":"%s",' "$(printf '%s' "$mime" | json_escape)"
  printf '"uri":"%s",' "$(printf '%s' "$original_url" | json_escape)"
  printf '"url":"%s",' "$(printf '%s' "$preview_url" | json_escape)"
  printf '"download_url":"%s",' "$(printf '%s' "$original_url" | json_escape)"
  printf '"preview_url":"%s",' "$(printf '%s' "$preview_url" | json_escape)"
  printf '"thumbnail_url":"%s",' "$(printf '%s' "$thumb_url" | json_escape)"
  printf '"value":{'
  printf '"lastmodified":"%s",' "$(printf '%s' "$ts" | sed 's/T/ /' | json_escape)"
  printf '"totalsize":"%s",' "$(printf '%s' "$original_size" | json_escape)"
  printf '"viewerType":"%s",' "$viewer"
  printf '"previewUri":"%s",' "$(printf '%s' "$preview_url" | json_escape)"
  printf '"resource":{"uri":"%s","url":"%s"},' "$(printf '%s' "$original_url" | json_escape)" "$(printf '%s' "$original_url" | json_escape)"
  if [ -n "$thumb_url" ]; then
    printf '"thumbnail":{"uri":"%s"},' "$(printf '%s' "$thumb_url" | json_escape)"
  fi
  printf '"comment":"","file":""'
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
start_date=$(nameread start_date "$CGIVARS" | strip_quotes || true)
end_date=$(nameread end_date "$CGIVARS" | strip_quotes || true)
term=$(nameread term "$CGIVARS" | strip_quotes || true)
start=$(nameread start "$CGIVARS" | strip_quotes || true)
count_req=$(nameread count "$CGIVARS" | strip_quotes || true)
case "$start" in ''|*[!0-9]*) start=0 ;; esac
case "$count_req" in ''|*[!0-9]*) count_req=0 ;; esac
month_key=""
if [ -n "${year:-}" ] && [ -n "${month:-}" ]; then
  month_key=$(printf '%04d-%02d' "$year" "$month" 2>/dev/null || true)
fi

: > "$FOUND"
if [ -n "${resource_dir:-}" ] && [ -d "$resource_dir" ]; then
  find "$resource_dir" -type f -name resource.json -printf '%T@ resource %p\n' 2>/dev/null >> "$FOUND"
fi
sort -rn "$FOUND" > "$FOUND.sorted" && mv "$FOUND.sorted" "$FOUND"
: > "$SEEN"

count_out=0
count_org=0
seen_index=0
days=""
months=""
records_tmp="${Tmp}-records"
logs_tmp="${Tmp}-logs"
: > "$records_tmp"
: > "$logs_tmp"
while IFS= read -r found_line; do
  source_type=$(printf '%s' "$found_line" | awk '{print $2}')
  path=$(printf '%s' "$found_line" | awk '{sub(/^[^ ]+ [^ ]+ /,""); print}')
  [ "$source_type" = "resource" ] || continue
  root=$resource_dir
  rel=${path#"$root"/}
  d=$(resource_date_from_rel "$rel")
  [ -n "$month_key" ] && case "$d" in "$month_key"-*) ;; *) continue ;; esac
  [ -n "$date_filter" ] && [ "$d" != "$date_filter" ] && continue
  [ -n "$start_date" ] && { [ -n "$d" ] || continue; [ "$d" \< "$start_date" ] && continue; }
  [ -n "$end_date" ] && { [ -n "$d" ] || continue; [ "$d" \> "$end_date" ] && continue; }
  [ -n "$term" ] && ! grep -Fqi -- "$term" "$path" && continue
  type_field=$(json_string_field type "$path")
  if [ "$type_field" != "Resource" ]; then
    printf 'list-resource.cgi: skipped non-current resource format: %s\n' "$rel" >> "$logs_tmp"
    continue
  fi
  if ! resource_current_format "$path"; then
    printf 'list-resource.cgi: skipped resource without storage file area: %s\n' "$rel" >> "$logs_tmp"
    continue
  fi
  if resource_hidden "$path"; then
    continue
  fi
  record_id=$(json_string_field id "$path")
  [ -n "$record_id" ] || record_id=$(basename "$(dirname "$path")")
  if [ -z "$record_id" ]; then
    printf 'list-resource.cgi: skipped resource without id: %s\n' "$rel" >> "$logs_tmp"
    continue
  fi
  if grep -Fxq "$record_id" "$SEEN" 2>/dev/null; then
    continue
  fi
  printf '%s\n' "$record_id" >> "$SEEN"
  count_org=$((count_org + 1))
  [ -n "$d" ] && case "_${days}_" in *"_${d}_"*) ;; *) days="${days}${days:+_}$d" ;; esac
  m=${d%-*}
  [ -n "$m" ] && case " $months " in *" $m "*) ;; *) months="${months}${months:+ }$m" ;; esac
  if [ "$seen_index" -lt "$start" ]; then
    seen_index=$((seen_index + 1))
    continue
  fi
  if [ "$count_req" -gt 0 ] && [ "$count_out" -ge "$count_req" ]; then
    seen_index=$((seen_index + 1))
    continue
  fi
  [ "$count_out" -gt 0 ] && printf ',' >> "$records_tmp"
  emit_resource_record "$resource_dir" "$path" "$user_id" >> "$records_tmp"
  count_out=$((count_out + 1))
  seen_index=$((seen_index + 1))
done < "$FOUND"

json_header
printf '{"total":%s,"start":%s,"count_org":%s,"count":%s,"year":"%s","month":"%s","date":"%s","start_date":"%s","end_date":"%s","days":"%s","months":[' "$count_org" "$start" "$count_org" "$count_out" "$(printf '%s' "$year" | json_escape)" "$(printf '%s' "$month" | json_escape)" "$(printf '%s' "$date_filter" | json_escape)" "$(printf '%s' "$start_date" | json_escape)" "$(printf '%s' "$end_date" | json_escape)" "$(printf '%s' "$days" | json_escape)"
mi=0
for m in $months; do
  [ "$mi" -gt 0 ] && printf ','
  printf '"%s"' "$(printf '%s' "$m" | json_escape)"
  mi=$((mi + 1))
done
printf '],"r":['
cat "$records_tmp"
printf '],"logs":['
li=0
while IFS= read -r log_line; do
  [ -n "$log_line" ] || continue
  [ "$li" -gt 0 ] && printf ','
  printf '"%s"' "$(printf '%s' "$log_line" | json_escape)"
  li=$((li + 1))
done < "$logs_tmp"
printf ']}'
rm -f "$records_tmp" "$logs_tmp"
