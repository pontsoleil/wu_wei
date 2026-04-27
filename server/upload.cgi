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
mkdir -p "$file_dir/$year/$month"      || die_json "ERROR: cannot mkdir $file_dir/$year/$month (permission?)"
mkdir -p "$resource_dir/$year/$month"  || die_json "ERROR: cannot mkdir $resource_dir/$year/$month (permission?)"
mkdir -p "$thumbnail_dir/$year/$month" || die_json "ERROR: cannot mkdir $thumbnail_dir/$year/$month (permission?)"

file_dir="$file_dir/$year/$month"
resource_dir="$resource_dir/$year/$month"
thumbnail_dir="$thumbnail_dir/$year/$month"

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

mime-read file "$Tmp-cgivars" > "$Tmp-uploadfile"

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

# full path to save uploaded file
dest_file="$file_dir/$filename"
cp -- "$Tmp-uploadfile" "$dest_file" || die_json "ERROR: cannot save upload to $dest_file"

# --- ids / uri mapping -----------------------------------------------
uuid="$(uuidgen)"
uuidrgx='[0-9a-f]\{8\}-[0-9a-f]\{4\}-[1-5][0-9a-f]\{3\}-[89ab][0-9a-f]\{3\}-[0-9a-f]\{12\}'

escaped_base="$(printf '%s' "$base_dir" | sed 's/\//\\\//g')"

resource_file="$resource_dir/$uuid"
resource_uri="$(printf '%s' "$resource_file" | sed "s/^${escaped_base}\/\(${uuidrgx}\)\/resource\/\(.*\)$/resource\/\1\/\2/")"

thumb_file="$thumbnail_dir/$uuid.jpg"
thumbnail_uri="$(printf '%s' "$thumb_file" | sed "s/^${escaped_base}\/\(${uuidrgx}\)\/thumbnail\/\(.*\)$/thumbnail\/\1\/\2/")"

# stored file uri: upload/<user_uuid>/...
file_uri="$(printf '%s' "$dest_file" | sed "s/^${escaped_base}\/\(${uuidrgx}\)\/upload\/\(.*\)$/upload\/\1\/\2/")"

# --- detect actual file type ----------------------------------------
content_type="$(file -b -i -- "$dest_file" 2>/dev/null || true)"

# --- thumbnail / size ------------------------------------------------
thumbnail=""
iw=""; ih=""; w=""; h=""

if [[ "$content_type" == application/pdf* ]]; then
  thumbnail="$thumbnail_uri"
  iw="$(identify "${dest_file}[0]" 2>/dev/null | sed -e "s/^[^[:blank:]]*[[:blank:]][^[:blank:]]*[[:blank:]]\([0-9]*\)x\([0-9]*\)[[:blank:]].*$/\1/" || true)"
  ih="$(identify "${dest_file}[0]" 2>/dev/null | sed -e "s/^[^[:blank:]]*[[:blank:]][^[:blank:]]*[[:blank:]]\([0-9]*\)x\([0-9]*\)[[:blank:]].*$/\2/" || true)"
elif [[ "$content_type" == image/* ]]; then
  thumbnail="$thumbnail_uri"
  iw="$(identify "$dest_file" 2>/dev/null | sed -e "s/^[^[:blank:]]*[[:blank:]][^[:blank:]]*[[:blank:]]\([0-9]*\)x\([0-9]*\)[[:blank:]].*$/\1/" || true)"
  ih="$(identify "$dest_file" 2>/dev/null | sed -e "s/^[^[:blank:]]*[[:blank:]][^[:blank:]]*[[:blank:]]\([0-9]*\)x\([0-9]*\)[[:blank:]].*$/\2/" || true)"
fi

if [[ "$content_type" == application/pdf* || "$content_type" == image/* ]]; then
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

  if [[ "$content_type" == application/pdf* ]]; then
    convert -thumbnail "${w}x${h}" -background white -alpha remove \
      "${dest_file}[0]" "$thumb_file" \
      || cp -f "$SCRIPT_DIR/PDF_32.png" "$thumb_file"
  else
    convert -define "jpeg:size=${iw:-200}x${ih:-200}" \
      "$dest_file" -auto-orient -thumbnail "${w}x${h}" -unsharp 0x.5 \
      "$thumb_file" || true
  fi
fi

# --- identify (optional) --------------------------------------------
identify_out=""
if [[ "$content_type" == application/pdf* ]]; then
  identify_out="$(identify "${dest_file}[0]" 2>/dev/null || true)"
elif [[ "$content_type" == image/* ]]; then
  identify_out="$(identify "$dest_file" 2>/dev/null || true)"
fi

# --- resource fields -------------------------------------------------
if [ -n "${fullname:-}" ]; then
  name="$fullname"
else
  name="$(printf '%s' "$dest_file" | sed 's#^\(.*\)/\([^/]*\)$#\2#')"
fi

totalsize="$(stat -c %s -- "$dest_file" 2>/dev/null || true)"
lastmodified="$(stat -c %y -- "$dest_file" 2>/dev/null || true)"

# --- write resource file --------------------------------------------
{
  echo "id $uuid"
  echo "name $name"
  echo "option upload"
  echo "contenttype ${contenttype:-}"
  echo "uri $file_uri"
  echo "value.totalsize ${totalsize:-}"
  echo "value.lastmodified ${lastmodified:-}"
  echo "value.commment null"
  if [[ "$content_type" == application/pdf* || "$content_type" == image/* ]]; then
    echo "value.resource.uri $resource_uri"
    echo "value.resource.size ${iw}x${ih}"
    echo "value.thumbnail.uri $thumbnail"
    echo "value.thumbnail.size ${w}x${h}"
    echo "value.identify $identify_out"
    echo "value.file "
  else
    echo "value.resource.uri $resource_uri"
    echo "value.resource.size null"
    echo "value.thumbnail.uri null"
    echo "value.thumbnail.size null"
    echo "value.identify null"
    echo "value.file "
  fi
} >>"$resource_file" || die_json "ERROR: cannot write resource file $resource_file"

# --- return json -----------------------------------------------------
printf "Content-Type: application/json\r\n\r\n"

if [[ "$content_type" == application/pdf* || "$content_type" == image/* ]]; then
  cat <<JSON
{
  "id":"$uuid",
  "name":"$(json_escape "$name")",
  "option":"upload",
  "contenttype":"$(json_escape "${contenttype:-}")",
  "uri":"$(json_escape "$file_uri")",
  "value":{
    "totalsize":"$(json_escape "${totalsize:-}")",
    "lastmodified":"$(json_escape "${lastmodified:-}")",
    "resource":{"uri":"$(json_escape "$resource_uri")","size":"$(json_escape "${iw}x${ih}")"},
    "thumbnail":{"uri":"$(json_escape "$thumbnail")","size":"$(json_escape "${w}x${h}")"},
    "file":"",
    "identify":"$(json_escape "$identify_out")"
  }
}
JSON
else
  cat <<JSON
{
  "id":"$uuid",
  "name":"$(json_escape "$name")",
  "option":"upload",
  "contenttype":"$(json_escape "${contenttype:-}")",
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

rm -f "$Tmp" "$Tmp"-*
exit 0