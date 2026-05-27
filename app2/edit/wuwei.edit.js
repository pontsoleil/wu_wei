/**
 * wuwei.edit.js
 * edit module
 * 
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.edit = wuwei.edit || {};

(function (ns) {
  let
    common = wuwei.common,
    state = common.state,
    graph = common.graph,
    util = wuwei.util,
    model = wuwei.model,
    log = wuwei.log,
    draw = wuwei.draw,
    menu = wuwei.menu,
    lang = common.nls.LANG,
    stateMap = {
      node: null,
      link: null,
      group: null,
      selecteds: [],
      option: null,
      param: {}
    },
    callback;

  /** select options */
  var
    creativeCommons = common.nls.creativeCommons[lang],
    copyrights = common.nls.copyrights[lang],
    purpose = common.motivations,
    shapes = common.shapes,
    fontSizes = common.fontSizes,
    types = common.resourceTypes;

  var snapshotTaken = false;

  function hasTimelineEditor() {
    return !!(
      wuwei.edit &&
      wuwei.edit.timeline &&
      typeof wuwei.edit.timeline.open === 'function'
    );
  }

  function beginEditSession() {
    if (!snapshotTaken) {
      log.savePrevious();
      snapshotTaken = true;
    }
  }

  function hasEditChanges() {
    var page = getCurrentPage();
    var previousPage = common.previous && common.previous.page;

    if (!page || !previousPage) {
      return false;
    }

    return !util.isEquivalent(
      {
        nodes: previousPage.nodes || [],
        links: previousPage.links || [],
        groups: previousPage.groups || []
      },
      {
        nodes: page.nodes || [],
        links: page.links || [],
        groups: page.groups || []
      }
    );
  }

  function storePendingEditLog(operation) {
    if (!snapshotTaken) {
      return false;
    }

    snapshotTaken = false;
    if (hasEditChanges()) {
      log.storeLog({ operation: operation || 'edit' });
      return true;
    }
    return false;
  }

  function getCurrentPage() {
    var common = wuwei.common;
    return common && common.current ? common.current.page || null : null;
  }

  function isEditableGroup(group) {
    return !!(group && ('simple' === group.type || 'horizontal' === group.type || 'vertical' === group.type));
  }

  function resolveEditableGroup(target) {
    var groupId;
    if (!target || !model || typeof model.findGroupById !== 'function') {
      return null;
    }
    groupId = target.groupRef || target.id || '';
    return isEditableGroup(model.findGroupById(groupId)) ? model.findGroupById(groupId) : null;
  }

  function detectMediaFromUrl(rawUrl) {
    var resourceUri = String(rawUrl || '').trim();
    var lowerResourceUri = resourceUri.toLowerCase();
    var host = '';
    var result = {
      kind: 'webpage',
      subtype: '',
      mimeType: ''
    };

    if (!resourceUri) {
      return result;
    }

    try {
      host = new URL(resourceUri, window.location.href).hostname.toLowerCase();
    }
    catch (e) {
      host = '';
    }

    if (host === 'youtu.be' ||
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com') {
      result.kind = 'video';
      result.subtype = 'youtube';
      result.mimeType = 'text/html';
      return result;
    }

    if (host === 'vimeo.com' ||
      host === 'www.vimeo.com' ||
      host === 'player.vimeo.com') {
      result.kind = 'video';
      result.subtype = 'vimeo';
      result.mimeType = 'text/html';
      return result;
    }

    if (/^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)(\/|$|\?)/.test(lowerResourceUri)) {
      result.kind = 'video';
      result.subtype = 'youtube';
      result.mimeType = 'text/html';
      return result;
    }

    if (/^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)(\/|$|\?)/.test(lowerResourceUri)) {
      result.kind = 'video';
      result.subtype = 'vimeo';
      result.mimeType = 'text/html';
      return result;
    }

    if (/\.pdf(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'document';
      result.subtype = 'pdf';
      result.mimeType = 'application/pdf';
      return result;
    }

    if (/\.docx?(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'document';
      result.subtype = 'word';
      result.mimeType = /\.docx(\?|#|$)/.test(lowerResourceUri)
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/msword';
      return result;
    }

    if (/\.xlsx?(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'document';
      result.subtype = 'excel';
      result.mimeType = /\.xlsx(\?|#|$)/.test(lowerResourceUri)
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.ms-excel';
      return result;
    }

    if (/\.pptx?(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'document';
      result.subtype = 'powerpoint';
      result.mimeType = /\.pptx(\?|#|$)/.test(lowerResourceUri)
        ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'application/vnd.ms-powerpoint';
      return result;
    }

    if (/officeapps\.live\.com/.test(lowerResourceUri) ||
      /sharepoint\.com/.test(lowerResourceUri) ||
      /onedrive\.live\.com/.test(lowerResourceUri)) {
      result.kind = 'document';
      result.subtype = 'office-online';
      result.mimeType = 'text/html';
      return result;
    }

    if (/\.mp4(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'video';
      result.subtype = 'mp4';
      result.mimeType = 'video/mp4';
      return result;
    }
    if (/\.webm(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'video';
      result.subtype = 'webm';
      result.mimeType = 'video/webm';
      return result;
    }
    if (/\.ogg(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'video';
      result.subtype = 'ogg';
      result.mimeType = 'video/ogg';
      return result;
    }
    if (/\.mov(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'video';
      result.subtype = 'mov';
      result.mimeType = 'video/quicktime';
      return result;
    }
    if (/\.m4v(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'video';
      result.subtype = 'm4v';
      result.mimeType = 'video/x-m4v';
      return result;
    }

    if (/\.png(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'image';
      result.subtype = 'png';
      result.mimeType = 'image/png';
      return result;
    }
    if (/\.jpe?g(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'image';
      result.subtype = 'jpeg';
      result.mimeType = 'image/jpeg';
      return result;
    }
    if (/\.gif(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'image';
      result.subtype = 'gif';
      result.mimeType = 'image/gif';
      return result;
    }
    if (/\.webp(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'image';
      result.subtype = 'webp';
      result.mimeType = 'image/webp';
      return result;
    }
    if (/\.svg(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'image';
      result.subtype = 'svg';
      result.mimeType = 'image/svg+xml';
      return result;
    }

    if (/\.mp3(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'audio';
      result.subtype = 'mp3';
      result.mimeType = 'audio/mpeg';
      return result;
    }
    if (/\.wav(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'audio';
      result.subtype = 'wav';
      result.mimeType = 'audio/wav';
      return result;
    }
    if (/\.m4a(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'audio';
      result.subtype = 'm4a';
      result.mimeType = 'audio/mp4';
      return result;
    }
    if (/\.aac(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'audio';
      result.subtype = 'aac';
      result.mimeType = 'audio/aac';
      return result;
    }
    if (/\.flac(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'audio';
      result.subtype = 'flac';
      result.mimeType = 'audio/flac';
      return result;
    }
    if (/\.oga(\?|#|$)/.test(lowerResourceUri)) {
      result.kind = 'audio';
      result.subtype = 'oga';
      result.mimeType = 'audio/ogg';
      return result;
    }

    return result;
  }

  function applyMediaDetectionToNode(node, requestedKind) {
    if (!node) {
      return;
    }

    var detected = detectMediaFromUrl((node.resource && (node.resource.canonicalUri || node.resource.uri)) || '');
    var kind = '';
    node.resource = node.resource || {};

    if (typeof requestedKind === 'string' && requestedKind) {
      kind = requestedKind;
    }
    else {
      kind = detected.kind || '';
    }

    if (kind === 'webpage') {
      node.resource.kind = 'document';
      node.resource.documentKind = 'html';
    }
    else if (kind === 'document') {
      node.resource.kind = 'document';
      if (detected.subtype === 'pdf') {
        node.resource.documentKind = 'pdf';
      }
      else if (detected.subtype === 'word' ||
        detected.subtype === 'excel' ||
        detected.subtype === 'powerpoint' ||
        detected.subtype === 'office-online') {
        node.resource.documentKind = 'office';
      }
      else {
        node.resource.documentKind = 'text';
      }
    }
    else if (kind === 'image' || kind === 'video' || kind === 'audio') {
      node.resource.kind = kind;
      if (kind === 'video' && detected.subtype) {
        node.resource.videoKind = detected.subtype;
      }
      if (kind === 'audio' && detected.subtype) {
        node.resource.audioKind = detected.subtype;
      }
      if (kind === 'image' && detected.subtype) {
        node.resource.imageKind = detected.subtype;
      }
    }

    if (detected.mimeType) {
      node.resource.mimeType = detected.mimeType;
    }
  }

  function normalizeVideoResourceSource(node, url) {
    var resource;
    var sourceUrl;
    var detected;
    if (!node) {
      return;
    }
    resource = node.resource || {};
    sourceUrl = String(url || resource.canonicalUri || resource.uri || '').trim();
    detected = detectMediaFromUrl(sourceUrl);
    if (node.option === 'video' ||
      resource.kind === 'video' ||
      detected.kind === 'video') {
      if (wuwei.video && typeof wuwei.video.setVideoSource === 'function') {
        wuwei.video.setVideoSource(node, sourceUrl);
      }
      else {
        node.resource = resource;
        node.resource.kind = 'video';
        node.resource.uri = sourceUrl;
        node.resource.canonicalUri = sourceUrl;
      }
    }
  }

  function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
  }

  function buildNetworkResourceForCommit(node) {
    var resource, sourceUrl, detected, owner, now, title, kind, mimeType;
    if (!node || node.type !== 'Content') {
      return null;
    }
    resource = (node.resource && 'object' === typeof node.resource) ? node.resource : {};
    if (resource.storage) {
      return null;
    }
    sourceUrl = String(resource.canonicalUri || resource.uri || '').trim();
    if (!isHttpUrl(sourceUrl)) {
      return null;
    }

    detected = detectMediaFromUrl(sourceUrl);
    owner = String((state.currentUser && state.currentUser.user_id) || '');
    now = new Date().toISOString();
    title = String(node.label || resource.title || sourceUrl || 'Web content');
    kind = resource.kind || (detected.kind === 'webpage' ? 'document' : detected.kind) || 'web';
    mimeType = resource.mimeType || detected.mimeType || (detected.kind === 'webpage' ? 'text/html' : 'text/plain');

    resource.id = resource.id || node.id;
    resource.title = resource.title || title;
    resource.kind = (detected.kind === 'document' || detected.kind === 'webpage') ? 'document' : kind;
    if (detected.kind === 'document' || detected.kind === 'webpage') {
      resource.documentKind = detected.kind === 'webpage' ? 'html' :
        (detected.subtype === 'pdf' ? 'pdf' :
          (/^(word|excel|powerpoint|office-online)$/.test(detected.subtype || '') ? 'office' : 'html'));
    }
    if (detected.kind === 'video') {
      resource.videoKind = detected.subtype || resource.videoKind || '';
    }
    if (detected.kind === 'audio') {
      resource.audioKind = detected.subtype || resource.audioKind || '';
    }
    if (detected.kind === 'image') {
      resource.imageKind = detected.subtype || resource.imageKind || '';
    }
    resource.mimeType = mimeType;
    resource.uri = sourceUrl;
    resource.canonicalUri = sourceUrl;
    resource.description = (node.description && 'object' === typeof node.description)
      ? node.description
      : (resource.description && 'object' === typeof resource.description ? resource.description : { format: 'plain/text', body: '' });
    resource.rights = (resource.rights && 'object' === typeof resource.rights) ? resource.rights : {};
    resource.rights.owner = resource.rights.owner || owner;
    resource.rights.copyright = resource.rights.copyright || '';
    resource.rights.license = resource.rights.license || '';
    resource.rights.attribution = resource.rights.attribution || '';
    resource.audit = (resource.audit && 'object' === typeof resource.audit) ? resource.audit : {};
    resource.audit.owner = resource.audit.owner || owner;
    resource.audit.createdBy = resource.audit.createdBy || owner;
    resource.audit.createdAt = resource.audit.createdAt || now;
    resource.audit.lastModifiedBy = owner;
    resource.audit.lastModifiedAt = now;

    node.resource = resource;
    return resource;
  }

  function registerNetworkResourceOnCommit() {
    var resource;
    if (!wuwei.resource || typeof wuwei.resource.update !== 'function') {
      return;
    }
    resource = buildNetworkResourceForCommit(stateMap.node);
    if (!resource) {
      return;
    }
    wuwei.resource.update({ id: resource.id, resource: resource })
      .catch(function (err) {
        console.log('wuwei.edit: failed to register network resource', {
          id: resource.id,
          uri: resource.uri || resource.canonicalUri || '',
          error: err
        });
      });
  }

  function asciiDocToPlainText(asciiDocText) {
    if (!asciiDocText) {
      return '';
    }
    return String(asciiDocText)
      .replace(/\r\n?/g, '\n')
      .replace(/^\[%hardbreaks\]\s*$/gm, '')
      .replace(/^\[source,.*?\]\s*$/gm, '')
      .replace(/^----\s*$/gm, '')
      .replace(/[ \t]\+\s*$/gm, '')   // 行末の " +" を除去、改行は残す
      .replace(/^\+\s*$/gm, '')       // 単独行の + を除去
      .replace(/^=+\s+/gm, '')
      .replace(/^[*.]+\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/\+(.*?)\+/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/\^(.*?)\^/g, '$1')
      .replace(/~(.*?)~/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function asciiDocToHtml(asciiDocText) {
    return wuwei.util.renderAsciiDoc(asciiDocText, {
      showtitle: true
    });
  }

  function ensureObjectPath(record, parts) {
    var target = record;
    var i, key;
    for (i = 0; i < parts.length - 1; i += 1) {
      key = parts[i];
      if (!target[key] || 'object' !== typeof target[key]) {
        target[key] = {};
      }
      target = target[key];
    }
    return target;
  }

  function setPathValue(record, path, value) {
    var parts;
    var target;
    if (!record || !path) {
      return;
    }
    parts = String(path).split('.');
    target = ensureObjectPath(record, parts);
    target[parts[parts.length - 1]] = value;
  }

  function expandNodeRuntimeStyle(node) {
    if (wuwei && wuwei.style &&
        typeof wuwei.style.expandNodeRuntimeStyle === 'function') {
      wuwei.style.expandNodeRuntimeStyle(node);
    }
    else if (wuwei && wuwei.note && wuwei.note.v2 &&
        typeof wuwei.note.v2.expandNodeRuntimeStyle === 'function') {
      wuwei.note.v2.expandNodeRuntimeStyle(node);
    }
  }

  function syncNodeRuntimeMirrors(node, path, value) {
    if (!node) {
      return;
    }
    if ('label' === path) {
      return;
    }
    if ('description.body' === path) {
      node.description = Object.assign(
        {},
        (node.description && 'object' === typeof node.description) ? node.description : {},
        {
          format: (node.description && node.description.format) || 'asciidoc',
          body: String(value || '')
        }
      );
      return;
    }
    if ('description.format' === path) {
      node.description = Object.assign(
        {},
        (node.description && 'object' === typeof node.description) ? node.description : {},
        {
          format: String(value || 'plain/text'),
          body: (node.description && typeof node.description.body === 'string') ? node.description.body : ''
        }
      );
      return;
    }
    if (path === 'style.fill' || path === 'style.line.color' || path === 'style.line.width' ||
        path === 'style.font.color' || path === 'style.font.size' ||
        path === 'style.font.family' || path === 'style.font.align') {
      expandNodeRuntimeStyle(node);
      return;
    }
  }

  function syncLinkRuntimeMirrors(link, path, value) {
    if (!link) {
      return;
    }
    if ('style.line.color' === path) {
      link.color = value;
      return;
    }
    if ('style.line.width' === path) {
      link.size = value;
      return;
    }
    if ('style.line.kind' === path) {
      return;
    }
    if ('style.font.color' === path) {
      link.font = link.font || {};
      link.font.color = value;
      return;
    }
    if ('style.font.size' === path) {
      link.font = link.font || {};
      link.font.size = value;
    }
  }

  function shouldAppendImportedDescription(node, path) {
    return !!(
      wuwei.joint &&
      typeof wuwei.joint.canAppendImportedDescription === 'function' &&
      wuwei.joint.canAppendImportedDescription(node, path, 'node')
    );
  }

  function getSupplementFormatForEdit(fallback) {
    var el = document.getElementById('description_supplementFormat');
    return String((el && el.value) || fallback || 'asciidoc');
  }

  function makeDescriptionEntry(role, value, format) {
    var body = String(value || '');
    return {
      role: role || 'original',
      format: format || 'asciidoc',
      body: body,
      text: body
    };
  }

  function normalizeDescriptionEntries(description) {
    var entries, body, i, item;
    if (Array.isArray(description)) {
      entries = [];
      for (i = 0; i < description.length; i += 1) {
        item = (description[i] && 'object' === typeof description[i]) ? Object.assign({}, description[i]) : {};
        body = (typeof item.body === 'string') ? item.body : String(item.text || '');
        item.role = item.role || (entries.length ? 'supplement' : 'original');
        item.format = item.format || 'asciidoc';
        item.body = body;
        item.text = (typeof item.text === 'string') ? item.text : body;
        entries.push(item);
      }
      return entries;
    }
    if (description && 'object' === typeof description) {
      body = (typeof description.body === 'string') ? description.body : String(description.text || '');
      return [makeDescriptionEntry('original', body, description.format || 'asciidoc')];
    }
    return [makeDescriptionEntry('original', String(description || ''), 'asciidoc')];
  }

  function appendImportedDescription(node, value) {
    var text = String(value || '').trim();
    var uid = getCurrentUserIdForEdit();
    var now = (new Date()).toISOString();
    var format = getSupplementFormatForEdit('asciidoc');
    var entries, i, entry;
    entries = normalizeDescriptionEntries(node.description);
    for (i = entries.length - 1; i >= 0; i -= 1) {
      entry = entries[i];
      if (entry && entry.role === 'supplement' && String(entry.createdBy || '') === uid) {
        if (!text) {
          entries.splice(i, 1);
          node.description = entries;
          return;
        }
        entry.body = text;
        entry.text = text;
        entry.format = format;
        entry.modifiedAt = now;
        node.description = entries;
        return;
      }
    }
    if (!text) {
      return;
    }
    entries.push({
      role: 'supplement',
      format: format,
      body: text,
      text: text,
      createdBy: uid,
      createdAt: now,
      source: 'imported-note'
    });
    node.description = entries;
  }

  function setImportedDescriptionSupplementFormat(node, value) {
    var uid = getCurrentUserIdForEdit();
    var format = String(value || 'asciidoc');
    var entries = normalizeDescriptionEntries(node.description);
    var i, entry;
    for (i = entries.length - 1; i >= 0; i -= 1) {
      entry = entries[i];
      if (entry && entry.role === 'supplement' && String(entry.createdBy || '') === uid) {
        entry.format = format;
        entry.modifiedAt = (new Date()).toISOString();
        node.description = entries;
        return;
      }
    }
    node.description = entries;
  }

  function setNodePath(node, path, value) {
    if (!node || !path) {
      return;
    }
    if ('resource.kind' === path) {
      applyMediaDetectionToNode(node, value || '');
      return;
    }
    if (shouldAppendImportedDescription(node, path) && path === 'description.supplementFormat') {
      setImportedDescriptionSupplementFormat(node, value);
      return;
    }
    if (shouldAppendImportedDescription(node, path)) {
      appendImportedDescription(node, value);
      return;
    }
    setPathValue(node, path, value);
    syncNodeRuntimeMirrors(node, path, value);
  }

  function getCurrentUserIdForEdit() {
    return String(
      (wuwei.common && wuwei.common.state && wuwei.common.state.currentUser && wuwei.common.state.currentUser.user_id) ||
      (wuwei.common && wuwei.common.state && wuwei.common.state.user_id) ||
      ''
    ).trim();
  }

  function guessStorageAreaFromEditedUri(value, fallbackArea) {
    var text = String(value || '').replace(/\\/g, '/').trim();
    var uid = getCurrentUserIdForEdit();
    var match, parsedUrl, queryArea;

    try {
      if (/^https?:\/\//i.test(text) || text.indexOf('?') >= 0) {
        parsedUrl = new URL(text, window.location.href);
        queryArea = parsedUrl.searchParams.get('area');
        if (/^(upload|resource|note|thumbnail|content)$/i.test(String(queryArea || ''))) {
          return String(queryArea).toLowerCase();
        }
        text = parsedUrl.pathname || text;
      }
    }
    catch (e) { /* keep raw value */ }
    text = text.replace(/[?#].*$/, '').replace(/^\/+/, '');
    if (text.indexOf('data/') === 0) {
      text = text.slice('data/'.length);
    }
    if (uid && text.indexOf(uid + '/') === 0) {
      text = text.slice(uid.length + 1);
    }
    match = text.match(/^(upload|resource|note|thumbnail|content)\//);
    if (match) {
      return match[1];
    }
    if (/^\d{4}\/\d{2}\//.test(text)) {
      return 'content';
    }
    return fallbackArea || 'upload';
  }

  function normaliseEditedStoragePath(value, area) {
    var text = String(value || '').replace(/\\/g, '/').trim();
    var uid = getCurrentUserIdForEdit();
    var idx;

    if (!text || /^(?:https?:|data:|blob:|mailto:|tel:)/i.test(text)) {
      return '';
    }
    text = text.replace(/[?#].*$/, '');
    idx = text.indexOf('/wu_wei2/');
    if (idx >= 0) {
      text = text.slice(idx + '/wu_wei2/'.length);
    }
    text = text.replace(/^\/+/, '');
    if (text.indexOf('data/') === 0) {
      text = text.slice('data/'.length);
    }
    if (uid && text.indexOf(uid + '/') === 0) {
      text = text.slice(uid.length + 1);
    }
    if (area && text.indexOf(area + '/') === 0) {
      text = text.slice(area.length + 1);
    }
    return text.replace(/^\/+/, '');
  }

  function updateOriginalStorageFileFromEditedUri(node, value) {
    var resource, storage, files, file, i, area, path;

    if (!node || !node.resource) {
      return;
    }
    resource = node.resource;
    area = guessStorageAreaFromEditedUri(value, 'upload');
    path = normaliseEditedStoragePath(value, area);
    if (!path) {
      return;
    }
    storage = (resource.storage && 'object' === typeof resource.storage) ? resource.storage : {};
    files = Array.isArray(storage.files) ? storage.files : [];
    for (i = 0; i < files.length; i += 1) {
      if (String(files[i] && files[i].role || '').toLowerCase() === 'original') {
        file = files[i];
        break;
      }
    }
    if (!file) {
      file = { role: 'original' };
      files.push(file);
    }
    file.area = area;
    file.path = path;
    if (!file.mimeType && resource.mimeType) {
      file.mimeType = resource.mimeType;
    }
    storage.files = files;
    resource.storage = storage;
  }

  function updateThumbnailStorageFileFromEditedUri(node, value) {
    var resource, storage, files, file, i, area, path;

    if (!node || !node.resource) {
      return;
    }
    resource = node.resource;
    area = guessStorageAreaFromEditedUri(value, 'upload');
    path = normaliseEditedStoragePath(value, area);
    if (!path && wuwei.util && typeof wuwei.util.toStorageRelativePath === 'function') {
      path = wuwei.util.toStorageRelativePath(value, null, area);
    }
    if (!path || /^(?:https?:|data:|blob:)/i.test(path)) {
      return;
    }
    storage = (resource.storage && 'object' === typeof resource.storage) ? resource.storage : {};
    files = Array.isArray(storage.files) ? storage.files : [];
    for (i = 0; i < files.length; i += 1) {
      if (String(files[i] && files[i].role || '').toLowerCase() === 'thumbnail') {
        file = files[i];
        break;
      }
    }
    if (!file) {
      file = { role: 'thumbnail' };
      files.push(file);
    }
    file.area = area;
    file.path = path;
    if (!file.mimeType) {
      file.mimeType = 'image/jpeg';
    }
    storage.files = files;
    resource.storage = storage;
  }

  function normalizeContentFirstPageNumber(node) {
    var contents, first;
    if (!node || node.type !== 'Content' || !node.resource || !node.resource.contents) {
      return;
    }
    contents = node.resource.contents;
    first = Number(contents.firstPageNumber);
    if (!Number.isFinite(first) || first < 1) {
      first = Number(contents.pageOffset);
      first = Number.isFinite(first) && first >= 0 ? first + 1 : 1;
    }
    first = Math.max(1, Math.floor(first));
    contents.firstPageNumber = first;
    contents.pageOffset = first - 1;
  }

  function setLinkPath(link, path, value) {
    if (!link || !path) {
      return;
    }
    if ('routing.startArrow.kind' === path || 'routing.endArrow.kind' === path) {
      link.routing = link.routing || {};
      var key = ('routing.startArrow.kind' === path) ? 'startArrow' : 'endArrow';
      if (!value) {
        delete link.routing[key];
        return;
      }
      link.routing[key] = link.routing[key] || {};
      link.routing[key].kind = value;
      if (!Number.isFinite(Number(link.routing[key].size))) {
        link.routing[key].size = 12;
      }
      return;
    }
    setPathValue(link, path, value);
    syncLinkRuntimeMirrors(link, path, value);
  }

  function updateThumbnailUriRowVisibility(shape) {
    var visible = String(shape || '').toUpperCase() === 'THUMBNAIL';
    document.querySelectorAll('#edit .thumbnail-uri-row').forEach(function (row) {
      row.style.display = visible ? 'block' : 'none';
    });
  }

  function isLoadFileRuntimeUrl(value) {
    return /(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(value || ''));
  }

  function getUrlHash(value) {
    var s = String(value || '');
    var index = s.indexOf('#');
    return index >= 0 ? s.slice(index) : '';
  }

  function extractRawLoadFilePath(value) {
    var s = String(value || '').trim();
    var match;

    if (!s || !isLoadFileRuntimeUrl(s)) {
      return s;
    }

    /*
     * The edit pane should show the user-facing logical path, not the runtime
     * URL and not the percent-encoded query value.
     */
    match = s.match(/[?&]path=([^&#]*)/);
    if (!match) {
      return s;
    }

    try {
      return decodeURIComponent(match[1]) + getUrlHash(s);
    }
    catch (e) {
      return match[1].replace(/%2F/ig, '/') + getUrlHash(s);
    }
  }

  function normalizeEditableResourceUrl(value) {
    return extractRawLoadFilePath(value);
  }

  function isRemoteResource(resource) {
    resource = resource && typeof resource === 'object' ? resource : {};
    return String(resource.source || '').toLowerCase() === 'remote' ||
      !!(resource.original && String(resource.original.type || '').toLowerCase() === 'remote') ||
      (!!resource.uri && /^https?:\/\//i.test(String(resource.uri || '')));
  }

  function ensureRemoteOriginal(resource) {
    resource.original = (resource.original && typeof resource.original === 'object') ? resource.original : {};
    resource.original.type = 'remote';
    if (!Array.isArray(resource.original.identifiers)) {
      resource.original.identifiers = [];
    }
    return resource.original;
  }

  function syncRemoteResourceUrl(node, path, value) {
    var resource;
    var original;
    var text;
    if (!node) {
      return;
    }
    node.resource = (node.resource && typeof node.resource === 'object') ? node.resource : {};
    resource = node.resource;
    value = String(value || '').trim();
    text = value || String(resource.uri || resource.canonicalUri ||
      resource.original && (resource.original.url || resource.original.canonicalUrl) || '');

    /*
     * A URL typed in the content tab defines a remote resource even when the
     * placeholder node had source=embedded/other.  Upload resources remain
     * upload unless the user explicitly supplies an external http(s) URL.
     */
    if (!isRemoteResource(resource) && !/^https?:\/\//i.test(text)) {
      return;
    }

    resource.source = 'remote';
    original = ensureRemoteOriginal(resource);

    if (path === 'resource.original.canonicalUrl' || path === 'resource.canonicalUri') {
      original.canonicalUrl = value;
      resource.canonicalUri = value;
      if (!resource.uri && value) {
        resource.uri = value;
      }
      if (!original.url && value) {
        original.url = value;
      }
      return;
    }

    original.url = value;
    resource.uri = value;
    if (!resource.canonicalUri || path === 'resource.uri' || path === 'resource.original.url') {
      resource.canonicalUri = value;
    }
    if (!original.canonicalUrl || path === 'resource.uri' || path === 'resource.original.url') {
      original.canonicalUrl = value;
    }
  }

  function syncCurrentResourceDefinitionFromNode(node) {
    var current = wuwei.common && wuwei.common.current;
    var resource = node && node.resource;
    var resources;
    var found;

    if (!current || !resource || !resource.id) {
      return;
    }
    resources = Array.isArray(current.resources) ? current.resources : [];
    found = resources.find(function (item) { return item && item.id === resource.id; });
    if (found) {
      Object.assign(found, JSON.parse(JSON.stringify(resource)));
    }
    else if (node.resourceRef && node.resourceRef === resource.id) {
      resources.push(JSON.parse(JSON.stringify(resource)));
      current.resources = resources;
    }
  }

  function updateShapeInputsForNode(node, shape) {
    var radiusInput = document.getElementById('size_radius');
    var widthInput = document.getElementById('size_width');
    var heightInput = document.getElementById('size_height');
    var radiusEl = document.getElementById('radius');
    var widthHeightEl = document.getElementById('width-height');
    var radius, width, height;

    updateThumbnailUriRowVisibility(shape);
    if (!node || !node.size) {
      return;
    }
    if ('CIRCLE' === shape) {
      if (radiusEl) { radiusEl.style.display = 'block'; }
      if (widthHeightEl) { widthHeightEl.style.display = 'none'; }
      radius = Math.round(Math.sqrt((Number(node.size.width || 0) * Number(node.size.height || 0)) / Math.PI));
      node.size.radius = radius;
      delete node.size.width;
      delete node.size.height;
      if (radiusInput) { radiusInput.value = radius; }
      if (widthInput) { widthInput.value = ''; }
      if (heightInput) { heightInput.value = ''; }
      return;
    }

    if (radiusEl && 'block' === radiusEl.style.display) {
      radiusEl.style.display = 'none';
      if (widthHeightEl) { widthHeightEl.style.display = 'block'; }
      height = Math.round(Math.sqrt(Math.PI * Number(node.size.radius || 0) * Number(node.size.radius || 0) / 3));
      width = height * 3;
      delete node.size.radius;
      node.size.width = width;
      node.size.height = height;
      if (radiusInput) { radiusInput.value = ''; }
      if (widthInput) { widthInput.value = width; }
      if (heightInput) { heightInput.value = height; }
    }
  }

  function pathToFieldId(path) {
    if (!path) {
      return '';
    }
    return String(path).replace(/\./g, '_');
  }

  function fieldIdToPath(id, el) {
    var aliases;
    id = String(id || '');
    aliases = {
      label: 'label',
      description_body: 'description.body',
      description_format: 'description.format',
      resource_uri: 'resource.uri',
      resource_kind: 'resource.kind',
      resource_canonicalUri: 'resource.canonicalUri',
      resource_original_url: 'resource.original.url',
      resource_original_canonicalUrl: 'resource.original.canonicalUrl',
      resource_thumbnailUri: 'resource.thumbnailUri',
      thumbnailUri: 'resource.thumbnailUri',
      shape: 'shape',
      style_fill: 'style.fill',
      style_font_color: 'style.font.color',
      style_font_size: 'style.font.size',
      size_radius: 'size.radius',
      size_width: 'size.width',
      size_height: 'size.height',
      text_position: 'text.position',
      text_width: 'text.width',
      text_height: 'text.height',
      style_label_width: 'style.label.width',
      style_label_lines: 'style.label.lines',
      style_label_offset_x: 'style.label.offset.x',
      style_label_offset_y: 'style.label.offset.y',
      group: 'group',
      style_line_kind: 'style.line.kind',
      routing_startArrow_kind: 'routing.startArrow.kind',
      routing_startArrow_size: 'routing.startArrow.size',
      routing_endArrow_kind: 'routing.endArrow.kind',
      routing_endArrow_size: 'routing.endArrow.size',
      style_line_width: 'style.line.width',
      style_line_size: 'style.line.width',
      style_line_color: 'style.line.color',
      relation: 'relation',
      name: 'name',
      visible: 'visible',
      moveTogether: 'moveTogether',
      type: 'type',
      spine_kind: 'spine.kind',
      spine_width: 'spine.width',
      spine_color: 'spine.color',
      spine_padding: 'spine.padding',
      spine_padding_top: 'spine.paddingTop',
      spine_padding_right: 'spine.paddingRight',
      spine_padding_bottom: 'spine.paddingBottom',
      spine_padding_left: 'spine.paddingLeft',
      spine_visible: 'spine.visible',
      pageNumber: 'pageNumber',
      timeRange_start: 'timeRange.start',
      timeRange_end: 'timeRange.end',
      editTimelinePointColor: 'style.fill',
      editTimelinePointOutlineWidth: 'style.line.width',
      editTimelinePointOutlineColor: 'style.line.color',
      editTimelinePointFontColor: 'style.font.color'
    };
    if (aliases[id]) {
      return aliases[id];
    }
    if (id) {
      return id.replace(/_/g, '.');
    }
    if (el && el.name) {
      return String(el.name || '').replace(/_/g, '.');
    }
    return '';
  }

  function normalizeEditFieldPaths(root) {
    var scope = root || document;
    var fields;
    if (!scope || !scope.querySelectorAll) {
      return;
    }
    fields = scope.querySelectorAll('input[id], textarea[id], select[id]');
    fields.forEach(function (el) {
      var path = fieldIdToPath(el.id, el);
      if (!path || /^edit[A-Z]/.test(el.id) || 'editRole' === el.id || 'applyToGroup' === el.id ||
        'applyToTimelineGroup' === el.id || 'applyToViewpointGroup' === el.id) {
        return;
      }
      el.classList.add('edit-value');
      if (!el.name) {
        el.name = path;
      }
      if (el.hasAttribute('data-path')) {
        el.removeAttribute('data-path');
      }
    });
  }

  function getCurrentEditableTarget(el) {
    var group;
    if (stateMap.group || (el && el.closest && el.closest('#edit-group'))) {
      group = stateMap.group || resolveEditableGroup(stateMap.link || stateMap.node);
      if (group) {
        return { kind: 'group', object: group };
      }
    }
    if (stateMap.link) {
      group = resolveEditableGroup(stateMap.link);
      if (group && stateMap.link.type === 'Group') {
        return { kind: 'group', object: group };
      }
      return { kind: 'link', object: stateMap.link };
    }
    if (stateMap.node) {
      return { kind: 'node', object: stateMap.node };
    }
    return null;
  }

  function readEditValue(el) {
    var value;
    if (!el) {
      return null;
    }
    if ('checkbox' === el.type) {
      return !!el.checked;
    }
    value = el.value;
    if ('number' === el.type) {
      if ('' === value || value === null || typeof value === 'undefined') {
        return null;
      }
      value = Number(value);
      return Number.isFinite(value) ? value : null;
    }
    return value;
  }

  function markEditedTarget(kind, object) {
    if (!object) {
      return;
    }
    object.changed = true;
    if ('group' === kind) {
      object.audit = (object.audit && 'object' === typeof object.audit) ? object.audit : {};
      object.audit.lastModifiedBy =
        (wuwei.common.state.currentUser && wuwei.common.state.currentUser.user_id) ||
        wuwei.common.state.user_id ||
        '';
      object.audit.lastModifiedAt = new Date().toISOString();
    }
  }

  function redrawEditedGraph() {
    if ('draw' === graph.mode) {
      draw.refresh();
    }
    else if ('simulation' === graph.mode) {
      draw.restart();
    }
  }

  function setGroupPath(group, path, value) {
    var previousType;
    if (!group || !path) {
      return;
    }
    previousType = group.type || 'simple';
    if ('description.body' === path) {
      group.description = (group.description && 'object' === typeof group.description)
        ? group.description
        : { format: 'plain', body: '' };
      group.description.body = String(value || '');
      return;
    }
    setPathValue(group, path, value);
    if ('type' === path && ['simple', 'horizontal', 'vertical'].indexOf(value) >= 0) {
      group.orientation = ('simple' === value) ? 'auto' : value;
      if ((previousType === 'vertical' && value === 'horizontal') ||
        (previousType === 'horizontal' && value === 'vertical')) {
        if (model && typeof model.reflowGroupMembers === 'function') {
          model.reflowGroupMembers(group, value);
        }
      }
    }
  }

  function applyEditPath(targetInfo, path, value, el) {
    if (!targetInfo || !targetInfo.object || !path) {
      return false;
    }
    if (wuwei.joint && typeof wuwei.joint.canEditPath === 'function' &&
      !wuwei.joint.canEditPath(targetInfo.object, path, targetInfo.kind)) {
      if (typeof wuwei.joint.notifyReadOnly === 'function') {
        wuwei.joint.notifyReadOnly();
      }
      return false;
    }
    if ('node' === targetInfo.kind) {
      applyNodeEditPath(targetInfo.object, path, value, el);
    }
    else if ('link' === targetInfo.kind) {
      setLinkPath(targetInfo.object, path, value || null);
    }
    else if ('group' === targetInfo.kind) {
      setGroupPath(targetInfo.object, path, value);
      if (model && typeof model.setGraphFromCurrentPage === 'function') {
        model.setGraphFromCurrentPage();
      }
    }
    markEditedTarget(targetInfo.kind, targetInfo.object);
    return true;
  }

  function applyNodeEditPath(node, path, value, el) {
    var pageEl, page, detectedMedia, kindEl;
    var isRemoteUrlPath = ['resource.uri', 'resource.canonicalUri', 'resource.original.url', 'resource.original.canonicalUrl'].indexOf(path) >= 0;
    if (!node) {
      return;
    }
    if (isRemoteUrlPath) {
      value = normalizeEditableResourceUrl(value);
      pageEl = document.getElementById('pdfPage');
      page = pageEl ? (pageEl.value || pageEl.innerText || '') : '';
      if (page && (path === 'resource.uri' || path === 'resource.canonicalUri')) {
        value = String(value || '').split('#')[0] + '#page=' + page;
      }
      if (el) {
        el.value = value;
      }
      node.resource = (node.resource && 'object' === typeof node.resource) ? node.resource : {};
      if (path === 'resource.uri' || path === 'resource.canonicalUri') {
        node.resource.uri = String(value || '');
        node.resource.canonicalUri = String(value || '');
        updateOriginalStorageFileFromEditedUri(node, value);
      }
      syncRemoteResourceUrl(node, path, value);
      syncCurrentResourceDefinitionFromNode(node);
    }
    if (state.Selecting && Array.isArray(stateMap.selecteds) &&
      ['shape', 'size.radius', 'size.width', 'size.height', 'style.fill', 'style.line.color',
        'style.line.width', 'style.font.color', 'style.font.size', 'style.font.family',
        'style.font.align', 'style.label.width', 'style.label.lines',
        'style.label.offset.x', 'style.label.offset.y'].indexOf(path) >= 0) {
      stateMap.selecteds.forEach(function (selectedNode) {
        if (wuwei.joint && typeof wuwei.joint.canEditPath === 'function' &&
          !wuwei.joint.canEditPath(selectedNode, path, 'node')) {
          return;
        }
        setNodePath(selectedNode, path, value);
        selectedNode.changed = true;
      });
    }
    else {
      setNodePath(node, path, value);
    }
    if (path === 'resource.contents.firstPageNumber') {
      normalizeContentFirstPageNumber(node);
    }
    if ((isRemoteUrlPath || 'resource.uri' === path || 'resource.canonicalUri' === path) && node.resource) {
      if (wuwei.util && typeof wuwei.util.toStorageRelativePath === 'function' &&
        (String(value || '').match(/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i) ||
          String(value || '').match(/(?:^|\/)upload\//))) {
        value = wuwei.util.toStorageRelativePath(value, null, 'upload');
        if (el) {
          el.value = value;
        }
        setNodePath(node, path, value);
        node.resource.uri = String(value || '');
        node.resource.canonicalUri = String(value || '');
        updateOriginalStorageFileFromEditedUri(node, value);
      }
      detectedMedia = detectMediaFromUrl(value || node.resource.uri || (node.resource.original && node.resource.original.url) || '');
      if (detectedMedia.kind === 'video' || node.option === 'video' || node.resource.kind === 'video') {
        normalizeVideoResourceSource(node, value);
        syncCurrentResourceDefinitionFromNode(node);
      }
      if (!node.resource.kind ||
        detectedMedia.kind === 'document' ||
        detectedMedia.kind === 'video' ||
        detectedMedia.kind === 'webpage' ||
        node.resource.kind === 'web' ||
        node.resource.kind === 'webpage' ||
        node.resource.kind === 'other' ||
        node.resource.kind === 'general') {
        applyMediaDetectionToNode(node, detectedMedia.kind || '');
        kindEl = document.getElementById('resource_kind');
        if (kindEl && detectedMedia.kind) {
          kindEl.value = detectedMedia.kind;
        }
      }
    }
    if ('resource.thumbnailUri' === path) {
      node.resource = (node.resource && 'object' === typeof node.resource) ? node.resource : {};
      value = normalizeEditableResourceUrl(value);
      if (el) {
        el.value = value;
      }
      setNodePath(node, path, value);
      updateThumbnailStorageFileFromEditedUri(node, value);
      node.thumbnailUri = String(value || '');
      node.resource.viewer = (node.resource.viewer && 'object' === typeof node.resource.viewer)
        ? node.resource.viewer
        : { supportedModes: ['infoPane', 'newTab', 'newWindow', 'download'], defaultMode: 'infoPane' };
      node.resource.viewer.thumbnailUri = String(value || '');
      if (node.resource.viewer.embed && 'object' === typeof node.resource.viewer.embed) {
        node.resource.viewer.embed.thumbnailUri = String(value || '');
      }
      if (value && node.type === 'Content' && node.shape !== 'THUMBNAIL') {
        node.shape = 'THUMBNAIL';
      }
    }
    if ('shape' === path) {
      updateShapeInputsForNode(node, value);
    }
    if ('description.body' === path) {
      autoExpand(el);
    }
    if ('label' === path) {
      autoExpand(el);
    }
  }

  function handleEditPaneValueEvent(event) {
    var target, path, value, targetInfo;
    target = event && event.target;
    if (!target || !target.id || !target.closest || !target.closest('#edit')) {
      return;
    }
    if ('applyToGroup' === target.id || 'applyToTimelineGroup' === target.id || 'applyToViewpointGroup' === target.id) {
      if (!stateMap.option || 'object' !== typeof stateMap.option) {
        stateMap.option = {};
      }
      stateMap.option[target.id] = !!target.checked;
      return;
    }
    if ('editRole' === target.id) {
      return;
    }
    if ('pdfPage' === target.id && stateMap.node && stateMap.node.resource && stateMap.node.resource.uri) {
      stateMap.node.resource.uri = stateMap.node.resource.uri.split('#')[0] + '#page=' + target.value;
      stateMap.node.changed = true;
      redrawEditedGraph();
      return;
    }
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
      return;
    }
    path = fieldIdToPath(target.id, target);
    if (!path || /^edit[A-Z]/.test(target.id)) {
      return;
    }
    value = readEditValue(target);
    targetInfo = getCurrentEditableTarget(target);
    if (applyEditPath(targetInfo, path, value, target)) {
      if (stateMap.node && 'Topic' === stateMap.node.type &&
        ['shape', 'size.radius', 'size.width', 'size.height', 'style.fill', 'style.line.color',
          'style.line.width', 'style.font.color', 'style.font.size'].indexOf(path) >= 0) {
        var applyToGroupEl = document.getElementById('applyToGroup');
        if (applyToGroupEl && applyToGroupEl.checked && model && typeof model.applyNodeStyleToGroup === 'function') {
          model.applyNodeStyleToGroup(stateMap.node);
        }
      }
      redrawEditedGraph();
    }
  }

  function handleEditPaneClickEvent(event) {
    var target, value, targetInfo, reverseButton;
    target = event && event.target;
    if (!target || !target.closest || !target.closest('#edit')) {
      return;
    }
    reverseButton = target.closest('#link_reverse');
    if (reverseButton) {
      event.preventDefault();
      event.stopPropagation();
      targetInfo = getCurrentEditableTarget(reverseButton);
      if (targetInfo && 'link' === targetInfo.kind && model && typeof model.reverse === 'function') {
        model.reverse([targetInfo.object]);
        markEditedTarget('link', targetInfo.object);
        redrawEditedGraph();
        if (wuwei.edit.link && typeof wuwei.edit.link.open === 'function') {
          wuwei.edit.link.open({
            link: targetInfo.object,
            option: stateMap.option || {}
          }).then(function () {
            normalizeEditFieldPaths(document.getElementById('editform'));
          });
        }
      }
      return;
    }
    if (!(target.classList && target.classList.contains('font_text-anchor'))) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    value = target.classList.contains('start') ? 'left' :
      (target.classList.contains('end') ? 'right' : 'center');
    document.querySelectorAll('#edit .font_text-anchor.checked').forEach(function (el) {
      el.classList.remove('checked');
    });
    target.classList.add('checked');
    targetInfo = getCurrentEditableTarget(target);
    if (applyEditPath(targetInfo, 'style.font.align', value, target)) {
      redrawEditedGraph();
    }
  }

  function bindEditPaneValueEvents(root) {
    if (!root || root.__wuweiEditValueBound) {
      return;
    }
    root.__wuweiEditValueBound = true;
    root.addEventListener('input', handleEditPaneValueEvent, false);
    root.addEventListener('change', handleEditPaneValueEvent, false);
    root.addEventListener('click', handleEditPaneClickEvent, false);
  }

  function getRenderedNodeCenter(node) {
    var el, transform, matrix, match;
    if (!node || !node.id) {
      return null;
    }
    el = document.getElementById(node.id);
    if (!el || !el.classList || !el.classList.contains('node')) {
      return null;
    }

    try {
      if (el.transform && el.transform.baseVal && el.transform.baseVal.numberOfItems) {
        matrix = el.transform.baseVal.consolidate().matrix;
        if (isFinite(matrix.e) && isFinite(matrix.f)) {
          return { x: matrix.e, y: matrix.f };
        }
      }
    }
    catch (e) {
      // Fall back to parsing the transform attribute below.
    }

    transform = el.getAttribute('transform') || '';
    match = transform.match(/translate\(\s*([-+0-9.eE]+)(?:[\s,]+([-+0-9.eE]+))?\s*\)/);
    if (match) {
      return {
        x: Number(match[1]),
        y: Number(typeof match[2] === 'undefined' ? 0 : match[2])
      };
    }
    return null;
  }

  function syncNodePositionFromRenderedElement(node) {
    var center = getRenderedNodeCenter(node);
    if (!center || !isFinite(center.x) || !isFinite(center.y)) {
      return node;
    }
    node.x = center.x;
    node.y = center.y;
    if (typeof node.fx !== 'undefined' && node.fx !== null) {
      node.fx = center.x;
    }
    if (typeof node.fy !== 'undefined' && node.fy !== null) {
      node.fy = center.y;
    }
    return node;
  }

  function update(event) {
    handleEditPaneValueEvent(event);
  }

  function autoExpand(field) {
    var text;
    var rows;
    var minRows;
    var maxRows;

    if (!field) {
      return;
    }

    text = String(field.value || '');
    minRows = Number(field.getAttribute('data-min-rows') || 1);
    maxRows = Number(field.getAttribute('data-max-rows') || 16);

    rows = text.split(/\r\n|\r|\n/).length;
    rows = Math.max(minRows, rows);
    rows = Math.min(maxRows, rows);

    field.rows = rows;
    field.style.height = null;
  }

  function refreshTemplate(param) {
    return new Promise((resolve, reject) => {
      document.getElementById('info').style.display = 'none';
      // open
      var editPane = document.getElementById('edit');
      editPane.innerHTML = wuwei.edit.markup.template();
      bindEditPaneValueEvents(editPane);
      editPane.style.display = 'block';
      hideEdits();

      if (param.link && isViewpointAxisTarget(param.link)) {
        resolve(wuwei.edit.viewpoint.openAxisProperties(param.link, param.option || {}));
      }
      else if (param.node && isViewpointAxisTarget(param.node)) {
        resolve(wuwei.edit.viewpoint.openAxisProperties(param.node, param.option || {}));
      }
      else if (param.link && isTimelineAxisLink(param.link) && hasTimelineEditor()) {
        resolve(wuwei.edit.timeline.open(param.link, param.option || {}));
      }
      else if (param.node && isTimelinePointNode(param.node) && hasTimelineEditor()) {
        resolve(wuwei.edit.timeline.open(param.node, param.option || {}));
      }
      else if (param.node &&
        wuwei.menu &&
        wuwei.menu.timeline &&
        wuwei.menu.timeline.isAxisGroup(param.node) &&
        hasTimelineEditor()) {
        resolve(wuwei.edit.timeline.open(param.node, param.option || {}));
      }
      else if (param.link && param.link.id) {
        resolve(wuwei.edit.link.open(param));
      }

      else if (param.node && ['Topic', 'Memo'].includes(param.node.type)) {
        resolve(wuwei.edit.generic.open(param));
      }
      else if (param.node && param.node.topicKind === 'viewpoint-page') {
        resolve(wuwei.edit.viewpoint.openPageMarker(param));
      }
      else if (isVideoContentNode(param.node) && wuwei.edit.video && typeof wuwei.edit.video.open === 'function') {
        resolve(wuwei.edit.video.open(param));
      }
      else if (isAudioContentNode(param.node) && wuwei.edit.audio && typeof wuwei.edit.audio.open === 'function') {
        resolve(wuwei.edit.audio.open(param));
      }
      else if (isImageContentNode(param.node) && wuwei.edit.image && typeof wuwei.edit.image.open === 'function') {
        resolve(wuwei.edit.image.open(param));
      }
      else if (isUploadedContentNode(param.node)) {
        resolve(wuwei.edit.uploaded.open(param));
      }
      else {
        resolve(wuwei.edit.generic.open(param));
      }
    });
  }

  function isUploadBackedResource(resource) {
    var storage = resource && resource.storage;
    var files = storage && Array.isArray(storage.files) ? storage.files : [];
    var text, file, i;

    for (i = 0; i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.role || '').toLowerCase() !== 'original') {
        continue;
      }
      if (String(file.area || '').toLowerCase() === 'upload') {
        return true;
      }
      text = String(file.path || file.uri || file.url || '').replace(/\\/g, '/');
      if (/^(?:upload\/|\d{4}\/\d{2}\/\d{2}\/)/.test(text) ||
        /[?&]area=upload(?:&|$)/.test(text)) {
        return true;
      }
    }

    text = String(
      (resource && (
        resource.uri ||
        resource.canonicalUri
      )) || ''
    ).replace(/\\/g, '/');

    return /^(?:upload\/|\d{4}\/\d{2}\/\d{2}\/)/.test(text) ||
      /[?&]area=upload(?:&|$)/.test(text);
  }

  function isUploadedContentNode(node) {
    return !!(
      node &&
      node.type === 'Content' &&
      (
        node.option === 'upload' ||
        isUploadBackedResource(node.resource)
      )
    );
  }


  function isVideoContentNode(node) {
    return !!(
      node &&
      node.type === 'Content' &&
      wuwei.video &&
      typeof wuwei.video.isVideoNode === 'function' &&
      wuwei.video.isVideoNode(node)
    );
  }

  function isAudioContentNode(node) {
    return !!(
      node &&
      node.type === 'Content' &&
      wuwei.audio &&
      typeof wuwei.audio.isAudioNode === 'function' &&
      wuwei.audio.isAudioNode(node)
    );
  }

  function isImageContentNode(node) {
    return !!(
      node &&
      node.type === 'Content' &&
      wuwei.resource &&
      typeof wuwei.resource.isImage === 'function' &&
      wuwei.resource.isImage(node)
    );
  }

  function isTimelinePointNode(node) {
    return !!(
      node &&
      (
        node.type === 'Segment' ||
        (node.type === 'Topic' && node.topicKind === 'timeline-point')
      )
    );
  }

  function isTimelineAxisLink(link) {
    return !!(
      link &&
      link.type === 'Link' &&
      (
        link.groupType === 'timelineAxis' ||
        link.linkType === 'timeline-axis'
      )
    );
  }

  function isViewpointAxisTarget(target) {
    if (!target || !wuwei.edit.viewpoint || typeof wuwei.edit.viewpoint.canOpen !== 'function') {
      return false;
    }
    return wuwei.edit.viewpoint.canOpen(target);
  }

  function closeInfoPaneForEdit() {
    var infoPane = document.getElementById('info');
    if (!infoPane || infoPane.style.display === 'none') {
      return;
    }
    if (wuwei.info && typeof wuwei.info.close === 'function') {
      wuwei.info.close();
      return;
    }
    infoPane.innerHTML = '';
    infoPane.style.display = 'none';
  }

  function showOnlyEditRoot(activeId) {
    if (activeId) {
      closeInfoPaneForEdit();
    }

    var roots = [
      'edit-generic',
      'edit-group',
      'edit-link',
      'edit-uploaded',
      'edit-video',
      'edit-audio',
      'edit-image',
      'edit-viewpoint',
      'edit-timeline'
    ];

    roots.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.style.display = (id === activeId) ? 'block' : 'none';
      }
    });

    if (activeId !== 'edit-viewpoint') {
      if (document.getElementById('edit-viewpoint-axis')) {
        document.getElementById('edit-viewpoint-axis').style.display = 'none';
      }
      if (document.getElementById('edit-viewpoint-page-marker')) {
        document.getElementById('edit-viewpoint-page-marker').style.display = 'none';
      }
    }
    if (activeId !== 'edit-timeline') {
      if (document.getElementById('edit-timeline-axis')) {
        document.getElementById('edit-timeline-axis').style.display = 'none';
      }
      if (document.getElementById('edit-timeline-point')) {
        document.getElementById('edit-timeline-point').style.display = 'none';
      }
    }
  }

  function hideEdits() {
    if (!document.getElementById('edit').innerHTML) { return; }
    showOnlyEditRoot('');
  }

  function hideControls() {
    let menu = document.getElementById('open_controls'),
      elem = document.getElementById('controls');
    // hide
    menu.innerHTML = '<span>&#9650</span>';
    elem.classList.add('hidden');
  }

  function resetForExternalEditor() {
    var editPane = document.getElementById('edit');
    var infoPane = document.getElementById('info');
    var openControls = document.getElementById('open_controls');
    var editingCircle = document.getElementById('Editing');

    stateMap.node = null;
    stateMap.link = null;
    stateMap.group = null;
    stateMap.selecteds = [];
    stateMap.option = {};
    stateMap.param = {};

    if (infoPane && infoPane.style.display !== 'none') {
      closeInfoPaneForEdit();
    }
    if (editPane && wuwei.edit.markup && typeof wuwei.edit.markup.template === 'function') {
      editPane.innerHTML = wuwei.edit.markup.template();
      bindEditPaneValueEvents(editPane);
      editPane.style.display = 'block';
    }
    if (openControls) {
      openControls.style.display = 'none';
    }
    if (editingCircle) {
      editingCircle.style.opacity = '0';
      delete editingCircle.dataset.node_id;
      delete editingCircle.dataset.link_id;
    }
    common.state.Editing = true;
    beginEditSession();
    hideControls();
    hideEdits();
  }

  function open(node, option, cb) {
    if (node && node.id) {
      if (util.isLink(node)) {
        node = model.findLinkById(node.id) || node;
      }
      else {
        node = model.findNodeById(node.id) || node;
      }
    }

    if (wuwei.joint && typeof wuwei.joint.canEditObject === 'function' &&
      !wuwei.joint.canEditObject(node)) {
      if (typeof wuwei.joint.notifyReadOnly === 'function') {
        wuwei.joint.notifyReadOnly(node);
      }
      return false;
    }

    /*
     * Opening another edit target must terminate the currently active pane
     * session.  Otherwise specialised editors keep stale state and close/info
     * buttons can operate on the previous target.
     */
    var currentEditPane = document.getElementById('edit');
    if (currentEditPane && currentEditPane.style.display !== 'none' && common.state.Editing) {
      close();
    }

    closeInfoPaneForEdit();

    /** open */
    var editPane = document.getElementById('edit');
    editPane.innerHTML = wuwei.edit.markup.template();

    bindEditPaneValueEvents(editPane);
    common.state.Editing = true;
    document.getElementById('open_controls').style.display = 'none';
    if (cb) {
      callback = cb;
    }

    hideEdits();
    hideControls();
    beginEditSession();

    let link;
    stateMap.group = null;
    if (state.Selecting) {
      var
        selecteds = document.querySelectorAll('g.selected'),
        i, len = selecteds.length;
      if (len > 0) {
        node = model.findNodeById(selecteds[0].id);
        stateMap.node = node;
        stateMap.selecteds = [];
        for (i = 0; i < len; i++) {
          var
            _node = model.findNodeById(selecteds[i].id);
          stateMap.selecteds.push(_node);
        }
      }
    }

    var canvasEl = document.getElementById(state.canvasId);
    var editingCircle = document.getElementById('Editing');
    var forceNodeEdit = !!(option && (option.forceNode || option.editTarget === 'node' || option.representativeStyle));
    var editableGroup = forceNodeEdit ? null : resolveEditableGroup(node);
    if (editableGroup) {
      stateMap.node = null;
      stateMap.link = null;
      stateMap.group = editableGroup;
      stateMap.option = (option && 'object' === typeof option) ? option : {};
      editPane.style.display = 'block';
      if (wuwei.edit.group && typeof wuwei.edit.group.open === 'function') {
        wuwei.edit.group.open(editableGroup, stateMap.option);
      }
      editPane.dataset.node_id = undefined;
      editPane.dataset.link_id = undefined;
      editPane.dataset.group_id = editableGroup.id;
      return true;
    }

    if (util.isNode(node)) {
      syncNodePositionFromRenderedElement(node);
      stateMap.node = node;
      stateMap.group = null;
      if (!option && !state.Selecting) {
        option = (node && node.option) || null;
      }
      // editing circle
      if (!state.Selecting && model.findNodeById(stateMap.node.id)) {
        editingCircle.dataset.node_id = stateMap.node.id;
        editingCircle.setAttribute('cx', '' + stateMap.node.x);
        editingCircle.setAttribute('cy', '' + stateMap.node.y);
        editingCircle.style.opacity = '1';
        canvasEl.appendChild(editingCircle);
      }
    }
    else if (util.isLink(node)) {
      stateMap.link = node;
      stateMap.group = null;
      // editing circle
      editingCircle.dataset.link_id = stateMap.link.id;
      editingCircle.setAttribute('cx', '' + stateMap.link.x);
      editingCircle.setAttribute('cy', '' + stateMap.link.y);
      editingCircle.style.opacity = '1';
      canvasEl.appendChild(editingCircle);
    }

    if (isViewpointAxisTarget(node)) {
      editPane.style.display = 'block';
      return wuwei.edit.viewpoint.openAxisProperties(node, option || {});
    }

    if (isTimelinePointNode(node)) {
      editPane.style.display = 'block';
      return wuwei.edit.timeline.open(node, option || {});
    }

    if (isTimelineAxisLink(node)) {
      editPane.style.display = 'block';
      return wuwei.edit.timeline.open(node, option || {});
    }

    if (wuwei.edit.timeline.canOpen(node)) {
      editPane.style.display = 'block';
      return wuwei.edit.timeline.open(node, option || {});
    }

    stateMap.option = (option && 'object' === typeof option) ? option : {};

    let wuweiDiv = document.getElementById('wuwei');

    if ('none' !== wuweiDiv.style.display) {
      if (!state.Selecting) {
        d3.select('#Editing').raise();
      }
    }

    if (state.Selecting || util.isNode(node)) {
      if (!state.Selecting && !node) {
        stateMap.node = model.findNodeById(node.id);
      }
      else {
        stateMap.node = node;
      }

      syncNodePositionFromRenderedElement(stateMap.node);
      stateMap.link = null;
      stateMap.link = null;


      if (!option) {
        option = {};
      }
      if (stateMap.node) {
        const page = getCurrentPage();
        stateMap.node.groupNames = model.findGroupsByNodeId(stateMap.node.id).map(function (g) { return g.name || g.id; });
      }

      param = {
        node: stateMap.node,
        option: stateMap.option || {}
      };
      stateMap.param = param

      refreshTemplate(param)
        .then(() => {
          normalizeEditFieldPaths(document.getElementById('editform'));
          if (!state.Selecting) {
            var labelEl = document.getElementById('label');
            if (labelEl) {
              labelEl.addEventListener('input', function (event) {
                autoExpand(event.target);
              }, false);
            }

            var descriptionBodyEl = document.getElementById('description_body');
            if (!param.option.editor && descriptionBodyEl) {
              descriptionBodyEl.addEventListener('input', function (event) {
                autoExpand(event.target);
              }, false);
            }

            var resourceUriEl = document.getElementById('resource_uri');
            var resourceKindSelect = document.getElementById('resource_kind');
            if (resourceUriEl && resourceKindSelect) {
              resourceUriEl.addEventListener('change', function () {
                var detected = detectMediaFromUrl(resourceUriEl.value || '');
                if (!resourceKindSelect.value ||
                  detected.kind === 'video' ||
                  resourceKindSelect.value === 'webpage') {
                  resourceKindSelect.value = detected.kind || 'webpage';
                  resourceKindSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }, false);
            }

            let editPane = document.getElementById('edit');
            editPane.dataset.node_id = node.id;
            editPane.dataset.link_id = undefined;
          }
          // Shape size
          if ('CIRCLE' === node.shape) {
            if (document.getElementById('radius')) {
              document.getElementById('radius').style.display = 'block';
            }
            if (document.getElementById('width-height')) {
              document.getElementById('width-height').style.display = 'none';
            }
          }
          else {
            if (document.getElementById('radius')) {
              document.getElementById('radius').style.display = 'none';
            }
            if (document.getElementById('width-height')) {
              document.getElementById('width-height').style.display = 'block';
            }
          }
        })
        .then(() => {
        });
    }
    else if (util.isLink(node)) {
      link = node;
      stateMap.node = null;
      var editPane = document.getElementById('edit');
      editPane.innerHTML = wuwei.edit.markup.template();
      bindEditPaneValueEvents(editPane);
      editPane.style.display = 'block';
      stateMap.link = link;

      if (!option) {
        option = {
          editor: true
        };
      }
      const param = {
        link: stateMap.link,
        association: null,
        option: option
      };
      stateMap.param = param;
      refreshTemplate(param).then(() => {
        normalizeEditFieldPaths(document.getElementById('editform'));
        let editPane = document.getElementById('edit');
        editPane.dataset.node_id = undefined;
        editPane.dataset.link_id = link.id;
      });
    }
  }

  function close(option) {
    option = option || {};
    if (!option.skipLog) {
      storePendingEditLog('edit');
    }
    else {
      snapshotTaken = false;
    }

    state.Editing = false;
    document.getElementById('Editing').style.opacity = '0';

    closeEdit();

    var editingCircle = document.getElementById('Editing');
    editingCircle.style.opacity = '0';
    document.getElementById('open_controls').style.display = 'block';

    if (state.previousEdit) {
      let _node = state.previousEdit.node;
      if (_node) {
        util.appendById(graph.nodes, _node);
        state.previousEdit.node = null;
      }
    }

    if (callback) { callback(); }
  }

  function dismiss() {
    storePendingEditLog('edit');
    close({ skipLog: true });
  }

  function flushViewpointEntryFields() {
    var pageNumberEl;
    var pageNumber;
    if (!stateMap.node || stateMap.node.topicKind !== 'viewpoint-page') {
      return;
    }
    pageNumberEl = document.getElementById('pageNumber');
    if (!pageNumberEl) {
      return;
    }
    pageNumber = Math.floor(Number(pageNumberEl.value || 1));
    stateMap.node.pageNumber = Number.isFinite(pageNumber) && pageNumber > 0
      ? pageNumber
      : 1;
  }

  function flushVideoEditFields() {
    var pane, labelEl, descriptionEl, kindEl, uriEl, uri;
    if (!stateMap.node) {
      return;
    }
    pane = document.getElementById('edit-video');
    if (!pane || pane.style.display === 'none' || !pane.innerHTML) {
      return;
    }

    labelEl = document.getElementById('label');
    if (labelEl) {
      setNodePath(stateMap.node, 'label', labelEl.value || '');
      if (stateMap.node.resource && 'object' === typeof stateMap.node.resource) {
        stateMap.node.resource.title = labelEl.value || '';
      }
    }

    descriptionEl = document.getElementById('description_body') || document.getElementById('description_body');
    if (descriptionEl) {
      setNodePath(stateMap.node, 'description.body', descriptionEl.value || '');
    }

    kindEl = document.getElementById('resource_kind') || document.getElementById('resource_kind');
    if (kindEl) {
      applyMediaDetectionToNode(stateMap.node, kindEl.value || '');
    }

    uriEl = document.getElementById('resource_canonicalUri') || document.getElementById('resource_uri');
    if (uriEl) {
      uri = String(uriEl.value || '').trim();
      if (uri) {
        stateMap.node.resource = stateMap.node.resource || {};
        stateMap.node.resource.uri = uri;
        stateMap.node.resource.canonicalUri = uri;
        normalizeVideoResourceSource(stateMap.node, uri);
      }
    }

    stateMap.node.changed = true;
  }

  function flushVideoResourceFields() {
    var uriEl;
    if (!stateMap.node || stateMap.node.option !== 'video') {
      return;
    }
    uriEl = document.getElementById('resource_canonicalUri') || document.getElementById('resource_uri');
    normalizeVideoResourceSource(stateMap.node, uriEl ? uriEl.value : '');
  }

  function flushNetworkResourceFields() {
    var uriEl, value;
    if (!stateMap.node || !stateMap.node.resource || stateMap.node.resource.storage) {
      return;
    }
    uriEl = document.getElementById('resource_uri') || document.getElementById('resource_canonicalUri');
    if (!uriEl) {
      return;
    }
    value = String(uriEl.value || '').trim();
    if (!isHttpUrl(value)) {
      return;
    }
    stateMap.node.resource.uri = value;
    stateMap.node.resource.canonicalUri = value;
    applyMediaDetectionToNode(stateMap.node, '');
  }

  function flushGroupEditFields() {
    if (!stateMap.group) {
      return true;
    }
    if (wuwei.edit.group && typeof wuwei.edit.group.commit === 'function') {
      return wuwei.edit.group.commit();
    }
    return true;
  }

  function commit() {
    var committed = true;
    flushVideoEditFields();
    flushVideoResourceFields();
    flushNetworkResourceFields();
    flushViewpointEntryFields();
    flushGroupEditFields();
    // Timeline edits are buffered in the timeline panel fields,
    // so the global save icon must apply them before storing the log.
    if (state.timelineEdit &&
      wuwei.edit.timeline &&
      typeof wuwei.edit.timeline.commit === 'function') {
      committed = wuwei.edit.timeline.commit();
    }
    if (state.viewpointEdit) {
      committed = wuwei.edit.viewpoint.commit();
    }

    if (false === committed) {
      return false;
    }

    if (stateMap.option && stateMap.option.pendingViewpointEntry &&
      stateMap.node && wuwei.viewpoint && typeof wuwei.viewpoint.commitEntryDraft === 'function') {
      committed = wuwei.viewpoint.commitEntryDraft(stateMap.node);
    }
    else if (stateMap.node && stateMap.node.topicKind === 'viewpoint-page' &&
      wuwei.viewpoint && typeof wuwei.viewpoint.updateEntryFromNode === 'function') {
      committed = wuwei.viewpoint.updateEntryFromNode(stateMap.node);
    }

    if (false === committed) {
      return false;
    }

    snapshotTaken = false;
    // Store the log after timeline graph rebuild has been confirmed.
    log.storeLog({ operation: 'edit' });
    registerNetworkResourceOnCommit();
    close({ skipLog: true });
    return true;
  }

  function resolveTimelineEditInfoTarget() {
    var editState = state && state.timelineEdit;
    var target = null;

    if (!editState || !editState.mode) {
      return null;
    }

    if (editState.pointId && model && typeof model.findNodeById === 'function') {
      target = model.findNodeById(editState.pointId);
    }
    if (!target && editState.groupId && model && typeof model.findGroupById === 'function') {
      target = model.findGroupById(editState.groupId);
    }
    if (!target && editState.targetId) {
      if (model && typeof model.findNodeById === 'function') {
        target = model.findNodeById(editState.targetId);
      }
      if (!target && model && typeof model.findGroupById === 'function') {
        target = model.findGroupById(editState.targetId);
      }
    }
    return target;
  }

  function openTimelineEditTargetInInfo() {
    var target = resolveTimelineEditInfoTarget();

    if (!target || !wuwei.info || !wuwei.info.timeline ||
      typeof wuwei.info.timeline.open !== 'function') {
      return false;
    }

    close();
    wuwei.info.timeline.open(target);
    return true;
  }

  function resolveViewpointEditInfoTarget() {
    var editState = state && state.viewpointEdit;
    var target = null;

    if (wuwei.edit.viewpoint &&
      typeof wuwei.edit.viewpoint.getCurrentPoint === 'function') {
      target = wuwei.edit.viewpoint.getCurrentPoint();
    }
    if (!target && editState && editState.pointId && model &&
      typeof model.findNodeById === 'function') {
      target = model.findNodeById(editState.pointId);
    }
    if (!target && wuwei.edit.viewpoint &&
      typeof wuwei.edit.viewpoint.getCurrentGroup === 'function') {
      target = wuwei.edit.viewpoint.getCurrentGroup();
    }
    if (!target && editState && editState.groupId && model &&
      typeof model.findGroupById === 'function') {
      target = model.findGroupById(editState.groupId);
    }
    return target;
  }

  function openViewpointEditTargetInInfo() {
    var target = resolveViewpointEditInfoTarget();

    if (!state.viewpointEdit || !target || !wuwei.edit.viewpoint ||
      typeof wuwei.edit.viewpoint.openInfo !== 'function') {
      return false;
    }

    close();
    wuwei.edit.viewpoint.openInfo(target);
    return true;
  }

  function infoOpen() {
    var targetNode = stateMap.node;
    var targetOption = stateMap.option;
    flushViewpointEntryFields();
    flushGroupEditFields();

    if (openTimelineEditTargetInInfo()) {
      return;
    }
    if (openViewpointEditTargetInInfo()) {
      return;
    }

    if (!targetNode && stateMap.group) {
      var targetGroup = stateMap.group;
      close();
      if (targetGroup && targetGroup.type === 'viewpoint' &&
        wuwei.info && wuwei.info.viewpoint && typeof wuwei.info.viewpoint.openAxis === 'function') {
        wuwei.info.viewpoint.openAxis(targetGroup);
        return;
      }
      if (targetGroup && targetGroup.type === 'timeline' &&
        wuwei.info && wuwei.info.timeline && typeof wuwei.info.timeline.open === 'function') {
        wuwei.info.timeline.open(targetGroup);
        return;
      }
      wuwei.info.open({
        id: targetGroup.pseudoNodeId || targetGroup.pseudoLinkId || targetGroup.id,
        type: 'Group',
        groupRef: targetGroup.id,
        groupType: targetGroup.type
      }, targetOption);
      return;
    }
    if (targetNode && targetNode.topicKind === 'viewpoint-page' &&
      wuwei.menu && wuwei.menu.viewpoint && typeof wuwei.menu.viewpoint.openContentTargetInInfo === 'function') {
      close();
      wuwei.menu.viewpoint.openContentTargetInInfo(targetNode);
      return;
    }
    close();
    wuwei.info.open(targetNode, targetOption);
  }

  function closeEdit() {
    if (state.Selecting) {
      wuwei.edit.generic.close();
    }

    if (stateMap.node) {
      if ('generic' === stateMap.node.option) {
        wuwei.edit.generic.close();
      }
      else if (isVideoContentNode(stateMap.node) && wuwei.edit.video && typeof wuwei.edit.video.close === 'function') {
        wuwei.edit.video.close();
      }
      else if (isAudioContentNode(stateMap.node) && wuwei.edit.audio && typeof wuwei.edit.audio.close === 'function') {
        wuwei.edit.audio.close();
      }
      else if (isImageContentNode(stateMap.node) && wuwei.edit.image && typeof wuwei.edit.image.close === 'function') {
        wuwei.edit.image.close();
      }
      else if (isUploadedContentNode(stateMap.node)) {
        wuwei.edit.uploaded.close();
      }
      else if ('memo' === stateMap.node.option) {
        wuwei.edit.memo.close();
      }
      else {
        wuwei.edit.generic.close();
      }
    }
    else if (stateMap.link) {
      wuwei.edit.link.close();
    }
    else if (stateMap.group) {
      if (wuwei.edit.group && typeof wuwei.edit.group.close === 'function') {
        wuwei.edit.group.close();
      }
      stateMap.group = null;
    }

    if (wuwei.edit.timeline && typeof wuwei.edit.timeline.close === 'function') {
      wuwei.edit.timeline.close();
    }
    if (wuwei.edit.viewpoint && typeof wuwei.edit.viewpoint.close === 'function') {
      wuwei.edit.viewpoint.close();
    }
    if (wuwei.edit.audio && typeof wuwei.edit.audio.close === 'function') {
      wuwei.edit.audio.close();
    }
    if (wuwei.edit.image && typeof wuwei.edit.image.close === 'function') {
      wuwei.edit.image.close();
    }

    document.getElementById('edit').innerHTML = '';
    document.getElementById('edit').style.display = 'none';
    document.getElementById('Editing').style.opacity = '0';
    menu.closeContextMenu();

    if ('draw' === graph.mode) {
      draw.refresh();
    }
    else if ('simulation' === graph.mode) {
      draw.restart();
    }
  }

  function widen() {
    let editPane = document.getElementById('edit');
    editPane.classList.toggle('widen');
  }

  const initModule = function () {
    var editPane = document.getElementById('edit');
    if (!editPane) {
      return;
    }

    editPane.innerHTML = wuwei.edit.markup.template();
    bindEditPaneValueEvents(editPane);

    if (wuwei.edit.generic && typeof wuwei.edit.generic.initModule === 'function') {
      wuwei.edit.generic.initModule();
    }
    if (wuwei.edit.link && typeof wuwei.edit.link.initModule === 'function') {
      wuwei.edit.link.initModule();
    }
    if (wuwei.edit.group && typeof wuwei.edit.group.initModule === 'function') {
      wuwei.edit.group.initModule();
    }
    if (wuwei.edit.uploaded && typeof wuwei.edit.uploaded.initModule === 'function') {
      wuwei.edit.uploaded.initModule();
    }
    if (wuwei.edit.video && typeof wuwei.edit.video.initModule === 'function') {
      wuwei.edit.video.initModule();
    }
    if (wuwei.edit.audio && typeof wuwei.edit.audio.initModule === 'function') {
      wuwei.edit.audio.initModule();
    }
    if (wuwei.edit.image && typeof wuwei.edit.image.initModule === 'function') {
      wuwei.edit.image.initModule();
    }
    if (wuwei.edit.timeline && typeof wuwei.edit.timeline.initModule === 'function') {
      wuwei.edit.timeline.initModule();
    }

    document.addEventListener('click', function (ev) {
      var saveBtn = ev.target && ev.target.closest && ev.target.closest('#editSave');
      if (saveBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        commit();
        return;
      }

      var dismissBtn = ev.target && ev.target.closest && ev.target.closest('#editDismiss');
      if (dismissBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        dismiss();
        return;
      }

      var widenBtn = ev.target && ev.target.closest && ev.target.closest('#editWiden');
      if (widenBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        widen();
        return;
      }

      var infoBtn = ev.target && ev.target.closest && ev.target.closest('#infoOpen');
      if (infoBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        infoOpen();
        return;
      }
    }, true);
  };

  ns.open = open;
  ns.close = close;
  ns.widen = widen;
  ns.dismiss = dismiss;
  ns.commit = commit;
  ns.autoExpand = autoExpand;
  ns.refreshTemplate = refreshTemplate;
  ns.infoOpen = infoOpen;
  ns.closeEdit = closeEdit;
  ns.resetForExternalEditor = resetForExternalEditor;
  ns.update = update;
  ns.showOnlyEditRoot = showOnlyEditRoot;
  ns.closeInfoPaneForEdit = closeInfoPaneForEdit;
  ns.fieldIdToPath = fieldIdToPath;
  ns.pathToFieldId = pathToFieldId;
  ns.asciiDocToPlainText = asciiDocToPlainText;
  ns.asciiDocToHtml = asciiDocToHtml;
  ns.detectMediaFromUrl = detectMediaFromUrl;
  ns.applyMediaDetectionToNode = applyMediaDetectionToNode;
  ns.initModule = initModule;
})(wuwei.edit);
// wuwei.edit.js last modified 2026-05-11
