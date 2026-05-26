/**
 * edit.uploaded.markup.js
 * wuwei edit.uploaded template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.uploaded = wuwei.edit.uploaded || {};
wuwei.edit.uploaded.markup = ( function () {
  function getFontAlign(node) {
    var align = node && node.style && node.style.font && node.style.font.align;
    var anchor;
    if (align) { return String(align).toLowerCase(); }
    anchor = node && node.font && node.font['text-anchor'];
    if ('start' === anchor) { return 'left'; }
    if ('end' === anchor) { return 'right'; }
    return 'center';
  }

  function normalizeFontSizeValue(value) {
    if (value == null || value === '' || Number(value) === 14) { return '12pt'; }
    if ('number' === typeof value || /^\d+(\.\d+)?$/.test(String(value))) { return String(value) + 'pt'; }
    return String(value);
  }

  function getMediaKindValue(node) {
    var resource = (node && node.resource) || {};
    var kind = wuwei.resource && typeof wuwei.resource.getKind === 'function'
      ? wuwei.resource.getKind(node)
      : String(resource.kind || '').toLowerCase();
    var mimeType = String(resource.mimeType || '').toLowerCase();
    var uri = String(resource.uri || editableResourceUrl(resource.canonicalUri || '')).toLowerCase();

    if (kind) { return kind === 'web' ? 'webpage' : kind; }
    if (wuwei.document && typeof wuwei.document.isDocumentNode === 'function' && wuwei.document.isDocumentNode(node)) {
      return 'document';
    }
    if (wuwei.video && typeof wuwei.video.isVideoNode === 'function' && wuwei.video.isVideoNode(node)) {
      return 'video';
    }
    if (wuwei.audio && typeof wuwei.audio.isAudioNode === 'function' && wuwei.audio.isAudioNode(node)) {
      return 'audio';
    }
    if (mimeType.indexOf('image/') === 0) { return 'image'; }
    if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/.test(uri)) { return 'image'; }
    return '';
  }

  function getEditableThumbnailUri(node) {
    var uri = '';
    if (wuwei.resource && typeof wuwei.resource.getRolePath === 'function') {
      uri = wuwei.resource.getRolePath(node, 'thumbnail') || '';
    }
    if (!uri && wuwei.util && typeof wuwei.util.getResourceFilePath === 'function' &&
      node && node.resource) {
      uri = wuwei.util.getResourceFilePath(node.resource, 'thumbnail', node) || '';
    }
    if (!uri) {
      uri = String(node && node.resource && node.resource.thumbnailUri || '');
    }
    if (wuwei.util && typeof wuwei.util.toStorageRelativePath === 'function' &&
      (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || '')) ||
        /\/(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || '')) ||
        /^\/?(upload|resource|note|thumbnail|content)\//.test(String(uri).replace(/^.*\/wu_wei2\//, '')) ||
        /\/(upload|resource|note|thumbnail|content)\//.test(String(uri || '')))) {
      uri = wuwei.util.toStorageRelativePath(uri, null, '');
    }
    return getSnapshotDisplayPath(node, 'thumbnail', uri);
  }

  function getEditableResourceUri(node) {
    var uri = '';
    if (wuwei.resource && typeof wuwei.resource.getRolePath === 'function') {
      uri = wuwei.resource.getRolePath(node, 'original') || '';
    }
    if (!uri && wuwei.resource && typeof wuwei.resource.getLogicalUri === 'function') {
      uri = wuwei.resource.getLogicalUri(node) || '';
    }
    if (!uri) {
      uri = (wuwei.util && wuwei.util.getResourceOriginalPath)
        ? wuwei.util.getResourceOriginalPath(node)
        : ((node && node.resource && node.resource.uri) || '');
    }
    if (wuwei.util && wuwei.util.toStorageRelativePath &&
      (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || '')) ||
        /^\/?upload\//.test(String(uri).replace(/^.*\/wu_wei2\//, '')) ||
        /\/upload\//.test(String(uri || '')))) {
      uri = wuwei.util.toStorageRelativePath(uri, null, 'upload');
    }
    return getSnapshotDisplayPath(node, 'original', uri);
  }

  function getResourceViewpointValue(node, key) {
    var contents = node && node.resource && node.resource.contents;
    var value = contents && contents[key];
    return Number.isFinite(Number(value)) ? String(Math.floor(Number(value))) : '';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function rowcount(value) {
    return wuwei.edit.markup.rowcount(value || '');
  }

  function readonlyRow(id, label, value, labelSize, valueSize) {
    return [
      '<div class="w3-row">',
      '  <label for="' + id + '" class="w3-col ' + (labelSize || 's5') + '">' + t(label) + '</label>',
      '  <input type="text" id="' + id + '" class="w3-col ' + (valueSize || 's7') + '" readonly aria-readonly="true" value="' + esc(value || '') + '">',
      '</div>'
    ].join('\n');
  }

  function isRemoteResource(resource) {
    resource = resource && typeof resource === 'object' ? resource : {};
    return String(resource.source || '').toLowerCase() === 'remote' ||
      !!(resource.original && String(resource.original.type || '').toLowerCase() === 'remote') ||
      (!!resource.uri && /^https?:\/\//i.test(String(resource.uri || '')));
  }

  function editableTextRow(id, label, value, labelSize, valueSize, placeholder) {
    return [
      '<div class="w3-row">',
      '  <label for="' + id + '" class="w3-col ' + (labelSize || 's5') + '">' + t(label) + '</label>',
      '  <input type="text" id="' + id + '" name="' + String(id || '').replace(/_/g, '.') + '" class="w3-col ' + (valueSize || 's7') + ' edit-value" value="' + esc(value || '') + '"' + (placeholder ? (' placeholder="' + esc(placeholder) + '"') : '') + '>',
      '</div>'
    ].join('\n');
  }

  function resourceTextRow(resource, id, label, value, labelSize, valueSize, placeholder) {
    return isRemoteResource(resource)
      ? editableTextRow(id, label, value, labelSize, valueSize, placeholder)
      : readonlyRow(id, label, value, labelSize, valueSize);
  }

  function thumbnailUriInputRow(node, value) {
    var visible = String(node && node.shape || '').toUpperCase() === 'THUMBNAIL';
    value = editableResourceUrl(value);
    return [
      '<div class="w3-row thumbnail-uri-row" style="display:' + (visible ? 'block' : 'none') + ';">',
      '  <label for="resource_thumbnailUri" class="w3-col s5">' + t('URL:') + '</label>',
      '  <input type="text" id="resource_thumbnailUri" name="resource.thumbnailUri" class="w3-col s7 edit-value" value="' + esc(value || '') + '" placeholder="' + esc('https://... or upload path') + '">',
      '</div>'
    ].join('\n');
  }

  function contentRows(node, page, thumbnailUri) {
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var kind = wuwei.resource && typeof wuwei.resource.getKind === 'function'
      ? wuwei.resource.getKind(node)
      : getMediaKindValue(node);
    var documentKind = wuwei.resource && typeof wuwei.resource.getDocumentKind === 'function'
      ? wuwei.resource.getDocumentKind(node)
      : String(resource.documentKind || '');
    var videoKind = wuwei.resource && typeof wuwei.resource.getVideoKind === 'function'
      ? wuwei.resource.getVideoKind(node)
      : String(resource.videoKind || '');
    var audioKind = wuwei.resource && typeof wuwei.resource.getAudioKind === 'function'
      ? wuwei.resource.getAudioKind(node)
      : String(resource.audioKind || '');
    var rows = [
      readonlyRow('resource_source', 'Source', resource.source || ''),
      readonlyRow('resource_kind', 'Media type', kind || ''),
      resourceTextRow(resource, 'resource_documentKind', 'Document kind', documentKind || '', 's5', 's7', 'pdf / html / office / text'),
      resourceTextRow(resource, 'resource_videoKind', 'Video kind', videoKind || '', 's5', 's7', 'youtube / vimeo / mp4'),
      resourceTextRow(resource, 'resource_audioKind', 'Audio kind', audioKind || '', 's5', 's7', 'mp3 / wav / remote'),
      resourceTextRow(resource, 'resource_title', 'Title', resource.title || ''),
      readonlyRow('resource_mimeType', 'MIME', resource.mimeType || ''),
      resourceTextRow(resource, 'resource_uri', 'URL:', editableResourceUrl(resource.uri || (resource.original && resource.original.url) || ''), 's5', 's7', 'https://...'),
      resourceTextRow(resource, 'resource_canonicalUri', 'Canonical URI', editableResourceUrl(resource.canonicalUri || (resource.original && resource.original.canonicalUrl) || '')),
      resourceTextRow(resource, 'resource_original_url', 'Original URL', editableResourceUrl(resource.original && resource.original.url || resource.uri || ''), 's5', 's7', 'https://...'),
      readonlyRow('thumbnailUri', 'THUMBNAIL', thumbnailUri || '')
    ];

    if (wuwei.document && typeof wuwei.document.isDocumentNode === 'function' && wuwei.document.isDocumentNode(node)) {
      rows = rows.concat(documentRows(node, page));
    }
    else if (wuwei.video && typeof wuwei.video.isVideoNode === 'function' && wuwei.video.isVideoNode(node)) {
      rows = rows.concat(videoRows(node));
    }
    else if (wuwei.audio && typeof wuwei.audio.isAudioNode === 'function' && wuwei.audio.isAudioNode(node)) {
      rows = rows.concat(audioRows(node));
    }
    return rows.join('\n');
  }

  function documentRows(node, page) {
    var first = wuwei.document && typeof wuwei.document.getFirstPageNumber === 'function'
      ? wuwei.document.getFirstPageNumber(node)
      : 1;
    var offset = wuwei.document && typeof wuwei.document.getPageOffset === 'function'
      ? wuwei.document.getPageOffset(node)
      : Math.max(0, first - 1);
    var count = wuwei.document && typeof wuwei.document.getPageCount === 'function'
      ? wuwei.document.getPageCount(node)
      : '';
    return [
      page ? readonlyRow('pdfPage', 'Page:', page) : '',
      '<div class="w3-row">',
      '  <label for="resource_contents_firstPageNumber" class="w3-col s5">' + t('First page number') + '</label>',
      '  <input type="number" id="resource_contents_firstPageNumber" name="resource.contents.firstPageNumber" class="w3-col s7 edit-value" min="1" step="1" value="' + esc(first || 1) + '">',
      '</div>',
      readonlyRow('resource_contents_pageOffset', 'Page offset', offset == null ? '' : offset),
      readonlyRow('resource_contents_pageCount', 'Page count', count || '')
    ];
  }

  function videoRows(node) {
    var source = wuwei.video && typeof wuwei.video.detectSource === 'function'
      ? wuwei.video.detectSource(node)
      : {};
    var duration = wuwei.video && typeof wuwei.video.getDuration === 'function'
      ? wuwei.video.getDuration(node)
      : 0;
    return [
      readonlyRow('resource_video_provider', 'Provider', source.provider || ''),
      readonlyRow('resource_video_id', 'Video ID', source.id || ''),
      readonlyRow('resource_video_duration', 'Duration', formatSeconds(duration))
    ];
  }

  function audioRows(node) {
    var duration = wuwei.audio && typeof wuwei.audio.getDuration === 'function'
      ? wuwei.audio.getDuration(node)
      : 0;
    return [
      readonlyRow('resource_audio_duration', 'Duration', formatSeconds(duration))
    ];
  }

  function formatSeconds(value) {
    var total = Math.max(0, Math.floor(Number(value || 0)));
    var hh = Math.floor(total / 3600);
    var mm = Math.floor((total % 3600) / 60);
    var ss = total % 60;
    if (!total) { return ''; }
    if (hh > 0) {
      return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
    }
    return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }

  function rightsRows(node) {
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var rights = (resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    return [
      readonlyRow('resource_rights_source_title', 'Title', resource.title || ''),
      readonlyRow('resource_rights_source_uri', 'URL:', editableResourceUrl(resource.uri || '')),
      readonlyRow('resource_rights_source_canonicalUri', 'Canonical URI', editableResourceUrl(resource.canonicalUri || '')),
      '<div class="w3-row">',
      '  <label for="resource_rights_owner" class="w3-col s5">' + t('Owner') + '</label>',
      '  <input type="text" id="resource_rights_owner" name="resource.rights.owner" class="w3-col s7 edit-value" value="' + esc(rights.owner || '') + '">',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_copyright" class="w3-col s12">' + t('Copyright') + '</label>',
      '  <textarea id="resource_rights_copyright" name="resource.rights.copyright" class="w3-col s12 edit-value" rows="' + rowcount(rights.copyright || '') + '">' + esc(rights.copyright || '') + '</textarea>',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_license" class="w3-col s5">' + t('License') + '</label>',
      '  <input type="text" id="resource_rights_license" name="resource.rights.license" class="w3-col s7 edit-value" value="' + esc(rights.license || '') + '">',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_attribution" class="w3-col s12">' + t('Attribution') + '</label>',
      '  <textarea id="resource_rights_attribution" name="resource.rights.attribution" class="w3-col s12 edit-value" rows="' + rowcount(rights.attribution || '') + '">' + esc(rights.attribution || '') + '</textarea>',
      '</div>'
    ].join('\n');
  }

  function tabbedPaneHtml(tabs) {
    return [
      '<div class="edit-tabbed-pane">',
      '<div class="w3-bar w3-light-grey edit-tab-buttons">',
      tabs.map(function (tab, index) {
        return '<button type="button" class="w3-button w3-small edit-tab-button' + (index ? '' : ' active w3-blue') + '" data-edit-tab="' + tab.id + '">' + esc(t(tab.label)) + '</button>';
      }).join('\n'),
      '</div>',
      tabs.map(function (tab, index) {
        return '<div class="edit-tab-panel" data-edit-tab-panel="' + tab.id + '" style="display:' + (index ? 'none' : 'block') + ';">' + tab.html + '</div>';
      }).join('\n'),
      '</div>'
    ].join('\n');
  }

  function getLabelStyleValue(node, path, fallback) {
    var labelStyle = node && node.style && node.style.label;
    var offset;
    if (!labelStyle || 'object' !== typeof labelStyle) {
      return fallback;
    }
    if ('offset.x' === path || 'offset.y' === path) {
      offset = labelStyle.offset || {};
      return Number.isFinite(Number(offset[path.slice(-1)])) ? Number(offset[path.slice(-1)]) : fallback;
    }
    return Number.isFinite(Number(labelStyle[path])) ? Number(labelStyle[path]) : (labelStyle[path] || fallback);
  }

  function getDefaultLabelStyle() {
    return (wuwei.common && wuwei.common.defaultStyle && wuwei.common.defaultStyle.label) || {};
  }

  function getDefaultLabelWidth(node) {
    var style = getDefaultLabelStyle();
    var width = Number(style.width);
    if (Number.isFinite(width) && width > 0) { return width; }
    return node && node.size && Number(node.size.width) > 0 ? Number(node.size.width) : 120;
  }

  function getDefaultLabelLines() {
    var lines = Number(getDefaultLabelStyle().lines);
    return Number.isFinite(lines) && lines > 0 ? Math.floor(lines) : 1;
  }

  function getDefaultLabelOffsetX() {
    var offset = getDefaultLabelStyle().offset || {};
    var x = Number(offset.x);
    return Number.isFinite(x) ? x : 0;
  }

  function getDefaultLabelOffsetY() {
    var offset = getDefaultLabelStyle().offset || {};
    var y = Number(offset.y);
    return Number.isFinite(y) ? y : 0;
  }

  function getSnapshotDisplayPath(node, role, current) {
    var resource = node && node.resource;
    var storage = resource && resource.storage;
    var files = storage && Array.isArray(storage.files) ? storage.files : [];
    var snapshotPath = String(storage && storage.snapshotPath || '').replace(/\\/g, '/');
    var file, raw, path, uid, i;

    if (/^\d{4}\/\d{2}\/\d{2}\//.test(String(current || ''))) {
      return current;
    }
    if (!snapshotPath || !wuwei.util || typeof wuwei.util.toStorageRelativePath !== 'function') {
      return current;
    }
    for (i = 0; i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.role || '').toLowerCase() !== String(role || '').toLowerCase()) {
        continue;
      }
      raw = String(file.path || '').replace(/\\/g, '/').trim();
      if (!raw || /^(?:https?:|cgi-bin\/|server\/|\d{4}\/\d{2}\/\d{2}\/)/i.test(raw)) {
        return current;
      }
      uid = String(
        (resource.audit && (resource.audit.owner || resource.audit.createdBy)) ||
        (node.audit && (node.audit.owner || node.audit.createdBy)) ||
        ''
      ).trim();
      path = wuwei.util.toStorageRelativePath(snapshotPath.replace(/\/+$/, '') + '/' + raw, uid, 'note');
      return path || current;
    }
    return current;
  }

  const template = function( param ) {
    let
      node = param.node,
      shape = node.shape,
      style = node.style || {},
      font = (node.style && node.style.font) || {},
      resourceUri = getEditableResourceUri(node),
      thumbnailUri = getEditableThumbnailUri(node),
      matchP,
      page = null,
      option = param.option;
    const fontAlign = getFontAlign(node);
    const fontSizeValue = normalizeFontSizeValue(font && font.size);
    const labelStyleWidth = getLabelStyleValue(node, 'width', getDefaultLabelWidth(node));
    const labelStyleLines = getLabelStyleValue(node, 'lines', getDefaultLabelLines());
    const labelOffsetX = getLabelStyleValue(node, 'offset.x', getDefaultLabelOffsetX());
    const labelOffsetY = getLabelStyleValue(node, 'offset.y', getDefaultLabelOffsetY());
    matchP = String(resourceUri || '').match(/^(.*)#page=([0-9]+)$/);
    if (matchP) {
      resourceUri = matchP[1];
      page = +matchP[2];
    }

    const
      common = wuwei.common,
      lang = common.nls.LANG,
      creativeCommons = common.nls.creativeCommons[lang],
      copyrights = common.nls.copyrights[lang],
      motivations = common.motivations,
      shapes = common.shapes,
      fontSizes = common.fontSizes,
      types = common.nodeTypes;
    let value = (node.description && typeof node.description.body === 'string')
      ? node.description.body
      : '';
    var displayHtml = `
  ${wuwei.edit.style.markup.labelRows({
    label: node.label || '',
    align: fontAlign,
    labelSize: 's6',
    alignSize: 's6'
  })}
  ${node.label || 'PageMarker' === node.type || 'Segment' === node.type || 'Topic' === node.type || 'Content' === node.type
    ? wuwei.edit.style.markup.labelLayoutRows({
        width: labelStyleWidth,
        lines: labelStyleLines,
        offsetX: labelOffsetX,
        offsetY: labelOffsetY
      })
    : ''
  }
  ${wuwei.edit.style.markup.descriptionRows({
    node: node,
    format: (node.description && node.description.format) || 'plain/text',
    body: value || ''
  })}
  
  ${node ?
  `${wuwei.edit.style.markup.shapeSizeRows({
    shape: shape,
    size: node.size,
    options: shapes
  })}
  ${thumbnailUriInputRow(node, thumbnailUri)}
  ${wuwei.edit.style.markup.paintRows({
    style: style,
    fontSize: fontSizeValue,
    fillPaletteId: 'style_fill_palette',
    fontPaletteId: 'style_font_color_palette'
  })}
  <div class="w3-row">
    <label for="group" class="w3-col s4">${t('Group')}</label>  
    <input type="text" id="group" name="group" value="${node.group || ''}" class="w3-col s8 edit-value">
  </div>`
  : ``
}
`;
    var html = [
      '<form id="editform" class="uploaded form-group content" onsubmit="return false;">',
      tabbedPaneHtml([
        { id: 'display', label: 'Display', html: displayHtml },
        { id: 'content', label: '_Content', html: contentRows(node, page, thumbnailUri) },
        { id: 'rights', label: 'Source / Rights', html: rightsRows(node) }
      ]),
      '</form>'
    ].join('\n');
    return html;
  };

  function t(str) {
    return wuwei.nls.translate(str);
  }

  function isLoadFileRuntimeUrl(value) {
    return /(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(value || ''));
  }

  function getUrlHash(value) {
    var s = String(value || '');
    var index = s.indexOf('#');
    return index >= 0 ? s.slice(index) : '';
  }

  function editableResourceUrl(value) {
    var s = String(value || '').trim();
    var match;

    if (!s || !isLoadFileRuntimeUrl(s)) {
      return s;
    }

    match = s.match(/[?&]path=([^&#]*)/);
    if (!match) { return s; }
    try { return decodeURIComponent(match[1]) + getUrlHash(s); }
    catch (e) { return match[1].replace(/%2F/ig, '/') + getUrlHash(s); }
  }

  return {
    template: template
  };
} ());
// edit.uploaded.markup.js 2026-05-17
