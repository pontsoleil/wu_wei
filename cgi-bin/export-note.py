#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Build a portable WuWei note ZIP on demand.

The ZIP layout mirrors server/export-note.cgi:
  note.json
  upload/YYYY/MM/DD/{upload_uuid}/...
"""

from __future__ import annotations

import io
import re
import sys
import zipfile
from pathlib import Path

from cgi_common import (
    debug_exception,
    decode_note_json,
    environment_path,
    get_effective_user_id,
    merge_query_and_body_params,
    read_note_meta,
    resolve_note_file,
    script_error,
)


UPLOAD_REF_RE = re.compile(r"[0-9]{4}/[0-9]{2}/[0-9]{2}/_[0-9A-Fa-f-]+")


def _safe_zip_name(value: str) -> str:
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in value) or "note.zip"


def _add_directory(zf: zipfile.ZipFile, root: Path, arc_root: str) -> None:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        zf.write(path, f"{arc_root.rstrip('/')}/{rel}")


def main() -> None:
    params = merge_query_and_body_params()
    session_user_id = get_effective_user_id()
    user_id = (params.get("user_id") or session_user_id or "").strip()
    note_id = (params.get("id") or "").strip()

    if not note_id:
        script_error("ERROR ID NOT SPECIFIED")
    if not session_user_id or not user_id or user_id != session_user_id:
        script_error("ERROR NOT LOGGED IN")

    note_root_s = environment_path("note", user_id)
    upload_root_s = environment_path("upload", user_id)
    if not note_root_s or not Path(note_root_s).exists():
        script_error("ERROR NOTE DIRECTORY NOT FOUND")
    if not upload_root_s or not Path(upload_root_s).exists():
        script_error("ERROR UPLOAD DIRECTORY NOT FOUND")

    note_file = resolve_note_file(Path(note_root_s), note_id)
    if not note_file.is_file():
        script_error("ERROR NOTE FILE NOT FOUND")

    try:
        note_json = decode_note_json(read_note_meta(note_file))
    except Exception:
        debug_exception()
        script_error("ERROR NOTE JSON NOT FOUND")

    upload_root = Path(upload_root_s)
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("note.json", note_json)
        for rel in sorted(set(UPLOAD_REF_RE.findall(note_json))):
            if ".." in rel or rel.startswith("/"):
                continue
            src = upload_root / rel
            if src.is_dir():
                _add_directory(zf, src, f"upload/{rel}")

    body = payload.getvalue()
    filename = _safe_zip_name(f"{note_id}.zip")
    print("Content-Type: application/zip")
    print("Cache-Control: no-store")
    print(f'Content-Disposition: attachment; filename="{filename}"')
    print(f"Content-Length: {len(body)}")
    print()
    sys.stdout.flush()
    sys.stdout.buffer.write(body)
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        debug_exception()
        script_error("ERROR NOTE EXPORT FAILED")
