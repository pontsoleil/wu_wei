#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Restore a portable WuWei note bundle and persist it.

This endpoint intentionally delegates to save-note.py so that imported notes are
stored with exactly the same validation and file layout as normal note saves.
The separate CGI name keeps the client-side command responsibility clear:
save-note is for ordinary saves, import-note is for uploaded note bundles.
"""

from pathlib import Path
import runpy


if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("save-note.py")), run_name="__main__")
