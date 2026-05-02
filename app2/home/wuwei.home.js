/**
 * wuwei.home.js
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2021, 2023, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.home = (function () {
  'use strict';

  var
    CARD_WIDTH = 220,
    common = wuwei.common,
    state = common.state,
    util = wuwei.util,
    _searchEventsBound = false,
    modal,
    files,
    allFiles,
    fileMap = new Map(),
    year, month, date,
    dateRangeStart = '',
    dateRangeEnd = '',
    rangeTarget = 'all',
    searchTerm = '',
    searchScope = 'current',
    selectedResourceId = '',
    days, months,
    list,
    listFile,
    populateFile,
    accordionFunc,
    sidebarOpen,
    sidebarClose,
    registerClick,
    searchClicked,
    registerEventSearch,
    registerEventFilters,
    refreshLoginStatus,
    toggleHome,
    commentFile,
    editDescription,
    saveDescription,
    cancelDescriptionEdit,
    addResource,
    hideResource,
    removeResource,
    removeWebpage,
    sortFile,
    annotateOpen,
    annotateNew,
    updateTop,
    findResource,
    applyDateFilter,
    clearDateFilter,
    populateDummyContents,
    isAbsoluteUrl,
    isHostedVimeo,
    isHostedYouTube,
    extractYouTubeId,
    extractVimeoInfo,
    buildHostedVideoEmbedUrl,
    buildPdfViewerUrl,
    getPreviewKind,
    getPreviewSrc,
    applyGalleryFilters,
    initModule;
  var previewSeq = 0;
  var BASE_URL = location.origin + '/wu_wei2'

  class Modal {
    constructor(id, overlay_id) {
      this._modalId = id;
      this._overlayId = overlay_id;
    }
    get modal() {
      return document.getElementById(this._modalId);
    }
    set modal(id) {
      this._modalId = id;
    }
    get overlay() {
      return document.getElementById(this._overlayId);
    }
    set overlay(overlay_id) {
      this._overlayId = overlay_id;
    }
    open() {
      var modal = document.getElementById(this._modalId);
      var overlay = document.getElementById(this._overlayId);
      if (overlay) overlay.style.display = 'block';
      if (modal) modal.classList.remove('w3-collapse');
    }
    close() {
      var modal = document.getElementById(this._modalId);
      var overlay = document.getElementById(this._overlayId);
      if (overlay) overlay.style.display = 'none';
      if (modal) modal.classList.add('w3-collapse');
    }
  }

  function translate(key) {
    return (wuwei.nls && wuwei.nls.translate) ? (wuwei.nls.translate(key) || key) : key;
  }

  function safeDecode(value) {
    if (typeof value !== 'string') {
      return value || '';
    }
    try {
      return decodeURIComponent(value);
    }
    catch (e) {
      return value;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getFileTimestamp(file) {
    const value = file && file.value ? file.value : {};
    const resource = file && file.resource && typeof file.resource === 'object' ? file.resource : {};
    const audit = resource.audit && typeof resource.audit === 'object' ? resource.audit : {};
    const filePath = value.file || '';
    const retrieved = value.retrieved || '';
    const lastmodified = value.lastmodified || audit.lastModifiedAt || audit.createdAt || '';
    const option = file && file.option ? file.option : '';
    let timestamp = '';

    if (filePath) {
      const start = filePath.indexOf('datetime=');
      if (start > 0) {
        timestamp = filePath.substr(start + 9, 19);
        timestamp = timestamp.substr(0, 4) + '-' + timestamp.substr(5, 2) + '-' + timestamp.substr(8);
      }
    }
    if (!timestamp) {
      timestamp = lastmodified || ('webpage' === option && retrieved) || '';
    }
    return timestamp;
  }

  function getFileDateTimeLabel(file) {
    const normalized = parseTimestampLabel(getFileTimestamp(file));
    if (normalized) {
      return normalized;
    }
    const option = file && file.option ? file.option : '';
    const timestamp = getFileTimestamp(file);
    let rgx, datetime;
    if ('webpage' === option) {
      rgx = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}/;
      datetime = rgx.exec(timestamp);
    }
    else {
      rgx = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}/;
      datetime = rgx.exec(timestamp);
    }
    if (datetime && datetime.length > 2) {
      return datetime[1] + ' ' + datetime[2];
    }
    return timestamp || '—';
  }

  function parseTimestampLabel(timestamp) {
    const m = String(timestamp || '').trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]+(\d{2}:\d{2})(?::\d{2})?)?/);
    if (!m) {
      return '';
    }
    return m[1] + (m[2] ? ' ' + m[2] : '');
  }

  function getResourceDate(file) {
    const timestamp = getFileTimestamp(file);
    const m = String(timestamp || '').match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }

  function stripMarkup(format, body) {
    let text = String(body || '');
    const fmt = String(format || 'plain/text').toLowerCase();

    if (fmt.indexOf('html') >= 0) {
      text = text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
    }
    else if (fmt.indexOf('asciidoc') >= 0 || fmt.indexOf('adoc') >= 0) {
      text = text
        .replace(/^\s*:[^:\n]+:.*$/gm, ' ')
        .replace(/^\s*(={1,6}|#{1,6})\s+/gm, ' ')
        .replace(/^\s*\[[^\]\n]+\]\s*$/gm, ' ')
        .replace(/(?:link:|image:)?[A-Za-z][A-Za-z0-9+.-]*:[^\s\[]+\[([^\]]*)\]/g, ' $1 ')
        .replace(/[*_`+#~]/g, ' ');
    }
    else if (fmt.indexOf('markdown') >= 0 || fmt === 'md') {
      text = text
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]*)`/g, ' $1 ')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, ' $1 ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')
        .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
        .replace(/[*_>#~=-]/g, ' ');
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  function sanitizeDescriptionHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll('script, style, iframe, object, embed').forEach(function (el) {
      el.remove();
    });
    template.content.querySelectorAll('*').forEach(function (el) {
      Array.from(el.attributes).forEach(function (attr) {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || '');
        if (name.indexOf('on') === 0 || (/(href|src|xlink:href)/.test(name) && /^\s*javascript:/i.test(value))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return template.innerHTML;
  }

  function renderMarkdownDescription(text) {
    const source = String(text || '');
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        return sanitizeDescriptionHtml(window.marked.parse(source));
      }
      catch (e) { }
    }
    if (window.markdownit && typeof window.markdownit === 'function') {
      try {
        return sanitizeDescriptionHtml(window.markdownit({ html: false, linkify: true }).render(source));
      }
      catch (e2) { }
    }
    return '<pre class="plainText">' + escapeHtml(source) + '</pre>';
  }

  function renderAsciiDocDescription(text) {
    const source = String(text || '');
    if (window.asciidoctor && typeof window.asciidoctor.convert === 'function') {
      try {
        return sanitizeDescriptionHtml(window.asciidoctor.convert(source, {
          safe: 'secure',
          standalone: false,
          attributes: { showtitle: false, icons: 'font' }
        }));
      }
      catch (e) { }
    }
    if (wuwei.edit && typeof wuwei.edit.asciiDocToHtml === 'function') {
      try {
        return sanitizeDescriptionHtml(wuwei.edit.asciiDocToHtml(source));
      }
      catch (e2) { }
    }
    return '<pre class="adoc-fallback">' + escapeHtml(source) + '</pre>';
  }

  function renderDescriptionBody(description) {
    const format = String(description && description.format || 'plain/text').toLowerCase();
    const body = String(description && description.body || '');
    if (!body.trim()) {
      return '';
    }
    if (format.indexOf('html') >= 0) {
      return sanitizeDescriptionHtml(body);
    }
    if (format.indexOf('asciidoc') >= 0 || format === 'adoc') {
      return renderAsciiDocDescription(body);
    }
    if (format.indexOf('markdown') >= 0 || format === 'md') {
      return renderMarkdownDescription(body);
    }
    return '<pre class="plainText">' + escapeHtml(body) + '</pre>';
  }

  function getResourceDescription(file) {
    const resource = file && file.resource && typeof file.resource === 'object' ? file.resource : {};
    const value = file && file.value && typeof file.value === 'object' ? file.value : {};
    const source = file && file.description
      ? file.description
      : (resource.description ? resource.description : value.description);
    if (source && typeof source === 'object') {
      return {
        format: String(source.format || 'plain/text'),
        body: String(source.body || '')
      };
    }
    return {
      format: 'plain/text',
      body: safeDecode(source || value.comment || '')
    };
  }

  function setDescriptionDisplay(file) {
    const commentEl = document.getElementById('homeSelectedComment');
    const editorEl = document.getElementById('homeDescriptionEditor');
    const formatEl = document.getElementById('homeDescriptionFormat');
    const bodyEl = document.getElementById('homeDescriptionBody');
    const description = file ? getResourceDescription(file) : { format: 'plain/text', body: '' };
    const html = renderDescriptionBody(description);

    if (commentEl) {
      commentEl.innerHTML = html || escapeHtml(translate('No comment yet'));
      commentEl.classList.toggle('muted', !html);
      commentEl.classList.remove('hidden');
    }
    if (editorEl) {
      editorEl.classList.add('hidden');
    }
    if (formatEl) {
      formatEl.value = description.format || 'plain/text';
    }
    if (bodyEl) {
      bodyEl.value = description.body || '';
    }
  }

  function setDescriptionEditMode(enabled) {
    const commentEl = document.getElementById('homeSelectedComment');
    const editorEl = document.getElementById('homeDescriptionEditor');
    const editBtn = document.getElementById('homeDescriptionEditButton');
    const saveBtn = document.getElementById('homeDescriptionSaveButton');
    const cancelBtn = document.getElementById('homeDescriptionCancelButton');
    if (commentEl) {
      commentEl.classList.toggle('hidden', enabled);
    }
    if (editorEl) {
      editorEl.classList.toggle('hidden', !enabled);
    }
    if (editBtn) {
      editBtn.classList.toggle('hidden', enabled);
    }
    [saveBtn, cancelBtn].forEach(function (btn) {
      if (btn) {
        btn.classList.toggle('hidden', !enabled);
      }
    });
  }

  function cloneHomeObject(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function resourceResponseFromFile(file) {
    if (!file) { return null; }
    const resource = file.resource && typeof file.resource === 'object' ? cloneHomeObject(file.resource) : null;
    const value = file.value && typeof file.value === 'object' ? cloneHomeObject(file.value) : {};
    const description = getResourceDescription(file);
    const label = safeDecode(file.label || file.name || (resource && resource.label) || file.id || '');
    const resourceId = (resource && resource.id) || file.id;
    const identity = resource && resource.identity && typeof resource.identity === 'object' ? resource.identity : {};
    const media = resource && resource.media && typeof resource.media === 'object' ? resource.media : {};
    const viewer = resource && resource.viewer && typeof resource.viewer === 'object' ? resource.viewer : {};
    const storage = resource && resource.storage && typeof resource.storage === 'object' ? resource.storage : {};
    const sourceUri = safeDecode(file.uri || identity.uri || identity.canonicalUri || '');
    const previewUri = safeDecode(file.preview_url || value.previewUri || file.url || viewer.uri || sourceUri || '');
    const canonicalUri = safeDecode(file.download_url || identity.canonicalUri || sourceUri || previewUri || '');

    if (resource) {
      resource.id = resourceId;
      resource.label = resource.label || label;
      resource.description = description;
      resource.identity = Object.assign({}, identity, {
        title: identity.title || label,
        uri: identity.uri || sourceUri || previewUri,
        canonicalUri: identity.canonicalUri || canonicalUri || sourceUri || previewUri
      });
      resource.media = Object.assign({}, media, {
        kind: media.kind || file.option || 'general',
        mimeType: media.mimeType || file.contenttype || 'text/plain'
      });
      resource.viewer = viewer;
      resource.storage = storage;
    }

    value.comment = description.body || value.comment || '';

    return {
      id: resourceId,
      resource: resource,
      label: label,
      name: label,
      option: file.option || '',
      contenttype: file.contenttype || (media && media.mimeType) || 'text/plain',
      uri: sourceUri || previewUri,
      url: previewUri || sourceUri,
      download_url: canonicalUri || sourceUri || previewUri,
      preview_url: previewUri || sourceUri,
      value: value
    };
  }

  function isRegistrableResourceFile(file) {
    if (!file || !file.id) { return false; }

    const resource = file.resource && typeof file.resource === 'object' ? file.resource : null;
    if (!resource) { return false; }

    const identity = resource.identity && typeof resource.identity === 'object' ? resource.identity : {};
    const media = resource.media && typeof resource.media === 'object' ? resource.media : {};
    const viewer = resource.viewer && typeof resource.viewer === 'object' ? resource.viewer : {};
    const embed = viewer.embed && typeof viewer.embed === 'object' ? viewer.embed : {};
    const storage = resource.storage && typeof resource.storage === 'object' ? resource.storage : {};
    const files = Array.isArray(storage.files) ? storage.files : [];
    const snapshotSources = resource.snapshotSources && typeof resource.snapshotSources === 'object' ? resource.snapshotSources : {};

    const resourceId = resource.id || file.id;
    const label = safeDecode(file.label || file.name || resource.label || identity.title || '');
    const mimeType = media.mimeType || file.contenttype || '';
    const kind = media.kind || file.option || '';
    const uri = safeDecode(file.uri || identity.uri || identity.canonicalUri || embed.uri || '');
    const previewUri = safeDecode(file.preview_url || file.url || snapshotSources.previewUri || embed.uri || '');
    const downloadUri = safeDecode(file.download_url || snapshotSources.originalUri || identity.canonicalUri || '');
    const hasStorageFile = files.some(function (item) {
      return item && item.path && ['original', 'preview', 'thumbnail'].includes(String(item.role || '').toLowerCase());
    });
    const hasAddress = !!(uri || previewUri || downloadUri);

    return !!(resourceId && label && hasAddress && (kind || mimeType || hasStorageFile));
  }

  function hasEditableCurrentNote() {
    const current = common.current || {};
    const page = current.page || {};
    return !!(
      (current.note_name && String(current.note_name).trim()) ||
      (current.description && String(current.description).trim()) ||
      (Array.isArray(page.nodes) && page.nodes.length > 0) ||
      (Array.isArray(page.links) && page.links.length > 0)
    );
  }

  function addSelectedResourceToCurrentNote(id, option) {
    option = option || {};
    const file = fileMap.get(id);
    if (!file) { return; }
    const response = resourceResponseFromFile(file);
    if (!response) { return; }
    if (option.newNote && wuwei.note && typeof wuwei.note.newNote === 'function') {
      if (hasEditableCurrentNote() &&
        !window.confirm(translate('Create a new note from the selected content? Unsaved changes in the current note will be discarded.'))) {
        return;
      }
      wuwei.note.newNote();
      if (wuwei.log && typeof wuwei.log.savePrevious === 'function') {
        wuwei.log.savePrevious();
      }
    }
    if (!wuwei.model || typeof wuwei.model.addUploadedContent !== 'function') {
      throw new Error('wuwei.model.addUploadedContent is not available');
    }
    const logData = wuwei.model.addUploadedContent(response);
    if (wuwei.draw && typeof wuwei.draw.reRender === 'function') {
      wuwei.draw.reRender();
    }
    if (wuwei.log && typeof wuwei.log.storeLog === 'function') {
      wuwei.log.storeLog({ operation: option.newNote ? 'annotateNew' : 'annotateOpen' });
    }
    if (wuwei.menu && typeof wuwei.menu.updateUndoRedoButton === 'function') {
      wuwei.menu.updateUndoRedoButton();
    }
    if (wuwei.home && typeof wuwei.home.toggleHome === 'function') {
      wuwei.home.toggleHome();
    }
  }

  function getSearchText(file) {
    const value = file && file.value ? file.value : {};
    const resource = file && file.resource && typeof file.resource === 'object' ? file.resource : {};
    const identity = resource.identity && typeof resource.identity === 'object' ? resource.identity : {};
    const storage = resource.storage && typeof resource.storage === 'object' ? resource.storage : {};
    const storageFiles = Array.isArray(storage.files) ? storage.files : [];
    const description = file && file.description
      ? file.description
      : (
        resource.description
          ? resource.description
          : value.description
      );
    const descriptionBody = description && typeof description === 'object'
      ? stripMarkup(description.format, description.body)
      : stripMarkup('plain/text', description || value.comment || '');
    return [
      safeDecode(file && file.label ? file.label : ''),
      safeDecode(resource && resource.label ? resource.label : ''),
      safeDecode(file && file.name ? file.name : ''),
      safeDecode(value && value.label ? value.label : ''),
      safeDecode(descriptionBody),
      safeDecode(identity.title || ''),
      storageFiles.map(function (item) {
        if (!item) {
          return '';
        }
        return [safeDecode(item.area || ''), safeDecode(item.path || '')].join(' ');
      }).join(' '),
      safeDecode(identity.uri || ''),
      safeDecode(identity.canonicalUri || ''),
      safeDecode(file && file.url ? file.url : ''),
      safeDecode(file && file.uri ? file.uri : '')
    ].join(' ').toLowerCase();
  }

  function getFileTypeLabel(file) {
    if (wuwei.info && typeof wuwei.info.getContentTypeLabel === 'function') {
      return wuwei.info.getContentTypeLabel(file);
    }

    const resource = file && file.resource && typeof file.resource === 'object' ? file.resource : {};
    const media = resource.media && typeof resource.media === 'object' ? resource.media : {};
    const identity = resource.identity && typeof resource.identity === 'object' ? resource.identity : {};
    const kind = String(media.kind || file.option || '').toLowerCase();
    const mime = String(media.mimeType || file.contenttype || '').toLowerCase();
    const uri = safeDecode(
      file && (file.preview_url || file.download_url || file.url || file.uri) ||
      identity.uri ||
      identity.canonicalUri ||
      ''
    ).toLowerCase();

    if (kind === 'video' || mime.indexOf('video/') === 0 || /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/.test(uri)) {
      return 'VIDEO';
    }
    if (kind === 'audio' || mime.indexOf('audio/') === 0 || /\.(mp3|wav|m4a|ogg|oga)(\?|#|$)/.test(uri)) {
      return 'AUDIO';
    }
    if (kind === 'image' || mime.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/.test(uri)) {
      return 'IMAGE';
    }
    if (kind === 'webpage' || mime === 'text/html' || /\.html?(\?|#|$)/.test(uri)) {
      return 'HTML';
    }
    if (mime === 'application/pdf' || /\.pdf(\?|#|$)/.test(uri)) {
      return 'PDF';
    }
    if (/officedocument|msword|ms-excel|ms-powerpoint|vnd\.ms-|\.docx?(\?|#|$)|\.xlsx?(\?|#|$)|\.pptx?(\?|#|$)/.test(mime + ' ' + uri)) {
      return 'OFFICE';
    }
    if (mime.indexOf('text/') === 0 || /\.(txt|csv|tsv|md|adoc|json|xml)(\?|#|$)/.test(uri)) {
      return 'TEXT';
    }
    return translate('File');
  }

  function parseResourceListResponse(responseText) {
    const text = (responseText == null) ? '' : String(responseText).trim();
    if (!text) {
      return { r: [], count: 0, count_org: 0, start: 0, days: '', months: [] };
    }
    if (text.indexOf('ERROR') === 0) {
      throw new Error(text);
    }
    return JSON.parse(text);
  }

  function getInfoApi() {
    return (window.wuwei && wuwei.info) ? wuwei.info : {};
  }

  function isAbsoluteUrl(uri) {
    var api = getInfoApi();
    if (typeof api.isAbsoluteUrl === 'function') {
      return api.isAbsoluteUrl(uri);
    }
    return /^(https?:|blob:|data:)/i.test(String(uri || '').trim());
  }

  function toCurrentLocalOrigin(uri) {
    var value = safeDecode(uri || '');
    var parsed;
    var host;

    if (!value || !/^https?:\/\//i.test(value) || !location || !location.hostname) {
      return value;
    }

    try {
      parsed = new URL(value, location.href);
    } catch (e) {
      return value;
    }

    host = String(parsed.hostname || '').toLowerCase();
    if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
      return value;
    }
    if (!['localhost', '127.0.0.1', '::1'].includes(String(location.hostname || '').toLowerCase())) {
      return value;
    }

    parsed.protocol = location.protocol;
    parsed.host = location.host;
    return parsed.href;
  }

  function isHostedYouTube(url) {
    var s = String(url || '').toLowerCase();
    return /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b/.test(s);
  }

  function isHostedVimeo(url) {
    var s = String(url || '').toLowerCase();
    return /^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\b/.test(s);
  }

  function extractYouTubeId(url) {
    var api = getInfoApi();
    if (typeof api.extractYouTubeId === 'function') {
      return api.extractYouTubeId(url);
    }
    var s = String(url || '').trim();
    var m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m) {
      return m[1];
    }
    m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (m) {
      return m[1];
    }
    m = s.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  function extractVimeoInfo(url) {
    var api = getInfoApi();
    if (typeof api.extractVimeoInfo === 'function') {
      return api.extractVimeoInfo(url);
    }
    var out = { id: '', h: '', url: String(url || '').trim() };
    var u, m;
    try {
      u = new URL(out.url, location.href);
      out.h = u.searchParams.get('h') || '';
      m = u.pathname.match(/\/(?:video\/)?([0-9]+)/);
      if (m) {
        out.id = m[1];
      }
    }
    catch (e) {
      m = out.url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
      if (m) {
        out.id = m[1];
      }
    }
    return out;
  }

  function buildHostedVideoEmbedUrl(rawUrl, provider, start) {
    var api = getInfoApi();
    if (typeof api.buildHostedVideoEmbedUrl === 'function') {
      return api.buildHostedVideoEmbedUrl(rawUrl, provider, start);
    }

    var startSec = Math.max(0, Math.floor(Number(start || 0)));
    var id, vimeo, qs, q, t;

    if (provider === 'youtube') {
      id = extractYouTubeId(rawUrl);
      if (!id) {
        return '';
      }
      return 'https://www.youtube.com/embed/' + encodeURIComponent(id) +
        '?playsinline=1&rel=0&enablejsapi=1&origin=' + encodeURIComponent(location.origin) +
        (startSec > 0 ? '&start=' + startSec : '');
    }

    if (provider === 'vimeo') {
      vimeo = extractVimeoInfo(rawUrl);
      if (!vimeo.id) {
        return '';
      }
      qs = [];
      if (vimeo.h) {
        qs.push('h=' + encodeURIComponent(vimeo.h));
      }
      q = qs.length ? ('?' + qs.join('&')) : '';
      t = startSec > 0 ? ('#t=' + startSec + 's') : '';
      return 'https://player.vimeo.com/video/' + encodeURIComponent(vimeo.id) + q + t;
    }

    return '';
  }

  function buildPdfViewerUrl(uri) {
    var api = getInfoApi();
    if (typeof api.buildPdfViewerUrl === 'function') {
      return api.buildPdfViewerUrl(uri);
    }

    var base_url = 'https://www.wuwei.space/wu_wei';
    var href = String(uri || '').trim();
    if (!href) {
      return '';
    }
    if (isAbsoluteUrl(href)) {
      return href;
    }
    return base_url + '/pdf.js/web/viewer.html?file=' + base_url + '/' + href.replace(/^\/+/, '');
  }

  function getPreviewKind(file) {
    var api = getInfoApi();
    if (typeof api.getPreviewKind === 'function') {
      return api.getPreviewKind(file);
    }

    var value = file && file.value ? file.value : {};
    var viewerType = String(value.viewerType || '').toLowerCase();
    var format = String(file && file.contenttype || '').toLowerCase();
    var rawUrl = safeDecode(file && (file.url || file.uri) || '');

    if (viewerType === 'thumbnail') {
      return 'thumbnail';
    }
    if (viewerType === 'iframe') {
      return 'iframe';
    }
    if (viewerType === 'pdf') {
      return 'pdf';
    }
    if (viewerType === 'video' || viewerType === 'vimeo' || viewerType === 'youtube') {
      return 'video';
    }
    if (viewerType === 'image') {
      return 'image';
    }
    if (format === 'application/pdf' || /\.pdf(\?|#|$)/i.test(rawUrl)) {
      return 'pdf';
    }
    if (format.indexOf('image/') === 0) {
      return 'image';
    }
    if (format.indexOf('video/') === 0 || isHostedYouTube(rawUrl) || isHostedVimeo(rawUrl)) {
      return 'video';
    }
    if ('webpage' === file.option) {
      return 'iframe';
    }
    return 'image';
  }

  function getPreviewSrc(file) {
    var api = getInfoApi();
    if (typeof api.getPreviewSrc === 'function') {
      return toCurrentLocalOrigin(api.getPreviewSrc(file));
    }

    var value = file && file.value ? file.value : {};
    var sourceLink = resolveResourceLink(file);
    var uri = safeDecode(file && file.uri ? file.uri : '');

    return toCurrentLocalOrigin(safeDecode(file && file.preview_url ? file.preview_url : '') ||
      value.previewUri ||
      sourceLink ||
      uri ||
      (value.thumbnail && value.thumbnail.uri) ||
      '');
  }

  function getThumbnailSrc(file) {
    var value = file && file.value ? file.value : {};
    var resource = file && file.resource && typeof file.resource === 'object' ? file.resource : {};
    var viewer = resource.viewer && typeof resource.viewer === 'object' ? resource.viewer : {};
    var embed = viewer.embed && typeof viewer.embed === 'object' ? viewer.embed : {};
    var snapshotSources = resource.snapshotSources && typeof resource.snapshotSources === 'object' ? resource.snapshotSources : {};

    return toCurrentLocalOrigin(
      safeDecode(value.thumbnail && value.thumbnail.uri ? value.thumbnail.uri : '') ||
      safeDecode(file && file.thumbnail_url ? file.thumbnail_url : '') ||
      safeDecode(viewer.thumbnailUri || '') ||
      safeDecode(embed.thumbnailUri || '') ||
      safeDecode(snapshotSources.thumbnailUri || '') ||
      ''
    );
  }

  function renderHomePreviewBody(file, options) {
    options = options || {};
    const thumbnailSrc = safeDecode(getThumbnailSrc(file));
    const src = safeDecode(getPreviewSrc(file));
    const kind = getPreviewKind(file);
    const name = escapeHtml(options.alt || safeDecode(file && (file.name || file.id) || ''));
    const safeThumbnailSrc = escapeHtml(thumbnailSrc);
    const safeSrc = escapeHtml(src);

    function renderOpenAction(openUrl) {
      const href = escapeHtml(openUrl || src || '');
      if (!href) {
        return '';
      }
      return '<div class="home-preview-actions">' +
        '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(translate('Open in new tab')) + ' <i class="fas fa-external-link-alt"></i>' +
        '</a>' +
        '</div>';
    }

    function renderImagePreview(imageSrc) {
      const safeImageSrc = escapeHtml(imageSrc);
      return '<div class="home-preview-stack">' +
        '<div class="info-preview-image"><img src="' + safeImageSrc + '" alt="' + name + '"></div>' +
        renderOpenAction(src) +
        '</div>';
    }

    function renderPreviewLink(label) {
      return '<div class="info-preview-placeholder home-preview-link">' +
        '<span class="icon"><i class="fas fa-external-link-alt"></i></span>' +
        '<span class="label">' + escapeHtml(label || translate('Open')) + '</span>' +
        renderOpenAction(src) +
        '</div>';
    }

    if (thumbnailSrc) {
      return renderImagePreview(thumbnailSrc);
    }

    if (kind === 'image' || kind === 'thumbnail') {
      return renderImagePreview(src);
    }

    if (!src) {
      return '';
    }

    if (kind === 'pdf' || /\.pdf(\?|#|$)/i.test(src)) {
      return renderPreviewLink(translate('PDF preview'));
    }

    if (kind === 'video') {
      if (isHostedYouTube(src) || isHostedVimeo(src)) {
        return renderPreviewLink(translate('Video'));
      }
      return '<video class="info-preview-video" src="' + safeSrc + '" controls></video>';
    }

    if (kind === 'iframe') {
      if (String(file && file.contenttype || '').toLowerCase().indexOf('html') >= 0) {
        return '<div class="home-preview-stack">' +
          '<div class="info-iframe-wrap home-iframe-preview home-webpage-preview" data-preview-url="' + safeSrc + '">' +
          '<iframe src="' + safeSrc + '" title="' + name + '" loading="lazy"></iframe>' +
          '<div class="home-iframe-fallback hidden">' +
          '<div class="home-iframe-fallback-title">' + escapeHtml(translate('This site refused iframe preview.')) + '</div>' +
          renderOpenAction(src) +
          '</div>' +
          '</div>' +
          renderOpenAction(src) +
          '</div>';
      }
      return renderPreviewLink(translate('Web page'));
    }

    if (String(file && file.contenttype || '').toLowerCase().indexOf('audio/') === 0) {
      return '<div class="info-preview-audio"><audio src="' + safeSrc + '" controls></audio></div>';
    }

    return renderPreviewLink(translate('Open'));
  }

  function prepareHomeIframeFallback(container) {
    if (!container) { return; }
    const wrappers = container.querySelectorAll('.home-iframe-preview');
    wrappers.forEach(function (wrapper) {
      const frame = wrapper.querySelector('iframe');
      const fallback = wrapper.querySelector('.home-iframe-fallback');
      let settled = false;

      if (!frame || !fallback) { return; }

      const showFallback = function () {
        if (settled) { return; }
        settled = true;
        fallback.classList.remove('hidden');
      };

      frame.addEventListener('load', function () {
        settled = true;
        window.setTimeout(function () {
          const rect = frame.getBoundingClientRect();
          if (!rect.width || !rect.height) {
            settled = false;
            showFallback();
          }
        }, 300);
      });
      frame.addEventListener('error', showFallback);
      window.setTimeout(function () {
        if (!settled) { showFallback(); }
      }, 5000);
    });
  }

  function encodeDummySvg(svg) {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function createDummyThumbnail(label, bgColor, accentColor) {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">',
      '<defs>',
      '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
      '<stop offset="0%" stop-color="' + bgColor + '"/>',
      '<stop offset="100%" stop-color="' + accentColor + '"/>',
      '</linearGradient>',
      '</defs>',
      '<rect width="600" height="600" rx="36" fill="url(#g)"/>',
      '<rect x="42" y="42" width="516" height="516" rx="28" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.34)"/>',
      '<text x="50%" y="43%" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#ffffff">WuWei</text>',
      '<text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#ffffff">' + label + '</text>',
      '</svg>'
    ].join('');
    return encodeDummySvg(svg);
  }

  function buildDummyResources(param) {
    param = param || {};
    const targetYear = param.year || year || new Date().getFullYear();
    const targetMonth = param.month || month || (new Date().getMonth() + 1);
    const monthStr = String(targetMonth).padStart(2, '0');
    const currentMonthKey = targetYear + '-' + monthStr;
    const previousMonthDate = new Date(targetYear, targetMonth - 2, 1);
    const previousMonthKey = previousMonthDate.getFullYear() + '-' + String(previousMonthDate.getMonth() + 1).padStart(2, '0');
    const olderMonthDate = new Date(targetYear, targetMonth - 3, 1);
    const olderMonthKey = olderMonthDate.getFullYear() + '-' + String(olderMonthDate.getMonth() + 1).padStart(2, '0');
    const palette = [
      ['#2563eb', '#7c3aed'],
      ['#0891b2', '#0f766e'],
      ['#ea580c', '#dc2626'],
      ['#16a34a', '#15803d'],
      ['#9333ea', '#db2777'],
      ['#0284c7', '#0369a1'],
      ['#4f46e5', '#7c3aed'],
      ['#0f766e', '#14b8a6']
    ];

    function makePreview(label, index) {
      const colors = palette[index % palette.length];
      return createDummyThumbnail(label, colors[0], colors[1]);
    }

    function createExternalItem(def, index) {
      const ymd = targetYear + '-' + monthStr + '-' + String(def.day).padStart(2, '0');
      const hh = String(9 + (index % 8)).padStart(2, '0');
      const mm = String((index * 7) % 60).padStart(2, '0');
      const timestamp = ymd + ' ' + hh + ':' + mm + ':00';
      const previewUri = def.previewUri || makePreview(def.badge, index);
      const option = def.option || '';
      const contenttype = def.contenttype || '';
      const resourceUrl = def.url || '';
      const resourceUri = def.uri || resourceUrl;
      return {
        id: def.id || ('dummy-' + String(index + 1).padStart(3, '0')),
        option: option,
        contenttype: contenttype,
        name: encodeURIComponent(def.name),
        url: resourceUrl,
        uri: resourceUri,
        value: {
          comment: encodeURIComponent(def.comment || ''),
          lastmodified: timestamp,
          retrieved: option === 'webpage' ? ymd + 'T' + hh + ':' + mm + ':00' : '',
          previewUri: previewUri,
          viewerType: def.viewerType || '',
          media: def.media || {},
          thumbnail: {
            uri: previewUri,
            size: def.thumbnailSize || '240x240'
          },
          imagesize: def.imageSize || '600x600',
          totalsize: def.totalSize || (180000 + (index * 12000)),
          file: '/dummy/content/' + currentMonthKey + '/' + (def.id || ('dummy-' + String(index + 1).padStart(3, '0'))) + ': datetime=' + targetYear + ':' + monthStr + ':' + String(def.day).padStart(2, '0') + ' ' + hh + ':' + mm + ':00'
        }
      };
    }

    const sampleImage = makePreview('Image', 5);
    const sampleThumbnail = makePreview('Thumbnail', 6);

    const definitions = [
      {
        id: 'dummy-web-sambuichi',
        day: 3,
        name: 'sambuichi.jp top page',
        comment: '一般のホームページ例。selected preview は iframe で表示する。',
        url: 'https://www.sambuichi.jp/',
        option: 'webpage',
        contenttype: 'text/html',
        viewerType: 'iframe',
        badge: 'Web'
      },
      {
        id: 'dummy-pdf-meti',
        day: 4,
        name: 'METI report PDF',
        comment: '外部 PDF 例。selected preview は PDF を iframe で表示する。',
        url: 'https://www.meti.go.jp/meti_lib/report/2021FY/000417.pdf',
        option: 'external',
        contenttype: 'application/pdf',
        viewerType: 'pdf',
        badge: 'PDF'
      },
      {
        id: 'dummy-pdf-ipa',
        day: 7,
        name: 'Ouranos ecosystem dataspaces RAM white paper PDF',
        comment: 'IPA の PDF 例。selected preview は PDF ビューで表示する。',
        url: 'https://www.ipa.go.jp/digital/architecture/Individual-link/h5f8pg0000003h0k-att/ouranos-ecosystem-dataspaces-ram-white-paper.pdf',
        option: 'external',
        contenttype: 'application/pdf',
        viewerType: 'pdf',
        badge: 'PDF'
      },
      {
        id: 'dummy-web-ipa-html',
        day: 9,
        name: 'Ouranos ecosystem dataspaces RAM white paper HTML',
        comment: '一般の HTML ページ例。selected preview は iframe で表示する。',
        url: 'https://www.ipa.go.jp/digital/architecture/reports/ouranos-ecosystem-dataspaces-ram-white-paper.html',
        option: 'webpage',
        contenttype: 'text/html',
        viewerType: 'iframe',
        badge: 'HTML'
      },
      {
        id: 'dummy-video-vimeo',
        day: 12,
        name: '小栗判官（7段目・照手車引き）',
        comment: 'Vimeo 動画例。selected preview は Vimeo 埋め込み iframe を使用する。',
        url: 'https://vimeo.com/933802755',
        option: 'external',
        contenttype: 'video/vimeo',
        viewerType: 'vimeo',
        media: { start: 0 },
        badge: 'Vimeo'
      },
      {
        id: 'dummy-image-generated',
        day: 15,
        name: 'Generated image sample',
        comment: 'image viewer の確認用。selected preview は img 要素で表示する。',
        url: sampleImage,
        option: 'external',
        contenttype: 'image/svg+xml',
        viewerType: 'image',
        previewUri: sampleImage,
        badge: 'Image'
      },
      {
        id: 'dummy-thumbnail-generated',
        day: 18,
        name: 'Generated thumbnail sample',
        comment: 'thumbnail viewer の確認用。selected preview は thumbnail 画像のみ表示する。',
        url: sampleThumbnail,
        option: 'external',
        contenttype: 'image/svg+xml',
        viewerType: 'thumbnail',
        previewUri: sampleThumbnail,
        badge: 'Thumb'
      }
    ];

    const allFiles = definitions.map(function (def, index) {
      return createExternalItem(def, index);
    });

    const filtered = param.date
      ? allFiles.filter(function (file) {
        return file.value && file.value.lastmodified && file.value.lastmodified.indexOf(param.date) === 0;
      })
      : allFiles;

    return {
      start: param.start || 0,
      count: filtered.length,
      count_org: allFiles.length,
      year: targetYear,
      month: targetMonth,
      date: param.date || '',
      days: allFiles.map(function (file) {
        return file.value.lastmodified.substr(0, 10);
      }).join('_'),
      months: [olderMonthKey, previousMonthKey, currentMonthKey],
      r: filtered
    };
  }


  /**
   * Layout test helper.
   *
   * Real operation should continue to use the backend list API.
   * For layout confirmation, uncomment the call inside listFile().
   */
  populateDummyContents = function (param) {
    const response = buildDummyResources(param);
    months = response.months || months;
    populateFile(response);
  };

  function resolveResourceLink(file) {
    const base_url = BASE_URL;
    let url = safeDecode(file && file.url ? file.url : '');
    let uri = safeDecode(file && file.uri ? file.uri : '');
    if (url) {
      return toCurrentLocalOrigin(url);
    }
    if (!uri && file && file.value && typeof file.value.file === 'string') {
      uri = file.value.file;
    }
    if (!uri) {
      return '';
    }
    if (/^(https?:|blob:|data:)/i.test(uri)) {
      return toCurrentLocalOrigin(uri);
    }
    return toCurrentLocalOrigin(base_url + '/' + String(uri).replace(/^\/+/, ''));
  }

  function setSelectedCard(id) {
    const cards = document.querySelectorAll('#home #gallery .file-card');
    cards.forEach(function (card) {
      card.classList.toggle('is-selected', card.getAttribute('data-id') === id);
    });
  }

  function setDetailActions(id) {
    const commentBtn = document.getElementById('homeCommentButton');
    const descriptionEditBtn = document.getElementById('homeDescriptionEditButton');
    const descriptionSaveBtn = document.getElementById('homeDescriptionSaveButton');
    const descriptionCancelBtn = document.getElementById('homeDescriptionCancelButton');
    const annotateOpenBtn = document.getElementById('homeAnnotateOpenButton');
    const annotateNewBtn = document.getElementById('homeAnnotateNewButton');
    const disabled = !id;

    [commentBtn, descriptionEditBtn, descriptionSaveBtn, descriptionCancelBtn, annotateOpenBtn, annotateNewBtn].forEach(function (btn) {
      if (btn) {
        btn.disabled = disabled;
        btn.onclick = null;
      }
    });
    setDescriptionEditMode(false);
    if (disabled) {
      return;
    }
    if (commentBtn) {
      commentBtn.onclick = function () { commentFile(id); };
    }
    if (descriptionEditBtn) {
      descriptionEditBtn.onclick = function () { editDescription(id); };
    }
    if (descriptionSaveBtn) {
      descriptionSaveBtn.onclick = function () { saveDescription(id); };
    }
    if (descriptionCancelBtn) {
      descriptionCancelBtn.onclick = function () { cancelDescriptionEdit(id); };
    }
    if (annotateOpenBtn) {
      annotateOpenBtn.onclick = function () { annotateOpen(id); };
    }
    if (annotateNewBtn) {
      annotateNewBtn.onclick = function () { annotateNew(id); };
    }
  }

  function resetPreviewFrame(frame) {
    if (!frame) {
      return;
    }
    try {
      frame.onload = null;
      frame.onerror = null;
      frame.removeAttribute('srcdoc');
      frame.src = 'about:blank';
    }
    catch (e) {
      try {
        frame.removeAttribute('src');
      }
      catch (e2) { }
    }
    frame.style.display = 'none';
  }

  function clearDetailPanel() {
    const previewBody = document.getElementById('homeSelectedPreviewBody');
    const previewEmpty = document.getElementById('homePreviewEmpty');
    const titleNameEl = document.getElementById('homeSelectedTitleName');
    const nameEl = document.getElementById('homeSelectedName');
    const typeEl = document.getElementById('homeSelectedType');
    const dateEl = document.getElementById('homeSelectedDate');
    const sourceEl = document.getElementById('homeSelectedSource');
    const sourceEmptyEl = document.getElementById('homeSelectedSourceEmpty');
    const commentEl = document.getElementById('homeSelectedComment');

    previewSeq += 1;

    if (previewBody) {
      previewBody.innerHTML = '';
      previewBody.style.display = 'none';
      previewBody.removeAttribute('data-preview-seq');
    }

    if (previewEmpty) {
      previewEmpty.style.display = 'flex';
      previewEmpty.textContent = '';
    }
    /*
    if (titleNameEl) {
      titleNameEl.textContent = '窶・;
      titleNameEl.classList.add('muted');
    }
    if (nameEl) {
      nameEl.textContent = '—';
      nameEl.classList.add('muted');
    }
    if (typeEl) {
      typeEl.textContent = '—';
      typeEl.classList.add('muted');
    }
    if (dateEl) {
      dateEl.textContent = '—';
      dateEl.classList.add('muted');
    }
    if (sourceEl) {
      sourceEl.textContent = '';
      sourceEl.removeAttribute('href');
      sourceEl.classList.add('hidden');
    }
    if (sourceEmptyEl) {
      sourceEmptyEl.textContent = '—';
      sourceEmptyEl.classList.remove('hidden');
      sourceEmptyEl.classList.add('muted');
    }
    if (commentEl) {
      commentEl.innerHTML = escapeHtml(translate('No comment yet'));
      commentEl.classList.add('muted');
      commentEl.classList.remove('hidden');
    }
    setDescriptionDisplay(null);
    setDetailActions('');
  }

    */
    if (titleNameEl) {
      titleNameEl.textContent = '-';
      titleNameEl.classList.add('muted');
    }
    if (nameEl) {
      nameEl.textContent = '-';
      nameEl.classList.add('muted');
    }
    if (typeEl) {
      typeEl.textContent = '-';
      typeEl.classList.add('muted');
    }
    if (dateEl) {
      dateEl.textContent = '-';
      dateEl.classList.add('muted');
    }
    if (sourceEl) {
      sourceEl.textContent = '';
      sourceEl.removeAttribute('href');
      sourceEl.classList.add('hidden');
    }
    if (sourceEmptyEl) {
      sourceEmptyEl.textContent = '-';
      sourceEmptyEl.classList.remove('hidden');
      sourceEmptyEl.classList.add('muted');
    }
    if (commentEl) {
      commentEl.innerHTML = escapeHtml(translate('No comment yet'));
      commentEl.classList.add('muted');
      commentEl.classList.remove('hidden');
    }
    setDescriptionDisplay(null);
    setDetailActions('');
  }

  function updateSummary(countOrg) {
    const itemsEl = document.getElementById('Items');
    const totalEl = document.getElementById('total-files');
    const rangeEl = document.getElementById('homeCurrentRange');
    const rangeLabel = date || ((dateRangeStart && dateRangeEnd)
      ? (dateRangeStart + ' - ' + dateRangeEnd)
      : (((year || '') + '-' + String(month || '').padStart(2, '0')) || ''));

    if (totalEl) {
      totalEl.innerText = '' + (countOrg || files && files.length || 0);
    }
    if (itemsEl) {
      if (date) {
        itemsEl.innerText = translate('Selected day') + ': ' + date;
      }
      else if (dateRangeStart && dateRangeEnd) {
        itemsEl.innerText = translate('Range') + ': ' + dateRangeStart + ' - ' + dateRangeEnd;
      }
      else if (year && month) {
        itemsEl.innerText = translate('Month') + ': ' + year + '-' + String(month).padStart(2, '0');
      }
      else {
        itemsEl.innerText = '';
      }
    }
    if (rangeEl) {
      rangeEl.innerText = rangeLabel ? (translate('Showing') + ': ' + rangeLabel) : '';
    }
  }

  function setFilterControlValues() {
    const startEl = document.getElementById('homeDateStart');
    const endEl = document.getElementById('homeDateEnd');
    const targetEl = document.getElementById('homeRangeTarget');
    const scopeEl = document.getElementById('homeSearchScope');
    if (startEl) { startEl.value = dateRangeStart || date || ''; }
    if (endEl) { endEl.value = dateRangeEnd || date || ''; }
    if (targetEl) { targetEl.value = rangeTarget || 'all'; }
    if (scopeEl) { scopeEl.value = searchScope || 'current'; }
    state.homeSelectedDate = date || '';
    state.homeDateRangeStart = dateRangeStart || '';
    state.homeDateRangeEnd = dateRangeEnd || '';
  }

  function bindCalendarDayEvents() {
    const dayCells = document.querySelectorAll('#home .calendar ul.days li:not(.empty)');
    dayCells.forEach(function (dayEl) {
      dayEl.addEventListener('click', function (e) {
        const yearEl = document.querySelector('#home .calendar .month .current .Year');
        const monthEl = document.querySelector('#home .calendar .month .current .Month');
        if (yearEl && monthEl) {
          year = +yearEl.textContent;
          month = +monthEl.textContent;
        }
        date = e.currentTarget.getAttribute('data-date') || '';
        dateRangeStart = date;
        dateRangeEnd = date;
        setFilterControlValues();
        dayCells.forEach(function (cell) {
          const cellDate = cell.getAttribute('data-date') || '';
          cell.classList.toggle('selected', cellDate === date);
          cell.classList.toggle('in-range', cellDate >= dateRangeStart && cellDate <= dateRangeEnd);
        });
        if (searchScope === 'all') {
          findResource(searchTerm);
          sidebarClose();
          return;
        }
        applyGalleryFilters();
        sidebarClose();
      });
    });
  }

  applyGalleryFilters = function (selectedId) {
    const source = allFiles || [];
    const term = String(searchTerm || '').trim().toLowerCase();
    const startDate = dateRangeStart || date || '';
    const endDate = dateRangeEnd || dateRangeStart || date || '';
    const hasRange = !!(startDate && endDate);
    let filtered = source.filter(function (file) {
      const resourceDate = getResourceDate(file);
      if (hasRange) {
        if (!resourceDate || resourceDate < startDate || resourceDate > endDate) {
          return false;
        }
      }
      if (term && getSearchText(file).indexOf(term) < 0) {
        return false;
      }
      return true;
    });

    if (rangeTarget === 'selected') {
      const targetId = selectedId || selectedResourceId;
      filtered = filtered.filter(function (file) {
        return targetId ? file.id === targetId : false;
      });
    }

    files = filtered;
    fileMap = new Map();
    files.forEach(function (file) {
      fileMap.set(file.id, file);
    });
    files.sort(sortFile);
    updateSummary(files.length);
    rerenderGallery(selectedId && fileMap.has(selectedId) ? selectedId : (files[0] && files[0].id || ''));
  };

  function rerenderGallery(selectedId) {
    const galleryEl = document.getElementById('gallery');
    if (galleryEl && wuwei.home.markup && wuwei.home.markup.fileGallery) {
      galleryEl.innerHTML = wuwei.home.markup.fileGallery(files);
    }
    registerClick();
    if (selectedId) {
      updateTop(selectedId);
    }
    else if (files && files.length > 0) {
      updateTop(files[0].id);
    }
    else {
      setSelectedCard('');
      clearDetailPanel();
    }
  }

  refreshLoginStatus = function () {
    const homeDiv = document.getElementById('home');
    const menuDiv = document.getElementById('menu');
    const userStatusDiv = document.getElementById('user_status');
    const applyLoginClass = function () {
      const loggedIn = true === state.loggedIn;
      [homeDiv, menuDiv, userStatusDiv].forEach(function (el) {
        if (!el) { return; }
        if (loggedIn) {
          el.classList.add('loggedIn');
        }
        else {
          el.classList.remove('loggedIn');
        }
      });
    };
    return new Promise(function (resolve) {
      wuwei.menu.login.check()
        .then(function (res) {
          if (!res) {
            state.loggedIn = false;
          }
          if (res && res.type && 'success' !== res.type && 'guest' !== res.type) {
            wuwei.menu.snackbar.open({ message: res.message, type: res.type });
          }
          applyLoginClass();
          resolve(res);
        })
        .catch(function (err) {
          console.log(err);
          state.loggedIn = false;
          if (wuwei.menu && wuwei.menu.login && typeof wuwei.menu.login.update === 'function') {
            wuwei.menu.login.update({ login: null, user_id: null, name: null, role: null });
          }
          applyLoginClass();
          resolve(err);
        });
    });
  };

  registerEventSearch = function () {
    if (_searchEventsBound) { return; }
    const pSearch = document.querySelector('#home p.search');
    const pInput = document.querySelector('#home p.search-text input');
    const pSearchText = document.querySelector('#home p.search-text');
    const iSearch = document.querySelector('#home p.search i.fa-search');
    const iTimes = document.querySelector('#home p.search i.fa-times');
    if (!pSearch || !pInput || !pSearchText || !iSearch || !iTimes) { return; }

    _searchEventsBound = true;

    pSearch.addEventListener('click', function () {
      pSearchText.classList.toggle('hidden');
      iSearch.classList.toggle('hidden');
      iTimes.classList.toggle('hidden');
      if (!pSearchText.classList.contains('hidden')) {
        pInput.focus();
      }
    });

    pInput.addEventListener('change', function () {
      findResource(pInput.value);
    });

    pInput.addEventListener('search', function () {
      findResource(pInput.value);
    });

    pInput.addEventListener('keydown', function (event) {
      if ('Enter' === event.key) {
        event.preventDefault();
        findResource(pInput.value);
      }
      else if ('Escape' === event.key) {
        pInput.value = '';
        findResource('');
      }
    });
  };

  registerEventFilters = function () {
    const startEl = document.getElementById('homeDateStart');
    const endEl = document.getElementById('homeDateEnd');
    const targetEl = document.getElementById('homeRangeTarget');
    const scopeEl = document.getElementById('homeSearchScope');

    if (targetEl) {
      targetEl.addEventListener('change', function () {
        rangeTarget = targetEl.value || 'all';
        applyGalleryFilters();
      });
    }
    if (scopeEl) {
      scopeEl.addEventListener('change', function () {
        searchScope = scopeEl.value || 'current';
        if (searchScope === 'all' || searchTerm) {
          findResource(searchTerm);
          return;
        }
        applyGalleryFilters();
      });
    }
    [startEl, endEl].forEach(function (el) {
      if (!el) { return; }
      el.addEventListener('change', function () {
        applyDateFilter();
      });
    });
    setFilterControlValues();
  };

  applyDateFilter = function () {
    const startEl = document.getElementById('homeDateStart');
    const endEl = document.getElementById('homeDateEnd');
    const targetEl = document.getElementById('homeRangeTarget');
    dateRangeStart = startEl && startEl.value ? startEl.value : '';
    dateRangeEnd = endEl && endEl.value ? endEl.value : dateRangeStart;
    if (dateRangeStart && dateRangeEnd && dateRangeEnd < dateRangeStart) {
      const tmp = dateRangeStart;
      dateRangeStart = dateRangeEnd;
      dateRangeEnd = tmp;
    }
    rangeTarget = targetEl && targetEl.value ? targetEl.value : 'all';
    date = (dateRangeStart && dateRangeStart === dateRangeEnd) ? dateRangeStart : '';
    setFilterControlValues();
    if (wuwei.home.markup && wuwei.home.markup.add_calendar) {
      wuwei.home.markup.add_calendar(year, month, days, months);
      bindCalendarDayEvents();
    }
    if (searchScope === 'all') {
      findResource(searchTerm);
      return;
    }
    applyGalleryFilters();
  };

  clearDateFilter = function () {
    date = '';
    dateRangeStart = '';
    dateRangeEnd = '';
    rangeTarget = 'all';
    setFilterControlValues();
    if (wuwei.home.markup && wuwei.home.markup.add_calendar) {
      wuwei.home.markup.add_calendar(year, month, days, months);
      bindCalendarDayEvents();
    }
    if (searchScope === 'all') {
      listFile({ year: year, month: month, date: date, start: state.start || 0, count: state.count || 24 });
      return;
    }
    applyGalleryFilters();
  };

  toggleHome = function () {
    const homeDiv = document.getElementById('home');
    const wuweiDiv = document.getElementById('wuwei');

    Promise.resolve()
      .then(function () {
        if ('none' === wuweiDiv.style.display) {
          if (homeDiv) homeDiv.style.display = 'none';
          if (wuweiDiv) wuweiDiv.style.display = 'flex';
        }
        else {
          if (wuweiDiv) wuweiDiv.style.display = 'none';
          // if (wuwei.info && typeof wuwei.info.close === 'function') { wuwei.info.close(); }
          // if (wuwei.edit && typeof wuwei.edit.close === 'function') { wuwei.edit.close(); }
          // if (wuwei.search && typeof wuwei.search.close === 'function') { wuwei.search.close(); }
          // if (wuwei.filter && typeof wuwei.filter.close === 'function') { wuwei.filter.close(); }
          if (homeDiv) { homeDiv.style.display = 'flex' };
          refreshLoginStatus().then(function () {
            const currentUser = state.currentUser || {};
            if (currentUser.user_id) {
              listFile({ year: year, month: month, date: date, start: state.start, count: state.count });
            }
            else {
              populateFile({ r: [], count: 0, count_org: 0, start: 0, days: '', months: [] });
            }
          });
        }
      })
      .catch(function (err) {
        console.log(err);
      });
  };

  accordionFunc = function (id) {
    var x = document.getElementById(id);
    if (!x) { return; }
    if (x.className.indexOf('w3-show') === -1) {
      x.className += ' w3-show';
    }
    else {
      x.className = x.className.replace(' w3-show', '');
    }
  };

  sidebarOpen = function () {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
  };

  sidebarClose = function () {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar && window.matchMedia('(max-width: 960px)').matches) {
      sidebar.style.display = 'none';
    }
    if (overlay) overlay.style.display = 'none';
  };

  searchClicked = function () {
    const searchEl = document.querySelector('#home p.search i.fa-search');
    const timesEl = document.querySelector('#home p.search i.fa-times');
    const searchTextEl = document.querySelector('#home p.search-text');
    if (!searchEl || !timesEl || !searchTextEl) { return; }
    searchTextEl.classList.toggle('hidden');
    searchEl.classList.toggle('hidden');
    timesEl.classList.toggle('hidden');
  };

  annotateNew = function (id) {
    addSelectedResourceToCurrentNote(id, { newNote: true });
  };

  annotateOpen = function (id) {
    addSelectedResourceToCurrentNote(id, { newNote: false });
  };

  updateTop = function (id) {
    const file = fileMap.get(id);
    const previewBody = document.getElementById('homeSelectedPreviewBody');
    const previewEmpty = document.getElementById('homePreviewEmpty');
    const titleNameEl = document.getElementById('homeSelectedTitleName');
    const nameEl = document.getElementById('homeSelectedName');
    const typeEl = document.getElementById('homeSelectedType');
    const dateEl = document.getElementById('homeSelectedDate');
    const sourceEl = document.getElementById('homeSelectedSource');
    const sourceEmptyEl = document.getElementById('homeSelectedSourceEmpty');
    const commentEl = document.getElementById('homeSelectedComment');

    if (!file) {
      selectedResourceId = '';
      setSelectedCard('');
      clearDetailPanel();
      return;
    }
    selectedResourceId = id;

    const seq = String(++previewSeq);
    const value = file.value || {};
    const url = safeDecode(file.url || '');
    const sourceLink = (wuwei.info && typeof wuwei.info.resolveContentHref === 'function')
      ? wuwei.info.resolveContentHref(file)
      : resolveResourceLink(file);
    const annotateKey = url || sourceLink || id;
    const previewMarkup = renderHomePreviewBody(file, {
      variant: 'selected',
      minHeight: 280,
      alt: safeDecode(file.name || file.id || '')
    });

    setSelectedCard(id);
    setDetailActions(id);

    if (titleNameEl) {
      titleNameEl.textContent = safeDecode(file.name || file.label || file.id || '');
      titleNameEl.classList.remove('muted');
    }
    if (nameEl) {
      nameEl.textContent = safeDecode(file.name || file.id || '');
      nameEl.classList.remove('muted');
    }
    if (typeEl) {
      typeEl.textContent = getFileTypeLabel(file);
      typeEl.classList.remove('muted');
    }
    if (dateEl) {
      dateEl.textContent = getFileDateTimeLabel(file);
      dateEl.classList.remove('muted');
    }
    setDescriptionDisplay(file);
    if (sourceEl && sourceEmptyEl) {
      if (sourceLink) {
        sourceEl.textContent = sourceLink;
        sourceEl.href = sourceLink;
        sourceEl.classList.remove('hidden');
        sourceEmptyEl.classList.add('hidden');
      }
      else {
        sourceEl.textContent = '';
        sourceEl.removeAttribute('href');
        sourceEl.classList.add('hidden');
        sourceEmptyEl.textContent = '—';
        sourceEmptyEl.classList.remove('hidden');
      }
    }

    if (previewBody) {
      previewBody.innerHTML = '';
      previewBody.style.display = 'none';
      previewBody.setAttribute('data-preview-seq', seq);

      if (previewMarkup) {
        previewBody.innerHTML = previewMarkup;
        previewBody.style.display = 'block';

        if (wuwei.info && typeof wuwei.info.prepareIframeFallback === 'function') {
          wuwei.info.prepareIframeFallback(previewBody, { seq: seq });
        }
        prepareHomeIframeFallback(previewBody);
      }
    }

    if (previewEmpty) {
      previewEmpty.style.display = previewMarkup ? 'none' : 'flex';
      if (!previewMarkup) {
        previewEmpty.textContent = '';
      }
    }

    if ('webpage' === file.option) {
      if (!state.annotates) state.annotates = {};
      state.annotate = state.annotates[annotateKey] || { annotations: [] };
      if (state.annotate && state.annotate.annotations) {
        state.annotate.annotations.map(function (a) {
          if ('string' === typeof a.range) {
            a.range = JSON.parse(a.range);
          }
          return a;
        });
      }
      state.annotates[annotateKey] = state.annotate;
    }
  };

  function applyDescriptionToFile(file, description) {
    if (!file || !description) { return; }
    const normalized = {
      format: String(description.format || 'plain/text'),
      body: String(description.body || '')
    };
    file.description = normalized;
    if (!file.resource || typeof file.resource !== 'object') {
      file.resource = {};
    }
    file.resource.description = normalized;
    if (!file.value || 'object' !== typeof file.value) {
      file.value = {};
    }
    file.value.description = normalized;
    file.value.comment = normalized.body;
  }

  function updateLocalDescription(file) {
    const index = (files || []).findIndex(function (item) { return item.id === file.id; });
    if (index >= 0) {
      files[index] = file;
    }
    const allIndex = (allFiles || []).findIndex(function (item) { return item.id === file.id; });
    if (allIndex >= 0) {
      allFiles[allIndex] = file;
    }
    fileMap.set(file.id, file);
    rerenderGallery(file.id);
    setDescriptionDisplay(file);
    setDetailActions(file.id);
  }

  editDescription = function (id) {
    const file = fileMap.get(id);
    if (!file) { return; }
    const description = getResourceDescription(file);
    const formatEl = document.getElementById('homeDescriptionFormat');
    const bodyEl = document.getElementById('homeDescriptionBody');
    if (formatEl) {
      formatEl.value = description.format || 'plain/text';
    }
    if (bodyEl) {
      bodyEl.value = description.body || '';
      window.setTimeout(function () { bodyEl.focus(); }, 0);
    }
    setDescriptionEditMode(true);
  };

  cancelDescriptionEdit = function (id) {
    const file = fileMap.get(id);
    if (file) {
      setDescriptionDisplay(file);
    }
    setDescriptionEditMode(false);
  };

  saveDescription = function (id) {
    const file = fileMap.get(id);
    const formatEl = document.getElementById('homeDescriptionFormat');
    const bodyEl = document.getElementById('homeDescriptionBody');
    if (!file || !formatEl || !bodyEl) { return; }

    const previous = getResourceDescription(file);
    const next = {
      format: formatEl.value || 'plain/text',
      body: bodyEl.value || ''
    };
    applyDescriptionToFile(file, next);
    updateLocalDescription(file);

    if (wuwei.resource && typeof wuwei.resource.update === 'function') {
      wuwei.resource.update(file)
        .then(function () {
          if (wuwei.menu && wuwei.menu.snackbar) {
            wuwei.menu.snackbar.open({ type: 'success', message: translate('Saved') });
          }
        })
        .catch(function (err) {
          console.log(err);
          applyDescriptionToFile(file, previous);
          updateLocalDescription(file);
          if (wuwei.menu && wuwei.menu.snackbar) {
            wuwei.menu.snackbar.open({ type: 'error', message: translate('Failed to save comment') });
          }
        });
      return;
    }
  };

  commentFile = function (id) {
    editDescription(id);
  };

  addResource = function (param) {
    if (!param || !param.id) { return; }
    fileMap.set(param.id, param);
    files = files || [];
    files.push(param);
    populateFile({ r: files, count: files.length, count_org: files.length, start: 0 });
  };

  hideResource = function (id) {
    const file = fileMap.get(id);
    const previous = file && file.resource && 'object' === typeof file.resource
      ? JSON.parse(JSON.stringify(file.resource))
      : null;

    if (!file) { return; }
    if (!file.resource || 'object' !== typeof file.resource) {
      file.resource = {};
    }
    file.resource.id = file.resource.id || file.id;
    file.resource.home = Object.assign({}, file.resource.home || {}, {
      hidden: true,
      hiddenAt: new Date().toISOString()
    });

    if (wuwei.resource && typeof wuwei.resource.update === 'function') {
      wuwei.resource.update(file)
        .then(function () {
          removeResource(id);
          if (wuwei.menu && wuwei.menu.snackbar) {
            wuwei.menu.snackbar.open({ type: 'success', message: translate('Hidden from gallery') });
          }
        })
        .catch(function (err) {
          console.log(err);
          if (previous) {
            file.resource = previous;
          }
          if (wuwei.menu && wuwei.menu.snackbar) {
            wuwei.menu.snackbar.open({ type: 'error', message: translate('Failed to update resource') });
          }
        });
      return;
    }
    removeResource(id);
  };

  removeResource = function (id) {
    if (!id) { return; }
    fileMap.delete(id);
    files = (files || []).filter(function (f) { return f.id !== id; });
    populateFile({ r: files, count: files.length, count_org: files.length, start: 0 });
  };

  removeWebpage = function (id) {
    if (!id) { return; }
    removeResource(id);
  };

  sortFile = function (a, b) {
    const aLM = a.value && a.value.lastmodified ? a.value.lastmodified : '';
    const bLM = b.value && b.value.lastmodified ? b.value.lastmodified : '';
    if (aLM < bLM) { return 1; }
    if (aLM > bLM) { return -1; }
    return 0;
  };

  populateFile = function (response) {
    let daysString = response.days;
    days = {};
    if (daysString) {
      let days_ = daysString.split('_');
      if (days_ && days_.length > 0) {
        days_.forEach(function (day) {
          days[day] = true;
        });
      }
    }

    const count = response.count;
    if (count < 0) { return; }

    state.start = response.start;
    state.count = response.count_org;
    allFiles = [];
    files = [];
    fileMap = new Map();

    if (response.r) {
      response.r.forEach(function (file) {
        if (!isRegistrableResourceFile(file)) {
          return;
        }
        const value = file.value || {};
        let filterDate = response.date;
        let lastmodified = value.lastmodified;
        if (!lastmodified && value.file) {
          let rgxDT = /datetime=(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})/;
          let datetime = rgxDT.exec(value.file);
          if (datetime && datetime.length > 4) {
            lastmodified = datetime[1] + '-' + datetime[2] + '-' + datetime[3] + ' ' + datetime[4];
          }
        }
        if (filterDate) {
          let rgx = new RegExp('^' + filterDate);
          if (!lastmodified || !lastmodified.match(rgx)) {
            return;
          }
        }
        const format = file.contenttype;
        let type = 'TextualBody';
        if (format && format.indexOf('image') >= 0) {
          type = 'Image';
        }
        util.appendById(allFiles, {
          id: file.id,
          resource: file.resource,
          label: file.label,
          description: file.description,
          option: file.option,
          contenttype: format,
          name: safeDecode(file.name),
          url: safeDecode(file.url),
          uri: safeDecode(file.uri),
          download_url: safeDecode(file.download_url),
          preview_url: safeDecode(file.preview_url),
          value: value,
          type: type,
          thumbnail: value.thumbnail ? value.thumbnail.uri : ''
        });
      });
    }

    if (wuwei.home.markup && wuwei.home.markup.add_calendar) {
      wuwei.home.markup.add_calendar(year, month, days, months);
      bindCalendarDayEvents();
    }

    setFilterControlValues();
    applyGalleryFilters();
  };

  registerClick = function () {
    const items = document.querySelectorAll('#home #gallery .file-card');
    if (!items) { return; }
    items.forEach(function (item) {
      item.addEventListener('click', function () {
        const idEl = item.querySelector('input.file_id');
        if (!idEl) { return; }
        updateTop(idEl.value);
      });
    });
  };

  listFile = function (param) {
    const today = new Date();
    param = param || {};
    const previousYear = year;
    const previousMonth = month;
    if ('number' === typeof param.year) year = param.year;
    else if (!year) year = today.getFullYear();

    if ('number' === typeof param.month) month = param.month;
    else if (!month) month = today.getMonth() + 1;

    if ('string' === typeof param.date) date = param.date;
    else if (param.date === null || param.date === '') date = '';
    else if ((previousYear && previousYear !== year) || (previousMonth && previousMonth !== month)) {
      date = '';
      dateRangeStart = '';
      dateRangeEnd = '';
    }

    if ('number' === typeof param.start) state.start = param.start;
    if ('number' === typeof param.count) state.count = param.count;

    const currentUser = state.currentUser || {};

    // --- Layout test only -------------------------------------------------
    // When you want to check the home layout without login / backend data,
    // uncomment the next two lines. Comment them out again for real operation.
    // populateDummyContents({ year: year, month: month, date: date, start: state.start, count: state.count });
    // return;

    if (!currentUser.user_id) { return; }

    wuwei.resource.list({
      user_id: currentUser.user_id,
      start: state.start || 0,
      count: state.count || 24,
      year: year,
      month: month,
      date: date
    })
      .then(function (responseText) {
        const response = parseResourceListResponse(responseText);
        months = response.months || months;
        populateFile(response);
      })
      .catch(function (err) {
        console.log(err);
      });
  };

  list = function (start) {
    const galleryEl = document.getElementById('gallery');
    let width = galleryEl ? galleryEl.offsetWidth : window.innerWidth;
    let column_count = Math.max(Math.floor(width / CARD_WIDTH), 1);
    let count = column_count * 3;
    state.start = start;
    state.count = count;
    let param = {
      start: start,
      count: count,
      year: year,
      month: month
    };
    if (date) {
      param.date = date;
    }
    listFile(param);
  };

  findResource = function (term) {
    const galleryEl = document.getElementById('gallery');
    let width = galleryEl ? galleryEl.offsetWidth : window.innerWidth;
    let column_count = Math.max(Math.floor(width / CARD_WIDTH), 1);
    let count = column_count * 3;
    let start = 0;
    const scopeEl = document.getElementById('homeSearchScope');
    searchTerm = String(term || '').trim();
    searchScope = scopeEl && scopeEl.value ? scopeEl.value : searchScope || 'current';
    if (!term) {
      searchTerm = '';
      if (searchScope === 'all') {
        if (!dateRangeStart && !dateRangeEnd && !date) {
          listFile({ year: year, month: month, date: date, start: start, count: count });
          return;
        }
      }
      else {
        applyGalleryFilters();
        return;
      }
    }
    if (searchScope !== 'all') {
      applyGalleryFilters();
      return;
    }
    const request = {
      term: searchTerm,
      start: start,
      count: count,
      scope: searchScope
    };
    if (dateRangeStart || dateRangeEnd) {
      request.start_date = dateRangeStart || dateRangeEnd;
      request.end_date = dateRangeEnd || dateRangeStart;
    }
    else if (date) {
      request.date = date;
    }
    else {
      request.year = year;
      request.month = month;
    }
    wuwei.resource.search(request)
      .then(function (responseText) {
        const response = parseResourceListResponse(responseText);
        populateFile(response);
      })
      .catch(function (err) {
        console.log(err);
      });
  };

  initModule = function () {
    var home = document.getElementById('home');
    var today = new Date();
    if (!home) { return; }
    year = today.getFullYear();
    month = today.getMonth() + 1;
    date = '';
    home.innerHTML = wuwei.home.markup.template();
    home.style.display = 'none';
    modal = new Modal('homeModal', 'homeOverlay');
    clearDetailPanel();
    registerEventSearch();
    registerEventFilters();
    refreshLoginStatus()
      .then(function () {
        const currentUser = state.currentUser || {};
        if (currentUser.user_id) {
          listFile({ year: year, month: month, date: date, start: state.start, count: state.count });
        }
        else {
          populateFile({ r: [], count: 0, count_org: 0, start: 0, days: '', months: [] });
        }
      })
      .catch(function (err) {
        console.log(err);
      });
  };

  return {
    initModule: initModule,
    list: list,
    listFile: listFile,
    populateFile: populateFile,
    accordionFunc: accordionFunc,
    sidebarOpen: sidebarOpen,
    sidebarClose: sidebarClose,
    registerClick: registerClick,
    searchClicked: searchClicked,
    registerEventSearch: registerEventSearch,
    registerEventFilters: registerEventFilters,
    refreshLoginStatus: refreshLoginStatus,
    toggleHome: toggleHome,
    commentFile: commentFile,
    editDescription: editDescription,
    saveDescription: saveDescription,
    cancelDescriptionEdit: cancelDescriptionEdit,
    addResource: addResource,
    hideResource: hideResource,
    removeResource: removeResource,
    removeWebpage: removeWebpage,
    sortFile: sortFile,
    annotateOpen: annotateOpen,
    annotateNew: annotateNew,
    updateTop: updateTop,
    findResource: findResource,
    applyDateFilter: applyDateFilter,
    clearDateFilter: clearDateFilter,
    populateDummyContents: populateDummyContents
  };
})();
// wuwei.home.js revised 2026-04-20
