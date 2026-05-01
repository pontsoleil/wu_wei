#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import re
from pathlib import Path

from cgi_common import (
    debug_exception,
    debug_kv,
    environment_path,
    get_effective_user_id,
    get_session_user_id,
    json_response,
    merge_query_and_body_params,
    script_error,
)
from resource_common import (
    available_months,
    collect_resource_record,
    filter_by_month_and_date,
    is_home_hidden,
    list_resource_files,
    load_resource,
    resource_date_from_path,
    resource_search_text,
)


def parse_date(value: str) -> str:
    value = str(value or "").strip()
    return value if re.match(r"^\d{4}-\d{2}-\d{2}$", value) else ""


def matches(resource: dict, term: str) -> bool:
    if not term:
        return True
    text = resource_search_text(resource)
    try:
        return re.search(term, text, flags=re.I) is not None
    except re.error:
        return term.lower() in text


def filter_by_date_range(paths, root: Path, start_date: str, end_date: str):
    out = []
    for path in paths:
        d = resource_date_from_path(root, path)
        if start_date and (not d or d < start_date):
            continue
        if end_date and (not d or d > end_date):
            continue
        out.append(path)
    return out


def main():
    params = merge_query_and_body_params()
    session_user_id = get_session_user_id()
    effective_user_id = get_effective_user_id()
    req_user_id = (params.get("user_id", "") or "").strip()
    term = (params.get("term", "") or "").strip()
    year = str(params.get("year", "") or "")
    month = str(params.get("month", "") or "")
    date = parse_date(params.get("date", ""))
    start_date = parse_date(params.get("start_date", "") or params.get("from", ""))
    end_date = parse_date(params.get("end_date", "") or params.get("to", ""))

    debug_kv(
        params=params,
        session_user_id=session_user_id,
        effective_user_id=effective_user_id,
        req_user_id=req_user_id,
        term=term,
        year=year,
        month=month,
        date=date,
        start_date=start_date,
        end_date=end_date,
    )

    if not effective_user_id:
        script_error("ERROR NOT LOGGED IN")
    if req_user_id and req_user_id != effective_user_id:
        script_error("ERROR USER MISMATCH")

    user_id = effective_user_id
    resource_dir = environment_path("resource", user_id)
    if not resource_dir:
        script_error("ERROR RESOURCE DIR NOT DEFINED")

    root = Path(resource_dir)
    paths = list_resource_files(root)
    if date:
        selected = filter_by_month_and_date(paths, root, year, month, date)
    elif start_date or end_date:
        selected = filter_by_date_range(paths, root, start_date, end_date)
    elif year and month:
        selected = filter_by_month_and_date(paths, root, year, month, "")
    else:
        selected = paths

    matched = []
    for path in selected:
        resource = load_resource(path)
        if resource and not is_home_hidden(resource) and matches(resource, term):
            matched.append(path)

    visible_pairs = [
        (path, record)
        for path, record in ((path, collect_resource_record(root, path, user_id)) for path in matched)
        if record
    ]
    records = [record for _, record in visible_pairs]
    day_keys = sorted({resource_date_from_path(root, p) for p, _ in visible_pairs if resource_date_from_path(root, p)})

    json_response(
        {
            "total": len(paths),
            "start": int(params.get("start") or 0),
            "count_org": len(records),
            "count": len(records),
            "year": int(year) if year.isdigit() else "",
            "month": int(month) if month.isdigit() else "",
            "date": date,
            "start_date": start_date,
            "end_date": end_date,
            "days": "_".join(day_keys),
            "months": available_months(root),
            "r": records,
        }
    )


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        debug_exception()
        raise
