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

emit_upload_manifest_record() {
  root=$1
  path=$2
  uid=$3
  rel=${path#"$root"/}
  dir=${rel%/*}
  id=$(json_string_field id "$path")
  [ -n "$id" ] || id=$(basename "$(dirname "$path")")
  title=$(json_string_field title "$path")
  name=${title:-$id}
  kind=$(json_string_field kind "$path")
  created=$(json_string_field created_at "$path")
  original_file=$(json_nested_string_field original file "$path")
  original_display=$(json_nested_string_field original display_name "$path")
  original_mime=$(json_nested_string_field original mime "$path")
  original_size=$(json_nested_string_field original size "$path")
  original_sha=$(json_nested_string_field original sha256 "$path")
  thumb_file=$(json_nested_string_field thumbnail file "$path")
  thumb_mime=$(json_nested_string_field thumbnail mime "$path")
  thumb_size=$(json_nested_string_field thumbnail size "$path")
  thumb_sha=$(json_nested_string_field thumbnail sha256 "$path")
  preview_file=$(json_nested_string_field preview file "$path")
  preview_mime=$(json_nested_string_field preview mime "$path")
  preview_size=$(json_nested_string_field preview size "$path")
  preview_sha=$(json_nested_string_field preview sha256 "$path")
  [ -n "$name" ] || name=$original_display
  [ -n "$name" ] || name=$original_file
  [ -n "$kind" ] || kind=general
  [ -n "$original_mime" ] || original_mime=application/octet-stream
  [ -n "$original_size" ] || original_size=0
  [ -n "$thumb_mime" ] || thumb_mime=image/jpeg
  [ -n "$thumb_size" ] || thumb_size=0
  [ -n "$preview_mime" ] || preview_mime=application/pdf
  [ -n "$preview_size" ] || preview_size=0

  date=$(resource_date_from_rel "$rel")
  ts=${created:-${date}T00:00:00}
  original_path=""
  [ -n "$original_file" ] && original_path="$dir/$original_file"
  thumb_path=""
  [ -n "$thumb_file" ] && thumb_path="$dir/$thumb_file"
  preview_path=""
  [ -n "$preview_file" ] && preview_path="$dir/$preview_file"
  original_url=$(file_rel_url "$uid" upload "$original_path")
  thumb_url=$(file_rel_url "$uid" upload "$thumb_path")
  preview_url=$(file_rel_url "$uid" upload "$preview_path")
  [ -n "$preview_url" ] || preview_url=$original_url
  viewer=iframe
  case "$kind:$original_mime" in
    video:*|*:video/*) viewer=video ;;
    image:*|*:image/*) viewer=image ;;
    *:application/pdf) viewer=pdf ;;
  esac

  printf '{'
  printf '"id":"%s",' "$(printf '%s' "$id" | json_escape)"
  printf '"resource":{'
  printf '"id":"%s","type":"Resource",' "$(printf '%s' "$id" | json_escape)"
  printf '"label":"%s",' "$(printf '%s' "$name" | json_escape)"
  printf '"identity":{"title":"%s","canonicalUri":"%s","uri":"%s"},' "$(printf '%s' "$name" | json_escape)" "$(printf '%s' "$original_url" | json_escape)" "$(printf '%s' "$preview_url" | json_escape)"
  printf '"media":{"kind":"%s","mimeType":"%s","downloadable":true},' "$(printf '%s' "$kind" | json_escape)" "$(printf '%s' "$original_mime" | json_escape)"
  printf '"viewer":{"defaultMode":"infoPane","embed":{"enabled":true,"uri":"%s"},"thumbnailUri":"%s"},' "$(printf '%s' "$preview_url" | json_escape)" "$(printf '%s' "$thumb_url" | json_escape)"
  printf '"storage":{"managed":true,"copyPolicy":"reference","manifest":{"area":"upload","path":"%s"},"files":[' "$(printf '%s' "$rel" | json_escape)"
  printf '{"role":"original","area":"upload","path":"%s","mimeType":"%s","size":%s,"sha256":"%s"}' "$(printf '%s' "$original_path" | json_escape)" "$(printf '%s' "$original_mime" | json_escape)" "$original_size" "$(printf '%s' "$original_sha" | json_escape)"
  if [ -n "$thumb_path" ]; then
    printf ',{"role":"thumbnail","area":"upload","path":"%s","mimeType":"%s","size":%s,"sha256":"%s"}' "$(printf '%s' "$thumb_path" | json_escape)" "$(printf '%s' "$thumb_mime" | json_escape)" "$thumb_size" "$(printf '%s' "$thumb_sha" | json_escape)"
  fi
  if [ -n "$preview_path" ]; then
    printf ',{"role":"preview","area":"upload","path":"%s","mimeType":"%s","size":%s,"sha256":"%s"}' "$(printf '%s' "$preview_path" | json_escape)" "$(printf '%s' "$preview_mime" | json_escape)" "$preview_size" "$(printf '%s' "$preview_sha" | json_escape)"
  fi
  printf ']},'
  printf '"audit":{"owner":"%s","createdBy":"%s","createdAt":"%s","lastModifiedBy":"","lastModifiedAt":""}' "$(printf '%s' "$uid" | json_escape)" "$(printf '%s' "$uid" | json_escape)" "$(printf '%s' "$ts" | json_escape)"
  printf '},'
  printf '"label":"%s",' "$(printf '%s' "$name" | json_escape)"
  printf '"description":{},'
  printf '"name":"%s",' "$(printf '%s' "$name" | json_escape)"
  printf '"option":"upload",'
  printf '"contenttype":"%s",' "$(printf '%s' "$original_mime" | json_escape)"
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
upload_dir=$(resolve_env_path upload "$user_id" || true)
[ -n "${upload_dir:-}" ] || text_response 'ERROR UPLOAD DIR NOT DEFINED'
[ -d "$upload_dir" ] || mkdir -p "$upload_dir"

year=$(nameread year "$CGIVARS" | strip_quotes || true)
month=$(nameread month "$CGIVARS" | strip_quotes || true)
date_filter=$(nameread date "$CGIVARS" | strip_quotes || true)
start_date=$(nameread start_date "$CGIVARS" | strip_quotes || true)
end_date=$(nameread end_date "$CGIVARS" | strip_quotes || true)
term=$(nameread term "$CGIVARS" | strip_quotes || true)
month_key=""
if [ -n "${year:-}" ] && [ -n "${month:-}" ]; then
  month_key=$(printf '%04d-%02d' "$year" "$month" 2>/dev/null || true)
fi

: > "$FOUND"
if [ -n "${upload_dir:-}" ] && [ -d "$upload_dir" ]; then
  find "$upload_dir" -type f -name manifest.json -printf '%T@ upload %p\n' 2>/dev/null >> "$FOUND"
fi
sort -rn "$FOUND" > "$FOUND.sorted" && mv "$FOUND.sorted" "$FOUND"
: > "$SEEN"

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
while IFS= read -r found_line; do
  source_type=$(printf '%s' "$found_line" | awk '{print $2}')
  path=$(printf '%s' "$found_line" | awk '{sub(/^[^ ]+ [^ ]+ /,""); print}')
  [ "$source_type" = "upload" ] || continue
  root=$upload_dir
  rel=${path#"$root"/}
  d=$(resource_date_from_rel "$rel")
  [ -n "$month_key" ] && case "$d" in "$month_key"-*) ;; *) continue ;; esac
  [ -n "$date_filter" ] && [ "$d" != "$date_filter" ] && continue
  [ -n "$start_date" ] && { [ -n "$d" ] || continue; [ "$d" \< "$start_date" ] && continue; }
  [ -n "$end_date" ] && { [ -n "$d" ] || continue; [ "$d" \> "$end_date" ] && continue; }
  [ -n "$term" ] && ! grep -Fqi -- "$term" "$path" && continue
  record_id=$(json_string_field id "$path")
  [ -n "$record_id" ] || record_id=$(basename "$(dirname "$path")")
  if grep -Fxq "$record_id" "$SEEN" 2>/dev/null; then
    continue
  fi
  printf '%s\n' "$record_id" >> "$SEEN"
  [ -n "$d" ] && case "_${days}_" in *"_${d}_"*) ;; *) days="${days}${days:+_}$d" ;; esac
  m=${d%-*}
  [ -n "$m" ] && case " $months " in *" $m "*) ;; *) months="${months}${months:+ }$m" ;; esac
  [ "$count" -gt 0 ] && printf ',' >> "$records_tmp"
  emit_upload_manifest_record "$upload_dir" "$path" "$user_id" >> "$records_tmp"
  count=$((count + 1))
done < "$FOUND"

printf '%s,"count":%s,"year":"%s","month":"%s","date":"%s","start_date":"%s","end_date":"%s","days":"%s","months":[' "$count" "$count" "$(printf '%s' "$year" | json_escape)" "$(printf '%s' "$month" | json_escape)" "$(printf '%s' "$date_filter" | json_escape)" "$(printf '%s' "$start_date" | json_escape)" "$(printf '%s' "$end_date" | json_escape)" "$(printf '%s' "$days" | json_escape)"
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
