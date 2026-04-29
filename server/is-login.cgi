#!/bin/bash
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
set -ux   # cookie無しは正常系なので -e は付けない
export LC_ALL=C
type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH="./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003
Tmp=/tmp/${0##*/}.$$

# === Log ============================================================
exec 2>log/${0##*/}.$$.log

trim() { printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'; }
UUID_RE='^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

# --- 1) Read session id from Cookie ---------------------------------
printf '%s' "${HTTP_COOKIE:-''}" \
  | sed 's/&/%26/g; s/[;, ]\{1,\}/\&/g; s/^&//; s/&$//' \
  | cgi-name > "$Tmp-cgivars"

user_id="$(nameread wuwei_user_id "$Tmp-cgivars" 2>/dev/null || true)"
user_id="$(trim "$(printf '%s' "$user_id" | tr -d '\r\n')")"

# --- 2) Response -----------------------------------------------------
printf "Content-Type: application/json\r\n\r\n"

if [[ -n "$user_id" && "$user_id" =~ $UUID_RE ]]; then
  printf '{"user_id":"%s"}\n' "$user_id"
else
  printf '{"user_id":null}\n'
fi

rm -f "$Tmp"-*
# ログを残したいなら次行をコメントアウト
rm -f log/${0##*/}.$$.* 2>/dev/null || true
exit 0
