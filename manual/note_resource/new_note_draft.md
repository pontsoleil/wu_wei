# Unsaved note draft slot: `new_note`

WuWei keeps an unsaved newly-created note in a fixed draft slot before it is
promoted to a permanent note UUID.

## Directory layout

```text
data/{user_uuid}/note/YYYY/MM/DD/new_note/
data/{user_uuid}/note/YYYY/MM/DD/new_note/note.json
data/{user_uuid}/note/YYYY/MM/DD/new_note/resource/{resource_uuid}/...
```

The draft `note.json` records the temporary id as:

```json
{
  "note_id": "new_note",
  "note_uuid": "new_note"
}
```

## Save promotion

When the user saves the note, `save-note` creates a new permanent note UUID and
copies the whole draft directory to the permanent location:

```text
data/{user_uuid}/note/YYYY/MM/DD/{note_uuid}/
```

After copying, the saved `note.json` is rewritten so that:

- `note_id` becomes `{note_uuid}`.
- `note_uuid` becomes `{note_uuid}`.
- Note-local storage paths containing `/new_note/` become `/{note_uuid}/`.
- Uploaded originals remain in `data/{user_uuid}/upload/...`.
- Thumbnail and preview snapshots are written under the saved note directory.

This keeps upload previews stable while the user is still editing a new note,
and it avoids losing note-local resource metadata before the first save.

## Implementations

- Browser model: `app2/model/wuwei.note.js`
- Local Python CGI: `cgi-bin/save-note.py`
- Linux Bash CGI: `server/save-note.cgi`
