#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Export a WuWei note and its managed upload files as a portable ZIP."""

from __future__ import annotations

import hashlib
import io
import json
import mimetypes
import re
import shutil
import subprocess
import sys
import tempfile
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
LEGACY_LOGICAL_RE = re.compile(r"^\d{4}/\d{2}/[^/]+$")
ALLOWED_AREAS = {"upload", "content", "thumbnail", "resource", "note"}
OFFICE_EXTS = {".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp"}


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


def clean_logical_path(value: str, allow_legacy: bool = True) -> str:
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
    if V2_LOGICAL_RE.match(text):
        return text
    if allow_legacy and LEGACY_LOGICAL_RE.match(text):
        return text
    return ""


def logical_base_of(logical: str) -> str:
    """Return the bundle base without changing the logical path.

    v2 upload paths use YYYY/MM/DD/file_uuid/filename, so the base is the
    first four segments.  v0 legacy content paths use YYYY/MM/filename, so
    the base is only YYYY/MM.  Do not complement legacy paths to
    YYYY/MM/01/....
    """
    parts = clean_logical_path(logical).split("/")
    if len(parts) >= 5 and re.match(r"^\d{4}$", parts[0]) and re.match(r"^\d{2}$", parts[1]) and re.match(r"^\d{2}$", parts[2]):
        return "/".join(parts[:4])
    if len(parts) >= 3 and re.match(r"^\d{4}$", parts[0]) and re.match(r"^\d{2}$", parts[1]):
        return "/".join(parts[:2])
    return "/".join(parts[:-1])


def with_pdf_suffix(logical: str) -> str:
    base, _, name = logical.rpartition("/")
    stem = Path(name).stem or "original"
    return f"{base}/{stem}.pdf"


def is_office_file(path_or_name: str) -> bool:
    return Path(str(path_or_name or "").split("?", 1)[0]).suffix.lower() in OFFICE_EXTS


def inferred_legacy_source_path(logical: str) -> str:
    """Compatibility-only fallback for notes saved by an older migrator.

    New export logic does not normalise YYYY/MM/filename to YYYY/MM/01/....
    This function is used only to recover already-saved broken paths when the
    original legacy source path is otherwise unavailable.
    """
    logical = clean_logical_path(logical, allow_legacy=False)
    parts = logical.split("/")
    if len(parts) >= 5 and parts[2] == "01":
        return "/".join([parts[0], parts[1], "/".join(parts[4:])])
    return ""


def file_role(file_def: dict, default: str = "") -> str:
    return str(file_def.get("role") or default or "").lower()


def resource_files(resource: dict) -> list[dict]:
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    files = [f for f in (storage.get("files") or []) if isinstance(f, dict)]
    manifest = storage.get("manifest") if isinstance(storage.get("manifest"), dict) else {}
    if manifest:
        manifest_file = dict(manifest)
        manifest_file.setdefault("role", "manifest")
        files.append(manifest_file)
    return files


def find_file_by_role(files: list[dict], *roles: str) -> dict | None:
    wanted = {r.lower() for r in roles}
    for file_def in files:
        if file_role(file_def) in wanted:
            return file_def
    return None


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
        storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
        files = storage.get("files") if isinstance(storage.get("files"), list) else []
        source = str(resource.get("source") or "").lower()
        kind = str(resource.get("kind") or "").lower()
        has_local_file = any(
            str(file_def.get("sourceArea") or file_def.get("area") or "").lower() in ALLOWED_AREAS
            and clean_logical_path(str(file_def.get("path") or ""), allow_legacy=True)
            for file_def in files
            if isinstance(file_def, dict)
        )
        if source != "upload" and kind != "upload" and not storage.get("managed") and not has_local_file:
            continue
        if not files and not isinstance(storage.get("manifest"), dict):
            continue
        key = str(resource.get("id") or resource.get("canonicalUri") or resource.get("uri") or id(resource))
        if key in seen:
            continue
        seen.add(key)
        out.append(resource)
    return out


def area_root(area: str, user_id: str, upload_root: Path) -> Path:
    area = str(area or "upload").lower()
    if area not in ALLOWED_AREAS:
        area = "upload"
    root = environment_path(area, user_id)
    if root:
        return Path(root)
    return upload_root.parent / area


def resolve_resource_file(upload_root: Path, user_id: str, file_def: dict) -> tuple[str, Path] | None:
    logical = clean_logical_path(str(file_def.get("path") or file_def.get("logicalPath") or ""))
    if not logical:
        return None
    area = str(file_def.get("area") or "upload").lower()
    root = area_root(area, user_id, upload_root)
    candidates = [root / logical]
    if root != upload_root:
        candidates.append(upload_root / logical)
    source_logical = clean_logical_path(
        str(file_def.get("sourcePath") or inferred_legacy_source_path(logical) or ""),
        allow_legacy=True,
    )
    source_area = str(file_def.get("sourceArea") or "").lower()
    if source_logical and source_area:
        source_root = area_root(source_area, user_id, upload_root)
        candidates.append(source_root / source_logical)
    dir_name = str(file_def.get("dir_name") or "").replace("\\", "/").strip("/")
    file_name = str(file_def.get("file_name") or logical.rsplit("/", 1)[-1])
    if dir_name and file_name:
        candidates.append(Path(environment_path("base")).parent / dir_name / file_name)
        candidates.append(Path(environment_path("base")) / dir_name / file_name)
    for candidate in candidates:
        if candidate.is_file():
            return logical, candidate
    return None


def zip_file_record(
    zf: zipfile.ZipFile,
    src: Path,
    role: str,
    logical: str,
    file_def: dict,
    derived_from: dict | None = None,
) -> dict:
    arc_path = "resources/" + logical
    if arc_path not in set(zf.namelist()):
        zf.write(src, arc_path)
    record = {
        "role": role,
        "path": arc_path,
        "logicalPath": logical,
        "sourceArea": str(file_def.get("sourceArea") or file_def.get("area") or "upload"),
        "sourcePath": clean_logical_path(
            str(file_def.get("sourcePath") or inferred_legacy_source_path(logical) or file_def.get("path") or logical),
            allow_legacy=True,
        ),
        "fileName": src.name,
        "mimeType": str(file_def.get("mimeType") or mimetypes.guess_type(src.name)[0] or "application/octet-stream"),
        "size": src.stat().st_size,
        "sha256": sha256_file(src),
    }
    if derived_from:
        record["derivedFrom"] = derived_from
    return record


def convert_office_to_pdf(src: Path, logical: str) -> tuple[Path, tempfile.TemporaryDirectory[str]] | None:
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        return None
    tmp = tempfile.TemporaryDirectory()
    try:
        subprocess.run(
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmp.name, str(src)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=60,
        )
        pdf = Path(tmp.name) / (Path(logical).stem + ".pdf")
        if pdf.is_file():
            return pdf, tmp
    except Exception:
        pass
    tmp.cleanup()
    return None


def update_resource_for_pdf_original(resource: dict, original_def: dict, pdf_logical: str, pdf_name: str, original_src: Path) -> None:
    resource["kind"] = "document"
    resource["documentKind"] = "pdf"
    resource["mimeType"] = "application/pdf"
    resource["uri"] = pdf_logical
    resource["canonicalUri"] = pdf_logical
    resource["export"] = {
        "originalReplacedByPdf": True,
        "originalFileName": original_src.name,
        "originalMimeType": str(original_def.get("mimeType") or mimetypes.guess_type(original_src.name)[0] or "application/octet-stream"),
    }
    original_def["path"] = pdf_logical
    original_def["file_name"] = pdf_name
    original_def["mimeType"] = "application/pdf"


def add_resource_files(zf: zipfile.ZipFile, upload_root: Path, user_id: str, resource: dict) -> dict | None:
    files = resource_files(resource)
    manifest_files = []
    messages = []
    logical_base = ""
    file_uuid = ""
    original_present = False
    office_replaced = False

    original_def = find_file_by_role(files, "original")
    original_resolved = resolve_resource_file(upload_root, user_id, original_def) if original_def else None
    if original_def and original_resolved:
        original_logical, original_src = original_resolved
        original_present = True
        if is_office_file(original_src.name):
            pdf_src = None
            pdf_tmp = None
            export_policy = "office-original-replaced-by-pdf"
            converted = convert_office_to_pdf(original_src, original_logical)
            if converted:
                pdf_src, pdf_tmp = converted
            else:
                fallback_def = find_file_by_role(files, "pdf-preview") or find_file_by_role(files, "preview")
                fallback_resolved = resolve_resource_file(upload_root, user_id, fallback_def) if fallback_def else None
                if fallback_resolved and Path(fallback_resolved[0]).suffix.lower() == ".pdf":
                    _, pdf_src = fallback_resolved
                    export_policy = "office-original-replaced-by-existing-preview-pdf"
            if pdf_src and pdf_src.is_file():
                pdf_logical = with_pdf_suffix(original_logical)
                derived_from = {
                    "role": "original",
                    "fileName": original_src.name,
                    "mimeType": str(original_def.get("mimeType") or mimetypes.guess_type(original_src.name)[0] or "application/octet-stream"),
                    "sourceArea": str(original_def.get("area") or "upload"),
                    "sourcePath": original_logical,
                    "exportPolicy": export_policy,
                }
                pdf_def = dict(original_def)
                pdf_def["mimeType"] = "application/pdf"
                manifest_files.append(zip_file_record(zf, pdf_src, "original", pdf_logical, pdf_def, derived_from))
                update_resource_for_pdf_original(resource, original_def, pdf_logical, Path(pdf_logical).name, original_src)
                logical_base = logical_base or logical_base_of(pdf_logical)
                pdf_parts = pdf_logical.split("/")
                file_uuid = file_uuid or (pdf_parts[3].lstrip("_") if len(pdf_parts) >= 5 else str(resource.get("id") or "").lstrip("_"))
                office_replaced = True
                if pdf_tmp:
                    pdf_tmp.cleanup()
            else:
                messages.append({"level": "ERROR", "code": "RESOURCE ORIGINAL FILE NOT FOUND", "role": "original"})

    for file_def in files:
        role = file_role(file_def)
        if role not in ALLOWED_ROLES:
            continue
        if role == "original" and office_replaced:
            continue
        resolved = resolve_resource_file(upload_root, user_id, file_def)
        if not resolved:
            messages.append({
                "level": "ERROR" if role == "original" else "WARNING",
                "code": "RESOURCE ORIGINAL FILE NOT FOUND" if role == "original" else "RESOURCE FILE NOT FOUND",
                "role": role,
                "path": str(file_def.get("path") or ""),
            })
            continue
        logical, src = resolved
        parts = logical.split("/")
        base = "/".join(parts[:4] if len(parts) >= 4 else parts[:2])
        logical_base = logical_base or base
        file_uuid = file_uuid or (parts[3].lstrip("_") if len(parts) >= 4 else str(resource.get("id") or "").lstrip("_"))
        manifest_files.append(zip_file_record(zf, src, role, logical, file_def))
        if role == "original":
            original_present = True

    if not manifest_files and not messages:
        return None
    item = {
        "resourceId": str(resource.get("id") or ""),
        "file_uuid": file_uuid,
        "source": str(resource.get("source") or resource.get("kind") or "upload"),
        "kind": str(resource.get("kind") or (resource.get("media") or {}).get("kind") or ""),
        "documentKind": str(resource.get("documentKind") or ""),
        "logicalBase": logical_base,
        "copyPolicy": "snapshot",
        "files": manifest_files,
    }
    if office_replaced:
        item["officeOriginalReplacedByPdf"] = True
    if messages or not original_present:
        if not original_present:
            messages.append({"level": "ERROR", "code": "RESOURCE ORIGINAL FILE NOT FOUND", "role": "original"})
        item["messages"] = messages
    return item


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
        "version": "1.1",
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
        upload_root = Path(upload_root_s)
        for resource in collect_upload_resources(note):
            item = add_resource_files(zf, upload_root, user_id, resource)
            if item:
                manifest["resources"].append(item)
        zf.writestr("note/" + note_key, json.dumps(note, ensure_ascii=False, separators=(",", ":")) + "\n")
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
