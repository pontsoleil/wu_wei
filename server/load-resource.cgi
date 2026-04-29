#!/bin/sh
# WW_CGI_BOOTSTRAP: stabilise cwd under fcgiwrap and capture stderr
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1
mkdir -p log
exec 2>>"$SCRIPT_DIR/log/cgi.err"

# WW_CGI_INIT: make relative paths stable under fcgiwrap
SCRIPT_PATH=${SCRIPT_FILENAME:-$0}
SCRIPT_DIR=${SCRIPT_PATH%/*}
[ "$SCRIPT_DIR" = "$SCRIPT_PATH" ] && SCRIPT_DIR="."
cd "$SCRIPT_DIR" || exit 1
mkdir -p log

# === Initialize shell environment ===================================
set -eux
# -e  Exit immediately if a command exits with a non-zero status.
# -u  Treat unset variables as an error when substituting.
# -v  Print shell input lines as they are read.
# -x  Print commands and their arguments as they are executed.
export LC_ALL=C
type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003  # to make HP-UX conform to POSIX
# === temporary file prefix ==========================================
Tmp=/tmp/${0##*/}.$$
# === Log ============================================================
exec 2>log/${0##*/}.$$.log
# === function =======================================================
error500_exit() {
  cat <<HTTP_RESPONSE
Status: 500 Internal Server Error
Content-Type: text/plain

500 Internal Server Error
$@
HTTP_RESPONSE
  exit 1
}
# --------------------------------------------------------------------
error_exit() {
  if [[ "$@" == ERROR* ]]; then
    cat <<HTTP_RESPONSE
Content-Type: text/plain

$@
HTTP_RESPONSE
  else
    cat <<HTTP_RESPONSE
Content-Type: text/plain

ERROR $@
HTTP_RESPONSE
  fi
  exit 0
}
# === Login check ====================================================
user_info=$(is-login)
[ -n "$user_info" ] || error_exit 'NOT LOGGED IN'
user_id=$(echo "$user_info" | awk '{print $1}')
[[ "$user_id" == ERROR* ]] && error_exit "$user_info"
cgivars=$(echo "$user_info" | awk '{print $3}')
# === Resource check =================================================
resource_dir=$(nameread resource data/environment | sed 's/^\"\(.*\)\"$/\1/' |
sed "s/^\(\/.*\)\/\*\/\(.*\)$/\1\/${user_id}\/\2/"                   )
[ -d ${resource_dir} ] || error_exit 'RESOURCE DIR NOT EXISTS'
# --- get resource with id -------------------------------------------
id=$(nameread id $cgivars | sed 's/^\"\(.*\)\"$/\1/')
# id is either yyyy/mm/note_id or note_id
resource=${resource_dir}/${id}
# read resource
id=$(nameread id $resource | sed 's/^\"\(.*\)\"$/\1/')
location=$(nameread location $resource | sed 's/^\"\(.*\)\"$/\1/')
name=$(nameread name $resource | sed 's/^\"\(.*\)\"$/\1/')
option=$(nameread option $resource | sed 's/^\"\(.*\)\"$/\1/')
uri=$(nameread uri $resource | sed 's/^\"\(.*\)\"$/\1/')
format=$(nameread format $resource | sed 's/^\"\(.*\)\"$/\1/')
value.totalsize=$(nameread value.totalsize $resource | sed 's/^\"\(.*\)\"$/\1/')
value.lastmodified=$(nameread value.lastmodified $resource | sed 's/^\"\(.*\)\"$/\1/')
value.comment=$(nameread value.comment $resource | sed 's/^\"\(.*\)\"$/\1/')
value.resource.uri=$(nameread value.resource.uri $resource | sed 's/^\"\(.*\)\"$/\1/')
value.resource.size=$(nameread value.resource.size $resource | sed 's/^\"\(.*\)\"$/\1/')
value.thumbnail.uri=$(nameread value.thumbnail.uri $resource | sed 's/^\"\(.*\)\"$/\1/')
value.thumbnail.size=$(nameread value.thumbnail.size $resource | sed 's/^\"\(.*\)\"$/\1/')
value.file=$(nameread value.file $resource | sed 's/^\"\(.*\)\"$/\1/')
value.identify=$(nameread value.identify $resource | sed 's/^\"\(.*\)\"$/\1/')
# === HTTP response ==================================================
cat <<HTTP_RESPONSE
Content-Type: application/json

{
  "id": $id,
  "location": $location,
  "name": $name,
  "option": $option,
  "uri": $uri,
  "format": $format,
  "value": {
    "totalsize": $value.totalsize,
    "lastmodified": $value.lastmodified,
    "comment": $value.comment,
    "resource": {"uri": $value.resource.uri, "size": $value.resource.size },
    "thumbnail": {"uri": $value.thumbnail.uri, "size": $value.thumbnail.size },
    "file": $value.file,
    "identify": $value.identify,
  }
}
HTTP_RESPONSE
rm -f log/${0##*/}.$$.*
rm -f $cgivars
exit 0
# load-resource.cgi
