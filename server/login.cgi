#!/bin/bash
# login.cgi
#
# Normal mode:
#   stderr is appended only to:
#     log/cgi.err
#
# Debug mode:
#   create the following flag file, then call this CGI:
#     log/.debug.login.cgi
#
#   In debug mode, stderr is written to both:
#     log/cgi.err
#     log/login.cgi.<pid>.log
#
#   Enable debug:
#     touch log/.debug.login.cgi
#
#   Disable debug:
#     rm -f log/.debug.login.cgi

LANG=C

# --- locate script dir (stable under fcgiwrap) -----------------------
SCRIPT_PATH="${SCRIPT_FILENAME:-$0}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$SCRIPT_PATH")" && pwd)" || exit 1
cd "$SCRIPT_DIR" || exit 1

# --- logs ------------------------------------------------------------
mkdir -p "$SCRIPT_DIR/log"

REQLOG=""
DEBUG_FILE="$SCRIPT_DIR/log/.debug.${0##*/}"

if [ -f "$DEBUG_FILE" ]; then
  REQLOG="$SCRIPT_DIR/log/${0##*/}.$$.log"
  # stderr -> both cgi.err and per-request log
  exec 2> >(tee -a "$SCRIPT_DIR/log/cgi.err" >>"$REQLOG")
  set -u -x
else
  # stderr -> cgi.err only
  exec 2>>"$SCRIPT_DIR/log/cgi.err"
  set -u
fi

# --- shell env -------------------------------------------------------
export LC_ALL=C
type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"

trim(){ printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'; }

json_escape(){
  local s="$1"
  s="${s//\\/\\\\}"; s="${s//\"/\\\"}"
  s="${s//$'\r'/\\r}"; s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

emit_cookie_delete() {
  cat <<HTTP_COOKIE_DELETE
Set-Cookie: wuwei_user_id=; Max-Age=0; Path=/wu_wei2; Domain=.sambuichi.jp; HttpOnly
Set-Cookie: wuwei_user_id=; Max-Age=0; Path=/wu_wei2/server; Domain=.sambuichi.jp; HttpOnly
HTTP_COOKIE_DELETE
}

fail_json() {
  local msg="$1"
  printf "Status: 401 Unauthorized\r\n"
  printf "Content-Type: application/json\r\n"
  emit_cookie_delete
  printf "\r\n"
  printf '{ "error": "%s" }\n' "$(json_escape "$msg")"
  rm -f "$Tmp"-*
  exit 0
}

METHOD=${REQUEST_METHOD:-''}
TYPE=$(echo "${CONTENT_TYPE:-undefined}" | sed 's/;.*//')

user=""; password=""

if [ "GET" = "$METHOD" ]; then
  printf '%s' "${QUERY_STRING:-''}" | cgi-name > "$Tmp-cgivars"
  user=$(nameread user "$Tmp-cgivars" 2>/dev/null || true)
  password=$(nameread pw "$Tmp-cgivars" 2>/dev/null || true)

elif [ "POST" = "$METHOD" ]; then
  if [ "application/x-www-form-urlencoded" = "$TYPE" ]; then
    dd bs=1 count="${CONTENT_LENGTH:-0}" 2>/dev/null | cgi-name > "$Tmp-cgivars"
    user=$(nameread user "$Tmp-cgivars" 2>/dev/null || true)
    password=$(nameread pw "$Tmp-cgivars" 2>/dev/null || true)

  elif [ "text/plain" = "$TYPE" ]; then
    dd bs=1 count="${CONTENT_LENGTH:-0}" 2>/dev/null | sed 's/\r//' | sed 's/=/ /' > "$Tmp-cgivars"
    user=$(nameread user "$Tmp-cgivars" 2>/dev/null || true)
    password=$(nameread pw "$Tmp-cgivars" 2>/dev/null || true)

  elif [ "multipart/form-data" = "$TYPE" ]; then
    dd bs=1 count="${CONTENT_LENGTH:-0}" 2>/dev/null > "$Tmp-cgivars"
    user=$(mime-read user "$Tmp-cgivars" 2>/dev/null || true)
    password=$(mime-read pw "$Tmp-cgivars" 2>/dev/null || true)
  fi
fi

user="$(trim "$user")"
password="$(printf '%s' "$password" | tr -d '\r\n')"

[ -z "$user" ] && fail_json "LOGIN FAILED (missing user)"
[ -z "$password" ] && fail_json "LOGIN FAILED (missing password)"

ntrd_pw=$(openssl passwd -crypt -salt wuwei "$password" 2>/dev/null || true)
[ -z "$ntrd_pw" ] && fail_json "LOGIN FAILED (openssl error)"

# --- FIX HERE: user files live under /wu_wei2/user -------------------
user_dir=$(nameread user data/environment 2>/dev/null || true)
user_dir="$(trim "${user_dir#\"}")"; user_dir="$(trim "${user_dir%\"}")"
user_dir="${user_dir%/}/user"
# --------------------------------------------------------------------

[ -z "$user_dir" ] && fail_json "LOGIN FAILED (environment user dir empty)"
[ -r "$user_dir/member.name" ] || fail_json "LOGIN FAILED (missing member.name)"
[ -r "$user_dir/password" ]    || fail_json "LOGIN FAILED (missing password file)"

id=$(awk -v user="$user" '$2 == user {print $1; exit}' "$user_dir/member.name")
id="$(trim "$id")"
[ -z "$id" ] && fail_json "LOGIN FAILED (unknown user)"

strd_pw=$(awk -v id="$id" '$1 == id {print $2; exit}' "$user_dir/password")
strd_pw="$(trim "$strd_pw")"
[ -z "$strd_pw" ] && fail_json "LOGIN FAILED (no stored password)"

user_name=$(awk -v id="$id" '$1 == id {print $3; exit}' "$user_dir/member.name")
user_role=$(awk -v id="$id" '$1 == id {print $4; exit}' "$user_dir/member.name")

if [ "_${ntrd_pw}_" != "_${strd_pw}_" ]; then
  fail_json "LOGIN FAILED"
fi

cat <<-FOR_COOKIE > "$Tmp-forcookie"
wuwei_user_id $id
FOR_COOKIE

# mkcookie の出力から空行と CR を除去
cookie_headers=$(
  cat "$Tmp-forcookie" \
  | mkcookie -e +86400 -p /wu_wei2 -d .sambuichi.jp -s A -h Y \
  | tr -d '\r' \
  | sed '/^[[:space:]]*$/d'
)

printf "Content-Type: application/json\r\n"
# Set-Cookie を必ず「ヘッダ行」として出す（複数行もOK）
while IFS= read -r line; do
  printf "%s\r\n" "$line"
done <<< "$cookie_headers"
printf "Cache-Control: no-store\r\n\r\n"

printf '{"login":"%s","user_id":"%s","name":"%s","role":"%s"}\n' \
  "$(json_escape "$user")" \
  "$(json_escape "$id")" \
  "$(json_escape "$user_name")" \
  "$(json_escape "$user_role")"

rm -f "$Tmp" "$Tmp"-*
exit 0
