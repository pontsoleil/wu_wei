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
    var uri = (node && (node.thumbnailUri || node.thumbnail)) || '';
    if (wuwei.util && typeof wuwei.util.getResourceFilePath === 'function' &&
      node && node.resource) {
      uri = wuwei.util.getResourceFilePath(node.resource, 'thumbnail', node) || uri;
    }
    if (wuwei.util && typeof wuwei.util.toStorageRelativePath === 'function' &&
      (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || '')) ||
        /^\/?(resource|note)\//.test(String(uri).replace(/^.*\/wu_wei2\//, '')) ||
        /\/(resource|note)\//.test(String(uri || '')))) {
      uri = wuwei.util.toStorageRelativePath(uri, null, /(?:^|\/)note\//.test(String(uri || '')) ? 'note' : 'resource');
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
      font = (node.style && node.style.font) || node.font || {},
      resourceUri = getEditableResourceUri(node),
      thumbnailUri = getEditableThumbnailUri(node),
      matchP,
      page = null,
      option = param.option;
    const fontAlign = getFontAlign(node);
    const fontSizeValue = normalizeFontSizeValue(font && font.size);
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
    var html = `
<form id="editform" class="uploaded form-group content" onsubmit="return false;">
  <div class="w3-row">
    <textarea id="label" name="label" class="w3-col s12 edit-value" rows="${rowcount(node.label || '')}" 
        placeholder="${t('Label')}">${node.label || ''}</textarea>
  </div>
  ${node && node.font
    ? `<div class="nFont_text-anchor w3-row">
        <i class="nFont_text-anchor start fas fa-align-left ${'left' === fontAlign ? 'checked' : ''}"></i>  
        <i class="nFont_text-anchor middle fas fa-align-center ${'center' === fontAlign ? 'checked' : ''}"></i>
        <i class="nFont_text-anchor end fas fa-align-right ${'right' === fontAlign ? 'checked' : ''}"></i>
      </div>`
    : ''
  }
  <div class="w3-row">
    <textarea id="description_body" name="description.body" class="w3-col s12 edit-value" rows="${rowcount(value || '')}"
          placeholder="${t('Comment')}\nAsciiDoc\n**text** Bold Text\n*text* Italic Text\n+text+ Underline Text\n~~text~~ Strikethrough Text\n^text^ Superscript\n~text~ Subscript\n* text <ul>\n. text <ol>\n= text <h1>\n====== text <h6>\n----\nsource code\n----">${value}</textarea>
  </div>
  <div class="w3-row">
    <label for="pdfPage" class="w3-col s4">&#12506;&#12540;&#12472;&#30058;&#21495;:</label>
    <input type="text" id="pdfPage" name="pdfPage" class="w3-col s8" value="${page ? page : ''}">
  </div>
  <div class="w3-row">
  <label for="resource_uri" class="w3-col s2">URL:</label>
  <input type="text" id="resource_uri" name="resource.uri" class="w3-col s10 edit-value" readonly aria-readonly="true"
      value="${resourceUri || ''}">
  </div>
  <div class="w3-row">
    <label for="resource_kind" class="w3-col s6">${t('Media type')}</label>
    <input type="text" id="resource_kind" name="resource.kind" class="w3-col s6 edit-value" readonly aria-readonly="true"
      value="${getMediaKindValue(node) || 'auto'}">
  </div>
  <div class="w3-row">
  <label for="thumbnailUri" class="w3-col s4">${t('THUMBNAIL')}</label>
  <input type="text" id="thumbnailUri" name="thumbnailUri" class="w3-col s8 edit-value" readonly aria-readonly="true"
      value="${thumbnailUri || ''}">
  </div>
  <div class="w3-row">
    <label for="resource_rights_attribution" class="w3-col s4">${t('Credit')}</label>
    <input type="text" id="resource_rights_attribution" name="resource.rights.attribution" class="w3-col s8 edit-value"
      value="${(node.resource && node.resource.rights && node.resource.rights.attribution) || node.resource && node.resource.attribution || ''}">
  </div>
  <div class="w3-row">
    <label for="resource_rights_license" class="w3-col s4">${t('License')}</label>
    <input type="text" id="resource_rights_license" name="resource.rights.license" class="w3-col s8 edit-value"
      value="${(node.resource && node.resource.rights && node.resource.rights.license) || node.resource && node.resource.license || ''}">
  </div>
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
<!--
  <div class="w3-row">
    <label for="rPurpose" class="w3-col s4">${t('Purpose')}</label>
    ${selectOptions('rPurpose', node.purposee, motivations, 'Select motivaton')}
  </div> 
-->
  ${node ?
  `<div class="w3-row">
    <label for="shape" class="w3-col s4">${t('Shape')}</label>
    ${selectOptions('shape', node.shape, shapes, 'Select shape')}
  </div>
  <div class="w3-row" id="radius"
      style="display:${'CIRCLE' === shape ? 'block' : 'none'}">
    <label for="size_radius" class="w3-col s4">${t('Radius')}</label>  
    <input type="number" id="size_radius" name="size.radius"  value="${node.size && node.size.radius}" class="w3-col s8 edit-value">
  </div>
  <div class="w3-row" id="width-height"
      style="display:${'CIRCLE' === shape ? 'none' : 'block'}">
    <label for="size_width" class="w3-col s2">${t('Width')}</label>  
    <input type="number" id="size_width" name="size.width" value="${node.size && node.size.width}" class="w3-col s4 edit-value">
    <label for="size_height" class="w3-col s2">${t('Height')}</label>  
    <input type="number" id="size_height" name="size.height" value="${node.size && node.size.height}" class="w3-col s4 edit-value">
  </div>
  ${'Topic' === node.type && node.text
    ? `<div class="w3-row" id="text_position">
        <label for="text_position" class="w3-col s4">${t('Text position')}</label>
        ${selectOptions('text.position', node.text.position, positions, 'Select text position')}
      </div>
      <div class="w3-row" id="text_width-height">
        <label for="text_width" class="w3-col s2">${t('Width')}</label>  
        <input type="number" id="text_width" name="text.width" value="${node.text.width}" class="w3-col s4 edit-value">
        <label for="text_height" class="w3-col s2">${t('Height')}</label>  
        <input type="number" id="text_height" name="text.height" value="${node.text.height}" class="w3-col s4 edit-value">
      </div>`
    : ''
  }
  <div class="w3-row">
    <label for="style_fill" class="w3-col s4">${t('Background')}</label>  
    <input type="color" id="style_fill" name="style.fill" value="${style.fill || node.color}" class="w3-col s4 pointer edit-value">
    <div id="style_fill_palette" name="style_fill_palette" class="w3-col s4 pointer"></div>
  </div>
  <div class="w3-row">
    <label for="style_font_color" class="w3-col s3">${t('Text')}</label>  
    <input type="color" id="style_font_color" name="style.font.color" value="${font && font.color}" class="w3-col s3 pointer edit-value">
    <div id="style_font_color_palette" name="style_font_color_palette" class="w3-col s3 pointer"></div>
    ${selectOptions('style.font.size', fontSizeValue, fontSizes, 'Select font size', 's3')}
  </div>
  <div class="w3-row">
    <label for="group" class="w3-col s4">${t('Group')}</label>  
    <input type="text" id="group" name="group" value="${node.group || ''}" class="w3-col s8 edit-value">
  </div>`
  : ``
}
<!--
  <div class="w3-row">
    <label for="rType" class="w3-col s4">${t('Type')}</label>
    ${selectOptions('rType', node.type, types, 'Select node type')}
  </div>
  <div class="w3-row">
    <label for="rFormat" class="w3-col s4">${t('Format')}</label>
    <input type="text" id="rFormat" name="rFormat" value="${(node.resource && node.resource.mimeType) || ''}" class="w3-col s8 edit-value">
  </div> -->
<!--  <div class="w3-row">
    <label for="rLanguage" class="w3-col s4">${t('Language')}</label>
    <input type="text" id="rLanguage" name="rLanguage" value="${node.language || ''}" class="w3-col s8 edit-value">
  </div> -->

</form>
`;
    return html;
  };

  function selectOptions(name, value, options, placeholder, size) { 
    return wuwei.edit.markup.selectOptions(name, value, options, placeholder, size);
  }

  function rowcount(str) {
    return wuwei.edit.markup.rowcount(str);
  }

  function t(str) {
    return wuwei.edit.markup.translate(str);
  }

  return {
    template: template
  };
} ());
// edit.uploaded.markup.js 2026-04-20
