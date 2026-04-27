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
# datetime=$(date '+%Y-%m-%d %H:%M:%S')
exec 2>log/${0##*/}.$$.log

VALUE=${CONTENT_LENGTH:-0}
# Check if get/post
if [ ${VALUE} -eq 0 ]; then
# GET
  printf '%s' "${QUERY_STRING:-}" | tee log/${0##*/}.$$.step1.log |
  cgi-name                        > $Tmp-cgivars
  firstname=$(nameread firstname $Tmp-cgivars)
  lastname=$(nameread lastname $Tmp-cgivars)
  cat <<HTTP_RESPONSE
Content-Type: text/html

GET
---
$(cat $Tmp-cgivars)
---
First name: $firstname
Last name: $lastname
HTTP_RESPONSE
  exit 0
fi
#POST
dd bs=${CONTENT_LENGTH:-0} count=1 > $Tmp-cgivars_org
cat $Tmp-cgivars_org               | tee log/${0##*/}.$$.step2.log |
cgi-name                           > $Tmp-cgivars
firstname=$(nameread firstname $Tmp-cgivars)
if [ ! -z $firstname ] && [ -n $firstname ]; then
  lastname=$(nameread lastname $Tmp-cgivars)
  cat <<HTTP_RESPONSE
Content-Type: text/html

POST text
---
$(cat $Tmp-cgivars)
---
First name: $firstname
Last name: $lastname
HTTP_RESPONSE
  exit 0
fi
# POST multipart
cat $Tmp-cgivars_org > $Tmp-cgivars
firstname=$(mime-read firstname $Tmp-cgivars)
lastname=$(mime-read lastname $Tmp-cgivars)
sex=$(mime-read sex $Tmp-cgivars)
secret=$(mime-read secret $Tmp-cgivars)
vehicle=$(mime-read vehicle $Tmp-cgivars)
description=$(mime-read description $Tmp-cgivars)
#  photo=$(mime-read photo $Tmp-cgivars)
mime-read photo $Tmp-cgivars > $Tmp-photofile
if [ -s $Tmp-photofile ]; then
  filename=$(mime-read -v $Tmp-cgivars                                         | tee log/${0##*/}.$$.step1.log |
      grep -Ei '^[0-9]+[[:blank:]]*Content-Disposition:[[:blank:]]*form-data;' | tee log/${0##*/}.$$.step2.log |
      grep '[[:blank:]]name="photo"'                                           | tee log/${0##*/}.$$.step3.log |
      head -n 1                                                                | tee log/${0##*/}.$$.step4.log |
      sed 's/.*[[:blank:]]filename="\([^"]*\)".*/\1/'                          | tee log/${0##*/}.$$.step5.log |
      tr '/"' '--'                                                             )
  cp $Tmp-photofile $filename
  contenttype=$(mime-read -v $Tmp-cgivars                                    | tee log/${0##*/}.$$.step6.log |
    grep -Ei '^[0-9]+[[:blank:]]*Content-Type:'                              | tee log/${0##*/}.$$.step7.log |
    head -n 1                                                                | tee log/${0##*/}.$$.step8.log |
    sed 's/.*[[:blank:]]*Content-Type:[[:blank:]]*\([[:blank:]]*\)/\1/'      | tee log/${0##*/}.$$.step9.log |
    tr '/"' '--'                                                             )

  cat <<HTTP_RESPONSE
Content-Type: text/html

POST multipart
<p>
First name: $firstname<br>
Last name: $lastname<br>
Gender: $sex<br>
Password: $secret<br>
Vehicle: $vehicle<br>
Description: $description<br>
</p>
Photo: $filename ($contenttype)<br>
<img src="$filename" alt="$filename">
HTTP_RESPONSE
  exit 0
else
  cat <<HTTP_RESPONSE
Content-Type: text/html

POST multipart
---
$(mime-read -v $Tmp-cgivars)
---
<p>
First name: $firstname<br>
Last name: $lastname<br>
Gender: $sex<br>
Password: $secret<br>
Vehicle: $vehicle<br>
Description: $description<br>
</p>
HTTP_RESPONSE
  rm -f $Tmp-*
  rm -f log/${0##*/}.$$.*
  exit 0
fi
