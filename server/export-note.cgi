#!/bin/sh
# export-note.cgi - delegate to the canonical Python implementation.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
PYTHON=${WUWEI_PYTHON:-python3}
exec "$PYTHON" "$SCRIPT_DIR/../cgi-bin/export-note.py"
