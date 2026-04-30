#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Serve managed WuWei files through CGI instead of public data/ URLs.

Local Python CGI and the Linux shell CGI both stream the file after
validating the user, area, and relative path.
"""

from __future__ import annotations

import mimetypes
import sys
from pathlib import Path

from cgi_common import (
    environment_path,
    get_effective_user_id,
    get_session_user_id,
    merge_query_and_body_params,
    text_response,
    trim,
)

ALLOWED_AREAS = {"upload", "note", "resource", "thumbnail", "content"}


def reject(message: str, status: str = "400 Bad Request") -> None:
    text_response(message, status=status)


def safe_relative_path(value: str) -> str:
    path = trim(value).replace("\\", "/").strip("/")
    if not path or path.startswith("/") or "\x00" in path:
        return ""
    parts = [p for p in path.split("/") if p]
    if any(p in {".", ".."} for p in parts):
        return ""
    return "/".join(parts)


def main() -> None:
    params = merge_query_and_body_params()
    session_user_id = get_session_user_id()
    effective_user_id = get_effective_user_id()
    request_user_id = trim(params.get("user_id", ""))
    user_id = request_user_id or effective_user_id
    if not effective_user_id:
        reject("ERROR NOT LOGGED IN", "403 Forbidden")
    if request_user_id and request_user_id != effective_user_id:
        reject("ERROR USER MISMATCH", "403 Forbidden")

    area = trim(params.get("area", "")).lower()
    rel = safe_relative_path(params.get("path", ""))
    if area not in ALLOWED_AREAS or not rel:
        reject("ERROR INVALID FILE REQUEST")

    base_text = environment_path(area, user_id)
    if not base_text:
        reject("ERROR AREA NOT DEFINED", "404 Not Found")
    base = Path(base_text).resolve()
    target = (base / rel).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        reject("ERROR INVALID FILE PATH", "403 Forbidden")
    if not target.is_file():
        reject("ERROR FILE NOT FOUND", "404 Not Found")

    mime = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
    print(f"Content-Type: {mime}")
    print("Cache-Control: no-store")
    print()
    sys.stdout.flush()
    with target.open("rb") as f:
        while True:
            chunk = f.read(1024 * 256)
            if not chunk:
                break
            sys.stdout.buffer.write(chunk)
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    main()
