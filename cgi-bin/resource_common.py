#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

"""Helpers for WuWei Resource library CGI scripts."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Iterable

from cgi_common import environment_path, environment_url, trim


def load_resource(path: Path) -> dict | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="strict"))
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def is_home_hidden(resource: dict) -> bool:
    home = resource.get("home") if isinstance(resource.get("home"), dict) else {}
    return bool(home.get("hidden") or resource.get("hiddenFromHome"))


def list_resource_files(resource_root: Path) -> list[Path]:
    if not resource_root.exists():
        return []
    files = [p for p in resource_root.rglob("resource.json") if p.is_file()]
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files


def resource_date_from_path(resource_root: Path, resource_json: Path) -> str:
    try:
        rel = resource_json.relative_to(resource_root).parts
    except ValueError:
        rel = resource_json.parts
    if len(rel) >= 3 and re.match(r"^\d{4}$", rel[0]) and re.match(r"^\d{2}$", rel[1]) and re.match(r"^\d{2}$", rel[2]):
        return f"{rel[0]}-{rel[1]}-{rel[2]}"
    return ""


def resource_month_from_path(resource_root: Path, resource_json: Path) -> str:
    d = resource_date_from_path(resource_root, resource_json)
    return d[:7] if d else ""


def available_months(resource_root: Path) -> list[str]:
    months = {
        resource_month_from_path(resource_root, p)
        for p in list_resource_files(resource_root)
    }
    return sorted([m for m in months if m])


def local_file_url(user_id: str, source_path: str) -> str:
    if not source_path:
        return ""

    source = Path(source_path)
    if not source.exists():
        return ""

    for area in ("resource", "upload", "thumbnail", "note"):
        base = Path(environment_path(area, user_id))
        try:
            rel = source.resolve().relative_to(base.resolve()).as_posix()
            return environment_url(area, user_id, rel)
        except Exception:
            continue

    return ""


def file_url(user_id: str, resource_json: Path, role_path: str, source_path: str = "", area: str = "") -> str:
    if not role_path:
        return local_file_url(user_id, source_path)
    if role_path.startswith("http://") or role_path.startswith("https://") or role_path.startswith("data:"):
        return role_path

    role_path = role_path.replace("\\", "/").strip("/")
    if area:
        area_root = Path(environment_path(area, user_id))
        candidate = area_root / role_path
        if candidate.exists():
            return environment_url(area, user_id, role_path)

    resource_dir = resource_json.parent
    candidate = resource_dir / role_path
    if candidate.exists():
        try:
            rel = candidate.relative_to(Path(environment_path("resource", user_id))).as_posix()
            return environment_url("resource", user_id, rel)
        except Exception:
            return str(candidate)

    source_url = local_file_url(user_id, source_path)
    if source_url:
        return source_url

    return role_path


def find_storage_file(resource: dict, role: str) -> dict:
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    files = storage.get("files") if isinstance(storage.get("files"), list) else []
    for item in files:
        if isinstance(item, dict) and item.get("role") == role:
            return item
    return {}


def first_storage_size(resource: dict) -> str:
    item = find_storage_file(resource, "original")
    size = item.get("size", "") if item else ""
    return str(size or "")


def is_hosted_youtube(uri: str) -> bool:
    return re.match(r"^https?://(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b", str(uri or ""), re.I) is not None


def is_hosted_vimeo(uri: str) -> bool:
    return re.match(r"^https?://(www\.)?(vimeo\.com|player\.vimeo\.com)\b", str(uri or ""), re.I) is not None


def is_webpage_resource(resource: dict, uri: str) -> bool:
    origin = resource.get("origin") if isinstance(resource.get("origin"), dict) else {}
    media = resource.get("media") if isinstance(resource.get("media"), dict) else {}
    viewer = resource.get("viewer") if isinstance(resource.get("viewer"), dict) else {}
    origin_type = str(origin.get("type") or "").lower()
    origin_subtype = str(origin.get("subtype") or "").lower()
    media_kind = str(media.get("kind") or "").lower()
    default_mode = str(viewer.get("defaultMode") or "").lower()
    return (
        origin_type == "externalpublic"
        or origin_subtype in {"webpage", "web_page", "website", "blog", "entitysite", "entity_site"}
        or media_kind in {"webpage", "web_page", "website", "html"}
        or default_mode in {"infopane", "newtab", "newwindow"}
        or str(uri or "").startswith(("http://", "https://"))
    )


def timestamp_for_resource(resource_root: Path, resource_json: Path, resource: dict) -> str:
    audit = resource.get("audit") if isinstance(resource.get("audit"), dict) else {}
    ts = trim(str(audit.get("lastModifiedAt") or audit.get("createdAt") or ""))
    if ts:
        return ts.replace("T", " ")[:19]
    d = resource_date_from_path(resource_root, resource_json)
    if d:
        return f"{d} 00:00:00"
    return datetime.fromtimestamp(resource_json.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")


def option_for_resource(resource: dict) -> str:
    origin = resource.get("origin") if isinstance(resource.get("origin"), dict) else {}
    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    media = resource.get("media") if isinstance(resource.get("media"), dict) else {}
    uri = str(identity.get("uri") or identity.get("canonicalUri") or "")
    if str(media.get("kind") or "").lower() == "video" or is_hosted_youtube(uri) or is_hosted_vimeo(uri):
        return "video"
    if is_webpage_resource(resource, uri):
        return "webpage"
    if uri.startswith("http://") or uri.startswith("https://"):
        return "webpage" if not resource.get("storage") else "upload"
    return "upload"


def viewer_type_for_resource(resource: dict, uri: str, content_type: str) -> str:
    media = resource.get("media") if isinstance(resource.get("media"), dict) else {}
    kind = str(media.get("kind") or "").lower()
    mime = str(content_type or media.get("mimeType") or "").lower()
    if is_hosted_youtube(uri):
        return "youtube"
    if is_hosted_vimeo(uri):
        return "vimeo"
    if kind == "video" or mime.startswith("video/"):
        return "video"
    if kind == "image" or mime.startswith("image/"):
        return "image"
    if mime == "application/pdf" or str(uri).lower().endswith(".pdf"):
        return "pdf"
    if is_webpage_resource(resource, uri):
        return "iframe"
    return ""


def external_thumbnail_uri(resource: dict) -> str:
    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    viewer = resource.get("viewer") if isinstance(resource.get("viewer"), dict) else {}
    embed = viewer.get("embed") if isinstance(viewer.get("embed"), dict) else {}
    snapshot_sources = resource.get("snapshotSources") if isinstance(resource.get("snapshotSources"), dict) else {}
    return str(
        resource.get("thumbnailUri")
        or identity.get("thumbnailUri")
        or viewer.get("thumbnailUri")
        or embed.get("thumbnailUri")
        or snapshot_sources.get("thumbnailUri")
        or ""
    )


def collect_resource_record(resource_root: Path, resource_json: Path, user_id: str) -> dict | None:
    resource = load_resource(resource_json)
    if not resource:
        return None
    if is_home_hidden(resource):
        return None

    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    media = resource.get("media") if isinstance(resource.get("media"), dict) else {}
    viewer = resource.get("viewer") if isinstance(resource.get("viewer"), dict) else {}
    embed = viewer.get("embed") if isinstance(viewer.get("embed"), dict) else {}
    description = resource.get("description") if isinstance(resource.get("description"), dict) else {}
    thumbnail = find_storage_file(resource, "thumbnail")
    preview = find_storage_file(resource, "preview")
    original = find_storage_file(resource, "original")

    title = resource.get("label") or identity.get("title") or resource.get("id") or resource_json.parent.name
    uri = identity.get("uri") or embed.get("uri") or identity.get("canonicalUri") or ""
    canonical_uri = identity.get("canonicalUri") or uri
    content_type = media.get("mimeType") or original.get("mimeType") or ""
    if not content_type and is_webpage_resource(resource, canonical_uri or uri):
        content_type = "text/html"
    viewer_type = viewer_type_for_resource(resource, canonical_uri or uri, content_type)
    preview_uri = embed.get("uri") or (
        file_url(user_id, resource_json, str(preview.get("path") or ""), str(preview.get("sourcePath") or ""), str(preview.get("area") or ""))
        if preview
        else uri
    )
    thumbnail_uri = (
        file_url(user_id, resource_json, str(thumbnail.get("path") or ""), str(thumbnail.get("sourcePath") or ""), str(thumbnail.get("area") or ""))
        if thumbnail
        else external_thumbnail_uri(resource)
    )

    return {
        "id": resource.get("id") or resource_json.parent.name,
        "resource": resource,
        "label": resource.get("label") or title,
        "description": description,
        "name": title,
        "option": option_for_resource(resource),
        "contenttype": content_type,
        "uri": uri,
        "url": preview_uri or uri,
        "download_url": canonical_uri,
        "preview_url": preview_uri,
        "value": {
            "lastmodified": timestamp_for_resource(resource_root, resource_json, resource),
            "totalsize": first_storage_size(resource),
            "viewerType": viewer_type,
            "previewUri": preview_uri,
            "resource": {
                "uri": environment_url(
                    "resource",
                    user_id,
                    resource_date_from_path(resource_root, resource_json).replace("-", "/"),
                    resource_json.parent.name,
                ),
                "url": environment_url(
                    "resource",
                    user_id,
                    resource_date_from_path(resource_root, resource_json).replace("-", "/"),
                    resource_json.parent.name,
                ),
            },
            **(
                {
                    "thumbnail": {
                        "uri": thumbnail_uri,
                        **({"size": str(thumbnail.get("displaySize") or thumbnail.get("size") or "")} if thumbnail else {}),
                    }
                }
                if thumbnail_uri
                else {}
            ),
            **(
                {
                    "pdf": {
                        "uri": preview_uri,
                        "url": preview_uri,
                    }
                }
                if preview_uri and str(preview_uri).lower().endswith(".pdf")
                else {}
            ),
            "comment": description.get("body", "") if isinstance(description, dict) else "",
            "file": "",
        },
    }


def filter_by_month_and_date(paths: Iterable[Path], resource_root: Path, year: str, month: str, date: str = "") -> list[Path]:
    month_key = f"{int(year):04d}-{int(month):02d}" if str(year).isdigit() and str(month).isdigit() else ""
    out = []
    for path in paths:
        d = resource_date_from_path(resource_root, path)
        if date and d != date:
            continue
        if month_key and not d.startswith(month_key):
            continue
        out.append(path)
    return out


def strip_markup(format_name: str, body: str) -> str:
    text = str(body or "")
    fmt = str(format_name or "plain/text").lower()
    if "html" in fmt:
        text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.I)
        text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
        text = re.sub(r"<[^>]+>", " ", text)
    elif "asciidoc" in fmt or "adoc" in fmt:
        text = re.sub(r"^\s*:[^:\n]+:.*$", " ", text, flags=re.M)
        text = re.sub(r"^\s*(={1,6}|#{1,6})\s+", " ", text, flags=re.M)
        text = re.sub(r"^\s*\[[^\]\n]+\]\s*$", " ", text, flags=re.M)
        text = re.sub(r"(?:link:|image:)?[A-Za-z][A-Za-z0-9+.-]*:[^\s\[]+\[([^\]]*)\]", r" \1 ", text)
        text = re.sub(r"[*_`+#~]", " ", text)
    elif "markdown" in fmt or fmt == "md":
        text = re.sub(r"```[\s\S]*?```", " ", text)
        text = re.sub(r"`([^`]*)`", r" \1 ", text)
        text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r" \1 ", text)
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r" \1 ", text)
        text = re.sub(r"^\s{0,3}#{1,6}\s+", " ", text, flags=re.M)
        text = re.sub(r"[*_>#~=-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def resource_search_text(resource: dict) -> str:
    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    description = resource.get("description") if isinstance(resource.get("description"), dict) else {}
    files = storage.get("files") if isinstance(storage.get("files"), list) else []
    return " ".join(
        [
            str(resource.get("label") or ""),
            strip_markup(str(description.get("format") or "plain/text"), str(description.get("body") or "")),
            str(identity.get("title") or ""),
            str(storage.get("sourcePath") or ""),
            " ".join(str(item.get("path") or "") for item in files if isinstance(item, dict)),
            str(identity.get("uri") or ""),
            str(identity.get("canonicalUri") or ""),
        ]
    ).lower()
