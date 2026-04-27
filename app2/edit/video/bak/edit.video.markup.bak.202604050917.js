/**
 * edit.video.markup.js
 * wuwei edit.video template
 */
wuwei.edit.video = wuwei.edit.video || {};
wuwei.edit.video.markup = (function () {
  const template = function (param) {
    let node = param.node;
    let resource = param.resource || node;
    if (!resource) return '';
    if (resource.option !== 'video') return '';

    const common = wuwei.common;
    const shapes = common.shapes;
    const fontSizes = common.fontSizes;

    const uri = (resource && (resource.uri || resource.url)) ? (resource.uri || resource.url) : '';

    let value = (typeof resource.value === 'string')
      ? wuwei.edit.htmlToAsciiDoc(resource.value)
      : wuwei.edit.htmlToAsciiDoc((resource.value && resource.value.comment) || '');

    // ensure media placeholders (actual defaults enforced by model patch)
    const start = (node && node.media && node.media.start != null) ? node.media.start : 0;
    const end   = (node && node.media && node.media.end != null) ? node.media.end : '';
    // const src = param.src || '';
    // const start = (param.start != null) ? param.start : 0;
    // const end = (param.end != null) ? param.end : null;

    const title = (resource && (resource.name || resource.label))
      ? (resource.name || resource.label)
      : (resource && (resource.uri || resource.url))
        ? (resource.uri || resource.url)
        : 'Video';

    const fmt = (wuwei.info.video && wuwei.info.video.formatSeconds)
      ? wuwei.info.video.formatSeconds
      : (x => String(x));

    const startStr = fmt(start);
    const endStr = (end == null || end === '') ? '' : fmt(end);

    const html = `
  <div class="edit">
    <div>
      <h5 id="rName" name="rName" rows="${rowcount(title)}">${escapeHtml(title)}</h5>
    </div>

  <div class="w3-row">
    <textarea id="rValue_comment" name="rValue_comment" class="w3-col s12" rows="${rowcount(value || '')}"
      placeholder="${translate('Comment')}">${value}</textarea>
  </div>

  ${node && node.font
    ? `<div class="nFont_text-anchor w3-row">
        <i class="start fas fa-align-left ${(!node.font['text-anchor'] && 'Content'===node.type ) || 'start' === node.font['text-anchor'] ? 'checked' : ''}"></i>  
        <i class="middle fas fa-align-center ${(!node.font['text-anchor'] && 'Topic'===node.type ) || 'middle' === node.font['text-anchor'] ? 'checked' : ''}"></i>
        <i class="end fas fa-align-right ${'end' === node.font['text-anchor'] ? 'checked' : ''}"></i>
      </div>`
    : ''
  }

  <div class="w3-row">
    <label for="rUri" class="w3-col s4">url</label>
    <input type="text" id="rUri" name="rUri" class="w3-col s8" value="${uri || ''}">
  </div>

  <div class="frame video">
    <video id="editVideoPlayer" controls playsinline preload="metadata"></video>
  </div>

  <div class="controls video">
    <label class="label">${translate('clip range')}:</label>

    <div class="time-inputs">
      <input id="editVideoStart" type="text" value="${start}" placeholder="start 00:01:23.5">
      <input id="editVideoEnd" type="text" value="${end}" placeholder="end (optional) 00:02:10">
    </div>

    <div class="buttons">
      <button type="button" id="editVideoJumpStart">${translate('jump start')}</button>
      <button type="button" id="editVideoJumpEnd">${translate('jump end')}</button>
      <button type="button" id="editVideoSetStartHere">${translate('set start here')}</button>
      <button type="button" id="editVideoSetEndHere">${translate('set end here')}</button>
      <button type="button" id="editVideoClearEnd">${translate('clear end')}</button>
    </div>

    <div class="buttons" style="margin-top:8px;">
      <button type="button" id="editVideoSaveRange">save</button>
      <span class="player-link" id="editVideoOpenPlayer">Open player <i class="fas fa-external-link-alt"></i></span>
    </div>
  </div>

  ${node ?
  `<div class="w3-row">
    <label for="nShape" class="w3-col s4">${translate('Shape')}</label>
    ${selectOptions('nShape', node.shape, shapes, 'Select shape')}
  </div>
  <div class="w3-row" id="width-height">
    <label for="nSize_width" class="w3-col s2">${translate('Width')}</label>  
    <input type="number" id="nSize_width" name="nSize_width" value="${node.size && node.size.width}" class="w3-col s4">
    <label for="nSize_height" class="w3-col s2">${translate('Height')}</label>  
    <input type="number" id="nSize_height" name="nSize_height" value="${node.size && node.size.height}" class="w3-col s4">
  </div>
  <div class="w3-row">
    <label for="nColor" class="w3-col s4">${translate('Background')}</label>  
    <input type="color" id="nColor" name="nColor" value="${node.color}" class="w3-col s4 pointer">
    <div id="nodeColor" name="nodeColor" class="w3-col s4 pointer"></div>
  </div>
  <div class="w3-row">
    <label for="nFont_color" class="w3-col s3">${translate('Text')}</label>  
    <input type="color" id="nFont_color" name="nFont_color" value="${node.font && node.font.color}" class="w3-col s3 pointer">
    <div id="nodeFont_color" name="nodeFont_color" class="w3-col s3 pointer"></div>
    ${selectOptions('nFont_size', node.font && node.font.size, fontSizes, 'Select font size', 's3')}
  </div>` : ''}

</form>`;
    return html;
  };

  function selectOptions(name, value, options, placeholder, size) {
    return wuwei.edit.markup.selectOptions(name, value, options, placeholder, size);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // for attribute values
  function escapeAttr(s) {
    return escapeHtml(s).replace(/`/g, '&#96;');
  }

  function rowcount(str) {
    return wuwei.edit.markup.rowcount(str);
  }

  function translate(str) {    
    return (wuwei.nls && typeof wuwei.nls.translate === 'function')
      ? wuwei.nls.translate(str)
      : str;
  }

  return { 
    template: template
  };
})();

