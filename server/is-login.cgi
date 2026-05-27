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

resolve_env_path() {
  local tpl="$1"
  case "$tpl" in
    /*) printf '%s' "$tpl" ;;
    wu_wei2) printf '%s' "$(dirname "$SCRIPT_DIR")" ;;
    wu_wei2/*) printf '%s/%s' "$(dirname "$SCRIPT_DIR")" "${tpl#wu_wei2/}" ;;
    *) printf '%s/%s' "$SCRIPT_DIR" "$tpl" ;;
  esac
}

resolve_user_dir() {
  local base="$1" candidate
  base="$(resolve_env_path "$base")"
  for candidate in \
    "$base/user" \
    "$base" \
    "$(dirname "$base")/user" \
    "$(dirname "$SCRIPT_DIR")/cgi-bin/user" \
    "$(dirname "$(dirname "$base")")/wu_wei2/user" \
    "$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")/wu_wei2/user" \
    "$SCRIPT_DIR/user"
  do
    if [ -r "$candidate/member.name" ]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  printf '%s' "$base/user"
}

json_escape(){
  local s="$1"
  s="${s//\\/\\\\}"; s="${s//\"/\\\"}"
  s="${s//$'\r'/\\r}"; s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

# --- 1) Read session id from Cookie ---------------------------------
printf '%s' "${HTTP_COOKIE:-''}" \
  | sed 's/&/%26/g; s/[;, ]\{1,\}/\&/g; s/^&//; s/&$//' \
  | cgi-name > "$Tmp-cgivars"

user_id="$(nameread wuwei_user_id "$Tmp-cgivars" 2>/dev/null || true)"
user_id="$(trim "$(printf '%s' "$user_id" | tr -d '\r\n')")"

# --- 2) Response -----------------------------------------------------
printf "Content-Type: application/json\r\n\r\n"

if [[ -n "$user_id" && "$user_id" =~ $UUID_RE ]]; then
  user_dir=$(nameread user data/environment 2>/dev/null || true)
  user_dir="$(trim "${user_dir#\"}")"; user_dir="$(trim "${user_dir%\"}")"
  user_dir="$(resolve_user_dir "$user_dir")"

  login=""
  user_name=""
  user_role=""
  if [ -r "$user_dir/member.name" ]; then
    login=$(awk -v id="$user_id" '$1 == id {print $2; exit}' "$user_dir/member.name")
    user_name=$(awk -v id="$user_id" '$1 == id {print $3; exit}' "$user_dir/member.name")
    user_role=$(awk -v id="$user_id" '$1 == id {print $4; exit}' "$user_dir/member.name")
  fi

  printf '{"login":"%s","user_id":"%s","name":"%s","role":"%s"}\n' \
    "$(json_escape "$(trim "$login")")" \
    "$(json_escape "$user_id")" \
    "$(json_escape "$(trim "$user_name")")" \
    "$(json_escape "$(trim "$user_role")")"
else
  printf '{"user_id":null}\n'
fi

rm -f "$Tmp"-*
# ログを残したいなら次行をコメントアウト
rm -f log/${0##*/}.$$.* 2>/dev/null || true
exit 0
