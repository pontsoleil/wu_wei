#!C:/Users/nobuy/AppData/Local/Programs/Python/Python310/python.exe
# -*- coding: utf-8 -*-

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qs

SCRIPT_FILENAME = os.environ.get("SCRIPT_FILENAME", __file__)
SCRIPT_DIR = Path(SCRIPT_FILENAME).resolve().parent
LOG_DIR = SCRIPT_DIR / "log"
LOG_DIR.mkdir(parents=True, exist_ok=True)
ERR_LOG = LOG_DIR / "cgi.err"


def log_err(msg: str) -> None:
    with ERR_LOG.open("a", encoding="utf-8", newline="\n") as f:
        f.write(msg + "\n")


def trim(s: str) -> str:
    return (s or "").strip()


def is_local_host(host: str) -> bool:
    host = (host or "").split(":", 1)[0].lower()
    return host in {"localhost", "127.0.0.1", "::1", ""}


def cookie_domain_attr() -> str:
    host = os.environ.get("HTTP_HOST", "")
    if is_local_host(host):
        return ""
    return "; Domain=.sambuichi.jp"


def cookie_path() -> str:
    # wu_wei2 配下の画面と CGI の両方で使う
    return "/wu_wei2"


def emit_headers(content_type="application/json; charset=UTF-8", status=None, extra_headers=None):
    if status:
        print(f"Status: {status}")
    print(f"Content-Type: {content_type}")
    if extra_headers:
        for h in extra_headers:
            print(h)
    print("Cache-Control: no-store")
    print()


def emit_cookie_delete_headers():
    domain = cookie_domain_attr()
    path = cookie_path()
    return [
        f"Set-Cookie: wuwei_user_id=; Max-Age=0; Path={path}{domain}; HttpOnly; SameSite=Lax"
    ]


def fail_json(msg: str):
    emit_headers(
        status="401 Unauthorized",
        extra_headers=emit_cookie_delete_headers(),
    )
    print(json.dumps({"error": msg}, ensure_ascii=False))
    raise SystemExit(0)


def parse_multipart_form_data(raw: bytes, content_type: str) -> dict:
    m = re.search(r'boundary="?([^";]+)"?', content_type, flags=re.I)
    if not m:
        return {}
    boundary = m.group(1).encode("utf-8", errors="ignore")
    sep = b"--" + boundary
    result = {}

    for part in raw.split(sep):
        part = part.strip()
        if not part or part == b"--":
            continue

        if b"\r\n\r\n" in part:
            header_block, body = part.split(b"\r\n\r\n", 1)
        elif b"\n\n" in part:
            header_block, body = part.split(b"\n\n", 1)
        else:
            continue

        body = body.rstrip(b"\r\n-")
        headers = header_block.decode("utf-8", errors="ignore")
        m_name = re.search(r'name="([^"]+)"', headers, flags=re.I)
        if not m_name:
            continue
        name = m_name.group(1)
        value = body.decode("utf-8", errors="ignore")
        result[name] = value

    return result


def parse_text_plain(raw: bytes) -> dict:
    text = raw.decode("utf-8", errors="ignore").replace("\r", "")
    result = {}

    if "&" in text and "=" in text:
        parsed = parse_qs(text, keep_blank_values=True)
        return {k: v[0] if v else "" for k, v in parsed.items()}

    for line in text.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            result[k.strip()] = v.strip()
    return result


def require_post():
    method = os.environ.get("REQUEST_METHOD", "").upper()
    if method != "POST":
        emit_headers("text/plain; charset=UTF-8", status="405 Method Not Allowed")
        print("ERROR POST ONLY")
        raise SystemExit(0)


def read_request_params() -> dict:
    require_post()

    raw_content_type = os.environ.get("CONTENT_TYPE", "")
    content_type = raw_content_type.split(";", 1)[0].strip().lower()

    try:
        length = int(os.environ.get("CONTENT_LENGTH", "0") or "0")
    except ValueError:
        length = 0

    raw = sys.stdin.buffer.read(length)

    if content_type == "application/x-www-form-urlencoded":
        parsed = parse_qs(raw.decode("utf-8", errors="ignore"), keep_blank_values=True)
        return {k: v[0] if v else "" for k, v in parsed.items()}

    if content_type == "text/plain":
        return parse_text_plain(raw)

    if content_type == "multipart/form-data":
        return parse_multipart_form_data(raw, raw_content_type)

    return {}


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
    text = value.replace("\\", "/").strip("/")
    if text == "wu_wei2":
        return SCRIPT_DIR.parent.resolve()
    if text.startswith("wu_wei2/"):
        return (SCRIPT_DIR.parent / text[len("wu_wei2/"):]).resolve()
    return (SCRIPT_DIR / p).resolve()


def resolve_user_dir(base_user_dir: str) -> Path:
    base = resolve_path(base_user_dir)
    candidates = [
        base / "user",
        base,
        base.parent / "user",
        SCRIPT_DIR / "user",
    ]
    for candidate in candidates:
        if (candidate / "member.name").exists() and (candidate / "password").exists():
            return candidate
    return base / "user"


def openssl_crypt(password: str) -> str:
    openssl_exe = os.environ.get("OPENSSL_EXE", "openssl")
    try:
        cp = subprocess.run(
            [openssl_exe, "passwd", "-crypt", "-salt", "wuwei", password],
            capture_output=True,
            text=True,
            check=True,
            encoding="utf-8",
            errors="ignore",
        )
        return cp.stdout.strip()
    except Exception as e:
        log_err(f"openssl error: {e}")
        return ""


def main():
    params = read_request_params()

    user = trim(params.get("user", ""))
    password = (params.get("pw", "") or "").replace("\r", "").replace("\n", "")

    if not user:
        fail_json("LOGIN FAILED (missing user)")
    if not password:
        fail_json("LOGIN FAILED (missing password)")

    encrypted = openssl_crypt(password)
    if not encrypted:
        fail_json("LOGIN FAILED (openssl error)")

    env_path = SCRIPT_DIR / "data" / "environment"
    base_user_dir = read_named_value(env_path, "user")
    if not base_user_dir:
        fail_json("LOGIN FAILED (environment user dir empty)")

    user_dir = resolve_user_dir(base_user_dir)
    member_name = user_dir / "member.name"
    password_file = user_dir / "password"

    if not member_name.exists():
        fail_json("LOGIN FAILED (missing member.name)")
    if not password_file.exists():
        fail_json("LOGIN FAILED (missing password file)")

    user_id = ""
    user_name = ""
    user_role = ""

    for line in member_name.read_text(encoding="utf-8", errors="ignore").splitlines():
        cols = line.strip().split()
        if len(cols) >= 4 and cols[1] == user:
            user_id = cols[0]
            user_name = cols[2]
            user_role = cols[3]
            break

    if not user_id:
        fail_json("LOGIN FAILED (unknown user)")

    stored_pw = ""
    for line in password_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        cols = line.strip().split()
        if len(cols) >= 2 and cols[0] == user_id:
            stored_pw = cols[1]
            break

    if not stored_pw:
        fail_json("LOGIN FAILED (no stored password)")

    if encrypted != stored_pw:
        fail_json("LOGIN FAILED")

    domain = cookie_domain_attr()
    path = cookie_path()
    cookie_headers = [
        f"Set-Cookie: wuwei_user_id={user_id}; Max-Age=86400; Path={path}{domain}; HttpOnly; SameSite=Lax"
    ]

    emit_headers(extra_headers=cookie_headers)
    print(json.dumps(
        {
            "login": user,
            "user_id": user_id,
            "name": user_name,
            "role": user_role,
        },
        ensure_ascii=False
    ))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        log_err(f"Unhandled exception: {e!r}")
        emit_headers(status="500 Internal Server Error", extra_headers=emit_cookie_delete_headers())
        print(json.dumps({"error": "LOGIN FAILED (internal error)"}, ensure_ascii=False))
