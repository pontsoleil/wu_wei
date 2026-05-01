#!/bin/sh
# search-resource.cgi - Resource library search entry point.
#
# Select resources by date range, month/date, keyword, or their combination.
# list-resource.cgi owns the shell implementation; this endpoint is the
# canonical search name used by the home screen.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1
exec ./list-resource.cgi
