#!/bin/sh
# import-note.cgi
# Standalone shell CGI for importing a WuWei note package.
# Uses only shell, sed, awk, unzip, cp, mkdir and optional sha256sum.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1
mkdir -p log
exec 2>>"$SCRIPT_DIR/log/cgi.err"

set -eu
export LC_ALL=C
if command -v getconf >/dev/null 2>&1; then
  export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
fi
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"
UPLOAD_ZIP="${Tmp}-upload.zip"
FIELDS="${Tmp}-fields"
ENTRIES="${Tmp}-entries"
RAW_POST="${Tmp}-raw-post"
MANIFEST_TMP="${Tmp}-export-manifest.json"
NOTE_TMP="${Tmp}-note.json"
NOTE_OUT="${Tmp}-note-out.json"
TAB=$(printf '\t')

cleanup() {
  rm -f "$UPLOAD_ZIP" "$FIELDS" "$ENTRIES" "$RAW_POST" "$MANIFEST_TMP" "$NOTE_TMP" "$NOTE_OUT" "$Tmp"-* 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM

log_debug() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >> "$SCRIPT_DIR/log/import-note.debug.log" || true
}

text_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '%s\r\n' 'Cache-Control: no-store'
  printf '\r\n'
  printf '%s\n' "$1"
  log_debug "$1"
  exit 0
}

json_file_response() {
  printf '%s\r\n' 'Content-Type: application/json; charset=UTF-8'
  printf '%s\r\n' 'Cache-Control: no-store'
  printf '\r\n'
  cat "$1"
  case "$(tail -c 1 "$1" 2>/dev/null || true)" in
    '') ;;
    *) printf '\n' ;;
  esac
  exit 0
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

decode_minimal() {
  sed 's/+/ /g; s/%2[Ff]/\//g; s/%2[Dd]/-/g; s/%5[Ff]/_/g; s/%40/@/g; s/%3[Aa]/:/g; s/%20/ /g; s/%0[Dd]//g; s/%0[Aa]//g; s/%3[Dd]/=/g'
}

raw_query_param() {
  key=$1
  printf '%s' "${QUERY_STRING:-}" |
    tr '&' '\n' |
    sed -n "s/^${key}=//p" |
    head -n 1 |
    decode_minimal
}

field_value() {
  key=$1
  if [ -f "$FIELDS" ]; then
    sed -n "s/^${key}=//p" "$FIELDS" | head -n 1 | decode_minimal
  fi
}

valid_user_id() {
  case "$1" in
    ''|*/*|*..*|ERROR*) return 1 ;;
    *[!A-Za-z0-9._-]*) return 1 ;;
    *) return 0 ;;
  esac
}

normalise_path_text() {
  sed 's#\\#/#g; s#^\./##; s#^/*##; s#/*$##; :a; s#//#/#g; ta'
}

safe_rel_path() {
  rel=$(printf '%s' "$1" | tr -d '\r' | normalise_path_text)
  [ -n "$rel" ] || return 1
  case "$rel" in
    /*|*'/../'*|'../'*|*'/..'|'.'|'..') return 1 ;;
  esac
  printf '%s\n' "$rel" | awk '
    BEGIN { ok = 1 }
    {
      n = split($0, a, "/")
      for (i = 1; i <= n; i++) {
        if (a[i] == "" || a[i] == "." || a[i] == "..") { ok = 0 }
      }
      if (ok) { print $0 }
    }
    END { exit(ok ? 0 : 1) }
  '
}

safe_zip_entry() {
  entry=$(printf '%s' "$1" | tr -d '\r' | normalise_path_text)
  [ -n "$entry" ] || return 1
  case "$entry" in
    /*|*'/../'*|'../'*|*'/..'|'.'|'..') return 1 ;;
  esac
  printf '%s\n' "$entry" | awk '
    BEGIN { ok = 1 }
    {
      n = split($0, a, "/")
      for (i = 1; i <= n; i++) {
        if (a[i] == "" || a[i] == "." || a[i] == "..") { ok = 0 }
      }
      if (ok) { print $0 }
    }
    END { exit(ok ? 0 : 1) }
  '
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

area_dir() {
  area=$1
  uid=$2
  path=$(resolve_env_path "$area" "$uid" || true)
  if [ -n "$path" ]; then
    printf '%s\n' "$path"
    return 0
  fi
  note_base=$(resolve_env_path note "$uid" || true)
  if [ -n "$note_base" ]; then
    printf '%s/%s\n' "$(dirname "$note_base")" "$area"
    return 0
  fi
  return 1
}

extract_boundary() {
  printf '%s' "$1" | sed -n '
    s/.*boundary="\([^"]*\)".*/\1/p
    t done
    s/.*boundary=\([^;]*\).*/\1/p
    :done
  ' | head -n 1 | sed 's/^ *//; s/ *$//'
}

parse_multipart_with_awk() {
  boundary=$1
  : > "$FIELDS"
  rm -f "$UPLOAD_ZIP"
  awk -v boundary="$boundary" -v zipfile="$UPLOAD_ZIP" -v fieldsfile="$FIELDS" '
    function regex_quote(s) {
      gsub(/[][\\.^$*+?(){}|]/, "\\\\&", s)
      return s
    }
    function header_param(headers, key,    re, s) {
      re = key "=\"[^\"]*\""
      if (match(headers, re)) {
        s = substr(headers, RSTART + length(key) + 2, RLENGTH - length(key) - 3)
        return s
      }
      return ""
    }
    function encode_field(s) {
      gsub(/%/, "%25", s)
      gsub(/=/, "%3D", s)
      gsub(/\r/, "%0D", s)
      gsub(/\n/, "%0A", s)
      return s
    }
    BEGIN {
      RS = "--" regex_quote(boundary)
      ORS = ""
      got_file = 0
    }
    NR == 1 { next }
    {
      part = $0
      if (part ~ /^--/) { next }
      sub(/^\r?\n/, "", part)
      sub(/\r?\n$/, "", part)

      pos = index(part, "\r\n\r\n")
      sep = 4
      if (!pos) {
        pos = index(part, "\n\n")
        sep = 2
      }
      if (!pos) { next }

      headers = substr(part, 1, pos - 1)
      content = substr(part, pos + sep)
      sub(/\r?\n$/, "", content)

      name = header_param(headers, "name")
      filename = header_param(headers, "filename")
      if (name == "") { next }

      if (filename != "" || name == "file") {
        printf "%s", content > zipfile
        close(zipfile)
        got_file = 1
      }
      else {
        sub(/[\r\n].*$/, "", content)
        print name "=" encode_field(content) "\n" >> fieldsfile
      }
    }
    END { exit(got_file ? 0 : 5) }
  ' "$RAW_POST"
}

parse_request() {
  method=${REQUEST_METHOD:-}
  [ "$method" = 'POST' ] || text_response 'ERROR POST ONLY'
  ctype=${CONTENT_TYPE:-}
  cl=${CONTENT_LENGTH:-0}
  [ "${cl:-0}" -gt 0 ] 2>/dev/null || text_response 'ERROR EMPTY REQUEST'
  case "$ctype" in
    multipart/form-data*)
      cat > "$RAW_POST"
      boundary=$(extract_boundary "$ctype")
      [ -n "$boundary" ] || text_response 'ERROR INVALID MULTIPART BOUNDARY'
      set +e
      parse_multipart_with_awk "$boundary"
      rc=$?
      set -e
      [ "$rc" -eq 0 ] || text_response 'ERROR FILE NOT UPLOADED'
      ;;
    *)
      text_response 'ERROR UNSUPPORTED CONTENT TYPE'
      ;;
  esac
}

list_zip_entries() {
  if command -v zipinfo >/dev/null 2>&1; then
    zipinfo -1 "$UPLOAD_ZIP" | sed 's/\r$//' > "$ENTRIES"
  else
    unzip -Z1 "$UPLOAD_ZIP" | sed 's/\r$//' > "$ENTRIES"
  fi
}

copy_zip_entry() {
  entry=$1
  target=$2
  mkdir -p "$(dirname "$target")"
  unzip -p "$UPLOAD_ZIP" "$entry" > "$target"
}

extract_manifest_resource_files() {
  manifest_file=$1
  awk '
    function json_value(seg, key,    re, rest) {
      re = "\\\"" key "\\\"[[:space:]]*:[[:space:]]*\\\""
      if (!match(seg, re)) { return "" }
      rest = substr(seg, RSTART + RLENGTH)
      sub(/\\".*/, "", rest)
      return rest
    }
    { s = s $0 }
    END {
      gsub(/\r/, "", s)
      gsub(/\n/, " ", s)
      gsub(/}[[:space:]]*,[[:space:]]*{/, "}\n{", s)
      n = split(s, a, "\n")
      for (i = 1; i <= n; i++) {
        seg = a[i]
        if (seg ~ /\\"path\\"[[:space:]]*:[[:space:]]*\\"resources\//) {
          role = json_value(seg, "role")
          arc = json_value(seg, "path")
          logical = json_value(seg, "logicalPath")
          area = json_value(seg, "sourceArea")
          sha = json_value(seg, "sha256")
          mime = json_value(seg, "mimeType")
          if (arc != "" && logical != "") {
            print role "\t" arc "\t" logical "\t" area "\t" sha "\t" mime
          }
        }
      }
    }
  ' "$manifest_file"
}

copy_manifest_resource_entries() {
  uid=$1
  manifest_file=$2
  [ -f "$manifest_file" ] || return 0

  extract_manifest_resource_files "$manifest_file" |
  while IFS="$TAB" read -r role arc logical source_area sha mime; do
    [ -n "${arc:-}" ] || continue
    [ -n "${logical:-}" ] || continue
    arc=$(safe_zip_entry "$arc") || { log_debug "SKIP INVALID RESOURCE ARC [$arc]"; continue; }
    case "$arc" in resources/*) ;; *) log_debug "SKIP NON RESOURCE ARC [$arc]"; continue ;; esac
    logical=$(safe_rel_path "$logical") || { log_debug "SKIP INVALID RESOURCE LOGICAL PATH [$logical]"; continue; }

    case "${source_area:-}" in
      upload|content|thumbnail|resource|note) ;;
      '')
        case "${role:-}" in thumbnail) source_area=thumbnail ;; *) source_area=upload ;; esac
        ;;
      *) source_area=upload ;;
    esac

    base=$(area_dir "$source_area" "$uid" || true)
    [ -n "$base" ] || { log_debug "SKIP RESOURCE AREA NOT FOUND area=[$source_area] logical=[$logical]"; continue; }

    tmp_file="${Tmp}-resource-copy"
    copy_zip_entry "$arc" "$tmp_file" || { log_debug "SKIP RESOURCE COPY FROM ZIP FAILED arc=[$arc]"; rm -f "$tmp_file"; continue; }

    if [ -n "${sha:-}" ] && command -v sha256sum >/dev/null 2>&1; then
      actual_sha=$(sha256sum "$tmp_file" | awk '{print $1}')
      if [ "$actual_sha" != "$sha" ]; then
        log_debug "SKIP RESOURCE SHA256 MISMATCH logical=[$logical]"
        rm -f "$tmp_file"
        continue
      fi
    fi

    target="$base/$logical"
    case "$target" in "$base"/*) ;; *) log_debug "SKIP RESOURCE TARGET OUTSIDE BASE [$target]"; rm -f "$tmp_file"; continue ;; esac

    if [ -f "$target" ] && command -v sha256sum >/dev/null 2>&1; then
      existing_sha=$(sha256sum "$target" | awk '{print $1}')
      new_sha=$(sha256sum "$tmp_file" | awk '{print $1}')
      if [ "$existing_sha" != "$new_sha" ]; then
        log_debug "RESOURCE FILE CONFLICT target=[$target]"
        rm -f "$tmp_file"
        continue
      fi
    fi

    mkdir -p "$(dirname "$target")"
    cp -p "$tmp_file" "$target"
    rm -f "$tmp_file"
    log_debug "RESOURCE RESTORED area=[$source_area] path=[$logical]"
  done
}

write_upload_path_indexes() {
  uid=$1
  manifest_file=$2
  upload_base=$(area_dir upload "$uid" || true)
  [ -n "$upload_base" ] || return 0
  [ -f "$manifest_file" ] || return 0

  extract_manifest_resource_files "$manifest_file" |
  while IFS="$TAB" read -r role arc logical source_area sha mime; do
    [ "${source_area:-}" = upload ] || continue
    logical=$(safe_rel_path "$logical") || continue
    case "$logical" in [0-9][0-9][0-9][0-9]/[0-9][0-9]/[0-9][0-9]/*/*) ;; *) continue ;; esac
    actual_date=$(printf '%s' "$logical" | awk -F/ '{print $1"/"$2"/"$3}')
    upload_id=$(printf '%s' "$logical" | awk -F/ '{print $4}')
    file_name=$(basename "$logical")
    logical_base=$(dirname "$logical")
    index_file="$upload_base/_index/path/$logical.json"
    mkdir -p "$(dirname "$index_file")"
    awk -v logical="$logical" -v upload_id="$upload_id" -v actual_date="$actual_date" -v file_name="$file_name" -v manifest_path="$logical_base/manifest.json" '
      BEGIN {
        printf "{\n"
        printf "  \"logicalPath\": \"%s\",\n", logical
        printf "  \"upload_id\": \"%s\",\n", upload_id
        printf "  \"actual_date\": \"%s\",\n", actual_date
        printf "  \"date\": \"%s\",\n", actual_date
        printf "  \"file\": \"%s\",\n", file_name
        printf "  \"manifest\": \"%s\"\n", manifest_path
        printf "}\n"
      }
    ' > "$index_file"
  done
}

copy_area_entries() {
  area=$1
  uid=$2
  base=$(area_dir "$area" "$uid" || true)
  [ -n "$base" ] || return 0

  grep -E "^${area}/" "$ENTRIES" | while IFS= read -r entry; do
    safe=$(safe_zip_entry "$entry") || continue
    case "$safe" in */) continue ;; esac
    rel=${safe#${area}/}
    rel=$(safe_rel_path "$rel") || continue
    target="$base/$rel"
    case "$target" in "$base"/*) copy_zip_entry "$safe" "$target" ;; esac
  done
}

rewrite_note_for_import() {
  uid=$1
  src=$2
  dst=$3
  sed -E \
    -e "s#\"dir_name\"[[:space:]]*:[[:space:]]*\"data/[^/\"]+/(upload|content|thumbnail|resource|note)#\"dir_name\":\"data/${uid}/\\1#g" \
    "$src" > "$dst"
}

parse_request

session_user_id=$(is-login || true)
user_id=$(field_value user_id || true)
[ -n "${user_id:-}" ] || user_id=$(raw_query_param user_id || true)
[ -n "${user_id:-}" ] || user_id=${session_user_id:-}

[ -n "${user_id:-}" ] || text_response 'ERROR NOT LOGGED IN'
valid_user_id "$user_id" || text_response 'ERROR INVALID USER ID'

if [ "${user_id}" != 'guest' ]; then
  [ -n "${session_user_id:-}" ] || text_response 'ERROR NOT LOGGED IN'
  [ "$user_id" = "$session_user_id" ] || text_response 'ERROR USER MISMATCH'
fi

[ -s "$UPLOAD_ZIP" ] || text_response 'ERROR FILE NOT UPLOADED'
unzip -tq "$UPLOAD_ZIP" >/dev/null 2>&1 || text_response 'ERROR INVALID ZIP FILE'
list_zip_entries || text_response 'ERROR INVALID ZIP FILE'

while IFS= read -r entry; do
  if ! safe_zip_entry "$entry" >/dev/null; then
    log_debug "ERROR INVALID PACKAGE PATH entry=[$entry]"
    text_response 'ERROR INVALID PACKAGE PATH'
  fi
done < "$ENTRIES"

manifest_entry=$(grep -E '^export-manifest\.json$' "$ENTRIES" | head -n 1 || true)
if [ -n "$manifest_entry" ]; then
  copy_zip_entry "$manifest_entry" "$MANIFEST_TMP" || text_response 'ERROR EXPORT MANIFEST NOT FOUND'
fi

note_entry=$(grep -E '^note/.+/note\.json$' "$ENTRIES" | head -n 1 || true)
[ -n "$note_entry" ] || text_response 'ERROR NOTE JSON NOT FOUND'

note_rel=${note_entry#note/}
note_rel=$(safe_rel_path "$note_rel") || text_response 'ERROR INVALID NOTE KEY'
case "$note_rel" in */note.json) ;; *) text_response 'ERROR INVALID NOTE KEY' ;; esac

note_key=${note_rel%/note.json}
[ -n "$note_key" ] || text_response 'ERROR INVALID NOTE KEY'

note_dir=$(area_dir note "$user_id" || true)
[ -n "$note_dir" ] || text_response 'ERROR NOTE DIRECTORY NOT FOUND'
mkdir -p "$note_dir" || text_response 'ERROR NOTE DIRECTORY NOT FOUND'

target_note="$note_dir/$note_rel"
case "$target_note" in "$note_dir"/*) ;; *) text_response 'ERROR INVALID NOTE PATH' ;; esac

replace=$(field_value replace || true)
[ -n "${replace:-}" ] || replace=$(field_value overwrite || true)
[ -n "${replace:-}" ] || replace=$(raw_query_param replace || true)
case "${replace:-}" in 1|true|TRUE|yes|YES|on|ON) replace=1 ;; *) replace=0 ;; esac

copy_zip_entry "$note_entry" "$NOTE_TMP" || text_response 'ERROR NOTE IMPORT FAILED'
rewrite_note_for_import "$user_id" "$NOTE_TMP" "$NOTE_OUT"

if [ -f "$target_note" ]; then
  if cmp -s "$target_note" "$NOTE_OUT"; then
    :
  else
    [ "$replace" = 1 ] || text_response 'ERROR NOTE ALREADY EXISTS'
  fi
fi

if [ -f "$MANIFEST_TMP" ]; then
  copy_manifest_resource_entries "$user_id" "$MANIFEST_TMP"
  write_upload_path_indexes "$user_id" "$MANIFEST_TMP"
fi

copy_area_entries content "$user_id"
copy_area_entries thumbnail "$user_id"
copy_area_entries upload "$user_id"
copy_area_entries resource "$user_id"

mkdir -p "$(dirname "$target_note")"
cp "$NOTE_OUT" "$target_note" || text_response 'ERROR NOTE IMPORT FAILED'

json_file_response "$NOTE_OUT"
