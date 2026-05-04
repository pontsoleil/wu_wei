/**
 * edit.video.markup.js
 * wuwei edit.video template
 * 
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.video = wuwei.edit.video || {};
wuwei.edit.video.markup = (function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function rowcount(str) { return wuwei.edit.markup.rowcount(str || ''); }
  function translate(str) { return (wuwei.nls && wuwei.nls.translate) ? wuwei.nls.translate(str) : str; }
  function selectOptions(name, value, options, placeholder, size) {
    return wuwei.edit.markup.selectOptions(name, value, options, placeholder, size);
  }
  function normalizeFontSizeValue(value) {
    if (value == null || value === '' || Number(value) === 14) { return '12pt'; }
    if ('number' === typeof value || /^\d+(\.\d+)?$/.test(String(value))) { return String(value) + 'pt'; }
    return String(value);
  }
  function getMediaKindValue(resource) {
    const kind = String(resource && resource.kind || '').toLowerCase();
    const mimeType = String(resource && resource.mimeType || '').toLowerCase();
    const media = resource && resource.media && typeof resource.media === 'object' ? resource.media : {};
    const mediaKind = String(media.kind || '').toLowerCase();
    if (mediaKind === 'video' || kind === 'video' || mimeType.indexOf('video/') === 0) { return 'video'; }
    if (mediaKind === 'audio' || kind === 'audio' || mimeType.indexOf('audio/') === 0) { return 'audio'; }
    if (mediaKind === 'image' || kind === 'image' || mimeType.indexOf('image/') === 0) { return 'image'; }
    if (mediaKind === 'document' || kind === 'pdf' || kind === 'office' || kind === 'document') { return 'document'; }
    if (mediaKind === 'webpage' || kind === 'web' || kind === 'webpage') { return 'webpage'; }
    return kind || mediaKind || '';
  }
  const template = function (param) {
    let node = param.node;
    let resource = (node && node.resource && typeof node.resource === 'object')
      ? node.resource
      : (param.resource || {});
    if (!resource) return '';
    const common = wuwei.common;
    const shapes = common.shapes;
    const fontSizes = common.fontSizes;
    const style = node && node.style ? node.style : {};
    const font = (node && node.style && node.style.font) || (node && node.font) || {};
    const fontSizeValue = normalizeFontSizeValue(font && font.size);
    const resourceUri = resource.canonicalUri || resource.uri || '';
    const description = node && node.description;
    const value = (description && typeof description.body === 'string') ? description.body : '';
    const title = (node && node.label) || resource.title || resourceUri || 'Video';
    const startStr = param.startStr || '00:00:00';
    const endStr = param.endStr || '';
    const durationStr = param.durationStr || '';
    const previewHtml = param.previewHtml || '';
    const hosted = !!param.hosted;
    var html = [];
    html.push('<div class="edit">',
      '<div>',
        '<textarea id="rName" name="label" data-path="label" class="w3-col s12" rows="' + rowcount(title) + '" placeholder="' + translate('Label') + '">' + escapeHtml(title) + '</textarea>',
      '</div>',
      '<div class="w3-row">',
        '<textarea id="rValue_comment" name="description.body" data-path="description.body" class="w3-col s12" rows="' + rowcount(value) + '" placeholder="' + translate('Comment') + '">' + escapeHtml(value) + '</textarea>',
      '</div>' +
      '<div class="w3-row">',
        '<label for="rMedia_kind" class="w3-col s4">' + translate('Media type') + '</label>',
        selectOptions('rMedia_kind',
          getMediaKindValue(resource),
          [
            { value: '', label: 'auto' },
            { value: 'webpage', label: 'webpage' },
            { value: 'document', label: 'document' },
            { value: 'image', label: 'image' },
            { value: 'video', label: 'video' },
            { value: 'audio', label: 'audio' }
          ],
          null,
          's8'),
      '</div>' +
      '<div class="w3-row">',
        '<label for="rUri" class="w3-col s2">URL:</label>',
        '<input type="text" id="rUri" name="resource.canonicalUri" data-path="resource.canonicalUri" class="w3-col s10" value="' + escapeHtml(resourceUri) + '">',
      '</div>' +
      '<div class="frame video ' + (hosted ? 'hosted' : 'html5') + '">' + previewHtml + '</div>' +
      '<div class="controls video">' +
        '<input id="editVideoStart" name="timeRange.start" data-path="timeRange.start" type="hidden" value="' + escapeHtml(startStr) + '">',
        '<input id="editVideoEnd" name="timeRange.end" data-path="timeRange.end" type="hidden" value="' + escapeHtml(endStr) + '">',
        '<div class="video-duration" id="editVideoDuration">' + escapeHtml(durationStr || '00:00:00') + '</div>',
      '</div>' +
      '<div class="buttons" style="margin-top:8px;">',
        '<span class="player-link" id="editVideoOpenPlayer">Open Media Player. <i class="fas fa-external-link-alt"></i></span>',
      '</div>')
    if (node) {
      html.push('<div class="w3-row">',
        '<label for="nShape" class="w3-col s4">' + translate('Shape') + '</label>',
      selectOptions('nShape', node.shape, shapes, translate('Select shape')).replace('name="nShape"', 'name="shape" data-path="shape"'),
      '</div>',
      '<div class="w3-row" id="width-height">',
        '<label for="nSize_width" class="w3-col s2">' + translate('Width') + '</label>',
        '<input type="number" id="nSize_width" name="size.width" data-path="size.width" value="' + (node.size && node.size.width || '') + '" class="w3-col s4">',
        '<label for="nSize_height" class="w3-col s2">' + translate('Height') + '</label>',
        '<input type="number" id="nSize_height" name="size.height" data-path="size.height" value="' + (node.size && node.size.height || '') + '" class="w3-col s4">',
      '</div>',
      '<div class="w3-row">',
        '<label for="nColor" class="w3-col s4">' + translate('Background') + '</label>',
        '<input type="color" id="nColor" name="style.fill" data-path="style.fill" value="' + escapeHtml(style.fill || node.color) + '" class="w3-col s4 pointer">',
        '<div id="nodeColor" name="nodeColor" class="w3-col s4 pointer"></div>',
      '</div>',
      '<div class="w3-row">',
        '<label for="nFont_color" class="w3-col s3">' + translate('Text') + '</label>',
        '<input type="color" id="nFont_color" name="style.font.color" data-path="style.font.color" value="' + escapeHtml(font && font.color || '') + '" class="w3-col s3 pointer">',
        '<div id="nodeFont_color" name="nodeFont_color" class="w3-col s3 pointer"></div>',
        selectOptions('nFont_size', fontSizeValue, fontSizes, translate('Select font size'), 's3').replace('name="nFont_size"', 'name="style.font.size" data-path="style.font.size"') ,
      '</div>');
    }
    html.push('</div>');
    return html.join('');
  };
  return { template: template };
})();
