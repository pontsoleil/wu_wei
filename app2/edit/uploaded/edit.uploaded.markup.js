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
    var kind = String(resource.kind || '').toLowerCase();
    var mimeType = String(resource.mimeType || '').toLowerCase();
    var uri = String(resource.uri || '').toLowerCase();

    if (kind === 'web') { return 'webpage'; }
    if (kind === 'pdf' || kind === 'office' || kind === 'document') { return 'document'; }
    if (kind === 'image' || kind === 'video' || kind === 'audio') { return kind; }
    if (mimeType.indexOf('video/') === 0) { return 'video'; }
    if (mimeType.indexOf('image/') === 0) { return 'image'; }
    if (mimeType.indexOf('audio/') === 0) { return 'audio'; }
    if (mimeType.indexOf('application/pdf') === 0 ||
      mimeType.indexOf('application/msword') === 0 ||
      mimeType.indexOf('application/vnd.ms-excel') === 0 ||
      mimeType.indexOf('application/vnd.ms-powerpoint') === 0 ||
      mimeType.indexOf('application/vnd.openxmlformats-officedocument') === 0 ||
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)(\?|#|$)/.test(uri)) {
      return 'document';
    }
    return kind || '';
  }

  function getEditableThumbnailUri(node) {
    var uri = '';
    if (wuwei.util && typeof wuwei.util.getResourceFilePath === 'function' &&
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
    var uri = (wuwei.util && wuwei.util.getResourceOriginalPath)
      ? wuwei.util.getResourceOriginalPath(node)
      : ((node && node.resource && node.resource.uri) || '');
    if (wuwei.util && wuwei.util.toStorageRelativePath &&
      (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || '')) ||
        /^\/?upload\//.test(String(uri).replace(/^.*\/wu_wei2\//, '')) ||
        /\/upload\//.test(String(uri || '')))) {
      uri = wuwei.util.toStorageRelativePath(uri, null, 'upload');
    }
    return getSnapshotDisplayPath(node, 'original', uri);
  }

  function getResourceContentsValue(node, key) {
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

  function contentRows(node, page, thumbnailUri) {
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var contents = (resource.contents && typeof resource.contents === 'object') ? resource.contents : {};
    return [
      readonlyRow('resource_source', 'Source', resource.source || ''),
      readonlyRow('resource_kind', 'Media type', resource.kind || getMediaKindValue(node) || ''),
      readonlyRow('resource_documentKind', 'Document kind', resource.documentKind || ''),
      readonlyRow('resource_videoKind', 'Video kind', resource.videoKind || ''),
      readonlyRow('resource_title', 'Title', resource.title || ''),
      readonlyRow('resource_mimeType', 'MIME', resource.mimeType || ''),
      readonlyRow('resource_uri', 'URL:', resource.uri || ''),
      readonlyRow('resource_canonicalUri', 'Canonical URI', resource.canonicalUri || ''),
      readonlyRow('thumbnailUri', 'THUMBNAIL', thumbnailUri || ''),
      page ? readonlyRow('pdfPage', 'Page:', page) : '',
      '<div class="w3-row">',
      '  <label for="resource_contents_pageOffset" class="w3-col s5">' + t('Page offset') + '</label>',
      '  <input type="number" id="resource_contents_pageOffset" name="resource.contents.pageOffset" class="w3-col s7 edit-value" step="1" value="' + esc(contents.pageOffset == null ? '' : contents.pageOffset) + '">',
      '</div>',
      readonlyRow('resource_contents_pageCount', 'Page count', contents.pageCount == null ? '' : contents.pageCount),
      readonlyRow('resource_contents_pageMin', 'Page min', contents.pageMin == null ? '' : contents.pageMin),
      readonlyRow('resource_contents_pageMax', 'Page max', contents.pageMax == null ? '' : contents.pageMax)
    ].join('\n');
  }

  function rightsRows(node) {
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var rights = (resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    return [
      readonlyRow('resource_rights_source_title', 'Title', resource.title || ''),
      readonlyRow('resource_rights_source_uri', 'URL:', resource.uri || ''),
      readonlyRow('resource_rights_source_canonicalUri', 'Canonical URI', resource.canonicalUri || ''),
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
    
    // video?
    const resourceMimeType = (node && node.resource && node.resource.mimeType ? String(node.resource.mimeType) : '').toLowerCase();
    const resourceUriLc = (resourceUri ? String(resourceUri) : '').toLowerCase();
    const labelLc = (node && node.label ? String(node.label) : '').toLowerCase();
    const isVideo = resourceMimeType.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)$/.test(resourceUriLc) || /\.(mp4|webm|ogg|mov|m4v)$/.test(labelLc);
    const timeRange = (node && node.timeRange && typeof node.timeRange === 'object') ? node.timeRange : {};
    const mediaStart = timeRange.start != null ? timeRange.start : '';
    const mediaEnd = timeRange.end != null ? timeRange.end : '';

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
  ${isVideo
    ? `<div class="w3-row">
        <div class="frame video w3-col s12">
          <video id="editVideoPlayer" controls playsinline preload="metadata"></video>
        </div>
      </div>

      <div class="w3-row video-controls">
        <label class="w3-col s12">${t('clip range')}</label>
        <div class="w3-col s12 time-inputs">
          <input id="vMediaStart" type="text" placeholder="start 00:01:23.5">
          <input id="vMediaEnd" type="text" placeholder="end (optional) 00:02:10">
          <input type="hidden" id="timeRange_start" name="timeRange.start" value="${mediaStart}">
          <input type="hidden" id="timeRange_end" name="timeRange.end" value="${mediaEnd}">
        </div>
        <div class="w3-col s12 buttons">
          <button type="button" id="editVideoJumpStart">jump start</button>
          <button type="button" id="editVideoJumpEnd">jump end</button>
          <button type="button" id="editVideoSetStartHere">set start here</button>
          <button type="button" id="editVideoSetEndHere">set end here</button>
          <button type="button" id="editVideoClearEnd">clear end</button>
        </div>
        <div class="w3-col s12">
          <span class="player" id="editVideoOpenPlayer">
            Open player <i class="fas fa-external-link-alt"></i>
          </span>
        </div>
      </div>`
    : ''
  }
  ${node ?
  `${wuwei.edit.style.markup.shapeSizeRows({
    shape: shape,
    size: node.size,
    options: shapes
  })}
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
        { id: 'content', label: 'Content', html: contentRows(node, page, thumbnailUri) },
        { id: 'rights', label: 'Source / Rights', html: rightsRows(node) }
      ]),
      '</form>'
    ].join('\n');
    return html;
  };

  function t(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
} ());
// edit.uploaded.markup.js 2026-05-17
