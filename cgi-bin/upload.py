#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

from __future__ import annotations

import cgi
import base64
import hashlib
import json
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import quote

try:
    from PIL import Image
except Exception:
    Image = None

from cgi_common import (
    ENV_FILE,
    debug,
    debug_exception,
    debug_kv,
    environment_path,
    get_effective_user_id,
    get_session_user_id,
    is_local_host,
    json_response,
    read_named_value,
    script_error,
    trim,
)

MAGICK = r"C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe"
SOFFICE = r"C:\Program Files\LibreOffice\program\soffice.exe"
OFFICE_EXTS = {
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
}


def resolve_command(*candidates: str) -> str:
    for candidate in candidates:
        candidate = trim(candidate)
        if not candidate:
            continue
        path = Path(candidate)
        if path.is_file():
            return str(path)
        found = shutil.which(candidate)
        if found:
            # Avoid Windows' filesystem convert.exe when ImageMagick is not on PATH.
            if Path(found).name.lower() == "convert.exe" and "system32" in found.lower():
                continue
            return found
    return ""


def magick_command() -> str:
    return resolve_command(os.environ.get("WUWEI_MAGICK", ""), MAGICK, "magick", "convert")


def soffice_command() -> str:
    script_bin = Path(__file__).resolve().parent.parent / "server" / "bin"
    return resolve_command(
        os.environ.get("WUWEI_SOFFICE", ""),
        SOFFICE,
        str(script_bin / "soffice"),
        str(script_bin / "libreoffice"),
        "soffice",
        "libreoffice",
    )


def safe_filename(name: str) -> str:
    name = trim(name).replace("\\", "_").replace("/", "_")
    name = " ".join(name.split())
    keep = []
    for ch in name:
        if ch.isalnum() or ch in "._-":
            keep.append(ch)
        else:
            keep.append("_")
    cleaned = "".join(keep)
    return cleaned or "upload.bin"


def detect_content_type(saved_path: Path, declared: str) -> str:
    declared = trim(declared)
    if declared:
        return declared
    guessed, _ = mimetypes.guess_type(str(saved_path))
    return guessed or "application/octet-stream"


def identify_text(path: Path) -> str:
    cmd = magick_command()
    if not cmd:
        debug("ImageMagick command is not available; identify skipped")
        return ""
    try:
        cp = subprocess.run(
            [cmd, "identify", str(path)] if Path(cmd).name.lower().startswith("magick") else [cmd, str(path)],
            capture_output=True,
            text=True,
        )
        if cp.returncode == 0:
            return cp.stdout.strip()
        debug_kv(identify_returncode=cp.returncode, identify_stderr=cp.stderr)
    except Exception as e:
        debug_kv(identify_exception=str(e))
    return ""


def make_image_thumbnail(src: Path, dest: Path, size: int = 200) -> tuple[str, str]:
    if Image is None:
        debug("Pillow is not available; image thumbnail skipped")
        return "", ""

    try:
        with Image.open(src) as im:
            iw, ih = im.size
            im.thumbnail((size, size))
            rgb = im.convert("RGB")
            dest.parent.mkdir(parents=True, exist_ok=True)
            rgb.save(dest, format="JPEG", quality=85)
            w, h = rgb.size
            return f"{iw}x{ih}", f"{w}x{h}"
    except Exception as e:
        debug_kv(image_thumb_exception=str(e), src=str(src), dest=str(dest))
        return "", ""


def make_pdf_thumbnail(src: Path, dest: Path, size: int = 200) -> tuple[str, str]:
    cmd = magick_command()
    if not cmd:
        debug("ImageMagick command is not available; pdf thumbnail skipped")
        return "", ""
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        cp = subprocess.run(
            [
                cmd,
                str(src) + "[0]",
                "-thumbnail",
                f"{size}x{size}",
                "-background",
                "white",
                "-alpha",
                "remove",
                str(dest),
            ],
            capture_output=True,
            text=True,
        )
        if cp.returncode == 0 and dest.exists():
            if Image is not None:
                with Image.open(dest) as im:
                    w, h = im.size
                    return "", f"{w}x{h}"
            return "", ""

        debug_kv(pdf_thumb_returncode=cp.returncode, pdf_thumb_stderr=cp.stderr)
    except Exception as e:
        debug_kv(pdf_thumb_exception=str(e), src=str(src), dest=str(dest))
    return "", ""


def count_pdf_pages(src: Path) -> int:
    """Return a best-effort PDF page count without adding a Python dependency."""
    if not src or not src.exists():
        return 0

    cmd = resolve_command(os.environ.get("WUWEI_PDFINFO", ""), "pdfinfo")
    if cmd:
        try:
            cp = subprocess.run(
                [cmd, str(src)],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if cp.returncode == 0:
                match = re.search(r"^Pages:\s*(\d+)\s*$", cp.stdout or "", re.M)
                if match:
                    return int(match.group(1))
        except Exception as e:
            debug_kv(pdf_page_count_exception=str(e), src=str(src))

    try:
        data = src.read_bytes()
    except Exception as e:
        debug_kv(pdf_page_count_read_exception=str(e), src=str(src))
        return 0

    # Works for the PDFs WuWei creates/receives commonly enough for metadata.
    markers = re.findall(rb"/Type\s*/Page\b", data)
    return len(markers)


def make_office_pdf(src: Path, outdir: Path) -> Path | None:
    cmd = soffice_command()
    if not cmd:
        debug("LibreOffice/soffice command is not available; office pdf conversion skipped")
        return None
    try:
        outdir.mkdir(parents=True, exist_ok=True)

        with tempfile.TemporaryDirectory(prefix="wuwei-office-profile-") as profile:
            profile_uri = Path(profile).resolve().as_uri()
            cp = subprocess.run(
                [
                    cmd,
                    "--headless",
                    "--nologo",
                    "--nofirststartwizard",
                    "--nodefault",
                    "--nolockcheck",
                    "--norestore",
                    f"-env:UserInstallation={profile_uri}",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(outdir),
                    str(src),
                ],
                capture_output=True,
                text=True,
            )

        pdf_path = outdir / f"{src.stem}.pdf"

        debug_kv(
            office_src=str(src),
            office_pdf=str(pdf_path),
            office_returncode=cp.returncode,
            office_stdout=cp.stdout.strip(),
            office_stderr=cp.stderr.strip(),
        )

        if cp.returncode == 0:
            if pdf_path.exists():
                return pdf_path
            generated = sorted(
                outdir.glob("*.pdf"),
                key=lambda p: p.stat().st_mtime if p.exists() else 0,
                reverse=True,
            )
            if generated:
                debug_kv(office_pdf_fallback=str(generated[0]), expected=str(pdf_path))
                return generated[0]

    except Exception as e:
        debug_kv(office_pdf_exception=str(e), src=str(src), outdir=str(outdir))

    return None


def make_absolute_url(uri: str) -> str:
    uri = trim(uri)
    if not uri:
        return ""

    if uri.startswith("http://") or uri.startswith("https://"):
        return uri

    https_flag = str(os.environ.get("HTTPS", "")).lower()
    scheme = "https" if https_flag in ("on", "1", "true", "yes") else "http"

    host = trim(os.environ.get("HTTP_HOST", ""))
    if not host:
        server_name = trim(os.environ.get("SERVER_NAME", "")) or "localhost"
        port = trim(os.environ.get("SERVER_PORT", ""))
        if port and port not in ("80", "443"):
            host = f"{server_name}:{port}"
        else:
            host = server_name

    if not uri.startswith("/"):
        uri = "/" + uri.lstrip("/")

    return f"{scheme}://{host}{uri}"


def write_resource_file(
    resource_file: Path,
    *,
    rid: str,
    name: str,
    declared_contenttype: str,
    file_uri: str,
    file_url: str,
    totalsize: int,
    lastmodified: str,
    resource_uri: str,
    resource_size: Optional[str],
    thumbnail_uri: Optional[str],
    thumbnail_size: Optional[str],
    pdf_uri: Optional[str],
    pdf_url: Optional[str],
    identify_out: str,
) -> None:
    lines = [
        f"id {rid}",
        f"name {name}",
        "option upload",
        f"contenttype {declared_contenttype}",
        f"uri {file_uri}",
        f"url {file_url or 'null'}",
        f"value.totalsize {totalsize}",
        f"value.lastmodified {lastmodified}",
        "value.commment null",
        f"value.resource.uri {resource_uri}",
        f"value.resource.size {resource_size or 'null'}",
        f"value.thumbnail.uri {thumbnail_uri or 'null'}",
        f"value.thumbnail.size {thumbnail_size or 'null'}",
        f"value.pdf.uri {pdf_uri or 'null'}",
        f"value.pdf.url {pdf_url or 'null'}",
        f"value.identify {identify_out or 'null'}",
        "value.file ",
    ]
    resource_file.parent.mkdir(parents=True, exist_ok=True)
    resource_file.write_text("\n".join(lines) + "\n", encoding="utf-8")


def media_kind(content_type: str, filename: str) -> str:
    content_type = (content_type or "").lower()
    suffix = Path(filename or "").suffix.lower()
    if content_type.startswith("image/"):
        return "image"
    if content_type.startswith("video/"):
        return "video"
    if content_type.startswith("audio/"):
        return "audio"
    if content_type.startswith("text/") or content_type == "application/pdf" or suffix in OFFICE_EXTS:
        return "document"
    return "general"


def file_entry(role: str, path: Path, mime_type: str, size_text: str = "", sha256: str | None = None) -> dict:
    item = {
        "role": role,
        "path": path.name,
        "mimeType": mime_type or "application/octet-stream",
        "size": path.stat().st_size if path.exists() else 0,
        "sha256": sha256 if sha256 is not None else (sha256_file(path) if path.exists() else ""),
    }
    if size_text:
        item["displaySize"] = size_text
    return item


def write_upload_manifest(
    manifest_file: Path,
    *,
    upload_id: str,
    user_id: str,
    title: str,
    kind: str,
    original_file: Path,
    original_name: str,
    original_mime: str,
    original_sha: str,
    thumbnail_file: Path | None,
    thumbnail_size: str,
    preview_file: Path | None,
    preview_sha: str,
    created_at: str,
) -> None:
    manifest = {
        "id": upload_id,
        "type": "UploadResource",
        "version": 1,
        "created_at": created_at,
        "created_by": user_id,
        "title": title,
        "kind": kind,
        "original": {
            "file": original_file.name,
            "display_name": original_name,
            "mime": original_mime or "application/octet-stream",
            "size": original_file.stat().st_size if original_file.exists() else 0,
            "sha256": original_sha,
        },
    }
    if thumbnail_file and thumbnail_file.exists():
        manifest["thumbnail"] = {
            "file": thumbnail_file.name,
            "mime": "image/png" if thumbnail_file.suffix.lower() == ".png" else "image/jpeg",
            "size": thumbnail_file.stat().st_size,
            "sha256": sha256_file(thumbnail_file),
            "display_size": thumbnail_size or "",
        }
    if preview_file and preview_file.exists():
        manifest["preview"] = {
            "file": preview_file.name,
            "mime": "application/pdf",
            "size": preview_file.stat().st_size,
            "sha256": preview_sha or sha256_file(preview_file),
            "generated_by": "LibreOffice",
        }
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_sha_index(index_file: Path) -> dict | None:
    try:
        data = json.loads(index_file.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def write_sha_index(index_file: Path, *, sha256: str, upload_id: str, date: str, filename: str) -> None:
    index_file.parent.mkdir(parents=True, exist_ok=True)
    index_file.write_text(
        json.dumps({
            "sha256": sha256,
            "upload_id": upload_id,
            "date": date,
            "file": filename,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def role_filename(role: str, path: Path) -> str:
    suffix = path.suffix or ".bin"
    if role == "preview":
        return "preview.pdf"
    if role == "thumbnail":
        return f"thumbnail{suffix}"
    if role == "original":
        return f"original{suffix}"
    return path.name


def upload_relative_path(upload_root: Path, path: Path) -> str:
    try:
        return path.relative_to(upload_root).as_posix()
    except Exception:
        return path.name


def resource_relative_path(resource_root: Path, path: Path) -> str:
    try:
        return path.relative_to(resource_root).as_posix()
    except Exception:
        return path.name


def note_relative_path(note_root: Path, path: Path) -> str:
    try:
        return path.relative_to(note_root).as_posix()
    except Exception:
        return path.name


def safe_note_id(value: str) -> str:
    # Uploads made before the first explicit note save belong to the fixed draft
    # slot. Ignore stale browser-side UUIDs; save-note promotes new_note later.
    return "new_note"


def ensure_draft_note_json(note_dir: Path, user_id: str) -> None:
    note_file = note_dir / "note.txt"
    if note_file.exists():
        return
    draft = {
        "note_id": "new_note",
        "note_uuid": "new_note",
        "note_name": "",
        "description": "",
        "currentPage": None,
        "resources": [],
        "pages": [],
    }
    encoded = json.dumps(draft, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    note_file.write_text(
        "\n".join([
            "format_version 2",
            "id new_note",
            f"user_id {user_id}",
            "name ",
            "description ",
            "thumbnail ",
            f"saved_at {datetime.now().astimezone().strftime('%Y-%m-%dT%H:%M:%S%z')}",
            "json_encoding base64",
            f"json_base64 {base64.b64encode(encoded).decode('ascii')}",
            "",
        ]),
        encoding="utf-8",
        newline="\n",
    )


def find_upload_file_for_day(upload_day_dir: Path, filename: str) -> Path | None:
    # Same date + same filename is treated as the same uploaded file, even if
    # the content hash changes after re-upload.
    for child in upload_day_dir.iterdir() if upload_day_dir.exists() else []:
        if not child.is_dir():
            continue
        candidate = child / filename
        if candidate.is_file():
            return candidate
    return None


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def file_url_from_path(path: Path) -> str:
    path_s = path.resolve().as_posix()
    docroot = "C:/Apache24/htdocs"
    if path_s.lower().startswith(docroot.lower()):
        return make_absolute_url(path_s[len(docroot):])
    return path_s


def protected_file_url(user_id: str, area: str, rel_path: str) -> str:
    area = trim(area).lower()
    rel_path = str(rel_path or "").replace("\\", "/").strip("/")
    if not area or not rel_path:
        return ""
    return (
        f"cgi-bin/load-file.py?area={quote(area, safe='')}"
        f"&path={quote(rel_path, safe='')}"
        f"&user_id={quote(user_id, safe='')}"
    )


def load_resource_json(path: Path) -> dict | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) and data.get("type") == "Resource" else None
    except Exception:
        return None


def resource_original_hash(resource: dict) -> str:
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    for item in storage.get("files") or []:
        if isinstance(item, dict) and item.get("role") == "original":
            return str(item.get("sha256") or "")
    return ""


def resource_file_exists(resource: dict, role: str, resource_root: Path, upload_root: Path | None = None) -> bool:
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    for item in storage.get("files") or []:
        if not isinstance(item, dict) or item.get("role") != role:
            continue
        if item.get("area") == "resource":
            path = resource_root / str(item.get("path") or "")
        elif item.get("area") == "upload" and upload_root is not None:
            path = upload_root / str(item.get("path") or "")
        else:
            continue
        if path.exists():
            return True
    return False


def office_resource_needs_preview(resource: dict, filename: str, resource_root: Path, upload_root: Path | None = None) -> bool:
    if Path(filename or "").suffix.lower() not in OFFICE_EXTS:
        return False
    return not resource_file_exists(resource, "preview", resource_root, upload_root)


def find_existing_resource(resource_root: Path, *, original_hash: str, canonical_uri: str, source_path: str) -> tuple[dict | None, str]:
    canonical_uri = (canonical_uri or "").strip()
    source_path = (source_path or "").replace("\\", "/").strip()
    for resource_json in resource_root.rglob("resource.json"):
        resource = load_resource_json(resource_json)
        if not resource:
            continue
        identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
        storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
        existing_uri = str(identity.get("canonicalUri") or identity.get("uri") or "").strip()
        existing_source = ""
        for item in storage.get("files") or []:
            if isinstance(item, dict) and item.get("role") == "original":
                existing_source = str(item.get("path") or "").replace("\\", "/").strip()
                break
        if original_hash and resource_original_hash(resource) == original_hash:
            return resource, "sha256"
        if canonical_uri and existing_uri == canonical_uri:
            return resource, "canonicalUri"
        if source_path and existing_source == source_path:
            return resource, "originalPath"
    return None, ""


def response_from_resource(resource: dict, *, option: str, warning: str = "") -> dict:
    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    media = resource.get("media") if isinstance(resource.get("media"), dict) else {}
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    files = [item for item in (storage.get("files") or []) if isinstance(item, dict)]

    def file_url(role: str) -> str:
        for item in files:
            if item.get("role") == role and item.get("path"):
                area = str(item.get("area") or ("upload" if role == "original" else "resource"))
                return protected_file_url(str(resource.get("audit", {}).get("owner") or ""), area, str(item.get("path")))
        return ""

    original_url = file_url("original") or str(identity.get("canonicalUri") or identity.get("uri") or "")
    thumbnail_url = file_url("thumbnail")
    preview_url = file_url("preview") or str(identity.get("uri") or "")
    original = next((item for item in files if item.get("role") == "original"), {})
    thumbnail = next((item for item in files if item.get("role") == "thumbnail"), {})
    return {
        "id": resource.get("id"),
        "resource": resource,
        "name": identity.get("title") or resource.get("id") or "",
        "option": option,
        "contenttype": media.get("mimeType") or "application/octet-stream",
        "uri": preview_url or original_url,
        "url": preview_url or original_url,
        "download_url": original_url,
        **({"preview_url": preview_url} if preview_url else {}),
        **({"warning": warning} if warning else {}),
        "value": {
            "totalsize": str(original.get("size") or ""),
            "resource": {
                "uri": str(identity.get("uri") or ""),
                "url": preview_url or original_url,
            },
            **(
                {
                    "thumbnail": {
                        "uri": thumbnail_url,
                        **({"size": thumbnail.get("displaySize")} if thumbnail.get("displaySize") else {}),
                    }
                }
                if thumbnail_url
                else {}
            ),
            "file": "",
            "identify": "",
        },
    }


def response_from_upload_manifest(
    manifest: dict,
    *,
    user_id: str,
    upload_date: str,
    upload_id: str,
    resource: dict,
    option: str,
    warning: str = "",
) -> dict:
    original = manifest.get("original") if isinstance(manifest.get("original"), dict) else {}
    thumbnail = manifest.get("thumbnail") if isinstance(manifest.get("thumbnail"), dict) else {}
    preview = manifest.get("preview") if isinstance(manifest.get("preview"), dict) else {}

    def upload_uri(filename: str) -> str:
        return protected_file_url(user_id, "upload", f"{upload_date}/{upload_id}/{filename}") if filename else ""

    original_url = upload_uri(str(original.get("file") or ""))
    thumbnail_url = upload_uri(str(thumbnail.get("file") or ""))
    preview_url = upload_uri(str(preview.get("file") or "")) or original_url
    return {
        "id": upload_id,
        "resource": resource,
        "name": manifest.get("title") or original.get("display_name") or original.get("file") or upload_id,
        "option": option,
        "contenttype": original.get("mime") or "application/octet-stream",
        "uri": original_url,
        "url": preview_url,
        "download_url": original_url,
        **({"preview_url": preview_url} if preview_url and preview_url != original_url else {}),
        **({"warning": warning} if warning else {}),
        "value": {
            "totalsize": str(original.get("size") or ""),
            "resource": {"uri": "", "url": preview_url},
            **(
                {"thumbnail": {"uri": thumbnail_url, **({"size": thumbnail.get("display_size")} if thumbnail.get("display_size") else {})}}
                if thumbnail_url else {}
            ),
            **({"pdf": {"uri": preview_url, "url": preview_url}} if preview_url and preview_url != original_url else {}),
            "file": "",
            "identify": "",
        },
    }


def main():
    debug("script begin")

    form = cgi.FieldStorage()
    requested_user_id = trim(form.getfirst("user_id", ""))
    user_id = get_effective_user_id()
    if requested_user_id == "guest" and is_local_host(os.environ.get("HTTP_HOST", "")):
        user_id = "guest"
    debug_kv(user_id=user_id)
    if not user_id:
        script_error("ERROR NOT LOGGED IN")

    upload_root_s = environment_path("upload", user_id)
    resource_root_s = environment_path("resource", user_id)
    note_root_s = environment_path("note", user_id)

    debug_kv(
        env_file=str(ENV_FILE),
        raw_upload=read_named_value(ENV_FILE, "upload"),
        raw_resource=read_named_value(ENV_FILE, "resource"),
    )

    debug_kv(
        upload_root=upload_root_s,
        resource_root=resource_root_s,
        note_root=note_root_s,
    )

    if not upload_root_s:
        script_error("ERROR UPLOAD DIRECTORY NOT DEFINED")
    if not resource_root_s:
        script_error("ERROR RESOURCE DIRECTORY NOT DEFINED")

    upload_root = Path(upload_root_s)
    resource_root = Path(resource_root_s)
    note_root = Path(note_root_s) if note_root_s else upload_root.parent / "note"
    note_id = safe_note_id(form.getfirst("note_id", "") or "new_note")
    pdf_preview_uri = None
    pdf_preview_url = None

    now = datetime.now().astimezone()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")

    upload_date = f"{year}/{month}/{day}"
    upload_day_dir = upload_root / year / month / day

    upload_day_dir.mkdir(parents=True, exist_ok=True)

    if "file" not in form:
        script_error("ERROR FILE NOT FOUND IN MULTIPART")

    fileitem = form["file"]
    if not getattr(fileitem, "file", None):
        script_error("ERROR FILE STREAM NOT FOUND")

    filename = safe_filename(getattr(fileitem, "filename", "") or "upload.bin")
    fullname = trim(form.getfirst("fullname", ""))
    declared_contenttype = trim(getattr(fileitem, "type", "") or "")

    debug_kv(
        filename=filename,
        fullname=fullname,
        declared_contenttype=declared_contenttype,
    )

    temp_upload = upload_day_dir / f".{uuid.uuid4()}.uploading"
    with temp_upload.open("wb") as f:
        shutil.copyfileobj(fileitem.file, f)
    original_hash = sha256_file(temp_upload)
    sha_index_file = upload_root / "_index" / "sha256" / f"{original_hash}.json"
    sha_index = read_sha_index(sha_index_file)
    if sha_index and sha_index.get("upload_id") and sha_index.get("date"):
        upload_file_id = str(sha_index.get("upload_id"))
        upload_date = str(sha_index.get("date")).strip("/") or upload_date
        upload_file_dir = upload_root / upload_date / upload_file_id
        indexed_file = str(sha_index.get("file") or filename)
        dest_file = upload_file_dir / indexed_file
        if not dest_file.is_file():
            dest_file = upload_file_dir / filename
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(temp_upload), str(dest_file))
        else:
            try:
                temp_upload.unlink()
            except OSError:
                pass
        debug_kv(dedupe="upload bundle reused", upload_id=upload_file_id, sha256=original_hash)
    else:
        upload_file_id = f"_{uuid.uuid4()}"
        upload_file_dir = upload_root / upload_date / upload_file_id
        dest_file = upload_file_dir / filename
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(temp_upload), str(dest_file))

    content_type = detect_content_type(dest_file, declared_contenttype)
    upload_relpath = upload_relative_path(upload_root, dest_file)
    resource_dir = resource_root / upload_date
    resource_dir.mkdir(parents=True, exist_ok=True)
    existing_resource, dedupe_reason = (None, "")
    resource_id = upload_file_id
    primary_dir = resource_dir / resource_id
    rid = resource_id.lstrip("_")
    primary_dir.mkdir(parents=True, exist_ok=True)

    thumb_file = dest_file.parent / "thumbnail.jpg"
    thumb_area = "upload"
    thumb_root = upload_root
    resource_file = primary_dir / "resource.json"
    manifest_file = dest_file.parent / "manifest.json"
    identify_out = identify_text(dest_file)

    resource_size = None
    thumbnail_uri = None
    thumbnail_size = None
    office_pdf = None
    pdf_preview_uri = None
    pdf_preview_url = None
    page_count = 0

    if content_type.startswith("image/"):
        resource_size, thumbnail_size = make_image_thumbnail(dest_file, thumb_file)

    elif content_type.lower().startswith("application/pdf"):
        resource_size, thumbnail_size = make_pdf_thumbnail(dest_file, thumb_file)
        page_count = count_pdf_pages(dest_file)

    elif dest_file.suffix.lower() in OFFICE_EXTS:
        pdf_preview_dir = dest_file.parent
        office_pdf = make_office_pdf(dest_file, pdf_preview_dir)

        if office_pdf and office_pdf.exists():
            normalized_pdf = dest_file.parent / "preview.pdf"
            if office_pdf != normalized_pdf:
                try:
                    if normalized_pdf.exists():
                        normalized_pdf.unlink()
                    office_pdf.replace(normalized_pdf)
                    office_pdf = normalized_pdf
                except OSError as e:
                    debug_kv(office_pdf_rename_exception=str(e), src=str(office_pdf), dst=str(normalized_pdf))
            resource_size, thumbnail_size = make_pdf_thumbnail(office_pdf, thumb_file)
            page_count = count_pdf_pages(office_pdf)
            pdf_preview_uri = protected_file_url(user_id, "upload", upload_relative_path(upload_root, office_pdf))
            pdf_preview_url = pdf_preview_uri
            debug_kv(
                office_preview_pdf=str(office_pdf),
                office_preview_uri=pdf_preview_uri,
                office_preview_url=pdf_preview_url,
                office_thumbnail=str(thumb_file),
                office_thumbnail_size=thumbnail_size,
            )
        else:
            debug("office pdf conversion failed")

    file_uri = protected_file_url(user_id, "upload", upload_relpath)
    file_url = file_uri
    resource_uri = ""
    resource_url = ""

    if thumb_file.exists():
        thumb_rel = note_relative_path(thumb_root, thumb_file) if thumb_area == "note" else resource_relative_path(thumb_root, thumb_file)
        thumbnail_uri = protected_file_url(user_id, thumb_area, thumb_rel)

    name = fullname or filename
    totalsize = dest_file.stat().st_size
    lastmodified = (
        datetime.fromtimestamp(dest_file.stat().st_mtime).astimezone().isoformat()
    )

    debug_kv(
        rid=rid,
        content_type=content_type,
        file_uri=file_uri,
        file_url=file_url,
        resource_uri=resource_uri,
        resource_url=resource_url,
        thumbnail_uri=thumbnail_uri,
        totalsize=totalsize,
        lastmodified=lastmodified,
        resource_size=resource_size,
        thumbnail_size=thumbnail_size,
        office_pdf=str(office_pdf) if office_pdf else "",
        pdf_preview_uri=pdf_preview_uri or "",
        pdf_preview_url=pdf_preview_url or "",
    )

    files = [file_entry("original", dest_file, content_type, resource_size or "", original_hash)]
    files[0]["area"] = "upload"
    files[0]["path"] = upload_relpath
    if thumb_file.exists():
        item = file_entry("thumbnail", thumb_file, "image/png" if thumb_file.suffix.lower() == ".png" else "image/jpeg", thumbnail_size or "")
        item["area"] = thumb_area
        item["path"] = note_relative_path(thumb_root, thumb_file) if thumb_area == "note" else resource_relative_path(thumb_root, thumb_file)
        files.append(item)
    if office_pdf and office_pdf.exists():
        item = file_entry("preview", office_pdf, "application/pdf")
        item["area"] = "upload"
        item["path"] = upload_relative_path(upload_root, office_pdf)
        files.append(item)

    resource = {
        "id": resource_id,
        "type": "Resource",
        "label": name,
        "title": name,
        "kind": media_kind(content_type, filename),
        "mimeType": content_type,
        "uri": "",
        "canonicalUri": "",
        "origin": {
            "type": "userRegistered",
            "subtype": "uploadedDocument" if media_kind(content_type, filename) == "document" else f"uploaded{media_kind(content_type, filename).capitalize()}",
            "provider": "local",
        },
        "identity": {
            "title": name,
            "canonicalUri": "",
            "uri": "",
        },
        "media": {
            "kind": media_kind(content_type, filename),
            "mimeType": content_type,
            "downloadable": True,
            "duration": None,
            "pageCount": page_count or None,
        },
        **(
            {
                "contents": {
                    "type": "pdf",
                    "axis": {
                        "unit": "page",
                        "nodeType": "page",
                    },
                    "pageCount": page_count,
                    "sourceRole": "preview" if office_pdf and office_pdf.exists() else "original",
                }
            }
            if page_count
            else {}
        ),
        "viewer": {
            "supportedModes": ["infoPane", "newTab", "newWindow", "download"],
            "defaultMode": "infoPane",
            "embed": {
                "enabled": bool(pdf_preview_url or content_type.startswith("image/")),
                "uri": "",
            },
        },
        "storage": {
            "managed": True,
            "copyPolicy": "reference",
            "manifest": {
                "area": "upload",
                "path": upload_relative_path(upload_root, manifest_file),
            },
            "files": files,
        },
        "rights": {
            "owner": user_id,
            "copyright": "",
            "license": "",
            "attribution": "",
        },
        "audit": {
            "owner": user_id,
            "createdBy": user_id,
            "createdAt": now.isoformat(),
            "lastModifiedBy": "",
            "lastModifiedAt": "",
        },
    }
    preview_sha = sha256_file(office_pdf) if office_pdf and office_pdf.exists() else ""
    write_upload_manifest(
        manifest_file,
        upload_id=upload_file_id,
        user_id=user_id,
        title=name,
        kind=media_kind(content_type, filename),
        original_file=dest_file,
        original_name=name,
        original_mime=content_type,
        original_sha=original_hash,
        thumbnail_file=thumb_file if thumb_file.exists() else None,
        thumbnail_size=thumbnail_size or "",
        preview_file=office_pdf if office_pdf and office_pdf.exists() else None,
        preview_sha=preview_sha,
        created_at=now.isoformat(),
    )
    write_sha_index(sha_index_file, sha256=original_hash, upload_id=upload_file_id, date=upload_date, filename=dest_file.name)
    resource_file.write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    response = {
        "id": resource_id,
        "resource": resource,
        "name": name,
        "option": "upload",
        "contenttype": declared_contenttype or content_type,
        "uri": file_uri,
        "url": file_url,
        "download_url": file_url,
        **({"preview_url": pdf_preview_url} if pdf_preview_url else {}),
        "value": {
            "totalsize": str(totalsize),
            "lastmodified": lastmodified,
            "resource": {
                "uri": resource_uri,
                "url": resource_url,
                **({"size": resource_size} if resource_size else {}),
            },
            **(
                {
                    "thumbnail": {
                        "uri": thumbnail_uri,
                        **({"size": thumbnail_size} if thumbnail_size else {}),
                    }
                }
                if thumbnail_uri
                else {}
            ),
            **(
                {
                    "pdf": {
                        "uri": pdf_preview_uri,
                        "url": pdf_preview_url,
                    }
                }
                if pdf_preview_url
                else {}
            ),
            "file": "",
            "identify": identify_out,
        },
    }

    debug_kv(
        response_id=rid,
        response_url=file_url,
        response_download_url=file_url,
        response_preview_url=pdf_preview_url or "",
    )
    json_response(response)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        debug_exception()
        script_error("ERROR INTERNAL UPLOAD FAILURE")
