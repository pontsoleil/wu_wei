# Unsaved note draft slot: `new_note`

WuWei uses the fixed id `new_note` only as an unsaved draft id while the user is editing a newly-created note.

## Current policy

The draft note is a lightweight editing state. Upload bodies, upload thumbnails, and Office preview PDFs are not stored under `note/YYYY/MM/DD/new_note/resource/` as the primary location.

Uploaded content is stored immediately under the user's upload area:

```text
data/{user_uuid}/upload/YYYY/MM/DD/{upload_uuid}/manifest.json
data/{user_uuid}/upload/YYYY/MM/DD/{upload_uuid}/{original_file}
data/{user_uuid}/upload/YYYY/MM/DD/{upload_uuid}/thumbnail.jpg
data/{user_uuid}/upload/YYYY/MM/DD/{upload_uuid}/preview.pdf
```

The in-memory Note JSON references those files through Resource metadata:

```json
{
  "note_id": "new_note",
  "note_uuid": "new_note",
  "resources": [
    {
      "id": "_upload_uuid",
      "storage": {
        "files": [
          {
            "role": "original",
            "area": "upload",
            "path": "YYYY/MM/DD/_upload_uuid/original.docx"
          },
          {
            "role": "thumbnail",
            "area": "upload",
            "path": "YYYY/MM/DD/_upload_uuid/thumbnail.jpg"
          },
          {
            "role": "preview",
            "area": "upload",
            "path": "YYYY/MM/DD/_upload_uuid/preview.pdf"
          }
        ]
      }
    }
  ]
}
```

## Save promotion

When the user saves a new note, `save-note` assigns a permanent note UUID and stores the Note JSON at:

```text
data/{user_uuid}/note/YYYY/MM/DD/{note_uuid}/note.json
```

During this save:

- `note_id` becomes `{note_uuid}`.
- `note_uuid` becomes `{note_uuid}`.
- References to uploaded content remain `area=upload` with user-independent relative paths.
- Upload bodies, `thumbnail.jpg`, and `preview.pdf` are not copied into the note directory during normal save.

This keeps save fast and avoids duplicating large files. A portable note ZIP is assembled only when the user explicitly downloads the note.

## Recovery

If editing is interrupted before save, the upload files may still exist under `upload/YYYY/MM/DD/{upload_uuid}/`.

Draft recovery can use `list-note` with the option that includes `new_note` only when a valid draft `note.json` exists. Broken or empty note directories must not appear in the normal note list.

## Implementations

- Browser model: `app2/model/wuwei.note.js`
- Local Python CGI: `cgi-bin/save-note.py`, `cgi-bin/export-note.py`, `cgi-bin/import-note.py`
- Linux Bash CGI: `server/save-note.cgi`, `server/export-note.cgi`, `server/import-note.cgi`
