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
# --------------------------------------------------------------------
# yyyy mm
year=$(date '+%Y')
month=$(date '+%2m')
# --------------------------------------------------------------------
dd bs=${CONTENT_LENGTH:-0} count=1 | cgi-name > $Tmp-cgivars

# --------------------------------------------------------------------
# user_id
user_id=$(nameread user_id $Tmp-cgivars | sed 's/^\"\(.*\)\"$/\1/')
if [[ "$user_id" == ERROR* || -z "$user_id" ]]; then
  user_id=$(printf '%s' "${QUERY_STRING:-}" | tr '&' '\n' | sed -n 's/^user_id=//p' | head -n 1 | sed 's/%2[Ff]/\//g; s/%2[Dd]/-/g; s/%5[Ff]/_/g')
fi
[[ "$user_id" == ERROR* ]] && error_exit ""
# --------------------------------------------------------------------
# note
note_id=$(nameread id $Tmp-cgivars | sed 's/^\"\(.*\)\"$/\1/')
if [[ "$note_id" == ERROR* || -z "$note_id" ]]; then
  note_id=$(printf '%s' "${QUERY_STRING:-}" | tr '&' '\n' | sed -n 's/^id=//p' | head -n 1 | sed 's/%2[Ff]/\//g; s/%2[Dd]/-/g; s/%5[Ff]/_/g')
fi
note_dir=$(nameread note data/environment | sed 's/^\"\(.*\)\"$/\1/' | sed "s/^\(\/.*\)\/\*\/\(.*\)$/\1\/${user_id}\/\2/")
note=${note_dir}/${note_id}
if [ -f "${note}/note.json" ]; then
  note=${note}
elif [ -f "${note}" ]; then
  note=${note}
else
  found=$(find "${note_dir}" -type f -name note.json 2>/dev/null | while IFS= read -r file; do
    case "$file" in
      */${note_id}/note.json)
        dirname "$file"
        break
        ;;
    esac
  done)
  [ -n "$found" ] && note=$found
fi
# --------------------------------------------------------------------
# trash
trash_dir=$(nameread trash data/environment | sed 's/^\"\(.*\)\"$/\1/' | sed "s/^\(\/.*\)\/\*\/\(.*\)$/\1\/${user_id}\/\2/")
# check trash's directory
[ -d ${trash_dir} ] || mkdir ${trash_dir}
trash_dir=${trash_dir}/${year}
[ -d ${trash_dir} ] || mkdir ${trash_dir}
trash_dir=${trash_dir}/${month}/
[ -d ${trash_dir} ] || mkdir ${trash_dir}
# --------------------------------------------------------------------
# remove(move to trash)
if [ ! -e "${note}" ]; then
  error_exit 'ERROR NOTE NOT FOUND'
fi
if mv "${note}" "${trash_dir}"; then
  cat <<HTTP_RESPONSE
Content-Type: text/plain

SUCCESS NOTE REMOVED
HTTP_RESPONSE
  rm -f $Tmp-*
  rm -f log/${0##*/}.$$.*
  rm -f $cgivars
  exit 0
else
  error500_exit 'ERROR WHILE REMOVING NOTE'
fi
# remove-note.cgi
