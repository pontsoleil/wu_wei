#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Load an app ver1 WuWei note.

This script returns only the decoded JSON body contained in the ver1 note
file.  It does not migrate the model.  Browser-side migration is handled by
wuwei.note.v1.js.
"""

from __future__ import annotations

import sys
from pathlib import Path

from cgi_common import (
    PUBLIC_USER_IDS,
    debug,
    debug_exception,
    debug_kv,
    decode_ver1_note_file,
    emit_headers,
    environment_path,
    get_effective_user_id,
    get_session_user_id,
    list_ver1_note_files,
    merge_query_and_body_params,
    read_ver1_note_meta,
    script_error,
    trim,
)


def normalise_note_key(value: object) -> str:
    key = trim(value or "").replace("\\", "/")
    key = key.split("?", 1)[0].split("#", 1)[0].strip().strip("/")
    if not key or key.startswith("../") or "/../" in f"/{key}/" or key == "..":
        return ""
    if key.endswith("/note.json"):
        return ""
    return key


def is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.resolve(strict=False).relative_to(root.resolve(strict=False))
        return True
    except ValueError:
        return False


def unique_paths(paths: list[Path]) -> list[Path]:
    seen = set()
    out: list[Path] = []
    for path in paths:
        key = str(path.resolve(strict=False)).lower()
        if key not in seen:
            seen.add(key)
            out.append(path)
    return out


def note_file_from_key(root: Path, note_key: str, note_id: str) -> Path | None:
    if not note_key:
        return None
    candidate = root / note_key
    if not is_relative_to(candidate, root):
        script_error("ERROR INVALID NOTE KEY")
    if not candidate.is_file() or candidate.name == "note.json":
        return None
    if note_id and candidate.name != note_id:
        meta = read_ver1_note_meta(candidate)
        if trim(meta.get("id", "")) != note_id:
            script_error("ERROR NOTE KEY MISMATCH")
    return candidate


def note_candidates_by_id(root: Path, note_id: str) -> list[Path]:
    if not note_id:
        return []
    candidates: list[Path] = []
    direct = root / note_id
    if direct.is_file() and direct.name != "note.json":
        candidates.append(direct)
    for path in list_ver1_note_files(root, include_new_note=True):
        if path.name == note_id:
            candidates.append(path)
            continue
        try:
            meta = read_ver1_note_meta(path)
        except Exception:
            meta = {}
        if trim(meta.get("id", "")) == note_id:
            candidates.append(path)
    return unique_paths(candidates)


def split_id_and_key(raw_id: str, raw_key: str) -> tuple[str, str]:
    note_id = trim(raw_id)
    note_key = normalise_note_key(raw_key)
    if not note_key and "/" in note_id:
        note_key = normalise_note_key(note_id)
        parts = [part for part in note_key.split("/") if part]
        note_id = parts[-1] if parts else ""
    return note_id, note_key


def resolve_selected_v1_note_file(root: Path, note_id: str, note_key: str) -> Path:
    selected = note_file_from_key(root, note_key, note_id)
    if selected:
        return selected
    candidates = note_candidates_by_id(root, note_id)
    if len(candidates) > 1:
        script_error("ERROR NOTE ID NOT UNIQUE")
    if len(candidates) == 1:
        return candidates[0]
    return root / note_key if note_key else root / note_id


def main() -> None:
    debug("script begin", name="load-note-v1")
    params = merge_query_and_body_params()
    debug_kv(name="load-note-v1", params=params)

    session_user_id = get_session_user_id()
    effective_user_id = get_effective_user_id()
    user_id = trim(params.get("user_id", ""))
    note_id, note_key = split_id_and_key(
        params.get("id", ""),
        params.get("note_key", "") or params.get("key", "") or params.get("dir", "") or params.get("path", ""),
    )

    if not note_id and not note_key:
        script_error("ERROR NOTE NOT SPECIFIED")

    if user_id in PUBLIC_USER_IDS:
        note_dir = environment_path("public")
    else:
        user_id = user_id or effective_user_id
        if not effective_user_id or not user_id or user_id != effective_user_id:
            script_error("ERROR NOT LOGGED IN")
        note_dir = environment_path("note", user_id)

    if not note_dir or not Path(note_dir).exists():
        script_error("ERROR NOTE DIRECTORY NOT FOUND")

    root = Path(note_dir)
    file_path = resolve_selected_v1_note_file(root, note_id, note_key)
    debug_kv(name="load-note-v1", file_path=str(file_path))

    if not file_path.exists() or not file_path.is_file():
        script_error("ERROR VER1 NOTE FILE NOT FOUND")
    if file_path.name == "note.json":
        script_error("ERROR NOT VER1 NOTE")
    if not is_relative_to(file_path, root):
        script_error("ERROR INVALID NOTE PATH")

    try:
        json_text = decode_ver1_note_file(file_path)
    except ValueError as e:
        script_error(f"ERROR {e}")

    emit_headers("application/json; charset=UTF-8")
    sys.stdout.flush()
    sys.stdout.buffer.write(json_text.encode("utf-8"))
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        debug_exception(name="load-note-v1")
        raise
