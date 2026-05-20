#!/bin/sh
# import-note.cgi
#
# Import a WuWei note export package without delegating to Python.
# The exported note identity is preserved.  Legacy v0/v1 note ids that start
# with '_' are valid and must not be rejected as UUID errors.

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "${SCRIPT_FILENAME:-$0}")" && pwd) || exit 1
cd "$SCRIPT_DIR" || exit 1
mkdir -p log
exec 2>>"$SCRIPT_DIR/log/cgi.err"

set -eu
export LC_ALL=C
if command -v getconf >/dev/null 2>&1; then
  export PATH=".:./bin:$(command -p getconf PATH)${PATH+:}${PATH-}"
fi
export UNIX_STD=2003

Tmp="/tmp/${0##*/}.$$"
CGIVARS="${Tmp}-cgivars"
UPLOAD_ZIP="${Tmp}-upload.zip"
FIELDS="${Tmp}-fields"
ENTRIES="${Tmp}-entries"
RAW_POST="${Tmp}-raw-post"

cleanup() {
  rm -f "$CGIVARS" "$UPLOAD_ZIP" "$FIELDS" "$ENTRIES" "$RAW_POST" "$Tmp"-*
}
trap cleanup EXIT HUP INT TERM

log_debug() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >> "$SCRIPT_DIR/log/import-note.debug.log" || true
}

error_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' "$1"
  log_debug "$1"
  exit 0
}

ok_response() {
  printf '%s\r\n' 'Content-Type: text/plain; charset=UTF-8'
  printf '\r\n'
  printf '%s\n' 'OK NOTE IMPORTED'
  printf 'note_key=%s\n' "$1"
  exit 0
}

strip_quotes() {
  sed 's/^"\(.*\)"$/\1/'
}

decode_minimal() {
  sed 's/+/ /g; s/%2[Ff]/\//g; s/%2[Dd]/-/g; s/%5[Ff]/_/g; s/%40/@/g; s/%3[Aa]/:/g; s/%20/ /g'
}

raw_query_param() {
  key=$1
  printf '%s' "${QUERY_STRING:-}" |
    tr '&' '\n' |
    sed -n "s/^${key}=//p" |
    head -n 1 |
    decode_minimal
}

field_value() {
  key=$1
  if [ -f "$FIELDS" ]; then
    sed -n "s/^${key}=//p" "$FIELDS" | head -n 1 | decode_minimal
  fi
}

valid_user_id() {
  case "$1" in
    ''|*/*|*..*|ERROR*) return 1 ;;
    *[!A-Za-z0-9._-]*) return 1 ;;
    *) return 0 ;;
  esac
}

safe_rel_path() {
  rel=$(printf '%s' "$1" | sed 's#\\#/#g; s#^/*##; s#/*$##')
  case "$rel" in
    ''|/*|*'/../'*|'../'*|*'/..'|'.'|'..'|*'//'*) return 1 ;;
    *[!A-Za-z0-9._/@+-]*) return 1 ;;
    *) printf '%s\n' "$rel" ;;
  esac
}

safe_zip_entry() {
  entry=$(printf '%s' "$1" | sed 's#\\#/#g; s#^/*##')
  case "$entry" in
    ''|/*|*'/../'*|'../'*|*'/..'|'.'|'..'|*'//'*) return 1 ;;
    *[!A-Za-z0-9._/@+-]*) return 1 ;;
    *) printf '%s\n' "$entry" ;;
  esac
}

resolve_env_path() {
  key=$1
  uid=${2:-}
  tpl=$(nameread "$key" data/environment | strip_quotes || true)
  [ -n "$tpl" ] || return 1
  if [ -n "$uid" ]; then
    tpl=$(printf '%s' "$tpl" | sed "s#/*\\*/*#/${uid}/#; s#\\*#${uid}#")
  fi
  case "$tpl" in
    [A-Za-z]:/*|[A-Za-z]:\\*) printf '%s\n' "$tpl" ;;
    /*) printf '%s\n' "$tpl" ;;
    wu_wei2/*) printf '%s/%s\n' "$(dirname "$SCRIPT_DIR")" "${tpl#wu_wei2/}" ;;
    *) printf '%s/%s\n' "$SCRIPT_DIR" "$tpl" ;;
  esac
}

area_dir() {
  area=$1
  uid=$2
  path=$(resolve_env_path "$area" "$uid" || true)
  if [ -n "$path" ]; then
    printf '%s\n' "$path"
    return 0
  fi

  # Fallback for areas that are not yet listed in data/environment.
  # If note is .../data/{user_id}/note, sibling areas are under the same user dir.
  note_base=$(resolve_env_path note "$uid" || true)
  if [ -n "$note_base" ]; then
    printf '%s/%s\n' "$(dirname "$note_base")" "$area"
    return 0
  fi
  return 1
}

parse_request() {
  method=${REQUEST_METHOD:-}
  [ "$method" = 'POST' ] || error_response 'ERROR POST ONLY'

  ctype=${CONTENT_TYPE:-}
  cl=${CONTENT_LENGTH:-0}
  [ "${cl:-0}" -gt 0 ] 2>/dev/null || error_response 'ERROR EMPTY REQUEST'

  case "$ctype" in
    multipart/form-data*)
      # Shell variables cannot safely hold ZIP binary content.  Save the raw
      # request body to a file, then use a small Perl binary parser only to
      # split the multipart body into a file and text fields; the import logic
      # itself remains this shell script.
      cat > "$RAW_POST"
      set +e
      perl -Mbytes - "$ctype" "$RAW_POST" "$UPLOAD_ZIP" "$FIELDS" <<'PL'
use strict;
use warnings;
binmode STDIN;
binmode STDOUT;
my ($ctype, $raw_path, $zip_path, $fields_path) = @ARGV;
$ctype =~ /boundary=(?:"([^"]+)"|([^;]+))/ or exit 2;
my $boundary = defined($1) ? $1 : $2;
$boundary =~ s/^\s+|\s+$//g;
open my $raw, '<:raw', $raw_path or exit 6;
my $body = do { local $/; <$raw> };
close $raw;
my $marker = "--$boundary";
open my $fields, '>:raw', $fields_path or exit 3;
my $got_file = 0;
for my $part (split(/\Q$marker\E/, $body)) {
    next if $part =~ /^--/;
    $part =~ s/^\r?\n//;
    $part =~ s/\r?\n$//;
    next if $part eq '';
    my ($headers, $content) = split(/\r?\n\r?\n/, $part, 2);
    next unless defined $content;
    $content =~ s/\r?\n\z//;
    my $name = '';
    my $filename = '';
    for my $h (split(/\r?\n/, $headers)) {
        if ($h =~ /^Content-Disposition:/i) {
            $name = $1 if $h =~ /name="([^"]*)"/;
            $filename = $1 if $h =~ /filename="([^"]*)"/;
        }
    }
    next unless $name ne '';
    if ($filename ne '' || $name eq 'file') {
        open my $out, '>:raw', $zip_path or exit 4;
        print {$out} $content;
        close $out;
        $got_file = 1;
    } else {
        $content =~ s/[\r\n].*\z//s;
        $content =~ s/([\r\n=])/sprintf('%%%02X', ord($1))/eg;
        print {$fields} "$name=$content\n";
    }
}
close $fields;
exit($got_file ? 0 : 5);
PL
      rc=$?
      set -e
      [ "$rc" -eq 0 ] || error_response 'ERROR FILE NOT UPLOADED'
      ;;
    application/x-www-form-urlencoded*)
      cat > "$CGIVARS"
      error_response 'ERROR FILE NOT UPLOADED'
      ;;
    *)
      error_response 'ERROR UNSUPPORTED CONTENT TYPE'
      ;;
  esac
}

list_zip_entries() {
  if command -v zipinfo >/dev/null 2>&1; then
    zipinfo -1 "$UPLOAD_ZIP" > "$ENTRIES"
  else
    unzip -Z1 "$UPLOAD_ZIP" > "$ENTRIES"
  fi
}

copy_zip_entry() {
  entry=$1
  target=$2
  mkdir -p "$(dirname "$target")"
  unzip -p "$UPLOAD_ZIP" "$entry" > "$target"
}

copy_area_entries() {
  area=$1
  uid=$2
  base=$(area_dir "$area" "$uid" || true)
  [ -n "$base" ] || return 0

  grep -E "^${area}/" "$ENTRIES" | while IFS= read -r entry; do
    safe=$(safe_zip_entry "$entry") || continue
    case "$safe" in
      */) continue ;;
    esac
    rel=${safe#${area}/}
    rel=$(safe_rel_path "$rel") || continue
    target="$base/$rel"
    case "$target" in
      "$base"/*) copy_zip_entry "$safe" "$target" ;;
    esac
  done
}

parse_request

session_user_id=$(is-login || true)
user_id=$(field_value user_id || true)
[ -n "${user_id:-}" ] || user_id=$(raw_query_param user_id || true)
[ -n "${user_id:-}" ] || user_id=${session_user_id:-}

[ -n "${user_id:-}" ] || error_response 'ERROR NOT LOGGED IN'
valid_user_id "$user_id" || error_response 'ERROR INVALID USER ID'

if [ "${user_id}" != 'guest' ]; then
  [ -n "${session_user_id:-}" ] || error_response 'ERROR NOT LOGGED IN'
  [ "$user_id" = "$session_user_id" ] || error_response 'ERROR USER MISMATCH'
fi

[ -s "$UPLOAD_ZIP" ] || error_response 'ERROR FILE NOT UPLOADED'
if ! unzip -tq "$UPLOAD_ZIP" >/dev/null 2>&1; then
  error_response 'ERROR INVALID ZIP FILE'
fi

list_zip_entries || error_response 'ERROR INVALID ZIP FILE'

# Reject unsafe paths before writing anything.
while IFS= read -r entry; do
  safe_zip_entry "$entry" >/dev/null || error_response 'ERROR INVALID PACKAGE PATH'
done < "$ENTRIES"

note_entry=$(grep -E '^note/.+/note\.json$' "$ENTRIES" | head -n 1 || true)
[ -n "$note_entry" ] || error_response 'ERROR NOTE JSON NOT FOUND'

note_rel=${note_entry#note/}
note_rel=$(safe_rel_path "$note_rel") || error_response 'ERROR INVALID NOTE KEY'
case "$note_rel" in
  */note.json) ;;
  *) error_response 'ERROR INVALID NOTE KEY' ;;
esac

note_key=${note_rel%/note.json}
[ -n "$note_key" ] || error_response 'ERROR INVALID NOTE KEY'

note_dir=$(area_dir note "$user_id" || true)
[ -n "$note_dir" ] || error_response 'ERROR NOTE DIRECTORY NOT FOUND'
mkdir -p "$note_dir" || error_response 'ERROR NOTE DIRECTORY NOT FOUND'

target_note="$note_dir/$note_rel"
case "$target_note" in
  "$note_dir"/*) ;;
  *) error_response 'ERROR INVALID NOTE PATH' ;;
esac

replace=$(field_value replace || true)
[ -n "${replace:-}" ] || replace=$(field_value overwrite || true)
[ -n "${replace:-}" ] || replace=$(raw_query_param replace || true)
case "${replace:-}" in
  1|true|TRUE|yes|YES|on|ON) replace=1 ;;
  *) replace=0 ;;
esac

if [ -f "$target_note" ]; then
  existing_tmp="${Tmp}-existing-note"
  copy_zip_entry "$note_entry" "$existing_tmp"
  if cmp -s "$target_note" "$existing_tmp"; then
    rm -f "$existing_tmp"
  else
    rm -f "$existing_tmp"
    [ "$replace" = 1 ] || error_response 'ERROR NOTE ALREADY EXISTS'
  fi
fi

# Copy managed resource files if the package contains them.  Missing resources
# are tolerated because legacy exports may contain note JSON only and may refer
# to already existing data/{createdBy}/content or thumbnail files.
copy_area_entries content "$user_id"
copy_area_entries thumbnail "$user_id"
copy_area_entries upload "$user_id"
copy_area_entries resource "$user_id"

copy_zip_entry "$note_entry" "$target_note" || error_response 'ERROR NOTE IMPORT FAILED'

ok_response "$note_key"

# last modified at 2026-05-20