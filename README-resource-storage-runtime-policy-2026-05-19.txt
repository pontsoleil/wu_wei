WuWei resource storage/runtime URL policy patch
================================================
Date: 2026-05-19

This document has been integrated into:

  README-resource-storage-policy-2026-05-19.txt

The integrated policy is the canonical reference for both stored resource
paths and runtime URL generation.

Canonical v2 upload logical path:

  YYYY/MM/DD/file_uuid/filename

Normal generated load-file URLs do not include `user_id`; the active session
decides the user.
