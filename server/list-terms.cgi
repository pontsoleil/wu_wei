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
type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export LANG=ja_JP.UTF-8
export LC_ALL=ja_JP.utf8
# export LC_ALL=C
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003  # to make HP-UX conform to POSIX
# === Log ============================================================
exec 2>log/${0##*/}.$$.log
Tmp=/tmp/${0##*/}.$$
datetime=$(date '+%Y-%m-%d_%H:%M:%S')
# Elapsed time
# note: some os does not support sub-second precision and will just append literal “N” to the timestamp
# see https://unix.stackexchange.com/questions/52313/how-to-get-execution-time-of-a-script-effectively
# ts1=$(date +%s.%N)
# === get parameters =================================================
METHOD=${REQUEST_METHOD:-''}
TYPE=$(echo ${CONTENT_TYPE:-'undefined'} | sed 's/;.*//')
echo ${METHOD} ${TYPE} >&2
if [ 'GET' = "$METHOD" ]; then
  #GET
  printf '%s' "${QUERY_STRING:-''}" | cgi-name > $Tmp-cgivars
elif [ 'POST' = "$METHOD" ]; then
  # POST
  dd bs=${CONTENT_LENGTH:-0} count=1 | cgi-name > $Tmp-cgivars
fi
# === Login check ========================================================
session_user_id=$(is-login)
user_id=$(nameread user_id $Tmp-cgivars | sed 's/^\"\(.*\)\"$/\1/')
if [ -z ${session_user_id} ] ||
   [ -z ${user_id} ] ||
   [ ${user_id} != ${session_user_id} ] ; then
  cat <<HTTP_RESPONSE
Content-Type: text/plain

ERROR NOT LOGGED IN
HTTP_RESPONSE
  exit 1
else
  :
fi

# terms
s3object_dir=$(nameread s3object data/environment)
if [ ! -d ${s3object_dir} ]; then
  exit 1
fi

cat /dev/null>$Tmp-terms

echo "{" > $Tmp-terms

echo "  \"faculty\":[" > $Tmp-term-faculty
cat ${s3object_dir}/faculty.csv |
awk -F'[,]' '{ printf "{\"year\":\"%s\",\"role\":\"%s\",\"num\":\"%s\",\"name\":\"%s\",\"subject\":\"%s\"},\n",$1,$2,$3,$4,$5}' >> $Tmp-term-faculty
# https://stackoverflow.com/questions/1251999/how-can-i-replace-a-newline-n-using-sed
cat $Tmp-term-faculty | sed ':a;N;$!ba;s/\n/ /g' | sed 's/,$//' >> $Tmp-terms
echo "  ]," >> $Tmp-terms

echo "  \"student\":[" > $Tmp-term-student
cat ${s3object_dir}/student.csv |
awk -F'[,]' '{ printf "{\"year\":\"%s\",\"class\":\"%s\",\"num\":\"%s\",\"name\":\"%s\",\"cource\":\"%s\"},\n",$1,$2,$3,$4,$5}' >> $Tmp-term-student
cat $Tmp-term-student | sed ':a;N;$!ba;s/\n/ /g' | sed 's/,$//' >> $Tmp-terms
echo "  ]," >> $Tmp-terms

echo "  \"term\":[" > $Tmp-term-term
cat ${s3object_dir}/subject.txt |
awk -F'[,]' '{ printf "\"%s\",\n",$1}' >> $Tmp-term-term
cat $Tmp-term-term | sed ':a;N;$!ba;s/\n/ /g' | sed 's/,$//' >> $Tmp-terms
echo "  ]" >> $Tmp-terms
echo "}" >> $Tmp-terms

# timestamp 2
# ts2=$(date +%s.%N);        dt=$(echo "$ts2-$ts1"|bc)
# dd=$(echo "$dt/86400"|bc); dt2=$(echo "$dt-86400*$dd"|bc)
# dh=$(echo "$dt2/3600"|bc); dt3=$(echo "$dt2-3600*$dh"|bc)
# dm=$(echo "$dt3/60"|bc);   ds=$(echo "$dt3-60*$dm"|bc)
# printf "Total runtime: %d:%02d:%02d:%02.4f\n" $dd $dh $dm $ds >> log/${0##*/}.$$.etime.log

cat <<HTTP_RESPONSE
Content-Type: application/json

$(cat $Tmp-terms)
HTTP_RESPONSE
rm -f $Tmp-*
rm -f log/${0##*/}.$$.*
exit 0
# list-terms.cgi
