#!/bin/bash
# upload.cgi
#
# Normal mode:
#   stderr is appended only to:
#     log/cgi.err
#
# Debug mode:
#   create the following flag file, then call this CGI:
#     log/.debug.upload.cgi
#
#   In debug mode, stderr is written to both:
#     log/cgi.err
#     log/upload.cgi.<pid>.log
#
#   Enable debug:
#     touch log/.debug.upload.cgi
#
#   Disable debug:
#     rm -f log/.debug.upload.cgi

LANG=C

# --- locate script dir (stable under fcgiwrap) -----------------------
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1

# --- logs ------------------------------------------------------------
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

# --- shell env -------------------------------------------------------
export LC_ALL=C
type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"

# --- helpers ---------------------------------------------------------
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

die_json() {
  local msg="$1"
  printf "Content-Type: application/json\r\n\r\n"
  printf '{ "error": "%s" }\n' "$(json_escape "$msg")"
  rm -rf "$Tmp"-*
  exit 1
}

trim() { printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'; }

read_env() {
  local key="$1" v
  v="$(nameread "$key" data/environment 2>/dev/null || true)"
  v="$(printf '%s' "$v" | tr -d '\r\n')"
  v="${v#\"}"; v="${v%\"}"
  printf '%s' "$v"
}

resolve_env_template() {
  local tpl="$1"
  case "$tpl" in
    /*) printf '%s' "$tpl" ;;
    wu_wei2/*) printf '%s/%s' "$(dirname "$SCRIPT_DIR")" "${tpl#wu_wei2/}" ;;
    *) printf '%s/%s' "$SCRIPT_DIR" "$tpl" ;;
  esac
}

command_path() {
  local candidate found
  for candidate in "$@"; do
    [ -n "${candidate:-}" ] || continue
    if [ -x "$candidate" ]; then
      printf '%s' "$candidate"
      return 0
    fi
    found="$(command -v "$candidate" 2>/dev/null || true)"
    if [ -n "$found" ]; then
      printf '%s' "$found"
      return 0
    fi
  done
  return 1
}

image_command() {
  command_path "$SCRIPT_DIR/bin/magick" magick convert
}

office_command() {
  command_path "$SCRIPT_DIR/bin/soffice" "$SCRIPT_DIR/bin/libreoffice" soffice libreoffice
}

is_office_file() {
  local lower
  lower="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    *.doc|*.docx|*.xls|*.xlsx|*.ppt|*.pptx|*.odt|*.ods|*.odp)
      return 0
      ;;
  esac
  return 1
}

thumb_input_arg() {
  case "$1" in
    application/pdf*|office-preview)
      printf '%s[0]' "$2"
      ;;
    *)
      printf '%s' "$2"
      ;;
  esac
}

pdf_page_count() {
  local src="$1" count
  [ -f "$src" ] || { printf '0'; return 0; }
  if command -v pdfinfo >/dev/null 2>&1; then
    count="$(pdfinfo "$src" 2>/dev/null | awk -F: 'tolower($1)=="pages" { gsub(/[[:space:]]/, "", $2); print $2; exit }')"
    case "$count" in
      ''|*[!0-9]*) ;;
      *) printf '%s' "$count"; return 0 ;;
    esac
  fi
  count="$(LC_ALL=C grep -a -o '/Type[[:space:]]*/Page\([^sA-Za-z]\|$\)' "$src" 2>/dev/null | wc -l | tr -d ' ')"
  case "$count" in
    ''|*[!0-9]*) printf '0' ;;
    *) printf '%s' "$count" ;;
  esac
}

# UUID regex (bash regex)
UUID_RE='^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

# --- login check: read from Cookie directly --------------------------
# Parse cookie string into name=value pairs
printf '%s' "${HTTP_COOKIE:-''}" \
  | sed 's/&/%26/g; s/[;, ]\{1,\}/\&/g; s/^&//; s/&$//' \
  | cgi-name > "$Tmp-cookievars"

user_id="$(nameread wuwei_user_id "$Tmp-cookievars" 2>/dev/null || true)"
user_id="$(trim "$(printf '%s' "$user_id" | tr -d '\r\n')")"

if [[ -z "${user_id:-}" || ! "$user_id" =~ $UUID_RE ]]; then
  cat <<'HTTP_RESPONSE'
Content-Type: text/plain

ERROR NOT LOGGED IN
HTTP_RESPONSE
  rm -rf "$Tmp"-*
  exit 1
fi

# --- dates -----------------------------------------------------------
year="$(date '+%Y')"
month="$(date '+%m')"
day="$(date '+%d')"

# --- environment paths (align with your data/environment) ------------
# data/environment expects:
#   user      /.../wu_wei2
#   upload    /.../wu_wei2/*/upload
#   resource  /.../wu_wei2/*/resource
#   thumbnails are stored in the upload bundle as thumbnail.jpg

base_dir="$(resolve_env_template "$(read_env user)")"
[ -z "${base_dir:-}" ] && die_json "ERROR: 'user' is empty in data/environment"

upload_tpl="$(resolve_env_template "$(read_env upload)")"
[ -z "${upload_tpl:-}" ] && die_json "ERROR: 'upload' is empty in data/environment"
file_dir="${upload_tpl//\*/$user_id}"
upload_root="$file_dir"

resource_tpl="$(resolve_env_template "$(read_env resource)")"
[ -z "${resource_tpl:-}" ] && die_json "ERROR: 'resource' is empty in data/environment"
resource_dir="${resource_tpl//\*/$user_id}"
resource_root="$resource_dir"

note_tpl="$(resolve_env_template "$(read_env note)")"
note_root=""
[ -n "${note_tpl:-}" ] && note_root="${note_tpl//\*/$user_id}"

# --- ensure directories ----------------------------------------------
mkdir -p "$file_dir/$year/$month/$day"      || die_json "ERROR: cannot mkdir $file_dir/$year/$month/$day (permission?)"

file_dir="$file_dir/$year/$month/$day"

# --- read request body -----------------------------------------------
# dd bs=1K if=/dev/stdin > "$Tmp-cgivars"
content_length="${CONTENT_LENGTH:-0}"
case "$content_length" in
  ''|*[!0-9]*)
    die_json "ERROR: invalid CONTENT_LENGTH '$content_length'"
    ;;
esac

echo "before read stdin: CONTENT_LENGTH=$content_length" >&2

if ! head -c "$content_length" > "$Tmp-cgivars" < /dev/stdin; then
  die_json "ERROR: failed while reading request body"
fi

actual_length="$(wc -c < "$Tmp-cgivars" | tr -d ' ')"
echo "after read stdin: ACTUAL_LENGTH=$actual_length" >&2
ls -l "$Tmp-cgivars" >&2

# extract uploaded file body
echo "before mime-read file" >&2
mime-read file "$Tmp-cgivars" > "$Tmp-uploadfile" || die_json "ERROR: mime-read file failed"
echo "after mime-read file" >&2
ls -l "$Tmp-uploadfile" >&2

# filename from multipart header
echo "before parse filename" >&2

filename="$(
  mime-read -v "$Tmp-cgivars" \
  | grep -Ei '^[0-9]+[[:blank:]]*Content-Disposition:[[:blank:]]*form-data;' \
  | grep '[[:blank:]]name="file"' \
  | head -n 1 \
  | sed 's/.*[[:blank:]]filename="\([^"]*\)".*/\1/' \
  | sed 's/[[:space:]]/_/g'
)"
[ -z "${filename:-}" ] && die_json "ERROR: filename not found in multipart"

# content-type from multipart header (declared field)
contenttype="$(
  mime-read -v "$Tmp-cgivars" \
  | awk 'BEGIN{IGNORECASE=1} $0 ~ /^[0-9]+[[:space:]]*Content-Type:/ { sub(/^[0-9]+[[:space:]]*Content-Type:[[:space:]]*/,""); print; exit }'
)"

fullname="$(mime-read fullname "$Tmp-cgivars" 2>/dev/null || true)"
note_id="new_note"

original_sha="$(sha256sum "$Tmp-uploadfile" 2>/dev/null | awk '{print $1}')"
[ -n "$original_sha" ] || die_json "ERROR: cannot calculate upload sha256"
sha_index_dir="$upload_root/_index/sha256"
sha_index_file="$sha_index_dir/$original_sha.json"

upload_file_uuid=""
upload_file_date="$year/$month/$day"
if [ -f "$sha_index_file" ]; then
  upload_file_uuid="$(sed -n 's/.*"upload_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$sha_index_file" | head -n 1)"
  upload_file_date="$(sed -n 's/.*"date"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$sha_index_file" | head -n 1)"
  [ -n "$upload_file_date" ] || upload_file_date="$year/$month/$day"
fi

[ -n "$upload_file_uuid" ] || upload_file_uuid="_$(uuidgen | tr 'A-Z' 'a-z')"
upload_file_dir="$upload_root/$upload_file_date/$upload_file_uuid"
mkdir -p "$upload_file_dir" || die_json "ERROR: cannot mkdir $upload_file_dir"

# full path to save uploaded file. If this sha is already known, reuse the
# existing upload bundle and avoid duplicating the uploaded payload.
dest_file="$upload_file_dir/$filename"
if [ ! -f "$dest_file" ]; then
  cp -- "$Tmp-uploadfile" "$dest_file" || die_json "ERROR: cannot save upload to $dest_file"
fi

upload_relpath="$upload_file_date/$upload_file_uuid/$filename"
resource_day_dir="$resource_root/$upload_file_date"
mkdir -p "$resource_day_dir" || die_json "ERROR: cannot mkdir $resource_day_dir"

find_existing_resource_dir() {
  local sha="$1" rel="$2" rf
  find "$resource_root" -type f -name resource.json 2>/dev/null | while IFS= read -r rf; do
    if { [ -n "$sha" ] && grep -q "\"sha256\"[[:space:]]*:[[:space:]]*\"$sha\"" "$rf"; } ||
       { [ -n "$rel" ] && grep -q "\"role\"[[:space:]]*:[[:space:]]*\"original\"" "$rf" && grep -q "\"path\"[[:space:]]*:[[:space:]]*\"$rel\"" "$rf"; }; then
      dirname "$rf"
      break
    fi
  done
}

# --- ids / uri mapping -----------------------------------------------
existing_resource_dir=""
if [ -n "$existing_resource_dir" ]; then
  uuid="${existing_resource_dir##*/}"
else
  uuid="$upload_file_uuid"
fi
uuidrgx='[0-9a-f]\{8\}-[0-9a-f]\{4\}-[1-5][0-9a-f]\{3\}-[89ab][0-9a-f]\{3\}-[0-9a-f]\{12\}'

escaped_base="$(printf '%s' "$base_dir" | sed 's/\//\\\//g')"

resource_dir="${existing_resource_dir:-$resource_day_dir/$uuid}"
mkdir -p "$resource_dir" || die_json "ERROR: cannot mkdir $resource_dir"
resource_file="$resource_dir/resource.json"
manifest_file="$upload_file_dir/manifest.json"
resource_uri=""

thumb_file="$upload_file_dir/thumbnail.jpg"
thumb_area="upload"
thumb_rel_root="$upload_root"
thumbnail_uri=""

url_encode() {
  printf '%s' "$1" | sed 's/%/%25/g; s/ /%20/g; s#/#%2F#g; s/&/%26/g; s/?/%3F/g; s/=/%3D/g'
}

protected_file_uri() {
  local area="$1" rel="$2"
  printf '/wu_wei2/server/load-file.cgi?area=%s&path=%s&user_id=%s' \
    "$(url_encode "$area")" "$(url_encode "$rel")" "$(url_encode "$user_id")"
}

# protected runtime file uri; resource JSON stores area/path instead.
file_uri="$(protected_file_uri upload "$upload_relpath")"

# --- detect actual file type ----------------------------------------
content_type="$(file -b -i -- "$dest_file" 2>/dev/null || true)"

# --- office preview --------------------------------------------------
preview_pdf=""
preview_pdf_uri=""
preview_pdf_url=""

if is_office_file "$filename"; then
  office_bin="$(office_command || true)"
  if [ -n "${office_bin:-}" ]; then
    office_outdir="$Tmp-office"
    office_profile="$Tmp-office-profile"
    office_log="$Tmp-office.log"
    mkdir -p "$office_outdir"
    mkdir -p "$office_profile"
    if "$office_bin" \
      --headless \
      --nologo \
      --nofirststartwizard \
      --nodefault \
      --nolockcheck \
      --norestore \
      "-env:UserInstallation=file://$office_profile" \
      --convert-to pdf \
      --outdir "$office_outdir" \
      "$dest_file" >"$office_log" 2>&1; then
      stem="${filename%.*}"
      generated_pdf="$office_outdir/$stem.pdf"
      if [ ! -f "$generated_pdf" ]; then
        generated_pdf="$(find "$office_outdir" -maxdepth 1 -type f -name '*.pdf' -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk 'NR==1{sub(/^[^ ]+ /,""); print}')"
      fi
      if [ -f "$generated_pdf" ]; then
        # Keep the uploaded Office document and its PDF rendition together.
        # Generated renditions stay in the upload bundle; metadata stays under resource/.
        preview_pdf="$upload_file_dir/preview.pdf"
        cp -f "$generated_pdf" "$preview_pdf" || preview_pdf=""
      else
        echo "office preview converted but pdf not found: expected=$generated_pdf" >&2
        [ -s "$office_log" ] && sed 's/^/office preview: /' "$office_log" >&2
      fi
    else
      echo "office preview conversion failed: $filename" >&2
      [ -s "$office_log" ] && sed 's/^/office preview: /' "$office_log" >&2
    fi
  else
    echo "office preview skipped: soffice/libreoffice not found" >&2
  fi

  if [ -n "$preview_pdf" ] && [ -f "$preview_pdf" ]; then
    preview_pdf_uri="$(protected_file_uri upload "${preview_pdf#$upload_root/}")"
    preview_pdf_url="$preview_pdf_uri"
  else
    echo "office preview pdf was not generated: $filename" >&2
  fi
fi

# --- thumbnail / size ------------------------------------------------
thumbnail=""
iw=""; ih=""; w=""; h=""
thumb_src="$dest_file"
thumb_kind="$content_type"

if [[ "$content_type" == application/pdf* ]]; then
  thumbnail="$thumbnail_uri"
  iw="$(identify "${dest_file}[0]" 2>/dev/null | sed -e "s/^[^[:blank:]]*[[:blank:]][^[:blank:]]*[[:blank:]]\([0-9]*\)x\([0-9]*\)[[:blank:]].*$/\1/" || true)"
  ih="$(identify "${dest_file}[0]" 2>/dev/null | sed -e "s/^[^[:blank:]]*[[:blank:]][^[:blank:]]*[[:blank:]]\([0-9]*\)x\([0-9]*\)[[:blank:]].*$/\2/" || true)"
elif [[ "$content_type" == image/* ]]; then
  thumbnail="$thumbnail_uri"
  iw="$(identify "$dest_file" 2>/dev/null | sed -e "s/^[^[:blank:]]*[[:blank:]][^[:blank:]]*[[:blank:]]\([0-9]*\)x\([0-9]*\)[[:blank:]].*$/\1/" || true)"
  ih="$(identify "$dest_file" 2>/dev/null | sed -e "s/^[^[:blank:]]*[[:blank:]][^[:blank:]]*[[:blank:]]\([0-9]*\)x\([0-9]*\)[[:blank:]].*$/\2/" || true)"
elif [ -n "$preview_pdf" ] && [ -f "$preview_pdf" ]; then
  thumbnail="$thumbnail_uri"
  thumb_src="$preview_pdf"
  thumb_kind="office-preview"
  iw="$(identify "${preview_pdf}[0]" 2>/dev/null | sed -e "s/^[^[:blank:]]*[[:blank:]][^[:blank:]]*[[:blank:]]\([0-9]*\)x\([0-9]*\)[[:blank:]].*$/\1/" || true)"
  ih="$(identify "${preview_pdf}[0]" 2>/dev/null | sed -e "s/^[^[:blank:]]*[[:blank:]][^[:blank:]]*[[:blank:]]\([0-9]*\)x\([0-9]*\)[[:blank:]].*$/\2/" || true)"
fi

if [[ "$content_type" == application/pdf* || "$content_type" == image/* || -n "$preview_pdf" ]]; then
  size=200
  if [[ -n "${iw:-}" && -n "${ih:-}" ]]; then
    if (( iw > ih && iw > size )); then
      w=$size
      h="$(echo "$ih*$size/$iw" | bc)"
    elif (( ih > iw && ih > size )); then
      h=$size
      w="$(echo "$iw*$size/$ih" | bc)"
    else
      w=$iw; h=$ih
    fi
  else
    w=64; h=64
  fi

  img_bin="$(image_command || true)"
  if [ -n "${img_bin:-}" ]; then
    if [[ "$thumb_kind" == application/pdf* || "$thumb_kind" == office-preview ]]; then
      "$img_bin" -thumbnail "${w}x${h}" -background white -alpha remove \
        "$(thumb_input_arg "$thumb_kind" "$thumb_src")" "$thumb_file" \
        || cp -f "$SCRIPT_DIR/PDF_32.png" "$thumb_file"
    else
      "$img_bin" -define "jpeg:size=${iw:-200}x${ih:-200}" \
        "$thumb_src" -auto-orient -thumbnail "${w}x${h}" -unsharp 0x.5 \
        "$thumb_file" || true
    fi
  else
    echo "thumbnail skipped: ImageMagick not found" >&2
  fi
fi

[ -f "$thumb_file" ] && thumbnail_uri="$(protected_file_uri "$thumb_area" "${thumb_file#$thumb_rel_root/}")"
[ -n "$thumbnail_uri" ] && thumbnail="$thumbnail_uri"

# --- identify (optional) --------------------------------------------
identify_out=""
if [[ "$content_type" == application/pdf* ]]; then
  identify_out="$(identify "${dest_file}[0]" 2>/dev/null || true)"
elif [[ "$content_type" == image/* ]]; then
  identify_out="$(identify "$dest_file" 2>/dev/null || true)"
elif [ -n "$preview_pdf" ] && [ -f "$preview_pdf" ]; then
  identify_out="$(identify "${preview_pdf}[0]" 2>/dev/null || true)"
fi

page_count=0
contents_source_role=""
if [[ "$content_type" == application/pdf* ]]; then
  page_count="$(pdf_page_count "$dest_file")"
  contents_source_role="original"
elif [ -n "$preview_pdf" ] && [ -f "$preview_pdf" ]; then
  page_count="$(pdf_page_count "$preview_pdf")"
  contents_source_role="preview"
fi
case "$page_count" in
  ''|*[!0-9]*) page_count=0 ;;
esac

# --- resource fields -------------------------------------------------
if [ -n "${fullname:-}" ]; then
  name="$fullname"
else
  name="$(printf '%s' "$dest_file" | sed 's#^\(.*\)/\([^/]*\)$#\2#')"
fi

totalsize="$(stat -c %s -- "$dest_file" 2>/dev/null || true)"
lastmodified="$(stat -c %y -- "$dest_file" 2>/dev/null || true)"

# --- write resource file --------------------------------------------
created_at="$(date '+%Y-%m-%dT%H:%M:%S%z')"
thumb_sha=""
[ -f "$thumb_file" ] && thumb_sha="$(sha256sum "$thumb_file" 2>/dev/null | awk '{print $1}')"
preview_sha=""
[ -n "$preview_pdf" ] && [ -f "$preview_pdf" ] && preview_sha="$(sha256sum "$preview_pdf" 2>/dev/null | awk '{print $1}')"
media_kind="general"
case "$content_type" in
  image/*) media_kind="image" ;;
  video/*) media_kind="video" ;;
  audio/*) media_kind="audio" ;;
  text/*|application/pdf*) media_kind="document" ;;
esac
if is_office_file "$filename"; then media_kind="document"; fi

mkdir -p "$sha_index_dir" || die_json "ERROR: cannot mkdir $sha_index_dir"
cat >"$manifest_file" <<JSON || die_json "ERROR: cannot write manifest file $manifest_file"
{
  "id": "$(json_escape "$uuid")",
  "type": "UploadResource",
  "version": 1,
  "created_at": "$(json_escape "$created_at")",
  "created_by": "$(json_escape "$user_id")",
  "title": "$(json_escape "$name")",
  "kind": "$(json_escape "$media_kind")",
  "original": {
    "file": "$(json_escape "$filename")",
    "display_name": "$(json_escape "$name")",
    "mime": "$(json_escape "$content_type")",
    "size": ${totalsize:-0},
    "sha256": "$(json_escape "$original_sha")"
  }$(if [ -f "$thumb_file" ]; then printf ',\n  "thumbnail": {\n    "file": "thumbnail.jpg",\n    "mime": "image/jpeg",\n    "size": %s,\n    "sha256": "%s",\n    "display_size": "%s"\n  }' "$(stat -c %s -- "$thumb_file" 2>/dev/null || echo 0)" "$(json_escape "$thumb_sha")" "$(json_escape "${w}x${h}")"; fi)$(if [ -n "$preview_pdf" ] && [ -f "$preview_pdf" ]; then printf ',\n  "preview": {\n    "file": "preview.pdf",\n    "mime": "application/pdf",\n    "size": %s,\n    "sha256": "%s",\n    "generated_by": "LibreOffice"\n  }' "$(stat -c %s -- "$preview_pdf" 2>/dev/null || echo 0)" "$(json_escape "$preview_sha")"; fi)
}
JSON
cat >"$sha_index_file" <<JSON || die_json "ERROR: cannot write sha index $sha_index_file"
{
  "sha256": "$(json_escape "$original_sha")",
  "upload_id": "$(json_escape "$uuid")",
  "date": "$(json_escape "$upload_file_date")",
  "file": "$(json_escape "$filename")"
}
JSON

cat >"$resource_file" <<JSON || die_json "ERROR: cannot write resource file $resource_file"
{
  "id": "$(json_escape "$uuid")",
  "type": "Resource",
  "origin": {
    "type": "userRegistered",
    "subtype": "uploadedDocument",
    "provider": "local"
  },
  "identity": {
    "title": "$(json_escape "$name")",
    "canonicalUri": "",
    "uri": ""
  },
  "media": {
    "kind": "$(json_escape "$media_kind")",
    "mimeType": "$(json_escape "$content_type")",
    "downloadable": true,
    "duration": null,
    "pageCount": $(if [ "${page_count:-0}" -gt 0 ]; then printf '%s' "$page_count"; else printf 'null'; fi)
  }$(if [ "${page_count:-0}" -gt 0 ]; then printf ',\n  "contents": {\n    "type": "pdf",\n    "axis": {\n      "unit": "page",\n      "nodeType": "page"\n    },\n    "pageCount": %s,\n    "sourceRole": "%s"\n  }' "$page_count" "$(json_escape "$contents_source_role")"; fi),
  "viewer": {
    "supportedModes": ["infoPane", "newTab", "newWindow", "download"],
    "defaultMode": "infoPane",
    "embed": {
      "enabled": true,
      "uri": ""
    }
  },
  "storage": {
    "managed": true,
    "copyPolicy": "reference",
    "manifest": {
      "area": "upload",
      "path": "$(json_escape "$upload_file_date/$upload_file_uuid/manifest.json")"
    },
    "files": [
      {
        "role": "original",
        "area": "upload",
        "path": "$(json_escape "$upload_relpath")",
        "mimeType": "$(json_escape "$content_type")",
        "size": ${totalsize:-0},
        "sha256": "$(json_escape "$original_sha")"
      }$(if [ -f "$thumb_file" ]; then printf ',\n      {\n        "role": "thumbnail",\n        "area": "upload",\n        "path": "%s",\n        "mimeType": "image/jpeg",\n        "size": %s,\n        "sha256": "%s"\n      }' "$(json_escape "${thumb_file#$upload_root/}")" "$(stat -c %s -- "$thumb_file" 2>/dev/null || echo 0)" "$(json_escape "$thumb_sha")"; fi)$(if [ -n "$preview_pdf" ] && [ -f "$preview_pdf" ]; then printf ',\n      {\n        "role": "preview",\n        "area": "upload",\n        "path": "%s",\n        "mimeType": "application/pdf",\n        "size": %s,\n        "sha256": "%s"\n      }' "$(json_escape "${preview_pdf#$upload_root/}")" "$(stat -c %s -- "$preview_pdf" 2>/dev/null || echo 0)" "$(json_escape "$preview_sha")"; fi)
    ]
  },
  "rights": {
    "owner": "$(json_escape "$user_id")",
    "copyright": "",
    "license": "",
    "attribution": ""
  },
  "audit": {
    "owner": "$(json_escape "$user_id")",
    "createdBy": "$(json_escape "$user_id")",
    "createdAt": "$(json_escape "$created_at")",
    "lastModifiedBy": "",
    "lastModifiedAt": ""
  }
}
JSON

# --- return json -----------------------------------------------------
printf "Content-Type: application/json\r\n\r\n"

if [[ "$content_type" == application/pdf* || "$content_type" == image/* || -n "$preview_pdf" ]]; then
  cat <<JSON
{
  "id":"$uuid",
  "resource":$(cat "$resource_file"),
  "name":"$(json_escape "$name")",
  "option":"upload",
  "contenttype":"$(json_escape "${contenttype:-$content_type}")",
  "uri":"$(json_escape "$file_uri")",
  "value":{
    "totalsize":"$(json_escape "${totalsize:-}")",
    "lastmodified":"$(json_escape "${lastmodified:-}")",
    "resource":{"uri":"$(json_escape "$resource_uri")","size":"$(json_escape "${iw}x${ih}")"},
    "thumbnail":{"uri":"$(json_escape "$thumbnail")","size":"$(json_escape "${w}x${h}")"},
    "pdf":{"uri":"$(json_escape "${preview_pdf_uri:-}")","url":"$(json_escape "${preview_pdf_url:-}")"},
    "file":"",
    "identify":"$(json_escape "$identify_out")"
  }
}
JSON
else
  cat <<JSON
{
  "id":"$uuid",
  "resource":$(cat "$resource_file"),
  "name":"$(json_escape "$name")",
  "option":"upload",
  "contenttype":"$(json_escape "${contenttype:-$content_type}")",
  "uri":"$(json_escape "$file_uri")",
  "value":{
    "totalsize":"$(json_escape "${totalsize:-}")",
    "lastmodified":"$(json_escape "${lastmodified:-}")",
    "resource":{"uri":"$(json_escape "$resource_uri")"},
    "file":"",
    "identify":"$(json_escape "$identify_out")"
  }
}
JSON
fi

rm -rf "$Tmp" "$Tmp"-*
exit 0
