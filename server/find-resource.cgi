#!/bin/sh
# find-resource.cgi - shell Resource search entry point.
#
# list-resource.cgi accepts the same CGI parameters plus "term"; keep the
# implementation in one place so server-side Resource listing/search stay aligned.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1
exec ./list-resource.cgi
