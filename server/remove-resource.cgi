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
# --------------------------------------------------------------------
# resource
resource_dir=$(nameread resource data/environment | sed 's/^\"\(.*\)\"$/\1/' |
sed "s/^\(\/.*\)\/\*\/\(.*\)$/\1\/${user_id}\/\2/")
resource_id=$(nameread id $cgivars | sed 's/^\"\(.*\)\"$/\1/')
resource=$(find ${resource_dir} -name ${resource_id})
# file
file=$(cat ${resource} | awk '{print $1 }' | sed "s/^\([^:]*\):$/\1/")
#thumbnail
thumbnail_dir=$(nameread thumbnail data/environment | sed 's/^\"\(.*\)\"$/\1/' |
sed "s/^\(\/.*\)\/\*\/\(.*\)$/\1\/${user_id}\/\2/")
thumbnail_id=$(nameread id $cgivars | sed 's/^\"\(.*\)\"$/\1/')
thumbnail=$(find ${resource_dir} -name ${resource_id}*)
# --------------------------------------------------------------------
# trash
year=$(date '+%Y')
month=$(date '+%2m')
trash_dir=$(nameread trash data/environment | sed 's/^\"\(.*\)\"$/\1/' |
sed "s/^\(\/.*\)\/\*\/\(.*\)$/\1\/${user_id}\/\2/"                   )
# check trash's directory
[ -d ${trash_dir} ] || mkdir ${trash_dir}
trash_dir=${trash_dir}/${year}
[ -d ${trash_dir} ] || mkdir ${trash_dir}
trash_dir=${trash_dir}/${month}
[ -d ${trash_dir} ] || mkdir ${trash_dir}
# --------------------------------------------------------------------
# remove(move to trash)
if [ -n "$thumbnail" ]; then
  mv ${thumbnail} ${trash_dir}
else
  :
fi
if mv ${resource} ${trash_dir} && mv ${file} ${trash_dir}; then
  cat <<HTTP_RESPONSE
Content-Type: text/html

SUCCESS RESOURCE REMOVED
HTTP_RESPONSE
  rm -f $Tmp-*
  rm -f log/${0##*/}.$$.*
  rm -f $cgivars
  exit 0
else
  error500_exit 'ERROR WHILE REOMOVING RESOURCE'
fi
# remove-resource.cgi

