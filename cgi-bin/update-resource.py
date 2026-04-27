#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

from __future__ import annotations

import base64
import json
import re
from pathlib import Path

from cgi_common import (
    debug_exception,
    debug_kv,
    environment_path,
    get_session_user_id,
    json_response,
    merge_query_and_body_params,
    script_error,
)


SAFE_ID_RE = re.compile(r"^_?[0-9A-Za-z][0-9A-Za-z_.-]*$")


def decode_resource(params: dict) -> dict:
    encoded = params.get("resource_json_base64") or ""
    if encoded:
      normalized = encoded.strip().replace(" ", "+")
      padding = "=" * (-len(normalized) % 4)
      try:
          text = base64.b64decode((normalized + padding).encode("ascii"), validate=True).decode("utf-8")
      except Exception:
          text = base64.urlsafe_b64decode((normalized + padding).encode("ascii")).decode("utf-8")
    else:
      text = params.get("resource") or ""
    data = json.loads(text)
    if not isinstance(data, dict):
        script_error("ERROR INVALID RESOURCE")
    return data


def find_resource_json(root: Path, resource_id: str) -> Path | None:
    for path in root.rglob("resource.json"):
        if not path.is_file():
            continue
        if path.parent.name == resource_id:
            return path
        try:
            data = json.loads(path.read_text(encoding="utf-8", errors="strict"))
        except Exception:
            continue
        if isinstance(data, dict) and str(data.get("id") or "") == resource_id:
            return path
    return None


def resource_uri_values(resource: dict) -> list[str]:
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


def has_resource_uri(resource: dict) -> bool:
    return any(resource_uri_values(resource))


def merge_resource_uri_fields(resource: dict, existing: dict) -> None:
    identity = resource.setdefault("identity", {})
    if not isinstance(identity, dict):
        identity = {}
        resource["identity"] = identity
    existing_identity = existing.get("identity") if isinstance(existing.get("identity"), dict) else {}
    for key in ("uri", "canonicalUri"):
        if not str(identity.get(key) or "").strip() and existing_identity.get(key):
            identity[key] = existing_identity.get(key)

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


def main():
    params = merge_query_and_body_params()
    session_user_id = get_session_user_id()
    req_user_id = (params.get("user_id", "") or "").strip()
    resource_id = (params.get("id", "") or "").strip()
    debug_kv(params={k: ("..." if k == "resource_json_base64" else v) for k, v in params.items()}, session_user_id=session_user_id)

    if not session_user_id:
        script_error("ERROR NOT LOGGED IN")
    if req_user_id and req_user_id != session_user_id:
        script_error("ERROR USER MISMATCH")
    if not resource_id or not SAFE_ID_RE.match(resource_id):
        script_error("ERROR INVALID RESOURCE ID")

    resource = decode_resource(params)
    if str(resource.get("id") or "") != resource_id:
        script_error("ERROR RESOURCE ID MISMATCH")

    root = Path(environment_path("resource", session_user_id))
    path = find_resource_json(root, resource_id)
    if not path:
        script_error("ERROR RESOURCE NOT FOUND")

    if not has_resource_uri(resource):
        try:
            existing = json.loads(path.read_text(encoding="utf-8", errors="strict"))
            if isinstance(existing, dict) and has_resource_uri(existing):
                merge_resource_uri_fields(resource, existing)
        except Exception:
            pass

    path.write_text(
        json.dumps(resource, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    json_response({"type": "success", "message": "Saved", "id": resource_id})


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        debug_exception()
        raise
