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
from urllib.parse import quote

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
    resource_file.write_text("\n".join(lines) + "\n", encoding="utf-8")


def server_root_relative(path: Path) -> str:
    text = path.resolve().as_posix()
    marker = "/wu_wei2/"
    idx = text.lower().find(marker)
    if idx >= 0:
        return text[idx + len(marker):]
    marker2 = "/htdocs/"
    idx = text.lower().find(marker2)
    if idx >= 0:
        return text[idx + len(marker2):]
    return text


def logical_upload_path(upload_date: str, file_uuid: str, filename: str) -> str:
    date = str(upload_date or "").replace("\\", "/").strip("/")
    fid = safe_filename(str(file_uuid or "").strip("/"))
    if fid and not fid.startswith("_"):
        fid = "_" + fid
    return f"{date}/{fid}/{safe_filename(filename)}"


def write_path_index(upload_root: Path, *, logical_path: str, upload_id: str, actual_date: str, filename: str) -> None:
    logical_path = str(logical_path or "").replace("\\", "/").strip("/")
    if not logical_path:
        return
    index_file = upload_root / "_index" / "path" / (logical_path + ".json")
    index_file.parent.mkdir(parents=True, exist_ok=True)
    index_file.write_text(
        json.dumps({
            "logicalPath": logical_path,
            "upload_id": upload_id,
            "actual_date": actual_date,
            "date": actual_date,
            "file": filename,
            "manifest": f"{actual_date}/{upload_id}/manifest.json",
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def file_entry(role: str, logical_path: str, dir_path: Path, file_name: str, mime_type: str, size_text: str = "") -> dict:
    actual = dir_path / file_name
    item = {
        "role": role,
        "area": "upload",
        "path": logical_path,
        "dir_name": server_root_relative(dir_path),
        "file_name": file_name,
        "mimeType": mime_type or "application/octet-stream",
        "size": actual.stat().st_size if actual.exists() else 0,
        "sha256": sha256_file(actual) if actual.exists() else "",
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
    original_file: Path,
    original_mime: str,
    original_sha: str,
    thumbnail_file: Path | None,
    thumbnail_size: str,
    duration: str,
    created_at: str,
) -> None:
    manifest = {
        "id": upload_id,
        "type": "UploadResource",
        "version": 1,
        "created_at": created_at,
        "created_by": user_id,
        "title": title,
        "kind": "video",
        "original": {
            "file": original_file.name,
            "display_name": title,
            "mime": original_mime or "application/octet-stream",
            "size": original_file.stat().st_size if original_file.exists() else 0,
            "sha256": original_sha,
            "duration": duration or "",
        },
    }
    if thumbnail_file and thumbnail_file.exists():
        manifest["thumbnail"] = {
            "file": thumbnail_file.name,
            "mime": "image/jpeg",
            "size": thumbnail_file.stat().st_size,
            "sha256": sha256_file(thumbnail_file),
            "display_size": thumbnail_size or "",
        }
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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


def protected_file_url(user_id: str, area: str, rel_path: str, role: str = "") -> str:
    area = trim(area).lower()
    rel_path = str(rel_path or "").replace("\\", "/").strip("/")
    role = trim(role).lower()
    if not area or not rel_path:
        return ""
    url = (
        f"cgi-bin/load-file.py?area={quote(area, safe='')}"
        f"&path={quote(rel_path, safe='')}"
    )
    if role:
        url += f"&role={quote(role, safe='')}"
    return url


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

    base_dir_s = environment_path("base")
    upload_root_s = environment_path("upload", user_id)
    resource_root_s = environment_path("resource", user_id)

    debug_kv(
        env_file=str(ENV_FILE),
        raw_base=read_named_value(ENV_FILE, "base"),
        raw_upload=read_named_value(ENV_FILE, "upload"),
        raw_resource=read_named_value(ENV_FILE, "resource"),
    )
    debug_kv(
        base_dir=base_dir_s,
        upload_root=upload_root_s,
        resource_root=resource_root_s,
    )

    if not base_dir_s:
        script_error("ERROR BASE DIRECTORY NOT DEFINED")
    if not upload_root_s:
        script_error("ERROR UPLOAD DIRECTORY NOT DEFINED")
    if not resource_root_s:
        script_error("ERROR RESOURCE DIRECTORY NOT DEFINED")

    base_dir = Path(base_dir_s)
    upload_root = Path(upload_root_s)
    resource_root = Path(resource_root_s)

    now = datetime.now().astimezone()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")
    upload_date = f"{year}/{month}/{day}"

    upload_dir = upload_root / year / month / day
    resource_dir = resource_root / year / month / day

    upload_dir.mkdir(parents=True, exist_ok=True)
    resource_dir.mkdir(parents=True, exist_ok=True)

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

    upload_file_id = f"_{uuid.uuid4()}"
    upload_file_dir = upload_dir / upload_file_id
    dest_file = upload_file_dir / filename
    dest_file.parent.mkdir(parents=True, exist_ok=True)
    with open(dest_file, "wb") as f:
        shutil.copyfileobj(fileitem.file, f)

    content_type = detect_content_type(dest_file, declared_contenttype)
    original_hash = sha256_file(dest_file)
    logical_path = logical_upload_path(upload_date, upload_file_id, filename)
    resource_id = f"_{uuid.uuid4()}"
    primary_dir = resource_dir / resource_id
    rid = resource_id.lstrip("_")
    primary_dir.mkdir(parents=True, exist_ok=True)

    resource_file = primary_dir / "resource.json"
    manifest_file = dest_file.parent / "manifest.json"
    thumb_file = dest_file.parent / "thumbnail.jpg"

    identify_out = identify_text(dest_file)
    video_wh = ffprobe_video_size(dest_file)
    duration = ffprobe_duration(dest_file)

    thumbnail_uri = None
    thumbnail_size = None

    if (content_type or "").startswith("video/"):
        _, thumbnail_size = make_video_thumbnail(dest_file, thumb_file, duration)
        if thumb_file.exists():
            thumbnail_logical_path = logical_upload_path(upload_date, upload_file_id, thumb_file.name)
            thumbnail_uri = protected_file_url(user_id, "upload", thumbnail_logical_path, "thumbnail")

    file_uri = protected_file_url(user_id, "upload", logical_path, "original")
    resource_uri = logical_path

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

    files = [file_entry("original", logical_path, dest_file.parent, dest_file.name, content_type, video_wh or "")]
    if thumb_file.exists():
        item = file_entry("thumbnail", logical_upload_path(upload_date, upload_file_id, thumb_file.name), thumb_file.parent, thumb_file.name, "image/jpeg", thumbnail_size or "")
        files.append(item)
    manifest_logical_path = logical_upload_path(upload_date, upload_file_id, manifest_file.name)
    video_kind = dest_file.suffix.lower().lstrip(".")

    resource = {
        "id": resource_id,
        "type": "Resource",
        "label": name,
        "title": name,
        "kind": "video",
        "source": "upload",
        "videoKind": video_kind,
        "mimeType": content_type,
        "uri": logical_path,
        "canonicalUri": logical_path,
        "origin": {
            "type": "userRegistered",
            "subtype": "uploadedVideo",
            "provider": "local",
        },
        "identity": {
            "title": name,
            "canonicalUri": logical_path,
            "uri": logical_path,
        },
        "media": {
            "kind": "video",
            "mimeType": content_type,
            "downloadable": True,
            "duration": float(duration) if duration else None,
        },
        "thumbnailUri": thumbnail_uri or "",
        "viewer": {
            "supportedModes": ["infoPane", "newTab", "newWindow", "download", "player"],
            "defaultMode": "infoPane",
            "embed": {
                "enabled": True,
                "uri": "",
            },
        },
        "storage": {
            "managed": True,
            "copyPolicy": "snapshot",
            "manifest": {
                "area": "upload",
                "path": manifest_logical_path,
                "dir_name": server_root_relative(manifest_file.parent),
                "file_name": "manifest.json",
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
    write_upload_manifest(
        manifest_file,
        upload_id=upload_file_id,
        user_id=user_id,
        title=name,
        original_file=dest_file,
        original_mime=content_type,
        original_sha=original_hash,
        thumbnail_file=thumb_file if thumb_file.exists() else None,
        thumbnail_size=thumbnail_size or "",
        duration=duration or "",
        created_at=now.isoformat(),
    )
    write_path_index(
        upload_root,
        logical_path=logical_path,
        upload_id=upload_file_id,
        actual_date=upload_date,
        filename=dest_file.name,
    )
    resource_file.write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

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
        "url": file_uri,
        "download_url": file_uri,
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
