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

  const template = function( param ) {
    let
      node = param.node,
      shape = node.shape,
      style = node.style || {},
      font = (node.style && node.style.font) || node.font || {},
      resourceUri = (node && node.resource && node.resource.uri) || '',
      match, matchP,
      page = null,
      option = param.option;
    const fontAlign = getFontAlign(node);
    const fontSizeValue = normalizeFontSizeValue(font && font.size);
    if ('upload' !== node.option) {
      return '';
    }
    match = resourceUri.match(/^content\/.*\.pdf/);
    if (match) {
      matchP = resourceUri.match(/^(content\/.*\.pdf)#page=([0-9]*)$/);
      if (matchP) {
        resourceUri  = matchP[1];
        page = +matchP[2];
      }
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
    <textarea id="rName" name="label" data-path="label" class="w3-col s12" rows="${rowcount(node.label || '')}" 
        placeholder="${translate('Label')}">${node.label || ''}</textarea>
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
    <textarea id="rValue_comment" name="description.body" data-path="description.body" class="w3-col s12" rows="${rowcount(value || '')}"
          placeholder="${translate('Comment')}\nAsciiDoc\n**text** Bold Text\n*text* Italic Text\n+text+ Underline Text\n~~text~~ Strikethrough Text\n^text^ Superscript\n~text~ Subscript\n* text <ul>\n. text <ol>\n= text <h1>\n====== text <h6>\n----\nsource code\n----">${value}</textarea>
  </div>
  <div class="w3-row">
  <label for="rUri" class="w3-col s4">url</label>
  <input type="text" id="rUri" name="resource.uri" data-path="resource.uri" class="w3-col s8"
      value="${resourceUri || ''}">
  </div>
  ${match
    ? `<div class="w3-row">
        <label for="rUri" class="w3-col s4">${translate('page')}</label>
        <input type="text" id="pdfPage" name="pdfPage" class="w3-col s8" value="${page ? page : ''}">
      </div>`
    : ''
  }

  ${isVideo
    ? `<div class="w3-row">
        <div class="frame video w3-col s12">
          <video id="editVideoPlayer" controls playsinline preload="metadata"></video>
        </div>
      </div>

      <div class="w3-row video-controls">
        <label class="w3-col s12">${translate('clip range')}</label>
        <div class="w3-col s12 time-inputs">
          <input id="vMediaStart" type="text" placeholder="start 00:01:23.5">
          <input id="vMediaEnd" type="text" placeholder="end (optional) 00:02:10">
          <input type="hidden" id="rMedia_start" name="timeRange.start" data-path="timeRange.start" value="${mediaStart}">
          <input type="hidden" id="rMedia_end" name="timeRange.end" data-path="timeRange.end" value="${mediaEnd}">
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
    <label for="rPurpose" class="w3-col s4">${translate('Purpose')}</label>
    ${selectOptions('rPurpose', node.purposee, motivations, 'Select motivaton')}
  </div> 
-->
  ${node ?
  `<div class="w3-row">
    <label for="nShape" class="w3-col s4">${translate('Shape')}</label>
    ${selectOptions('nShape', node.shape, shapes, 'Select shape').replace('name="nShape"', 'name="shape" data-path="shape"')}
  </div>
  <div class="w3-row" id="radius"
      style="display:${'CIRCLE' === shape ? 'block' : 'none'}">
    <label for="nSize_radius" class="w3-col s4">${translate('Radius')}</label>  
    <input type="number" id="nSize_radius" name="nSize_radius"  value="${node.size && node.size.radius}" class="w3-col s8">
  </div>
  <div class="w3-row" id="width-height"
      style="display:${'CIRCLE' === shape ? 'none' : 'block'}">
    <label for="nSize_width" class="w3-col s2">${translate('Width')}</label>  
    <input type="number" id="nSize_width" name="size.width" data-path="size.width" value="${node.size && node.size.width}" class="w3-col s4">
    <label for="nSize_height" class="w3-col s2">${translate('Height')}</label>  
    <input type="number" id="nSize_height" name="size.height" data-path="size.height" value="${node.size && node.size.height}" class="w3-col s4">
  </div>
  ${'Topic' === node.type && node.text
    ? `<div class="w3-row" id="text_position">
        <label for="nText_position" class="w3-col s4">${translate('Text position')}</label>
        ${selectOptions('nText_position', node.text.position, positions, 'Select text position')}
      </div>
      <div class="w3-row" id="text_width-height">
        <label for="nText_width" class="w3-col s2">${translate('Width')}</label>  
        <input type="number" id="nText_width" name="nText_width" value="${node.text.width}" class="w3-col s4">
        <label for="nText_height" class="w3-col s2">${translate('Height')}</label>  
        <input type="number" id="nText_height" name="nText_height" value="${node.text.height}" class="w3-col s4">
      </div>`
    : ''
  }
  <div class="w3-row">
    <label for="nColor" class="w3-col s4">${translate('Background')}</label>  
    <input type="color" id="nColor" name="style.fill" data-path="style.fill" value="${style.fill || node.color}" class="w3-col s4 pointer">
    <div id="nodeColor" name="nodeColor" class="w3-col s4 pointer"></div>
  </div>
  <div class="w3-row">
    <label for="nFont_color" class="w3-col s3">${translate('Text')}</label>  
    <input type="color" id="nFont_color" name="style.font.color" data-path="style.font.color" value="${font && font.color}" class="w3-col s3 pointer">
    <div id="nodeFont_color" name="nodeFont_color" class="w3-col s3 pointer"></div>
    ${selectOptions('nFont_size', fontSizeValue, fontSizes, 'Select font size', 's3').replace('name="nFont_size"', 'name="style.font.size" data-path="style.font.size"')}
  </div>
  <div class="w3-row">
    <label for="nGroup" class="w3-col s4">${translate('Group')}</label>  
    <input type="text" id="nGroup" name="nGroup" value="${node.group || ''}" class="w3-col s8">
  </div>`
  : ``
}
<!--
  <div class="w3-row">
    <label for="rType" class="w3-col s4">${translate('Type')}</label>
    ${selectOptions('rType', node.type, types, 'Select node type')}
  </div>
  <div class="w3-row">
    <label for="rFormat" class="w3-col s4">${translate('Format')}</label>
    <input type="text" id="rFormat" name="rFormat" value="${(node.resource && node.resource.mimeType) || ''}" class="w3-col s8">
  </div> -->
<!--  <div class="w3-row">
    <label for="rLanguage" class="w3-col s4">${translate('Language')}</label>
    <input type="text" id="rLanguage" name="rLanguage" value="${node.language || ''}" class="w3-col s8">
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

  function translate(str) {
    return wuwei.edit.markup.translate(str);
  }

  return {
    template: template
  };
} ());
// edit.uploaded.markup.js 2026-04-20
