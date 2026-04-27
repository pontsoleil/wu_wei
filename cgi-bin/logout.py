#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-

import json
import os
from pathlib import Path

SCRIPT_FILENAME = os.environ.get("SCRIPT_FILENAME", __file__)
SCRIPT_DIR = Path(SCRIPT_FILENAME).resolve().parent
LOG_DIR = SCRIPT_DIR / "log"
LOG_DIR.mkdir(parents=True, exist_ok=True)
ERR_LOG = LOG_DIR / "cgi.err"


def is_local_host(host: str) -> bool:
    host = (host or "").split(":", 1)[0].lower()
    return host in {"localhost", "127.0.0.1", "::1", ""}


def cookie_domain_attr() -> str:
    host = os.environ.get("HTTP_HOST", "")
    if is_local_host(host):
        return ""
    return "; Domain=.sambuichi.jp"


def emit_headers():
    domain = cookie_domain_attr()
    print("Content-Type: application/json")
    print("Cache-Control: no-store")
    print(f"Set-Cookie: wuwei_user_id=; Max-Age=0; Path=/wu_wei2{domain}; HttpOnly")
    print(f"Set-Cookie: wuwei_user_id=; Max-Age=0; Path=/wu_wei2/server{domain}; HttpOnly")
    print()


def main():
    emit_headers()
    print(json.dumps({"ok": True, "logged_in": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()