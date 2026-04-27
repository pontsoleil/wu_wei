#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import re
from pathlib import Path

from cgi_common import (
    collect_note_record,
    debug,
    debug_exception,
    debug_kv,
    environment_path,
    get_session_user_id,
    json_response,
    merge_query_and_body_params,
    normalise_posint,
    safe_read_text,
    script_error,
)


def file_matches(path: Path, term: str) -> bool:
    text = safe_read_text(path)
    try:
        matched = re.search(term, text, flags=re.I) is not None
        debug_kv(file=str(path), matched=matched, mode="regex")
        return matched
    except re.error:
        matched = term.lower() in text.lower()
        debug_kv(file=str(path), matched=matched, mode="plain")
        return matched


def main():
    debug("script begin")
    params = merge_query_and_body_params()
    debug_kv(params=params)

    session_user_id = get_session_user_id()
    debug_kv(session_user_id=session_user_id)

    if not session_user_id:
        debug("ERROR NOT LOGGED IN")
        script_error("ERROR NOT LOGGED IN")

    note_dir = environment_path("note", session_user_id)
    debug_kv(note_dir=note_dir)

    if not note_dir or not Path(note_dir).exists():
        debug("ERROR NOTE DIR NOT DEFINED")
        script_error("ERROR NOTE DIR NOT DEFINED")

    term = (params.get("term", "") or "").strip()
    debug_kv(term=term)

    if not term:
        debug("ERROR EMPTY KEYWORD")
        script_error("ERROR EMPTY KEYWORD")

    root = Path(note_dir)
    all_files = [p for p in root.rglob("*") if p.is_file()]
    debug_kv(root=str(root), candidate_files=len(all_files))

    matched = [p for p in all_files if file_matches(p, term)]
    matched.sort(key=lambda p: p.stat().st_mtime, reverse=True)

    total = len(matched)
    start = normalise_posint(params.get("start", ""), 1)
    count = normalise_posint(params.get("count", ""), 12)
    count_org = count
    debug_kv(total=total, start=start, count=count, count_org=count_org)

    if total == 0 or start > total:
        selected = []
        count = 0
        debug("no selected files")
    else:
        idx0 = start - 1
        selected = matched[idx0: idx0 + count]
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
        main()
    except SystemExit:
        debug("script end by SystemExit")
        raise
    except Exception:
        debug_exception()
        raise