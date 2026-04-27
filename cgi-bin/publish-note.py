#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import base64
import json
import shutil
from datetime import datetime
from pathlib import Path

from cgi_common import (
    environment_path,
    merge_query_and_body_params,
    resolve_note_file,
    script_error,
    text_response,
    validate_simple_id,
)


def _single_line_meta(value: str) -> str:
    return " ".join((value or "").replace("\r", " ").replace("\n", " ").replace("\t", " ").split())


def _ensure_note_json(value: str) -> str:
    text = (value or "").lstrip("\ufeff").strip()
    if not text:
        raise ValueError("JSON NOT SPECIFIED")
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("NOTE JSON MUST BE OBJECT")
    if "pages" not in data or not isinstance(data.get("pages"), dict):
        raise ValueError("NOTE JSON PAGES MUST BE OBJECT")
    if "resources" in data and not isinstance(data.get("resources"), list):
        raise ValueError("NOTE JSON RESOURCES MUST BE ARRAY")
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def main():
    params = merge_query_and_body_params()

    try:
        user_id = validate_simple_id(params.get("user_id", ""), "USER_ID")
        note_id = validate_simple_id(params.get("id", ""), "NOTE_ID")
    except ValueError as e:
        script_error(f"ERROR {e}")

    note_dir = environment_path("note", user_id)
    public_root = environment_path("public")
    if not note_dir:
        script_error("500 Internal Server Error\nFAILED TO READ NOTE DIRECTORY")
    if not public_root:
        script_error("500 Internal Server Error\nFAILED TO READ PUBLIC DIRECTORY")

    now = datetime.now().astimezone()
    year = now.strftime("%Y")
    month = now.strftime("%m")

    public_dir = Path(public_root) / year / month
    public_dir.mkdir(parents=True, exist_ok=True)
    public_note = public_dir / note_id

    json_text = params.get("json", "") or ""
    if json_text:
        try:
            json_text = _ensure_note_json(json_text)
        except Exception as e:
            script_error(f"ERROR {e}")

        json_base64 = base64.b64encode(json_text.encode("utf-8")).decode("ascii")
        saved_at = now.strftime("%Y-%m-%dT%H:%M:%S%z")
        name = _single_line_meta(params.get("name", "") or "")
        description = _single_line_meta(params.get("description", "") or "")
        thumbnail = _single_line_meta(params.get("thumbnail", "") or "")

        try:
            with public_note.open("w", encoding="utf-8", newline="\n") as f:
                f.write("format_version 2\n")
                f.write(f"id {note_id}\n")
                f.write(f"user_id {user_id}\n")
                f.write(f"name {name}\n")
                f.write(f"description {description}\n")
                f.write(f"thumbnail {thumbnail}\n")
                f.write(f"saved_at {saved_at}\n")
                f.write("json_encoding base64\n")
                f.write(f"json_base64 {json_base64}\n")
        except Exception:
            script_error("500 Internal Server Error\nERROR WHILE PUBLISHING NOTE")

        text_response(f"{year}/{month}/{note_id}")

    note_path = resolve_note_file(Path(note_dir), note_id)
    if not note_path.exists():
        script_error(f"500 Internal Server Error\nNOTE NOT FOUND: {note_id}")

    try:
        shutil.copy2(note_path, public_note)
    except Exception:
        script_error("500 Internal Server Error\nERROR WHILE PUBLISHING NOTE")

    text_response(f"{year}/{month}/{note_id}")


if __name__ == "__main__":
    main()
