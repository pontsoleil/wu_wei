#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import re
from pathlib import Path

from cgi_common import (
    debug_exception,
    debug_kv,
    environment_path,
    get_session_user_id,
    json_response,
    merge_query_and_body_params,
    script_error,
)
from resource_common import (
    available_months,
    collect_resource_record,
    is_home_hidden,
    list_resource_files,
    load_resource,
    resource_date_from_path,
    resource_search_text,
)


def matches(resource: dict, term: str) -> bool:
    text = resource_search_text(resource)
    try:
        return re.search(term, text, flags=re.I) is not None
    except re.error:
        return term.lower() in text


def main():
    params = merge_query_and_body_params()
    session_user_id = get_session_user_id()
    req_user_id = (params.get("user_id", "") or "").strip()
    term = (params.get("term", "") or "").strip()
    debug_kv(params=params, session_user_id=session_user_id, req_user_id=req_user_id, term=term)

    if not session_user_id:
        script_error("ERROR NOT LOGGED IN")
    if req_user_id and req_user_id != session_user_id:
        script_error("ERROR USER MISMATCH")
    if not term:
        script_error("ERROR EMPTY KEYWORD")

    user_id = session_user_id
    resource_dir = environment_path("resource", user_id)
    if not resource_dir:
        script_error("ERROR RESOURCE DIR NOT DEFINED")

    root = Path(resource_dir)
    paths = list_resource_files(root)
    selected = []
    for path in paths:
        resource = load_resource(path)
        if resource and not is_home_hidden(resource) and matches(resource, term):
            selected.append(path)

    visible_pairs = [
        (path, record)
        for path, record in ((path, collect_resource_record(root, path, user_id)) for path in selected)
        if record
    ]
    records = [record for _, record in visible_pairs]
    day_keys = sorted({resource_date_from_path(root, p) for p, _ in visible_pairs if resource_date_from_path(root, p)})

    json_response(
        {
            "total": len(selected),
            "start": int(params.get("start") or 0),
            "count_org": len(records),
            "count": len(records),
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
