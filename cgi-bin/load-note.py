#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
import base64
import hashlib
import json
import mimetypes
import sys

from pathlib import Path

from cgi_common import (
    ENV_FILE,
    PUBLIC_USER_IDS,
    debug,
    debug_exception,
    debug_kv,
    environment_path,
    get_session_user_id,
    decode_note_json,
    emit_headers,
    merge_query_and_body_params,
    read_note_meta,
    resolve_note_file,
    script_error,
)


def _portable_resource_files(note_json: dict, note_file: Path) -> list[dict]:
    note_dir = note_file.parent if note_file.name == "note.json" else note_file.parent
    snapshot_root = note_dir / "resource"
    upload_root = None
    for parent in note_file.parents:
        if parent.name == "note":
            upload_root = parent.parent / "upload"
            break

    files: list[dict] = []
    resources = note_json.get("resources") if isinstance(note_json.get("resources"), list) else []
    for resource in resources:
        if not isinstance(resource, dict):
            continue
        resource_id = str(resource.get("id") or "").strip()
        if not resource_id:
            continue
        resource_dir = snapshot_root / resource_id
        try:
            resource_doc = json.loads((resource_dir / "resource.json").read_text(encoding="utf-8", errors="strict"))
        except Exception:
            resource_doc = resource
        storage = resource_doc.get("storage") if isinstance(resource_doc.get("storage"), dict) else {}
        storage_files = storage.get("files") if isinstance(storage.get("files"), list) else []
        for item in storage_files:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role") or "original").strip() or "original"
            rel = str(item.get("path") or "").replace("\\", "/").strip("/")
            source_path = str(item.get("sourcePath") or "").strip()
            if role == "original":
                if not rel:
                    continue
                bundle_path = rel if rel.startswith("upload/") else f"upload/{rel}"
                if source_path:
                    path = Path(source_path)
                elif upload_root is not None:
                    path = upload_root / (rel[7:] if rel.startswith("upload/") else rel)
                else:
                    continue
            elif role in {"thumbnail", "preview"}:
                name = Path(rel).name or ("preview.pdf" if role == "preview" else "thumbnail")
                bundle_path = f"note/resource/{resource_id}/{name}"
                path = Path(source_path) if source_path else resource_dir / name
            else:
                continue
            if not path.is_file():
                continue
            payload = path.read_bytes()
            mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            files.append({
                "resourceId": resource_id,
                "role": role,
                "path": bundle_path,
                "mimeType": mime_type,
                "size": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "base64": base64.b64encode(payload).decode("ascii"),
            })
    return files


def _with_portable_bundle(json_text: str, note_file: Path) -> str:
    note_json = json.loads(json_text)
    if not isinstance(note_json, dict):
        return json_text
    files = _portable_resource_files(note_json, note_file)
    note_json["bundle"] = {
        "type": "wuwei.note.bundle",
        "version": 1,
        "files": files,
    }
    return json.dumps(note_json, ensure_ascii=False, indent=2)


def main():
    debug("script begin")
    params = merge_query_and_body_params()
    debug_kv(params=params)

    session_user_id = get_session_user_id()
    user_id = (params.get("user_id", "") or "").strip()
    note_id = (params.get("id", "") or "").strip()
    debug_kv(session_user_id=session_user_id, user_id=user_id, note_id=note_id)

    if not note_id:
        debug("ERROR ID NOT SPECIFIED")
        script_error("ERROR ID NOT SPECIFIED")

    if user_id in PUBLIC_USER_IDS:
        note_dir = environment_path("public")
        debug_kv(mode="public", note_dir=note_dir)
    else:
        if not session_user_id or not user_id or user_id != session_user_id:
            debug("ERROR NOT LOGGED IN")
            script_error("ERROR NOT LOGGED IN")
        note_dir = environment_path("note", user_id)
        debug_kv(mode="private", note_dir=note_dir)

        if not note_dir or not Path(note_dir).exists():
            debug("ERROR NOTE DIRECTORY NOT FOUND")
            script_error("ERROR NOTE DIRECTORY NOT FOUND")

    file_path = resolve_note_file(Path(note_dir), note_id)
    debug_kv(file_path=str(file_path))

    if not file_path.exists():
        debug("ERROR NOTE FILE NOT FOUND")
        script_error("ERROR NOTE FILE NOT FOUND")

    meta = read_note_meta(file_path)
    debug_kv(
        meta_id=meta.get("id"),
        meta_user_id=meta.get("user_id"),
        meta_name=meta.get("name"),
        meta_saved_at=meta.get("saved_at"),
    )

    try:
        json_text = decode_note_json(meta)
        if str(params.get("bundle") or params.get("portable") or "") in {"1", "true", "yes", "on"}:
            json_text = _with_portable_bundle(json_text, file_path)
        debug_kv(json_length=len(json_text))
    except ValueError as e:
        debug_kv(decode_error=str(e))
        script_error(f"ERROR {e}")
    except Exception as e:
        debug_kv(bundle_error=str(e))
        script_error("ERROR NOTE BUNDLE FAILED")

    emit_headers("application/json; charset=UTF-8")
    sys.stdout.flush()
    sys.stdout.buffer.write(json_text.encode("utf-8"))
    sys.stdout.buffer.flush()
    debug("response emitted")

if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        debug("script end by SystemExit")
        raise
    except Exception:
        debug_exception()
        raise
