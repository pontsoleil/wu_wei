/**
 * wuwei.note.js
 * Note module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.note = (function () {
  var
    /** common */
    common = wuwei.common,
    /** graph */
    graph = common.graph,
    /** current */
    current = common.current,
    /** state */
    state = common.state,
    cu = state.currentUser,
    // user = currentUser.user,
    user_id = cu.user_id,
    /** util */
    util = wuwei.util,
    /** model */
    model = wuwei.model,
    DRAFT_NOTE_ID = 'new_note';

  function remove(el) {
    el.parentNode.removeChild(el);
  }

  function decodeMaybe(text) {
    if ('string' !== typeof text) {
      return '';
    }
    if (!/%[0-9A-Fa-f]{2}/.test(text)) {
      return text;
    }
    try {
      return decodeURIComponent(text);
    }
    catch (e) {
      console.warn('decodeURIComponent failed:', e);
      return text;
    }
  }

  function nowIsoString() {
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  function isDraftNoteId(noteId) {
    return noteId === DRAFT_NOTE_ID;
  }

  function ensureEditableNoteId() {
    if (!current.note_id) {
      current.note_id = DRAFT_NOTE_ID;
    }
    else if (!isDraftNoteId(current.note_id) && !util.isUUIDid(current.note_id)) {
      current.note_id = util.createUuid();
    }
    return current.note_id;
  }

  function parseSaveResponse(responseText) {
    var text = String(responseText || '').replace(/^\uFEFF/, '').trim();
    if (!text || /^ERROR/.test(text) || text.indexOf('#! /bin/sh') >= 0) {
      return { name: text, note_id: '' };
    }
    if (text.charAt(0) === '{') {
      try {
        var response = JSON.parse(text);
        return {
          name: String(response.name || response.note_name || '').trim(),
          note_id: String(response.note_id || response.id || '').trim()
        };
      }
      catch (e) {
        console.warn('save-note JSON response parse failed:', e);
      }
    }
    return { name: text, note_id: '' };
  }

  function normalizeAudit(audit, user) {
    var currentUser = user || state.currentUser || {};
    var out = {
      owner: (audit && audit.owner) || currentUser.name || currentUser.login || 'guest',
      createdBy: (audit && audit.createdBy) || currentUser.user_id || common.TEMP_OWNER_ID,
      createdAt: (audit && audit.createdAt) || nowIsoString(),
      lastModifiedBy: (audit && audit.lastModifiedBy) || '',
      lastModifiedAt: (audit && audit.lastModifiedAt) || ''
    };
    return out;
  }

  function normalizeJoint(joint) {
    if (wuwei.joint && typeof wuwei.joint.normalizeMetadata === 'function') {
      return wuwei.joint.normalizeMetadata(joint);
    }
    var src = (joint && typeof joint === 'object') ? joint : {};
    var revision = Number(src.revision);
    return {
      enabled: !!src.enabled,
      revision: Number.isFinite(revision) && revision >= 0 ? Math.floor(revision) : 0,
      updatedAt: String(src.updatedAt || '')
    };
  }

  function normalizeExchange(exchange) {
    var src = (exchange && typeof exchange === 'object') ? exchange : {};
    return {
      imported: src.imported === true || src.mode === 'imported' || src.source === 'import',
      mode: String(src.mode || (src.imported === true ? 'imported' : '')),
      source: String(src.source || ''),
      importedBy: String(src.importedBy || ''),
      importedAt: String(src.importedAt || '')
    };
  }

  function normalizeOrigin(origin, noteState) {
    var src = (origin && typeof origin === 'object') ? origin : {};
    var out = {};
    var stateValue = String(noteState || '').toLowerCase();
    var keys = [
      'type',
      'source',
      'sourceNoteId',
      'sourceTeamId',
      'sourcePackageId',
      'importedBy',
      'importedAt',
      'createdBy',
      'createdAt',
      'savedAs',
      'savedAt'
    ];

    keys.forEach(function (key) {
      if (typeof src[key] !== 'undefined' && src[key] !== null && String(src[key]) !== '') {
        out[key] = String(src[key]);
      }
    });

    if (src.originalOrigin && typeof src.originalOrigin === 'object') {
      out.originalOrigin = util.clone(src.originalOrigin);
    }

    if (!out.type && stateValue === 'imported') {
      out.type = 'import';
    }
    if (!out.source && stateValue === 'imported') {
      out.source = 'export-package';
    }
    if (!out.type && stateValue === 'team') {
      out.type = 'team';
    }
    if (!out.source && stateValue === 'team') {
      out.source = 'team-note';
    }

    return Object.keys(out).length ? out : undefined;
  }

  function originIndicatesImport(src) {
    var origin = (src && src.origin && typeof src.origin === 'object') ? src.origin : {};
    var type = String(origin.type || '').toLowerCase();
    var source = String(origin.source || '').toLowerCase();
    return type === 'import' || source === 'export-package';
  }

  function originIndicatesTeam(src) {
    var origin = (src && src.origin && typeof src.origin === 'object') ? src.origin : {};
    var type = String(origin.type || '').toLowerCase();
    var source = String(origin.source || '').toLowerCase();
    return type === 'team' || source === 'team-note';
  }

  function normalizeJointNoteState(param) {
    var src = param || {};
    var raw = String(src.jointNoteState || src.collabNoteState || '').toLowerCase();
    var exchange = normalizeExchange(src.exchange);
    var joint = normalizeJoint(src.joint || src.collaboration);
    var createdBy = String(src.audit && src.audit.createdBy || '');
    var uid = String(state.currentUser && state.currentUser.user_id || '');

    if (/^(own|imported|team)$/.test(raw)) {
      return raw;
    }
    if (originIndicatesImport(src)) {
      return 'imported';
    }
    if (String(src.note_scope || '').toLowerCase() === 'team' || joint.enabled || originIndicatesTeam(src)) {
      return 'team';
    }
    if (exchange.imported || exchange.mode === 'imported' || exchange.source === 'import') {
      return 'imported';
    }
    if (uid && createdBy && createdBy !== uid) {
      return 'imported';
    }
    return 'own';
  }

  function normalizeNoteScope(value, noteState) {
    var raw = String(value || '').toLowerCase();
    if (raw === 'team' || noteState === 'team') {
      return 'team';
    }
    return 'personal';
  }

  function isTeamJointNoteForSave(note) {
    var src = note || {};
    var noteState = String(src.jointNoteState || src.collabNoteState || '').toLowerCase();
    var noteScope = String(src.note_scope || '').toLowerCase();
    var origin = (src.origin && typeof src.origin === 'object') ? src.origin : {};
    var originType = String(origin.type || '').toLowerCase();
    var originSource = String(origin.source || '').toLowerCase();
    var joint = normalizeJoint(src.joint || src.collaboration);

    if (noteState === 'team') {
      return true;
    }
    if (noteState === 'own' || noteState === 'imported') {
      return false;
    }
    if (originType === 'import' || originSource === 'export-package') {
      return false;
    }
    return !!(
      noteScope === 'team' ||
      joint.enabled ||
      originType === 'team' ||
      originSource === 'team-note' ||
      src.team_id
    );
  }

  function makePersonalCopyAuditFromTeamNote(note) {
    var currentUser = state.currentUser || {};
    var sourceAudit = normalizeAudit(note && note.audit, currentUser);
    var updated = util.clone(sourceAudit) || {};

    /*
     * A personal save of a team note is a derived personal copy.
     * Keep the original team note creation history, but record this save as the
     * latest modification by the current user.
     */
    updated.createdBy = sourceAudit.createdBy || currentUser.user_id || common.TEMP_OWNER_ID;
    updated.createdAt = sourceAudit.createdAt || nowIsoString();
    updated.lastModifiedBy = currentUser.user_id || common.TEMP_OWNER_ID;
    updated.lastModifiedAt = nowIsoString();

    return updated;
  }

  function resetNoteIdentityForPersonalSave(note) {
    var previousNoteId = String(note && note.note_id || '');
    var previousTeamId = String(note && note.team_id || '');
    var previousOrigin = (note && note.origin && typeof note.origin === 'object') ? util.clone(note.origin) : null;
    var newId = util.createUuid();

    note.note_id = newId;
    note.note_uuid = newId;

    /*
     * note_key is a storage location, not the logical identity of this new
     * personal copy.  Delete any loaded/list-note key aliases so save-note stores
     * this as a different note under the current user's note area.
     */
    delete note.note_key;
    delete note.key;
    delete note.dir;
    delete note.path;
    delete note.notePath;

    note.joint = normalizeJoint(null);
    note.jointNoteState = 'own';
    note.note_scope = 'personal';
    note.team_id = '';

    delete note.collaboration;
    delete note.collabNoteState;

    note.origin = normalizeOrigin({
      type: 'personal-copy',
      source: 'team-note',
      sourceNoteId: previousNoteId,
      sourceTeamId: previousTeamId,
      originalOrigin: previousOrigin || undefined,
      savedAs: newId,
      savedAt: nowIsoString()
    }, 'own');

    note.exchange = normalizeExchange({
      imported: false,
      mode: 'personal-copy',
      source: 'team-note'
    });
    note.exchange.sourceNoteId = previousNoteId;
    if (previousTeamId) {
      note.exchange.sourceTeamId = previousTeamId;
    }
    if (previousOrigin) {
      note.exchange.sourceOrigin = previousOrigin;
    }

    /*
     * The saved note is a personal copy derived from the team note.
     * Preserve the note-level original createdBy / createdAt, and record this
     * save operation as lastModifiedBy / lastModifiedAt of the current user.
     * Node/link/group audit.createdBy values are not rewritten; they continue
     * to show the original creators inside the note.
     */
    note.audit = makePersonalCopyAuditFromTeamNote(note);
    note._convertedFromTeamNote = {
      sourceNoteId: previousNoteId,
      sourceTeamId: previousTeamId,
      savedAs: newId,
      savedAt: nowIsoString()
    };

    return note._convertedFromTeamNote;
  }

  function ensurePersonalCopyBeforeSave(actionName) {
    var action = actionName || 'save-note';

    if (action !== 'save-note') {
      return null;
    }
    if (!current || !isTeamJointNoteForSave(current)) {
      return null;
    }

    return resetNoteIdentityForPersonalSave(current);
  }

  function applyPersonalNoteSavePolicy(note) {
    var noteState = normalizeJointNoteState(note);

    if (noteState === 'team') {
      return note;
    }

    note.note_scope = 'personal';
    note.jointNoteState = noteState === 'imported' ? 'imported' : 'own';

    delete note.team_id;
    note.origin = normalizeOrigin(note.origin, note.jointNoteState);
    if (!note.origin) {
      delete note.origin;
    }
    delete note.collaboration;
    delete note.collabNoteState;

    if (note.joint && note.joint.enabled !== true) {
      delete note.joint;
    }

    return note;
  }

  function normalizeRecordState(src) {
    return (src && src.state) ? String(src.state) : 'active';
  }

  function normalizeDeletedInfo(src) {
    var deleted = src && src.deleted && typeof src.deleted === 'object' ? src.deleted : null;
    if (!deleted) {
      return undefined;
    }
    return {
      deletedBy: String(deleted.deletedBy || ''),
      deletedAt: String(deleted.deletedAt || ''),
      reason: String(deleted.reason || '')
    };
  }

  function normalizeTransform(transform) {
    var t = transform || {};
    return {
      x: Number.isFinite(Number(t.x)) ? Number(t.x) : 0,
      y: Number.isFinite(Number(t.y)) ? Number(t.y) : 0,
      scale: Number.isFinite(Number(t.scale)) ? Number(t.scale) : 1
    };
  }

  function normalizeStoredResourceUri(value, area) {
    var text = String(value || '').replace(/\\/g, '/').trim();
    var uid = String(state.currentUser && state.currentUser.user_id || '');

    if (!text || isIconThumbnailUri(text) || /^data:/i.test(text) || /^blob:/i.test(text)) {
      return text;
    }
    if (/^https?:\/\//i.test(text) && text.indexOf('/wu_wei2/') < 0 &&
        !/(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(text)) {
      return text;
    }
    if (util && typeof util.toStorageRelativePath === 'function') {
      return util.toStorageRelativePath(text, uid, area || '');
    }
    return text
      .replace(/[?#].*$/, '')
      .replace(/^https?:\/\/[^/]+\/wu_wei2\//i, '')
      .replace(/^\/?wu_wei2\//i, '')
      .replace(/^\/?data\/[^/]+\/(?:upload|resource|note|thumbnail|content)\//i, '')
      .replace(/^(?:upload|resource|note|thumbnail|content)\//i, '')
      .replace(/^\/+/, '');
  }

  function normalizeStoredViewerUri(value, area) {
    return normalizeStoredResourceUri(value, area);
  }

  function normalizeViewer(viewer) {
    var supported = (viewer && Array.isArray(viewer.supportedModes)) ? viewer.supportedModes.slice() : [];
    var embed = (viewer && viewer.embed && typeof viewer.embed === 'object') ? util.clone(viewer.embed) : {};
    if (!supported.length) {
      supported = ['infoPane', 'newTab', 'newWindow', 'download'];
    }
    if (embed.uri) {
      embed.uri = normalizeStoredViewerUri(embed.uri, 'upload');
    }
    if (embed.thumbnailUri) {
      embed.thumbnailUri = normalizeStoredViewerUri(embed.thumbnailUri, 'thumbnail');
    }
    return {
      supportedModes: supported,
      defaultMode: (viewer && viewer.defaultMode) || supported[0] || 'infoPane',
      embed: embed,
      thumbnailUri: normalizeStoredViewerUri(String((viewer && viewer.thumbnailUri) || embed.thumbnailUri || ''), 'thumbnail')
    };
  }

  function cloneArray(value) {
    return Array.isArray(value) ? value.filter(Boolean).map(function (item) { return util.clone(item); }) : [];
  }

  function normalizeStorage(storage) {
    var src = (storage && typeof storage === 'object') ? storage : {};
    var manifest = (src.manifest && typeof src.manifest === 'object') ? util.clone(src.manifest) : null;
    var files = Array.isArray(src.files) ? src.files.map(function (file) {
      var out = util.clone(file);
      var area = String(out.area || '').trim();
      var role = String(out.role || '').toLowerCase();
      if (!area) {
        area = (role === 'original') ? 'upload' : 'note';
      }
      if (out.path) {
        out.path = normalizeStoredResourceUri(out.path, area);
      }
      if (out.sourcePath) {
        out.sourcePath = normalizeStoredResourceUri(out.sourcePath, out.sourceArea || area);
      }
      out.area = area;
      return out;
    }) : [];
    var outStorage = {
      managed: src.managed === true,
      copyPolicy: src.copyPolicy || (src.managed === true ? 'snapshot' : 'metadataOnly'),
      files: files
    };
    if (manifest) {
      manifest.area = String(manifest.area || 'upload');
      if (manifest.path) {
        manifest.path = normalizeStoredResourceUri(manifest.path, manifest.area);
      }
      outStorage.manifest = manifest;
    }
    return outStorage;
  }

  function storedThumbnailFromStorage(storage) {
    var files = (storage && Array.isArray(storage.files)) ? storage.files : [];
    var i, file, path;
    for (i = 0; i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.role || '').toLowerCase() !== 'thumbnail') {
        continue;
      }
      path = normalizeStoredResourceUri(file.path || '', file.area || 'thumbnail');
      if (path) {
        return path;
      }
    }
    return '';
  }

  function toRuntimeFileUrl(value) {
    var text = String(value || '').replace(/\\/g, '/');
    var idx;
    if (!text) {
      return '';
    }
    if (/^https?:\/\//i.test(text)) {
      try {
        var url = new URL(text, window.location.href);
        if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && /^\/wu_wei2\//.test(url.pathname)) {
          return window.location.origin + url.pathname + url.search + url.hash;
        }
      }
      catch (e) {
        return text;
      }
      return text;
    }
    idx = text.indexOf('/wu_wei2/');
    if (idx >= 0) {
      return window.location.origin + text.slice(idx);
    }
    if (text.charAt(0) === '/') {
      return window.location.origin + text;
    }
    return text;
  }

  function storageFileUrl(storage, role, ownerUserId) {
    var files = (storage && Array.isArray(storage.files)) ? storage.files : [];
    var i, file, path, area, uid;
    role = String(role || '').toLowerCase();
    for (i = 0; i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.role || '').toLowerCase() !== role) {
        continue;
      }
      area = String(file.area || '').trim() || (role === 'original' ? 'upload' : 'note');
      path = String(file.path || '').replace(/\\/g, '/');
      if (path) {
        uid = String(ownerUserId || state.currentUser && state.currentUser.user_id || '');
        return toRuntimeFileUrl(util.toPublicResourceUri(area, util.toStorageRelativePath(path, uid, area), uid));
      }
    }
    return '';
  }

  function runtimeThumbnailUri(value, ownerUserId) {
    var text = String(value || '').replace(/\\/g, '/').trim();
    var uid = String(ownerUserId || state.currentUser && state.currentUser.user_id || '');

    if (!text || isIconThumbnailUri(text)) {
      return '';
    }
    if (/^https?:\/\//i.test(text) && text.indexOf('/wu_wei2/') < 0) {
      return text;
    }
    if (/(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(text)) {
      return toRuntimeFileUrl(text);
    }
    if (/^\d{4}\/\d{2}\//.test(text) ||
        /(?:^|\/)(?:thumbnail|content|upload|resource|note)\//i.test(text) ||
        /\/wu_wei2\/data\//i.test(text) ||
        /\/wu_wei2\//i.test(text)) {
      return toRuntimeFileUrl(util.toPublicResourceUri(
        'thumbnail',
        util.toStorageRelativePath(text, uid, 'thumbnail'),
        uid,
        'thumbnail'
      ));
    }
    return toRuntimeFileUrl(text);
  }

  function isIconThumbnailUri(value) {
    return /^fa-/.test(String(value || ''));
  }

  function resolveResourceThumbnailUri(resource, ownerUserId) {
    var viewer = (resource && resource.viewer && typeof resource.viewer === 'object') ? resource.viewer : {};
    var embed = (viewer.embed && typeof viewer.embed === 'object') ? viewer.embed : {};
    var storageUri = storageFileUrl(resource && resource.storage, 'thumbnail', ownerUserId);
    var candidates = [
      storageUri,
      viewer.thumbnailUri,
      embed.thumbnailUri,
      resource && resource.thumbnailUri
    ];
    var i, value;

    for (i = 0; i < candidates.length; i += 1) {
      value = runtimeThumbnailUri(candidates[i], ownerUserId);
      if (value) {
        return value;
      }
    }
    return '';
  }

  function ensureResourceRuntimeReferences(resource, ownerUserId) {
    var thumbnailUri;

    if (!resource || typeof resource !== 'object') {
      return resource;
    }

    thumbnailUri = resolveResourceThumbnailUri(resource, ownerUserId);
    if (thumbnailUri) {
      resource.thumbnailUri = thumbnailUri;
      resource.viewer = (resource.viewer && typeof resource.viewer === 'object')
        ? resource.viewer
        : normalizeViewer(null);
      resource.viewer.thumbnailUri = thumbnailUri;
      resource.viewer.embed = (resource.viewer.embed && typeof resource.viewer.embed === 'object')
        ? resource.viewer.embed
        : {};
      if (!resource.viewer.embed.thumbnailUri) {
        resource.viewer.embed.thumbnailUri = thumbnailUri;
      }
    }

    return resource;
  }

  function normalizedResourceKindForSave(src) {
    var kind = String(src && src.kind || '').toLowerCase();
    var mediaKind = String(src && src.media && src.media.kind || '').toLowerCase();
    var extKind = util.getDocumentKindByExtension
      ? util.getDocumentKindByExtension(null, src || {}, (src && (src.uri || src.canonicalUri)) || '')
      : '';

    if (/^(document|video|audio|image|other)$/.test(kind)) {
      return kind;
    }
    if (/^(document|video|audio|image|other)$/.test(mediaKind)) {
      return mediaKind;
    }
    if (extKind === 'image' || extKind === 'video' || extKind === 'audio') {
      return extKind;
    }
    if (/^(pdf|office|html|text)$/.test(extKind)) {
      return 'document';
    }
    return 'other';
  }

  function normalizedResourceSourceForSave(src) {
    var source = String(src && src.source || '').toLowerCase();
    var kind = String(src && src.kind || '').toLowerCase();
    var storage = src && src.storage && typeof src.storage === 'object' ? src.storage : {};
    var files = Array.isArray(storage.files) ? storage.files : [];
    var uri = String(src && (src.uri || src.canonicalUri) || '');

    if (/^(upload|remote|generated|embedded)$/.test(source)) {
      return source;
    }
    if (kind === 'upload' || files.some(function (file) { return String(file && file.area || '').toLowerCase() === 'upload'; })) {
      return 'upload';
    }
    if (/^https?:\/\//i.test(uri)) {
      return 'remote';
    }
    return 'embedded';
  }

  function isRemoteResourceForSave(src, savedSource) {
    var original = src && src.original && typeof src.original === 'object' ? src.original : {};
    var text = String(
      (original && (original.url || original.canonicalUrl)) ||
      (src && (src.uri || src.canonicalUri || src.url || src.sourceUrl)) ||
      ''
    );
    return String(savedSource || '').toLowerCase() === 'remote' ||
      String(original.type || '').toLowerCase() === 'remote' ||
      /^https?:\/\//i.test(text);
  }

  function firstRemoteUrlForSave(src) {
    return remoteUrlCandidateForSave(src);
  }

  function normalizeOriginalForSave(src, savedSource, uri, canonicalUri) {
    var original = src && src.original && typeof src.original === 'object' ? src.original : {};
    var identifiers = Array.isArray(original.identifiers) ? util.clone(original.identifiers) : [];
    var remote = isRemoteResourceForSave(src, savedSource);
    var url = String(firstRemoteUrlForSave(src) || uri || canonicalUri || '').trim();
    var canonical = String(original.canonicalUrl || canonicalUri || url || '').trim();

    if (remote) {
      return {
        url: url,
        canonicalUrl: canonical || url,
        type: 'remote',
        accessedAt: String(original.accessedAt || ''),
        identifiers: identifiers
      };
    }

    if (String(savedSource || '').toLowerCase() === 'upload') {
      return {
        url: '',
        canonicalUrl: '',
        type: 'upload',
        storageRole: String(original.storageRole || 'original')
      };
    }

    if (original && Object.keys(original).length) {
      return util.clone(original);
    }
    return undefined;
  }

  function remoteUrlCandidateForSave(src) {
    var original = src && src.original && typeof src.original === 'object' ? src.original : {};
    var origin = src && src.origin && typeof src.origin === 'object' ? src.origin : {};
    var media = src && src.media && typeof src.media === 'object' ? src.media : {};
    var candidates = [
      original.url,
      original.sourceUrl,
      src && src.uri,
      src && src.canonicalUri,
      original.canonicalUrl,
      origin.sourceUrl,
      origin.canonicalUrl,
      media.url,
      media.src,
      media.embedUrl,
      media.sourceUrl,
      src && src.url,
      src && src.sourceUrl,
      src && src.snapshotSources && src.snapshotSources.originalUri,
      src && src.snapshotSources && src.snapshotSources.previewUri
    ];
    var provider = String(media.provider || src && src.videoKind || '').toLowerCase();
    var videoId = String(media.videoId || media.id || src && src.videoId || '').trim();
    var i, value;

    for (i = 0; i < candidates.length; i += 1) {
      value = String(candidates[i] || '').trim();
      if (/^https?:\/\//i.test(value)) {
        return value;
      }
    }
    if (provider === 'vimeo' && videoId) {
      return 'https://vimeo.com/' + videoId;
    }
    if (provider === 'youtube' && videoId) {
      return 'https://www.youtube.com/watch?v=' + videoId;
    }
    for (i = 0; i < candidates.length; i += 1) {
      value = String(candidates[i] || '').trim();
      if (value) {
        return value;
      }
    }
    return '';
  }

  function synchronizeRemoteResourceForSave(resource) {
    var url;
    var original;
    var source;
    if (!resource || typeof resource !== 'object') {
      return resource;
    }
    source = String(resource.source || '').toLowerCase();
    url = remoteUrlCandidateForSave(resource);
    if (source !== 'remote' && !(resource.original && String(resource.original.type || '').toLowerCase() === 'remote') && !/^https?:\/\//i.test(url)) {
      return resource;
    }
    resource.source = 'remote';
    original = (resource.original && typeof resource.original === 'object') ? resource.original : {};
    original.type = 'remote';
    original.url = String(original.url || url || resource.uri || resource.canonicalUri || '');
    original.canonicalUrl = String(original.canonicalUrl || resource.canonicalUri || original.url || url || '');
    if (!Array.isArray(original.identifiers)) {
      original.identifiers = [];
    }
    resource.original = original;
    if (!resource.uri && original.url) {
      resource.uri = original.url;
    }
    if (!resource.canonicalUri && (original.canonicalUrl || original.url)) {
      resource.canonicalUri = original.canonicalUrl || original.url;
    }
    if (resource.kind === 'video' && !resource.videoKind) {
      if (/vimeo\.com|player\.vimeo\.com/i.test(original.url || resource.uri || '')) {
        resource.videoKind = 'vimeo';
      }
      else if (/youtube\.com|youtu\.be/i.test(original.url || resource.uri || '')) {
        resource.videoKind = 'youtube';
      }
    }
    return resource;
  }

  function synchronizeRemoteContentUrlsForSave(note) {
    var resources = Array.isArray(note && note.resources) ? note.resources : [];
    var byId = {};
    var pages = pagesAsArray(note || {});

    resources.forEach(function (resource) {
      if (resource && resource.id) {
        synchronizeRemoteResourceForSave(resource);
        byId[resource.id] = resource;
      }
    });

    pages.forEach(function (page) {
      (Array.isArray(page && page.nodes) ? page.nodes : []).forEach(function (node) {
        var resource;
        var found;
        if (!node || node.type !== 'Content') {
          return;
        }
        resource = (node.resource && typeof node.resource === 'object') ? node.resource : null;
        if (!resource && node.resourceRef && byId[node.resourceRef]) {
          resource = util.clone(byId[node.resourceRef]);
          node.resource = resource;
        }
        if (!resource) {
          return;
        }
        if (node.resourceRef && byId[node.resourceRef]) {
          found = byId[node.resourceRef];
          if (!remoteUrlCandidateForSave(resource) && remoteUrlCandidateForSave(found)) {
            Object.assign(resource, util.clone(found));
          }
        }
        synchronizeRemoteResourceForSave(resource);
        if (resource.id) {
          found = byId[resource.id];
          if (found) {
            Object.assign(found, normalizeResourceDefinition(resource));
          }
          else {
            resources.push(normalizeResourceDefinition(resource));
            byId[resource.id] = resources[resources.length - 1];
          }
        }
      });
    });
    note.resources = resources;
  }

  function normalizeResourceDefinition(resource) {
    var src = (resource && typeof resource === 'object') ? resource : {};
    synchronizeRemoteResourceForSave(src);
    var rights = (src.rights && typeof src.rights === 'object') ? src.rights : {};
    var savedKind = normalizedResourceKindForSave(src);
    var savedSource = normalizedResourceSourceForSave(src);
    var remoteUrl = firstRemoteUrlForSave(src);
    var savedUri = normalizeStoredResourceUri(src.uri || src.canonicalUri || remoteUrl || '', 'upload');
    var savedCanonicalUri = normalizeStoredResourceUri(src.canonicalUri || src.uri || remoteUrl || '', 'upload');
    var out = {
      id: src.id || util.createUuid(),
      source: savedSource,
      kind: savedKind,
      documentKind: savedKind === 'document' ? String(src.documentKind || '') : '',
      videoKind: savedKind === 'video' ? String(src.videoKind || '') : '',
      audioKind: savedKind === 'audio' ? String(src.audioKind || '') : '',
      imageKind: savedKind === 'image' ? String(src.imageKind || '') : '',
      canonicalUri: savedCanonicalUri,
      uri: savedUri,
      title: String(src.title || ''),
      mimeType: String(src.mimeType || 'text/plain'),
      thumbnailUri: normalizeStoredResourceUri(src.thumbnailUri || '', 'thumbnail'),
      viewer: normalizeViewer(src.viewer),
      media: (src.media && typeof src.media === 'object') ? util.clone(src.media) : undefined,
      storage: normalizeStorage(src.storage),
      contents: (src.contents && typeof src.contents === 'object') ? util.clone(src.contents) : undefined,
      state: normalizeRecordState(src),
      deleted: normalizeDeletedInfo(src),
      rights: {
        owner: String(rights.owner || src.owner || ''),
        copyright: String(rights.copyright || src.copyright || ''),
        license: String(rights.license || ''),
        attribution: String(rights.attribution || '')
      },
      audit: normalizeAudit(src.audit, state.currentUser)
    };

    out.original = normalizeOriginalForSave(src, savedSource, out.uri, out.canonicalUri);
    if (out.original && out.original.type === 'remote') {
      if (!out.uri && out.original.url) {
        out.uri = out.original.url;
      }
      if (!out.canonicalUri && (out.original.canonicalUrl || out.original.url)) {
        out.canonicalUri = out.original.canonicalUrl || out.original.url;
      }
    }

    if (!out.thumbnailUri) {
      out.thumbnailUri = storedThumbnailFromStorage(out.storage);
    }
    if (out.viewer) {
      if (!out.viewer.thumbnailUri) {
        out.viewer.thumbnailUri = out.thumbnailUri || '';
      }
      out.viewer.embed = (out.viewer.embed && typeof out.viewer.embed === 'object') ? out.viewer.embed : {};
      if (!out.viewer.embed.thumbnailUri) {
        out.viewer.embed.thumbnailUri = out.thumbnailUri || '';
      }
    }
    if (out.media && typeof out.media === 'object') {
      out.media.kind = savedKind;
      out.media.mimeType = out.media.mimeType || out.mimeType || '';
    }
    if (src.export && typeof src.export === 'object') {
      out.export = util.clone(src.export);
    }

    return out;
  }

  function isVideoResourceLike(resource, uri) {
    var src = resource || {};
    var kind = String(src.kind || '').toLowerCase();
    var subtype = String(src.videoKind || '').toLowerCase();
    var text = String(uri || src.canonicalUri || src.uri || '').toLowerCase();
    return kind === 'video' ||
      subtype === 'youtube' ||
      subtype === 'vimeo' ||
      (util.getDocumentKindByExtension && util.getDocumentKindByExtension(null, src, text) === 'video') ||
      /(^|\/\/)(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(text);
  }

  function normalizeUrlVideoResource(resource, node, uri) {
    var src = resource || {};
    var sourceUri = String(uri || src.canonicalUri || src.uri || '').trim();
    var clone = util.clone(src);
    var tempNode = {
      label: node && node.label,
      timeRange: node && node.timeRange,
      resource: clone
    };
    if (wuwei.video && typeof wuwei.video.setVideoSource === 'function') {
      clone = wuwei.video.setVideoSource(tempNode, sourceUri);
      if (clone) {
        clone.original = normalizeOriginalForSave(clone, 'remote', clone.uri, clone.canonicalUri);
      }
      return clone;
    }
    clone.kind = 'video';
    clone.uri = sourceUri;
    clone.canonicalUri = sourceUri;
    clone.mimeType = clone.mimeType || 'text/html';
    clone.title = String(clone.title || (node && node.label) || sourceUri || 'Video');
    clone.videoKind = clone.videoKind || '';
    clone.source = 'remote';
    clone.original = normalizeOriginalForSave(clone, 'remote', clone.uri, clone.canonicalUri);
    delete clone.storage;
    return clone;
  }

  function normalizeResource(resource, node) {
    var out = normalizeResourceDefinition(resource || {});
    if (!out.title && node && node.label) {
      out.title = String(node.label || '');
    }
    if (!out.kind || out.kind === 'other') {
      out.kind = resourceKindFromExtension(out, out.uri || out.canonicalUri, node);
    }
    if (isVideoResourceLike(out, out.uri || out.canonicalUri)) {
      return normalizeUrlVideoResource(out, node, out.uri || out.canonicalUri);
    }
    return out;
  }

  function runtimeResourceFromDefinition(definition, node) {
    return normalizeResource(definition || {}, node);
  }

  function normalizeVisibleFlag(srcVisible, srcHidden, oldHidden) {
    if (typeof srcVisible === 'boolean') {
      return srcVisible;
    }
    if (srcHidden === true || oldHidden === true) {
      return false;
    }
    return true;
  }

  function textAnchorToAlign(anchor) {
    if (anchor === 'start') {
      return 'left';
    }
    if (anchor === 'end') {
      return 'right';
    }
    return 'center';
  }

  function runtimeStyleFallbackForSave(node) {
    var style, line, font;

    if (!node || typeof node !== 'object') {
      return node;
    }

    style = (node.style && typeof node.style === 'object') ? node.style : {};
    line = (style.line && typeof style.line === 'object') ? style.line : {};
    font = (style.font && typeof style.font === 'object') ? style.font : {};

    if (!style.fill && node.color) {
      style.fill = node.color;
    }
    if (node.outline || node.outlineWidth) {
      style.line = line;
      line.kind = line.kind || 'SOLID';
      line.color = line.color || node.outline || '#d7d8d9';
      line.width = Number.isFinite(Number(line.width)) ? Number(line.width) :
        (Number.isFinite(Number(node.outlineWidth)) ? Number(node.outlineWidth) : 1);
    }
    if (node.font && typeof node.font === 'object') {
      style.font = font;
      font.family = font.family || node.font.family || 'sans-serif';
      font.size = font.size || node.font.size || 14;
      font.color = font.color || node.font.color || '#303030';
      font.align = font.align || textAnchorToAlign(node.font['text-anchor']);
    }
    node.style = style;
    return node;
  }

  function stripNodeRuntimeStyleFields(node) {
    if (!node || typeof node !== 'object') {
      return node;
    }
    delete node.color;
    delete node.outline;
    delete node.outlineWidth;
    delete node.font;
    return node;
  }

  function expandNodeRuntimeStyle(node) {
    if (wuwei && wuwei.style &&
        typeof wuwei.style.expandNodeRuntimeStyle === 'function') {
      return wuwei.style.expandNodeRuntimeStyle(node);
    }
    if (wuwei && wuwei.note && wuwei.note.v2 &&
        typeof wuwei.note.v2.expandNodeRuntimeStyle === 'function') {
      return wuwei.note.v2.expandNodeRuntimeStyle(node);
    }
    return node;
  }

  function normalizeNode(node, resourceById) {
    var src = node || {};
    assertNoLegacyContentsRuntime(src, 'wuwei.note.normalizeNode');
    var shape = src.shape || (src.type === 'Memo' ? 'MEMO' : 'RECTANGLE');
    var size = src.size || {};
    var out = {
      id: src.id || util.createUuid(),
      type: src.type || 'Topic',
      x: Number.isFinite(Number(src.x)) ? Number(src.x) : 0,
      y: Number.isFinite(Number(src.y)) ? Number(src.y) : 0,
      shape: shape,
      size: util.clone(size || {}),
      visible: (normalizeRecordState(src) === 'deleted') ? false : (false !== src.visible),
      linkCount: Number.isFinite(Number(src.linkCount)) ? Number(src.linkCount) : 0,
      description: src.description && typeof src.description === 'object'
        ? util.clone(src.description)
        : { format: 'plain/text', body: '' },
      style: util.clone(src.style || {}),
      state: normalizeRecordState(src),
      deleted: normalizeDeletedInfo(src),
      audit: normalizeAudit(src.audit, state.currentUser)
    };
    if (src.type !== 'Memo') {
      out.label = String(src.label || '');
    }

    if (src.type === 'Content') {
      if (src.resourceRef && resourceById && resourceById[src.resourceRef]) {
        out.resourceRef = src.resourceRef;
        out.resource = runtimeResourceFromDefinition(resourceById[src.resourceRef], src);
      }
      else {
        out.resource = normalizeResource(src.resource || {}, src);
        if (src.resourceRef) {
          out.resourceRef = src.resourceRef;
        }
      }

      out.resourceView = (src.resourceView && typeof src.resourceView === 'object')
        ? util.clone(src.resourceView)
        : { mode: 'default' };
      out.resourceView.mode = out.resourceView.mode || 'default';

      out.thumbnailUri =
        resolveResourceThumbnailUri(out.resource, state.currentUser && state.currentUser.user_id);
      if (!out.thumbnailUri) {
        out.thumbnailUri = runtimeThumbnailUri(src.thumbnailUri, state.currentUser && state.currentUser.user_id) ||
          (out.resource && out.resource.thumbnailUri) ||
          '';
      }

      if (out.thumbnailUri && !src.shape) {
        out.shape = 'THUMBNAIL';
      }
    }

    if (src.type === 'Memo') {//} && (src.memoShape || oldView.memoShape)) {
      out.style = (out.style && typeof out.style === 'object') ? out.style : {};
      delete out.style.label;
      out.style.memo = (out.style.memo && typeof out.style.memo === 'object')
        ? util.clone(out.style.memo)
        : {};

      if (!out.style.memo.corner) {
        out.style.memo.corner = 'bottom-right';
      }
      if (!Number.isFinite(Number(out.style.memo.foldSize))) {
        out.style.memo.foldSize = 32;
      }

      delete out.memoShape;
    }

    if (src.type === 'Segment') {
      out.description = src.description && typeof src.description === 'object'
        ? util.clone(src.description)
        : { format: 'plain/text', body: '' };
      out.time = util.clone(src.time || {});
      ['mediaStart', 'mediaEnd', 'playDuration', 'axisPos'].forEach(function (key) {
        if (Number.isFinite(Number(src[key]))) {
          out[key] = Number(src[key]);
        }
      });
      ['mediaRef', 'axisRole'].forEach(function (key) {
        if (typeof src[key] === 'string' && src[key]) {
          out[key] = src[key];
        }
      });
    }

    if (typeof src.groupRef === 'string' && src.groupRef) {
      out.groupRef = src.groupRef;
    }

    if (src.type === 'PageMarker' || src.topicKind === 'viewpoint-page') {
      out.type = 'PageMarker';
      out.topicKind = 'viewpoint-page';
      out.groupRef = out.groupRef || '';
      if (typeof src.viewpointRef === 'string' && src.viewpointRef) {
        out.viewpointRef = src.viewpointRef;
      }
      if (typeof src.documentRef === 'string' && src.documentRef) {
        out.documentRef = src.documentRef;
      }
      if (typeof src.mediaRef === 'string' && src.mediaRef) {
        out.mediaRef = src.mediaRef;
      }
      if (Number.isFinite(Number(src.pageNumber))) {
        out.pageNumber = Number(src.pageNumber);
      }
      if (Number.isFinite(Number(src.axisPos))) {
        out.axisPos = Number(src.axisPos);
      }
      [
        'anchorHref',
        'htmlAnchorHref'
      ].forEach(function (key) {
        if (typeof src[key] === 'string' && src[key]) {
          out[key] = src[key];
        }
      });
    }
    if (src.representativeOf && 'object' === typeof src.representativeOf) {
      out.representativeOf = {
        kind: src.representativeOf.kind || 'group',
        id: src.representativeOf.id || src.groupRef || ''
      };
    }
    if (typeof src.groupRole === 'string' && src.groupRole) {
      out.groupRole = src.groupRole;
      if ('representative' === out.groupRole) {
        if (typeof src.representativeType === 'string' && src.representativeType) {
          out.representativeType = src.representativeType;
        }
        if (Number.isFinite(Number(src.axisPos))) {
          out.axisPos = Number(src.axisPos);
        }
        out.style = out.style || {};
        out.style.line = out.style.line || {};
        out.style.line.kind = out.style.line.kind || 'DASHED';
      }
    }
    if (typeof src.axisRole === 'string' && src.axisRole) {
      out.axisRole = src.axisRole;
    }
    if (typeof src.topicKind === 'string' && src.topicKind) {
      out.topicKind = src.topicKind;
    }

    expandNodeRuntimeStyle(out);

    return model.NodeFactory(out);
  }

  function normalizeLink(link) {
    var src = link || {};
    assertNoLegacyContentsRuntime(src, 'wuwei.note.normalizeLink');
    var out = {
      id: src.id || util.createUuid(),
      type: 'Link',
      from: (typeof src.from === 'object') ? src.from.id : (src.from || ''),
      to: (typeof src.to === 'object') ? src.to.id : (src.to || ''),
      x: Number.isFinite(Number(src.x)) ? Number(src.x) : 0,
      y: Number.isFinite(Number(src.y)) ? Number(src.y) : 0,
      shape: src.shape || oldView.shape || 'NORMAL',
      visible: (false !== src.visible),
      relation: src.relation || '',
      label: String(src.label || ''),
      description: src.description && typeof src.description === 'object'
        ? util.clone(src.description)
        : { format: 'plain', body: String(src.description || '') },
      style: util.clone(src.style || {}),
      routing: util.clone(src.routing || {}),
      state: normalizeRecordState(src),
      deleted: normalizeDeletedInfo(src),
      audit: normalizeAudit(src.audit, state.currentUser)
    };
    if (out.state === 'deleted') {
      out.visible = false;
    }

    if (Number.isFinite(Number(src.x2))) {
      out.x2 = Number(src.x2);
    }
    if (Number.isFinite(Number(src.y2))) {
      out.y2 = Number(src.y2);
    }

    return model.LinkFactory(out);
  }

  function noteNumberOrDefault(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function isLegacyContentsName(value) {
    return String(value || '').trim().toLowerCase() === 'contents';
  }

  function isLegacyContentsGroupType(value) {
    value = String(value || '').trim();
    return value === 'contents' || value === 'contentsGroup';
  }

  function hasLegacyContentsLinkToken(src) {
    return !!(src && (
      src.groupType === 'contentsAxis' ||
      src.linkType === 'contents-axis' ||
      src.relation === 'contents' ||
      src.role === 'contents-entry' ||
      src.role === 'contents-first-entry'
    ));
  }

  function assertNoLegacyContentsRuntime(value, context) {
    if (!value) {
      return;
    }
    if (isLegacyContentsGroupType(value.type) || isLegacyContentsGroupType(value.kind)) {
      throw new Error((context || 'WuWei runtime') + ': legacy Contents group remained after wuwei.note.v2 normalization.');
    }
    if (value.topicKind === 'contents-representative' ||
        value.topicKind === 'contents-page' ||
        value.representativeType === 'contents' ||
        value.representativeType === 'contentsGroup' ||
        value.axisRole === 'contents-entry') {
      throw new Error((context || 'WuWei runtime') + ': legacy Contents node remained after wuwei.note.v2 normalization.');
    }
    if (hasLegacyContentsLinkToken(value)) {
      throw new Error((context || 'WuWei runtime') + ': legacy Contents link remained after wuwei.note.v2 normalization.');
    }
    if (isLegacyContentsName(value.name) && (value.type === 'viewpoint' || value.type === 'viewpointGroup')) {
      throw new Error((context || 'WuWei runtime') + ': legacy Contents group name remained after wuwei.note.v2 normalization.');
    }
  }

  function noteGroupStyleDefaults(type) {
    var style = (common && common.defaultStyle && common.defaultStyle.group) || {};
    var typed = style[type] || {};
    var padding = noteNumberOrDefault(typed.padding, style.padding);

    return {
      kind: typed.kind || style.kind,
      color: typed.color || style.color,
      width: noteNumberOrDefault(typed.width, style.width),
      padding: padding,
      paddingTop: noteNumberOrDefault(typed.paddingTop, padding),
      paddingRight: noteNumberOrDefault(typed.paddingRight, padding),
      paddingBottom: noteNumberOrDefault(typed.paddingBottom, padding),
      paddingLeft: noteNumberOrDefault(typed.paddingLeft, padding),
      visible: (typeof typed.visible === 'boolean')
        ? typed.visible
        : ((typeof style.visible === 'boolean') ? style.visible : true)
    };
  }

  function normalizeGroup(group) {
    var src = group || {};
    var spine = src.spine || {};
    var timeline = src.timeline || {};
    var axis = src.axis || {};
    var members = Array.isArray(src.members) ? src.members : (Array.isArray(src.item) ? src.item : []);
    var entries = Array.isArray(src.entries) ? src.entries : [];
    var pageCount = Number(src.pageCount || axis.end);
    var rawType = src.type || 'simple';
    var type = rawType;

    if (isLegacyContentsGroupType(rawType) || isLegacyContentsGroupType(src.kind) || isLegacyContentsName(src.name) && rawType === 'viewpoint') {
      assertNoLegacyContentsRuntime(src, 'wuwei.note.normalizeGroup');
    }

    if (rawType === 'simpleGroup') {
      type = 'simple';
    }
    else if (rawType === 'horizontalGroup') {
      type = 'horizontal';
    }
    else if (rawType === 'verticalGroup') {
      type = 'vertical';
    }
    else if ((rawType === 'Group' || rawType === 'topicGroup') && src.groupType === 'axis') {
      type = 'timeline';
    }
    else if (rawType === 'topicGroup') {
      type = (src.orientation === 'horizontal') ? 'horizontal' : 'vertical';
    }
    else if (rawType === 'timelineGroup') {
      type = 'timeline';
    }
    else if (rawType === 'viewpointGroup') {
      type = 'viewpoint';
    }
    else if (isLegacyContentsGroupType(rawType)) {
      assertNoLegacyContentsRuntime(src, 'wuwei.note.normalizeGroup');
    }

    var defaultSpine = noteGroupStyleDefaults(type);
    var baseSpinePadding = Number.isFinite(Number(spine.padding)) ? Number(spine.padding) : defaultSpine.padding;

    function spinePaddingSide(key) {
      return Number.isFinite(Number(spine[key])) ? Number(spine[key]) : Number(defaultSpine[key] || baseSpinePadding);
    }

    if (type === 'viewpoint' && !members.length && entries.length) {
      members = entries.map(function (entry, index) {
        return {
          nodeId: entry && (entry.nodeId || entry.id) || '',
          order: Number(entry && entry.order || index + 1),
          role: 'member'
        };
      }).filter(function (member) {
        return !!member.nodeId;
      });
    }

    var out = {
      id: src.id || util.createUuid(),
      type: type,
      name: src.name || '',
      label: src.label || undefined,
      description: src.description && typeof src.description === 'object'
        ? util.clone(src.description)
        : { format: 'plain', body: String(src.description || '') },
      visible: (typeof src.visible === 'boolean') ? src.visible : (src.enabled !== false),
      state: normalizeRecordState(src),
      deleted: normalizeDeletedInfo(src),
      moveTogether: (false !== src.moveTogether),
      orientation: src.orientation || 'auto',
      spine: {
        kind: spine.kind || defaultSpine.kind,
        color: spine.color || defaultSpine.color,
        width: noteNumberOrDefault(spine.width, defaultSpine.width),
        padding: baseSpinePadding,
        paddingTop: spinePaddingSide('paddingTop'),
        paddingRight: spinePaddingSide('paddingRight'),
        paddingBottom: spinePaddingSide('paddingBottom'),
        paddingLeft: spinePaddingSide('paddingLeft'),
        visible: (typeof spine.visible === 'boolean') ? spine.visible : defaultSpine.visible
      },
      timeline: (type === 'timeline') ? {
        unit: timeline.unit || axis.unit || 'second',
        start: Number.isFinite(Number(timeline.start)) ? Number(timeline.start) : (Number.isFinite(Number(src.timeStart)) ? Number(src.timeStart) : 0),
        end: Number.isFinite(Number(timeline.end)) ? Number(timeline.end) : (Number.isFinite(Number(src.timeEnd)) ? Number(src.timeEnd) : 0),
        mediaRef: timeline.mediaRef || src.mediaRef || '',
        defaultPlayDuration: Number.isFinite(Number(timeline.defaultPlayDuration)) ? Number(timeline.defaultPlayDuration) : (Number.isFinite(Number(src.defaultPlayDuration)) ? Number(src.defaultPlayDuration) : 15)
      } : undefined,
      members: members.map(function (m, i) {
        if (typeof m === 'string') {
          return { nodeId: m, order: i + 1, role: 'member' };
        }
        return {
          nodeId: m.nodeId || m.id || '',
          order: Number(m.order || i + 1),
          role: m.role || 'member'
        };
      }).filter(function (m) {
        return !!m.nodeId;
      }),
      entries: (type === 'viewpoint') ? entries.map(function (entry) {
        var outEntry = {
          role: entry && entry.role || 'entry',
          nodeId: entry && (entry.nodeId || entry.id) || '',
          pageNumber: Math.max(1, Math.floor(Number(entry && entry.pageNumber || 1))),
          comment: String(entry && entry.comment || '')
        };
        return outEntry;
      }).filter(function (entry) {
        return !!entry.nodeId;
      }) : undefined,
      axis: src.axis ? util.clone(src.axis) : undefined,
      origin: src.origin ? util.clone(src.origin) : undefined,
      length: Number.isFinite(Number(src.length)) ? Number(src.length) : undefined,
      groupType: src.groupType || '',
      mediaRef: src.mediaRef || '',
      documentRef: src.documentRef || '',
      representativeNodeId: src.representativeNodeId || '',
      pageCount: Number.isFinite(pageCount) ? pageCount : undefined,
      documentPageCount: Number.isFinite(Number(src.documentPageCount)) ? Math.max(1, Math.floor(Number(src.documentPageCount))) : undefined,
      physicalPageCount: Number.isFinite(Number(src.physicalPageCount)) ? Math.max(1, Math.floor(Number(src.physicalPageCount))) : undefined,
      hasPageCount: (typeof src.hasPageCount === 'boolean') ? src.hasPageCount : undefined,
      timeStart: Number.isFinite(Number(src.timeStart)) ? Number(src.timeStart) : undefined,
      timeEnd: Number.isFinite(Number(src.timeEnd)) ? Number(src.timeEnd) : undefined,
      defaultPlayDuration: Number.isFinite(Number(src.defaultPlayDuration)) ? Number(src.defaultPlayDuration) : undefined,
      audit: normalizeAudit(src.audit, state.currentUser)
    };
    if (out.state === 'deleted') {
      out.visible = false;
    }
    return out;
  }

  function normalizePage(page, pp, resourceById) {
    var src = page || {};
    return PageFactory({
      id: src.id || util.createUuid(),
      pp: Number(src.pp || pp || 1) || 1,
      name: src.name || '',
      description: src.description || '',
      nodes: (src.nodes || []).map(function (node) { return normalizeNode(node, resourceById); }),
      links: (src.links || []).map(normalizeLink),
      groups: (src.groups || []).map(normalizeGroup),
      transform: normalizeTransform(src.transform),
      thumbnail: (typeof src.thumbnail === 'undefined') ? null : src.thumbnail,
      audit: normalizeAudit(src.audit, state.currentUser)
    });
  }

  function normalizePagesCollection(srcPages, resourceById) {
    var pages = [];
    if (Array.isArray(srcPages)) {
      pages = srcPages.map(function (page, index) {
        return normalizePage(page, index + 1, resourceById);
      }).filter(Boolean);
    }
    refreshPageNumbers(pages);
    return pages;
  }

  function refreshPageNumbers(pages) {
    (Array.isArray(pages) ? pages : []).forEach(function (page, index) {
      if (!page.id) { page.id = util.createUuid(); }
      page.pp = index + 1;
    });
    return pages;
  }

  function resolveCurrentPage(pages, currentPageRef) {
    var ref = currentPageRef;
    var page = null;

    pages = Array.isArray(pages) ? pages : [];

    if (typeof ref === 'string' && ref) {
      page = pages.find(function (item) { return item && item.id === ref; }) || null;
    }

    return page || pages[0] || null;
  }

  function canonicalizeCurrentPage(note) {
    var pages = Array.isArray(note && note.pages) ? note.pages : [];
    var page = resolveCurrentPage(pages, note && note.currentPage);

    if (note && page) {
      note.currentPage = page.id;
      note.page = page;
    }

    return page;
  }

  function ensurePagesArray(note, resourceById) {
    var src = note || common.current || {};

    if (!Array.isArray(src.pages)) {
      src.pages = [];
    }

    if (!src.pages.length) {
      src.pages.push(createPage(1));
    }

    refreshPageNumbers(src.pages);
    canonicalizeCurrentPage(src);
    return src.pages;
  }

  function pagesAsArray(note) {
    return ensurePagesArray(note || common.current || {}, {});
  }

  function findPageByRef(note, pageRef) {
    var pages = pagesAsArray(note);
    var ref = (typeof pageRef === 'undefined' || pageRef === null) ? (note && note.currentPage) : pageRef;

    if (typeof ref !== 'string' || !ref) {
      return null;
    }

    return pages.find(function (item) { return item && item.id === ref; }) || null;
  }

  function setCurrentPageByPage(page) {
    if (!page) { return null; }
    current = common.current;
    current.page = page;
    current.currentPage = page.id;
    return page;
  }

  function serializePageForSave(page, index, resources, defaultThumbnail) {
    return {
      id: page.id || util.createUuid(),
      pp: index + 1,
      name: page.name || '',
      description: page.description || '',
      nodes: (page.nodes || []).filter(Boolean).map(function (node) {
        return stripRuntimeNodeForSave(node, resources);
      }),
      links: (page.links || []).filter(Boolean).map(stripRuntimeLink),
      groups: (page.groups || []).filter(Boolean).map(function (group) {
        return stripRuntimeGroup(group, page);
      }),
      transform: normalizeTransform(page.transform),
      thumbnail: (typeof page.thumbnail === 'undefined') ? defaultThumbnail : page.thumbnail,
      audit: normalizeAudit(page.audit || current.audit, state.currentUser)
    };
  }

  function prepareNoteForV2Runtime(note) {
    /*
     * Transitional hook.  wuwei.note.js itself keeps the normal v2 loading path
     * simple; incomplete quasi-v2 notes are first materialized by
     * wuwei.note.v2.js when that migration module is loaded.
     * After all existing notes have been opened and saved as complete v2 notes,
     * remove wuwei.note.v2.js and this optional call.
     */
    if (wuwei && wuwei.note && wuwei.note.v2 &&
        typeof wuwei.note.v2.normalize === 'function') {
      var runtimeNote = wuwei.note.v2.normalize(note, { inPlace: false });
      if (note && note.origin && !runtimeNote.origin) {
        runtimeNote.origin = util.clone(note.origin);
      }
      return runtimeNote;
    }
    return note;
  }

  function materializeNoteForV2Storage(note) {
    if (wuwei && wuwei.note && wuwei.note.v2 &&
        typeof wuwei.note.v2.normalize === 'function') {
      var storageNote = wuwei.note.v2.normalize(note, { inPlace: false });
      if (note && note.origin && !storageNote.origin) {
        storageNote.origin = util.clone(note.origin);
      }
      return storageNote;
    }
    return note;
  }

  function normalizeNote(note) {
    var src = prepareNoteForV2Runtime(note || {});
    var resources = cloneArray(src.resources).map(normalizeResourceDefinition);
    var resourceById = {};
    var pages, currentPage;

    resources.forEach(function (resource) {
      if (resource && resource.id) {
        resourceById[resource.id] = resource;
      }
    });

    pages = normalizePagesCollection(src.pages, resourceById);
    if (!pages.length) {
      pages = [createPage(1)];
    }
    currentPage = resolveCurrentPage(pages, src.currentPage) || pages[0];
    return NoteFactory({
      note_id: src.note_id || util.createUuid(),
      note_name: decodeMaybe(src.note_name || ''),
      description: decodeMaybe((src.description || '').replace(/\\n/g, '\n')),
      currentPage: currentPage.id,
      pages: pages,
      resources: resources,
      thumbnail: (typeof src.thumbnail === 'undefined') ? '' : src.thumbnail,
      joint: normalizeJoint(src.joint || src.collaboration),
      exchange: normalizeExchange(src.exchange),
      jointNoteState: normalizeJointNoteState(src),
      note_scope: normalizeNoteScope(src.note_scope, normalizeJointNoteState(src)),
      team_id: String(src.team_id || ''),
      origin: normalizeOrigin(src.origin, normalizeJointNoteState(src)),
      audit: normalizeAudit(src.audit, state.currentUser)
    });
  }

  function resourceKindFromExtension(src, uri, node) {
    var extKind = util.getDocumentKindByExtension
      ? util.getDocumentKindByExtension(node, src || {}, uri)
      : '';
    uri = String(uri || (src && (src.uri || src.canonicalUri)) || '').toLowerCase();
    if (extKind === 'image') { return 'image'; }
    if (extKind === 'video') { return 'video'; }
    if (extKind === 'audio') { return 'audio'; }
    if (/^(pdf|office|html|text)$/.test(extKind)) { return 'document'; }
    if (/^https?:\/\//.test(uri)) { return 'webpage'; }
    return 'general';
  }

  function upsertResource(resources, resource) {
    if (!resource || !resource.id) { return null; }
    var normalized = normalizeResourceDefinition(resource);
    var found = resources.find(function (item) { return item && item.id === normalized.id; });
    if (found) {
      Object.assign(found, normalized);
      return found;
    }
    resources.push(normalized);
    return normalized;
  }

  function resourceFromContentNode(node) {
    return normalizeResourceDefinition((node && node.resource) || {});
  }

  function uploadRefFromResource(resource) {
    var storage = (resource && resource.storage && typeof resource.storage === 'object') ? resource.storage : {};
    var manifest = (storage.manifest && typeof storage.manifest === 'object') ? storage.manifest : {};
    var files = Array.isArray(storage.files) ? storage.files : [];
    var id = String((resource && resource.id) || '').trim();
    var date = '';
    var i, file, path, match, originalFile;

    if (manifest.path) {
      match = String(manifest.path || '').replace(/\\/g, '/').match(/^(\d{4}\/\d{2}\/\d{2})\/([^/]+)\//);
      if (match) {
        date = match[1];
        id = id || match[2];
      }
    }
    for (i = 0; !date && i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.area || '') !== 'upload') {
        continue;
      }
      path = String(file.path || '').replace(/\\/g, '/');
      match = path.match(/^(\d{4}\/\d{2}\/\d{2})\/([^/]+)\//);
      if (match) {
        date = match[1];
        id = id || match[2];
      }
    }
    for (i = 0; i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.role || '').toLowerCase() === 'original' && file.path) {
        originalFile = String(file.path || '').replace(/\\/g, '/').split('/').pop();
        break;
      }
    }
    if (!id || !date) {
      return null;
    }
    return {
      source: 'upload',
      id: id,
      date: date,
      file: originalFile || ''
    };
  }

  function compactResourceForSave(node) {
    if (!node || !node.resource) {
      return null;
    }
    return normalizeResourceDefinition(node.resource);
  }

  function stripRuntimeNode(node) {
    var out = util.clone(node) || {};
    delete out.vx;
    delete out.vy;
    delete out.fx;
    delete out.fy;
    delete out.index;
    delete out.changed;
    delete out.dragging;
    delete out.opacity;
    delete out.expire;
    delete out.checked;
    delete out.transparency;
    delete out.filterout;
    runtimeStyleFallbackForSave(out);
    stripNodeRuntimeStyleFields(out);
    return out;
  }

  function stripRuntimeNodeForSave(node, resources) {
    var out = stripRuntimeNode(node);
    var compactResource;
    if (out.type === 'Memo') {
      delete out.label;
      if (out.style && typeof out.style === 'object') {
        delete out.style.label;
      }
    }
    if (out.topicKind === 'viewpoint-page' || out.type === 'PageMarker') {
      out = {
        id: out.id,
        type: 'PageMarker',
        topicKind: 'viewpoint-page',
        groupRef: out.groupRef || '',
        viewpointRef: out.viewpointRef || out.groupRef || '',
        documentRef: out.documentRef || '',
        mediaRef: out.mediaRef || out.documentRef || '',
        axisRole: out.axisRole || 'entry',
        pageNumber: Number.isFinite(Number(out.pageNumber))
          ? Math.max(1, Math.floor(Number(out.pageNumber)))
          : 1,
        label: String(out.label || ''),
        description: out.description,
        x: Number.isFinite(Number(out.x)) ? Number(out.x) : 0,
        y: Number.isFinite(Number(out.y)) ? Number(out.y) : 0,
        shape: out.shape || 'CIRCLE',
        size: out.size,
        linkCount: Number.isFinite(Number(out.linkCount)) ? Number(out.linkCount) : 0,
        style: out.style,
        state: out.state || 'active',
        deleted: out.deleted,
        visible: false !== out.visible,
        audit: out.audit
      };
      if (Number.isFinite(Number(node.axisPos))) {
        out.axisPos = Number(node.axisPos);
      }
      out.anchorHref = String(node.anchorHref || '');
      out.htmlAnchorHref = String(node.htmlAnchorHref || '');
    }
    if (out.type === 'Content') {
      compactResource = compactResourceForSave(out);
      if (compactResource) {
        out.resource = compactResource;
      }
      else {
        delete out.resource;
      }
      out.resourceView = (out.resourceView && typeof out.resourceView === 'object')
        ? util.clone(out.resourceView)
        : { mode: 'default' };
      out.resourceView.mode = out.resourceView.mode || 'default';
      delete out.thumbnailUri;
      delete out.resourceRef;
      delete out.uri;
      delete out.url;
      delete out.format;
      delete out.thumbnail;
      delete out.value;
    }
    return out;
  }

  function memberNodeId(member) {
    return (typeof member === 'string') ? member : (member && (member.nodeId || member.id)) || '';
  }

  function buildViewpointEntriesForSave(group, page) {
    var nodes = (page && Array.isArray(page.nodes)) ? page.nodes : [];
    var byId = {};
    nodes.forEach(function (node) {
      if (node && node.id) {
        byId[node.id] = node;
      }
    });
    return (Array.isArray(group.members) ? group.members : []).map(function (member) {
      var id = memberNodeId(member);
      var node = id ? byId[id] : null;
      if (!node || node.topicKind !== 'viewpoint-page') {
        return null;
      }
      var entry = {
        role: 'entry',
        nodeId: node.id,
        order: Number.isFinite(Number(member && member.order)) ? Number(member.order) : undefined,
        pageNumber: Number.isFinite(Number(node.pageNumber)) ? Math.max(1, Math.floor(Number(node.pageNumber))) : 1,
        label: String(node.label || ''),
        comment: node.description && typeof node.description.body === 'string' ? node.description.body : ''
      };
      if (typeof node.anchorHref === 'string' && node.anchorHref) {
        entry.anchorHref = node.anchorHref;
      }
      if (typeof node.htmlAnchorHref === 'string' && node.htmlAnchorHref) {
        entry.htmlAnchorHref = node.htmlAnchorHref;
      }
      return entry;
    }).filter(Boolean);
  }

  function stripRuntimeLink(link) {
    var out = util.clone(link) || {};
    if (out.from && typeof out.from === 'object') { out.from = out.from.id; }
    if (out.to && typeof out.to === 'object') { out.to = out.to.id; }
    if (out.source && typeof out.source === 'object') { out.source = out.source.id; }
    if (out.target && typeof out.target === 'object') { out.target = out.target.id; }
    delete out.source;
    delete out.target;
    delete out.index;
    delete out.filterout;
    delete out.changed;
    delete out.dragging;
    delete out.path;
    delete out.straight;
    delete out._markerPath;
    delete out._markerTransform;
    return out;
  }

  function stripRuntimeGroup(group, page) {
    var out = util.clone(group) || {};
    delete out._sim;
    delete out.axisPseudoLinkId;
    delete out.pseudoNodeId;
    delete out.pseudoLinkId;
    delete out.strokeColor;
    delete out.strokeWidth;
    if (out.type === 'viewpoint') {
      delete out.contents;
      out.entries = buildViewpointEntriesForSave(out, page);
    }
    if (Array.isArray(out.members)) {
      out.members = out.members.map(function (member) {
        var next = util.clone(member) || {};
        if (typeof member === 'string') {
          return { nodeId: member, role: 'member' };
        }
        delete next._simDx;
        delete next._simDy;
        if (!next.nodeId && next.id) {
          next.nodeId = next.id;
          delete next.id;
        }
        next.role = next.role || 'member';
        return next;
      });
    }
    return out;
  }

  /** Note
   * common.current is current Note
   */
  class Note {
    constructor(param) {
      param = param || {};
      this.note_id = param.note_id || util.createUuid();
      this.note_name = param.note_name || '';
      this.description = param.description || '';
      this.pages = Array.isArray(param.pages) ? param.pages : [];
      if (!this.pages.length) {
        this.pages.push(createPage(1));
      }
      refreshPageNumbers(this.pages);
      this.page = resolveCurrentPage(this.pages, param.currentPage) || this.pages[0];
      this.currentPage = this.page.id;
      this.resources = cloneArray(param.resources).map(normalizeResourceDefinition);
      this.thumbnail = (typeof param.thumbnail === 'undefined') ? '' : param.thumbnail;
      this.joint = normalizeJoint(param.joint || param.collaboration);
      this.exchange = normalizeExchange(param.exchange);
      this.jointNoteState = normalizeJointNoteState(param);
      this.note_scope = normalizeNoteScope(param.note_scope, this.jointNoteState);
      this.team_id = String(param.team_id || '');
      this.origin = normalizeOrigin(param.origin, this.jointNoteState);
      const portable = (param.bundle && typeof param.bundle === 'object')
        ? param.bundle
        : ((param.portable && typeof param.portable === 'object')
          ? param.portable
          : ((param.resourceBundle && typeof param.resourceBundle === 'object') ? param.resourceBundle : null));
      this.bundle = portable ? util.clone(portable) : null;
      this.portable = this.bundle;
      this.audit = normalizeAudit(param.audit, state.currentUser);
    }
  }

  function NoteFactory(param) {
    if (!param) {
      return null;
    }
    var pages = Array.isArray(param.pages)
      ? param.pages.map(function (page, index) { return PageFactory(Object.assign({}, page, { pp: index + 1 })); }).filter(Boolean)
      : [];
    if (!pages.length) {
      pages.push(PageFactory(param.page || createPage(1)));
    }
    refreshPageNumbers(pages);
    param.pages = pages;
    param.currentPage = (resolveCurrentPage(pages, param.currentPage) || pages[0]).id;
    return new Note(param);
  }

  function translateLabel(key) {
    return (wuwei && wuwei.nls && typeof wuwei.nls.translate === 'function')
      ? wuwei.nls.translate(key)
      : key;
  }

  function isJointNoteForDisplay(note) {
    var src = note || common.current || {};
    var noteState = String(src.jointNoteState || src.collabNoteState || '').toLowerCase();
    var noteScope = String(src.note_scope || '').toLowerCase();
    var origin = (src.origin && typeof src.origin === 'object') ? src.origin : {};
    var originType = String(origin.type || '').toLowerCase();
    var originSource = String(origin.source || '').toLowerCase();
    var joint = (src.joint && typeof src.joint === 'object') ? src.joint :
      ((src.collaboration && typeof src.collaboration === 'object') ? src.collaboration : {});

    if (noteState === 'team') {
      return true;
    }
    if (noteState === 'own' || noteState === 'imported') {
      return false;
    }
    if (originType === 'import' || originSource === 'export-package') {
      return false;
    }

    return !!(
      noteScope === 'team' ||
      joint.enabled === true ||
      originType === 'team' ||
      originSource === 'team-note' ||
      src.team_id
    );
  }

  function getNoteDisplayName(note) {
    var src = note || common.current || {};
    var base = String(src.note_name || '');
    var suffix;

    if (!isJointNoteForDisplay(src)) {
      return base;
    }

    suffix = '(' + translateLabel('Joint Note') + ')';
    if (base.slice(-suffix.length) === suffix) {
      return base;
    }
    return base + suffix;
  }

  function updateNoteNameDisplay(note) {
    var src = note || common.current || {};
    var noteName = document.querySelector('#note_name .name');
    var noteDesc = document.querySelector('#note_name .description');

    if (noteName) {
      noteName.textContent = getNoteDisplayName(src);
    }
    if (noteDesc) {
      noteDesc.textContent = src.description || '';
    }
  }

  function newNote() {
    let note,
      pages;
    /** remove graphic */
    document.querySelectorAll('g.link').forEach(el => remove(el));
    document.querySelectorAll('g.node').forEach(el => remove(el));
    document.querySelectorAll('.miniCanvas path').forEach(el => remove(el));
    document.querySelectorAll('.miniCanvas g').forEach(el => remove(el));
    if (document.querySelector('#Pagination .pagination')) {
      document.querySelector('#Pagination .pagination').innerHTML = '';
    }

    const firstPage = createPage(1);
    current = NoteFactory({
      note_id: DRAFT_NOTE_ID,
      note_name: '',
      description: '',
      currentPage: firstPage.id,
      pages: [firstPage],
      resources: [],
      audit: normalizeAudit(null, state.currentUser)
    });

    common.current = current;
    setGraphFromCurrentPage(firstPage.id);
    updateCanvasTransform(util.getPageTransform(current.page));

    updateNoteNameDisplay(current);
    updatePageName(current.page);

    return current;
  }

  function updateNote(note_) {
    if (!note_) {
      return newNote();
    }
    if ('string' === typeof note_) {
      try {
        note_ = JSON.parse(note_);
      }
      catch (e) { console.log(e); }
    }
    current = normalizeNote(note_);
    common.current = current;
    const page = setGraphFromCurrentPage(current.currentPage);
    updateCanvasTransform(util.getPageTransform(page));
    updateNoteNameDisplay(current);
    return current;
  }

  function persistNote(form, actionName) {
    ensureEditableNoteId();
    ensurePersonalCopyBeforeSave(actionName || 'save-note');
    synchronizeRemoteContentUrlsForSave(current);

    const nameEl = form && form.elements ? form.elements['name'] : null;
    const descEl = form && form.elements ? form.elements['description'] : null;

    const note_name = (nameEl && 'value' in nameEl ? nameEl.value : current.note_name || '').trim();
    let description = (descEl && 'value' in descEl ? descEl.value : current.description || '');

    // ノート名はそのまま更新するが、名称変更だけで note_id は変えない
    current.note_name = note_name;

    description = description.replace(/\n/g, '\\n');
    current.description = description;

    const currentPageThumbnail = snapshotCurrentPageThumbnail();

    // Build a clean JSON that contains only pages -> nodes/links.
    // (D3 may mutate link endpoints to objects; normalise them back to id strings.)
    const noteToSave = {
      dataModel: { name: 'wuwei.note', version: 'v2' },
      note_id: current.note_id,
      note_name: current.note_name,
      description: current.description,
      thumbnail: currentPageThumbnail || '',
      currentPage: (current.page && current.page.id) || current.currentPage,
      resources: [],
      pages: [],
      joint: normalizeJoint(current.joint || current.collaboration),
      exchange: normalizeExchange(current.exchange),
      jointNoteState: normalizeJointNoteState(current),
      note_scope: normalizeNoteScope(current.note_scope, normalizeJointNoteState(current)),
      team_id: String(current.team_id || ''),
      origin: normalizeOrigin(current.origin, normalizeJointNoteState(current)),
      audit: normalizeAudit(current.audit, state.currentUser)
    };

    applyPersonalNoteSavePolicy(noteToSave);

    pagesAsArray(current).forEach(function (page, index) {
      if (!page) { return; }
      noteToSave.pages.push(serializePageForSave(page, index, noteToSave.resources, currentPageThumbnail));
    });

    current.resources = noteToSave.resources;
    current.thumbnail = noteToSave.thumbnail;
    const noteJson = JSON.stringify(materializeNoteForV2Storage(noteToSave)).trim();
    const iconHTML = currentPageThumbnail || '';
    const cu = state.currentUser || {};
    const action = util.getAction(actionName || 'save-note')
    return ajaxRequest(action, {
      id: current.note_id,
      name: current.note_name,
      description: current.description,
      json: noteJson,
      thumbnail: iconHTML,
      user_id: cu.user_id
    }, 'POST', 30000).then(function (responseText) {
      const saveResult = parseSaveResponse(responseText);
      if (saveResult.note_id && util.isUUIDid(saveResult.note_id)) {
        current.note_id = saveResult.note_id;
      }
      delete current.bundle;
      delete current.portable;
      return saveResult.name || responseText;
    });
  }

  function saveNote(form) {
    return persistNote(form, 'save-note');
  }

  function importNote(form) {
    return persistNote(form, 'import-note');
  }

  function exportNoteText() {
    ensureEditableNoteId();
    synchronizeRemoteContentUrlsForSave(current);

    const currentPageThumbnail = snapshotCurrentPageThumbnail();
    const noteToExport = {
      dataModel: { name: 'wuwei.note', version: 'v2' },
      note_id: current.note_id,
      note_name: current.note_name || '',
      description: current.description || '',
      thumbnail: currentPageThumbnail || '',
      currentPage: (current.page && current.page.id) || current.currentPage,
      resources: cloneArray(current.resources).map(normalizeResourceDefinition),
      pages: [],
      joint: normalizeJoint(current.joint || current.collaboration),
      exchange: normalizeExchange(current.exchange),
      jointNoteState: normalizeJointNoteState(current),
      note_scope: normalizeNoteScope(current.note_scope, normalizeJointNoteState(current)),
      team_id: String(current.team_id || ''),
      origin: normalizeOrigin(current.origin, normalizeJointNoteState(current)),
      audit: normalizeAudit(current.audit, state.currentUser)
    };

    pagesAsArray(current).forEach(function (page, index) {
      if (!page) { return; }
      noteToExport.pages.push(serializePageForSave(page, index, noteToExport.resources, currentPageThumbnail));
    });

    current.resources = noteToExport.resources;
    current.thumbnail = noteToExport.thumbnail;
    return JSON.stringify(materializeNoteForV2Storage(noteToExport)).trim();
  }

  function exportPortableNoteText() {
    if (!current.note_id || !util.isUUIDid(current.note_id)) {
      return Promise.resolve(exportNoteText());
    }
    const cu = state.currentUser || {};
    if (!cu.user_id) {
      return Promise.resolve(exportNoteText());
    }
    const action = util.getAction('load-note');
    return ajaxRequest(action, {
      id: current.note_id,
      user_id: cu.user_id,
      bundle: 1
    }, 'POST', 30000).then(function (responseText) {
      return String(responseText || '').trim() || exportNoteText();
    });
  }

  function publishNote() {
    if (!current.note_id || !util.isUUIDid(current.note_id)) {
      current.note_id = util.createUuid();
    }
    const noteJson = exportNoteText();
    const currentPage = findPageByRef(current, current.currentPage) || current.page;
    const thumbnail = (currentPage && currentPage.thumbnail) || snapshotCurrentPageThumbnail() || '';
    const data = {
      user_id: state.currentUser.user_id,
      id: current.note_id,
      name: current.note_name || '',
      description: current.description || '',
      json: noteJson,
      thumbnail: thumbnail
    };
    const action = util.getAction('publish-note')
    return ajaxRequest(action, data, 'POST', 30000);
  }

  function listNote(start, count, options) {
    // list note from server from start to (start + count)
    start = +start || 1;
    count = +count || 12;
    const cu = state.currentUser || {};
    const includeNewNote = options && (options.include_new_note || options.includeDraft || options.draft);
    const action = util.getAction('list-note')
    const data = {
      start: start,
      count: count,
      user_id: cu.user_id
    };
    if (includeNewNote) {
      data.include_new_note = 1;
    }
    if (options && (options.include_ver0 || options.includeVer0)) {
      data.include_ver0 = 1;
    }
    if (options && (options.include_ver1 || options.includeVer1 || options.legacy)) {
      data.include_ver1 = 1;
    }
    ['term', 'year', 'month', 'date', 'start_date', 'end_date', 'note_format'].forEach(function (key) {
      if (options && options[key]) {
        data[key] = options[key];
      }
    });
    return ajaxRequest(action, data, 'POST', 30000);
  }

  function searchNote(param) {
    const today = new Date();
    let
      term, start, count, year, month;
    if (param) {
      term = param.term;
      start = param.start;
      count = param.count;
    } else {
      start = 1;
      count = 12;
    }
    if (!term) {
      term = '';
    } else if (term.match('/ /')) {
      term = term.replace(/ /g, '+');
    }
    const cu = state.currentUser || {};
    const action = util.getAction('list-note')
    const data = {
      start: start || 1,
      count: count || 12,
      user_id: cu.user_id
    };
    if (term) {
      data.term = term;
    }
    ['year', 'month', 'date', 'start_date', 'end_date', 'include_new_note', 'include_ver0', 'include_ver1', 'note_format'].forEach(function (key) {
      if (param && param[key]) {
        data[key] = param[key];
      }
    });
    return ajaxRequest(action, data, 'POST', 30000);
  }

  function noteRequestData(noteRef, noteKey) {
    const data = {
      id: '',
      note_key: '',
      key: '',
      dir: ''
    };

    if (noteRef && typeof noteRef === 'object') {
      data.id = String(noteRef.id || noteRef.note_id || '');
      data.note_key = String(noteRef.note_key || noteRef.key || noteRef.dir || noteRef.path || noteRef.notePath || '');
    }
    else {
      const refText = String(noteRef || '');
      data.note_key = String(noteKey || '');
      if (!data.note_key && refText.indexOf('/') >= 0) {
        const parts = refText.replace(/\\/g, '/').split('/').filter(Boolean);
        data.note_key = refText;
        data.id = parts.length ? parts[parts.length - 1] : '';
        if (data.id === 'note.json') {
          data.id = parts.length >= 2 ? parts[parts.length - 2] : '';
        }
      }
      else {
        data.id = refText;
      }
    }

    data.id = data.id.trim();
    data.note_key = data.note_key.trim();

    if (data.note_key) {
      data.key = data.note_key;
      data.dir = data.note_key;
    }

    return data;
  }

  /**
   * Load a note.
   *
   * Prefer note_key returned by list-note over id.  id can be duplicated when
   * a note was copied or restored under a different dated directory.
   *
   * Accepts either:
   *   loadNote(noteId)
   *   loadNote({ id: noteId, note_key: 'YYYY/MM/DD/noteId' })
   *   loadNote(noteId, noteKey)
   *
   * @param {string|Object} noteRef
   * @param {string=} noteKey
   */
  function loadNote(noteRef, noteKey) {
    newNote();
    const cu = state.currentUser || {};
    const action = util.getAction('load-note');
    const data = noteRequestData(noteRef, noteKey);
    data.user_id = cu.user_id;
    return ajaxRequest(action, data, 'POST', 5000);
  }

  /**
   * Delete a note.
   *
   * Prefer note_key returned by list-note over id.  id can be duplicated when
   * a note was copied or restored under a different dated directory.
   *
   * Accepts either:
   *   removeNote(noteId)
   *   removeNote({ id: noteId, note_key: 'YYYY/MM/DD/noteId' })
   *   removeNote(noteId, noteKey)
   *
   * @param {string|Object} noteRef
   * @param {string=} noteKey
   */
  function removeNote(noteRef, noteKey) {
    const cu = state.currentUser || {};
    const action = util.getAction('remove-note');
    const data = noteRequestData(noteRef, noteKey);
    data.user_id = cu.user_id;
    return ajaxRequest(action, data, 'POST', 5000);
  }

  /** Page */
  class Page {
    constructor(param) {
      param = param || {};
      this.id = param.id || util.createUuid();
      this.pp = param.pp || 1;
      this.name = param.name || '';
      this.description = param.description || '';
      this.nodes = (Array.isArray(param.nodes) ? param.nodes : []).map(n => model.NodeFactory(n));
      this.links = (Array.isArray(param.links) ? param.links : []).map(l => model.LinkFactory(l));
      this.groups = (Array.isArray(param.groups) ? param.groups : []).map(g => GroupFactory(g));
      this.transform = normalizeTransform(param.transform || param.translate);
      this.thumbnail = (typeof param.thumbnail === 'undefined') ? null : param.thumbnail;
      this.audit = normalizeAudit(param.audit, state.currentUser);
    }
  }

  /**
   * 
   * @param {*} param 
   */
  function PageFactory(param) {
    if (!param) {
      return null;
    }
    const page = new Page(param);
    return page;
  }

  function GroupFactory(param) {
    return normalizeGroup(param || {});
  }

  function createPage(pp, param) {
    const base = Object.assign({
      id: util.createUuid(),
      pp: Number(pp) || 1,
      name: '',
      description: '',
      nodes: [],
      links: [],
      groups: [],
      transform: { x: 0, y: 0, scale: 1 },
      thumbnail: null,
      audit: normalizeAudit(null, state.currentUser)
    }, param || {});
    base.pp = Number(base.pp) || 1;
    if (!Array.isArray(base.nodes)) { base.nodes = []; }
    if (!Array.isArray(base.links)) { base.links = []; }
    if (!Array.isArray(base.groups)) { base.groups = []; }
    if (!base.transform) { base.transform = { x: 0, y: 0, scale: 1 }; }
    return PageFactory(base);
  }

  function setGraphFromPage(page) {
    if (!page) {
      return null;
    }
    current = common.current;
    current.page = page;

    current.currentPage = page.id || current.currentPage;
    return setGraphFromCurrentPage(current.currentPage);
  }

  function setGraphFromCurrentPage(pageRef) {
    var pp = pageRef;
    // graph 構成は model 側が pseudo group / timeline を含めて管理する。
    if (pp != null) {
      wuwei.model.getCurrentPage(pageRef);
    }
    return wuwei.model.setGraphFromCurrentPage();
  }

  function bindGraphToCurrentPage() {
    current = common.current;
    if (!current) {
      return null;
    }
    return setGraphFromCurrentPage(current.currentPage);
  }

  function updateCanvasTransform(translate) {
    const t = normalizeTransform(translate || { x: 0, y: 0, scale: 1 });
    const selector = '#' + state.canvasId;
    let canvas;

    graph.transform = t;
    if (current && current.page) { current.page.transform = t; }

    if (typeof d3 !== 'undefined' && d3.select) {
      canvas = d3.select(selector);
      if (canvas && canvas.node()) {
        canvas.attr('transform', 'translate(' + t.x + ',' + t.y + ') scale(' + t.scale + ')');
      }

      if (state.zoomSvg && state.zoomBehavior && d3.zoomIdentity && typeof state.zoomSvg.call === 'function') {
        state.zoomSvg.call(state.zoomBehavior.transform, d3.zoomIdentity.translate(t.x, t.y).scale(t.scale));
      }
    }
  }

  function redrawCurrentPage() {
    if (wuwei.draw) {
      if ('simulation' === graph.mode && typeof wuwei.draw.restart === 'function') {
        wuwei.draw.restart();
      } else if (typeof wuwei.draw.refresh === 'function') {
        wuwei.draw.refresh();
      }
    }
  }

  function buildPageThumbnail(page, width, height) {
    if (!page) {
      return '';
    }
    return util.buildMiniatureSvgString({
      width: width || 200,
      height: height || 200,
      useDataOnly: true,
      showViewFrame: true,
      backgroundFill: '#ffffff',
      page: page,
      nodes: page.nodes || [],
      links: (util.getMiniatureLinks ? util.getMiniatureLinks(page) : (page.links || []))
    });
  }

  function isBlankPageThumbnail(thumbnail) {
    var text = String(thumbnail || '').trim();
    var testText;

    if (!text) {
      return true;
    }

    /*
     * Non-SVG thumbnails, for example a URL or data URI, should be preserved.
     */
    if (!/<svg[\s>]/i.test(text)) {
      return false;
    }

    /*
     * Stored miniature thumbnails are useful when they contain a rendered node,
     * link, axis, group box, image, or text.  A plain white SVG containing only
     * the background/view frame is treated as blank and must not overwrite an
     * existing page.thumbnail.
     */
    if (/(class=["'][^"']*(?:\bnode\b|\blink\b|shape-node|memo-node|thumbnail-outline|group-box|group-axis|timeline-axis)[^"']*["'])/i.test(text)) {
      return false;
    }
    if (/<(?:circle|path|polygon|polyline|line|image|text)\b/i.test(text)) {
      return false;
    }

    testText = text
      .replace(/<rect\b[^>]*(?:id=["']miniFrame["']|class=["'][^"']*\bminiFrame\b[^"']*["'])[^>]*>/ig, '')
      .replace(/<rect\b[^>]*(?:fill=["'](?:#fff|#ffffff|white|none)["']|stroke=["']none["'])[^>]*>/ig, '');

    return !/<rect\b/i.test(testText);
  }

  function captureCurrentMiniatureThumbnail() {
    var currentNote = common.current;
    var page = currentNote && currentNote.page;

    /*
     * The live miniature DOM may contain runtime load-file URLs with
     * user_id query parameters in <image href="...">.  The saved note
     * thumbnail is storage data, so generate it from the page model instead
     * of cloning the runtime DOM.
     */
    if (page) {
      return buildPageThumbnail(page, 200, 200);
    }
    return '';
  }

  function updatePageThumbnail(page) {
    var targetPage = page;
    var isCurrentPage, thumbnail, fallback;
    var existingThumbnail;
    var current;

    current = common.current;
    if (!targetPage) {
      targetPage = current && current.page;
    }
    if (!targetPage) {
      return '';
    }

    existingThumbnail = targetPage.thumbnail || '';
    isCurrentPage = current && current.page && (
      current.page === targetPage ||
      current.currentPage === targetPage.id
    );

    /*
     * 他ページの既存サムネイルは、ページ一覧表示や削除処理で再生成しない。
     * pages[n].thumbnail を正とし、空白でない限りそのまま返す。
     */
    if (!isCurrentPage && existingThumbnail && !isBlankPageThumbnail(existingThumbnail)) {
      return existingThumbnail;
    }

    thumbnail = isCurrentPage ? captureCurrentMiniatureThumbnail() : '';
    if (isBlankPageThumbnail(thumbnail)) {
      thumbnail = '';
    }

    if (!thumbnail) {
      fallback = buildPageThumbnail(targetPage);
      thumbnail = isBlankPageThumbnail(fallback) ? '' : fallback;
    }

    if (thumbnail) {
      targetPage.thumbnail = thumbnail;
    }
    else if (existingThumbnail && !isBlankPageThumbnail(existingThumbnail)) {
      targetPage.thumbnail = existingThumbnail;
    }
    else if (typeof targetPage.thumbnail === 'undefined' || targetPage.thumbnail === null) {
      targetPage.thumbnail = '';
    }

    return targetPage.thumbnail || '';
  }

  function snapshotCurrentPageThumbnail() {
    return updatePageThumbnail();
  }

  function getNewPP() {
    current = common.current;
    return pagesAsArray(current).length + 1;
  }

  /*  function applyPageState(page) {
      const activePage = setGraphFromPage(page || wuwei.model.getCurrentPage());
      updateCanvasTransform(util.getPageTransform(activePage));
      redrawCurrentPage();
      return activePage;
    }*/
  function applyPageState(page) {
    const targetPage = page || wuwei.model.getCurrentPage();
    let activePage;

    if (!targetPage) {
      return null;
    }

    current = common.current;
    setCurrentPageByPage(targetPage);

    activePage = setGraphFromCurrentPage(targetPage.id);
    if (!activePage) {
      activePage = targetPage;
    }

    updateCanvasTransform(util.getPageTransform(activePage));
    redrawCurrentPage();
    return activePage;
  }

  function isPageCopyRepresentativeNode(node) {
    return !!(node && node.groupRole === 'representative' && node.groupRef);
  }

  function remapObjectReference(obj, key, indexer) {
    if (obj && obj[key] && indexer && indexer[obj[key]]) {
      obj[key] = indexer[obj[key]];
    }
  }

  function remapNodeForPageCopy(node, groupIndexer, nodeIndexer) {
    if (!node) { return; }

    remapObjectReference(node, 'groupRef', groupIndexer);
    remapObjectReference(node, 'documentRef', nodeIndexer);
    remapObjectReference(node, 'mediaRef', nodeIndexer);
    remapObjectReference(node, 'contentRef', nodeIndexer);

    if (node.representativeOf && node.representativeOf.id && groupIndexer[node.representativeOf.id]) {
      node.representativeOf.id = groupIndexer[node.representativeOf.id];
    }
  }

  function remapLinkForPageCopy(link, groupIndexer) {
    if (!link) { return; }
    remapObjectReference(link, 'groupRef', groupIndexer);
  }

  function remapGroupForPageCopy(group, groupIndexer, nodeIndexer) {
    var oldId;
    var oldRepresentativeId;

    if (!group) { return; }

    oldId = group.id;
    oldRepresentativeId = group.representativeNodeId || '';

    if (oldId && groupIndexer[oldId]) {
      group.id = groupIndexer[oldId];
    }

    if (Array.isArray(group.members)) {
      group.members = group.members.map(function (it) {
        var next = util.clone(it);
        if (typeof next === 'string') {
          return nodeIndexer[next] || next;
        }
        next.nodeId = nodeIndexer[next.nodeId] || next.nodeId;
        return next;
      }).filter(function (it) {
        return !!(typeof it === 'string' ? it : it && it.nodeId);
      });
    }

    if (Array.isArray(group.item)) {
      group.item = group.item.map(function (it) {
        var next = util.clone(it);
        if (typeof next === 'string') {
          return nodeIndexer[next] || next;
        }
        next.nodeId = nodeIndexer[next.nodeId] || next.nodeId;
        return next;
      }).filter(function (it) {
        return !!(typeof it === 'string' ? it : it && it.nodeId);
      });
    }


    group.representativeNodeId = nodeIndexer[oldRepresentativeId] || '';

    remapObjectReference(group, 'mediaRef', nodeIndexer);
    remapObjectReference(group, 'documentRef', nodeIndexer);
    if (group.timeline) {
      remapObjectReference(group.timeline, 'mediaRef', nodeIndexer);
    }
  }

  function copyPage(sourcePageId) {
    current = common.current;
    const pages = pagesAsArray(current);
    const nodeIndexer = {};
    const linkIndexer = {};
    const groupIndexer = {};
    const primaryRepresentativeIds = {};
    let _id, id, sourcePage, copiedPage;

    snapshotCurrentPageThumbnail();
    sourcePage = (sourcePageId != null) ? findPageByRef(current, sourcePageId) : (current.page || wuwei.model.getCurrentPage());
    if (!sourcePage) {
      return current.page || null;
    }

    copiedPage = PageFactory(Object.assign(util.clone(sourcePage), { id: util.createUuid(), pp: pages.length + 1 }));

    /*
     * Group definitions are page-local.  A copied page must not share group
     * IDs with the source page; otherwise representative topics from earlier
     * copies look like valid members of the new groups.  Keep at most one
     * representative topic per copied group (the one referenced by the group)
     * and let normal group normalisation recreate a missing representative.
     */
    (copiedPage.groups || []).forEach(function (group) {
      if (!group || !group.id) { return; }
      groupIndexer[group.id] = util.createUuid();
      if (group.representativeNodeId) {
        primaryRepresentativeIds[group.representativeNodeId] = true;
      }
    });

    copiedPage.nodes = (copiedPage.nodes || []).filter(function (node) {
      return !isPageCopyRepresentativeNode(node) || !!primaryRepresentativeIds[node.id];
    });

    copiedPage.links = (copiedPage.links || []).filter(function (link) {
      var srcId = (link.from && typeof link.from === 'object') ? link.from.id
        : link.from;
      var tgtId = (link.to && typeof link.to === 'object') ? link.to.id
        : link.to;
      return copiedPage.nodes.some(function (node) { return node && node.id === srcId; }) &&
        copiedPage.nodes.some(function (node) { return node && node.id === tgtId; });
    });

    pages.push(copiedPage);
    refreshPageNumbers(pages);

    setCurrentPageByPage(copiedPage);

    for (let node of copiedPage.nodes) {
      id = util.createUuid();
      nodeIndexer[node.id] = id;
    }
    for (let link of copiedPage.links) {
      id = util.createUuid();
      linkIndexer[link.id] = id;
    }

    for (let node of copiedPage.nodes) {
      _id = node.id;
      remapNodeForPageCopy(node, groupIndexer, nodeIndexer);
      node.id = nodeIndexer[_id];
    }

    for (let link of copiedPage.links) {
      _id = link.id;
      const srcId = (link.from && typeof link.from === 'object') ? link.from.id
        : link.from;
      const tgtId = (link.to && typeof link.to === 'object') ? link.to.id
        : link.to;
      link.id = linkIndexer[_id];
      link.from = nodeIndexer[srcId] || srcId;
      link.to = nodeIndexer[tgtId] || tgtId;
      remapLinkForPageCopy(link, groupIndexer);
    }

    for (let group of (copiedPage.groups || [])) {
      remapGroupForPageCopy(group, groupIndexer, nodeIndexer);
    }

    applyPageState(current.page);
    updatePageName(current.page);
    return current.page;
  }

  function clonePage() {
    current = common.current;
    const pages = pagesAsArray(current);
    let clonedPage;

    snapshotCurrentPageThumbnail();
    clonedPage = PageFactory(Object.assign(util.clone(wuwei.model.getCurrentPage()), { id: util.createUuid(), pp: pages.length + 1 }));
    pages.push(clonedPage);
    refreshPageNumbers(pages);
    setCurrentPageByPage(clonedPage);
    setGraphFromCurrentPage(clonedPage.id);

    applyPageState(current.page);
    updatePageName(current.page);
    return current.page;
  }

  function addPage(pp) {
    current = common.current;
    if (!pp) {
      pp = getNewPP();
    }

    const pages = pagesAsArray(current);

    snapshotCurrentPageThumbnail();

    const page = createPage(pp);
    pages.push(page);
    refreshPageNumbers(pages);
    setCurrentPageByPage(page);

    applyPageState(current.page);
    updatePageName(current.page);
    return current.page;
  }

  function newPage(pp) {
    return addPage(pp);
  }

  function removePage(pageId) {
    current = common.current;
    const pages = pagesAsArray(current);
    const targetPage = findPageByRef(current, pageId);
    const targetIndex = pages.indexOf(targetPage);
    const deletingCurrent =
      !!targetPage && (current.currentPage === targetPage.id || current.page === targetPage);

    if (targetIndex < 0) {
      return current.page || wuwei.model.getCurrentPage();
    }

    if (!deletingCurrent) {
      snapshotCurrentPageThumbnail();
    }

    pages.splice(targetIndex, 1);
    refreshPageNumbers(pages);

    if (pages.length === 0) {
      pages.push(createPage(1));
      refreshPageNumbers(pages);
      setCurrentPageByPage(pages[0]);
      setGraphFromCurrentPage(pages[0].id);
      applyPageState(current.page);
      updatePageName(current.page);
      return current.page;
    }

    setCurrentPageByPage(deletingCurrent ? pages[Math.min(targetIndex, pages.length - 1)] : (findPageByRef(current, current.currentPage) || pages[0]));

    setGraphFromCurrentPage(current.currentPage);
    applyPageState(current.page);
    updatePageName(current.page);
    return current.page;
  }

  function namePage() {
    wuwei.menu.page.namePageOpen();
  }

  /**
   * 
   * @param {*} page 
   */
  function openPage(pageId) {
    current = common.current;
    const page = findPageByRef(current, pageId);
    if (!page) {
      return null;
    }
    snapshotCurrentPageThumbnail();
    setCurrentPageByPage(page);

    applyPageState(current.page);
    updatePageName(current.page);
    return current.page;
  }

  function updatePageName(currentPage) {
    current = common.current;
    const page = currentPage || wuwei.model.getCurrentPage();
    const span_pp = document.querySelector('#page_name .pp');
    const span_name = document.querySelector('#page_name .name');
    const span_description = document.querySelector('#page_name .description');
    updateNoteNameDisplay(current);
    if (span_pp) {
      span_pp.textContent = (pagesAsArray(current).length > 1) ? `P.${page.pp}` : '';
    }
    if (span_name) {
      span_name.textContent = page.name || '';
    }
    if (span_description) {
      span_description.textContent = page.description || '';
    }
    registerPagebuttonEventSafely();
  }

  function registerPagebuttonEventSafely() {
    var menuApi = wuwei && wuwei.menu;

    if (menuApi && typeof menuApi.registerPagebuttonEvent === 'function') {
      menuApi.registerPagebuttonEvent();
      return;
    }
    if (menuApi && typeof menuApi.registerPageButtonEvent === 'function') {
      menuApi.registerPageButtonEvent();
    }
  }

  function listPage() {
    wuwei.menu.page.list();
  }

  function initModule() {
    newNote();
  }

  return {
    /** Note */
    Note: Note,
    NoteFactory: NoteFactory,
    newNote: newNote,
    updateNote: updateNote,
    exportNoteText: exportNoteText,
    exportPortableNoteText: exportPortableNoteText,
    saveNote: saveNote,
    importNote: importNote,
    publishNote: publishNote,
    searchNote: searchNote,
    listNote: listNote,
    loadNote: loadNote,
    removeNote: removeNote,
    isJointNoteForDisplay: isJointNoteForDisplay,
    getNoteDisplayName: getNoteDisplayName,
    updateNoteNameDisplay: updateNoteNameDisplay,
    /** Page */
    Page: Page,
    PageFactory: PageFactory,
    createPage: createPage,
    ensurePagesArray: ensurePagesArray,
    setGraphFromCurrentPage: setGraphFromCurrentPage,
    bindGraphToCurrentPage: bindGraphToCurrentPage,
    namePage: namePage,
    copyPage: copyPage,
    clonePage: clonePage,
    addPage: addPage,
    newPage: newPage,
    removePage: removePage,
    openPage: openPage,
    listPage: listPage,
    buildPageThumbnail: buildPageThumbnail,
    updatePageThumbnail: updatePageThumbnail,
    /** init */
    initModule: initModule
  };
})();
// wuwei.note.js last modified 2026-05-19
