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
set -ux # identify cause error on some pdf file. so drop -e
# -e  Exit immediately if a command exits with a non-zero status.
# -u  Treat unset variables as an error when substituting.
# -v  Print shell input lines as they are read.
# -x  Print commands and their arguments as they are executed.
export LC_ALL=C
type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003  # to make HP-UX conform to POSIX
Tmp=/tmp/${0##*/}.$$
# === Log ============================================================
exec 2>log/${0##*/}.$$.log
# === Upload =========================================================
dd bs=1K if=/dev/stdin > $Tmp-cgivars
# dd bs=${CONTENT_LENGTH:-0} count=1 > $Tmp-cgivars
mime-read file $Tmp-cgivars > $Tmp-uploadfile
filename=$(mime-read -v $Tmp-cgivars                                       |
  grep -Ei '^[0-9]+[[:blank:]]*Content-Disposition:[[:blank:]]*form-data;' |
  grep '[[:blank:]]name="file"'                                            |
  head -n 1                                                                |
  sed 's/.*[[:blank:]]filename="\([^"]*\)".*/\1/'                          |
  sed 's/[[:space:]]/_/g')
# ファイルを保存せずその内容を読み取りその内容を返す。
cat <<HTTP_RESPONSE
Content-Type: text/html

$(cat $Tmp-uploadfile)
HTTP_RESPONSE

rm -f $Tmp-*
rm -f log/${0##*/}.$$.*
exit 0

