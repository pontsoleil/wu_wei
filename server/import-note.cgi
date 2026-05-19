#!/bin/sh
# import-note.cgi
#
# Import a WuWei note export package by shell CGI.
# On success, return the imported note JSON itself, same as cgi-bin/import-note.py.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1
mkdir -p log
exec 2>>"$SCRIPT_DIR/log/cgi.err"

set -eu
IMPORT_NOTE_CGI_VERSION="2026-05-20-awk-json-response"
export LC_ALL=C
if command -v getconf >/dev/null 2>&1; then
  export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
fi
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"
CGIVARS="${Tmp}-fields"
RAW_POST="${Tmp}-raw-post"
UPLOAD_ZIP="${Tmp}-upload.zip"
ENTRIES="${Tmp}-entries"
WORK_DIR="${Tmp}-work"
MANIFEST_JSON="${Tmp}-manifest.json"
NOTE_JSON_IN="${Tmp}-note-in.json"
NOTE_JSON_OUT="${Tmp}-note-out.json"
RESOURCE_LIST="${Tmp}-resources.tsv"
EXISTING_NORM="${Tmp}-existing.norm"
INCOMING_NORM="${Tmp}-incoming.norm"

cleanup() {
  rm -rf "$CGIVARS" "$RAW_POST" "$UPLOAD_ZIP" "$ENTRIES" "$WORK_DIR" \
         "$MANIFEST_JSON" "$NOTE_JSON_IN" "$NOTE_JSON_OUT" "$RESOURCE_LIST" \
         "$EXISTING_NORM" "$INCOMING_NORM" "$Tmp"-*
}
trap cleanup EXIT HUP INT TERM

log_debug() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >> "$SCRIPT_DIR/log/import-note.debug.log" || true
}

error_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '%s\r\n' 'Cache-Control: no-store'
  printf '\r\n'
  printf '%s\n' "$1"
  log_debug "$1"
  exit 0
}

json_response_file() {
  printf '%s\r\n' 'Content-Type: application/json; charset=UTF-8'
  printf '%s\r\n' 'Cache-Control: no-store'
  printf 'X-WuWei-CGI-Version: %s\r\n' "${IMPORT_NOTE_CGI_VERSION:-unknown}"
  printf '%s\r\n' 'X-WuWei-Import-Response: note-json'
  printf '\r\n'
  cat "$1"
  exit 0
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

decode_minimal() {
  sed 's/+/ /g; s/%2[Ff]/\//g; s/%2[Dd]/-/g; s/%5[Ff]/_/g; s/%40/@/g; s/%3[Aa]/:/g; s/%20/ /g'
}

field_value() {
  key=$1
  if [ -f "$CGIVARS" ]; then
    sed -n "s/^${key}=//p" "$CGIVARS" | head -n 1 | decode_minimal
  fi
}

valid_simple_id() {
  case "$1" in
    ''|*/*|*..*|ERROR*) return 1 ;;
    *[!A-Za-z0-9._-]*) return 1 ;;
    *) return 0 ;;
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

safe_zip_entry() {
  entry=$(printf '%s' "$1" | sed 's#\\#/#g; s#^/*##')
  case "$entry" in
    ''|/*|*'/../'*|'../'*|*'/..'|'.'|'..'|*'//'*) return 1 ;;
    export-manifest.json|note/*|resources/*) printf '%s\n' "$entry" ;;
    *) return 1 ;;
  esac
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

extract_multipart_with_awk() {
  boundary=$1
  awk -v boundary="$boundary" -v zip="$UPLOAD_ZIP" -v fields="$CGIVARS" '
    BEGIN {
      b = boundary;
      gsub(/[.[\\*^$()+?{}|]/, "\\\\&", b);
      RS = "--" b "(--)?\\r?\\n";
      ORS = "";
    }
    NR > 1 {
      part = $0;
      sub(/^\\r?\\n/, "", part);
      if (part ~ /^--/) next;

      sep = "\r\n\r\n";
      pos = index(part, sep);
      if (pos == 0) { sep = "\n\n"; pos = index(part, sep); }
      if (pos == 0) next;

      header = substr(part, 1, pos - 1);
      content = substr(part, pos + length(sep));
      sub(/\\r?\\n$/, "", content);

      name = "";
      filename = "";
      if (match(header, /name="[^"]*"/)) {
        name = substr(header, RSTART + 6, RLENGTH - 7);
      }
      if (match(header, /filename="[^"]*"/)) {
        filename = substr(header, RSTART + 10, RLENGTH - 11);
      }

      if (name == "file" || filename != "") {
        printf "%s", content > zip;
        close(zip);
        got_file = 1;
      } else if (name != "") {
        gsub(/\r|\n/, "", content);
        print name "=" content "\n" > fields;
      }
    }
    END { exit(got_file ? 0 : 5); }
  ' "$RAW_POST"
}

parse_request() {
  method=${REQUEST_METHOD:-}
  [ "$method" = 'POST' ] || error_response 'ERROR POST ONLY'

  ctype=${CONTENT_TYPE:-}
  cl=${CONTENT_LENGTH:-0}
  [ "${cl:-0}" -gt 0 ] 2>/dev/null || error_response 'ERROR EMPTY REQUEST'

  case "$ctype" in
    multipart/form-data*)
      cat > "$RAW_POST"
      boundary=$(printf '%s' "$ctype" | sed -n 's/^.*boundary="\{0,1\}\([^";]*\)"\{0,1\}.*$/\1/p')
      [ -n "$boundary" ] || error_response 'ERROR MULTIPART BOUNDARY NOT FOUND'
      : > "$CGIVARS"
      extract_multipart_with_awk "$boundary" || error_response 'ERROR FILE NOT UPLOADED'
      ;;
    *)
      error_response 'ERROR UNSUPPORTED CONTENT TYPE'
      ;;
  esac

  [ -s "$UPLOAD_ZIP" ] || error_response 'ERROR FILE NOT UPLOADED'
}

list_zip_entries() {
  if command -v zipinfo >/dev/null 2>&1; then
    zipinfo -1 "$UPLOAD_ZIP" > "$ENTRIES"
  else
    unzip -Z1 "$UPLOAD_ZIP" > "$ENTRIES"
  fi
}

copy_zip_entry() {
  entry=$1
  target=$2
  mkdir -p "$(dirname "$target")"
  unzip -p "$UPLOAD_ZIP" "$entry" > "$target"
}

extract_safe_entries() {
  mkdir -p "$WORK_DIR"
  list_zip_entries || error_response 'ERROR INVALID ZIP FILE'
  grep -qx 'export-manifest.json' "$ENTRIES" || error_response 'ERROR EXPORT MANIFEST NOT FOUND'

  while IFS= read -r entry; do
    [ -n "$entry" ] || continue
    safe=$(safe_zip_entry "$entry") || error_response 'ERROR INVALID ZIP PATH'
    case "$safe" in
      */) continue ;;
    esac
    copy_zip_entry "$safe" "$WORK_DIR/$safe" || error_response 'ERROR INVALID ZIP FILE'
  done < "$ENTRIES"
}

json_string_value() {
  key=$1
  file=$2
  awk -v key="$key" '
    { text = text $0 "\n" }
    END {
      pat = "\"" key "\"[[:space:]]*:[[:space:]]*\"";
      if (!match(text, pat)) exit 1;
      s = substr(text, RSTART + RLENGTH);
      esc = 0;
      out = "";
      for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1);
        if (esc) {
          out = out c;
          esc = 0;
        } else if (c == "\\") {
          out = out c;
          esc = 1;
        } else if (c == "\"") {
          print out;
          exit 0;
        } else {
          out = out c;
        }
      }
      exit 1;
    }
  ' "$file"
}

is_json_object_file() {
  file=$1
  awk '
    { text = text $0 "\n" }
    END {
      sub(/^\357\273\277/, "", text);
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", text);
      exit((substr(text,1,1)=="{" && substr(text,length(text),1)=="}") ? 0 : 1);
    }
  ' "$file"
}

load_manifest_and_note() {
  cp "$WORK_DIR/export-manifest.json" "$MANIFEST_JSON"

  format=$(json_string_value 'format' "$MANIFEST_JSON" || true)
  [ "$format" = 'wuwei-note-export' ] || error_response 'ERROR INVALID EXPORT MANIFEST'

  NOTE_KEY=$(json_string_value 'note_key' "$MANIFEST_JSON" || true)
  NOTE_KEY=$(safe_rel_path "$NOTE_KEY") || error_response 'ERROR NOTE KEY NOT FOUND'
  case "$NOTE_KEY" in
    */note.json) : ;;
    *) error_response 'ERROR INVALID NOTE KEY' ;;
  esac

  [ -f "$WORK_DIR/note/$NOTE_KEY" ] || error_response 'ERROR NOTE JSON NOT FOUND'
  cp "$WORK_DIR/note/$NOTE_KEY" "$NOTE_JSON_IN"
  is_json_object_file "$NOTE_JSON_IN" || error_response 'ERROR INVALID NOTE JSON'
}

manifest_resources_to_tsv() {
  awk '
    function value_after(s, key,    pat, p, rest, i, c, out, esc) {
      pat = "\"" key "\":\"";
      p = index(s, pat);
      if (p == 0) return "";
      rest = substr(s, p + length(pat));
      out = ""; esc = 0;
      for (i = 1; i <= length(rest); i++) {
        c = substr(rest, i, 1);
        if (esc) { out = out c; esc = 0; }
        else if (c == "\\") { out = out c; esc = 1; }
        else if (c == "\"") { return out; }
        else { out = out c; }
      }
      return "";
    }
    { json = json $0 }
    END {
      gsub(/[[:space:]]+/, "", json);
      pos = 1; lb = "";
      while (pos <= length(json)) {
        rest = substr(json, pos);
        p_lb = index(rest, "\"logicalBase\"");
        p_path = index(rest, "\"path\"");
        if (p_lb == 0 && p_path == 0) break;
        if (p_lb > 0 && (p_path == 0 || p_lb < p_path)) {
          lb = value_after(substr(rest, p_lb), "logicalBase");
          pos += p_lb + 13;
        } else {
          seg = substr(rest, p_path);
          arc = value_after(seg, "path");
          logical = value_after(seg, "logicalPath");
          sha = value_after(seg, "sha256");
          if (arc != "" && logical != "") print lb "\t" arc "\t" logical "\t" sha;
          pos += p_path + 6;
        }
      }
    }
  ' "$MANIFEST_JSON" > "$RESOURCE_LIST"
}

copy_resource_files() {
  : > "$RESOURCE_LIST"
  manifest_resources_to_tsv || error_response 'ERROR INVALID RESOURCE FILE MANIFEST'

  while IFS="$(printf '\t')" read -r logical_base arc logical sha rest; do
    [ -n "${arc:-}" ] || continue
    arc=$(safe_rel_path "$arc") || error_response 'ERROR INVALID RESOURCE FILE MANIFEST'
    logical=$(safe_rel_path "$logical") || error_response 'ERROR INVALID RESOURCE FILE MANIFEST'
    case "$arc" in resources/*) : ;; *) error_response 'ERROR INVALID RESOURCE FILE MANIFEST' ;; esac
    src="$WORK_DIR/$arc"
    [ -f "$src" ] || error_response 'ERROR RESOURCE FILE NOT FOUND'
    if [ -n "${sha:-}" ]; then
      actual=$(sha256sum "$src" | awk '{print $1}')
      [ "$actual" = "$sha" ] || error_response 'ERROR RESOURCE FILE SHA256 MISMATCH'
    fi
    dst="$UPLOAD_DIR/$logical"
    case "$dst" in "$UPLOAD_DIR"/*) : ;; *) error_response 'ERROR INVALID UPLOAD PATH' ;; esac
    if [ -f "$dst" ]; then
      old=$(sha256sum "$dst" | awk '{print $1}')
      new=$(sha256sum "$src" | awk '{print $1}')
      [ "$old" = "$new" ] || error_response 'ERROR UPLOAD FILE CONFLICT'
    fi
    mkdir -p "$(dirname "$dst")"
    cp -p "$src" "$dst"

    lb=$(safe_rel_path "${logical_base:-}" || true)
    if [ -n "$lb" ]; then
      actual_date=$(printf '%s' "$lb" | awk -F/ '{print $1"/"$2"/"$3}')
      upload_id=$(printf '%s' "$lb" | awk -F/ '{print $4}')
      if [ -n "$actual_date" ] && [ -n "$upload_id" ]; then
        idx="$UPLOAD_DIR/_index/path/$logical.json"
        mkdir -p "$(dirname "$idx")"
        file_name=$(basename "$logical")
        manifest_path="$lb/manifest.json"
        cat > "$idx" <<EOF
{
  "logicalPath": "$logical",
  "upload_id": "$upload_id",
  "actual_date": "$actual_date",
  "date": "$actual_date",
  "file": "$file_name",
  "manifest": "$manifest_path"
}
EOF
      fi
    fi
  done < "$RESOURCE_LIST"
}

materialise_note_json() {
  imported_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  awk -v uid="$USER_ID" -v imported_at="$imported_at" '
    { text = text $0 "\n" }
    END {
      sub(/^\357\273\277/, "", text);
      gsub(/"lastModifiedBy"[[:space:]]*:[[:space:]]*"[^"]*"/, "\"lastModifiedBy\":\"" uid "\"", text);
      gsub(/"lastModifiedAt"[[:space:]]*:[[:space:]]*"[^"]*"/, "\"lastModifiedAt\":\"" imported_at "\"", text);
      printf "%s", text;
      if (substr(text, length(text), 1) != "\n") printf "\n";
    }
  ' "$NOTE_JSON_IN" > "$NOTE_JSON_OUT"
  is_json_object_file "$NOTE_JSON_OUT" || error_response 'ERROR INVALID NOTE JSON'
}

normalise_json_for_compare() {
  src=$1
  dst=$2
  awk '
    { text = text $0 "\n" }
    END {
      sub(/^\357\273\277/, "", text);
      gsub(/[[:space:]]+/, "", text);
      gsub(/,?"lastModifiedBy":"[^"]*"/, "", text);
      gsub(/,?"lastModifiedAt":"[^"]*"/, "", text);
      gsub(/,?"dir_name":"[^"]*"/, "", text);
      gsub(/,?"file_name":"[^"]*"/, "", text);
      print text;
    }
  ' "$src" > "$dst"
}

same_note_json() {
  existing=$1
  incoming=$2
  normalise_json_for_compare "$existing" "$EXISTING_NORM"
  normalise_json_for_compare "$incoming" "$INCOMING_NORM"
  cmp -s "$EXISTING_NORM" "$INCOMING_NORM"
}

parse_request

SESSION_USER_ID=$(is-login || true)
REQUESTED_USER_ID=$(field_value user_id || true)
USER_ID=${REQUESTED_USER_ID:-$SESSION_USER_ID}

if [ -z "${SESSION_USER_ID:-}" ] || [ -z "${USER_ID:-}" ] || [ "$USER_ID" != "$SESSION_USER_ID" ]; then
  error_response 'ERROR NOT LOGGED IN'
fi
valid_simple_id "$USER_ID" || error_response 'ERROR INVALID USER ID'

NOTE_DIR=$(resolve_env_path note "$USER_ID" || true)
UPLOAD_DIR=$(resolve_env_path upload "$USER_ID" || true)
[ -n "${NOTE_DIR:-}" ] || error_response 'ERROR NOTE DIRECTORY NOT DEFINED'
[ -n "${UPLOAD_DIR:-}" ] || error_response 'ERROR UPLOAD DIRECTORY NOT DEFINED'
mkdir -p "$NOTE_DIR" "$UPLOAD_DIR"

extract_safe_entries
load_manifest_and_note
copy_resource_files
materialise_note_json

TARGET="$NOTE_DIR/$NOTE_KEY"
case "$TARGET" in "$NOTE_DIR"/*) : ;; *) error_response 'ERROR INVALID NOTE KEY' ;; esac
if [ -f "$TARGET" ]; then
  if ! same_note_json "$TARGET" "$NOTE_JSON_OUT"; then
    error_response 'ERROR NOTE ID / NOTE KEY CONFLICT'
  fi
fi
mkdir -p "$(dirname "$TARGET")"
cp "$NOTE_JSON_OUT" "$TARGET"

# Success response must be the imported note JSON itself.
# Do not emit human-readable status lines here; menu.note.js parses this body as JSON.
is_json_object_file "$NOTE_JSON_OUT" || error_response 'ERROR INVALID IMPORTED NOTE JSON'
json_response_file "$NOTE_JSON_OUT"
