#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import json
import os
from http.cookies import SimpleCookie
from pathlib import Path

SCRIPT_FILENAME = os.environ.get("SCRIPT_FILENAME", __file__)
SCRIPT_DIR = Path(SCRIPT_FILENAME).resolve().parent


def read_named_value(path: Path, key: str) -> str:
    if not path.exists():
        return ""

    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue

        if s.startswith(f"{key} "):
            return s[len(key) + 1:].strip().strip('"').strip("'")

        if s.startswith(f"{key}="):
            return s[len(key) + 1:].strip().strip('"').strip("'")

    return ""


def resolve_path(value: str) -> Path:
    p = Path(value)
    if p.is_absolute():
        return p
    return (SCRIPT_DIR / p).resolve()


def lookup_user(user_id: str) -> dict:
    if not user_id:
        return {}

    env_path = SCRIPT_DIR / "data" / "environment"
    base_user_dir = read_named_value(env_path, "user")
    if not base_user_dir:
        return {}

    member_name = resolve_path(base_user_dir) / "user" / "member.name"
    if not member_name.exists():
        return {}

    for line in member_name.read_text(encoding="utf-8", errors="ignore").splitlines():
        cols = line.strip().split()
        if len(cols) >= 4 and cols[0] == user_id:
            return {
                "login": cols[1],
                "name": cols[2],
                "role": cols[3],
            }

    return {}

raw_cookie = os.environ.get("HTTP_COOKIE", "")
cookie = SimpleCookie()
try:
    cookie.load(raw_cookie)
except Exception:
    pass

m = cookie.get("wuwei_user_id")
user_id = m.value if m else None
user_info = lookup_user(user_id or "")

print("Content-Type: application/json; charset=UTF-8")
print()
print(json.dumps({
    "user_id": user_id or "",
    "parsed_user_id": user_id,
    **user_info,
}, ensure_ascii=False))
