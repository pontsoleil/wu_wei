#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Export a WuWei note and its managed upload files as a portable ZIP."""

from __future__ import annotations

import hashlib
import io
import json
import mimetypes
import re
import sys
import uuid
import zipfile
from datetime import datetime, timezone
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


ALLOWED_ROLES = {"original", "preview", "thumbnail", "pdf-preview", "manifest"}
V2_LOGICAL_RE = re.compile(r"^\d{4}/\d{2}/\d{2}/[^/]+/.+$")


def safe_zip_name(value: str) -> str:
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in value) or "wuwei-note-export.zip"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def server_root_relative(path: Path) -> str:
    try:
        root = Path(environment_path("base")).resolve()
        return path.resolve().relative_to(root).as_posix()
    except Exception:
        pass
    text = path.resolve().as_posix()
    marker = "/htdocs/"
    idx = text.lower().find(marker)
    if idx >= 0:
        return text[idx + len(marker):]
    return text


def clean_logical_path(value: str) -> str:
    text = str(value or "").replace("\\", "/").strip("/")
    if not text or ".." in Path(text).parts:
        return ""
    if re.match(r"^[a-z]+://", text, re.I):
        return ""
    marker = "/wu_wei2/"
    if marker in text:
        text = text.split(marker, 1)[1].lstrip("/")
    if text.startswith("data/"):
        parts = text.split("/")
        if len(parts) >= 4:
            text = "/".join(parts[3:])
    m = re.match(r"^(upload|resource|note|thumbnail|content)/(.+)$", text, re.I)
    if m:
        text = m.group(2)
    return text if V2_LOGICAL_RE.match(text) else ""


def iter_dicts(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from iter_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_dicts(child)


def collect_upload_resources(note: dict) -> list[dict]:
    seen = set()
    out = []
    for obj in iter_dicts(note):
        resource = obj.get("resource") if isinstance(obj.get("resource"), dict) else obj
        if not isinstance(resource, dict):
            continue
        if str(resource.get("source") or "").lower() != "upload":
            continue
        storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
        files = storage.get("files") if isinstance(storage.get("files"), list) else []
        if not files:
            continue
        key = str(resource.get("id") or resource.get("canonicalUri") or resource.get("uri") or id(resource))
        if key in seen:
            continue
        seen.add(key)
        out.append(resource)
    return out


def resolve_upload_file(upload_root: Path, file_def: dict) -> tuple[str, Path] | None:
    logical = clean_logical_path(str(file_def.get("path") or ""))
    if not logical:
        return None
    candidates = [upload_root / logical]
    dir_name = str(file_def.get("dir_name") or "").replace("\\", "/").strip("/")
    file_name = str(file_def.get("file_name") or logical.rsplit("/", 1)[-1])
    if dir_name and file_name:
        candidates.append(Path(environment_path("base")).parent / dir_name / file_name)
        candidates.append(Path(environment_path("base")) / dir_name / file_name)
    for candidate in candidates:
        if candidate.is_file():
            return logical, candidate
    return None


def add_resource_files(zf: zipfile.ZipFile, upload_root: Path, resource: dict) -> dict | None:
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    files = [f for f in (storage.get("files") or []) if isinstance(f, dict)]
    manifest = storage.get("manifest") if isinstance(storage.get("manifest"), dict) else {}
    if manifest:
        manifest_file = dict(manifest)
        manifest_file.setdefault("role", "manifest")
        files.append(manifest_file)

    manifest_files = []
    logical_base = ""
    file_uuid = ""
    for file_def in files:
        role = str(file_def.get("role") or ("manifest" if file_def is manifest else "")).lower()
        if role not in ALLOWED_ROLES:
            continue
        resolved = resolve_upload_file(upload_root, file_def)
        if not resolved:
            continue
        logical, src = resolved
        parts = logical.split("/")
        base = "/".join(parts[:4])
        logical_base = logical_base or base
        file_uuid = file_uuid or parts[3].lstrip("_")
        arc_path = "resources/" + logical
        zf.write(src, arc_path)
        manifest_files.append({
            "role": role,
            "path": arc_path,
            "logicalPath": logical,
            "fileName": src.name,
            "mimeType": str(file_def.get("mimeType") or mimetypes.guess_type(src.name)[0] or "application/octet-stream"),
            "size": src.stat().st_size,
            "sha256": sha256_file(src),
        })

    if not manifest_files:
        return None
    return {
        "resourceId": str(resource.get("id") or ""),
        "file_uuid": file_uuid,
        "source": "upload",
        "kind": str(resource.get("kind") or (resource.get("media") or {}).get("kind") or ""),
        "documentKind": str(resource.get("documentKind") or ""),
        "logicalBase": logical_base,
        "files": manifest_files,
    }


def main() -> None:
    params = merge_query_and_body_params()
    session_user_id = get_effective_user_id()
    user_id = (params.get("user_id") or session_user_id or "").strip()
    note_id = (params.get("id") or params.get("note_key") or "").strip()

    if not note_id:
        script_error("ERROR ID NOT SPECIFIED")
    if not session_user_id or not user_id or user_id != session_user_id:
        script_error("ERROR NOT LOGGED IN")

    note_root_s = environment_path("note", user_id)
    upload_root_s = environment_path("upload", user_id)
    if not note_root_s:
        script_error("ERROR NOTE DIRECTORY NOT FOUND")
    if not upload_root_s:
        script_error("ERROR UPLOAD DIRECTORY NOT FOUND")

    note_root = Path(note_root_s)
    note_file = resolve_note_file(note_root, note_id)
    if not note_file.is_file():
        script_error("ERROR NOTE FILE NOT FOUND")

    try:
        note_json_text = decode_note_json(read_note_meta(note_file))
        note = json.loads(note_json_text)
    except Exception:
        debug_exception()
        script_error("ERROR NOTE JSON NOT FOUND")
    if not isinstance(note, dict):
        script_error("ERROR NOTE JSON MUST BE OBJECT")

    note_key = note_file.relative_to(note_root).as_posix()
    note_uuid = str(note.get("note_uuid") or note.get("note_id") or note_file.parent.name)
    exported_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    package_uuid = str(uuid.uuid4())

    payload = io.BytesIO()
    manifest = {
        "format": "wuwei-note-export",
        "version": "1.0",
        "exportedAt": exported_at,
        "package_uuid": package_uuid,
        "note": {
            "note_uuid": note_uuid,
            "note_key": note_key,
            "name": str(note.get("note_name") or ""),
        },
        "resources": [],
    }

    with zipfile.ZipFile(payload, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("note/" + note_key, json.dumps(note, ensure_ascii=False, separators=(",", ":")) + "\n")
        upload_root = Path(upload_root_s)
        for resource in collect_upload_resources(note):
            item = add_resource_files(zf, upload_root, resource)
            if item:
                manifest["resources"].append(item)
        zf.writestr("export-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    body = payload.getvalue()
    filename = safe_zip_name(f"wuwei-note-{note_uuid}.zip")
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
