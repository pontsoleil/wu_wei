#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

from __future__ import annotations

import cgi
import hashlib
import json
import mimetypes
import shutil
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from cgi_common import (
    ENV_FILE,
    debug,
    debug_exception,
    debug_kv,
    environment_path,
    get_session_user_id,
    json_response,
    read_named_value,
    script_error,
    trim,
)


MAGICK = r"C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe"


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
    return cleaned or "upload-video.bin"


def detect_content_type(saved_path: Path, declared: str) -> str:
    declared = trim(declared)
    if declared:
        return declared
    guessed, _ = mimetypes.guess_type(str(saved_path))
    return guessed or "application/octet-stream"


def ffmpeg_path() -> Optional[str]:
    for cmd in ("ffmpeg",):
        try:
            cp = subprocess.run(["where", cmd], capture_output=True, text=True)
            if cp.returncode == 0:
                line = cp.stdout.splitlines()[0].strip()
                if line:
                    return line
        except Exception:
            pass
    return "ffmpeg"


def ffprobe_path() -> Optional[str]:
    for cmd in ("ffprobe",):
        try:
            cp = subprocess.run(["where", cmd], capture_output=True, text=True)
            if cp.returncode == 0:
                line = cp.stdout.splitlines()[0].strip()
                if line:
                    return line
        except Exception:
            pass
    return "ffprobe"


def ffprobe_video_size(src: Path) -> str:
    ffprobe = ffprobe_path()
    try:
        cp = subprocess.run(
            [
                ffprobe,
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "csv=p=0:s=x",
                str(src),
            ],
            capture_output=True,
            text=True,
        )
        if cp.returncode == 0:
            return cp.stdout.strip()
    except Exception:
        pass
    return ""


def ffprobe_duration(src: Path) -> str:
    ffprobe = ffprobe_path()
    try:
        cp = subprocess.run(
            [
                ffprobe,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(src),
            ],
            capture_output=True,
            text=True,
        )
        if cp.returncode == 0:
            value = cp.stdout.strip()
            try:
                return f"{float(value):.3f}"
            except Exception:
                return value
    except Exception:
        pass
    return ""


def ffprobe_image_size(src: Path) -> str:
    ffprobe = ffprobe_path()
    try:
        cp = subprocess.run(
            [
                ffprobe,
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "csv=p=0:s=x",
                str(src),
            ],
            capture_output=True,
            text=True,
        )
        if cp.returncode == 0:
            return cp.stdout.strip()
    except Exception:
        pass
    return ""


def identify_text(path: Path) -> str:
    try:
        cp = subprocess.run(
            [MAGICK, "identify", str(path)],
            capture_output=True,
            text=True,
        )
        if cp.returncode == 0:
            return cp.stdout.strip()
        debug_kv(identify_returncode=cp.returncode, identify_stderr=cp.stderr)
    except Exception as e:
        debug_kv(identify_exception=str(e))
    return ""


def make_video_thumbnail(src: Path, dest: Path, duration: str, size: int = 200) -> tuple[str, str]:
    ffmpeg = ffmpeg_path()

    ss = 1
    if duration:
        try:
            dur_i = int(round(float(duration)))
            if dur_i > 10:
                ss = dur_i // 10
            if ss < 1:
                ss = 1
        except Exception:
            pass

    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        cp = subprocess.run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel", "error",
                "-ss", str(ss),
                "-i", str(src),
                "-frames:v", "1",
                "-vf", f"scale='min({size},iw)':-2",
                "-q:v", "3",
                str(dest),
            ],
            capture_output=True,
            text=True,
        )
        if cp.returncode == 0 and dest.exists():
            return "", ffprobe_image_size(dest)
    except Exception:
        pass

    return "", ""


def write_resource_file(
    resource_file: Path,
    *,
    rid: str,
    name: str,
    declared_contenttype: str,
    file_uri: str,
    totalsize: int,
    lastmodified: str,
    resource_uri: str,
    resource_size: Optional[str],
    thumbnail_uri: Optional[str],
    thumbnail_size: Optional[str],
    duration: Optional[str],
    identify_out: str,
) -> None:
    lines = [
        f"id {rid}",
        f"name {name}",
        "option video",
        f"contenttype {declared_contenttype}",
        f"uri {file_uri}",
        f"value.totalsize {totalsize}",
        f"value.lastmodified {lastmodified}",
        "value.commment null",
        f"value.resource.uri {resource_uri}",
        f"value.resource.size {resource_size or 'null'}",
        f"value.thumbnail.uri {thumbnail_uri or 'null'}",
        f"value.thumbnail.size {thumbnail_size or 'null'}",
        f"value.duration {duration or 'null'}",
        f"value.identify {identify_out or 'null'}",
        "value.file ",
    ]
    resource_file.parent.mkdir(parents=True, exist_ok=True)
    resource_file.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


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


def resource_relative_path(resource_root: Path, path: Path) -> str:
    try:
        return path.relative_to(resource_root).as_posix()
    except Exception:
        return path.name


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


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


def response_from_resource(resource: dict, *, base_dir: Path, warning: str = "") -> dict:
    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    media = resource.get("media") if isinstance(resource.get("media"), dict) else {}
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    files = [item for item in (storage.get("files") or []) if isinstance(item, dict)]
    primary = Path(str(storage.get("primaryPath") or ""))

    def file_uri(role: str) -> str:
        for item in files:
            if item.get("role") == role and item.get("path"):
                p = Path(str(item.get("sourcePath") or "")) if item.get("sourcePath") else primary / str(item.get("path"))
                if p.exists():
                    return rel_uri_from_abs(base_dir, p, role, "")
        return ""

    original_uri = file_uri("original") or str(identity.get("canonicalUri") or identity.get("uri") or "")
    thumbnail_uri = file_uri("thumbnail")
    original = next((item for item in files if item.get("role") == "original"), {})
    thumbnail = next((item for item in files if item.get("role") == "thumbnail"), {})
    return {
        "id": resource.get("id"),
        "resource": resource,
        "name": identity.get("title") or resource.get("id") or "",
        "option": "video",
        "contenttype": media.get("mimeType") or "application/octet-stream",
        "uri": original_uri,
        **({"warning": warning} if warning else {}),
        "value": {
            "totalsize": str(original.get("size") or ""),
            "resource": {
                "uri": str(identity.get("uri") or ""),
            },
            **(
                {
                    "thumbnail": {
                        "uri": thumbnail_uri,
                        **({"size": thumbnail.get("displaySize")} if thumbnail.get("displaySize") else {}),
                    }
                }
                if thumbnail_uri
                else {}
            ),
            **({"duration": media.get("duration")} if media.get("duration") else {}),
            "file": "",
            "identify": "",
        },
    }


def rel_uri_from_abs(base_dir: Path, target: Path, kind: str, user_id: str) -> str:
    try:
        rel = target.relative_to(base_dir)
        return rel.as_posix()
    except Exception:
        return target.as_posix()


def main():
    debug("script begin")

    user_id = get_session_user_id()
    debug_kv(user_id=user_id)
    if not user_id:
        script_error("ERROR NOT LOGGED IN")

    base_dir_s = environment_path("base")
    upload_root_s = environment_path("upload", user_id)
    resource_root_s = environment_path("resource", user_id)
    thumbnail_root_s = environment_path("thumbnail", user_id)

    debug_kv(
        env_file=str(ENV_FILE),
        raw_base=read_named_value(ENV_FILE, "base"),
        raw_upload=read_named_value(ENV_FILE, "upload"),
        raw_resource=read_named_value(ENV_FILE, "resource"),
        raw_thumbnail=read_named_value(ENV_FILE, "thumbnail"),
    )
    debug_kv(
        base_dir=base_dir_s,
        upload_root=upload_root_s,
        resource_root=resource_root_s,
        thumbnail_root=thumbnail_root_s,
    )

    if not base_dir_s:
        script_error("ERROR BASE DIRECTORY NOT DEFINED")
    if not upload_root_s:
        script_error("ERROR UPLOAD DIRECTORY NOT DEFINED")
    if not resource_root_s:
        script_error("ERROR RESOURCE DIRECTORY NOT DEFINED")
    if not thumbnail_root_s:
        script_error("ERROR THUMBNAIL DIRECTORY NOT DEFINED")

    base_dir = Path(base_dir_s)
    upload_root = Path(upload_root_s)
    resource_root = Path(resource_root_s)
    thumbnail_root = Path(thumbnail_root_s)

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

    filename = safe_filename(getattr(fileitem, "filename", "") or "upload-video.bin")
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
        debug_kv(dedupe="resource reused", resource_id=existing_resource.get("id"), sha256=original_hash)
        json_response(response_from_resource(existing_resource, base_dir=base_dir, warning="resource reused"))

    if existing_resource and dedupe_reason == "sourcePath":
        resource_id = str(existing_resource.get("id") or "")
        existing_storage = existing_resource.get("storage") if isinstance(existing_resource.get("storage"), dict) else {}
        if existing_storage.get("primaryPath"):
            primary_dir = Path(str(existing_storage.get("primaryPath") or ""))
            if not primary_dir.is_absolute():
                primary_dir = resource_root / primary_dir
        else:
            primary_dir = resource_dir / resource_id
        debug_kv(dedupe="resource updated by same sourcePath", resource_id=resource_id, source_path=upload_relpath)
    else:
        rid = str(uuid.uuid4())
        resource_id = f"_{rid}"
        primary_dir = resource_dir / resource_id
    primary_dir.mkdir(parents=True, exist_ok=True)

    resource_file = primary_dir / "resource.json"
    thumb_file = primary_dir / "thumbnail.jpg"

    identify_out = identify_text(dest_file)
    video_wh = ffprobe_video_size(dest_file)
    duration = ffprobe_duration(dest_file)

    thumbnail_uri = None
    thumbnail_size = None

    if (content_type or "").startswith("video/"):
        _, thumbnail_size = make_video_thumbnail(dest_file, thumb_file, duration)
        if thumb_file.exists():
            thumbnail_uri = rel_uri_from_abs(base_dir, thumb_file, "thumbnail", user_id)

    file_uri = rel_uri_from_abs(base_dir, dest_file, "upload", user_id)
    resource_uri = rel_uri_from_abs(base_dir, primary_dir, "resource", user_id)

    name = fullname or filename
    totalsize = dest_file.stat().st_size
    lastmodified = datetime.fromtimestamp(dest_file.stat().st_mtime).astimezone().isoformat()

    debug_kv(
        rid=rid,
        content_type=content_type,
        file_uri=file_uri,
        resource_uri=resource_uri,
        thumbnail_uri=thumbnail_uri,
        totalsize=totalsize,
        lastmodified=lastmodified,
        video_wh=video_wh,
        duration=duration,
        thumbnail_size=thumbnail_size,
    )

    files = [file_entry("original", dest_file, content_type, video_wh or "")]
    files[0]["area"] = "upload"
    files[0]["path"] = upload_relpath
    if thumb_file.exists():
        item = file_entry("thumbnail", thumb_file, "image/jpeg", thumbnail_size or "")
        item["area"] = "resource"
        item["path"] = resource_relative_path(resource_root, thumb_file)
        files.append(item)

    resource = {
        "id": resource_id,
        "type": "Resource",
        "origin": {
            "type": "userRegistered",
            "subtype": "uploadedVideo",
            "provider": "local",
        },
        "identity": {
            "title": name,
            "canonicalUri": file_uri,
            "uri": file_uri,
        },
        "media": {
            "kind": "video",
            "mimeType": content_type,
            "downloadable": True,
            "duration": float(duration) if duration else None,
        },
        "viewer": {
            "supportedModes": ["infoPane", "newTab", "newWindow", "download", "player"],
            "defaultMode": "infoPane",
            "embed": {
                "enabled": True,
                "uri": file_uri,
            },
        },
        "storage": {
            "managed": True,
            "copyPolicy": "snapshot",
            "sourcePath": upload_relpath,
            "primaryPath": resource_relative_path(resource_root, primary_dir),
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

    warning = ""
    if not thumbnail_uri:
        warning = "thumbnail not generated"

    response = {
        "id": resource_id,
        "resource": resource,
        "name": name,
        "option": "video",
        "contenttype": declared_contenttype or content_type,
        "uri": file_uri,
        **({"warning": warning} if warning else {}),
        "value": {
            "totalsize": str(totalsize),
            "lastmodified": lastmodified,
            "resource": {
                "uri": resource_uri,
                **({"size": video_wh} if video_wh else {}),
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
            **({"duration": duration} if duration else {}),
            "file": "",
            "identify": identify_out,
        },
    }

    debug_kv(response_id=rid)
    json_response(response)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        debug_exception()
        script_error("ERROR INTERNAL VIDEO UPLOAD FAILURE")
