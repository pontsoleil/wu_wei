#!/bin/sh
# find-resource.cgi - compatibility alias for search-resource.cgi.
#
# Keep old callers working while the home screen moves to search-resource.cgi.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1
exec ./search-resource.cgi
