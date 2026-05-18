/**
 * wuwei.note.v1.js
 * App ver1 note migration module.
 *
 * This module is the only browser-side place that understands app ver1 note
 * JSON.  It loads a ver1 note through load-note-v1 and converts it to the
 * current ver2/adoc note model before handing it to wuwei.note.updateNote().
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.note = wuwei.note || {};
wuwei.note.v1 = (function () {
  'use strict';

  var common = wuwei.common;
  var state = common.state;
  var util = wuwei.util;
  var DRAFT_NOTE_ID = 'new_note';

  function nowIsoString() {
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  function clone(value) {
    return util && typeof util.clone === 'function'
      ? util.clone(value)
      : JSON.parse(JSON.stringify(value || null));
  }

  function createUuid() {
    if (util && typeof util.createUuid === 'function') {
      return util.createUuid();
    }
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'v1-' + Math.random().toString(36).slice(2) + '-' + Date.now();
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

  function cleanResponseText(text) {
    return String(text == null ? '' : text)
      .replace(/^\uFEFF/, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/\u0006/g, ' ')
      .trim();
  }

  function normalizeTransformFromV1(page) {
    var t = (page && (page.transform || page.translate)) || {};
    return {
      x: Number.isFinite(Number(t.x)) ? Number(t.x) : 0,
      y: Number.isFinite(Number(t.y)) ? Number(t.y) : 0,
      scale: Number.isFinite(Number(t.scale)) ? Number(t.scale) : 1
    };
  }

  function auditFromV1(src) {
    var currentUser = state.currentUser || {};
    return {
      owner: (src && src.ownerName) || currentUser.name || currentUser.login || 'guest',
      createdBy: (src && (src.owner || src.owner_id || src.ownerId)) || currentUser.user_id || common.TEMP_OWNER_ID,
      createdAt: (src && src.created) || nowIsoString(),
      lastModifiedBy: (src && (src.lastModifiedBy || src.modifiedBy)) || '',
      lastModifiedAt: (src && (src.lastModifiedAt || src.modifiedAt)) || ''
    };
  }

  function styleFromV1Node(node) {
    var style = (node && node.style && 'object' === typeof node.style) ? clone(node.style) : {};
    if (node && node.color && !style.fill) {
      style.fill = node.color;
    }
    if (node && node.outline) {
      style.line = style.line && 'object' === typeof style.line ? style.line : {};
      if (!style.line.color) {
        style.line.color = node.outline;
      }
    }
    if (node && node.font && 'object' === typeof node.font) {
      style.font = Object.assign({}, node.font, style.font || {});
    }
    return style;
  }

  function styleFromV1Link(link) {
    var style = (link && link.style && 'object' === typeof link.style) ? clone(link.style) : {};
    if (!style.line || 'object' !== typeof style.line) {
      style.line = {};
    }
    if (link) {
      if ('string' === typeof link.style && link.style) {
        style.line.kind = link.style;
      }
      if (link.color && !style.line.color) {
        style.line.color = link.color;
      }
      if (Number.isFinite(Number(link.size)) && !Number.isFinite(Number(style.line.width))) {
        style.line.width = Number(link.size);
      }
      if (link.font && 'object' === typeof link.font) {
        style.font = Object.assign({}, link.font, style.font || {});
      }
    }
    if (!Object.keys(style.line).length) {
      delete style.line;
    }
    return style;
  }

  function cleanLegacyString(value) {
    if (value == null || value === 'undefined' || value === 'null') {
      return '';
    }
    return String(value);
  }

  function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
  }

  function isLocalStorageLikeUri(value) {
    var text = String(value || '').replace(/\\/g, '/').trim();
    return !!(
      text &&
      !isHttpUrl(text) &&
      /(?:^|\/)(upload|resource|note|thumbnail|content)\//.test(text)
    );
  }

  function storageAreaFromUri(value, fallbackArea) {
    var text = String(value || '').replace(/\\/g, '/').trim();
    var match = text.match(/(?:^|\/)(upload|resource|note|thumbnail|content)\//);
    return match ? match[1] : (fallbackArea || 'upload');
  }

  function rewriteLegacyStoragePath(path) {
    var hasLeadingSlash = false;
    var prefix = '';
    var text = String(path || '').replace(/\\/g, '/').trim();
    var match;

    if (!text) {
      return '';
    }

    hasLeadingSlash = text.charAt(0) === '/';
    text = text.replace(/^\/+/, '');

    if (/^wu_wei2\//.test(text)) {
      prefix = 'wu_wei2/';
      text = text.substring('wu_wei2/'.length);
    }

    if (/^data\//.test(text)) {
      return (hasLeadingSlash ? '/' : '') + prefix + text;
    }

    match = text.match(/^(note|resource|upload|thumbnail|content)\/([^/]+)\/(\d{4})\/(\d{2})(\/.*)?$/);
    if (match) {
      return (hasLeadingSlash ? '/' : '') + prefix + 'data/' + match[2] + '/' + match[1] + '/' + match[3] + '/' + match[4] + (match[5] || '');
    }

    match = text.match(/^([^/]+)\/(note|resource|upload|thumbnail|content)\/(\d{4})\/(\d{2})(\/.*)?$/);
    if (match) {
      return (hasLeadingSlash ? '/' : '') + prefix + 'data/' + text;
    }

    return (hasLeadingSlash ? '/' : '') + prefix + text;
  }

  function rewriteLegacyLocalUri(value) {
    var raw = cleanLegacyString(value).replace(/\\/g, '/').trim();
    var suffix = '';
    var hashIndex;
    var queryIndex;
    var suffixIndex;
    var match;

    if (!raw || /^(data:|blob:|mailto:|tel:)/i.test(raw)) {
      return raw;
    }

    hashIndex = raw.indexOf('#');
    queryIndex = raw.indexOf('?');
    if (hashIndex >= 0 && queryIndex >= 0) {
      suffixIndex = Math.min(hashIndex, queryIndex);
    }
    else {
      suffixIndex = Math.max(hashIndex, queryIndex);
    }
    if (suffixIndex >= 0) {
      suffix = raw.substring(suffixIndex);
      raw = raw.substring(0, suffixIndex);
    }

    match = raw.match(/^(https?:\/\/[^/]+)(\/.*)$/i);
    if (match) {
      if (/\/wu_wei2\/(note|resource|upload|thumbnail|content)\//.test(match[2]) || /\/wu_wei2\/[^/]+\/(note|resource|upload|thumbnail|content)\//.test(match[2]) || /\/wu_wei2\/data\//.test(match[2])) {
        return match[1] + rewriteLegacyStoragePath(match[2]) + suffix;
      }
      return raw + suffix;
    }

    return rewriteLegacyStoragePath(raw) + suffix;
  }

  function stripFileFragment(value) {
    return String(value || '').replace(/#.*$/, '').trim();
  }

  function fileNameFromUri(value) {
    var text = stripFileFragment(value).replace(/\\/g, '/').split('?')[0];
    return text.split('/').pop() || '';
  }

  function extensionFromUri(value) {
    var name = fileNameFromUri(value).toLowerCase();
    var match = name.match(/\.([a-z0-9]{1,12})$/i);
    return match ? ('.' + match[1].toLowerCase()) : '';
  }

  function documentKindFromExt(ext) {
    ext = String(ext || '').toLowerCase();
    if (/^\.(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)$/.test(ext)) { return 'office'; }
    if (ext === '.pdf') { return 'pdf'; }
    if (/^\.(html|htm|xhtml)$/.test(ext)) { return 'html'; }
    if (/^\.(txt|text|md|markdown|csv|tsv|log|adoc|asciidoc|json|xml)$/.test(ext)) { return 'text'; }
    return '';
  }

  function videoKindFromUri(uri) {
    var text = String(uri || '').toLowerCase();
    if (/(^|\/\/)(www\.)?(youtube\.com|youtu\.be)\//.test(text)) { return 'youtube'; }
    if (/(^|\/\/)(www\.)?(vimeo\.com|player\.vimeo\.com)\//.test(text)) { return 'vimeo'; }
    if (/\.(mp4|mov|webm|m4v|mpeg|mpg|ogv|ogg)(?:[?#]|$)/.test(text)) { return 'mp4'; }
    if (/\.(mp3|wav|m4a|aac|oga|flac)(?:[?#]|$)/.test(text)) { return 'mp3'; }
    return '';
  }

  function mediaKindFromUri(uri, mimeType) {
    var text = String(uri || '').toLowerCase();
    var mime = String(mimeType || '').toLowerCase();
    var ext = extensionFromUri(uri);
    if (/^video\//.test(mime) || videoKindFromUri(uri) && !/\.(mp3|wav|m4a|aac|oga|flac)(?:[?#]|$)/.test(text)) {
      return 'video';
    }
    if (/^audio\//.test(mime) || /\.(mp3|wav|m4a|aac|oga|flac)(?:[?#]|$)/.test(text)) {
      return 'audio';
    }
    if (/^image\//.test(mime) || /\.(png|jpe?g|gif|svg|webp|tiff?|ico)(?:[?#]|$)/.test(text)) {
      return 'image';
    }
    if (documentKindFromExt(ext) || /^(application|text)\//.test(mime) || isHttpUrl(uri)) {
      return 'document';
    }
    return 'other';
  }

  function resourceSourceFromUri(uri, node) {
    var option = String(node && node.option || '').toLowerCase();
    if (option === 'upload' || isLocalStorageLikeUri(uri)) { return 'upload'; }
    if (isHttpUrl(uri)) { return 'remote'; }
    return uri ? 'embedded' : 'embedded';
  }

  function isFileThumbnail(value) {
    var text = String(value || '').trim();
    return !!(
      text &&
      !/^fa[srb]?-/.test(text) &&
      !/^fa-/.test(text) &&
      !/^\w[\w-]*$/.test(text)
    );
  }

  function addStorageFile(files, role, uri, mimeType, fallbackArea) {
    var path = stripFileFragment(uri).replace(/\\/g, '/').trim();
    var area;
    if (!path || isHttpUrl(path) && path.indexOf('/wu_wei2/') < 0) {
      return;
    }
    area = storageAreaFromUri(path, fallbackArea || (role === 'original' ? 'upload' : 'resource'));
    files.push({
      role: role,
      area: area,
      path: path,
      mimeType: String(mimeType || '')
    });
  }

  function buildStorageFiles(uri, previewUri, thumbnail, mimeType) {
    var files = [];
    var previewRole;

    addStorageFile(files, 'original', uri, mimeType, storageAreaFromUri(uri, 'upload'));
    if (previewUri && previewUri !== uri) {
      previewRole = /\.pdf(?:[?#].*)?$/i.test(String(previewUri || '')) ? 'pdf-preview' : 'preview';
      addStorageFile(files, previewRole, previewUri, previewRole === 'pdf-preview' ? 'application/pdf' : '',
        storageAreaFromUri(previewUri, 'resource'));
    }
    if (isFileThumbnail(thumbnail)) {
      addStorageFile(files, 'thumbnail', thumbnail, 'image/jpeg', storageAreaFromUri(thumbnail, 'thumbnail'));
    }
    return files;
  }

  function previewUriFromV1(node, originalUri) {
    var value = node && node.value;
    var res = value && typeof value === 'object' ? value.resource : null;
    var preview = String((res && res.uri) || '').trim();
    if (preview && extensionFromUri(preview)) {
      return preview;
    }
    return originalUri;
  }

  function documentKindFromResource(kind, uri, mimeType) {
    var extKind = documentKindFromExt(extensionFromUri(uri));
    var mime = String(mimeType || '').toLowerCase();
    if (kind !== 'document') { return ''; }
    if (extKind) { return extKind; }
    if (/pdf/.test(mime)) { return 'pdf'; }
    if (/word|excel|powerpoint|officedocument|msword|spreadsheet|presentation/.test(mime)) { return 'office'; }
    if (/html/.test(mime) || isHttpUrl(uri)) { return 'html'; }
    if (/^text\//.test(mime)) { return 'text'; }
    return '';
  }

  function resourceFromV1Content(node) {
    var uri = rewriteLegacyLocalUri(node && (node.uri || node.url || node.download_url));
    var mimeType = cleanLegacyString(node && (node.mimeType || node.format || node.contenttype)).trim();
    var thumbnail = rewriteLegacyLocalUri(node && (node.thumbnailUri || node.thumbnail));
    var title = cleanLegacyString(node && (node.label || node.name)).trim() || fileNameFromUri(uri) || uri;
    var previewUri = rewriteLegacyLocalUri(previewUriFromV1(node, uri));
    var kind = mediaKindFromUri(uri || previewUri, mimeType);
    var id = (node && (node.resourceRef || node.content_id)) || createUuid();
    var source = resourceSourceFromUri(uri, node);

    return {
      id: id,
      source: source,
      kind: kind,
      documentKind: documentKindFromResource(kind, uri || previewUri, mimeType),
      videoKind: kind === 'video' ? videoKindFromUri(uri || previewUri) : '',
      canonicalUri: uri,
      uri: previewUri || uri,
      title: title,
      mimeType: mimeType || 'text/plain',
      storage: {
        managed: source === 'upload',
        copyPolicy: source === 'upload' ? 'snapshot' : 'metadataOnly',
        files: buildStorageFiles(uri, previewUri, thumbnail, mimeType)
      },
      thumbnailUri: isFileThumbnail(thumbnail) ? thumbnail : '',
      rights: {
        owner: cleanLegacyString(node && (node.owner || node.owner_id || node.ownerId)),
        copyright: '',
        license: '',
        attribution: ''
      },
      audit: auditFromV1(node || {})
    };
  }

  function descriptionFromV1(value, fallbackFormat) {
    if (value && 'object' === typeof value && (value.body || value.format)) {
      return clone(value);
    }
    if (value && 'object' === typeof value) {
      return {
        format: fallbackFormat || 'asciidoc',
        body: ''
      };
    }
    return {
      format: fallbackFormat || 'asciidoc',
      body: cleanLegacyString(value)
    };
  }

  function migrateNode(node, resources) {
    var src = node || {};
    var type = src.type || 'Topic';
    var out = {
      id: src.id || createUuid(),
      type: type,
      x: Number.isFinite(Number(src.x)) ? Number(src.x) : 0,
      y: Number.isFinite(Number(src.y)) ? Number(src.y) : 0,
      shape: src.shape || (type === 'Memo' ? 'MEMO' : 'RECTANGLE'),
      size: src.size && 'object' === typeof src.size ? clone(src.size) : {},
      visible: (typeof src.visible === 'boolean') ? src.visible : src.hidden !== true,
      label: String(src.label || src.name || ''),
      description: descriptionFromV1(src.description || src.value, type === 'Memo' ? 'asciidoc' : 'asciidoc'),
      style: styleFromV1Node(src),
      audit: auditFromV1(src)
    };

    if (type === 'Content') {
      var resource = resourceFromV1Content(src);
      resources.push(resource);
      out.resourceRef = resource.id;
      out.resource = clone(resource);
      out.thumbnailUri = resource.thumbnailUri || '';
    }

    if (type === 'Memo' && src.memoShape && 'object' === typeof src.memoShape) {
      out.style.memo = Object.assign({}, src.memoShape, out.style.memo || {});
    }

    return out;
  }

  function linkEndpoint(value) {
    if (value && 'object' === typeof value) {
      return value.id || '';
    }
    return String(value || '');
  }

  function migrateLink(link) {
    var src = link || {};
    var routing = src.routing && 'object' === typeof src.routing ? clone(src.routing) : {};
    if (src.path && !routing.path) {
      routing.path = clone(src.path);
    }
    return {
      id: src.id || createUuid(),
      type: 'Link',
      from: linkEndpoint(src.from || src.source),
      to: linkEndpoint(src.to || src.target),
      x: Number.isFinite(Number(src.x)) ? Number(src.x) : 0,
      y: Number.isFinite(Number(src.y)) ? Number(src.y) : 0,
      shape: src.shape || 'NORMAL',
      visible: (typeof src.visible === 'boolean') ? src.visible : src.hidden !== true,
      relation: src.relation || src.rtype || '',
      label: String(src.label || ''),
      description: descriptionFromV1(src.description, 'plain'),
      style: styleFromV1Link(src),
      routing: routing,
      audit: auditFromV1(src)
    };
  }

  function migratePage(page, pp, resources) {
    var src = page || {};
    return {
      id: src.id || createUuid(),
      pp: Number(src.pp || pp || 1) || 1,
      name: String(src.name || ''),
      description: String(src.description || ''),
      nodes: (Array.isArray(src.nodes) ? src.nodes : []).map(function (node) {
        return migrateNode(node, resources);
      }),
      links: (Array.isArray(src.links) ? src.links : []).map(migrateLink).filter(function (link) {
        return link.from && link.to;
      }),
      groups: [],
      transform: normalizeTransformFromV1(src),
      thumbnail: (typeof src.thumbnail === 'undefined') ? null : rewriteLegacyLocalUri(src.thumbnail),
      audit: auditFromV1(src)
    };
  }

  function migratePages(srcPages, resources) {
    var pages = [];
    if (Array.isArray(srcPages)) {
      pages = srcPages.map(function (page, index) {
        return migratePage(page, index + 1, resources);
      });
    }
    else if (srcPages && 'object' === typeof srcPages) {
      Object.keys(srcPages).sort(function (a, b) {
        var na = Number(a);
        var nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) { return na - nb; }
        return String(a).localeCompare(String(b));
      }).forEach(function (key, index) {
        pages.push(migratePage(srcPages[key], Number(key) || index + 1, resources));
      });
    }
    if (!pages.length) {
      pages.push(migratePage({}, 1, resources));
    }
    pages.forEach(function (page, index) {
      page.pp = index + 1;
    });
    return pages;
  }

  function resolveCurrentPageId(pages, currentPage) {
    var ref = currentPage;
    var found;
    if ('string' === typeof ref && ref) {
      found = pages.find(function (page) { return page.id === ref; });
      if (found) {
        return found.id;
      }
    }
    if (Number.isFinite(Number(ref))) {
      found = pages.find(function (page) { return Number(page.pp) === Number(ref); });
      if (found) {
        return found.id;
      }
    }
    return pages[0] && pages[0].id;
  }

  function migrate(note) {
    var src = note || {};
    var resources = [];
    var pages = migratePages(src.pages || (src.page ? { 1: src.page } : null), resources);
    var currentPage = resolveCurrentPageId(pages, src.currentPage);
    return {
      note_id: src.note_id || src.note_uuid || createUuid(),
      note_name: decodeMaybe(src.note_name || src.name || ''),
      description: decodeMaybe(String(src.description || '').replace(/\\n/g, '\n')),
      currentPage: currentPage,
      pages: pages,
      resources: resources,
      thumbnail: rewriteLegacyLocalUri(src.thumbnail || ''),
      audit: auditFromV1(src)
    };
  }

  function noteRequestData(noteRef, noteKey) {
    var data = {};
    var ref = noteRef;

    if ('object' === typeof ref && ref) {
      data.id = String(ref.id || ref.note_id || '');
      data.note_key = String(ref.note_key || ref.key || ref.dir || noteKey || '');
    }
    else {
      data.id = String(ref || '');
      data.note_key = String(noteKey || '');
    }

    if (data.note_key) {
      data.key = data.note_key;
      data.dir = data.note_key;
    }
    return data;
  }

  function loadRawNote(noteRef, noteKey) {
    var currentUser = state.currentUser || {};
    var action = util.getAction('load-note-v1');
    var data = noteRequestData(noteRef, noteKey);
    data.user_id = currentUser.user_id;
    return ajaxRequest(action, data, 'POST', 5000);
  }

  function loadNote(noteRef, noteKey) {
    return loadRawNote(noteRef, noteKey).then(function (responseText) {
      var text = cleanResponseText(responseText);
      if (/^ERROR/.test(text) || /^500 Internal Server Error/.test(text)) {
        throw new Error(text);
      }
      if (/^#!\s*\/bin\/sh/.test(text)) {
        throw new Error('ERROR Cannot execute bin/sh');
      }
      var noteJson = JSON.parse(text);
      var migrated = migrate(noteJson);
      migrated.note_id = DRAFT_NOTE_ID;
      migrated.migratedFrom = {
        format: 'ver1',
        id: noteJson.note_id || noteJson.note_uuid || '',
        note_key: noteRef && 'object' === typeof noteRef ? String(noteRef.note_key || noteRef.key || noteRef.dir || '') : String(noteKey || '')
      };
      return migrated;
    });
  }

  return {
    migrate: migrate,
    loadRawNote: loadRawNote,
    loadNote: loadNote
  };
})();
// wuwei.note.v1.js created 2026-05-18
