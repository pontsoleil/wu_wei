#!C:\Users\nobuy\AppData\Local\Programs\Python\Python310\python.exe
# -*- coding: utf-8 -*-
"""Shared helpers for WuWei CGI Python scripts."""

from __future__ import annotations

import base64
import json
import os
import re
import sys
from datetime import datetime
from email.parser import BytesParser
from email.policy import default
from http.cookies import SimpleCookie
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import parse_qs
import traceback

SCRIPT_FILENAME = os.environ.get("SCRIPT_FILENAME", __file__)
SCRIPT_DIR = Path(SCRIPT_FILENAME).resolve().parent
LOG_DIR = SCRIPT_DIR / "log"
LOG_DIR.mkdir(parents=True, exist_ok=True)
ERR_LOG = LOG_DIR / "cgi.err"
ENV_FILE = SCRIPT_DIR / "data" / "environment"

ENV = {
    "note": "/Apache24/htdocs/wu_wei2/*/note",
    "resource": "/Apache24/htdocs/wu_wei2/*/resource",
    "trash": "/Apache24/htdocs/wu_wei2/*/trash",
    "upload": "/Apache24/htdocs/wu_wei2/*/upload",
    "thumbnail": "/Apache24/htdocs/wu_wei2/*/thumbnail",
    "user": "/Apache24/htdocs/wu_wei2",
}

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.I,
)

PUBLIC_USER_IDS = {
    "dd99d0a5-566b-41cf-934d-127a89e13ba1",
    "0dbfa104-accd-4188-8b1b-f2e25d38e638",
}

DEBUG_ENABLED = True

def script_dir() -> Path:
    script_filename = os.environ.get("SCRIPT_FILENAME", __file__)
    return Path(script_filename).resolve().parent


def log_dir() -> Path:
    d = script_dir() / "log"
    d.mkdir(parents=True, exist_ok=True)
    return d


def debug_log_path(name: str | None = None) -> Path:
    if name:
        return log_dir() / f"{name}.debug.log"
    script_name = Path(os.environ.get("SCRIPT_NAME", __file__)).stem
    return log_dir() / f"{script_name}.debug.log"


def debug(message: str, name: str | None = None) -> None:
    if not DEBUG_ENABLED:
        return
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    path = debug_log_path(name)
    with path.open("a", encoding="utf-8", newline="\n") as f:
        f.write(f"[{ts}] {message}\n")


def debug_kv(name: str | None = None, **kwargs) -> None:
    parts = [f"{k}={v!r}" for k, v in kwargs.items()]
    debug(", ".join(parts), name=name)


def debug_exception(name: str | None = None, prefix: str = "UNHANDLED EXCEPTION") -> None:
    debug(prefix, name=name)
    debug(traceback.format_exc(), name=name)


def log_err(msg: str) -> None:
    with ERR_LOG.open("a", encoding="utf-8", newline="\n") as f:
        f.write(f"{datetime.now().isoformat()} {msg}\n")


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


def emit_headers(
    content_type: str = "text/plain; charset=UTF-8",
    status: Optional[str] = None,
    extra_headers: Optional[List[str]] = None,
) -> None:
    if status:
        print(f"Status: {status}")
    print(f"Content-Type: {content_type}")
    if extra_headers:
        for h in extra_headers:
            print(h)
    print("Cache-Control: no-store")
    print()


def text_response(
    text: str,
    status: Optional[str] = None,
    extra_headers: Optional[List[str]] = None,
) -> None:
    emit_headers("text/plain; charset=UTF-8", status=status, extra_headers=extra_headers)
    payload = text if text.endswith("\n") else text + "\n"
    sys.stdout.flush()
    sys.stdout.buffer.write(payload.encode("utf-8"))
    sys.stdout.buffer.flush()
    raise SystemExit(0)


def json_response(
    obj,
    status: Optional[str] = None,
    extra_headers: Optional[List[str]] = None,
) -> None:
    emit_headers(
        "application/json; charset=UTF-8", status=status, extra_headers=extra_headers
    )
    payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    sys.stdout.flush()
    sys.stdout.buffer.write(payload)
    sys.stdout.buffer.flush()
    raise SystemExit(0)


def script_error(message: str) -> None:
    text_response(message)


def internal_error(message: str) -> None:
    text_response(
        f"500 Internal Server Error\n{message}", status="500 Internal Server Error"
    )


def parse_text_plain(raw: bytes) -> Dict[str, str]:
    text = raw.decode("utf-8", errors="ignore").replace("\r", "")
    if "&" in text and "=" in text:
        parsed = parse_qs(text, keep_blank_values=True)
        return {k: v[0] if v else "" for k, v in parsed.items()}
    result: Dict[str, str] = {}
    for line in text.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            result[k.strip()] = v.strip()
    return result


def parse_multipart_form_data(raw: bytes, content_type_header: str) -> Dict[str, str]:
    msg = BytesParser(policy=default).parsebytes(
        b"Content-Type: "
        + content_type_header.encode("utf-8", errors="ignore")
        + b"\r\n\r\n"
        + raw
    )
    result: Dict[str, str] = {}
    if not msg.is_multipart():
        return result
    for part in msg.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue
        payload = part.get_payload(decode=True) or b""
        result[name] = payload.decode("utf-8", errors="ignore")
    return result


def read_request_params() -> Dict[str, str]:
    method = os.environ.get("REQUEST_METHOD", "").upper()
    raw_content_type = os.environ.get("CONTENT_TYPE", "")
    content_type = raw_content_type.split(";", 1)[0].strip().lower()

    if method == "GET":
        parsed = parse_qs(os.environ.get("QUERY_STRING", ""), keep_blank_values=True)
        return {k: v[0] if v else "" for k, v in parsed.items()}

    if method != "POST":
        return {}

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


def merge_query_and_body_params() -> Dict[str, str]:
    query = {
        k: v[0] if v else ""
        for k, v in parse_qs(
            os.environ.get("QUERY_STRING", ""), keep_blank_values=True
        ).items()
    }
    body = (
        read_request_params()
        if os.environ.get("REQUEST_METHOD", "").upper() == "POST"
        else {}
    )
    merged = dict(query)
    merged.update(body)
    return merged


def require_post() -> None:
    method = os.environ.get("REQUEST_METHOD", "").upper()
    if method != "POST":
        script_error("ERROR POST ONLY")


def read_post_params() -> Dict[str, str]:
    require_post()
    return read_request_params()


def get_session_user_id() -> str:
    raw_cookie = os.environ.get("HTTP_COOKIE", "")
    c = SimpleCookie()
    try:
        c.load(raw_cookie)
    except Exception:
        return ""
    morsel = c.get("wuwei_user_id")
    if not morsel:
        return ""
    user_id = trim(morsel.value)
    return user_id if UUID_RE.match(user_id) else ""


def read_named_value(path: Path, key: str) -> str:
    if not path.exists():
        return ""
    try:
        for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith(f"{key} "):
                value = line[len(key) + 1 :].strip()
                return strip_quotes(value)
            if line.startswith(f"{key}="):
                value = line[len(key) + 1 :].strip()
                return strip_quotes(value)
    except Exception as e:
        log_err(f"read_named_value error path={path} key={key}: {e!r}")
    return ""


def strip_quotes(value: str) -> str:
    value = trim(value)
    if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
        return value[1:-1]
    return value


def resolve_user_template(path_template: str, user_id: str | None = None) -> str:
    path_template = trim(path_template)
    if not path_template or not user_id:
        return path_template

    # Windows / Unix どちらでも、最初の "/*/" または "\*\"
    # だけを user_id に置き換える
    if "/*/" in path_template:
        return path_template.replace("/*/", f"/{user_id}/", 1)

    if "\\*\\" in path_template:
        return path_template.replace("\\*\\", f"\\{user_id}\\", 1)

    return path_template


def environment_path(name: str, user_id: str | None = None) -> str:
    base = read_named_value(ENV_FILE, name)
    expanded = resolve_user_template(base, user_id)

    if not expanded:
        return ""

    p = Path(expanded)

    # Windows の絶対パス (C:/... など) はそのまま返す
    if p.is_absolute():
        return str(p)

    # 相対パスなら CGI スクリプト配置ディレクトリ基準で解決
    return str((SCRIPT_DIR / expanded).resolve())


def environment_url(name: str, user_id: str | None = None, *parts: str) -> str:
    template = read_named_value(ENV_FILE, name)
    expanded = resolve_user_template(template, user_id)

    if not expanded:
        return ""

    path_s = expanded.replace("\\", "/")

    docroot = "C:/Apache24/htdocs"
    if path_s.lower().startswith(docroot.lower()):
        host = trim(os.environ.get("HTTP_HOST", "")) or trim(os.environ.get("SERVER_NAME", "")) or "localhost"
        scheme = "https" if trim(os.environ.get("HTTPS", "")).lower() in {"on", "1", "true"} else "http"
        url = f"{scheme}://{host}" + path_s[len(docroot):]
    else:
        url = path_s

    if parts:
        suffix = "/".join(str(p).replace("\\", "/").strip("/") for p in parts if str(p))
        url = url.rstrip("/") + "/" + suffix

    return url


def normalise_posint(value: str, default: int) -> int:
    value = trim(value)
    if not value.isdigit():
        return default
    n = int(value)
    return n if n >= 1 else default


def read_note_meta(path: Path) -> Dict[str, str]:
    keys = [
        "format_version",
        "id",
        "user_id",
        "name",
        "description",
        "thumbnail",
        "saved_at",
        "json_encoding",
        "json_base64",
        "json",
    ]
    return {k: read_named_value(path, k) for k in keys}


def decode_note_json(meta: Dict[str, str]) -> str:
    json_b64 = meta.get("json_base64", "")
    if json_b64:
        try:
            return base64.b64decode(json_b64).decode("utf-8", errors="strict")
        except Exception as e:
            raise ValueError(f"JSON DECODE FAILED: {e}")
    raw = meta.get("json", "")
    if raw:
        raw = raw.replace("\x06", " ")
        raw = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", raw)
        return raw
    raise ValueError("JSON NOT FOUND")


def note_timestamp(path: Path) -> str:
    return (
        datetime.fromtimestamp(path.stat().st_mtime)
        .astimezone()
        .strftime("%Y-%m-%dT%H:%M:%S%z")
    )


def collect_note_record(note_root: Path, file_path: Path) -> Dict[str, object]:
    relpath = note_record_id(note_root, file_path)
    meta = read_note_meta(file_path)
    parent = relpath.rsplit("/", 1)[0] if "/" in relpath else "."
    name = relpath.rsplit("/", 1)[-1]
    return {
        "id": relpath,
        "user_id": meta.get("user_id", ""),
        "note_name": meta.get("name", ""),
        "description": meta.get("description", ""),
        "dir": parent,
        "size": file_path.stat().st_size,
        "timestamp": note_timestamp(file_path),
        "file": name,
        "thumbnail": meta.get("thumbnail", ""),
    }


def is_note_file(path: Path) -> bool:
    if not path.is_file():
        return False
    if path.name == "note.json":
        return True
    if "resource" in path.parts:
        return False
    try:
        meta = read_note_meta(path)
        return bool(meta.get("json_base64") or meta.get("json"))
    except Exception:
        return False


def note_record_id(note_root: Path, file_path: Path) -> str:
    relpath = file_path.relative_to(note_root).as_posix()
    if file_path.name == "note.json":
        return Path(relpath).parent.as_posix()
    return relpath


def list_note_files(note_root: Path) -> List[Path]:
    if not note_root.exists():
        return []
    files = [p for p in note_root.rglob("*") if is_note_file(p)]
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files


def resolve_note_file(note_root: Path, note_id: str) -> Path:
    note_id = trim(note_id).replace("\\", "/").strip("/")
    direct = note_root / note_id
    if direct.is_file():
        return direct
    if direct.is_dir() and (direct / "note.json").is_file():
        return direct / "note.json"
    if (direct / "note.json").is_file():
        return direct / "note.json"

    matches = list(note_root.rglob(note_id))
    matches.sort(key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True)
    for path in matches:
        if path.is_file() and is_note_file(path):
            return path
        if path.is_dir() and (path / "note.json").is_file():
            return path / "note.json"
    return direct


def validate_simple_id(value: str, name: str) -> str:
    value = trim(value)
    if not value or value.startswith("ERROR") or re.search(r"[^A-Za-z0-9._-]", value):
        raise ValueError(f"INVALID {name}")
    return value


def safe_read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
