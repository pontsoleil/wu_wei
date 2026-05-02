#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import shutil
from datetime import datetime
from pathlib import Path

from cgi_common import (
    environment_path,
    get_effective_user_id,
    merge_query_and_body_params,
    resolve_note_file,
    script_error,
    text_response,
    trim,
)


def main():
    params = merge_query_and_body_params()
    effective_user_id = get_effective_user_id()
    req_user_id = trim(params.get("user_id", ""))
    user_id = req_user_id or effective_user_id
    note_id = trim(params.get("id", ""))

    if not effective_user_id or not user_id or user_id.startswith("ERROR"):
        script_error("ERROR NOT LOGGED IN")
    if req_user_id and req_user_id != effective_user_id:
        script_error("ERROR USER MISMATCH")

    note_dir = environment_path("note", user_id)
    trash_root = environment_path("trash", user_id)
    if not note_dir or not trash_root:
        script_error("500 Internal Server Error\nERROR DIRECTORY NOT DEFINED")

    note_file = resolve_note_file(Path(note_dir), note_id)
    note_path = note_file.parent if note_file.name == "note.txt" else note_file

    if not note_file.exists():
        script_error("ERROR NOTE NOT FOUND")

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
