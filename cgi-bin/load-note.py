#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
import sys
from pathlib import Path

from cgi_common import (
    PUBLIC_USER_IDS,
    debug,
    debug_exception,
    debug_kv,
    environment_path,
    get_effective_user_id,
    get_session_user_id,
    decode_note_json,
    emit_headers,
    merge_query_and_body_params,
    read_note_meta,
    resolve_note_file,
    script_error,
)


def main():
    debug("script begin")
    params = merge_query_and_body_params()
    debug_kv(params=params)

    session_user_id = get_session_user_id()
    effective_user_id = get_effective_user_id()
    user_id = (params.get("user_id", "") or "").strip()
    note_id = (params.get("id", "") or "").strip()
    debug_kv(session_user_id=session_user_id, effective_user_id=effective_user_id, user_id=user_id, note_id=note_id)

    if not note_id:
        debug("ERROR ID NOT SPECIFIED")
        script_error("ERROR ID NOT SPECIFIED")

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
