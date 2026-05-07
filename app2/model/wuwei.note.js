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
    return {
      owner: (audit && audit.owner) || currentUser.name || currentUser.login || 'guest',
      createdBy: (audit && audit.createdBy) || currentUser.user_id || common.TEMP_OWNER_ID,
      createdAt: (audit && audit.createdAt) || nowIsoString(),
      lastModifiedBy: (audit && audit.lastModifiedBy) || '',
      lastModifiedAt: (audit && audit.lastModifiedAt) || ''
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

  function normalizeViewer(viewer) {
    var supported = (viewer && Array.isArray(viewer.supportedModes)) ? viewer.supportedModes.slice() : [];
    var embed = (viewer && viewer.embed && typeof viewer.embed === 'object') ? util.clone(viewer.embed) : {};
    if (!supported.length) {
      supported = ['infoPane', 'newTab', 'newWindow', 'download'];
    }
    return {
      supportedModes: supported,
      defaultMode: (viewer && viewer.defaultMode) || supported[0] || 'infoPane',
      embed: embed,
      thumbnailUri: String((viewer && viewer.thumbnailUri) || embed.thumbnailUri || '')
    };
  }

  function cloneArray(value) {
    return Array.isArray(value) ? value.filter(Boolean).map(function (item) { return util.clone(item); }) : [];
  }

  function normalizeStorage(storage) {
    var src = (storage && typeof storage === 'object') ? storage : {};
    var files = Array.isArray(src.files) ? src.files.map(function (file) {
      var out = util.clone(file);
      var area = String(out.area || '').trim();
      var role = String(out.role || '').toLowerCase();
      if (!area) {
        area = (role === 'original') ? 'upload' : 'note';
      }
      if (out.path) {
        out.path = util.toStorageRelativePath(out.path, state.currentUser && state.currentUser.user_id, area);
      }
      delete out.sourcePath;
      out.area = area;
      return out;
    }) : [];
    return {
      managed: src.managed === true,
      copyPolicy: src.copyPolicy || (src.managed === true ? 'snapshot' : 'metadataOnly'),
      files: files
    };
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

  function normalizeResourceDefinition(resource) {
    var src = (resource && typeof resource === 'object') ? resource : {};
    var media = (src.media && typeof src.media === 'object') ? src.media : {};
    var identity = (src.identity && typeof src.identity === 'object') ? src.identity : {};
    var origin = (src.origin && typeof src.origin === 'object') ? src.origin : {};
    var rights = (src.rights && typeof src.rights === 'object') ? src.rights : {};
    var viewer = normalizeViewer(src.viewer);
    var storage = normalizeStorage(src.storage);
    var snapshotSources = (src.snapshotSources && typeof src.snapshotSources === 'object')
      ? util.clone(src.snapshotSources)
      : {};
    var ownerUserId = String(src.owner || rights.owner || src.user_id || src.userId || '').trim();
    var previewUri = snapshotSources.previewUri || storageFileUrl(storage, 'preview', ownerUserId);
    var thumbnailUri = snapshotSources.thumbnailUri || viewer.thumbnailUri || storageFileUrl(storage, 'thumbnail', ownerUserId);
    var originalUri = snapshotSources.originalUri || storageFileUrl(storage, 'original', ownerUserId);
    if (previewUri) {
      snapshotSources.previewUri = previewUri;
      if (!identity.uri) {
        identity.uri = previewUri;
      }
      if (!viewer.embed.uri) {
        viewer.embed.uri = previewUri;
      }
    }
    if (thumbnailUri) {
      snapshotSources.thumbnailUri = thumbnailUri;
      viewer.thumbnailUri = viewer.thumbnailUri || thumbnailUri;
      if (!viewer.embed.thumbnailUri) {
        viewer.embed.thumbnailUri = thumbnailUri;
      }
    }
    if (originalUri) {
      snapshotSources.originalUri = originalUri;
      if (!identity.canonicalUri) {
        identity.canonicalUri = originalUri;
      }
    }
    return {
      id: src.id || util.createUuid(),
      type: 'Resource',
      origin: {
        type: origin.type || src.originType || (src.kind === 'webpage' || src.kind === 'video' ? 'publicReference' : 'userRegistered'),
        subtype: origin.subtype || src.originSubtype || '',
        provider: origin.provider || src.provider || ''
      },
      identity: {
        title: String(identity.title || src.title || src.name || ''),
        canonicalUri: String(identity.canonicalUri || src.canonicalUri || src.uri || ''),
        uri: String(identity.uri || src.uri || '')
      },
      media: {
        kind: String(media.kind || src.kind || 'general'),
        mimeType: String(media.mimeType || src.mimeType || src.format || 'text/plain'),
        downloadable: media.downloadable === true || src.downloadable === true,
        duration: (typeof media.duration !== 'undefined') ? media.duration : (src.duration || null),
        pageCount: Number.isFinite(Number(media.pageCount || src.pageCount))
          ? Number(media.pageCount || src.pageCount)
          : undefined
      },
      contents: (src.contents && typeof src.contents === 'object') ? util.clone(src.contents) : undefined,
      viewer: viewer,
      storage: storage,
      snapshotSources: snapshotSources,
      rights: {
        owner: String(rights.owner || src.owner || ''),
        copyright: String(rights.copyright || src.copyright || ''),
        license: String(rights.license || ''),
        attribution: String(rights.attribution || '')
      },
      audit: normalizeAudit(src.audit, state.currentUser)
    };
  }

  function isVideoResourceLike(resource, uri) {
    var src = resource || {};
    var kind = String(src.kind || '').toLowerCase();
    var subtype = String(src.subtype || (src.media && src.media.subtype) || '').toLowerCase();
    var mimeType = String(src.mimeType || (src.media && src.media.mimeType) || '').toLowerCase();
    var text = String(uri || src.canonicalUri || src.uri || src.url || '').toLowerCase();
    return kind === 'video' ||
      subtype === 'youtube' ||
      subtype === 'vimeo' ||
      /^video\//i.test(mimeType) ||
      /(^|\/\/)(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(text) ||
      /\.(mp4|m4v|webm|ogv|ogg)(\?|#|$)/i.test(text);
  }

  function normalizeUrlVideoResource(resource, node, uri) {
    var src = resource || {};
    var sourceUri = String(uri || src.canonicalUri || src.uri || src.url || '').trim();
    var clone = util.clone(src);
    var tempNode = {
      label: node && node.label,
      thumbnailUri: node && node.thumbnailUri,
      timeRange: node && node.timeRange,
      resource: clone
    };
    if (wuwei.video && typeof wuwei.video.setVideoSource === 'function') {
      return wuwei.video.setVideoSource(tempNode, sourceUri);
    }
    clone.kind = 'video';
    clone.uri = sourceUri;
    clone.canonicalUri = sourceUri;
    clone.mimeType = clone.mimeType || 'text/html';
    clone.title = String(clone.title || (node && node.label) || sourceUri || 'Video');
    clone.media = clone.media && typeof clone.media === 'object' ? clone.media : {};
    clone.media.kind = 'video';
    clone.media.mimeType = clone.mimeType;
    clone.viewer = normalizeViewer(clone.viewer);
    clone.viewer.embed = clone.viewer.embed && typeof clone.viewer.embed === 'object' ? clone.viewer.embed : {};
    clone.viewer.embed.enabled = !!sourceUri;
    clone.viewer.embed.uri = sourceUri;
    delete clone.storage;
    delete clone.snapshotSources;
    delete clone.identity;
    return clone;
  }

  function normalizeResource(resource, node) {
    var src = resource || {};
    var viewer = (src.viewer && typeof src.viewer === 'object') ? src.viewer : {};
    var embed = (viewer.embed && typeof viewer.embed === 'object') ? viewer.embed : {};
    var snapshotSources = (src.snapshotSources && typeof src.snapshotSources === 'object') ? src.snapshotSources : {};
    var uri = String(src.canonicalUri || src.uri || embed.uri || src.url || snapshotSources.previewUri || snapshotSources.originalUri || '');
    var uploadId, uploadDate, uploadBase, uploadPreview, uploadThumbnail;
    var currentUserId = String((state.currentUser && state.currentUser.user_id) || '');
    if (src.kind === 'upload' && src.id && src.date) {
      uploadId = String(src.id || '');
      uploadDate = String(src.date || '').replace(/\\/g, '/').replace(/^\/|\/$/g, '');
      uploadBase = uploadDate + '/' + uploadId + '/';
      var uploadOriginalFile = String(src.file || src.filename || src.name || '').replace(/\\/g, '/').split('/').pop();
      var uploadStorage = normalizeStorage(src.storage);
      if (src.storage && src.storage.manifest) {
        uploadStorage.manifest = util.clone(src.storage.manifest);
      }
      if (!uploadStorage.files.length) {
        uploadStorage = {
          managed: true,
          copyPolicy: 'reference',
          manifest: { area: 'upload', path: uploadBase + 'manifest.json' },
          files: [
            uploadOriginalFile ? { role: 'original', area: 'upload', path: uploadBase + uploadOriginalFile, mimeType: /\.pdf$/i.test(uploadOriginalFile) ? 'application/pdf' : 'application/octet-stream' } : null,
            { role: 'thumbnail', area: 'upload', path: uploadBase + 'thumbnail.jpg', mimeType: 'image/jpeg' }
          ].filter(Boolean)
        };
      }
      var uploadOwnerId = String(src.owner || (src.rights && src.rights.owner) || (src.audit && src.audit.owner) || currentUserId);
      uploadPreview = storageFileUrl(uploadStorage, 'preview', uploadOwnerId);
      uploadThumbnail = storageFileUrl(uploadStorage, 'thumbnail', uploadOwnerId) ||
        util.toPublicResourceUri('upload', uploadBase + 'thumbnail.jpg', uploadOwnerId);
      var uploadOriginal = storageFileUrl(uploadStorage, 'original', uploadOwnerId);
      if (!uploadOriginal && uploadOriginalFile) {
        uploadOriginal = util.toPublicResourceUri('upload', uploadBase + uploadOriginalFile, uploadOwnerId);
      }
      var uploadMedia = src.media && typeof src.media === 'object' ? util.clone(src.media) : {};
      var uploadContents = src.contents && typeof src.contents === 'object' ? util.clone(src.contents) : null;
      var uploadMimeType = String(uploadMedia.mimeType || src.mimeType || '');
      if (!uploadMimeType && /\.pdf$/i.test(uploadOriginalFile)) {
        uploadMimeType = 'application/pdf';
      }
      if (!uploadMedia.kind && /^application\/pdf/i.test(uploadMimeType)) {
        uploadMedia.kind = 'document';
      }
      if (!uploadMedia.mimeType) {
        uploadMedia.mimeType = uploadMimeType;
      }
      if (!uploadMedia.downloadable && /^application\/pdf/i.test(uploadMimeType)) {
        uploadMedia.downloadable = true;
      }
      var uploadViewerUri = uploadPreview || uploadOriginal;
      return {
        id: uploadId,
        kind: 'upload',
        uri: uploadViewerUri,
        canonicalUri: uploadOriginal,
        mimeType: uploadMimeType,
        title: String(src.title || (node && node.label) || ''),
        file: uploadOriginalFile,
        owner: uploadOwnerId,
        media: uploadMedia,
        contents: uploadContents || undefined,
        copyright: String(src.copyright || ''),
        license: String((src.rights && src.rights.license) || src.license || ''),
        attribution: String((src.rights && src.rights.attribution) || src.attribution || ''),
        rights: {
          owner: String((src.rights && src.rights.owner) || src.owner || uploadOwnerId),
          copyright: String((src.rights && src.rights.copyright) || src.copyright || ''),
          license: String((src.rights && src.rights.license) || src.license || ''),
          attribution: String((src.rights && src.rights.attribution) || src.attribution || '')
        },
        audit: normalizeAudit(src.audit, state.currentUser),
        viewer: {
          supportedModes: ['infoPane', 'newTab', 'newWindow', 'download'],
          defaultMode: 'infoPane',
          embed: { enabled: true, uri: uploadViewerUri, thumbnailUri: uploadThumbnail },
          thumbnailUri: uploadThumbnail
        },
        storage: uploadStorage,
        snapshotSources: {
          previewUri: uploadPreview || undefined,
          originalUri: uploadOriginal || undefined,
          thumbnailUri: uploadThumbnail || undefined
        },
        thumbnailUri: uploadThumbnail
      };
    }
    if (isVideoResourceLike(src, uri)) {
      return normalizeUrlVideoResource(src, node, uri);
    }
    if (src.type === 'Resource' || (src.storage && typeof src.storage === 'object')) {
      return runtimeResourceFromDefinition(src, node);
    }
    return {
      id: String(src.id || ''),
      kind: src.kind || (src.mimeType && /^image\//i.test(src.mimeType) ? 'image' : (src.mimeType && /^video\//i.test(src.mimeType) ? 'video' : ((util.isOfficeDocument && util.isOfficeDocument(src.uri || '')) ? 'office' : 'general'))),
      uri: uri,
      canonicalUri: String(src.canonicalUri || uri || ''),
      mimeType: String(src.mimeType || src.format || ''),
      title: String(src.title || (node && node.label) || (node && node.name) || ''),
      owner: String(src.owner || ''),
      copyright: String(src.copyright || ''),
      license: String((src.rights && src.rights.license) || src.license || ''),
      attribution: String((src.rights && src.rights.attribution) || src.attribution || ''),
      rights: {
        owner: String((src.rights && src.rights.owner) || src.owner || ''),
        copyright: String((src.rights && src.rights.copyright) || src.copyright || ''),
        license: String((src.rights && src.rights.license) || src.license || ''),
        attribution: String((src.rights && src.rights.attribution) || src.attribution || '')
      },
      viewer: normalizeViewer(src.viewer),
      storage: src.storage && typeof src.storage === 'object' ? util.clone(src.storage) : {},
      snapshotSources: util.clone(snapshotSources)
    };
  }

  function runtimeResourceFromDefinition(definition, node) {
    var src = normalizeResourceDefinition(definition || {});
    var viewer = (src.viewer && typeof src.viewer === 'object') ? src.viewer : {};
    var embed = (viewer.embed && typeof viewer.embed === 'object') ? viewer.embed : {};
    var uri = src.identity.uri || embed.uri || src.snapshotSources.previewUri || src.identity.canonicalUri || src.snapshotSources.originalUri || '';
    var thumbnail = src.snapshotSources.thumbnailUri || viewer.thumbnailUri || embed.thumbnailUri || '';
    return {
      id: src.id,
      kind: src.media.kind || resourceKindFromMime(src.media.mimeType, uri),
      uri: String(uri || ''),
      canonicalUri: String(src.identity.canonicalUri || uri || ''),
      mimeType: String(src.media.mimeType || ''),
      title: String(src.identity.title || (node && node.label) || ''),
      owner: String(src.rights.owner || ''),
      media: util.clone(src.media || {}),
      contents: src.contents && typeof src.contents === 'object' ? util.clone(src.contents) : undefined,
      pageCount: src.contents && Number.isFinite(Number(src.contents.pageCount))
        ? Number(src.contents.pageCount)
        : (src.media && Number.isFinite(Number(src.media.pageCount)) ? Number(src.media.pageCount) : undefined),
      copyright: String(src.rights.copyright || ''),
      license: String(src.rights.license || ''),
      attribution: String(src.rights.attribution || ''),
      rights: {
        owner: String(src.rights.owner || ''),
        copyright: String(src.rights.copyright || ''),
        license: String(src.rights.license || ''),
        attribution: String(src.rights.attribution || '')
      },
      viewer: normalizeViewer(src.viewer),
      storage: util.clone(src.storage || {}),
      snapshotSources: util.clone(src.snapshotSources || {}),
      thumbnailUri: thumbnail
    };
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

  function normalizeNode(node, resourceById) {
    var src = node || {};
    var oldView = src.view || {};
    var shape = src.shape || oldView.shape || (src.type === 'Memo' ? 'MEMO' : 'RECTANGLE');
    var size = src.size || oldView.size || {};
    var out = {
      id: src.id || util.createUuid(),
      type: src.type || 'Topic',
      x: Number.isFinite(Number(src.x)) ? Number(src.x) : (Number.isFinite(Number(oldView.x)) ? Number(oldView.x) : 0),
      y: Number.isFinite(Number(src.y)) ? Number(src.y) : (Number.isFinite(Number(oldView.y)) ? Number(oldView.y) : 0),
      shape: shape,
      size: util.clone(size || {}),
      visible: normalizeVisibleFlag(src.visible, src.hidden, oldView.hidden),
      label: String(src.label || src.name || ''),
      description: src.description && typeof src.description === 'object'
        ? util.clone(src.description)
        : { format: 'asciidoc', body: String(src.description || src.value || '') },
      style: util.clone(src.style || {}),
      audit: normalizeAudit(src.audit, state.currentUser)
    };

    if (src.type === 'Content') {
      if (src.resourceRef && resourceById && resourceById[src.resourceRef]) {
        out.resourceRef = src.resourceRef;
        out.resource = runtimeResourceFromDefinition(resourceById[src.resourceRef], src);
        if (out.resource.thumbnailUri) {
          out.thumbnailUri = out.resource.thumbnailUri;
        }
      }
      else {
        out.resource = normalizeResource(src.resource || { uri: src.uri || src.url || '', mimeType: src.format || '' }, src);
        if (src.resourceRef) {
          out.resourceRef = src.resourceRef;
        }
      }
      if (shape === 'THUMBNAIL' || src.thumbnailUri || oldView.thumbnailUri || src.thumbnail) {
        out.thumbnailUri = String(out.thumbnailUri || src.thumbnailUri || oldView.thumbnailUri || src.thumbnail || '');
      }
      if (!out.thumbnailUri && out.resource && out.resource.thumbnailUri) {
        out.thumbnailUri = out.resource.thumbnailUri;
      }
    }

    if (src.type === 'Memo') {//} && (src.memoShape || oldView.memoShape)) {
      out.style = (out.style && typeof out.style === 'object') ? out.style : {};
      out.style.memo = (out.style.memo && typeof out.style.memo === 'object')
        ? util.clone(out.style.memo)
        : {};

      if (src.memoShape && typeof src.memoShape === 'object') {
        if (!out.style.memo.corner && src.memoShape.corner) {
          out.style.memo.corner = src.memoShape.corner;
        }
        if (!Number.isFinite(Number(out.style.memo.foldSize)) &&
          Number.isFinite(Number(src.memoShape.foldSize))) {
          out.style.memo.foldSize = Number(src.memoShape.foldSize);
        }
      }
      else if (oldView.memoShape && typeof oldView.memoShape === 'object') {
        if (!out.style.memo.corner && oldView.memoShape.corner) {
          out.style.memo.corner = oldView.memoShape.corner;
        }
        if (!Number.isFinite(Number(out.style.memo.foldSize)) &&
          Number.isFinite(Number(oldView.memoShape.foldSize))) {
          out.style.memo.foldSize = Number(oldView.memoShape.foldSize);
        }
      }

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
      out.time = util.clone(src.time || {
        start: Number.isFinite(Number(src.timeStart)) ? Number(src.timeStart) : (Number.isFinite(Number(src.time)) ? Number(src.time) : 0),
        end: Number.isFinite(Number(src.timeEnd)) ? Number(src.timeEnd) : (Number.isFinite(Number(src.time)) ? Number(src.time) : 0)
      });
      ['mediaStart', 'mediaEnd', 'playDuration'].forEach(function (key) {
        if (Number.isFinite(Number(src[key]))) {
          out[key] = Number(src[key]);
        }
      });
    }

    if (src.type === 'PageMarker' || src.topicKind === 'contents-page') {
      out.type = 'PageMarker';
      if (typeof src.contentsRef === 'string' && src.contentsRef) {
        out.contentsRef = src.contentsRef;
      }
      if (typeof src.documentRef === 'string' && src.documentRef) {
        out.documentRef = src.documentRef;
      }
      if (Number.isFinite(Number(src.pageNumber))) {
        out.pageNumber = Number(src.pageNumber);
      }
    }

    if (typeof src.groupRef === 'string' && src.groupRef) {
      out.groupRef = src.groupRef;
    }
    if (typeof src.axisRole === 'string' && src.axisRole) {
      out.axisRole = src.axisRole;
    }
    if (typeof src.topicKind === 'string' && src.topicKind) {
      out.topicKind = src.topicKind;
    }

    return model.NodeFactory(out);
  }

  function normalizeLink(link) {
    var src = link || {};
    var oldView = src.view || {};
    var out = {
      id: src.id || util.createUuid(),
      type: 'Link',
      from: (typeof src.from === 'object') ? src.from.id : (src.from || ((typeof src.source === 'object') ? src.source.id : src.source) || ''),
      to: (typeof src.to === 'object') ? src.to.id : (src.to || ((typeof src.target === 'object') ? src.target.id : src.target) || ''),
      x: Number.isFinite(Number(src.x)) ? Number(src.x) : (Number.isFinite(Number(oldView.x)) ? Number(oldView.x) : 0),
      y: Number.isFinite(Number(src.y)) ? Number(src.y) : (Number.isFinite(Number(oldView.y)) ? Number(oldView.y) : 0),
      shape: src.shape || oldView.shape || 'NORMAL',
      visible: normalizeVisibleFlag(src.visible, src.hidden, oldView.hidden),
      relation: src.relation || src.rtype || '',
      label: String(src.label || ''),
      description: src.description && typeof src.description === 'object'
        ? util.clone(src.description)
        : { format: 'plain', body: String(src.description || '') },
      style: util.clone(src.style || {}),
      routing: util.clone(src.routing || {}),
      audit: normalizeAudit(src.audit, state.currentUser)
    };

    if (src.path && !out.routing.path) {
      out.routing.path = src.path;
    }
    if (Number.isFinite(Number(src.x2))) {
      out.x2 = Number(src.x2);
    }
    if (Number.isFinite(Number(src.y2))) {
      out.y2 = Number(src.y2);
    }

    return model.LinkFactory(out);
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
    else if (rawType === 'contentsGroup') {
      type = 'contents';
    }

    var baseSpinePadding = Number.isFinite(Number(spine.padding)) ? Number(spine.padding) : (type === 'simple' ? 16 : 12);

    function spinePaddingSide(key) {
      return Number.isFinite(Number(spine[key])) ? Number(spine[key]) : baseSpinePadding;
    }

    if (type === 'contents' && !members.length && entries.length) {
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

    return {
      id: src.id || util.createUuid(),
      type: type,
      name: src.name || '',
      description: src.description && typeof src.description === 'object'
        ? util.clone(src.description)
        : { format: 'plain', body: String(src.description || '') },
      visible: (typeof src.visible === 'boolean') ? src.visible : (src.enabled !== false),
      moveTogether: (false !== src.moveTogether),
      orientation: src.orientation || 'auto',
      spine: {
        kind: spine.kind || (type === 'simple' ? 'DASHED' : 'SOLID'),
        color: spine.color || '#888888',
        width: Number(spine.width || (type === 'simple' ? 2 : 6)),
        padding: baseSpinePadding,
        paddingTop: spinePaddingSide('paddingTop'),
        paddingRight: spinePaddingSide('paddingRight'),
        paddingBottom: spinePaddingSide('paddingBottom'),
        paddingLeft: spinePaddingSide('paddingLeft')
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
      entries: (type === 'contents') ? entries.map(function (entry) {
        return {
          role: entry && entry.role || 'entry',
          nodeId: entry && (entry.nodeId || entry.id) || '',
          pageNumber: Math.max(1, Math.floor(Number(entry && entry.pageNumber || 1))),
          comment: String(entry && entry.comment || '')
        };
      }).filter(function (entry) {
        return !!entry.nodeId;
      }) : undefined,
      axis: src.axis ? util.clone(src.axis) : undefined,
      origin: src.origin ? util.clone(src.origin) : undefined,
      length: Number.isFinite(Number(src.length)) ? Number(src.length) : undefined,
      groupType: src.groupType || '',
      mediaRef: src.mediaRef || '',
      documentRef: src.documentRef || '',
      pageCount: Number.isFinite(pageCount) ? pageCount : undefined,
      timeStart: Number.isFinite(Number(src.timeStart)) ? Number(src.timeStart) : undefined,
      timeEnd: Number.isFinite(Number(src.timeEnd)) ? Number(src.timeEnd) : undefined,
      defaultPlayDuration: Number.isFinite(Number(src.defaultPlayDuration)) ? Number(src.defaultPlayDuration) : undefined,
      audit: normalizeAudit(src.audit, state.currentUser)
    };
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
      transform: normalizeTransform(src.transform || src.translate),
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
    else if (srcPages && typeof srcPages === 'object') {
      Object.keys(srcPages).sort(function (a, b) {
        var na = Number(a);
        var nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) { return na - nb; }
        return String(a).localeCompare(String(b));
      }).forEach(function (k, index) {
        pages.push(normalizePage(srcPages[k], Number(k) || index + 1, resourceById));
      });
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

  function pagesAsArray(note) {
    var src = note || common.current || {};
    if (Array.isArray(src.pages)) {
      refreshPageNumbers(src.pages);
      return src.pages;
    }
    src.pages = normalizePagesCollection(src.pages, {});
    if (!src.pages.length) {
      src.pages.push(createPage(1));
    }
    refreshPageNumbers(src.pages);
    return src.pages;
  }

  function findPageByRef(note, pageRef) {
    var pages = pagesAsArray(note);
    var ref = (typeof pageRef === 'undefined' || pageRef === null) ? (note && note.currentPage) : pageRef;
    var page = null;
    if (typeof ref === 'string' && ref.charAt(0) === '_') {
      page = pages.find(function (item) { return item && item.id === ref; }) || null;
    }
    if (!page && Number.isFinite(Number(ref))) {
      page = pages[Number(ref) - 1] || pages.find(function (item) { return Number(item && item.pp) === Number(ref); }) || null;
    }
    return page || pages[0] || null;
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
      transform: normalizeTransform(page.transform || page.translate),
      thumbnail: (typeof page.thumbnail === 'undefined') ? defaultThumbnail : page.thumbnail,
      audit: normalizeAudit(page.audit || current.audit, state.currentUser)
    };
  }

  function normalizeNote(note) {
    var src = note || {};
    var resources = cloneArray(src.resources).map(normalizeResourceDefinition);
    var resourceById = {};
    var pages, currentPage;

    resources.forEach(function (resource) {
      if (resource && resource.id) {
        resourceById[resource.id] = resource;
      }
    });

    pages = normalizePagesCollection(src.pages, resourceById);
    if (!pages.length && src.page) {
      pages = [normalizePage(src.page, 1, resourceById)];
    }
    if (!pages.length) {
      pages = [createPage(1)];
    }
    currentPage = findPageByRef({ pages: pages, currentPage: src.currentPage }, src.currentPage) || pages[0];
    return NoteFactory({
      note_id: src.note_id || util.createUuid(),
      note_name: decodeMaybe(src.note_name || ''),
      description: decodeMaybe((src.description || '').replace(/\\n/g, '\n')),
      currentPage: currentPage.id,
      pages: pages,
      resources: resources,
      thumbnail: (typeof src.thumbnail === 'undefined') ? '' : src.thumbnail,
      audit: normalizeAudit(src.audit || { createdBy: src.owner_id || src.ownerId || (state.currentUser && state.currentUser.user_id) || common.TEMP_OWNER_ID }, state.currentUser)
    });
  }

  function resourceKindFromMime(mimeType, uri) {
    mimeType = String(mimeType || '').toLowerCase();
    uri = String(uri || '').toLowerCase();
    if (/^image\//.test(mimeType)) { return 'image'; }
    if (/^video\//.test(mimeType)) { return 'video'; }
    if (/^audio\//.test(mimeType)) { return 'audio'; }
    if (/pdf|word|excel|powerpoint|officedocument|text\//.test(mimeType)) { return 'document'; }
    if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|adoc|md)$/.test(uri)) { return 'document'; }
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(uri)) { return 'image'; }
    if (/\.(mp4|webm|ogg|mov|m4v)$/.test(uri)) { return 'video'; }
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
    var src = node.resource || {};
    var uri = String(src.uri || node.uri || '');
    var mimeType = String(src.mimeType || src.format || node.format || 'text/plain');
    var kind = String(src.kind || resourceKindFromMime(mimeType, uri));
    var isManaged = !/^https?:\/\//i.test(uri) && !!uri;
    var snapshotSources = src.snapshotSources || {};
    if (src.canonicalUri && !snapshotSources.originalUri) {
      snapshotSources.originalUri = src.canonicalUri;
    }
    if (uri && !snapshotSources.previewUri) {
      snapshotSources.previewUri = uri;
    }
    if (node.thumbnailUri && !snapshotSources.thumbnailUri) {
      snapshotSources.thumbnailUri = node.thumbnailUri;
    }
    return normalizeResourceDefinition({
      id: node.resourceRef || util.createUuid(),
      origin: {
        type: /^https?:\/\//i.test(uri) ? 'publicReference' : 'userRegistered',
        subtype: kind === 'video' ? 'videoPage' : (kind === 'document' ? 'uploadedDocument' : ''),
        provider: ''
      },
      identity: {
        title: src.title || node.label || '',
        uri: uri,
        canonicalUri: src.canonicalUri || uri
      },
      media: {
        kind: kind,
        mimeType: mimeType,
        downloadable: isManaged
      },
      viewer: src.viewer || {},
      snapshotSources: snapshotSources,
      storage: normalizeStorage(src.storage || {
        managed: isManaged,
        copyPolicy: isManaged ? 'snapshot' : 'metadataOnly',
        files: []
      }),
      rights: {
        owner: src.owner || '',
        copyright: src.copyright || '',
        license: (src.rights && src.rights.license) || src.license || '',
        attribution: (src.rights && src.rights.attribution) || src.attribution || ''
      },
      audit: src.audit || node.audit
    });
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
      kind: 'upload',
      id: id,
      date: date,
      file: originalFile || String(resource.file || resource.filename || '').replace(/\\/g, '/').split('/').pop()
    };
  }

  function compactResourceForSave(node) {
    var src = node.resource || {};
    var uploadRef = uploadRefFromResource(src);
    var uri;
    if (uploadRef) {
      var originalFile = null;
      if (src.storage && Array.isArray(src.storage.files)) {
        originalFile = src.storage.files.find(function (file) {
          return file && String(file.role || '').toLowerCase() === 'original';
        });
      }
      uploadRef.title = String(src.title || node.label || '');
      uploadRef.mimeType = String(
        (src.media && src.media.mimeType) ||
        (originalFile && originalFile.mimeType && originalFile.mimeType !== 'application/octet-stream' ? originalFile.mimeType : '') ||
        src.mimeType ||
        (/\.pdf$/i.test(String(uploadRef.file || '')) ? 'application/pdf' : '') ||
        node.format ||
        ''
      );
      if (src.owner) { uploadRef.owner = src.owner; }
      if (src.media && typeof src.media === 'object') {
        uploadRef.media = util.clone(src.media);
      }
      if (src.contents && typeof src.contents === 'object') {
        uploadRef.contents = util.clone(src.contents);
      }
      if (src.rights && typeof src.rights === 'object') {
        uploadRef.rights = util.clone(src.rights);
      }
      if (src.audit && typeof src.audit === 'object') {
        uploadRef.audit = util.clone(src.audit);
      }
      if (src.storage && typeof src.storage === 'object') {
        uploadRef.storage = util.clone(src.storage);
        if (Array.isArray(uploadRef.storage.files)) {
          uploadRef.storage.files = uploadRef.storage.files.filter(function (file) {
            return file && file.path && !(/\/preview\.pdf$/i.test(String(file.path || '')) &&
              String(uploadRef.mimeType || '').toLowerCase().indexOf('application/pdf') === 0);
          }).map(function (file) {
            var copy = util.clone(file);
            if (copy.role === 'original' && (!copy.mimeType || copy.mimeType === 'application/octet-stream') && uploadRef.mimeType) {
              copy.mimeType = uploadRef.mimeType;
            }
            return copy;
          });
        }
      }
      uploadRef.viewer = {
        supportedModes: ['infoPane', 'newTab', 'newWindow', 'download'],
        defaultMode: 'infoPane'
      };
      return uploadRef;
    }
    uri = String(src.uri || src.canonicalUri || node.uri || node.url || '').trim();
    if (isVideoResourceLike(src, uri)) {
      return normalizeUrlVideoResource(src, node, uri);
    }
    if (/^https?:\/\//i.test(uri)) {
      return {
        kind: String(src.kind || 'web'),
        uri: uri,
        canonicalUri: String(src.canonicalUri || uri)
      };
    }
    if (uri) {
      return {
        kind: String(src.kind || resourceKindFromMime(src.mimeType || node.format || '', uri)),
        uri: uri,
        title: String(src.title || node.label || ''),
        mimeType: String(src.mimeType || node.format || '')
      };
    }
    return null;
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
    return out;
  }

  function stripRuntimeNodeForSave(node, resources) {
    var out = stripRuntimeNode(node);
    var compactResource;
    if (out.topicKind === 'contents-page' || out.type === 'PageMarker') {
      out.type = 'PageMarker';
      out.topicKind = 'contents-page';
      if (Number.isFinite(Number(out.pageNumber))) {
        out.pageNumber = Math.max(1, Math.floor(Number(out.pageNumber)));
      }
      else {
        out.pageNumber = 1;
      }
    }
    if (out.type === 'Content') {
      compactResource = compactResourceForSave(out);
      if (compactResource) {
        out.resource = compactResource;
      }
      else {
        delete out.resource;
      }
      if (!out.resourceView) {
        out.resourceView = { mode: 'default' };
      }
      if (node.thumbnailUri && !(out.resource && out.resource.kind === 'upload')) {
        out.thumbnailUri = String(node.thumbnailUri);
      }
      else {
        delete out.thumbnailUri;
      }
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

  function buildContentsEntriesForSave(group, page) {
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
      if (!node || node.topicKind !== 'contents-page') {
        return null;
      }
      return {
        role: 'entry',
        nodeId: node.id,
        pageNumber: Number.isFinite(Number(node.pageNumber)) ? Math.max(1, Math.floor(Number(node.pageNumber))) : 1,
        comment: node.description && typeof node.description.body === 'string' ? node.description.body : ''
      };
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
    if (out.type === 'contents') {
      delete out.contents;
      out.entries = buildContentsEntriesForSave(out, page);
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
      this.pages = Array.isArray(param.pages) ? param.pages : normalizePagesCollection(param.pages, {});
      if (!this.pages.length) {
        this.pages.push(createPage(1));
      }
      refreshPageNumbers(this.pages);
      this.currentPage = (findPageByRef(this, param.currentPage) || this.pages[0]).id;
      this.page = findPageByRef(this, this.currentPage);
      this.resources = cloneArray(param.resources).map(normalizeResourceDefinition);
      this.thumbnail = (typeof param.thumbnail === 'undefined') ? '' : param.thumbnail;
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
      : normalizePagesCollection(param.pages, {});
    if (!pages.length) {
      pages.push(PageFactory(param.page || createPage(1)));
    }
    refreshPageNumbers(pages);
    param.pages = pages;
    param.currentPage = (findPageByRef({ pages: pages, currentPage: param.currentPage }, param.currentPage) || pages[0]).id;
    return new Note(param);
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

    const noteName = document.querySelector('#note_name .name');
    const noteDesc = document.querySelector('#note_name .description');
    if (noteName) { noteName.textContent = ''; }
    if (noteDesc) { noteDesc.textContent = ''; }
    updatePageName(current.page);

    return current;
  }

  /**
   * 判定：旧形式(note.resources / associations)なら true
   */
  function isLegacyNoteJson(note) {
    if (!note || typeof note !== 'object') return false;
    // if (note.page) return true;
    if (note.resources && !Array.isArray(note.resources)) return true;
    if (note.associations) return true;

    // pages はあるが node に idx が残っている「中間形式」も旧扱いにする
    if (note.pages && typeof note.pages === 'object') {
      for (const k of Object.keys(note.pages)) {
        const p = note.pages[k];
        if (p && Array.isArray(p.nodes)) {
          for (const n of p.nodes) {
            if (n && typeof n === 'object' && 'idx' in n) return true;
          }
        }
        if (p && Array.isArray(p.links)) {
          for (const l of p.links) {
            if (l && typeof l === 'object' && 'idx' in l) return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 旧形式 -> 新形式へ変換（resources/associations を nodes/links に織り込む）
   */
  function migrateNoteJson(note) {
    if (!isLegacyNoteJson(note)) return note;

    const resources = note.resources || {};
    const associations = note.associations || {};

    // 旧: note.page だけのケース、旧: note.pages もあり得るケース両対応
    const srcPages = {};
    if (note.page) {
      const pp = (note.page.pp != null) ? note.page.pp : 1;
      srcPages[String(pp)] = note.page;
    } else if (note.pages && typeof note.pages === 'object') {
      Object.assign(srcPages, note.pages);
    } else {
      srcPages["1"] = { pp: 1, name: "", description: "", nodes: [], links: [], translate: { x: 0, y: 0, scale: 1 } };
    }

    const newPages = {};
    const pageKeys = Object.keys(srcPages);

    for (const pid of pageKeys) {
      const page = srcPages[pid] || {};
      const nodes = Array.isArray(page.nodes) ? page.nodes : [];
      const links = Array.isArray(page.links) ? page.links : [];

      // resourceId -> nodeId 対応表（association の body_ref/target_ref から node を引くため）
      const resIdToNodeId = {};

      // ---- nodes: idx(=resource id) を消して、resource情報を node に寄せる
      const newNodes = nodes.map((n) => {
        const nn = Object.assign({}, n);
        const resId = nn.idx;
        if (resId) resIdToNodeId[resId] = nn.id;

        const r = resId ? resources[resId] : null;

        // 旧 idx は廃止
        delete nn.idx;

        // option の正規化（旧は "undefined" が入りがち）
        const optFromRes = (r && typeof r.option === 'string' && r.option !== 'undefined') ? r.option : '';

        // 型から option を推定（app2 の addSimpleTopic/addMemoNode/addUploadedNode に合わせる）
        if (!nn.option || nn.option === 'undefined') {
          if (optFromRes) nn.option = optFromRes;
          else if (nn.type === 'Topic') nn.option = 'topic';
          else if (nn.type === 'Memo') nn.option = 'memo';
          else if (nn.type === 'Uploaded' || nn.type === 'Content') nn.option = 'upload';
        }

        // name/format/uri/thumbnail/value を resource から補完
        if (!nn.name && r && r.name) nn.name = r.name;
        if (!nn.format && r && r.format) nn.format = r.format;
        if (!nn.uri && r && r.uri) nn.uri = r.uri;
        if (!nn.thumbnail && r && r.thumbnail) nn.thumbnail = r.thumbnail;

        // value：Topic/Memo は文字列が基本。旧 resource に value が無いことも多いので空文字に。
        if (typeof nn.value === 'undefined') {
          if (r && typeof r.value !== 'undefined') nn.value = r.value;
          else nn.value = '';
        }

        return nn;
      });

      // ---- links: idx(=association id) を消して、source/target を nodeId にする
      const newLinks = links.map((l) => {
        const ll = Object.assign({}, l);
        const assocId = ll.idx;
        const a = assocId ? associations[assocId] : null;

        // 旧 idx は廃止
        delete ll.idx;

        let sourceId = null;
        let targetId = null;

        // association があれば body_ref/target_ref(=resource id) -> nodeId に変換
        if (a) {
          sourceId = resIdToNodeId[a.body_ref] || null;
          targetId = resIdToNodeId[a.target_ref] || null;
        }

        // フォールバック（link.source/target が object の場合にも対応）
        if (!sourceId && ll.source) sourceId = (typeof ll.source === 'object') ? ll.source.id : ll.source;
        if (!targetId && ll.target) targetId = (typeof ll.target === 'object') ? ll.target.id : ll.target;

        ll.source = sourceId;
        ll.target = targetId;

        return ll;
      }).filter((ll) => ll && ll.source && ll.target);

      // page を組み立て
      const pp = (page.pp != null) ? page.pp : Number(pid) || 1;
      newPages[String(pp)] = Object.assign({}, page, {
        pp,
        nodes: newNodes,
        links: newLinks,
        translate: page.translate || { x: 0, y: 0, scale: 1 },
        thumbnail: (typeof page.thumbnail === 'undefined') ? null : page.thumbnail
      });
    }

    // note を組み立て（旧フィールドは削除）
    const migrated = Object.assign({}, note, { pages: newPages });

    // 旧: note.page を持つ場合、currentPage が無ければ pp を採用（ページが 1 個しかないケース対策）
    if (typeof migrated.currentPage === 'undefined' || migrated.currentPage === null) {
      if (note.page && note.page.pp != null) migrated.currentPage = note.page.pp;
      else migrated.currentPage = 1;
    }

    delete migrated.page;
    delete migrated.resources;
    delete migrated.associations;

    return migrated;
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
    const note_json = migrateNoteJson(note_);
    current = normalizeNote(note_json);
    common.current = current;
    const page = setGraphFromCurrentPage(current.currentPage);
    updateCanvasTransform(util.getPageTransform(page));
    return current;
  }

  function persistNote(form, actionName) {
    ensureEditableNoteId();

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
      note_id: current.note_id,
      note_name: current.note_name,
      description: current.description,
      thumbnail: currentPageThumbnail || '',
      currentPage: (findPageByRef(current, current.currentPage) || current.page || {}).id || current.currentPage,
      resources: [],
      pages: [],
      audit: normalizeAudit(current.audit, state.currentUser)
    };

    pagesAsArray(current).forEach(function (page, index) {
      if (!page) { return; }
      noteToSave.pages.push(serializePageForSave(page, index, noteToSave.resources, currentPageThumbnail));
    });

    current.resources = noteToSave.resources;
    current.thumbnail = noteToSave.thumbnail;
    const noteJson = JSON.stringify(noteToSave).trim();

    // const thumbEl = document.querySelector('div.thumbnail');
    // const iconHTML = thumbEl
    //   ? thumbEl.innerHTML.trim().replace(/(\r\n\t|\n|\r\t)/gm, "").replace(/\s\s+/g, " ")
    //   : '';
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

    const currentPageThumbnail = snapshotCurrentPageThumbnail();
    const noteToExport = {
      note_id: current.note_id,
      note_name: current.note_name || '',
      description: current.description || '',
      thumbnail: currentPageThumbnail || '',
      currentPage: (findPageByRef(current, current.currentPage) || current.page || {}).id || current.currentPage,
      resources: cloneArray(current.resources).map(normalizeResourceDefinition),
      pages: [],
      audit: normalizeAudit(current.audit, state.currentUser)
    };

    pagesAsArray(current).forEach(function (page, index) {
      if (!page) { return; }
      noteToExport.pages.push(serializePageForSave(page, index, noteToExport.resources, currentPageThumbnail));
    });

    current.resources = noteToExport.resources;
    current.thumbnail = noteToExport.thumbnail;
    return JSON.stringify(noteToExport).trim();
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
    const currentPage = findPageByRef(current, current.currentPage);
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
    ['term', 'year', 'month', 'date', 'start_date', 'end_date'].forEach(function (key) {
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
    ['year', 'month', 'date', 'start_date', 'end_date', 'include_new_note'].forEach(function (key) {
      if (param && param[key]) {
        data[key] = param[key];
      }
    });
    return ajaxRequest(action, data, 'POST', 30000);
  }

  function loadNote(node_id) {
    newNote();
    const cu = state.currentUser || {};
    const action = util.getAction('load-note')
    return ajaxRequest(action, {
      id: node_id,
      user_id: cu.user_id
    }, 'POST', 5000);
  }

  /**
   * 
   * @param {*} note_id 
   */
  function removeNote(note_id) {
    const cu = state.currentUser || {};
    const action = util.getAction('remove-note')
    return ajaxRequest(action, {
      id: note_id,
      user_id: cu.user_id
    }, 'POST', 5000);
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

    graph.nodes = page.nodes;
    graph.links = page.links;
    graph.groups = page.groups || [];
    graph.transform = normalizeTransform(page.transform || page.translate);
    return page;
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
    const t = translate || { x: 0, y: 0, scale: 1 };
    if (typeof d3 !== 'undefined' && d3.select) {
      d3.select(`#${state.canvasId}`)
        .attr('transform', `translate(${t.x},${t.y}) scale(${t.scale})`);
      graph.transform = normalizeTransform(t);
      if (current && current.page) { current.page.transform = normalizeTransform(t); }
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

  function captureCurrentMiniatureThumbnail() {
    var svg, clone, serialized;

    if (util && typeof util.drawMiniature === 'function') {
      util.drawMiniature();
    }

    svg = document.querySelector('#miniature svg.miniSvg') || document.querySelector('#miniature svg');
    if (!svg) {
      return '';
    }

    clone = svg.cloneNode(true);
    clone.setAttribute('class', 'miniSvg');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '200');
    clone.setAttribute('height', '200');
    if (!clone.getAttribute('viewBox')) {
      clone.setAttribute('viewBox', '0 0 200 200');
    }

    serialized = new XMLSerializer().serializeToString(clone);
    return serialized;
  }

  function updatePageThumbnail(page) {
    var targetPage = page;
    var isCurrentPage, thumbnail;

    current = common.current;
    if (!targetPage) {
      if (wuwei.model && typeof wuwei.model.syncPageFromGraph === 'function') {
        wuwei.model.syncPageFromGraph();
      }
      targetPage = current && current.page;
    }
    if (!targetPage) {
      return '';
    }

    isCurrentPage = current && current.page && (
      current.page === targetPage ||
      current.currentPage === targetPage.id
    );

    thumbnail = isCurrentPage ? captureCurrentMiniatureThumbnail() : '';
    targetPage.thumbnail = thumbnail || buildPageThumbnail(targetPage);
    return targetPage.thumbnail;
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

  function copyPage(sourcePP) {
    current = common.current;
    const pages = pagesAsArray(current);
    const nodeIndexer = {};
    const linkIndexer = {};
    let _id, id, sourcePage, copiedPage;

    snapshotCurrentPageThumbnail();
    if (wuwei.model && typeof wuwei.model.syncPageFromGraph === 'function') {
      wuwei.model.syncPageFromGraph();
    }

    sourcePage = (sourcePP != null) ? findPageByRef(current, sourcePP) : (current.page || wuwei.model.getCurrentPage());
    copiedPage = PageFactory(Object.assign(util.clone(sourcePage), { id: util.createUuid(), pp: pages.length + 1 }));
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
      node.id = nodeIndexer[_id];
    }
    for (let link of copiedPage.links) {
      _id = link.id;
      const srcId = (link.from && typeof link.from === 'object') ? link.from.id
        : (link.from || ((link.source && typeof link.source === 'object') ? link.source.id : link.source));
      const tgtId = (link.to && typeof link.to === 'object') ? link.to.id
        : (link.to || ((link.target && typeof link.target === 'object') ? link.target.id : link.target));
      link.id = linkIndexer[_id];
      link.from = nodeIndexer[srcId] || srcId;
      link.to = nodeIndexer[tgtId] || tgtId;
      delete link.source;
      delete link.target;
    }
    for (let group of (copiedPage.groups || [])) {
      if (Array.isArray(group.members)) {
        group.members = group.members.map(function (it) {
          const next = util.clone(it);
          next.nodeId = nodeIndexer[it.nodeId] || it.nodeId;
          return next;
        });
      }
      if (Array.isArray(group.item)) {
        group.item = group.item.map(function (it) {
          const next = util.clone(it);
          next.nodeId = nodeIndexer[it.nodeId] || it.nodeId;
          return next;
        });
      }
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
    if (wuwei.model && typeof wuwei.model.syncPageFromGraph === 'function') {
      wuwei.model.syncPageFromGraph();
    }

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

  function removePage(pp) {
    current = common.current;
    const pages = pagesAsArray(current);
    const targetPage = findPageByRef(current, pp);
    const targetIndex = pages.indexOf(targetPage);
    const deletingCurrent =
      !!targetPage && (current.currentPage === targetPage.id || current.page === targetPage);

    if (targetIndex < 0) {
      return current.page || wuwei.model.getCurrentPage();
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
  function openPage(pp) {
    current = common.current;
    const page = findPageByRef(current, pp);
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
    if (span_pp) {
      span_pp.textContent = (pagesAsArray(current).length > 1) ? `P.${page.pp}` : '';
    }
    if (span_name) {
      span_name.textContent = page.name || '';
    }
    if (span_description) {
      span_description.textContent = page.description || '';
    }
    wuwei.menu.registerPagebuttonEvent();
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
    /** Page */
    Page: Page,
    PageFactory: PageFactory,
    createPage: createPage,
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
// wuwei.note.js revised 2026-04-16
