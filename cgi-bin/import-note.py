#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Import a plain note JSON or a portable ZIP note bundle."""

from __future__ import annotations

import base64
import cgi
import json
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from cgi_common import (
    debug_exception,
    emit_headers,
    environment_path,
    get_effective_user_id,
    script_error,
)


def _json_string(data: dict, *keys: str) -> str:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value:
            return value
    return ""


def _single_line(value: str) -> str:
    return " ".join((value or "").replace("\r", " ").replace("\n", " ").replace("\t", " ").split())


def _named_value(text: str, key: str) -> str:
    prefix = key + " "
    for line in text.splitlines():
        if line.startswith(prefix):
            return line[len(prefix):].strip()
    return ""


def _decode_note_payload(text: str) -> str:
    text = text.lstrip("\ufeff").strip()
    if text.startswith("{"):
        return text
    json_b64 = _named_value(text, "json_base64")
    if not json_b64:
        script_error("ERROR NOTE JSON NOT FOUND")
    try:
        return base64.b64decode(json_b64).decode("utf-8", errors="strict").strip()
    except Exception:
        debug_exception()
        script_error("ERROR NOTE JSON DECODE FAILED")


def _extract_zip(upload_bytes: bytes, extract_dir: Path) -> Path:
    extract_dir.mkdir(parents=True, exist_ok=True)
    zip_path = extract_dir / "bundle.zip"
    zip_path.write_bytes(upload_bytes)
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            name = info.filename.replace("\\", "/").lstrip("/")
            if not name or ".." in Path(name).parts:
                continue
            zf.extract(info, extract_dir)
    note_file = extract_dir / "note.txt"
    if not note_file.is_file():
        script_error("ERROR NOTE TEXT NOT FOUND")
    return note_file


def _restore_upload_dirs(extract_dir: Path, upload_root: Path) -> None:
    upload_dir = extract_dir / "upload"
    if not upload_dir.is_dir():
        return
    for src in upload_dir.glob("*/*/*/_*"):
        if not src.is_dir():
            continue
        rel = src.relative_to(upload_dir)
        if ".." in rel.parts:
            continue
        dst = upload_root / rel
        if dst.exists():
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, dst)


def _restore_resource_dirs(extract_dir: Path, resource_root: Path) -> None:
    resource_dir = extract_dir / "resource"
    if not resource_dir.is_dir():
        return
    for src in resource_dir.glob("*/*/*/_*"):
        if not src.is_dir():
            continue
        rel = src.relative_to(resource_dir)
        if ".." in rel.parts:
            continue
        dst = resource_root / rel
        if dst.exists():
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, dst)


def _save_note_meta(note_root: Path, user_id: str, note_json_text: str) -> None:
    note_json_text = _decode_note_payload(note_json_text)
    try:
        note_json = json.loads(note_json_text)
    except Exception:
        script_error("ERROR INVALID NOTE JSON")
    if not isinstance(note_json, dict):
        script_error("ERROR NOTE JSON MUST BE OBJECT")

    note_id = _json_string(note_json, "note_id", "note_uuid")
    if not note_id:
        script_error("ERROR NOTE ID NOT FOUND")
    if note_id != "new_note" and not note_id.startswith("_"):
        script_error("ERROR INVALID NOTE ID")

    now = datetime.now().astimezone()
    note_dir = note_root / now.strftime("%Y") / now.strftime("%m") / now.strftime("%d") / note_id
    note_dir.mkdir(parents=True, exist_ok=True)
    json_b64 = base64.b64encode(note_json_text.encode("utf-8")).decode("ascii")
    lines = [
        "format_version 2",
        f"id {note_id}",
        f"user_id {user_id}",
        f"name {_single_line(_json_string(note_json, 'note_name'))}",
        f"description {_single_line(_json_string(note_json, 'description'))}",
        "thumbnail ",
        f"saved_at {now.strftime('%Y-%m-%dT%H:%M:%S%z')}",
        "json_encoding base64",
        f"json_base64 {json_b64}",
    ]
    (note_dir / "note.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    form = cgi.FieldStorage()
    requested_user_id = (form.getfirst("user_id", "") or "").strip()
    session_user_id = get_effective_user_id()
    user_id = requested_user_id or session_user_id

    if not session_user_id or not user_id or user_id != session_user_id:
        script_error("ERROR NOT LOGGED IN")

    note_root_s = environment_path("note", user_id)
    upload_root_s = environment_path("upload", user_id)
    resource_root_s = environment_path("resource", user_id)
    if not note_root_s:
        script_error("ERROR NOTE DIRECTORY NOT DEFINED")
    if not upload_root_s:
        script_error("ERROR UPLOAD DIRECTORY NOT DEFINED")
    if not resource_root_s:
        script_error("ERROR RESOURCE DIRECTORY NOT DEFINED")

    if "file" not in form:
        script_error("ERROR FILE NOT SPECIFIED")
    fileitem = form["file"]
    upload_bytes = fileitem.file.read()
    filename = str(getattr(fileitem, "filename", "") or "").lower()
    content_type = str(getattr(fileitem, "type", "") or "").lower()

    with tempfile.TemporaryDirectory(prefix="wuwei-import-") as tmp:
        extract_dir = Path(tmp)
        if filename.endswith(".zip") or "zip" in content_type or upload_bytes[:4] == b"PK\x03\x04":
            note_file = _extract_zip(upload_bytes, extract_dir)
            _restore_upload_dirs(extract_dir, Path(upload_root_s))
            _restore_resource_dirs(extract_dir, Path(resource_root_s))
            note_json_text = note_file.read_text(encoding="utf-8", errors="strict")
        else:
            note_json_text = upload_bytes.decode("utf-8", errors="strict")

        _save_note_meta(Path(note_root_s), user_id, note_json_text)

    emit_headers("application/json; charset=UTF-8")
    sys.stdout.flush()
    sys.stdout.buffer.write(note_json_text.encode("utf-8"))
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        debug_exception()
        script_error("ERROR NOTE IMPORT FAILED")
