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


Tmp=/tmp/${0##*/}.$$

# === Initialize shell environment ===================================
set -eux
# -e  Exit immediately if a command exits with a non-zero status.
# -u  Treat unset variables as an error when substituting.
# -v  Print shell input lines as they are read.
# -x  Print commands and their arguments as they are executed.
export LC_ALL=C
type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH="./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003  # to make HP-UX conform to POSIX
# === Log ============================================================
exec 2>log/${0##*/}.$$.log

# === Start ==========================================================
# example file command out put for photo
# ../upload/DSC04888.JPG: JPEG image data, Exif standard: [TIFF image data, little-endian, direntries=12, description=                               , manufacturer=SONY, model=NEX-7, orientation=upper-left, xresolution=202, yresolution=210, resolutionunit=2, software=NEX-7 v1.03, datetime=2018:10:27 17:01:50], baseline, precision 8, 6000x4000, frames 3
#
B='\([^\/]*\)\/\([^\/]*\)\/\([^:]*\):'
C='\([^[]*\)\['
D='[[:blank:]]model=\([^[:blank:]]*\),'
E='[[:blank:]]datetime=\(....\):\(..\):\(..\)[[:blank:]]'
F='[[:blank:]]\([^,]*\), frames'
STR='\1\x0\2\x0\3\x0\5\x0\6\x0\7\x0\8\x0\9'

file ../upload/*              |
sed "s/^$B.*$C.*$D.*$E.*$F.*\$/$STR/" |
tr 'x' ' ' | tr ':' '-'       |
tr '/' ' ' | tr '\000' ' '    |#> $Tmp-file-attr

#cat $Tmp-file-attr |
while read c1 c2 c3 c4 c5 c6 c7 c8 c9 ; do
	echo $c3 $c8x$c9
done

