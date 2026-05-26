/*
 * wuwei.note.v2.js
 *
 * Transitional normalizer for incomplete / quasi-v2 WuWei notes.
 *
 * Responsibility:
 *   - Accept old or incomplete v2-like note JSON.
 *   - Materialize it into the current v2 runtime shape.
 *   - Keep backward compatibility out of wuwei.note.js, wuwei.model.js,
 *     wuwei.draw.js, wuwei.info.js and wuwei.edit.js.
 *
 * Removal plan:
 *   - During migration, include this file and call wuwei.note.v2.normalize()
 *     immediately after JSON parse and before the note is expanded into runtime state.
 *   - Save the normalized note as v2.
 *   - After all notes have been saved as complete v2 notes, remove this file
 *     and the optional call from wuwei.note.js.
 */
(function (root) {
  'use strict';

  var wuwei = root.wuwei = root.wuwei || {};
  wuwei.note = wuwei.note || {};

  var api = wuwei.note.v2 = wuwei.note.v2 || {};

  var VALID_SOURCES = {
    upload: true,
    remote: true,
    generated: true,
    embedded: true
  };

  var VALID_KINDS = {
    document: true,
    html: true,
    video: true,
    image: true,
    audio: true,
    other: true
  };

  var VALID_DOCUMENT_KINDS = {
    pdf: true,
    office: true,
    html: true,
    text: true
  };

  var VALID_VIDEO_KINDS = {
    youtube: true,
    vimeo: true,
    mp4: true,
    webm: true,
    mov: true
  };

  var VALID_AUDIO_KINDS = {
    mp3: true,
    wav: true,
    m4a: true,
    aac: true,
    flac: true,
    oga: true,
    ogg: true
  };

  var VALID_IMAGE_KINDS = {
    png: true,
    jpeg: true,
    jpg: true,
    gif: true,
    webp: true,
    svg: true,
    tif: true,
    tiff: true
  };

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function isArray(value) {
    return Array.isArray(value);
  }

  function asString(value, fallback) {
    if (value === null || value === undefined) {
      return fallback || '';
    }
    return String(value);
  }

  function trim(value) {
    return asString(value).replace(/^\s+|\s+$/g, '');
  }

  function toLower(value) {
    return trim(value).toLowerCase();
  }

  function finiteOr(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function cloneObject(value) {
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function ensureArray(value) {
    return isArray(value) ? value : [];
  }

  function uniquePush(list, value) {
    if (value && list.indexOf(value) < 0) {
      list.push(value);
    }
  }

  function stripQueryAndHash(value) {
    return asString(value).replace(/[?#].*$/, '');
  }

  function getExtension(value) {
    var s = stripQueryAndHash(value).toLowerCase();
    var m = s.match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  function mimeBase(value) {
    return toLower(asString(value).split(';')[0]);
  }

  function isHttpUri(value) {
    return /^https?:\/\//i.test(asString(value));
  }

  function isDataUri(value) {
    return /^data:/i.test(asString(value));
  }

  function isBlobUri(value) {
    return /^blob:/i.test(asString(value));
  }

  function isPdfExt(ext) {
    return ext === 'pdf';
  }

  function isOfficeExt(ext) {
    return /^(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)$/.test(ext);
  }

  function isHtmlExt(ext) {
    return /^(html|htm|xhtml)$/.test(ext);
  }

  function isTextExt(ext) {
    return /^(txt|md|markdown|adoc|asciidoc|csv|tsv|json|xml|yaml|yml)$/.test(ext);
  }

  function isImageExt(ext) {
    return /^(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(ext);
  }

  function isVideoExt(ext) {
    return /^(mp4|webm|mov|m4v|ogv)$/.test(ext);
  }

  function isAudioExt(ext) {
    return /^(mp3|m4a|wav|ogg|oga|aac|flac)$/.test(ext);
  }

  function normalizeDescription(desc) {
    if (typeof desc === 'string') {
      return { format: 'plain', body: desc };
    }
    if (!isObject(desc)) {
      return { format: 'plain', body: '' };
    }
    desc.format = desc.format || 'plain';
    if (desc.format === 'plain/text') {
      desc.format = 'plain';
    }
    if (desc.body === undefined || desc.body === null) {
      desc.body = '';
    }
    return desc;
  }

  function normalizeLineStyle(line, node) {
    line = isObject(line) ? line : {};
    line.kind = line.kind || 'SOLID';
    line.color = line.color || node.outline || '#d7d8d9';
    line.width = finiteOr(line.width, finiteOr(node.outlineWidth, 1));
    return line;
  }

  function normalizeFontStyle(font, node) {
    var oldFont = isObject(node.font) ? node.font : {};
    font = isObject(font) ? font : {};
    font.family = font.family || oldFont.family || 'sans-serif';
    font.size = font.size || oldFont.size || 14;
    font.color = font.color || oldFont.color || '#303030';
    if (!font.align) {
      if (oldFont['text-anchor'] === 'start') {
        font.align = 'left';
      } else if (oldFont['text-anchor'] === 'end') {
        font.align = 'right';
      } else {
        font.align = 'center';
      }
    }
    return font;
  }

  function textAnchorFromAlign(align) {
    if (align === 'left') {
      return 'start';
    }
    if (align === 'right') {
      return 'end';
    }
    return 'middle';
  }

  function defineRuntimeField(record, name, value) {
    if (!record || typeof record !== 'object') {
      return;
    }
    try {
      Object.defineProperty(record, name, {
        value: value,
        writable: true,
        configurable: true,
        enumerable: false
      });
    } catch (e) {
      record[name] = value;
    }
  }

  function expandNodeRuntimeStyle(node) {
    if (wuwei && wuwei.style &&
        typeof wuwei.style.expandNodeRuntimeStyle === 'function') {
      return wuwei.style.expandNodeRuntimeStyle(node);
    }

    var style, line, font, runtimeFont;

    if (!node || typeof node !== 'object') {
      return node;
    }

    style = isObject(node.style) ? node.style : {};
    line = isObject(style.line) ? style.line : {};
    font = isObject(style.font) ? style.font : {};

    runtimeFont = {
      family: font.family || 'sans-serif',
      size: finiteOr(font.size, 14),
      color: font.color || '#303030',
      'text-anchor': textAnchorFromAlign(font.align || 'center')
    };

    defineRuntimeField(node, 'color', style.fill || '#FFFFF0');
    defineRuntimeField(node, 'outline', line.color || '#d7d8d9');
    defineRuntimeField(node, 'outlineWidth', finiteOr(line.width, 1));
    defineRuntimeField(node, 'font', runtimeFont);

    return node;
  }

  function stripNodeRuntimeStyleFields(node) {
    if (wuwei && wuwei.style &&
        typeof wuwei.style.stripNodeRuntimeStyleFields === 'function') {
      return wuwei.style.stripNodeRuntimeStyleFields(node);
    }
    if (!node || typeof node !== 'object') {
      return node;
    }
    delete node.color;
    delete node.outline;
    delete node.outlineWidth;
    delete node.font;
    return node;
  }

  function normalizeLabelStyle(label) {
    label = isObject(label) ? label : {};
    label.lines = finiteOr(label.lines, 1);
    if (label.width !== undefined) {
      label.width = finiteOr(label.width, 200);
    }
    if (!isObject(label.offset)) {
      label.offset = { x: 0, y: 0 };
    } else {
      label.offset.x = finiteOr(label.offset.x, 0);
      label.offset.y = finiteOr(label.offset.y, 0);
    }
    return label;
  }

  function normalizeStyle(node) {
    if (wuwei && wuwei.style &&
        typeof wuwei.style.normalizeNodeStyle === 'function') {
      return wuwei.style.normalizeNodeStyle(node);
    }

    node.style = isObject(node.style) ? node.style : {};
    node.style.fill = node.style.fill || node.color || '#FFFFF0';
    node.style.line = normalizeLineStyle(node.style.line, node);
    node.style.font = normalizeFontStyle(node.style.font, node);
    if (node.type === 'Memo') {
      delete node.style.label;
    } else {
      node.style.label = normalizeLabelStyle(node.style.label);
    }

    /*
     * Runtime drawing fields are expanded from style for wuwei.draw
     * readability/performance.  They are intentionally non-enumerable so
     * JSON serialization and util.clone() do not persist duplicate style data.
     */
    expandNodeRuntimeStyle(node);

    return node.style;
  }

  function getFiles(resource) {
    resource.storage = isObject(resource.storage) ? resource.storage : {};
    resource.storage.files = ensureArray(resource.storage.files);
    return resource.storage.files;
  }

  function findFile(resource, role) {
    var files = getFiles(resource);
    var i;
    for (i = 0; i < files.length; i += 1) {
      if (files[i] && files[i].role === role) {
        return files[i];
      }
    }
    return null;
  }

  function findFirstFile(resource, roles) {
    var i;
    var file;
    for (i = 0; i < roles.length; i += 1) {
      file = findFile(resource, roles[i]);
      if (file) {
        return file;
      }
    }
    return null;
  }

  function legacyUploadPath(resource) {
    var date = trim(resource && resource.date);
    var id = trim(resource && resource.id);
    var file = trim(resource && resource.file);
    if (date && id && file) {
      return date.replace(/\\/g, '/') + '/' + id + '/' + file;
    }
    return '';
  }

  function getOriginal(resource) {
    return resource && resource.original && typeof resource.original === 'object' ? resource.original : {};
  }

  function getOriginalUrl(resource) {
    var original = getOriginal(resource);
    return trim(original.url || original.canonicalUrl || resource && (resource.uri || resource.canonicalUri) || '');
  }

  function getBestPath(resource) {
    var file = findFirstFile(resource, ['original', 'preview', 'pdf-preview', 'body', 'thumbnail']);
    return file && file.path || getOriginalUrl(resource) || legacyUploadPath(resource) || resource.file || '';
  }

  function getOriginalPath(resource) {
    var file = findFile(resource, 'original');
    return file && file.path || '';
  }

  function getOriginalMime(resource) {
    var file = findFile(resource, 'original');
    return mimeBase(file && file.mimeType || resource.mimeType || '');
  }

  function getBestMime(resource) {
    var file = findFirstFile(resource, ['original', 'preview', 'pdf-preview', 'body']);
    return mimeBase(file && file.mimeType || resource.mimeType || '');
  }

  function inferSource(resource, oldKind) {
    var uri;

    if (VALID_SOURCES[resource.source]) {
      return resource.source;
    }
    if (oldKind === 'upload' || findFile(resource, 'original')) {
      return 'upload';
    }

    uri = getOriginalUrl(resource);
    if (isHttpUri(uri)) {
      return 'remote';
    }
    if (isDataUri(uri) || isBlobUri(uri)) {
      return 'embedded';
    }
    if (getFiles(resource).length > 0) {
      return 'generated';
    }
    return 'remote';
  }

  function inferKind(resource, oldKind, source) {
    var path;
    var ext;
    var mime;
    var uri;

    if (VALID_KINDS[resource.kind]) {
      return resource.kind;
    }

    if (/^(web|webpage|html)$/.test(oldKind)) {
      return 'document';
    }
    if (/^(youtube|vimeo|mp4|video)$/.test(oldKind)) {
      return 'video';
    }
    if (/^(mp3|audio)$/.test(oldKind)) {
      return 'audio';
    }
    if (/^(image|picture|photo)$/.test(oldKind)) {
      return 'image';
    }

    path = getBestPath(resource);
    ext = getExtension(path);
    mime = getBestMime(resource);
    uri = getOriginalUrl(resource);

    if (mime.indexOf('image/') === 0 || isImageExt(ext)) {
      return 'image';
    }
    if (mime.indexOf('video/') === 0 || isVideoExt(ext) || /youtu\.be|youtube\.com|vimeo\.com/i.test(uri)) {
      return 'video';
    }
    if (mime.indexOf('audio/') === 0 || isAudioExt(ext)) {
      return 'audio';
    }
    if (mime.indexOf('application/pdf') === 0 || isPdfExt(ext) || isOfficeExt(ext) || isHtmlExt(ext) || isTextExt(ext)) {
      return 'document';
    }
    if (source === 'remote' && isHttpUri(uri)) {
      return 'document';
    }
    return 'other';
  }

  function inferDocumentKind(resource, oldKind, source) {
    var originalPath;
    var originalExt;
    var originalMime;
    var bestPath;
    var bestExt;
    var bestMime;
    var uri;

    if (VALID_DOCUMENT_KINDS[resource.documentKind]) {
      return resource.documentKind;
    }

    if (/^(web|webpage|html)$/.test(oldKind)) {
      return 'html';
    }

    originalPath = getOriginalPath(resource);
    originalExt = getExtension(originalPath);
    originalMime = getOriginalMime(resource);

    if (isOfficeExt(originalExt) ||
        originalMime.indexOf('officedocument') >= 0 ||
        originalMime.indexOf('msword') >= 0 ||
        originalMime.indexOf('ms-powerpoint') >= 0 ||
        originalMime.indexOf('ms-excel') >= 0) {
      return 'office';
    }
    if (isPdfExt(originalExt) || originalMime.indexOf('application/pdf') === 0) {
      return 'pdf';
    }
    if (isHtmlExt(originalExt) || originalMime.indexOf('text/html') === 0) {
      return 'html';
    }

    uri = getOriginalUrl(resource);
    if (source === 'remote' && isHttpUri(uri)) {
      return 'html';
    }

    bestPath = getBestPath(resource);
    bestExt = getExtension(bestPath);
    bestMime = getBestMime(resource);

    if (isPdfExt(bestExt) || bestMime.indexOf('application/pdf') === 0) {
      return 'pdf';
    }
    if (isHtmlExt(bestExt) || bestMime.indexOf('text/html') === 0) {
      return 'html';
    }
    if (isTextExt(bestExt) || bestMime.indexOf('text/') === 0) {
      return 'text';
    }
    return 'text';
  }

  function inferVideoKind(resource) {
    var uri = getOriginalUrl(resource);
    var ext = getExtension(uri || getBestPath(resource));

    if (VALID_VIDEO_KINDS[toLower(resource.videoKind)]) {
      return toLower(resource.videoKind);
    }
    if (/youtube\.com|youtu\.be/i.test(uri)) {
      return 'youtube';
    }
    if (/vimeo\.com/i.test(uri)) {
      return 'vimeo';
    }
    if (isVideoExt(ext)) {
      return ext === 'mov' ? 'mov' : (ext === 'webm' ? 'webm' : 'mp4');
    }
    return '';
  }

  function inferAudioKind(resource) {
    var ext = getExtension(getOriginalUrl(resource) || getBestPath(resource));
    var mime = getBestMime(resource);

    if (VALID_AUDIO_KINDS[toLower(resource.audioKind)]) {
      return toLower(resource.audioKind);
    }
    if (VALID_AUDIO_KINDS[ext]) {
      return ext;
    }
    if (mime.indexOf('audio/') === 0) {
      if (mime.indexOf('wav') >= 0) { return 'wav'; }
      if (mime.indexOf('mp4') >= 0 || mime.indexOf('m4a') >= 0) { return 'm4a'; }
      if (mime.indexOf('aac') >= 0) { return 'aac'; }
      if (mime.indexOf('flac') >= 0) { return 'flac'; }
      if (mime.indexOf('ogg') >= 0) { return 'ogg'; }
      return 'mp3';
    }
    return '';
  }

  function inferImageKind(resource) {
    var ext = getExtension(getOriginalUrl(resource) || getBestPath(resource));
    var mime = getBestMime(resource);

    if (VALID_IMAGE_KINDS[toLower(resource.imageKind)]) {
      return toLower(resource.imageKind) === 'jpg' ? 'jpeg' : toLower(resource.imageKind);
    }
    if (VALID_IMAGE_KINDS[ext]) {
      return ext === 'jpg' ? 'jpeg' : ext;
    }
    if (mime.indexOf('image/') === 0) {
      if (mime.indexOf('jpeg') >= 0 || mime.indexOf('jpg') >= 0) { return 'jpeg'; }
      if (mime.indexOf('png') >= 0) { return 'png'; }
      if (mime.indexOf('gif') >= 0) { return 'gif'; }
      if (mime.indexOf('webp') >= 0) { return 'webp'; }
      if (mime.indexOf('svg') >= 0) { return 'svg'; }
      if (mime.indexOf('tiff') >= 0) { return 'tiff'; }
    }
    return '';
  }

  function noteCurrentUserId() {
    var common = wuwei.common || {};
    var state = common.state || {};
    var user = state.currentUser || {};
    return trim(user.user_id || '');
  }

  function resourceOwnerId(resource) {
    var audit = isObject(resource.audit) ? resource.audit : {};
    var rights = isObject(resource.rights) ? resource.rights : {};
    return trim(noteCurrentUserId() || audit.createdBy || audit.owner || rights.owner);
  }

  function extractLoadFileParam(value, name) {
    var text = trim(value);
    var re, m;
    if (!text || text.indexOf('?') < 0) {
      return '';
    }
    try {
      return new URL(text, root.location && root.location.href ? root.location.href : undefined).searchParams.get(name) || '';
    }
    catch (e) {
      re = new RegExp('(?:^|[?&])' + name + '=([^&]*)');
      m = text.match(re);
      if (m) {
        try { return decodeURIComponent(m[1]); } catch (e2) { return m[1]; }
      }
    }
    return '';
  }

  function logicalUploadPathFromPhysical(path) {
    /* v2 keeps the upload bundle UUID in the logical path:
     * YYYY/MM/DD/file_uuid/filename.  Legacy YYYY/MM/filename is also kept. */
    return trim(path).replace(/\\/g, '/');
  }

  function normalizeLogicalPath(path, area, resource) {
    var text = trim(path).replace(/\\/g, '/');
    var uid = resourceOwnerId(resource);
    var m;

    if (!text || isHttpUri(text) && text.indexOf('/wu_wei2/') < 0) {
      return text;
    }

    m = extractLoadFileParam(text, 'path');
    if (m) {
      text = m.replace(/\\/g, '/').replace(/^\/+/, '');
    }
    else {
      text = text.replace(/[?#].*$/, '');
      m = text.indexOf('/wu_wei2/');
      if (m >= 0) {
        text = text.slice(m + '/wu_wei2/'.length);
      }
      text = text.replace(/^\/+/, '');
      if (text.indexOf('data/') === 0) {
        text = text.slice('data/'.length);
      }
      if (uid && text.indexOf(uid + '/') === 0) {
        text = text.slice(uid.length + 1);
      }
      m = text.match(/^[^/]+\/(upload|resource|note|thumbnail|content)\/(.+)$/);
      if (m) {
        text = m[1] + '/' + m[2];
      }
      m = text.match(/^(upload|resource|note|thumbnail|content)\/(.+)$/);
      if (m) {
        text = m[2];
      }
    }
    if (area === 'upload') {
      text = logicalUploadPathFromPhysical(text);
    }
    return text.replace(/^\/+/, '');
  }

  function deriveDirName(rawPath, area, resource) {
    var raw = trim(rawPath).replace(/\\/g, '/').replace(/[?#].*$/, '');
    var uid = resourceOwnerId(resource);
    var m, text;

    if (!raw || isHttpUri(raw) && raw.indexOf('/wu_wei2/') < 0) {
      return '';
    }
    text = raw;
    m = text.indexOf('/wu_wei2/');
    if (m >= 0) {
      text = text.slice(m + '/wu_wei2/'.length);
    }
    text = text.replace(/^\/+/, '');
    if (text.indexOf('data/') === 0) {
      m = text.match(/^(data\/[^/]+\/(?:upload|resource|note|thumbnail|content)\/.+)\/[^/]+$/);
      return m ? m[1] : '';
    }
    area = toLower(area || 'upload');

    if (uid && /^(upload|resource|note|thumbnail|content)$/.test(area)) {
      if (area === 'upload') {
        m = text.match(/^(\d{4}\/\d{2}\/\d{2}\/[^/]+)\/[^/]+$/);
        if (m) {
          return 'data/' + uid + '/upload/' + m[1];
        }
      }

      /*
       * v0 / legacy content resources use YYYY/MM/filename.  Keep this path
       * form unchanged and derive its directory from the same two-segment
       * base; do not complement it to YYYY/MM/01/....
       */
      m = text.match(/^(\d{4}\/\d{2})\/[^/]+$/);
      if (m) {
        return 'data/' + uid + '/' + area + '/' + m[1];
      }
    }
    return '';
  }

  function normalizeStorage(resource, source) {
    var storage = resource.storage;
    var files;
    var i;

    storage = isObject(storage) ? storage : {};
    files = ensureArray(storage.files);
    if (source === 'upload' && !files.length && legacyUploadPath(resource)) {
      files = [{
        role: 'original',
        area: 'upload',
        path: legacyUploadPath(resource),
        file_name: trim(resource.file),
        mimeType: resource.mimeType || ''
      }];
    }
    storage.files = files.map(function (item) {
      var out = isObject(item) ? cloneObject(item) : {};
      var role = toLower(out.role || 'original');
      var area = toLower(out.area || storage.area || (source === 'upload' ? 'upload' : 'resource'));
      var rawPath = out.path || out.sourcePath || out.uri || out.url || getOriginalUrl(resource) || ''; 
      if (role === 'pdf-preview' || role === 'pdf') {
        role = 'preview';
      }
      out.role = role || 'original';
      out.area = area || 'upload';
      out.path = normalizeLogicalPath(rawPath, out.area, resource);
      out.dir_name = out.dir_name || deriveDirName(rawPath, out.area, resource);
      if (!out.file_name) {
        if (out.dir_name && rawPath) {
          out.file_name = stripQueryAndHash(rawPath).replace(/\\/g, '/').split('/').pop();
        }
        else if (out.role === 'preview' || out.role === 'pdf-preview') {
          out.file_name = 'preview.pdf';
        }
        else if (out.role === 'thumbnail') {
          out.file_name = 'thumbnail.jpg';
        }
      }
      if (out.sourcePath) {
        out.sourcePath = normalizeLogicalPath(out.sourcePath, out.sourceArea || out.area, resource);
      }
      return out;
    }).filter(function (item) {
      return item.path || item.dir_name || item.file_name;
    });

    if (source === 'upload') {
      resource.original = isObject(resource.original) ? resource.original : {};
      resource.original.type = resource.original.type || 'upload';
      resource.original.storageRole = resource.original.storageRole || 'original';
    }

    storage.managed = storage.managed === undefined ? source === 'upload' || source === 'generated' : !!storage.managed;
    storage.copyPolicy = storage.copyPolicy || (source === 'remote' ? 'metadataOnly' : 'reference');
    resource.storage = storage;

    return storage;
  }

  function normalizeViewer(resource) {
    var viewer = isObject(resource.viewer) ? resource.viewer : {};

    viewer.supportedModes = ensureArray(viewer.supportedModes);
    if (viewer.supportedModes.length === 0) {
      viewer.supportedModes = ['infoPane', 'newTab', 'newWindow', 'download'];
    }
    viewer.defaultMode = viewer.defaultMode || 'infoPane';
    viewer.embed = isObject(viewer.embed) ? viewer.embed : {};
    if (viewer.embed.uri) {
      viewer.embed.uri = normalizeLogicalPath(viewer.embed.uri, 'upload', resource);
    }
    if (viewer.embed.sourceRole === 'pdf-preview' || viewer.embed.sourceRole === 'pdf') {
      viewer.embed.sourceRole = 'preview';
    }
    if (viewer.embed.thumbnailUri) {
      viewer.embed.thumbnailUri = normalizeLogicalPath(viewer.embed.thumbnailUri, 'thumbnail', resource);
    }
    viewer.thumbnailUri = normalizeLogicalPath(
      viewer.thumbnailUri || resource.thumbnailUri || viewer.embed.thumbnailUri || '',
      'thumbnail',
      resource
    );
    resource.viewer = viewer;

    return viewer;
  }

  function normalizeViewpoint(resource) {
    var viewpoint = isObject(resource.viewpoint) ? resource.viewpoint : (isObject(resource.contents) ? resource.contents : {});
    delete resource.contents;
    var preview;
    var pageCount;
    var firstPageNumber;
    var media;

    if (resource.kind !== 'document') {
      if (Object.keys(viewpoint).length > 0) {
        resource.viewpoint = viewpoint;
      }
      return viewpoint;
    }

    viewpoint.axis = isObject(viewpoint.axis) ? viewpoint.axis : {};
    media = isObject(resource.media) ? resource.media : {};

    if (resource.documentKind === 'html') {
      viewpoint.type = 'html';
      viewpoint.axis.unit = 'anchor';
      viewpoint.axis.nodeType = 'pageMarker';
      viewpoint.pageCount = finiteOr(viewpoint.pageCount, 0);
      viewpoint.hasPageCount = false;
      viewpoint.sourceRole = viewpoint.sourceRole || 'original';
    } else if (resource.documentKind === 'office') {
      preview = findFirstFile(resource, ['preview', 'pdf-preview']);
      viewpoint.type = 'pdf';
      viewpoint.axis.unit = 'page';
      viewpoint.axis.nodeType = 'page';
      if (viewpoint.sourceRole === 'pdf-preview' || viewpoint.sourceRole === 'pdf') {
        viewpoint.sourceRole = 'preview';
      }
      viewpoint.sourceRole = viewpoint.sourceRole || (preview ? 'preview' : 'original');
      pageCount = finiteOr(media.pageCount, finiteOr(viewpoint.pageCount, 0));
      viewpoint.pageCount = pageCount;
      viewpoint.hasPageCount = pageCount > 0;
      firstPageNumber = finiteOr(viewpoint.firstPageNumber, 0);
      if (!(firstPageNumber >= 1)) {
        firstPageNumber = finiteOr(viewpoint.pageOffset, 0) + 1;
      }
      firstPageNumber = Math.max(1, Math.floor(firstPageNumber));
      viewpoint.firstPageNumber = firstPageNumber;
      viewpoint.pageOffset = firstPageNumber - 1;
    } else if (resource.documentKind === 'pdf') {
      viewpoint.type = 'pdf';
      viewpoint.axis.unit = 'page';
      viewpoint.axis.nodeType = 'page';
      viewpoint.sourceRole = viewpoint.sourceRole || 'original';
      pageCount = finiteOr(media.pageCount, finiteOr(viewpoint.pageCount, 0));
      viewpoint.pageCount = pageCount;
      viewpoint.hasPageCount = pageCount > 0;
      firstPageNumber = finiteOr(viewpoint.firstPageNumber, 0);
      if (!(firstPageNumber >= 1)) {
        firstPageNumber = finiteOr(viewpoint.pageOffset, 0) + 1;
      }
      firstPageNumber = Math.max(1, Math.floor(firstPageNumber));
      viewpoint.firstPageNumber = firstPageNumber;
      viewpoint.pageOffset = firstPageNumber - 1;
    } else {
      viewpoint.type = 'text';
      viewpoint.axis.unit = viewpoint.axis.unit || 'anchor';
      viewpoint.axis.nodeType = viewpoint.axis.nodeType || 'pageMarker';
      viewpoint.pageCount = finiteOr(viewpoint.pageCount, 0);
      viewpoint.hasPageCount = false;
      viewpoint.sourceRole = viewpoint.sourceRole || 'original';
    }

    Object.keys(viewpoint).forEach(function (key) {
      if (!{
        type: true,
        axis: true,
        pageCount: true,
        hasPageCount: true,
        sourceRole: true,
        firstPageNumber: true,
        pageOffset: true
      }[key]) {
        delete viewpoint[key];
      }
    });

    resource.viewpoint = viewpoint;
    return viewpoint;
  }

  function normalizeResource(resource, node) {
    var oldKind;
    var source;
    var kind;
    var documentKind;

    resource = isObject(resource) ? resource : {};
    oldKind = toLower(resource.kind);

    resource.id = resource.id || node.resourceId || node.id;
    if (!isObject(resource.original)) {
      resource.original = {};
    }
    if (!resource.original.url && !resource.original.canonicalUrl) {
      resource.original.url = resource.uri || resource.url || node.uri || node.url || node.download_url || resource.canonicalUri || '';
      resource.original.canonicalUrl = resource.canonicalUri || resource.original.url || '';
    }
    resource.mimeType = resource.mimeType || '';
    resource.thumbnailUri = normalizeLogicalPath(resource.thumbnailUri || '', 'thumbnail', resource);

    source = inferSource(resource, oldKind);
    resource.source = source;
    resource.original.type = resource.original.type || (source === 'upload' ? 'upload' : (source === 'remote' ? 'remote' : source));
    if (source === 'remote') {
      resource.original.accessedAt = resource.original.accessedAt || '';
      resource.original.identifiers = Array.isArray(resource.original.identifiers) ? resource.original.identifiers : [];
    }

    kind = inferKind(resource, oldKind, source);
    resource.kind = kind;

    if (kind === 'document') {
      documentKind = inferDocumentKind(resource, oldKind, source);
      resource.documentKind = documentKind;
      resource.videoKind = '';
      resource.audioKind = '';
      resource.imageKind = '';
    } else if (kind === 'video') {
      resource.documentKind = '';
      resource.videoKind = inferVideoKind(resource);
      resource.audioKind = '';
      resource.imageKind = '';
    } else if (kind === 'audio') {
      resource.documentKind = '';
      resource.videoKind = '';
      resource.audioKind = inferAudioKind(resource);
      resource.imageKind = '';
    } else if (kind === 'image') {
      resource.documentKind = '';
      resource.videoKind = '';
      resource.audioKind = '';
      resource.imageKind = inferImageKind(resource);
    } else {
      resource.documentKind = '';
      resource.videoKind = '';
      resource.audioKind = '';
      resource.imageKind = '';
    }

    if (resource.media && typeof resource.media === 'object') {
      resource.media.kind = kind;
      resource.media.mimeType = resource.media.mimeType || resource.mimeType || '';
    }

    normalizeStorage(resource, source);
    normalizeViewer(resource);
    normalizeViewpoint(resource);

    resource.rights = isObject(resource.rights) ? resource.rights : {
      owner: '',
      copyright: '',
      license: '',
      attribution: ''
    };
    resource.audit = isObject(resource.audit) ? resource.audit : {};
    delete resource.title;
    delete resource.uri;
    delete resource.canonicalUri;

    return resource;
  }

  function normalizeAnchor(value) {
    value = trim(value);
    if (!value) {
      return '';
    }
    return value.charAt(0) === '#' ? value : '#' + value;
  }

  function isLegacyContentsName(value) {
    return trim(value).toLowerCase() === 'contents';
  }

  function normalizeLegacyContentsName(value, fallback) {
    if (value === undefined || value === null || trim(value) === '') {
      return fallback || '';
    }
    return isLegacyContentsName(value) ? 'Viewpoint' : String(value);
  }

  function isLegacyContentsGroupType(value) {
    value = trim(value);
    return value === 'contents' || value === 'contentsGroup';
  }

  function normalizeLegacyContentsToken(value) {
    switch (value) {
    case 'contents':
      return 'viewpoint';
    case 'contentsGroup':
      return 'viewpointGroup';
    case 'contentsAxis':
      return 'viewpointAxis';
    case 'contents-axis':
      return 'viewpoint-axis';
    case 'contents-entry':
      return 'viewpoint-entry';
    case 'contents-first-entry':
      return 'viewpoint-first-entry';
    case 'contents-representative':
      return 'viewpoint-representative';
    case 'contents-page':
      return 'viewpoint-page';
    default:
      return value;
    }
  }

  function normalizeLegacyContentsNode(node) {
    if (!isObject(node)) {
      return node;
    }
    if (typeof node.topicKind === 'string') {
      node.topicKind = normalizeLegacyContentsToken(node.topicKind);
    }
    if (typeof node.representativeType === 'string') {
      node.representativeType = normalizeLegacyContentsToken(node.representativeType);
      if (node.representativeType === 'viewpointGroup') {
        node.representativeType = 'viewpoint';
      }
    }
    if (typeof node.axisRole === 'string') {
      node.axisRole = normalizeLegacyContentsToken(node.axisRole);
      if (node.axisRole === 'viewpoint-entry') {
        node.axisRole = 'entry';
      }
    }
    // Preserve node.label. Labels are user-defined display information and must not be
    // rewritten by v2 normalization, even when the old label text is "Contents".
    return node;
  }

  function normalizeLegacyContentsLink(link) {
    if (!isObject(link)) {
      return link;
    }
    ['relation', 'role', 'linkType', 'groupType', 'topicKind', 'representativeType'].forEach(function (key) {
      if (typeof link[key] === 'string') {
        link[key] = normalizeLegacyContentsToken(link[key]);
        if (key === 'representativeType' && link[key] === 'viewpointGroup') {
          link[key] = 'viewpoint';
        }
      }
    });
    // Preserve link.label. Labels are user-defined display information.
    return link;
  }

  function normalizePageMarker(node) {
    normalizeLegacyContentsNode(node);
    node.type = 'PageMarker';
    node.topicKind = node.topicKind || 'viewpoint-page';
    node.groupRef = node.groupRef || node.viewpointRef || '';
    node.viewpointRef = node.viewpointRef || node.groupRef || '';
    node.documentRef = node.documentRef || node.mediaRef || '';
    node.mediaRef = node.mediaRef || node.documentRef || '';
    node.axisRole = node.axisRole || 'entry';
    node.axisRole = normalizeLegacyContentsToken(node.axisRole);
    if (node.axisRole === 'viewpoint-entry') {
      node.axisRole = 'entry';
    }
    node.pageNumber = finiteOr(node.pageNumber, 0);

    node.anchorHref = normalizeAnchor(node.anchorHref || node.htmlAnchorHref || '');
    node.htmlAnchorHref = normalizeAnchor(node.htmlAnchorHref || node.anchorHref || '');

    if (!isObject(node.size)) {
      node.size = { radius: 18 };
    } else if (node.size.radius === undefined && node.shape === 'CIRCLE') {
      node.size.radius = 18;
    }

    normalizeDescription(node.description);
    normalizeStyle(node);
    return node;
  }

  function normalizeNode(node) {
    node = isObject(node) ? node : {};
    node.id = node.id || ('_' + Math.random().toString(36).slice(2));
    node.type = node.type || 'Topic';
    node.x = finiteOr(node.x, 0);
    node.y = finiteOr(node.y, 0);
    node.visible = node.visible === undefined ? true : !!node.visible;
    if (node.type === 'Memo') {
      delete node.label;
    } else {
      node.label = node.label === undefined || node.label === null ? '' : String(node.label);
    }
    node.description = normalizeDescription(node.description);
    node.audit = isObject(node.audit) ? node.audit : {};
    normalizeLegacyContentsNode(node);

    normalizeStyle(node);

    if (node.type === 'Content') {
      node.resource = normalizeResource(node.resource, node);
      node.resourceView = isObject(node.resourceView) ? node.resourceView : { mode: 'default' };
      node.resourceView.mode = node.resourceView.mode || 'default';
    } else if (node.type === 'PageMarker' || node.topicKind === 'viewpoint-page') {
      normalizePageMarker(node);
    }

    return node;
  }

  function makeNodeMap(page) {
    var map = {};
    var nodes = ensureArray(page.nodes);
    var i;

    for (i = 0; i < nodes.length; i += 1) {
      if (nodes[i] && nodes[i].id) {
        map[nodes[i].id] = nodes[i];
      }
    }
    return map;
  }

  function normalizeSpine(spine) {
    spine = isObject(spine) ? spine : {};
    spine.kind = spine.kind || 'SOLID';
    spine.color = spine.color || '#4c6b8a';
    spine.width = finiteOr(spine.width, 4);
    spine.padding = finiteOr(spine.padding, 12);
    spine.paddingTop = finiteOr(spine.paddingTop, spine.padding);
    spine.paddingRight = finiteOr(spine.paddingRight, spine.padding);
    spine.paddingBottom = finiteOr(spine.paddingBottom, spine.padding);
    spine.paddingLeft = finiteOr(spine.paddingLeft, spine.padding);
    spine.visible = spine.visible === undefined ? true : !!spine.visible;
    return spine;
  }

  function normalizeMember(member, order) {
    if (typeof member === 'string') {
      member = { nodeId: member };
    }
    member = isObject(member) ? member : {};
    member.nodeId = member.nodeId || member.id || '';
    member.order = finiteOr(member.order, order);
    member.role = member.role || 'member';
    return member;
  }

  function sortByOrderThenPosition(entries, nodeMap, orientation) {
    entries.sort(function (a, b) {
      var ao = finiteOr(a.order, 0);
      var bo = finiteOr(b.order, 0);
      var an;
      var bn;

      if (ao !== bo) {
        return ao - bo;
      }
      an = nodeMap[a.nodeId] || {};
      bn = nodeMap[b.nodeId] || {};
      if (orientation === 'vertical') {
        return finiteOr(an.y, 0) - finiteOr(bn.y, 0);
      }
      return finiteOr(an.x, 0) - finiteOr(bn.x, 0);
    });
  }

  function addMemberIfMissing(members, nodeId) {
    var i;
    if (!nodeId) {
      return;
    }
    for (i = 0; i < members.length; i += 1) {
      if (members[i] && members[i].nodeId === nodeId) {
        return;
      }
    }
    members.push({ nodeId: nodeId, order: members.length + 1, role: 'member' });
  }

  function getContentDocumentKind(contentNode) {
    var resource = contentNode && contentNode.resource || {};
    var kind = toLower(resource.kind);
    var documentKind = toLower(resource.documentKind);
    var viewpointData = resource.viewpoint || resource.contents || {};
    var viewpointType = toLower(viewpointData.type);

    if (documentKind) { return documentKind; }
    if (viewpointType === 'html' || /^(web|webpage|html)$/.test(kind)) {
      return 'html';
    }
    return '';
  }

  function getContentPageCount(contentNode) {
    var resource = contentNode && contentNode.resource || {};
    var viewpoint = resource.viewpoint || resource.contents || {};
    return finiteOr(viewpoint.pageCount, 0);
  }

  function normalizeViewpointEntry(entry, group, nodeMap, order, documentKind) {
    var marker;

    entry = isObject(entry) ? entry : {};
    entry.role = normalizeLegacyContentsToken(entry.role || 'entry');
    if (entry.role === 'viewpoint-entry') {
      entry.role = 'entry';
    }
    entry.nodeId = entry.nodeId || entry.id || '';
    entry.order = finiteOr(entry.order, order);
    entry.comment = entry.comment || '';

    marker = nodeMap[entry.nodeId];
    if (marker) {
      normalizeLegacyContentsNode(marker);
      marker.type = 'PageMarker';
      marker.topicKind = marker.topicKind || 'viewpoint-page';
      marker.groupRef = marker.groupRef || group.id;
      marker.viewpointRef = marker.viewpointRef || marker.groupRef || group.id;
      marker.documentRef = marker.documentRef || group.documentRef || group.mediaRef || '';
      marker.mediaRef = marker.mediaRef || marker.documentRef || '';
      marker.axisRole = normalizeLegacyContentsToken(marker.axisRole || 'entry');
      if (marker.axisRole === 'viewpoint-entry') {
        marker.axisRole = 'entry';
      }

      if (entry.pageNumber === undefined && marker.pageNumber !== undefined) {
        entry.pageNumber = marker.pageNumber;
      }
      if (marker.pageNumber === undefined && entry.pageNumber !== undefined) {
        marker.pageNumber = entry.pageNumber;
      }
      if (!isFinite(Number(marker.pageNumber)) || Number(marker.pageNumber) <= 0) {
        marker.pageNumber = finiteOr(entry.pageNumber, order);
      }
      if (!isFinite(Number(entry.pageNumber)) || Number(entry.pageNumber) <= 0) {
        entry.pageNumber = finiteOr(marker.pageNumber, order);
      }
      marker.pageNumber = finiteOr(marker.pageNumber, finiteOr(entry.pageNumber, order));
      entry.pageNumber = finiteOr(entry.pageNumber, marker.pageNumber);

      marker.anchorHref = normalizeAnchor(marker.anchorHref || marker.htmlAnchorHref || entry.anchorHref || entry.htmlAnchorHref || '');
      marker.htmlAnchorHref = normalizeAnchor(marker.htmlAnchorHref || marker.anchorHref || entry.htmlAnchorHref || entry.anchorHref || '');

      if (documentKind === 'html') {
        entry.anchorHref = normalizeAnchor(entry.anchorHref || marker.anchorHref || marker.htmlAnchorHref || '');
        entry.htmlAnchorHref = normalizeAnchor(entry.htmlAnchorHref || marker.htmlAnchorHref || marker.anchorHref || '');
      } else {
        entry.anchorHref = normalizeAnchor(entry.anchorHref || '');
        entry.htmlAnchorHref = normalizeAnchor(entry.htmlAnchorHref || '');
      }

      entry.label = entry.label || marker.label || '';
    } else {
      entry.pageNumber = finiteOr(entry.pageNumber, order);
      entry.anchorHref = normalizeAnchor(entry.anchorHref || entry.htmlAnchorHref || '');
      entry.htmlAnchorHref = normalizeAnchor(entry.htmlAnchorHref || entry.anchorHref || '');
    }

    return entry;
  }

  function buildEntriesFromMembers(group, nodeMap) {
    var entries = [];
    var members = ensureArray(group.members);
    var i;
    var member;
    var node;

    for (i = 0; i < members.length; i += 1) {
      member = normalizeMember(members[i], i + 1);
      members[i] = member;
      node = nodeMap[member.nodeId];
      if (node && (node.type === 'PageMarker' || node.topicKind === 'viewpoint-page')) {
        entries.push({
          role: 'entry',
          nodeId: member.nodeId,
          order: finiteOr(member.order, entries.length + 1),
          pageNumber: finiteOr(node.pageNumber, entries.length + 1),
          anchorHref: node.anchorHref || '',
          htmlAnchorHref: node.htmlAnchorHref || '',
          comment: ''
        });
      }
    }
    return entries;
  }

  function normalizeViewpointGroup(group, page, nodeMap) {
    var contentNode;
    var documentKind;
    var entries;
    var members;
    var i;
    var pageCount;
    var maxPage;
    var minPage;
    var marker;

    group.type = 'viewpoint';
    if (group.kind === 'contents' || group.kind === 'contentsGroup') {
      group.kind = 'viewpoint';
    }
    group.groupType = normalizeLegacyContentsToken(group.groupType || 'axis');
    if (group.groupType === 'viewpointAxis') {
      group.groupType = 'axis';
    }
    // group.name is treated as a system/internal group name and is normalised.
    // group.label is user-defined display information and is intentionally preserved.
    group.name = normalizeLegacyContentsName(group.name, 'Viewpoint') || 'Viewpoint';
    group.description = normalizeDescription(group.description);
    group.visible = group.visible === undefined ? true : !!group.visible;
    group.moveTogether = group.moveTogether === undefined ? true : !!group.moveTogether;
    group.orientation = group.orientation || 'horizontal';
    group.spine = normalizeSpine(group.spine);
    group.members = ensureArray(group.members);
    group.entries = ensureArray(group.entries);

    group.documentRef = group.documentRef || group.mediaRef || group.contentRef || '';
    group.mediaRef = group.mediaRef || group.documentRef || '';

    if (group.representativeNodeId && nodeMap[group.representativeNodeId]) {
      normalizeLegacyContentsNode(nodeMap[group.representativeNodeId]);
    }

    contentNode = nodeMap[group.documentRef] || nodeMap[group.mediaRef] || null;
    documentKind = getContentDocumentKind(contentNode);

    members = [];
    for (i = 0; i < group.members.length; i += 1) {
      members.push(normalizeMember(group.members[i], i + 1));
    }
    group.members = members;

    entries = group.entries.length > 0 ? group.entries : buildEntriesFromMembers(group, nodeMap);

    for (i = 0; i < entries.length; i += 1) {
      entries[i] = normalizeViewpointEntry(entries[i], group, nodeMap, i + 1, documentKind);
      addMemberIfMissing(group.members, entries[i].nodeId);
    }

    sortByOrderThenPosition(entries, nodeMap, group.orientation);
    for (i = 0; i < entries.length; i += 1) {
      entries[i].order = i + 1;
      marker = nodeMap[entries[i].nodeId];
      if (marker) {
        marker.order = i + 1;
        marker.axisPos = finiteOr(marker.axisPos, group.orientation === 'vertical' ? marker.y : marker.x);
      }
    }
    group.entries = entries;

    group.axis = isObject(group.axis) ? group.axis : {};
    if (documentKind === 'html') {
      group.axis.mode = 'html';
      group.axis.unit = 'anchor';
      group.axis.nodeType = 'pageMarker';
      group.axis.start = 1;
      group.axis.end = entries.length;
      group.pageCount = 0;
      group.documentPageCount = 0;
      group.hasPageCount = false;
    } else {
      maxPage = 0;
      minPage = 0;
      for (i = 0; i < entries.length; i += 1) {
        if (finiteOr(entries[i].pageNumber, 0) > 0) {
          if (minPage === 0 || entries[i].pageNumber < minPage) {
            minPage = entries[i].pageNumber;
          }
          if (entries[i].pageNumber > maxPage) {
            maxPage = entries[i].pageNumber;
          }
        }
      }
      pageCount = finiteOr(group.pageCount, getContentPageCount(contentNode));
      group.axis.mode = group.axis.mode || 'document';
      group.axis.unit = group.axis.unit || 'page';
      group.axis.nodeType = group.axis.nodeType || 'page';
      group.axis.start = finiteOr(group.axis.start, minPage || 1);
      group.axis.end = finiteOr(group.axis.end, pageCount || maxPage || group.axis.start);
      group.pageCount = pageCount || maxPage || 0;
      group.documentPageCount = group.pageCount;
      group.hasPageCount = group.pageCount > 0;
    }

    if (!isObject(group.axis.anchor)) {
      group.axis.anchor = isObject(group.origin) ? cloneObject(group.origin) : { x: 0, y: 0 };
    }
    if (!isObject(group.origin)) {
      group.origin = cloneObject(group.axis.anchor);
    }
    group.length = finiteOr(group.length, 0);
    group.audit = isObject(group.audit) ? group.audit : {};

    return group;
  }

  function normalizeTimelineGroup(group, page, nodeMap) {
    group.type = 'timeline';
    group.groupType = group.groupType || 'axis';
    group.name = group.name || 'Timeline';
    group.description = normalizeDescription(group.description);
    group.visible = group.visible === undefined ? true : !!group.visible;
    group.moveTogether = group.moveTogether === undefined ? true : !!group.moveTogether;
    group.orientation = group.orientation || 'horizontal';
    group.spine = normalizeSpine(group.spine);
    group.members = ensureArray(group.members);
    group.entries = ensureArray(group.entries);
    group.axis = isObject(group.axis) ? group.axis : {};
    group.axis.mode = group.axis.mode || 'time';
    group.axis.unit = group.axis.unit || 'time';
    group.axis.nodeType = group.axis.nodeType || 'segment';
    group.audit = isObject(group.audit) ? group.audit : {};
    return group;
  }

  function normalizeSimpleGroup(group) {
    group.description = normalizeDescription(group.description);
    group.visible = group.visible === undefined ? true : !!group.visible;
    group.moveTogether = group.moveTogether === undefined ? true : !!group.moveTogether;
    group.members = ensureArray(group.members);
    group.spine = normalizeSpine(group.spine);
    group.audit = isObject(group.audit) ? group.audit : {};
    return group;
  }

  function normalizeGroup(group, page, nodeMap) {
    group = isObject(group) ? group : {};
    group.id = group.id || ('_' + Math.random().toString(36).slice(2));
    group.type = group.type || group.kind || 'simple';
    if (isLegacyContentsGroupType(group.type)) {
      group.type = 'viewpoint';
    }
    if (isLegacyContentsGroupType(group.kind)) {
      group.kind = 'viewpoint';
    }

    if (group.type === 'viewpoint' || group.type === 'viewpointGroup') {
      return normalizeViewpointGroup(group, page, nodeMap);
    }
    if (group.type === 'timeline') {
      return normalizeTimelineGroup(group, page, nodeMap);
    }
    return normalizeSimpleGroup(group);
  }

  function normalizeTransform(transform) {
    transform = isObject(transform) ? transform : {};
    transform.x = finiteOr(transform.x, 0);
    transform.y = finiteOr(transform.y, 0);
    transform.scale = finiteOr(transform.scale, 1);
    return transform;
  }

  function normalizePage(page, pageIndex) {
    var i;
    var nodeMap;

    page = isObject(page) ? page : {};
    page.id = page.id || ('_' + Math.random().toString(36).slice(2));
    page.pp = finiteOr(page.pp, pageIndex + 1);
    page.name = page.name || '';
    page.description = page.description || '';
    page.nodes = ensureArray(page.nodes);
    page.links = ensureArray(page.links);
    page.groups = ensureArray(page.groups);
    page.transform = normalizeTransform(page.transform);

    for (i = 0; i < page.nodes.length; i += 1) {
      page.nodes[i] = normalizeNode(page.nodes[i]);
    }

    for (i = 0; i < page.links.length; i += 1) {
      page.links[i] = normalizeLegacyContentsLink(page.links[i]);
    }

    nodeMap = makeNodeMap(page);
    for (i = 0; i < page.groups.length; i += 1) {
      page.groups[i] = normalizeGroup(page.groups[i], page, nodeMap);
    }

    return page;
  }

  function normalizeTopLevelResources(note) {
    var resources = ensureArray(note.resources);
    var dummyNode;
    var i;

    for (i = 0; i < resources.length; i += 1) {
      dummyNode = {
        id: resources[i] && resources[i].id || '',
        label: resources[i] && resources[i].title || ''
      };
      resources[i] = normalizeResource(resources[i], dummyNode);
    }
    note.resources = resources;
  }

  function normalizeNote(note, opt) {
    var inPlace;
    var result;
    var i;

    opt = opt || {};
    inPlace = opt.inPlace === true;
    result = inPlace ? note : cloneObject(note);

    if (!isObject(result)) {
      result = {};
    }

    result.note_id = result.note_id || result.id || '';
    result.note_name = result.note_name || result.name || '';
    result.description = result.description || '';
    result.thumbnail = result.thumbnail || '';
    result.resources = ensureArray(result.resources);
    result.pages = ensureArray(result.pages);

    normalizeTopLevelResources(result);

    for (i = 0; i < result.pages.length; i += 1) {
      result.pages[i] = normalizePage(result.pages[i], i);
    }

    if (!result.currentPage && result.pages.length > 0) {
      result.currentPage = result.pages[0].id;
    }

    /* Non-invasive marker for diagnostics. Remove before saving if undesired. */
    result.dataModel = result.dataModel || { name: 'wuwei.note', version: 'v2' };
    result.dataModel.name = result.dataModel.name || 'wuwei.note';
    result.dataModel.version = result.dataModel.version || 'v2';

    return result;
  }

  function needsNormalize(note) {
    var pages;
    var i;
    var j;
    var nodes;
    var groups;
    var node;
    var resource;
    var group;
    var links;
    var link;

    if (!isObject(note)) {
      return true;
    }
    pages = ensureArray(note.pages);
    for (i = 0; i < pages.length; i += 1) {
      nodes = ensureArray(pages[i].nodes);
      for (j = 0; j < nodes.length; j += 1) {
        node = nodes[j];
        if (!node) {
          return true;
        }
        if (node.topicKind === 'contents-representative' ||
            node.topicKind === 'contents-page' ||
            node.representativeType === 'contents' ||
            node.representativeType === 'contentsGroup' ||
            node.axisRole === 'contents-entry') {
          return true;
        }
        if (node.type === 'Content') {
          resource = node.resource || {};
          if (!VALID_SOURCES[resource.source] || !VALID_KINDS[resource.kind]) {
            return true;
          }
          if (resource.kind === 'document' && !VALID_DOCUMENT_KINDS[resource.documentKind]) {
            return true;
          }
        }
        if (node.type === 'PageMarker' || node.topicKind === 'viewpoint-page') {
          if (!node.viewpointRef || !node.groupRef) {
            return true;
          }
          if (node.htmlAnchorHref && !node.anchorHref) {
            return true;
          }
          if (node.anchorHref && !node.htmlAnchorHref) {
            return true;
          }
        }
      }
      links = ensureArray(pages[i].links);
      for (j = 0; j < links.length; j += 1) {
        link = links[j];
        if (link && (
          link.groupType === 'contentsAxis' ||
          link.linkType === 'contents-axis' ||
          link.relation === 'contents' ||
          link.role === 'contents-entry' ||
          link.role === 'contents-first-entry'
        )) {
          return true;
        }
      }
      groups = ensureArray(pages[i].groups);
      for (j = 0; j < groups.length; j += 1) {
        group = groups[j];
        if (group && isLegacyContentsGroupType(group.type || group.kind)) {
          return true;
        }
        if (group && (group.type === 'viewpoint' || group.type === 'viewpointGroup')) {
          if (isLegacyContentsName(group.name)) {
            return true;
          }
          if (!group.axis || !group.axis.unit || group.documentRef && !group.mediaRef) {
            return true;
          }
        }
      }
    }
    return false;
  }

  api.normalize = normalizeNote;
  api.needsNormalize = needsNormalize;
  api.normalizeResource = normalizeResource;
  api.normalizePageMarker = normalizePageMarker;
  api.normalizeAnchor = normalizeAnchor;
  api.expandNodeRuntimeStyle = expandNodeRuntimeStyle;
  api.stripNodeRuntimeStyleFields = stripNodeRuntimeStyleFields;

}(window));
