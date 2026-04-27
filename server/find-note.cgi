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
set -euvx
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
# escape space
VT=$( printf '\v' )
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
# === Login check ========================================================
user_info=$(is-login)
[ -n "$user_info" ] || error_exit 'NOT LOGGED IN'
# POST
dd bs=${CONTENT_LENGTH:-0} count=1 | cgi-name > $Tmp-cgivars
# user_id=$(nameread user_id $Tmp-cgivars | sed 's/^\"\(.*\)\"$/\1/')
user_id=$(echo "$user_info" | awk '{print $1}')
[[ "$user_id" == ERROR* ]] && error_exit "$user_info"
# cgivars=$(echo "$user_info" | awk '{print $3}')
# --------------------------------------------------------------------
note_dir=$(nameread note data/environment | sed 's/^\"\(.*\)\"$/\1/'  |
sed "s/^\(\/.*\)\/\*\/\(.*\)$/\1\/${user_id}\/\2/" )
[ -d $note_dir ] || error_exit 'ERROR NOTE DIR NOT DEFINED'
escaped_dir=$(echo $note_dir | sed 's/\//\\\//g')
# directories
# see https://stackoverflow.com/questions/1251999/how-can-i-replace-a-newline-n-using-sed
# dirs=$(find ${note_dir} -mindepth 2 -maxdepth 2 -type d | sort    |
# sed "s/^\/\(.*\)\/${user_id}\/note\/\(.*\)$/\2/"  |
# sed -e ':a' -e 'N' -e '$!ba' -e 's/\n/___/g')
# --------------------------------------------------------------------
# check if term is given
term=$(nameread term $Tmp-cgivars | sed 's/^\"\(.*\)\"$/\1/')
[ -n ${term} ] || error_exit 'ERROR EMPTY KEYWORD'
# --------------------------------------------------------------------
# find files contain term
find ${note_dir} -type f| xargs egrep -il "(${term})" |
xargs -I{} find ${note_dir} -wholename {} -printf "%f %h %T+ %s %p\n" > $Tmp-found
# --------------------------------------------------------------------
total=$(cat $Tmp-found | wc -l)
start=$(nameread start $cgivars | sed 's/^\"\(.*\)\"$/\1/')
start=${start:-1}
count=$(nameread count $cgivars | sed 's/^\"\(.*\)\"$/\1/')
count=${count:-12}
count_org=$count
diff=$((total - start + 1))
if (( diff \< count )); then
  count=$diff
else
  count=$count
fi
# --------------------------------------------------------------------
cat $Tmp-found |
sed "s/^\([^[:blank:]]*\)[[:blank:]]${escaped_dir}\/\([^[:blank:]]*\)[[:blank:]]\([^[:blank:]]*\)[[:blank:]]\(.*\)$/\3 \2\/\1 \2 \4/" |
sort -r | tee log/${0##*/}.$$.step0.log |
head -n$((start + count - 1)) | tail -n$count | sed "s/^[\/]*\(.*\)$/\1/" |
awk '{print $2 " " $3 " " $4 " " $1 " " $5}' | tee log/${0##*/}.$$.step1.log |
sort > $Tmp-file
# --------------------------------------------------------------------
grep -R -E -H -e ^user_id ${note_dir}/* | 
sed "s/^${escaped_dir}\/\(.*\):user_id \(.*\)$/\1 \2/" | tee log/${0##*/}.$$.step2.log |
sort > $Tmp-user_id
# --------------------------------------------------------------------
grep -R -E -H -e ^name ${note_dir}/*    |
sed "s/^${escaped_dir}\/\(.*\):name \(.*\)$/\1 \2/" | tee log/${0##*/}.$$.step3.log |
sort > $Tmp-note_name_init
cat $Tmp-note_name_init | sed "s/[[:space:]]/${VT}/2g" > $Tmp-note_name
# --------------------------------------------------------------------
grep -R -E -H -e ^description ${note_dir}/*            |
sed "s/^${escaped_dir}\/\(.*\):description\(.*\)$/\1\2/" | tee log/${0##*/}.$$.step4.log |
sort > $Tmp-description_init
cat $Tmp-description_init | sed "s/[[:space:]]/${VT}/2g" > $Tmp-description
# --------------------------------------------------------------------
grep -R -E -H -e ^thumbnail ${note_dir}/* | 
sed "s/^${escaped_dir}\/\(.*\):thumbnail \(.*\)$/\1 \2/" | tee log/${0##*/}.$$.step5.log |
sort > $Tmp-thumbnail
# --------------------------------------------------------------------
# join id is yyyy/mm/note_id or note_id
join $Tmp-file $Tmp-user_id     | tee log/${0##*/}.$$.step6.log |
join -         $Tmp-note_name   | tee log/${0##*/}.$$.step7.log |
join -         $Tmp-thumbnail   | tee log/${0##*/}.$$.step8.log |
join -         $Tmp-description | tee log/${0##*/}.$$.step9.log |
awk -v t="$total" -v s="$start" -v co="$count_org" -v c="$count" 'BEGIN{                                                          
  print "$.total",t;                                                  #
  print "$.start",s;                                                  #
  print "$.count_org",co;                                             #
  print "$.count",c;                                                  #
}                                                                     #
{n=NR-1;                                                              #
  print "$.note[" n "].id",$1;                                        #
  print "$.note[" n "].user_id",$6;                                   #
  print "$.note[" n "].note_name",$7;                                 #
  print "$.note[" n "].description",$9;                               #
  print "$.note[" n "].dir",$2;                                       #
  print "$.note[" n "].size",$3;                                      #
  print "$.note[" n "].timestamp",$4;                                 #
  print "$.note[" n "].file",$5;                                      #
  print "$.note[" n "].thumbnail",$8; }' | tee log/${0##*/}.$$.step10.log |
makrj.sh | sed "s/^\(\"[^\":,]*\":\),/\1null,/" | sed "s/${VT}/ /g" > $Tmp-notes
# --------------------------------------------------------------------
cat <<HTTP_RESPONSE
Content-Type: application/json

$(cat $Tmp-notes)
HTTP_RESPONSE
rm -f $Tmp-*
rm -f $cgivars
rm -f log/${0##*/}.$$.*
exit 0
# find-note.cgi

