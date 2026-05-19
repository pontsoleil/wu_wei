WuWei resource storage and runtime URL policy 2026-05-19
========================================================

Scope
-----
This document integrates the resource storage policy and the runtime URL
policy.  The canonical v2 upload path is:

  YYYY/MM/DD/file_uuid/filename

Example:

  2026/05/19/_8ed59104-779e-4907-9978-6f0f1acb8cf5/example.pdf

Legacy v1 and older month-based paths such as `YYYY/MM/filename` are accepted
only by migration/resolution code for old notes.

Storage policy
--------------
1. Stored resource paths remain logical paths.

   The following fields store user-facing logical paths, not server physical
   paths and not generated runtime URLs:

     resource.uri
     resource.canonicalUri
     resource.storage.files[].path

2. Physical server-root-relative directories are stored separately.

   `resource.storage.files[].dir_name` stores the physical directory relative
   to the server root, for example:

     data/{user_uuid}/upload/YYYY/MM/DD/file_uuid

   `resource.storage.files[].file_name` stores the physical file name inside
   that directory.

3. `resource.storage.files[]` is role based.

   Each managed file role has its own entry:

     original
     preview
     thumbnail
     manifest

   The roles may share the same `dir_name` upload bundle while keeping distinct
   logical paths.

Runtime URL policy
------------------
Runtime URLs are generated from the logical path and role.  They are not stored
as canonical data.

Normal protected access:

  cgi-bin/load-file.py?area=upload&path=YYYY/MM/DD/file_uuid/filename&role=original

or, from the shell CGI side:

  /wu_wei2/server/load-file.cgi?area=upload&path=YYYY/MM/DD/file_uuid/filename&role=original

Normal generated load-file URLs must not include `user_id`; the active session
decides the user.

Office Viewer / public PDF-Office upload files may use direct nginx-public
upload URLs when policy allows it:

  /wu_wei2/data/{user_uuid}/upload/YYYY/MM/DD/file_uuid/filename

Private files, thumbnails, generated previews, manifests, and legacy content
use `load-file.py` / `load-file.cgi`.

Server delivery
---------------
`cgi-bin/load-file.py` validates session user, area, role, and logical path.
It resolves v2 paths through:

  data/{user_uuid}/upload/_index/path/YYYY/MM/DD/file_uuid/filename.json

If the index is unavailable, role remapping is not attempted.  The caller must
provide a valid v2 logical path or a path that directly addresses the managed
file.  The CGI layer must not perform upload-tree scans or SHA dedupe.

After validation, `load-file.py` emits `X-Accel-Redirect` to the resolved
physical file, for example:

  /_wuwei2_data/{user_uuid}/upload/YYYY/MM/DD/file_uuid/thumbnail.jpg

The script does not stream the file body after emitting `X-Accel-Redirect`.

Out of scope
------------
SHA-based duplicate handling is intentionally not included in this revision.
This package does not create monthly SHA maps, does not maintain alternate
path or digest maps for duplicate resolution, and does not reuse an existing
upload bundle based on SHA.

Resource example
----------------
  {
    "uri": "2026/05/19/_8ed59104-779e-4907-9978-6f0f1acb8cf5/example.docx",
    "canonicalUri": "2026/05/19/_8ed59104-779e-4907-9978-6f0f1acb8cf5/example.docx",
    "storage": {
      "managed": true,
      "copyPolicy": "reference",
      "files": [
        {
          "role": "original",
          "area": "upload",
          "path": "2026/05/19/_8ed59104-779e-4907-9978-6f0f1acb8cf5/example.docx",
          "dir_name": "data/{user_uuid}/upload/2026/05/19/_8ed59104-779e-4907-9978-6f0f1acb8cf5",
          "file_name": "example.docx",
          "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
      ]
    }
  }

Implemented files
-----------------
app2/model/wuwei.resource.js
  Central runtime URL helpers:
    getRoleUrl()
    getDirectUploadUrl()
    getOfficeViewerUrl()
    getOpenUrl()
    getViewerUrl()
    getThumbnailUrl()

app2/misc/wuwei.util.js
  Logical path normalization, load-file URL generation without `user_id`, and
  direct public upload URLs for allowed PDF/Office files.

app2/model/wuwei.note.v2.js
  Quasi-v2 and legacy resource path normalization.  Preserves
  `YYYY/MM/DD/file_uuid/filename` and adds or preserves `dir_name` and
  `file_name`.

app2/model/wuwei.note.v0.js, app2/model/wuwei.note.v1.js
  Legacy migration to role-based `storage.files[]` entries where information is
  available.

cgi-bin/upload.py, cgi-bin/upload-video.py
  New uploads use `YYYY/MM/DD/file_uuid/filename`.  Resource JSON stores
  logical paths plus `dir_name` and `file_name`; response URLs are runtime
  URLs without `user_id`.

cgi-bin/load-file.py, server/load-file.cgi
  Resolve logical paths and role-specific files, then deliver through
  `X-Accel-Redirect`.

cgi-bin/resource_common.py, server/list-resource.cgi
  Home/resource list returns runtime `original_uri` for display/download
  routes before logical canonical paths.
