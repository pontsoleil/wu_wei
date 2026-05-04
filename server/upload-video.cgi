#!/bin/bash
# upload-video.cgi (patched)
# Upload a video file and generate a thumbnail using ffmpeg.
# Patch points:
#  - Ensure /usr/local/bin is in PATH (common ffmpeg install location)
#  - Use absolute ffmpeg/ffprobe paths (command -v)
#  - Do not depend on ImageMagick identify; use ffprobe to get thumbnail WxH

LANG=C

# --- locate script dir (stable under fcgiwrap) -----------------------
SCRIPT_PATH="${SCRIPT_FILENAME:-$0}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$SCRIPT_PATH")" && pwd)" || exit 1
cd "$SCRIPT_DIR" || exit 1

# --- logs ------------------------------------------------------------
mkdir -p "$SCRIPT_DIR/log"
REQLOG="$SCRIPT_DIR/log/${0##*/}.$$.log"
exec 2> >(tee -a "$SCRIPT_DIR/log/cgi.err" >>"$REQLOG")

# --- shell env -------------------------------------------------------
set -u -x   # keep -x for debugging; no -e (some commands may fail by design)

export LC_ALL=C
export PATH="/usr/local/sbin:/usr/local/bin:${PATH:-}"
# preserve existing logic to include system PATH
if type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1; then
  export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
fi
export UNIX_STD=2003

FFMPEG="$(command -v ffmpeg 2>/dev/null || true)"
FFPROBE="$(command -v ffprobe 2>/dev/null || true)"

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
  rm -f "$Tmp"-*
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
  rm -f "$Tmp"-*
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
#   thumbnail /.../wu_wei2/*/thumbnail

base_dir="$(read_env user)"
[ -z "${base_dir:-}" ] && die_json "ERROR: 'user' is empty in data/environment"

upload_tpl="$(read_env upload)"
[ -z "${upload_tpl:-}" ] && die_json "ERROR: 'upload' is empty in data/environment"
file_dir="${upload_tpl//\*/$user_id}"

resource_tpl="$(read_env resource)"
[ -z "${resource_tpl:-}" ] && die_json "ERROR: 'resource' is empty in data/environment"
resource_dir="${resource_tpl//\*/$user_id}"

thumbnail_tpl="$(read_env thumbnail)"
[ -z "${thumbnail_tpl:-}" ] && die_json "ERROR: 'thumbnail' is empty in data/environment"
thumbnail_dir="${thumbnail_tpl//\*/$user_id}"

# --- ensure directories ----------------------------------------------
mkdir -p "$file_dir/$year/$month/$day"      || die_json "ERROR: cannot mkdir $file_dir/$year/$month/$day (permission?)"
mkdir -p "$resource_dir/$year/$month/$day"  || die_json "ERROR: cannot mkdir $resource_dir/$year/$month/$day (permission?)"
mkdir -p "$thumbnail_dir/$year/$month/$day" || die_json "ERROR: cannot mkdir $thumbnail_dir/$year/$month/$day (permission?)"

upload_root="$file_dir"
resource_root="$resource_dir"
file_dir="$file_dir/$year/$month/$day"
resource_day_dir="$resource_dir/$year/$month/$day"
thumbnail_dir="$thumbnail_dir/$year/$month/$day"

# --- read request body -----------------------------------------------
dd bs=1K if=/dev/stdin > "$Tmp-cgivars"

# extract uploaded file body
mime-read file "$Tmp-cgivars" > "$Tmp-uploadfile"

# filename from multipart header
filename="$(
  mime-read -v "$Tmp-cgivars" \
  | grep -Ei '^[0-9]+[[:blank:]]*Content-Disposition:[[:blank:]]*form-data;' \
  | grep '[[:blank:]]name="file"' \
  | head -n 1 \
  | sed 's/.*[[:blank:]]filename="\([^"]*\)".*/\1/' \
  | sed 's/[[:space:]]/_/g'
)"
[ -z "${filename:-}" ] && die_json "ERROR: filename not found in multipart"
filename="${filename##*/}"
filename="${filename//..\//}"

contenttype_declared="$(
  mime-read -v "$Tmp-cgivars" \
  | awk 'BEGIN{IGNORECASE=1} $0 ~ /^[0-9]+[[:space:]]*Content-Type:/ { sub(/^[0-9]+[[:space:]]*Content-Type:[[:space:]]*/,""); print; exit }'
)"
fullname="$(mime-read fullname "$Tmp-cgivars" 2>/dev/null || true)"

upload_file_uuid="_$(uuidgen | tr 'A-Z' 'a-z')"
upload_file_dir="$file_dir/$upload_file_uuid"
mkdir -p "$upload_file_dir" || die_json "ERROR: cannot mkdir $upload_file_dir"

DEST_FILE="$upload_file_dir/$filename"
cp -- "$Tmp-uploadfile" "$DEST_FILE" || die_json "ERROR: cannot save upload to $DEST_FILE"

uuid="_$(uuidgen | tr 'A-Z' 'a-z')"
resource_dir="$resource_day_dir/$uuid"
mkdir -p "$resource_dir" || die_json "ERROR: cannot mkdir $resource_dir"

resource_file="$resource_dir/resource.json"
resource_uri=""

manifest_file="$upload_file_dir/manifest.json"
thumb_file="$upload_file_dir/thumbnail.jpg"
thumbnail_uri=""

url_encode() {
  printf '%s' "$1" | sed 's/%/%25/g; s/ /%20/g; s#/#%2F#g; s/&/%26/g; s/?/%3F/g; s/=/%3D/g'
}

protected_file_uri() {
  local area="$1" rel="$2"
  printf '/wu_wei2/server/load-file.cgi?area=%s&path=%s&user_id=%s' \
    "$(url_encode "$area")" "$(url_encode "$rel")" "$(url_encode "$user_id")"
}

upload_relpath="$year/$month/$day/$upload_file_uuid/$filename"
file_uri="$(protected_file_uri upload "$upload_relpath")"

det_mime="$(file -b --mime-type -- "$DEST_FILE" 2>/dev/null || true)"
det_full="$(file -b -i -- "$DEST_FILE" 2>/dev/null || true)"

contenttype="$(printf '%s' "${contenttype_declared:-}" | tr -d '\r\n')"
if [[ -z "${contenttype:-}" || "${contenttype,,}" == application/octet-stream* ]]; then
  contenttype="$det_mime"
fi

video_wh=""
duration=""
if [[ "${det_mime:-}" == video/* || "${contenttype:-}" == video/* ]]; then
  if [[ -n "$FFPROBE" ]]; then
    video_wh="$("$FFPROBE" -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$DEST_FILE" 2>/dev/null || true)"
    duration="$("$FFPROBE" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DEST_FILE" 2>/dev/null || true)"
  fi
fi
if [[ -n "${duration:-}" ]]; then
  duration="$(printf '%.3f' "${duration}" 2>/dev/null || printf '%s' "$duration")"
fi

thumbnail=""
thumb_wh=""
tw=""; th=""
size=200

if [[ "${det_mime:-}" == video/* || "${contenttype:-}" == video/* ]]; then
  ss=1
  # If we know duration, seek to 1 second or 10% of duration (whichever is smaller but >=1)
  if [[ -n "${duration:-}" ]]; then
    # integer seconds
    dur_i="$(printf '%.0f' "$duration" 2>/dev/null || echo 0)"
    if (( dur_i > 10 )); then ss=$((dur_i/10)); fi
    if (( ss < 1 )); then ss=1; fi
  fi

  if [[ -n "$FFMPEG" ]]; then
    if "$FFMPEG" -hide_banner -loglevel error \
      -ss "$ss" -i "$DEST_FILE" \
      -frames:v 1 -vf "scale='min($size,iw)':-2" -q:v 3 \
      "$thumb_file"; then
      thumbnail="$(protected_file_uri upload "${thumb_file#$upload_root/}")"
      if [[ -n "$FFPROBE" ]]; then
        thumb_wh="$("$FFPROBE" -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$thumb_file" 2>/dev/null || true)"
      fi
      if [[ "$thumb_wh" == *x* ]]; then
        tw="${thumb_wh%x*}"
        th="${thumb_wh#*x}"
      fi
    fi
  fi
fi

if [ -n "${fullname:-}" ]; then
  name="$fullname"
else
  name="$(printf '%s' "$DEST_FILE" | sed 's#^\(.*\)/\([^/]*\)$#\2#')"
fi

totalsize="$(stat -c %s -- "$DEST_FILE" 2>/dev/null || true)"
lastmodified="$(stat -c %y -- "$DEST_FILE" 2>/dev/null || true)"

{
  original_sha="$(sha256sum "$DEST_FILE" 2>/dev/null | awk '{print $1}')"
  thumb_sha=""
  [ -f "$thumb_file" ] && thumb_sha="$(sha256sum "$thumb_file" 2>/dev/null | awk '{print $1}')"
  created_at="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  cat >"$manifest_file" <<JSON || die_json "ERROR: cannot write manifest file $manifest_file"
{
  "id": "$(json_escape "$upload_file_uuid")",
  "type": "UploadResource",
  "version": 1,
  "created_at": "$(json_escape "$created_at")",
  "created_by": "$(json_escape "$user_id")",
  "title": "$(json_escape "$name")",
  "kind": "video",
  "original": {
    "file": "$(json_escape "$filename")",
    "display_name": "$(json_escape "$name")",
    "mime": "$(json_escape "${contenttype:-application/octet-stream}")",
    "size": ${totalsize:-0},
    "sha256": "$(json_escape "$original_sha")"
  }$(if [ -f "$thumb_file" ]; then printf ',\n  "thumbnail": {\n    "file": "thumbnail.jpg",\n    "mime": "image/jpeg",\n    "size": %s,\n    "sha256": "%s"%s\n  }' "$(stat -c %s -- "$thumb_file" 2>/dev/null || echo 0)" "$(json_escape "$thumb_sha")" "$(if [ -n "${tw:-}" ] && [ -n "${th:-}" ]; then printf ',\n    "display_size": "%s"' "$(json_escape "${tw}x${th}")"; fi)"; fi)
}
JSON
  cat <<JSON
{
  "id": "$(json_escape "$uuid")",
  "type": "Resource",
  "origin": {
    "type": "userRegistered",
    "subtype": "uploadedVideo",
    "provider": "local"
  },
  "identity": {
    "title": "$(json_escape "$name")",
    "canonicalUri": "",
    "uri": ""
  },
  "media": {
    "kind": "video",
    "mimeType": "$(json_escape "${contenttype:-application/octet-stream}")",
    "downloadable": true,
    "duration": $(if [ -n "${duration:-}" ]; then printf '%s' "$duration"; else printf 'null'; fi)
  },
  "viewer": {
    "supportedModes": ["infoPane", "newTab", "newWindow", "download", "player"],
    "defaultMode": "infoPane",
    "embed": {
      "enabled": true,
      "uri": ""
    }
  },
  "storage": {
    "managed": true,
    "copyPolicy": "snapshot",
    "manifest": {
      "area": "upload",
      "path": "$(json_escape "$year/$month/$day/$upload_file_uuid/manifest.json")"
    },
    "files": [
      {
        "role": "original",
        "area": "upload",
        "path": "$(json_escape "$upload_relpath")",
        "mimeType": "$(json_escape "${contenttype:-application/octet-stream}")",
        "size": ${totalsize:-0},
        "sha256": "$(json_escape "$original_sha")"$(if [ -n "${video_wh:-}" ]; then printf ',\n        "displaySize": "%s"' "$(json_escape "$video_wh")"; fi)
      }$(if [ -f "$thumb_file" ]; then printf ',\n      {\n        "role": "thumbnail",\n        "area": "upload",\n        "path": "%s",\n        "mimeType": "image/jpeg",\n        "size": %s,\n        "sha256": "%s"%s\n      }' "$(json_escape "${thumb_file#$upload_root/}")" "$(stat -c %s -- "$thumb_file" 2>/dev/null || echo 0)" "$(json_escape "$thumb_sha")" "$(if [ -n "${tw:-}" ] && [ -n "${th:-}" ]; then printf ',\n        "displaySize": "%s"' "$(json_escape "${tw}x${th}")"; fi)"; fi)
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
} >"$resource_file" || die_json "ERROR: cannot write resource file $resource_file"

printf "Content-Type: application/json\r\n\r\n"

warn=""
if [[ -z "$FFMPEG" ]]; then
  warn="ffmpeg not found"
elif [[ -z "$FFPROBE" ]]; then
  warn="ffprobe not found"
fi

if [[ -n "${thumbnail:-}" ]]; then
  cat <<JSON
{
  "id":"$uuid",
  "resource":$(cat "$resource_file"),
  "name":"$(json_escape "$name")",
  "option":"video",
  "contenttype":"$(json_escape "${contenttype:-}")",
  "uri":"$(json_escape "$file_uri")",
  "warning":"$(json_escape "$warn")",
  "value":{
    "totalsize":"$(json_escape "${totalsize:-}")",
    "lastmodified":"$(json_escape "${lastmodified:-}")",
    "resource":{"uri":"$(json_escape "$resource_uri")","size":"$(json_escape "${video_wh:-}")"},
    "thumbnail":{"uri":"$(json_escape "$thumbnail")","size":"$(json_escape "${tw}x${th}")"},
    "duration":"$(json_escape "${duration:-}")",
    "file":"",
    "identify":"$(json_escape "$det_full")"
  }
}
JSON
else
  cat <<JSON
{
  "id":"$uuid",
  "resource":$(cat "$resource_file"),
  "name":"$(json_escape "$name")",
  "option":"video",
  "contenttype":"$(json_escape "${contenttype:-}")",
  "uri":"$(json_escape "$file_uri")",
  "warning":"$(json_escape "$warn")",
  "value":{
    "totalsize":"$(json_escape "${totalsize:-}")",
    "lastmodified":"$(json_escape "${lastmodified:-}")",
    "resource":{"uri":"$(json_escape "$resource_uri")","size":"$(json_escape "${video_wh:-}")"},
    "duration":"$(json_escape "${duration:-}")",
    "file":"",
    "identify":"$(json_escape "$det_full")"
  }
}
JSON
fi

# rm -f "$Tmp"-*
# rm -f log/${0##*/}.$$.*
exit 0
