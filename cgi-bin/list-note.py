#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

from pathlib import Path

from cgi_common import (
    ENV_FILE,
    PUBLIC_USER_IDS,
    collect_note_record,
    debug,
    debug_exception,
    debug_kv,
    environment_path,
    get_session_user_id,
    json_response,
    list_note_files,
    merge_query_and_body_params,
    normalise_posint,
    read_named_value,
    script_error,
)

def truthy(value: object) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def main():
    debug("main() start")
    params = merge_query_and_body_params()
    debug_kv(params=params)
    
    debug_kv(env_file=str(ENV_FILE), raw_note=read_named_value(ENV_FILE, "note"))

    session_user_id = get_session_user_id()
    req_user_id = (params.get("user_id", "") or "").strip()
    debug_kv(session_user_id=session_user_id, req_user_id=req_user_id)

    if req_user_id in PUBLIC_USER_IDS:
        user_id = req_user_id
        note_dir = environment_path("public")
        debug_kv(mode="public", user_id=user_id, note_dir=note_dir)
    else:
        if not session_user_id:
            debug("ERROR NOT LOGGED IN")
            script_error("ERROR NOT LOGGED IN")
        if req_user_id and req_user_id != session_user_id:
            debug_kv(error="USER MISMATCH", req_user_id=req_user_id, session_user_id=session_user_id)
            script_error("ERROR USER MISMATCH")
        user_id = session_user_id
        note_dir = environment_path("note", user_id)
        debug_kv(mode="private", user_id=user_id, note_dir=note_dir)

    if not note_dir or not Path(note_dir).exists():
        debug_kv(error="NOTE DIR NOT DEFINED", note_dir=note_dir)
        script_error("ERROR NOTE DIR NOT DEFINED")

    root = Path(note_dir)
    include_new_note = (
        truthy(params.get("include_new_note", "")) or
        truthy(params.get("include_draft", "")) or
        truthy(params.get("draft", ""))
    )
    files = list_note_files(root, include_new_note=include_new_note)
    total = len(files)
    debug_kv(root=str(root), total=total, include_new_note=include_new_note)

    start = normalise_posint(params.get("start", ""), 1)
    count = normalise_posint(params.get("count", ""), 12)
    count_org = count
    debug_kv(start=start, count=count, count_org=count_org)

    if total == 0 or start > total:
        selected = []
        count = 0
        debug("no selected files")
    else:
        idx0 = start - 1
        selected = files[idx0: idx0 + count]
        count = len(selected)
        debug_kv(selected_count=count)
        for p in selected:
            debug(f"selected file={p}")

    notes = [collect_note_record(root, p) for p in selected]
    debug_kv(notes_built=len(notes))

    json_response(
        {
            "total": total,
            "start": start,
            "count_org": count_org,
            "count": count,
            "note": notes,
        }
    )


if __name__ == "__main__":
    try:
        debug("script begin")
        main()
    except SystemExit:
        debug("script end by SystemExit")
        raise
    except Exception:
        debug_exception()
        raise
