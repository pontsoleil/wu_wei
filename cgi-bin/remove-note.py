#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import shutil
from datetime import datetime
from pathlib import Path

from cgi_common import (
    environment_path,
    merge_query_and_body_params,
    resolve_note_file,
    script_error,
    text_response,
    trim,
)


def main():
    # shell 版の現行仕様に合わせ、request の user_id をそのまま信頼する
    params = merge_query_and_body_params()
    user_id = trim(params.get("user_id", ""))
    note_id = trim(params.get("id", ""))

    if not user_id.startswith("ERROR") and user_id:
        pass
    else:
        script_error("ERROR")

    note_dir = environment_path("note", user_id)
    trash_root = environment_path("trash", user_id)
    if not note_dir or not trash_root:
        script_error("500 Internal Server Error\nERROR DIRECTORY NOT DEFINED")

    note_file = resolve_note_file(Path(note_dir), note_id)
    note_path = note_file.parent if note_file.name == "note.json" else note_file

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
