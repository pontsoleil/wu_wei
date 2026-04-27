convert 2018/10/DSC04636.JPG -write mpr:image +delete \
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

\( mpr:image -thumbnail 600x400! -write DSC04636_600.png \) \
\( mpr:image -thumbnail 300x200! -write DSC04636_300.png \) \
\( mpr:image -thumbnail 150x100! -write DSC04636_150.png \) \
+clone -delete 0-2 -gravity center -crop 75x50+0+0 DSC04636_75.png
