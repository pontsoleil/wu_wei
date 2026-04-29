#!/bin/bash
# save-note.cgi
#
# Normal mode:
#   stderr is appended only to:
#     log/cgi.err
#
# Debug mode:
#   create the following flag file, then call this CGI:
#     log/.debug.save-note.cgi
#
#   In debug mode, stderr is written to both:
#     log/cgi.err
#     log/save-note.cgi.<pid>.log
#
#   Enable debug:
#     touch log/.debug.save-note.cgi
#
#   Disable debug:
#     rm -f log/.debug.save-note.cgi

# WW_CGI_BOOTSTRAP: stabilise cwd under fcgiwrap
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1

mkdir -p "$SCRIPT_DIR/log"

REQLOG=""
DEBUG_FILE="$SCRIPT_DIR/log/.debug.${0##*/}"

if [ -f "$DEBUG_FILE" ]; then
  REQLOG="$SCRIPT_DIR/log/${0##*/}.$$.log"
  # stderr -> both cgi.err and per-request log
  exec 2> >(tee -a "$SCRIPT_DIR/log/cgi.err" >>"$REQLOG")
  set -eu
  DEBUG=1
else
  # stderr -> cgi.err only
  exec 2>>"$SCRIPT_DIR/log/cgi.err"
  set -eu
  DEBUG=0
fi

export LC_ALL=C

type command >/dev/null 2>&1 && type getconf >/dev/null 2>&1 &&
export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"
CGIVARS="${Tmp}-cgivars"
CGIVARS_ORG="${Tmp}-cgivars-org"

cleanup() {
  rm -f "$CGIVARS" "$CGIVARS_ORG"
  rm -rf "${RESOURCE_TMP:-}"
}
trap cleanup EXIT HUP INT TERM

year=$(date '+%Y')
month=$(date '+%m')
day=$(date '+%d')
saved_at=$(date '+%Y-%m-%dT%H:%M:%S%z')
ACK=$(printf '\006')

error_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
  exit 0
}

ok_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
  exit 0
}

debug_log() {
  [ "${DEBUG:-0}" = "1" ] || return 0
  printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >&2
}

debug_preview() {
  label=$1
  value=$2
  [ "${DEBUG:-0}" = "1" ] || return 0
  len=$(printf '%s' "$value" | wc -c | tr -d ' ')
  head=$(printf '%s' "$value" | head -c 240 | tr '\r\n\t' '   ')
  printf '[%s] %s_len=%s %s_head=%s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$label" "$len" "$label" "$head" >&2
}

raw_form_value() {
  key=$1
  file=$2
  [ -f "$file" ] || return 0
  tr '&' '\n' < "$file" |
  sed -n "s/^${key}=//p" |
  head -n 1 |
  sed 's/+/ /g; s/%2[Dd]/-/g; s/%5[Ff]/_/g; s/%40/@/g'
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

restore_ack_to_space() {
  tr '\006' ' '
}

single_line_meta() {
  tr '\r\n\t' '   ' | sed 's/  */ /g; s/^ //; s/ $//'
}

resolve_env_path() {
  key=$1
  uid=$2
  tpl=$(nameread "$key" data/environment | strip_quotes || true)
  [ -n "$tpl" ] || return 1
  tpl=$(printf '%s' "$tpl" | sed "s#/\*/#/${uid}/#; s#\*#${uid}#")
  case "$tpl" in
    /*) printf '%s\n' "$tpl" ;;
    wu_wei2/*) printf '%s/%s\n' "$(dirname "$SCRIPT_DIR")" "${tpl#wu_wei2/}" ;;
    *) printf '%s/%s\n' "$SCRIPT_DIR" "$tpl" ;;
  esac
}

json_string_field() {
  key=$1
  file=$2
  awk -v k="$key" '
    BEGIN { RS=""; ORS="" }
    {
      pat = "\"" k "\"[ \t\r\n]*:[ \t\r\n]*\""
      p = match($0, pat)
      if (!p) exit
      s = substr($0, RSTART + RLENGTH)
      out = ""; esc = 0
      for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1)
        if (esc) { out = out c; esc = 0; continue }
        if (c == "\\") { out = out c; esc = 1; continue }
        if (c == "\"") break
        out = out c
      }
      print out
    }
  ' "$file"
}

json_string_values() {
  key=$1
  file=$2
  awk -v k="$key" '
    BEGIN { RS=""; ORS="\n" }
    {
      rest = $0
      pat = "\"" k "\"[ \t\r\n]*:[ \t\r\n]*\""
      while (match(rest, pat)) {
        s = substr(rest, RSTART + RLENGTH)
        out = ""; esc = 0
        for (i = 1; i <= length(s); i++) {
          c = substr(s, i, 1)
          if (esc) { out = out c; esc = 0; continue }
          if (c == "\\") { out = out c; esc = 1; continue }
          if (c == "\"") break
          out = out c
        }
        print out
        rest = substr(s, i + 1)
      }
    }
  ' "$file"
}

extract_note_resources() {
  json_file=$1
  out_dir=$2
  awk -v out="$out_dir" '
    BEGIN { RS=""; n=0 }
    {
      p = match($0, "\"resources\"[ \t\r\n]*:[ \t\r\n]*\\[")
      if (!p) exit
      i = RSTART + RLENGTH
      arr_depth = 1; obj_depth = 0; in_s = 0; esc = 0; start = 0
      for (; i <= length($0); i++) {
        c = substr($0, i, 1)
        if (in_s) {
          if (esc) esc = 0
          else if (c == "\\") esc = 1
          else if (c == "\"") in_s = 0
          continue
        }
        if (c == "\"") { in_s = 1; continue }
        if (c == "[") { arr_depth++; continue }
        if (c == "]") {
          if (obj_depth == 0) arr_depth--
          if (arr_depth == 0) exit
          continue
        }
        if (c == "{") {
          if (obj_depth == 0) start = i
          obj_depth++
          continue
        }
        if (c == "}") {
          obj_depth--
          if (obj_depth == 0 && start > 0) {
            n++
            print substr($0, start, i - start + 1) > (out "/resource_" n ".json")
            close(out "/resource_" n ".json")
            start = 0
          }
        }
      }
    }
  ' "$json_file"
}

resource_identity_key() {
  file=$1
  v=$(json_string_field canonicalUri "$file")
  [ -n "$v" ] || v=$(json_string_field uri "$file")
  [ -n "$v" ] || v=$(json_string_field sourcePath "$file")
  printf '%s\n' "$v"
}

copy_resource_files() {
  resource_file=$1
  primary_dir=$2
  snapshot_dir=$3
  json_string_values sourcePath "$resource_file" | while IFS= read -r source_path; do
    [ -n "$source_path" ] || continue
    case "$source_path" in
      /*) src="$source_path" ;;
      *) src="$source_path" ;;
    esac
    [ -f "$src" ] || continue
    name=${src##*/}
    cp "$src" "$primary_dir/$name" 2>/dev/null || true
    cp "$src" "$snapshot_dir/$name" 2>/dev/null || true
  done
}

save_note_resources() {
  json_file=$1
  resource_root=$2
  note_resource_dir=$3
  RESOURCE_TMP="${Tmp}-resources"
  mkdir -p "$RESOURCE_TMP" "$resource_root" "$note_resource_dir" || return 1
  extract_note_resources "$json_file" "$RESOURCE_TMP"
  for rf in "$RESOURCE_TMP"/resource_*.json; do
    [ -f "$rf" ] || continue
    rid=$(json_string_field id "$rf")
    [ -n "$rid" ] || continue
    key=$(resource_identity_key "$rf")
    primary=""
    if [ -n "$key" ]; then
      primary=$(find "$resource_root" -type f -name resource.json -exec awk -v key="$key" '
        BEGIN { RS=""; found=0 }
        index($0, key) > 0 { found=1 }
        END { exit found ? 0 : 1 }
      ' {} \; -print | head -n 1)
      [ -n "$primary" ] && primary=${primary%/resource.json}
    fi
    if [ -z "$primary" ] && [ -z "$key" ]; then
      if [ -f "$resource_root/$year/$month/$day/$rid/resource.json" ]; then
        primary="$resource_root/$year/$month/$day/$rid"
      else
        primary=$(find "$resource_root" -path "*/$rid/resource.json" -type f | head -n 1)
        [ -n "$primary" ] && primary=${primary%/resource.json}
      fi
    fi
    if [ -z "$primary" ]; then
      primary="$resource_root/$year/$month/$day/$rid"
      mkdir -p "$primary" || return 1
      cp "$rf" "$primary/resource.json" || return 1
    elif [ -z "$key" ] && [ -f "$primary/resource.json" ] && [ -n "$(resource_identity_key "$primary/resource.json")" ]; then
      # Do not overwrite an existing Resource URI with a note-local blank URI.
      rf="$primary/resource.json"
    fi
    snapshot="$note_resource_dir/$rid"
    mkdir -p "$snapshot" || return 1
    copy_resource_files "$rf" "$primary" "$snapshot"
    cp "$rf" "$snapshot/resource.json" || return 1
  done
}

process_note_json() {
  json_file=$1
  note_root=$2
  resource_root=$3
  note_resource_dir=$4
  user_id_arg=$5
  note_id_arg=$6
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$json_file" "$note_root" "$resource_root" "$note_resource_dir" "$user_id_arg" "$note_id_arg" "$SCRIPT_DIR" <<'PY'
import base64
import binascii
import hashlib
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlparse

json_file = Path(sys.argv[1])
note_root = Path(sys.argv[2])
resource_root = Path(sys.argv[3])
note_resource_dir = Path(sys.argv[4])
user_id = sys.argv[5]
note_id = sys.argv[6]
script_dir = Path(sys.argv[7])
upload_root = note_root.parent / "upload"
now = datetime.now().astimezone()


def load_note(path):
    text = path.read_text(encoding="utf-8")
    if text.startswith("\ufeff"):
        text = text.lstrip("\ufeff")
    if not text:
        raise ValueError("JSON NOT SPECIFIED")
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("NOTE JSON MUST BE OBJECT")
    if "pages" not in data or not isinstance(data.get("pages"), list):
        raise ValueError("NOTE JSON PAGES MUST BE ARRAY")
    if "resources" in data and not isinstance(data.get("resources"), list):
        raise ValueError("NOTE JSON RESOURCES MUST BE ARRAY")
    return data


def storage_path_from_public_path(path_text, base_root):
    path_text = (path_text or "").replace("\\", "/").strip()
    if not path_text:
        return None
    marker = "/wu_wei2/"
    if marker in path_text:
        path_text = path_text.split(marker, 1)[1]
    path_text = path_text.lstrip("/")
    prefix = f"data/{user_id}/"
    if path_text.startswith(prefix):
        return base_root / path_text[len(prefix):]
    for area in ("upload", "resource", "note", "thumbnail", "content"):
        area_prefix = f"{area}/{user_id}/"
        if path_text.startswith(area_prefix):
            return base_root / area / path_text[len(area_prefix):]
    return None


def resolve_storage_dir(path_text, base_root):
    path_text = (path_text or "").replace("\\", "/").strip()
    if not path_text:
        return None
    path_text = path_text.replace("_user_uuid", user_id).replace("user_uuid", user_id)
    path_text = path_text.replace("_note_uuid", note_id).replace("note_uuid", note_id)
    public_path = storage_path_from_public_path(path_text, base_root)
    if public_path is not None:
        return public_path
    path = Path(path_text)
    if path.is_absolute():
        return path
    return base_root / path_text


def local_file_from_uri(uri, base_root=None):
    uri = (uri or "").strip()
    if not uri:
        return None
    parsed = urlparse(uri)
    path_text = unquote(parsed.path if parsed.scheme else uri)
    marker = "/wu_wei2/"
    if marker in path_text:
        path_text = path_text.split(marker, 1)[1]
    path_text = path_text.replace("\\", "/").lstrip("/")
    if base_root is not None:
        public_path = storage_path_from_public_path(path_text, base_root)
        if public_path is not None and public_path.is_file():
            return public_path
    path = Path(path_text)
    if path.is_absolute():
        return path if path.is_file() else None
    candidate = script_dir.parent / path_text
    return candidate if candidate.is_file() else None


def storage_file_from_item(item, base_root):
    area = str(item.get("area") or "").strip().strip("/")
    rel = str(item.get("path") or item.get("sourcePath") or "").replace("\\", "/").strip("/")
    if not rel:
        return None
    if not area:
        role = str(item.get("role") or "").strip().lower()
        area = "upload" if role == "original" else "resource"
    public_path = storage_path_from_public_path(f"{area}/{user_id}/{rel}", base_root)
    if public_path is not None:
        return public_path
    path = Path(rel)
    if path.is_absolute():
        return path
    return base_root / area / rel


def promote_local_resource_snapshot(resource):
    storage = resource.get("storage")
    if not isinstance(storage, dict):
        storage = {}
        resource["storage"] = storage
    if storage.get("managed") is True and storage.get("copyPolicy") == "snapshot":
        return

    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    media = resource.get("media") if isinstance(resource.get("media"), dict) else {}
    viewer = resource.get("viewer") if isinstance(resource.get("viewer"), dict) else {}
    embed = viewer.get("embed") if isinstance(viewer.get("embed"), dict) else {}
    snapshot_sources = resource.get("snapshotSources") if isinstance(resource.get("snapshotSources"), dict) else {}
    candidates = [
        ("original", str(snapshot_sources.get("originalUri") or identity.get("canonicalUri") or ""), str(media.get("mimeType") or "application/octet-stream")),
        ("preview", str(snapshot_sources.get("previewUri") or embed.get("uri") or identity.get("uri") or ""), "application/pdf"),
        ("thumbnail", str(snapshot_sources.get("thumbnailUri") or ""), "image/jpeg"),
    ]

    files = []
    seen = set()
    for role, uri, mime_type in candidates:
        source = local_file_from_uri(uri)
        if source is None or source in seen:
            continue
        seen.add(source)
        files.append({
            "role": role,
            "path": source.name,
            "sourcePath": str(source),
            "mimeType": mime_type,
            "size": source.stat().st_size,
            "sha256": "",
        })

    if not files:
        return

    storage["managed"] = True
    storage["copyPolicy"] = "snapshot"
    storage["primaryPath"] = str(Path(files[0]["sourcePath"]).parent)
    storage.setdefault("snapshotPath", "")
    storage["files"] = files


def resource_timestamp(resource):
    audit = resource.get("audit") if isinstance(resource.get("audit"), dict) else {}
    for key in ("createdAt", "lastModifiedAt"):
        value = str(audit.get(key) or "").strip()
        if not value:
            continue
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone()
        except Exception:
            continue
    return now


def resource_identity_key(resource):
    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    storage = resource.get("storage") if isinstance(resource.get("storage"), dict) else {}
    return str(identity.get("canonicalUri") or identity.get("uri") or storage.get("sourcePath") or "").strip()


def resource_uri_values(resource):
    identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
    viewer = resource.get("viewer") if isinstance(resource.get("viewer"), dict) else {}
    embed = viewer.get("embed") if isinstance(viewer.get("embed"), dict) else {}
    snapshot_sources = resource.get("snapshotSources") if isinstance(resource.get("snapshotSources"), dict) else {}
    return [
        str(identity.get("uri") or "").strip(),
        str(embed.get("uri") or "").strip(),
        str(snapshot_sources.get("previewUri") or "").strip(),
        str(identity.get("canonicalUri") or "").strip(),
        str(snapshot_sources.get("originalUri") or "").strip(),
    ]


def has_resource_uri(resource):
    return any(resource_uri_values(resource))


def snapshot_filename(item, src):
    role = str(item.get("role") or "").strip()
    suffix = src.suffix or Path(str(item.get("path") or "")).suffix or ".bin"
    if role == "preview":
        return "preview.pdf"
    if role == "thumbnail":
        return f"thumbnail{suffix}"
    if role == "original":
        return f"original{suffix}"
    return Path(str(item.get("path") or src.name)).name


def merge_resource_uri_fields(resource, existing):
    identity = resource.setdefault("identity", {})
    if not isinstance(identity, dict):
        identity = {}
        resource["identity"] = identity
    existing_identity = existing.get("identity") if isinstance(existing.get("identity"), dict) else {}
    if not str(identity.get("uri") or "").strip() and existing_identity.get("uri"):
        identity["uri"] = existing_identity.get("uri")
    if not str(identity.get("canonicalUri") or "").strip() and existing_identity.get("canonicalUri"):
        identity["canonicalUri"] = existing_identity.get("canonicalUri")

    viewer = resource.setdefault("viewer", {})
    if not isinstance(viewer, dict):
        viewer = {}
        resource["viewer"] = viewer
    embed = viewer.setdefault("embed", {})
    if not isinstance(embed, dict):
        embed = {}
        viewer["embed"] = embed
    existing_viewer = existing.get("viewer") if isinstance(existing.get("viewer"), dict) else {}
    existing_embed = existing_viewer.get("embed") if isinstance(existing_viewer.get("embed"), dict) else {}
    if not str(embed.get("uri") or "").strip() and existing_embed.get("uri"):
        embed["uri"] = existing_embed.get("uri")

    snapshot_sources = resource.setdefault("snapshotSources", {})
    if not isinstance(snapshot_sources, dict):
        snapshot_sources = {}
        resource["snapshotSources"] = snapshot_sources
    existing_snapshot_sources = existing.get("snapshotSources") if isinstance(existing.get("snapshotSources"), dict) else {}
    for key in ("previewUri", "originalUri", "thumbnailUri"):
        if not str(snapshot_sources.get(key) or "").strip() and existing_snapshot_sources.get(key):
            snapshot_sources[key] = existing_snapshot_sources.get(key)


def iter_resource_json(root):
    if root.exists():
        yield from root.rglob("resource.json")


def find_existing_primary_resource_by_id(rid):
    if not rid:
        return None
    for resource_json in iter_resource_json(resource_root):
        if resource_json.parent.name == rid:
            return resource_json.parent
        try:
            existing = json.loads(resource_json.read_text(encoding="utf-8", errors="strict"))
        except Exception:
            continue
        if isinstance(existing, dict) and str(existing.get("id") or "") == rid:
            return resource_json.parent
    return None


def find_existing_primary_resource(resource):
    key = resource_identity_key(resource)
    if not key:
        return None
    for resource_json in iter_resource_json(resource_root):
        try:
            existing = json.loads(resource_json.read_text(encoding="utf-8", errors="strict"))
        except Exception:
            continue
        if isinstance(existing, dict) and resource_identity_key(existing) == key:
            return resource_json.parent
    return None


def save_primary_resource_definition(resource):
    rid = str(resource.get("id") or "").strip()
    if not rid:
        return
    storage = resource.get("storage")
    if not isinstance(storage, dict):
        storage = {}
        resource["storage"] = storage

    primary = find_existing_primary_resource(resource)
    if primary is None and not has_resource_uri(resource):
        primary = find_existing_primary_resource_by_id(rid)
    should_write = True
    if primary is None:
        ts = resource_timestamp(resource)
        primary = resource_root / ts.strftime("%Y") / ts.strftime("%m") / ts.strftime("%d") / rid
    elif primary.name != rid:
        should_write = False

    primary.mkdir(parents=True, exist_ok=True)
    try:
        storage["primaryPath"] = primary.relative_to(resource_root).as_posix()
    except Exception:
        storage["primaryPath"] = str(primary)
    if not should_write:
        return

    resource_json = primary / "resource.json"
    if resource_json.is_file() and not has_resource_uri(resource):
        try:
            existing_resource = json.loads(resource_json.read_text(encoding="utf-8", errors="strict"))
            if isinstance(existing_resource, dict) and has_resource_uri(existing_resource):
                merge_resource_uri_fields(resource, existing_resource)
        except Exception:
            pass
    resource_json.write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def copy_resource_snapshot(resource, base_root):
    storage = resource.get("storage")
    if not isinstance(storage, dict):
        return
    if storage.get("managed") is not True or storage.get("copyPolicy") != "snapshot":
        return
    rid = str(resource.get("id") or "").strip()
    if not rid:
        return

    primary = resolve_storage_dir(str(storage.get("primaryPath") or ""), base_root)
    snapshot = resolve_storage_dir(str(storage.get("snapshotPath") or ""), base_root)
    if snapshot is None:
        snapshot = note_resource_dir / rid
        storage["snapshotPath"] = snapshot.as_posix()
    snapshot.mkdir(parents=True, exist_ok=True)
    snapshot_files = []
    snapshot_sources = resource.get("snapshotSources") if isinstance(resource.get("snapshotSources"), dict) else {}
    if not isinstance(resource.get("snapshotSources"), dict):
        resource["snapshotSources"] = snapshot_sources
    viewer = resource.get("viewer") if isinstance(resource.get("viewer"), dict) else {}
    if not isinstance(resource.get("viewer"), dict):
        resource["viewer"] = viewer
    embed = viewer.get("embed") if isinstance(viewer.get("embed"), dict) else {}
    if not isinstance(viewer.get("embed"), dict):
        viewer["embed"] = embed
    for item in storage.get("files") or []:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "original").strip() or "original"
        if role == "original":
            snapshot_files.append(dict(item))
            continue
        rel = str(item.get("path") or "").replace("\\", "/").strip("/")
        if not rel:
            continue
        source_path = str(item.get("sourcePath") or "").strip()
        if source_path:
            src = local_file_from_uri(source_path, base_root)
            if src is None:
                src = Path(source_path)
        else:
            src = storage_file_from_item(item, base_root)
            if src is None:
                src = primary / rel if primary is not None else Path()
        if not src.is_file():
            snapshot_files.append(dict(item))
            continue
        dst = snapshot / snapshot_filename(item, src)
        shutil.copy2(src, dst)
        snapshot_item = dict(item)
        snapshot_item["area"] = "note"
        snapshot_item["path"] = f"resource/{rid}/{dst.name}"
        snapshot_item.pop("sourcePath", None)
        snapshot_files.append(snapshot_item)
        snapshot_uri = public_uri_from_storage_path(dst, user_id)
        if snapshot_uri:
            if role == "thumbnail":
                snapshot_sources["thumbnailUri"] = snapshot_uri
                viewer["thumbnailUri"] = snapshot_uri
                embed["thumbnailUri"] = snapshot_uri
            elif role == "preview":
                snapshot_sources["previewUri"] = snapshot_uri
                identity = resource.get("identity") if isinstance(resource.get("identity"), dict) else {}
                if not isinstance(resource.get("identity"), dict):
                    resource["identity"] = identity
                identity["uri"] = snapshot_uri
                embed["uri"] = snapshot_uri

    if snapshot_files:
        storage["files"] = snapshot_files
    storage["snapshotPath"] = snapshot.as_posix()

    (snapshot / "resource.json").write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def public_uri_from_storage_path(path, user_id):
    path_s = Path(path).resolve().as_posix()
    uid = str(user_id or "").strip("/")
    if not uid:
        return ""
    markers = [
        f"/wu_wei2/data/{uid}/note/",
        f"/wu_wei2/{uid}/note/",
    ]
    for marker in markers:
        idx = path_s.find(marker)
        if idx < 0:
            continue
        rel = path_s[idx + len(marker):].lstrip("/")
        if marker.startswith("/wu_wei2/data/"):
            return f"/wu_wei2/data/{uid}/note/{rel}"
        return f"/wu_wei2/note/{uid}/{rel}"
    return ""


def safe_bundle_filename(value, fallback):
    name = Path(str(value or "").replace("\\", "/")).name
    name = "".join(c for c in name if c not in "\r\n\t")
    return name or fallback


def embedded_bundle_files(note):
    for key in ("bundle", "portable", "resourceBundle"):
        bundle = note.get(key)
        if not isinstance(bundle, dict):
            continue
        files = bundle.get("files")
        if isinstance(files, list):
            return files
    return []


def restore_embedded_resource_files(note):
    bundle_files = embedded_bundle_files(note)
    if not bundle_files:
        return
    resources = note.get("resources") if isinstance(note.get("resources"), list) else []
    by_id = {
        str(resource.get("id") or ""): resource
        for resource in resources
        if isinstance(resource, dict) and str(resource.get("id") or "")
    }
    for index, item in enumerate(bundle_files, start=1):
        if not isinstance(item, dict):
            continue
        rid = str(item.get("resourceId") or item.get("resource_id") or "").strip()
        resource = by_id.get(rid)
        encoded = str(item.get("base64") or item.get("body") or "").strip()
        if not rid or resource is None or not encoded:
            continue
        try:
            payload = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            continue
        role = str(item.get("role") or "original").strip() or "original"
        bundle_path = str(item.get("path") or item.get("name") or "").replace("\\", "/").strip("/")
        source_filename = safe_bundle_filename(bundle_path, f"{role}-{index}.bin")
        filename = snapshot_filename({"role": role, "path": source_filename}, Path(source_filename))
        mime_type = str(item.get("mimeType") or item.get("mime_type") or "application/octet-stream").strip()
        sha256 = hashlib.sha256(payload).hexdigest()

        storage = resource.get("storage")
        if not isinstance(storage, dict):
            storage = {}
            resource["storage"] = storage
        ts = resource_timestamp(resource)
        primary = find_existing_primary_resource(resource)
        if primary is None:
            primary = find_existing_primary_resource_by_id(rid)
        if primary is None:
            primary = resource_root / ts.strftime("%Y") / ts.strftime("%m") / ts.strftime("%d") / rid
        snapshot = note_resource_dir / rid

        primary.mkdir(parents=True, exist_ok=True)
        snapshot.mkdir(parents=True, exist_ok=True)
        if bundle_path.startswith("upload/"):
            stored_rel = bundle_path[len("upload/"):].strip("/")
            dest_file = upload_root / stored_rel
            storage_path = stored_rel
            storage_source = str(dest_file)
        elif bundle_path.startswith("note/resource/"):
            note_rel = bundle_path[len("note/resource/"):].strip("/")
            parts = note_rel.split("/", 1)
            stored_rel = parts[1] if len(parts) == 2 and parts[0] == rid else note_rel
            dest_file = snapshot / stored_rel
            storage_path = Path(stored_rel).name
            storage_source = str(dest_file)
        elif role == "original":
            stored_rel = bundle_path or f"{resource_timestamp(resource):%Y/%m/%d}/{rid}/{filename}"
            dest_file = upload_root / stored_rel
            storage_path = stored_rel
            storage_source = str(dest_file)
        else:
            storage_path = filename
            dest_file = snapshot / storage_path
            storage_source = str(dest_file)
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        dest_file.write_bytes(payload)

        storage["managed"] = True
        storage["copyPolicy"] = "snapshot"
        storage["primaryPath"] = str(primary)
        storage["snapshotPath"] = str(snapshot)
        if role == "original":
            storage["sourcePath"] = storage_path
        files = storage.get("files")
        if not isinstance(files, list):
            files = []
        files = [f for f in files if not (isinstance(f, dict) and str(f.get("role") or "") == role)]
        files.append({
            "role": role,
            "path": storage_path,
            "sourcePath": storage_source,
            "mimeType": mime_type,
            "size": len(payload),
            "sha256": sha256,
        })
        storage["files"] = files
        (primary / "resource.json").write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        (snapshot / "resource.json").write_text(json.dumps(resource, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    note.pop("portable", None)
    note.pop("resourceBundle", None)
    note.pop("bundle", None)


note = load_note(json_file)
note["note_id"] = note.get("note_id") or note_id
note["resources"] = note.get("resources") or []
base_root = note_root.parent
restore_embedded_resource_files(note)
for resource in note.get("resources") or []:
    if not isinstance(resource, dict):
        continue
    save_primary_resource_definition(resource)
    promote_local_resource_snapshot(resource)
    save_primary_resource_definition(resource)
    copy_resource_snapshot(resource, base_root)

json_file.write_text(json.dumps(note, ensure_ascii=False, separators=(",", ":")), encoding="utf-8", newline="\n")
PY
  else
    save_note_resources "$json_file" "$resource_root" "$note_resource_dir"
  fi
}

# --- Collect CGI params from QUERY_STRING + POST body -------------------
qs=${QUERY_STRING:-}
body=""
cl=${CONTENT_LENGTH:-0}

if [ "${cl:-0}" -gt 0 ] 2>/dev/null; then
  # FastCGI provides exactly the request body on stdin. A single large
  # dd block can return a short read from a pipe, so read until EOF.
  body=$(cat || true)
fi

if [ -n "$qs" ] && [ -n "$body" ]; then
  printf '%s&%s' "$qs" "$body" > "$CGIVARS_ORG"
elif [ -n "$qs" ]; then
  printf '%s' "$qs" > "$CGIVARS_ORG"
elif [ -n "$body" ]; then
  printf '%s' "$body" > "$CGIVARS_ORG"
else
  : > "$CGIVARS_ORG"
fi

# Keep current cgi-name based parsing, but do NOT persist its output as-is.
cgi-name -s"$ACK" < "$CGIVARS_ORG" > "$CGIVARS"

session_user_id=$(is-login || true)
user_id=$(nameread user_id "$CGIVARS" | strip_quotes || true)
[ -n "${user_id:-}" ] || user_id=$(raw_form_value user_id "$CGIVARS_ORG" | strip_quotes || true)

if [ -z "${session_user_id:-}" ] || [ -z "${user_id:-}" ] || [ "$user_id" != "$session_user_id" ]; then
  debug_log "not_logged_in session_user_id=${session_user_id:-} user_id=${user_id:-}"
  error_response 'ERROR NOT LOGGED IN'
fi

note_base=$(resolve_env_path note "$user_id" || true)
resource_base=$(resolve_env_path resource "$user_id" || true)

[ -n "${note_base:-}" ] || error_response 'ERROR NOTE DIRECTORY NOT DEFINED'
[ -n "${resource_base:-}" ] || error_response 'ERROR RESOURCE DIRECTORY NOT DEFINED'

id=$(nameread id "$CGIVARS" | strip_quotes || true)
name=$(nameread name "$CGIVARS" | strip_quotes || true)
description=$(nameread description "$CGIVARS" | strip_quotes || true)
thumbnail=$(nameread thumbnail "$CGIVARS" | strip_quotes || true)
json=$(nameread json "$CGIVARS" | strip_quotes || true)
debug_log "request user_id=$user_id id=$id name=$name content_length=${CONTENT_LENGTH:-0}"
debug_preview "json_raw" "$json"

[ -n "${id:-}" ] || error_response 'ERROR ID NOT SPECIFIED'
[ -n "${json:-}" ] || error_response 'ERROR JSON NOT SPECIFIED'

# Restore placeholders introduced by cgi-name -s and normalise metadata to single lines.
name=$(printf '%s' "$name" | restore_ack_to_space | single_line_meta)
description=$(printf '%s' "$description" | restore_ack_to_space | single_line_meta)
thumbnail=$(printf '%s' "$thumbnail" | restore_ack_to_space | single_line_meta)
json=$(printf '%s' "$json" | restore_ack_to_space)

# Remove BOM only. JSON content itself should remain unchanged.
json=$(printf '%s' "$json" | sed '1s/^\xEF\xBB\xBF//')
debug_preview "json" "$json"

note_dir="$note_base/$year/$month/$day/$id"
note_resource_dir="$note_dir/resource"
mkdir -p "$note_dir" || error_response 'ERROR NOTE DIRECTORY CREATE FAILED'

JSON_FILE="${Tmp}-note.json"
printf '%s' "$json" > "$JSON_FILE"
process_note_json "$JSON_FILE" "$note_base" "$resource_base" "$note_resource_dir" "$user_id" "$id" || error_response 'ERROR RESOURCE SNAPSHOT FAILED'
json=$(cat "$JSON_FILE")

json_base64=$(printf '%s' "$json" | base64 | tr -d '\n')
[ -n "${json_base64:-}" ] || error_response 'ERROR JSON ENCODE FAILED'
debug_log "json_base64_len=$(printf '%s' "$json_base64" | wc -c | tr -d ' ') note_dir=$note_dir"

outfile="$note_dir/note.json"
{
  printf 'format_version 2\n'
  printf 'id %s\n' "$id"
  printf 'user_id %s\n' "$user_id"
  printf 'name %s\n' "$name"
  printf 'description %s\n' "$description"
  printf 'thumbnail %s\n' "$thumbnail"
  printf 'saved_at %s\n' "$saved_at"
  printf 'json_encoding base64\n'
  printf 'json_base64 %s\n' "$json_base64"
} > "$outfile" || error_response 'ERROR SAVE FAILED'

ok_response "$name"

rm -f "$Tmp" "$Tmp"-*
exit 0
