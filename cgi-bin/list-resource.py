#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

from pathlib import Path

from cgi_common import (
    debug,
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
    list_resource_files,
    resource_date_from_path,
)


def main():
    params = merge_query_and_body_params()
    session_user_id = get_session_user_id()
    effective_user_id = get_effective_user_id()
    req_user_id = (params.get("user_id", "") or "").strip()
    debug_kv(params=params, session_user_id=session_user_id, effective_user_id=effective_user_id, req_user_id=req_user_id)

    if not effective_user_id:
        script_error("ERROR NOT LOGGED IN")
    if req_user_id and req_user_id != effective_user_id:
        script_error("ERROR USER MISMATCH")

    user_id = effective_user_id
    resource_dir = environment_path("resource", user_id)
    if not resource_dir:
        script_error("ERROR RESOURCE DIR NOT DEFINED")

    root = Path(resource_dir)
    year = str(params.get("year", "") or "")
    month = str(params.get("month", "") or "")
    date = str(params.get("date", "") or "")
    paths = list_resource_files(root)
    selected = filter_by_month_and_date(paths, root, year, month, date)
    visible_pairs = [
        (path, record)
        for path, record in ((path, collect_resource_record(root, path, user_id)) for path in selected)
        if record
    ]
    records = [record for _, record in visible_pairs]
    day_keys = sorted({resource_date_from_path(root, p) for p, _ in visible_pairs if resource_date_from_path(root, p)})

    debug_kv(resource_root=str(root), total=len(paths), selected=len(records))
    json_response(
        {
            "total": len(paths),
            "start": int(params.get("start") or 0),
            "count_org": len(records),
            "count": len(records),
            "year": int(year) if year.isdigit() else "",
            "month": int(month) if month.isdigit() else "",
            "date": date,
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
