#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import shutil
from datetime import datetime
from pathlib import Path

from cgi_common import (
    environment_path,
    get_effective_user_id,
    list_note_files,
    merge_query_and_body_params,
    read_note_meta,
    resolve_note_file,
    script_error,
    text_response,
    trim,
)


def normalise_note_key(value: object) -> str:
    """Return a storage-relative note key such as YYYY/MM/DD/<note-id>."""
    key = trim(value or "").replace("\\", "/")
    key = key.split("?", 1)[0].split("#", 1)[0].strip().strip("/")
    if not key or key.startswith("../") or "/../" in f"/{key}/" or key == "..":
        return ""
    if key.endswith("/note.json"):
        key = key[:-len("/note.json")]
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
        # The directory name is the canonical note identifier in the current
        # storage layout.  Refuse a mismatching request rather than deleting a
        # different note from the selected list row.
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
        # Keep compatibility with older cgi_common.py.  The final fallback below
        # still handles older flat layouts, but it must not silently choose one
        # item when multiple dated directories are visible.
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


def main():
    params = merge_query_and_body_params()
    effective_user_id = get_effective_user_id()
    req_user_id = trim(params.get("user_id", ""))
    user_id = req_user_id or effective_user_id
    note_id = trim(params.get("id", ""))
    note_key = normalise_note_key(
        params.get("note_key", "") or
        params.get("dir", "") or
        params.get("path", "")
    )

    if not effective_user_id or not user_id or user_id.startswith("ERROR"):
        script_error("ERROR NOT LOGGED IN")
    if req_user_id and req_user_id != effective_user_id:
        script_error("ERROR USER MISMATCH")
    if not note_id and not note_key:
        script_error("ERROR NOTE NOT SPECIFIED")

    note_dir = environment_path("note", user_id)
    trash_root = environment_path("trash", user_id)
    if not note_dir or not trash_root:
        script_error("500 Internal Server Error\nERROR DIRECTORY NOT DEFINED")

    root = Path(note_dir)
    note_file = resolve_selected_note_file(root, note_id, note_key)
    note_path = note_file.parent if note_file.name == "note.json" else note_file

    if not note_file.exists():
        script_error("ERROR NOTE NOT FOUND")
    if not is_relative_to(note_path, root):
        script_error("ERROR INVALID NOTE PATH")

    now = datetime.now().astimezone()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    trash_dir = Path(trash_root) / year / month
    trash_dir.mkdir(parents=True, exist_ok=True)

    try:
        dest = trash_dir / note_path.name
        if dest.exists():
            dest = trash_dir / f"{note_path.name}-{now.strftime('%Y%m%d%H%M%S')}"
        shutil.move(str(note_path), str(dest))
    except Exception:
        script_error("500 Internal Server Error\nERROR WHILE REMOVING NOTE")

    text_response("SUCCESS NOTE REMOVED")


if __name__ == "__main__":
    main()
