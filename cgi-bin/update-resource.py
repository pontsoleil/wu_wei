#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

from __future__ import annotations

import base64
import json
import re
from datetime import datetime
from pathlib import Path

from cgi_common import (
    debug_exception,
    debug_kv,
    environment_path,
    get_effective_user_id,
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
    return [
        str(resource.get("uri") or "").strip(),
        str(resource.get("canonicalUri") or "").strip(),
    ]


def has_resource_uri(resource: dict) -> bool:
    return any(resource_uri_values(resource))


def merge_resource_uri_fields(resource: dict, existing: dict) -> None:
    for key in ("uri", "canonicalUri"):
        if not str(resource.get(key) or "").strip() and existing.get(key):
            resource[key] = existing.get(key)


def resource_timestamp(resource: dict) -> datetime:
    audit = resource.get("audit") if isinstance(resource.get("audit"), dict) else {}
    for key in ("createdAt", "lastModifiedAt"):
        value = str(audit.get(key) or "").strip()
        if not value:
            continue
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone()
        except Exception:
            continue
    return datetime.now().astimezone()


def create_resource_json(root: Path, resource: dict, resource_id: str) -> Path:
    ts = resource_timestamp(resource)
    path = root / ts.strftime("%Y") / ts.strftime("%m") / ts.strftime("%d") / resource_id / "resource.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def main():
    params = merge_query_and_body_params()
    session_user_id = get_session_user_id()
    effective_user_id = get_effective_user_id()
    req_user_id = (params.get("user_id", "") or "").strip()
    resource_id = (params.get("id", "") or "").strip()
    debug_kv(params={k: ("..." if k == "resource_json_base64" else v) for k, v in params.items()}, session_user_id=session_user_id, effective_user_id=effective_user_id)

    if not effective_user_id:
        script_error("ERROR NOT LOGGED IN")
    if req_user_id and req_user_id != effective_user_id:
        script_error("ERROR USER MISMATCH")
    if not resource_id or not SAFE_ID_RE.match(resource_id):
        script_error("ERROR INVALID RESOURCE ID")

    resource = decode_resource(params)
    if str(resource.get("id") or "") != resource_id:
        script_error("ERROR RESOURCE ID MISMATCH")

    root = Path(environment_path("resource", effective_user_id))
    path = find_resource_json(root, resource_id)
    if not path:
        if not has_resource_uri(resource):
            script_error("ERROR RESOURCE NOT FOUND")
        path = create_resource_json(root, resource, resource_id)

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
