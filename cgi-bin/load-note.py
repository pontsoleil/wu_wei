#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Load a WuWei note.

The list-note response contains note_key, for example
YYYY/MM/DD/<note-id>.  Use that key first because note id alone can be
duplicated across dated directories.
"""

import sys
from pathlib import Path

from cgi_common import (
    PUBLIC_USER_IDS,
    debug,
    debug_exception,
    debug_kv,
    decode_note_json,
    emit_headers,
    environment_path,
    get_effective_user_id,
    get_session_user_id,
    list_note_files,
    merge_query_and_body_params,
    read_note_meta,
    resolve_note_file,
    script_error,
    trim,
)


def normalise_note_key(value: object) -> str:
    """Return a storage-relative note key such as YYYY/MM/DD/<note-id>."""
    key = trim(value or "").replace("\\", "/")
    key = key.split("?", 1)[0].split("#", 1)[0].strip().strip("/")
    if not key or key.startswith("../") or "/../" in f"/{key}/" or key == "..":
        return ""
    if key.endswith("/note.json"):
        key = key[: -len("/note.json")]
    return key


def is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.resolve(strict=False).relative_to(root.resolve(strict=False))
        return True
    except ValueError:
        return False


def unique_paths(paths: list[Path]) -> list[Path]:
    seen = set()
    out = []
    for path in paths:
        key = str(path.resolve(strict=False)).lower()
        if key not in seen:
            seen.add(key)
            out.append(path)
    return out


def note_file_from_key(root: Path, note_key: str, note_id: str) -> Path | None:
    """Resolve the exact note file selected in list-note.py."""
    if not note_key:
        return None

    candidate_dir = root / note_key
    candidate_file = candidate_dir if candidate_dir.name == "note.json" else candidate_dir / "note.json"

    if not is_relative_to(candidate_file, root):
        script_error("ERROR INVALID NOTE KEY")

    if not candidate_file.exists():
        return None

    if note_id and candidate_file.parent.name != note_id:
        meta = read_note_meta(candidate_file)
        meta_id = trim(meta.get("id", ""))
        if meta_id != note_id:
            script_error("ERROR NOTE KEY MISMATCH")

    return candidate_file


def note_candidates_by_id(root: Path, note_id: str) -> list[Path]:
    """Find all matching notes for the id-only fallback path."""
    if not note_id:
        return []

    candidates: list[Path] = []

    direct = root / note_id / "note.json"
    if direct.exists():
        candidates.append(direct)

    direct_file = root / note_id
    if direct_file.exists() and direct_file.is_file():
        candidates.append(direct_file)

    try:
        for path in list_note_files(root, include_new_note=True):
            note_file = path if path.name == "note.json" else path / "note.json"
            if not note_file.exists():
                continue
            if note_file.parent.name == note_id:
                candidates.append(note_file)
                continue
            try:
                meta = read_note_meta(note_file)
            except Exception:
                meta = {}
            if trim(meta.get("id", "")) == note_id:
                candidates.append(note_file)
    except Exception:
        pass

    return unique_paths(candidates)


def resolve_selected_note_file(root: Path, note_id: str, note_key: str) -> Path:
    """Resolve a note.json safely.

    Priority:
    1. Exact note_key/dir returned by list-note.py.
    2. Id-only lookup, but only when it resolves to exactly one note.
    3. Legacy resolve_note_file fallback for older local layouts.
    """
    note_file = note_file_from_key(root, note_key, note_id)
    if note_file:
        return note_file

    candidates = note_candidates_by_id(root, note_id)
    if len(candidates) > 1:
        script_error("ERROR NOTE ID NOT UNIQUE")
    if len(candidates) == 1:
        return candidates[0]

    legacy = resolve_note_file(root, note_id)
    if legacy.name != "note.json" and legacy.is_dir():
        legacy = legacy / "note.json"
    return legacy


def split_id_and_key(raw_id: str, raw_key: str) -> tuple[str, str]:
    note_id = trim(raw_id)
    note_key = normalise_note_key(raw_key)

    # Backward compatibility: a caller may pass the dated path in id.
    if not note_key and "/" in note_id:
        note_key = normalise_note_key(note_id)
        parts = [part for part in note_key.split("/") if part]
        note_id = parts[-1] if parts else ""
        if note_id == "note.json" and len(parts) >= 2:
            note_id = parts[-2]

    return note_id, note_key


def main():
    debug("script begin")
    params = merge_query_and_body_params()
    debug_kv(params=params)

    session_user_id = get_session_user_id()
    effective_user_id = get_effective_user_id()
    user_id = trim(params.get("user_id", ""))
    note_id, note_key = split_id_and_key(
        params.get("id", ""),
        params.get("note_key", "") or params.get("key", "") or params.get("dir", "") or params.get("path", ""),
    )
    debug_kv(
        session_user_id=session_user_id,
        effective_user_id=effective_user_id,
        user_id=user_id,
        note_id=note_id,
        note_key=note_key,
    )

    if not note_id and not note_key:
        debug("ERROR NOTE NOT SPECIFIED")
        script_error("ERROR NOTE NOT SPECIFIED")

    if user_id in PUBLIC_USER_IDS:
        note_dir = environment_path("public")
        debug_kv(mode="public", note_dir=note_dir)
    else:
        user_id = user_id or effective_user_id
        if not effective_user_id or not user_id or user_id != effective_user_id:
            debug("ERROR NOT LOGGED IN")
            script_error("ERROR NOT LOGGED IN")
        note_dir = environment_path("note", user_id)
        debug_kv(mode="private", note_dir=note_dir)

    if not note_dir or not Path(note_dir).exists():
        debug("ERROR NOTE DIRECTORY NOT FOUND")
        script_error("ERROR NOTE DIRECTORY NOT FOUND")

    file_path = resolve_selected_note_file(Path(note_dir), note_id, note_key)
    debug_kv(file_path=str(file_path))

    if not file_path.exists():
        debug("ERROR NOTE FILE NOT FOUND")
        script_error("ERROR NOTE FILE NOT FOUND")
    if not is_relative_to(file_path, Path(note_dir)):
        debug("ERROR INVALID NOTE PATH")
        script_error("ERROR INVALID NOTE PATH")

    meta = read_note_meta(file_path)
    debug_kv(
        meta_id=meta.get("id"),
        meta_user_id=meta.get("user_id"),
        meta_name=meta.get("name"),
        meta_saved_at=meta.get("saved_at"),
    )

    try:
        json_text = decode_note_json(meta)
        debug_kv(json_length=len(json_text))
    except ValueError as e:
        debug_kv(decode_error=str(e))
        script_error(f"ERROR {e}")

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
