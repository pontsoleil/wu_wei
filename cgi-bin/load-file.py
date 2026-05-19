#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Serve managed WuWei files through CGI instead of public data/ URLs.

The script validates the user, area, role, and logical path before serving
managed files.

In nginx deployments, file delivery can be delegated with X-Accel-Redirect by
setting WUWEI_X_ACCEL_REDIRECT=1. In local Apache CGI deployments, the script
streams the file body directly because Apache does not process
X-Accel-Redirect.
"""

from __future__ import annotations

import json
import mimetypes
import os
import sys
from pathlib import Path
from urllib.parse import quote

from cgi_common import (
    environment_path,
    get_effective_user_id,
    merge_query_and_body_params,
    script_dir,
    text_response,
    trim,
)

ALLOWED_AREAS = {"upload", "note", "resource", "thumbnail", "content"}
DIRECT_STREAM_CHUNK_SIZE = 1024 * 1024


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


def safe_header_filename(value: str) -> str:
    return (
        value.replace("\\", "/")
        .split("/")[-1]
        .replace('"', "")
        .replace("\r", "")
        .replace("\n", "")
    )


def truthy_env(name: str) -> bool:
    value = trim(os.environ.get(name, "")).lower()
    return value in {"1", "true", "yes", "on"}


def use_x_accel_redirect() -> bool:
    """Return True only when explicit nginx acceleration is enabled.

    Apache CGI does not implement X-Accel-Redirect. The safe default is direct
    streaming. Production nginx deployments can set WUWEI_X_ACCEL_REDIRECT=1.
    """
    return truthy_env("WUWEI_X_ACCEL_REDIRECT")


def emit_file_headers(target: Path, mime: str) -> None:
    print(f"Content-Type: {mime}")
    print("Cache-Control: no-store")
    print(f'Content-Disposition: inline; filename="{safe_header_filename(target.name)}"')
    print(f"Content-Length: {target.stat().st_size}")


def send_file_direct(target: Path, mime: str) -> None:
    """Stream the file body from CGI for local Apache and fallback delivery."""
    emit_file_headers(target, mime)
    print()
    sys.stdout.flush()

    with target.open("rb") as f:
        while True:
            chunk = f.read(DIRECT_STREAM_CHUNK_SIZE)
            if not chunk:
                break
            sys.stdout.buffer.write(chunk)
    sys.stdout.buffer.flush()


def send_file_x_accel(target: Path, base: Path, user_id: str, area: str, mime: str) -> None:
    """Delegate file delivery to nginx using X-Accel-Redirect."""
    try:
        accel_rel = target.relative_to(base).as_posix()
    except ValueError:
        reject("ERROR INVALID FILE PATH", "403 Forbidden")

    emit_file_headers(target, mime)
    print(
        "X-Accel-Redirect: "
        + quote(f"/_wuwei2_data/{user_id}/{area}/{accel_rel}", safe="/._-~")
    )
    print()
    sys.stdout.flush()


def load_json(path: Path) -> dict | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def role_file_from_manifest(manifest: dict, role: str) -> str:
    role = (role or "original").lower()
    if role in {"pdf-preview", "pdf"}:
        role = "preview"
    section = manifest.get(role) if isinstance(manifest.get(role), dict) else {}
    if not section and role == "preview":
        section = manifest.get("pdf-preview") if isinstance(manifest.get("pdf-preview"), dict) else {}
    if not section and role == "original":
        section = manifest.get("original") if isinstance(manifest.get("original"), dict) else {}
    return str(section.get("file") or "").replace("\\", "/").strip("/")


def resolve_upload_logical_path(base: Path, rel: str, role: str) -> Path | None:
    """Resolve a v2 logical upload path through the path index."""
    rel = rel.replace("\\", "/").strip("/")
    role = (role or "original").lower()
    manifest_rel = ""
    target_file = ""
    target: Path | None = None

    index = base / "_index" / "path" / (rel + ".json")
    data = load_json(index) if index.is_file() else None
    if data:
        manifest_rel = str(data.get("manifest") or "").replace("\\", "/").strip("/")
        if not manifest_rel and data.get("actual_date") and data.get("upload_id"):
            manifest_rel = f"{data.get('actual_date')}/{data.get('upload_id')}/manifest.json"
        if manifest_rel:
            manifest = load_json(base / manifest_rel) or {}
            target_file = role_file_from_manifest(manifest, role)
            if target_file:
                target = (base / manifest_rel).parent / target_file
                if target.is_file():
                    return target

    return None


def fallback_area_base(area: str, user_id: str) -> str:
    """Resolve old/local area roots not defined in cgi_common.environment.

    This supports legacy content paths such as:
    data/{user_id}/content/YYYY/MM/file.pdf
    even when only upload/note/resource roots are present in the environment.
    """
    candidates: list[Path] = []

    upload_base_text = environment_path("upload", user_id)
    if upload_base_text:
        candidates.append(Path(upload_base_text).resolve().parent / area)

    candidates.append(script_dir().parent / "data" / user_id / area)

    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())

    return str(candidates[0].resolve()) if candidates else ""


def resolve_area_base(area: str, user_id: str) -> Path:
    base_text = environment_path(area, user_id)
    if not base_text and area == "content":
        base_text = fallback_area_base(area, user_id)
    if not base_text:
        reject("ERROR AREA NOT DEFINED", "404 Not Found")
    return Path(base_text).resolve()


def resolve_note_fallback(base: Path, rel: str, user_id: str) -> tuple[Path, Path]:
    upload_base_text = environment_path("upload", user_id)
    if upload_base_text:
        alt_base = (Path(upload_base_text).resolve().parent / "note").resolve()
        alt_target = (alt_base / rel).resolve()
        try:
            alt_target.relative_to(alt_base)
        except ValueError:
            pass
        else:
            if alt_target.is_file():
                return alt_base, alt_target
    return base, (base / rel).resolve()


def main() -> None:
    params = merge_query_and_body_params()
    effective_user_id = get_effective_user_id()
    user_id = effective_user_id
    if not effective_user_id:
        reject("ERROR NOT LOGGED IN", "403 Forbidden")

    area = trim(params.get("area", "")).lower()
    rel = safe_relative_path(params.get("path", ""))
    role = trim(params.get("role", "original")).lower() or "original"
    if area not in ALLOWED_AREAS or not rel:
        reject("ERROR INVALID FILE REQUEST")

    base = resolve_area_base(area, user_id)
    target = (base / rel).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        reject("ERROR INVALID FILE PATH", "403 Forbidden")

    if area == "upload" and (role not in {"", "original"} or not target.is_file()):
        resolved = resolve_upload_logical_path(base, rel, role)
        if resolved:
            target = resolved.resolve()
            try:
                target.relative_to(base)
            except ValueError:
                reject("ERROR INVALID FILE PATH", "403 Forbidden")

    if area == "note" and not target.is_file():
        base, target = resolve_note_fallback(base, rel, user_id)

    if not target.is_file():
        reject("ERROR FILE NOT FOUND", "404 Not Found")

    mime = mimetypes.guess_type(str(target))[0] or "application/octet-stream"

    if use_x_accel_redirect():
        send_file_x_accel(target, base, user_id, area, mime)
    else:
        send_file_direct(target, mime)


if __name__ == "__main__":
    main()
