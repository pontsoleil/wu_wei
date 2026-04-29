#!/bin/bash
# import-note.cgi
#
# Restore a portable WuWei note bundle and persist it.
#
# The actual persistence logic is shared with save-note.cgi. Keeping this
# endpoint separate makes the command flow explicit: normal note saves call
# save-note.cgi, while uploaded portable note files call import-note.cgi.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1

exec "$SCRIPT_DIR/save-note.cgi"
