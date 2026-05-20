#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Import a WuWei note export package with managed upload files."""

from __future__ import annotations

import cgi
import hashlib
import json
import shutil
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from cgi_common import (
    debug_exception,
    emit_headers,
    environment_path,
    get_effective_user_id,
    script_error,
)


NOTE_EXPORT_FORMAT = "wuwei-note-export"
ALLOWED_ROOTS = {"export-manifest.json", "note", "resources"}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_member_name(name: str) -> str:
    name = str(name or "").replace("\\", "/").lstrip("/")
    parts = [p for p in name.split("/") if p]
    if not parts or any(p in {"..", "."} for p in parts):
        return ""
    if parts[0] not in ALLOWED_ROOTS:
        return ""
    return "/".join(parts)


def public_work_root() -> Path:
    base = environment_path("base")
    if base:
        root = Path(base)
        if root.name.lower() == "data":
            return root / "public"
        return root / "data" / "public"
    return Path(environment_path("note")).parent.parent / "public"


def extract_package(upload_bytes: bytes) -> Path:
    now = datetime.now().astimezone()
    package_uuid = str(uuid.uuid4())
    extract_dir = public_work_root() / now.strftime("%Y") / now.strftime("%m") / now.strftime("%d") / package_uuid
    extract_dir.mkdir(parents=True, exist_ok=True)
    zip_path = extract_dir / "package.zip"
    zip_path.write_bytes(upload_bytes)
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            name = safe_member_name(info.filename)
            if not name or info.is_dir():
                continue
            mode = (info.external_attr >> 16) & 0o170000
            if mode == 0o120000:
                script_error("ERROR ZIP CONTAINS SYMBOLIC LINK")
            target = (extract_dir / name).resolve()
            try:
                target.relative_to(extract_dir.resolve())
            except ValueError:
                script_error("ERROR INVALID ZIP PATH")
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, target.open("wb") as dst:
                shutil.copyfileobj(src, dst)
    return extract_dir


def load_manifest(extract_dir: Path) -> dict:
    path = extract_dir / "export-manifest.json"
    if not path.is_file():
        script_error("ERROR EXPORT MANIFEST NOT FOUND")
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        script_error("ERROR INVALID EXPORT MANIFEST")
    if not isinstance(manifest, dict) or manifest.get("format") != NOTE_EXPORT_FORMAT:
        script_error("ERROR INVALID EXPORT MANIFEST")
    if not isinstance(manifest.get("note"), dict):
        script_error("ERROR EXPORT NOTE MANIFEST NOT FOUND")
    return manifest


def clean_rel_path(value: str) -> str:
    text = str(value or "").replace("\\", "/").strip("/")
    parts = [p for p in text.split("/") if p]
    if not parts or any(p in {"..", "."} for p in parts):
        return ""
    return "/".join(parts)


def load_note_json(extract_dir: Path, manifest: dict) -> tuple[str, dict]:
    note_key = clean_rel_path(str((manifest.get("note") or {}).get("note_key") or ""))
    if not note_key:
        script_error("ERROR NOTE KEY NOT FOUND")
    note_file = extract_dir / "note" / note_key
    if not note_file.is_file():
        script_error("ERROR NOTE JSON NOT FOUND")
    text = note_file.read_text(encoding="utf-8").lstrip("\ufeff").strip()
    try:
        note = json.loads(text)
    except Exception:
        script_error("ERROR INVALID NOTE JSON")
    if not isinstance(note, dict):
        script_error("ERROR NOTE JSON MUST BE OBJECT")
    return note_key, note


def iter_dicts(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from iter_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_dicts(child)


def update_audit(value, user_id: str, timestamp: str) -> None:
    for obj in iter_dicts(value):
        audit = obj.get("audit") if isinstance(obj.get("audit"), dict) else None
        if audit is not None:
            audit["lastModifiedBy"] = user_id
            audit["lastModifiedAt"] = timestamp


def server_root_dir(user_id: str, logical_path: str) -> str:
    base = "/".join(clean_rel_path(logical_path).split("/")[:-1])
    return f"data/{user_id}/upload/{base}"


def manifest_file_map(manifest: dict) -> dict[str, dict[str, dict]]:
    out: dict[str, dict[str, dict]] = {}
    for resource in manifest.get("resources") or []:
        if not isinstance(resource, dict):
            continue
        rid = str(resource.get("resourceId") or resource.get("file_uuid") or "")
        file_uuid = str(resource.get("file_uuid") or "")
        if not rid:
            continue
        files_by_role: dict[str, dict] = {}
        for file_def in resource.get("files") or []:
            if isinstance(file_def, dict) and file_def.get("role"):
                files_by_role[str(file_def.get("role")).lower()] = file_def
        out[rid] = files_by_role
        if file_uuid and file_uuid != rid:
            out[file_uuid] = files_by_role
        if rid.startswith("_"):
            out[rid.lstrip("_")] = files_by_role
    return out


def update_resource_storage_dirs(note: dict, user_id: str, manifest: dict | None = None) -> None:
    by_resource = manifest_file_map(manifest or {})
    for obj in iter_dicts(note):
        resource = obj.get("resource") if isinstance(obj.get("resource"), dict) else obj
        if not isinstance(resource, dict):
            continue
        resource_id = str(resource.get("id") or "")
        resource_manifest = by_resource.get(resource_id) or by_resource.get(resource_id.lstrip("_")) or {}
        storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else None
        if not storage:
            continue
        manifest = storage.get("manifest") if isinstance(storage.get("manifest"), dict) else None
        if manifest and manifest.get("path"):
            manifest_record = resource_manifest.get("manifest")
            logical = clean_rel_path(str((manifest_record or {}).get("logicalPath") or manifest.get("path") or ""))
            if logical:
                manifest["path"] = logical
                manifest["dir_name"] = server_root_dir(user_id, logical)
                manifest["file_name"] = logical.rsplit("/", 1)[-1]
                manifest["area"] = "upload"
                if manifest_record and manifest_record.get("mimeType"):
                    manifest["mimeType"] = manifest_record.get("mimeType")
        files = storage.get("files") if isinstance(storage.get("files"), list) else []
        for file_def in files:
            if not isinstance(file_def, dict):
                continue
            role = str(file_def.get("role") or "").lower()
            manifest_record = resource_manifest.get(role)
            logical = clean_rel_path(str((manifest_record or {}).get("logicalPath") or file_def.get("path") or ""))
            if not logical:
                continue
            file_def["path"] = logical
            file_def["dir_name"] = server_root_dir(user_id, logical)
            file_def["file_name"] = logical.rsplit("/", 1)[-1]
            file_def["area"] = "upload"
            if manifest_record and manifest_record.get("mimeType"):
                file_def["mimeType"] = manifest_record.get("mimeType")
            if role == "original" and manifest_record and manifest_record.get("derivedFrom"):
                resource["kind"] = "document"
                resource["documentKind"] = "pdf"
                resource["mimeType"] = "application/pdf"
                resource["uri"] = logical
                resource["canonicalUri"] = logical
                derived = manifest_record.get("derivedFrom") or {}
                resource["export"] = {
                    "originalReplacedByPdf": True,
                    "originalFileName": derived.get("fileName") or "",
                    "originalMimeType": derived.get("mimeType") or "",
                }


def note_target(note_root: Path, note_key: str) -> Path:
    target = (note_root / note_key).resolve()
    try:
        target.relative_to(note_root.resolve())
    except ValueError:
        script_error("ERROR INVALID NOTE KEY")
    if target.name != "note.json":
        script_error("ERROR INVALID NOTE KEY")
    return target


def strip_import_audit_fields(value):
    if isinstance(value, dict):
        out = {}
        for key, child in value.items():
            if key in {"lastModifiedBy", "lastModifiedAt", "dir_name", "file_name"}:
                continue
            out[key] = strip_import_audit_fields(child)
        return out
    if isinstance(value, list):
        return [strip_import_audit_fields(child) for child in value]
    return value


def same_json(path: Path, note: dict) -> bool:
    try:
        existing = json.loads(path.read_text(encoding="utf-8").lstrip("\ufeff"))
    except Exception:
        return False
    return strip_import_audit_fields(existing) == strip_import_audit_fields(note)


def copy_resource_files(extract_dir: Path, manifest: dict, upload_root: Path) -> None:
    for resource in manifest.get("resources") or []:
        if not isinstance(resource, dict):
            continue
        for file_def in resource.get("files") or []:
            if not isinstance(file_def, dict):
                continue
            arc = clean_rel_path(str(file_def.get("path") or ""))
            logical = clean_rel_path(str(file_def.get("logicalPath") or ""))
            if not arc.startswith("resources/") or not logical:
                script_error("ERROR INVALID RESOURCE FILE MANIFEST")
            src = (extract_dir / arc).resolve()
            try:
                src.relative_to(extract_dir.resolve())
            except ValueError:
                script_error("ERROR INVALID RESOURCE FILE PATH")
            if not src.is_file():
                script_error("ERROR RESOURCE FILE NOT FOUND")
            expected_sha = str(file_def.get("sha256") or "")
            if expected_sha and sha256_file(src) != expected_sha:
                script_error("ERROR RESOURCE FILE SHA256 MISMATCH")
            dst = (upload_root / logical).resolve()
            try:
                dst.relative_to(upload_root.resolve())
            except ValueError:
                script_error("ERROR INVALID UPLOAD PATH")
            if dst.is_file() and sha256_file(dst) != sha256_file(src):
                script_error("ERROR UPLOAD FILE CONFLICT")
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)


def write_path_indexes(manifest: dict, upload_root: Path) -> None:
    for resource in manifest.get("resources") or []:
        if not isinstance(resource, dict):
            continue
        logical_base = clean_rel_path(str(resource.get("logicalBase") or ""))
        parts = logical_base.split("/")
        if len(parts) < 4:
            continue
        actual_date = "/".join(parts[:3])
        upload_id = parts[3]
        manifest_path = f"{logical_base}/manifest.json"
        for file_def in resource.get("files") or []:
            logical = clean_rel_path(str(file_def.get("logicalPath") or ""))
            if not logical:
                continue
            index_file = upload_root / "_index" / "path" / (logical + ".json")
            index_file.parent.mkdir(parents=True, exist_ok=True)
            index_file.write_text(json.dumps({
                "logicalPath": logical,
                "upload_id": upload_id,
                "actual_date": actual_date,
                "date": actual_date,
                "file": logical.rsplit("/", 1)[-1],
                "manifest": manifest_path,
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    form = cgi.FieldStorage()
    session_user_id = get_effective_user_id()
    requested_user_id = (form.getfirst("user_id", "") or "").strip()
    user_id = requested_user_id or session_user_id
    if not session_user_id or not user_id or user_id != session_user_id:
        script_error("ERROR NOT LOGGED IN")

    note_root_s = environment_path("note", user_id)
    upload_root_s = environment_path("upload", user_id)
    if not note_root_s:
        script_error("ERROR NOTE DIRECTORY NOT DEFINED")
    if not upload_root_s:
        script_error("ERROR UPLOAD DIRECTORY NOT DEFINED")
    if "file" not in form:
        script_error("ERROR FILE NOT SPECIFIED")
    fileitem = form["file"]
    upload_bytes = fileitem.file.read()
    filename = str(getattr(fileitem, "filename", "") or "").lower()
    content_type = str(getattr(fileitem, "type", "") or "").lower()
    if not (filename.endswith(".zip") or "zip" in content_type or upload_bytes[:4] == b"PK\x03\x04"):
        script_error("ERROR IMPORT NOTE REQUIRES EXPORT ZIP")

    extract_dir = extract_package(upload_bytes)
    manifest = load_manifest(extract_dir)
    note_key, note = load_note_json(extract_dir, manifest)
    imported_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    upload_root = Path(upload_root_s)
    copy_resource_files(extract_dir, manifest, upload_root)
    write_path_indexes(manifest, upload_root)
    update_resource_storage_dirs(note, user_id, manifest)
    update_audit(note, user_id, imported_at)

    note_root = Path(note_root_s)
    target = note_target(note_root, note_key)
    if target.is_file() and not same_json(target, note):
        script_error("ERROR NOTE ID / NOTE KEY CONFLICT")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(note, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")

    emit_headers("application/json; charset=UTF-8")
    sys.stdout.flush()
    sys.stdout.buffer.write(json.dumps(note, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        debug_exception()
        script_error("ERROR NOTE IMPORT FAILED")
