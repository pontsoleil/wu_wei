#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import base64
import binascii
import hashlib
import json
import shutil
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlparse

from cgi_common import (
    debug,
    debug_exception,
    debug_kv,
    environment_path,
    get_session_user_id,
    merge_query_and_body_params,
    script_error,
    script_dir,
    text_response,
    validate_simple_id,
)


def _single_line_meta(value: str) -> str:
    return " ".join((value or "").replace("\r", " ").replace("\n", " ").replace("\t", " ").split())


def _ensure_note_json(value: str) -> dict:
    text = (value or "")
    if text.startswith("\ufeff"):
        text = text.lstrip("\ufeff")
    if not text:
        raise ValueError("JSON NOT SPECIFIED")
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("NOTE JSON MUST BE OBJECT")
    if "pages" not in data or not isinstance(data.get("pages"), dict):
        raise ValueError("NOTE JSON PAGES MUST BE OBJECT")
    if "resources" in data and not isinstance(data.get("resources"), list):
        raise ValueError("NOTE JSON RESOURCES MUST BE ARRAY")
    return data


def _resolve_storage_dir(path_text: str, *, base_root: Path, user_id: str, note_id: str) -> Path | None:
    path_text = (path_text or "").replace("\\", "/").strip()
    if not path_text:
        return None
    path_text = path_text.replace("_user_uuid", user_id).replace("user_uuid", user_id)
    path_text = path_text.replace("_note_uuid", note_id).replace("note_uuid", note_id)
    path = Path(path_text)
    if path.is_absolute():
        return path
    return base_root / path_text


def _local_file_from_uri(uri: str) -> Path | None:
    uri = (uri or "").strip()
    if not uri:
        return None
    parsed = urlparse(uri)
    path_text = unquote(parsed.path if parsed.scheme else uri)
    marker = "/wu_wei2/"
    if marker in path_text:
        path_text = path_text.split(marker, 1)[1]
    path_text = path_text.replace("\\", "/").lstrip("/")
    path = Path(path_text)
    if path.is_absolute():
        return path if path.is_file() else None
    candidate = script_dir().parent / path_text
    return candidate if candidate.is_file() else None


def _promote_local_resource_snapshot(resource: dict) -> None:
    storage = resource.get("storage")
    if not isinstance(storage, dict):
        storage = {}
        resource["storage"] = storage
    if storage.get("managed") is True and storage.get("copyPolicy") == "snapshot":
        return

    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    media = resource.get("media") if isinstance(resource.get("media"), dict) else {}
    viewer = resource.get("viewer") if isinstance(resource.get("viewer"), dict) else {}
    embed = viewer.get("embed") if isinstance(viewer.get("embed"), dict) else {}
    snapshot_sources = resource.get("snapshotSources") if isinstance(resource.get("snapshotSources"), dict) else {}
    candidates = [
        ("original", str(snapshot_sources.get("originalUri") or identity.get("canonicalUri") or ""), str(media.get("mimeType") or "application/octet-stream")),
        ("preview", str(snapshot_sources.get("previewUri") or embed.get("uri") or identity.get("uri") or ""), "application/pdf"),
        ("thumbnail", str(snapshot_sources.get("thumbnailUri") or ""), "image/jpeg"),
    ]

    files = []
    seen = set()
    for role, uri, mime_type in candidates:
        source = _local_file_from_uri(uri)
        if source is None or source in seen:
            continue
        seen.add(source)
        files.append({
            "role": role,
            "path": source.name,
            "sourcePath": str(source),
            "mimeType": mime_type,
            "size": source.stat().st_size,
            "sha256": "",
        })

    if not files:
        return

    storage["managed"] = True
    storage["copyPolicy"] = "snapshot"
    storage["primaryPath"] = str(Path(files[0]["sourcePath"]).parent)
    storage.setdefault("snapshotPath", "")
    storage["files"] = files


def _resource_timestamp(resource: dict, fallback: datetime) -> datetime:
    audit = resource.get("audit") if isinstance(resource.get("audit"), dict) else {}
    for key in ("createdAt", "lastModifiedAt"):
        value = str(audit.get(key) or "").strip()
        if not value:
            continue
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone()
        except Exception:
            continue
    return fallback


def _resource_identity_key(resource: dict) -> str:
    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    return str(
        identity.get("canonicalUri")
        or identity.get("uri")
        or storage.get("sourcePath")
        or ""
    ).strip()


def _resource_uri_values(resource: dict) -> list[str]:
    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    viewer = resource.get("viewer") if isinstance(resource.get("viewer"), dict) else {}
    embed = viewer.get("embed") if isinstance(viewer.get("embed"), dict) else {}
    snapshot_sources = resource.get("snapshotSources") if isinstance(resource.get("snapshotSources"), dict) else {}
    return [
        str(identity.get("uri") or "").strip(),
        str(embed.get("uri") or "").strip(),
        str(snapshot_sources.get("previewUri") or "").strip(),
        str(identity.get("canonicalUri") or "").strip(),
        str(snapshot_sources.get("originalUri") or "").strip(),
    ]


def _has_resource_uri(resource: dict) -> bool:
    return any(_resource_uri_values(resource))


def _snapshot_filename(item: dict, src: Path) -> str:
    role = str(item.get("role") or "").strip()
    suffix = src.suffix or Path(str(item.get("path") or "")).suffix or ".bin"
    if role == "preview":
        return "preview.pdf"
    if role == "thumbnail":
        return f"thumbnail{suffix}"
    if role == "original":
        return f"original{suffix}"
    return Path(str(item.get("path") or src.name)).name


def _merge_resource_uri_fields(resource: dict, existing: dict) -> None:
    identity = resource.setdefault("identity", {})
    if not isinstance(identity, dict):
        identity = {}
        resource["identity"] = identity
    existing_identity = existing.get("identity") if isinstance(existing.get("identity"), dict) else {}

    if not str(identity.get("uri") or "").strip() and existing_identity.get("uri"):
        identity["uri"] = existing_identity.get("uri")
    if not str(identity.get("canonicalUri") or "").strip() and existing_identity.get("canonicalUri"):
        identity["canonicalUri"] = existing_identity.get("canonicalUri")

    viewer = resource.setdefault("viewer", {})
    if not isinstance(viewer, dict):
        viewer = {}
        resource["viewer"] = viewer
    embed = viewer.setdefault("embed", {})
    if not isinstance(embed, dict):
        embed = {}
        viewer["embed"] = embed
    existing_viewer = existing.get("viewer") if isinstance(existing.get("viewer"), dict) else {}
    existing_embed = existing_viewer.get("embed") if isinstance(existing_viewer.get("embed"), dict) else {}
    if not str(embed.get("uri") or "").strip() and existing_embed.get("uri"):
        embed["uri"] = existing_embed.get("uri")

    snapshot_sources = resource.setdefault("snapshotSources", {})
    if not isinstance(snapshot_sources, dict):
        snapshot_sources = {}
        resource["snapshotSources"] = snapshot_sources
    existing_snapshot_sources = existing.get("snapshotSources") if isinstance(existing.get("snapshotSources"), dict) else {}
    for key in ("previewUri", "originalUri", "thumbnailUri"):
        if not str(snapshot_sources.get(key) or "").strip() and existing_snapshot_sources.get(key):
            snapshot_sources[key] = existing_snapshot_sources.get(key)


def _find_existing_primary_resource_by_id(resource_root: Path, rid: str) -> Path | None:
    if not rid or not resource_root.exists():
        return None
    for resource_json in resource_root.rglob("resource.json"):
        if resource_json.parent.name == rid:
            return resource_json.parent
        try:
            existing = json.loads(resource_json.read_text(encoding="utf-8", errors="strict"))
        except Exception:
            continue
        if isinstance(existing, dict) and str(existing.get("id") or "") == rid:
            return resource_json.parent
    return None


def _find_existing_primary_resource(resource_root: Path, resource: dict) -> Path | None:
    key = _resource_identity_key(resource)
    if not key or not resource_root.exists():
        return None
    for resource_json in resource_root.rglob("resource.json"):
        try:
            existing = json.loads(resource_json.read_text(encoding="utf-8", errors="strict"))
        except Exception:
            continue
        if isinstance(existing, dict) and _resource_identity_key(existing) == key:
            return resource_json.parent
    return None


def _save_primary_resource_definition(resource: dict, *, resource_root: Path, now: datetime) -> None:
    rid = str(resource.get("id") or "").strip()
    if not rid:
        return

    storage = resource.get("storage")
    if not isinstance(storage, dict):
        storage = {}
        resource["storage"] = storage

    primary = _find_existing_primary_resource(resource_root, resource)
    if primary is None and not _has_resource_uri(resource):
        primary = _find_existing_primary_resource_by_id(resource_root, rid)
    should_write = True
    if primary is None:
        ts = _resource_timestamp(resource, now)
        primary = resource_root / ts.strftime("%Y") / ts.strftime("%m") / ts.strftime("%d") / rid
    elif primary.name != rid:
        # Same external/uploaded Resource already exists in the library under
        # another resource id. Reuse the storage path without overwriting the
        # canonical library definition with a note-local id.
        should_write = False

    primary.mkdir(parents=True, exist_ok=True)
    storage["primaryPath"] = str(primary)
    if not should_write:
        return

    resource_json = primary / "resource.json"
    if resource_json.is_file() and not _has_resource_uri(resource):
        try:
            existing_resource = json.loads(resource_json.read_text(encoding="utf-8", errors="strict"))
            if isinstance(existing_resource, dict) and _has_resource_uri(existing_resource):
                _merge_resource_uri_fields(resource, existing_resource)
        except Exception:
            pass
    resource_json.write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def _copy_resource_snapshot(resource: dict, *, base_root: Path, user_id: str, note_id: str, note_resource_dir: Path) -> None:
    storage = resource.get("storage")
    if not isinstance(storage, dict):
        return
    if storage.get("managed") is not True or storage.get("copyPolicy") != "snapshot":
        return

    rid = str(resource.get("id") or "").strip()
    if not rid:
        return

    primary = _resolve_storage_dir(str(storage.get("primaryPath") or ""), base_root=base_root, user_id=user_id, note_id=note_id)
    snapshot = _resolve_storage_dir(str(storage.get("snapshotPath") or ""), base_root=base_root, user_id=user_id, note_id=note_id)
    if snapshot is None:
        snapshot = note_resource_dir / rid
        storage["snapshotPath"] = snapshot.as_posix()

    snapshot.mkdir(parents=True, exist_ok=True)
    snapshot_files = []
    for item in storage.get("files") or []:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "original").strip() or "original"
        if role == "original":
            # The original uploaded file remains in data/{user}/upload/...
            # Keep the reference, but do not duplicate the body into the note snapshot.
            snapshot_files.append(dict(item))
            continue
        rel = str(item.get("path") or "").replace("\\", "/").strip("/")
        if not rel:
            continue
        source_path = str(item.get("sourcePath") or "").strip()
        src = Path(source_path) if source_path else (primary / rel if primary is not None else Path())
        if not src.is_file():
            debug_kv(snapshot_skip="file missing", resource_id=rid, src=str(src))
            snapshot_files.append(dict(item))
            continue
        dst = snapshot / _snapshot_filename(item, src)
        shutil.copy2(src, dst)
        snapshot_item = dict(item)
        snapshot_item["path"] = dst.name
        snapshot_item["sourcePath"] = str(dst)
        snapshot_files.append(snapshot_item)

    if snapshot_files:
        storage["files"] = snapshot_files
    storage["snapshotPath"] = snapshot.as_posix()

    resource_json = snapshot / "resource.json"
    resource_json.write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def _safe_bundle_filename(value: str, fallback: str) -> str:
    name = Path(str(value or "").replace("\\", "/")).name
    name = "".join(c for c in name if c not in "\r\n\t")
    return name or fallback


def _embedded_bundle_files(note_json: dict) -> list[dict]:
    for key in ("bundle", "portable", "resourceBundle"):
        bundle = note_json.get(key)
        if not isinstance(bundle, dict):
            continue
        files = bundle.get("files")
        if isinstance(files, list):
            return files
    return []


def _restore_embedded_resource_files(note_json: dict, *, resource_root: Path, upload_root: Path, note_resource_dir: Path, now: datetime) -> None:
    bundle_files = _embedded_bundle_files(note_json)
    if not bundle_files:
        return

    resources = note_json.get("resources") if isinstance(note_json.get("resources"), list) else []
    resource_by_id = {
        str(resource.get("id") or ""): resource
        for resource in resources
        if isinstance(resource, dict) and str(resource.get("id") or "")
    }

    for index, item in enumerate(bundle_files, start=1):
        if not isinstance(item, dict):
            continue
        rid = str(item.get("resourceId") or item.get("resource_id") or "").strip()
        resource = resource_by_id.get(rid)
        if not rid or resource is None:
            continue
        encoded = str(item.get("base64") or item.get("body") or "").strip()
        if not encoded:
            continue
        try:
            payload = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            debug_kv(bundle_skip="invalid base64", resource_id=rid)
            continue

        role = str(item.get("role") or "original").strip() or "original"
        bundle_path = str(item.get("path") or item.get("name") or "").replace("\\", "/").strip("/")
        source_filename = _safe_bundle_filename(bundle_path, f"{role}-{index}.bin")
        filename = _snapshot_filename({"role": role, "path": source_filename}, Path(source_filename))
        sha256 = hashlib.sha256(payload).hexdigest()
        mime_type = str(item.get("mimeType") or item.get("mime_type") or "application/octet-stream").strip()

        storage = resource.get("storage")
        if not isinstance(storage, dict):
            storage = {}
            resource["storage"] = storage
        ts = _resource_timestamp(resource, now)
        primary = _find_existing_primary_resource(resource_root, resource)
        if primary is None:
            primary = _find_existing_primary_resource_by_id(resource_root, rid)
        if primary is None:
            primary = resource_root / ts.strftime("%Y") / ts.strftime("%m") / ts.strftime("%d") / rid
        snapshot = note_resource_dir / rid

        primary.mkdir(parents=True, exist_ok=True)
        snapshot.mkdir(parents=True, exist_ok=True)
        if bundle_path.startswith("upload/"):
            stored_rel = bundle_path[len("upload/"):].strip("/")
            dest_file = upload_root / stored_rel
            storage_path = stored_rel
            storage_source = str(dest_file)
        elif bundle_path.startswith("note/resource/"):
            note_rel = bundle_path[len("note/resource/"):].strip("/")
            parts = note_rel.split("/", 1)
            stored_rel = parts[1] if len(parts) == 2 and parts[0] == rid else note_rel
            dest_file = snapshot / stored_rel
            storage_path = Path(stored_rel).name
            storage_source = str(dest_file)
        elif role == "original":
            stored_rel = bundle_path or f"{ts:%Y/%m/%d}/{rid}/{filename}"
            dest_file = upload_root / stored_rel
            storage_path = stored_rel
            storage_source = str(dest_file)
        else:
            storage_path = filename
            dest_file = snapshot / storage_path
            storage_source = str(dest_file)
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        dest_file.write_bytes(payload)

        storage["managed"] = True
        storage["copyPolicy"] = "snapshot"
        storage["primaryPath"] = str(primary)
        storage["snapshotPath"] = str(snapshot)
        if role == "original":
            storage["sourcePath"] = storage_path
        files = storage.get("files")
        if not isinstance(files, list):
            files = []
            storage["files"] = files
        files = [f for f in files if not (isinstance(f, dict) and str(f.get("role") or "") == role)]
        files.append({
            "role": role,
            "path": storage_path,
            "sourcePath": storage_source,
            "mimeType": mime_type,
            "size": len(payload),
            "sha256": sha256,
        })
        storage["files"] = files

        (primary / "resource.json").write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        (snapshot / "resource.json").write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    note_json.pop("portable", None)
    note_json.pop("resourceBundle", None)
    note_json.pop("bundle", None)


def main():
    debug("script begin")
    params = merge_query_and_body_params()
    debug_kv(params=params)

    session_user_id = get_session_user_id()
    try:
        user_id = validate_simple_id(params.get("user_id", "") or "", "USER_ID")
        note_id = validate_simple_id(params.get("id", "") or "", "NOTE_ID")
    except ValueError as e:
        debug_kv(validation_error=str(e))
        script_error(f"ERROR {e}")

    if not session_user_id or user_id != session_user_id:
        debug_kv(error="NOT LOGGED IN", session_user_id=session_user_id, user_id=user_id)
        script_error("ERROR NOT LOGGED IN")

    note_root = environment_path("note", user_id)
    if not note_root:
        debug("ERROR NOTE DIRECTORY NOT DEFINED")
        script_error("ERROR NOTE DIRECTORY NOT DEFINED")
    resource_root = environment_path("resource", user_id)
    if not resource_root:
        debug("ERROR RESOURCE DIRECTORY NOT DEFINED")
        script_error("ERROR RESOURCE DIRECTORY NOT DEFINED")
    upload_root = environment_path("upload", user_id)
    if not upload_root:
        debug("ERROR UPLOAD DIRECTORY NOT DEFINED")
        script_error("ERROR UPLOAD DIRECTORY NOT DEFINED")

    now = datetime.now().astimezone()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")
    saved_at = now.strftime("%Y-%m-%dT%H:%M:%S%z")

    note_dir = Path(note_root) / year / month / day / note_id
    note_resource_dir = note_dir / "resource"
    note_dir.mkdir(parents=True, exist_ok=True)

    name = _single_line_meta(params.get("name", "") or "")
    description = _single_line_meta(params.get("description", "") or "")
    thumbnail = _single_line_meta(params.get("thumbnail", "") or "")

    try:
        note_json = _ensure_note_json(params.get("json", "") or "")
    except ValueError as e:
        debug_kv(json_error=str(e))
        script_error(f"ERROR {e}")

    base_root = Path(note_root).parent
    resource_root_path = Path(resource_root)
    upload_root_path = Path(upload_root)
    note_json["note_id"] = note_json.get("note_id") or note_id
    note_json["resources"] = note_json.get("resources") or []

    try:
        _restore_embedded_resource_files(
            note_json,
            resource_root=resource_root_path,
            upload_root=upload_root_path,
            note_resource_dir=note_resource_dir,
            now=now,
        )
        for resource in note_json.get("resources") or []:
            if isinstance(resource, dict):
                _save_primary_resource_definition(resource, resource_root=resource_root_path, now=now)
                _promote_local_resource_snapshot(resource)
                _save_primary_resource_definition(resource, resource_root=resource_root_path, now=now)
                _copy_resource_snapshot(
                    resource,
                    base_root=base_root,
                    user_id=user_id,
                    note_id=note_id,
                    note_resource_dir=note_resource_dir,
                )
    except Exception as e:
        debug_kv(snapshot_error=str(e))
        script_error("ERROR RESOURCE SNAPSHOT FAILED")

    json_text = json.dumps(note_json, ensure_ascii=False, separators=(",", ":"))

    json_base64 = base64.b64encode(json_text.encode("utf-8")).decode("ascii")
    if not json_base64:
        debug("ERROR JSON ENCODE FAILED")
        script_error("ERROR JSON ENCODE FAILED")

    outfile = note_dir / "note.json"
    debug_kv(outfile=str(outfile), year=year, month=month, day=day, saved_at=saved_at)

    try:
        with outfile.open("w", encoding="utf-8", newline="\n") as f:
            f.write("format_version 2\n")
            f.write(f"id {note_id}\n")
            f.write(f"user_id {user_id}\n")
            f.write(f"name {name}\n")
            f.write(f"description {description}\n")
            f.write(f"thumbnail {thumbnail}\n")
            f.write(f"saved_at {saved_at}\n")
            f.write("json_encoding base64\n")
            f.write(f"json_base64 {json_base64}\n")
    except Exception as e:
        debug_kv(save_error=str(e), outfile=str(outfile))
        script_error("ERROR SAVE FAILED")

    debug_kv(saved_note_id=note_id, response_name=name)
    # shell 版互換: note name を応答
    text_response(name)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        debug("script end by SystemExit")
        raise
    except Exception:
        debug_exception()
        raise
