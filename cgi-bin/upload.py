#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

from __future__ import annotations

import cgi
import hashlib
import json
import mimetypes
import os
import shutil
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

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
    environment_url,
    get_session_user_id,
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


def make_office_pdf(src: Path, outdir: Path) -> Path | None:
    cmd = soffice_command()
    if not cmd:
        debug("LibreOffice/soffice command is not available; office pdf conversion skipped")
        return None
    try:
        outdir.mkdir(parents=True, exist_ok=True)

        cp = subprocess.run(
            [
                cmd,
                "--headless",
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

        if cp.returncode == 0 and pdf_path.exists():
            return pdf_path

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
    resource_file.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


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


def file_entry(role: str, path: Path, mime_type: str, size_text: str = "") -> dict:
    item = {
        "role": role,
        "path": path.name,
        "mimeType": mime_type or "application/octet-stream",
        "size": path.stat().st_size if path.exists() else 0,
        "sha256": sha256_file(path) if path.exists() else "",
    }
    if size_text:
        item["displaySize"] = size_text
    return item


def upload_relative_path(upload_root: Path, path: Path) -> str:
    try:
        return path.relative_to(upload_root).as_posix()
    except Exception:
        return path.name


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


def resource_file_exists(resource: dict, role: str) -> bool:
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    primary = Path(str(storage.get("primaryPath") or ""))
    for item in storage.get("files") or []:
        if not isinstance(item, dict) or item.get("role") != role:
            continue
        path_text = str(item.get("sourcePath") or "")
        path = Path(path_text) if path_text else primary / str(item.get("path") or "")
        if path.exists():
            return True
    return False


def office_resource_needs_preview(resource: dict, filename: str) -> bool:
    if Path(filename or "").suffix.lower() not in OFFICE_EXTS:
        return False
    return not resource_file_exists(resource, "preview")


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
        existing_primary = str(storage.get("primaryPath") or "").replace("\\", "/").strip()
        existing_source = str(storage.get("sourcePath") or "").replace("\\", "/").strip()
        if original_hash and resource_original_hash(resource) == original_hash:
            return resource, "sha256"
        if canonical_uri and existing_uri == canonical_uri:
            return resource, "canonicalUri"
        if source_path and (existing_source == source_path or existing_primary == source_path):
            return resource, "sourcePath"
    return None, ""


def response_from_resource(resource: dict, *, option: str, warning: str = "") -> dict:
    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    media = resource.get("media") if isinstance(resource.get("media"), dict) else {}
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    files = [item for item in (storage.get("files") or []) if isinstance(item, dict)]
    primary = Path(str(storage.get("primaryPath") or ""))

    def file_url(role: str) -> str:
        for item in files:
            if item.get("role") == role and item.get("path"):
                p = Path(str(item.get("sourcePath") or "")) if item.get("sourcePath") else primary / str(item.get("path"))
                if p.exists():
                    return file_url_from_path(p)
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


def main():
    debug("script begin")

    user_id = get_session_user_id()
    debug_kv(user_id=user_id)
    if not user_id:
        script_error("ERROR NOT LOGGED IN")

    upload_root_s = environment_path("upload", user_id)
    resource_root_s = environment_path("resource", user_id)
    thumbnail_root_s = environment_path("thumbnail", user_id)

    debug_kv(
        env_file=str(ENV_FILE),
        raw_upload=read_named_value(ENV_FILE, "upload"),
        raw_resource=read_named_value(ENV_FILE, "resource"),
        raw_thumbnail=read_named_value(ENV_FILE, "thumbnail"),
    )

    debug_kv(
        upload_root=upload_root_s,
        resource_root=resource_root_s,
        thumbnail_root=thumbnail_root_s,
    )

    if not upload_root_s:
        script_error("ERROR UPLOAD DIRECTORY NOT DEFINED")
    if not resource_root_s:
        script_error("ERROR RESOURCE DIRECTORY NOT DEFINED")
    if not thumbnail_root_s:
        script_error("ERROR THUMBNAIL DIRECTORY NOT DEFINED")

    upload_root = Path(upload_root_s)
    resource_root = Path(resource_root_s)
    thumbnail_root = Path(thumbnail_root_s)
    pdf_preview_uri = None
    pdf_preview_url = None

    now = datetime.now().astimezone()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")

    upload_dir = upload_root / year / month / day
    resource_dir = resource_root / year / month / day
    thumbnail_dir = thumbnail_root / year / month / day

    upload_dir.mkdir(parents=True, exist_ok=True)
    resource_dir.mkdir(parents=True, exist_ok=True)
    thumbnail_dir.mkdir(parents=True, exist_ok=True)

    form = cgi.FieldStorage()

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

    dest_file = upload_dir / filename
    with open(dest_file, "wb") as f:
        shutil.copyfileobj(fileitem.file, f)

    content_type = detect_content_type(dest_file, declared_contenttype)
    original_hash = sha256_file(dest_file)
    upload_relpath = upload_relative_path(upload_root, dest_file)
    existing_resource, dedupe_reason = find_existing_resource(
        resource_root,
        original_hash=original_hash,
        canonical_uri="",
        source_path=upload_relpath,
    )
    if existing_resource and dedupe_reason != "sourcePath":
        if not office_resource_needs_preview(existing_resource, filename):
            debug_kv(dedupe="resource reused", resource_id=existing_resource.get("id"), sha256=original_hash)
            json_response(response_from_resource(existing_resource, option="upload", warning="resource reused"))
        debug_kv(
            dedupe="office resource reused but preview missing; regenerating",
            resource_id=existing_resource.get("id"),
            reason=dedupe_reason,
        )
        dedupe_reason = "sourcePath"

    if existing_resource and dedupe_reason == "sourcePath":
        resource_id = str(existing_resource.get("id") or "")
        existing_storage = existing_resource.get("storage") if isinstance(existing_resource.get("storage"), dict) else {}
        primary_dir = Path(str(existing_storage.get("primaryPath") or "")) if existing_storage.get("primaryPath") else resource_dir / resource_id
        debug_kv(dedupe="resource updated by same sourcePath", resource_id=resource_id, source_path=upload_relpath)
    else:
        rid = str(uuid.uuid4())
        resource_id = f"_{rid}"
        primary_dir = resource_dir / resource_id
    rid = resource_id.lstrip("_")
    primary_dir.mkdir(parents=True, exist_ok=True)

    thumb_ext = ".png" if content_type.lower().startswith("application/pdf") else ".jpg"
    thumb_file = primary_dir / f"thumbnail{thumb_ext}"
    resource_file = primary_dir / "resource.json"
    identify_out = identify_text(dest_file)

    resource_size = None
    thumbnail_uri = None
    thumbnail_size = None
    office_pdf = None
    pdf_preview_uri = None
    pdf_preview_url = None

    if content_type.startswith("image/"):
        resource_size, thumbnail_size = make_image_thumbnail(dest_file, thumb_file)

    elif content_type.lower().startswith("application/pdf"):
        resource_size, thumbnail_size = make_pdf_thumbnail(dest_file, thumb_file)

    elif dest_file.suffix.lower() in OFFICE_EXTS:
        pdf_preview_dir = primary_dir
        office_pdf = make_office_pdf(dest_file, pdf_preview_dir)

        if office_pdf and office_pdf.exists():
            resource_size, thumbnail_size = make_pdf_thumbnail(office_pdf, thumb_file)
            pdf_preview_uri = environment_url("resource", user_id, year, month, day, resource_id, office_pdf.name)
            pdf_preview_url = make_absolute_url(pdf_preview_uri)
            debug_kv(
                office_preview_pdf=str(office_pdf),
                office_preview_uri=pdf_preview_uri,
                office_preview_url=pdf_preview_url,
                office_thumbnail=str(thumb_file),
                office_thumbnail_size=thumbnail_size,
            )
        else:
            debug("office pdf conversion failed")

    file_uri = environment_url("upload", user_id, year, month, day, filename)
    file_url = make_absolute_url(file_uri)
    resource_uri = environment_url("resource", user_id, year, month, day, resource_id)
    resource_url = make_absolute_url(resource_uri)

    if thumb_file.exists():
        thumbnail_uri = environment_url("resource", user_id, year, month, day, resource_id, thumb_file.name)

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

    files = [file_entry("original", dest_file, content_type, resource_size or "")]
    files[0]["path"] = upload_relpath
    files[0]["sourcePath"] = str(dest_file)
    if thumb_file.exists():
        files.append(file_entry("thumbnail", thumb_file, "image/png" if thumb_file.suffix.lower() == ".png" else "image/jpeg", thumbnail_size or ""))
    if office_pdf and office_pdf.exists():
        files.append(file_entry("preview", office_pdf, "application/pdf"))

    resource = {
        "id": resource_id,
        "type": "Resource",
        "origin": {
            "type": "userRegistered",
            "subtype": "uploadedDocument" if media_kind(content_type, filename) == "document" else f"uploaded{media_kind(content_type, filename).capitalize()}",
            "provider": "local",
        },
        "identity": {
            "title": name,
            "canonicalUri": file_url,
            "uri": pdf_preview_url or file_url,
        },
        "media": {
            "kind": media_kind(content_type, filename),
            "mimeType": content_type,
            "downloadable": True,
            "duration": None,
        },
        "viewer": {
            "supportedModes": ["infoPane", "newTab", "newWindow", "download"],
            "defaultMode": "infoPane",
            "embed": {
                "enabled": bool(pdf_preview_url or content_type.startswith("image/")),
                "uri": pdf_preview_url or file_url,
            },
        },
        "storage": {
            "managed": True,
            "copyPolicy": "snapshot",
            "sourcePath": upload_relpath,
            "primaryPath": str(primary_dir),
            "snapshotPath": "",
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
    resource_file.write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

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
