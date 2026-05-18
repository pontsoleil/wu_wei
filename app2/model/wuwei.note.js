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
    var rights = (src.rights && typeof src.rights === 'object') ? src.rights : {};
    return {
      id: src.id || util.createUuid(),
      source: String(src.source || ''),
      kind: String(src.kind || 'other'),
      documentKind: String(src.documentKind || ''),
      videoKind: String(src.videoKind || ''),
      canonicalUri: String(src.canonicalUri || src.uri || ''),
      uri: String(src.uri || src.canonicalUri || ''),
      title: String(src.title || ''),
      mimeType: String(src.mimeType || 'text/plain'),
      thumbnailUri: String(src.thumbnailUri || ''),
      viewer: normalizeViewer(src.viewer),
      storage: normalizeStorage(src.storage),
      contents: (src.contents && typeof src.contents === 'object') ? util.clone(src.contents) : undefined,
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
      return wuwei.video.setVideoSource(tempNode, sourceUri);
    }
    clone.kind = 'video';
    clone.uri = sourceUri;
    clone.canonicalUri = sourceUri;
    clone.mimeType = clone.mimeType || 'text/html';
    clone.title = String(clone.title || (node && node.label) || sourceUri || 'Video');
    clone.videoKind = clone.videoKind || '';
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

  function normalizeNode(node, resourceById) {
    var src = node || {};
    var shape = src.shape || (src.type === 'Memo' ? 'MEMO' : 'RECTANGLE');
    var size = src.size || {};
    var out = {
      id: src.id || util.createUuid(),
      type: src.type || 'Topic',
      x: Number.isFinite(Number(src.x)) ? Number(src.x) : 0,
      y: Number.isFinite(Number(src.y)) ? Number(src.y) : 0,
      shape: shape,
      size: util.clone(size || {}),
      visible: (false !== src.visible),
      label: String(src.label || ''),
      description: src.description && typeof src.description === 'object'
        ? util.clone(src.description)
        : { format: 'plain/text', body: '' },
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
        out.resource = normalizeResource(src.resource || {}, src);
        if (src.resourceRef) {
          out.resourceRef = src.resourceRef;
        }
      }

    }

    if (src.type === 'Memo') {//} && (src.memoShape || oldView.memoShape)) {
      out.style = (out.style && typeof out.style === 'object') ? out.style : {};
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
      ['mediaStart', 'mediaEnd', 'playDuration'].forEach(function (key) {
        if (Number.isFinite(Number(src[key]))) {
          out[key] = Number(src[key]);
        }
      });
    }

    if (typeof src.groupRef === 'string' && src.groupRef) {
      out.groupRef = src.groupRef;
    }

    if (src.type === 'PageMarker' || src.topicKind === 'contents-page') {
      out.type = 'PageMarker';
      out.topicKind = 'contents-page';
      out.groupRef = out.groupRef || '';
      if (typeof src.documentRef === 'string' && src.documentRef) {
        out.documentRef = src.documentRef;
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
        out.style = out.style || {};
        out.style.line = out.style.line || {};
        out.style.line.kind = 'DASHED';
      }
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
      audit: normalizeAudit(src.audit, state.currentUser)
    };

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

    var defaultSpine = noteGroupStyleDefaults(type);
    var baseSpinePadding = Number.isFinite(Number(spine.padding)) ? Number(spine.padding) : defaultSpine.padding;

    function spinePaddingSide(key) {
      return Number.isFinite(Number(spine[key])) ? Number(spine[key]) : Number(defaultSpine[key] || baseSpinePadding);
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
      entries: (type === 'contents') ? entries.map(function (entry) {
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
      kind: 'upload',
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
    return out;
  }

  function stripRuntimeNodeForSave(node, resources) {
    var out = stripRuntimeNode(node);
    var compactResource;
    if (out.topicKind === 'contents-page' || out.type === 'PageMarker') {
      out = {
        id: out.id,
        type: 'PageMarker',
        topicKind: 'contents-page',
        groupRef: out.groupRef || '',
        documentRef: out.documentRef || '',
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
        color: out.color,
        outline: out.outline,
        outlineWidth: out.outlineWidth,
        style: out.style,
        font: out.font,
        visible: false !== out.visible,
        audit: out.audit
      };
      if (Number.isFinite(Number(node.axisPos))) {
        out.axisPos = Number(node.axisPos);
      }
      [
        'anchorHref',
        'htmlAnchorHref'
      ].forEach(function (key) {
        if (typeof node[key] === 'string' && node[key]) {
          out[key] = node[key];
        }
      });
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
      this.pages = Array.isArray(param.pages) ? param.pages : [];
      if (!this.pages.length) {
        this.pages.push(createPage(1));
      }
      refreshPageNumbers(this.pages);
      this.page = resolveCurrentPage(this.pages, param.currentPage) || this.pages[0];
      this.currentPage = this.page.id;
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
      : [];
    if (!pages.length) {
      pages.push(PageFactory(param.page || createPage(1)));
    }
    refreshPageNumbers(pages);
    param.pages = pages;
    param.currentPage = (resolveCurrentPage(pages, param.currentPage) || pages[0]).id;
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
      currentPage: (current.page && current.page.id) || current.currentPage,
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
      currentPage: (current.page && current.page.id) || current.currentPage,
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

    graph.nodes = page.nodes;
    graph.links = page.links;
    graph.groups = page.groups || [];
    graph.transform = normalizeTransform(page.transform);
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
    var isCurrentPage, thumbnail, fallback;
    var existingThumbnail;
    var current;

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
    if (wuwei.model && typeof wuwei.model.syncPageFromGraph === 'function') {
      wuwei.model.syncPageFromGraph();
    }

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
// wuwei.note.js last modified 2026-05-11
