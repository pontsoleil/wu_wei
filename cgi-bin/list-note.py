#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import re
from pathlib import Path

from cgi_common import (
    ENV_FILE,
    PUBLIC_USER_IDS,
    collect_note_record,
    decode_note_json,
    debug,
    debug_exception,
    debug_kv,
    environment_path,
    get_effective_user_id,
    get_session_user_id,
    json_response,
    list_note_files,
    merge_query_and_body_params,
    normalise_posint,
    read_named_value,
    read_note_meta,
    script_error,
)

def truthy(value: object) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def parse_date(value: object) -> str:
    value = str(value or "").strip()
    return value if re.match(r"^\d{4}-\d{2}-\d{2}$", value) else ""


def note_date_from_path(root: Path, path: Path) -> str:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        parts = path.parts
    if len(parts) >= 3 and re.match(r"^\d{4}$", parts[0]) and re.match(r"^\d{2}$", parts[1]) and re.match(r"^\d{2}$", parts[2]):
        return f"{parts[0]}-{parts[1]}-{parts[2]}"
    return ""


def note_matches(path: Path, term: str) -> bool:
    if not term:
        return True
    meta = read_note_meta(path)
    haystack = " ".join(
        [
            str(meta.get("id") or ""),
            str(meta.get("name") or ""),
            str(meta.get("description") or ""),
            str(meta.get("saved_at") or ""),
        ]
    )
    try:
        haystack += " " + decode_note_json(meta)
    except Exception:
        pass
    text = haystack.lower()
    try:
        return re.search(term, text, flags=re.I) is not None
    except re.error:
        return term.lower() in text


def filter_notes(files: list[Path], root: Path, *, year: str, month: str, date: str, start_date: str, end_date: str, term: str) -> list[Path]:
    month_key = f"{int(year):04d}-{int(month):02d}" if str(year).isdigit() and str(month).isdigit() else ""
    selected = []
    for path in files:
        d = note_date_from_path(root, path)
        if date and d != date:
            continue
        if not date and not (start_date or end_date) and month_key and not d.startswith(month_key):
            continue
        if start_date and (not d or d < start_date):
            continue
        if end_date and (not d or d > end_date):
            continue
        if not note_matches(path, term):
            continue
        selected.append(path)
    return selected


def main():
    debug("main() start")
    params = merge_query_and_body_params()
    debug_kv(params=params)
    
    debug_kv(env_file=str(ENV_FILE), raw_note=read_named_value(ENV_FILE, "note"))

    session_user_id = get_session_user_id()
    effective_user_id = get_effective_user_id()
    req_user_id = (params.get("user_id", "") or "").strip()
    debug_kv(session_user_id=session_user_id, effective_user_id=effective_user_id, req_user_id=req_user_id)

    if req_user_id in PUBLIC_USER_IDS:
        user_id = req_user_id
        note_dir = environment_path("public")
        debug_kv(mode="public", user_id=user_id, note_dir=note_dir)
    else:
        if not effective_user_id:
            debug("ERROR NOT LOGGED IN")
            script_error("ERROR NOT LOGGED IN")
        if req_user_id and req_user_id != effective_user_id:
            debug_kv(error="USER MISMATCH", req_user_id=req_user_id, effective_user_id=effective_user_id)
            script_error("ERROR USER MISMATCH")
        user_id = effective_user_id
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
    term = (params.get("term", "") or "").strip()
    year = str(params.get("year", "") or "")
    month = str(params.get("month", "") or "")
    date = parse_date(params.get("date", ""))
    start_date = parse_date(params.get("start_date", "") or params.get("from", ""))
    end_date = parse_date(params.get("end_date", "") or params.get("to", ""))
    files = list_note_files(root, include_new_note=include_new_note)
    files = filter_notes(files, root, year=year, month=month, date=date, start_date=start_date, end_date=end_date, term=term)
    total = len(files)
    debug_kv(root=str(root), total=total, include_new_note=include_new_note, term=term, year=year, month=month, date=date, start_date=start_date, end_date=end_date)

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
            "term": term,
            "year": int(year) if year.isdigit() else "",
            "month": int(month) if month.isdigit() else "",
            "date": date,
            "start_date": start_date,
            "end_date": end_date,
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
