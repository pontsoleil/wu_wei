#!/bin/sh
# logout.cgi
#
# Normal mode:
#   stderr is appended only to:
#     log/cgi.err
#
# Debug mode:
#   create the following flag file, then call this CGI:
#     log/.debug.logout.cgi
#
#   In debug mode, stderr is written to both:
#     log/cgi.err
#     log/logout.cgi.<pid>.log
#
#   Enable debug:
#     touch log/.debug.logout.cgi
#
#   Disable debug:
#     rm -f log/.debug.logout.cgi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1

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

export LC_ALL=C

Tmp="/tmp/${0##*/}.$$"

emit_cookie_delete() {
  # login.cgi の fail_json() と同等
  cat <<HTTP_COOKIE_DELETE
Set-Cookie: wuwei_user_id=; Max-Age=0; Path=/wu_wei2; Domain=.sambuichi.jp; HttpOnly
Set-Cookie: wuwei_user_id=; Max-Age=0; Path=/wu_wei2/server; Domain=.sambuichi.jp; HttpOnly
HTTP_COOKIE_DELETE
}

printf "Content-Type: application/json\r\n"
printf "Cache-Control: no-store\r\n"
emit_cookie_delete
printf "\r\n"
printf '{ "ok": true, "logged_in": false }\n'

rm -f "$Tmp" "$Tmp"-*
exit 0
