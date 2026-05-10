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
  function rowcount(str) {
    return wuwei.edit.markup.rowcount(str || '');
  }
  function t(str) {
    return wuwei.nls.translate(str)
  }
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
        '<textarea id="label" name="label" class="w3-col s12 edit-value" rows="' + rowcount(title) + '" placeholder="' + t('Label') + '">' + escapeHtml(title) + '</textarea>',
      '</div>',
      '<div class="w3-row">',
        '<textarea id="description_body" name="description.body" class="w3-col s12 edit-value" rows="' + rowcount(value) + '" placeholder="' + t('Comment') + '">' + escapeHtml(value) + '</textarea>',
      '</div>' +
      '<div class="w3-row">',
        '<label for="resource_kind" class="w3-col s4">' + t('Media type') + '</label>',
        selectOptions('resource.kind',
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
        '<label for="resource_canonicalUri" class="w3-col s2">URL:</label>',
        '<input type="text" id="resource_canonicalUri" name="resource.canonicalUri" class="w3-col s10 edit-value" value="' + escapeHtml(resourceUri) + '">',
      '</div>' +
      '<div class="frame video ' + (hosted ? 'hosted' : 'html5') + '">' + previewHtml + '</div>' +
      '<div class="controls video">' +
        '<input id="timeRange_start" name="timeRange.start" type="hidden" value="' + escapeHtml(startStr) + '">',
        '<input id="timeRange_end" name="timeRange.end" type="hidden" value="' + escapeHtml(endStr) + '">',
        '<div class="video-duration" id="editVideoDuration">' + escapeHtml(durationStr || '00:00:00') + '</div>',
      '</div>' +
      '<div class="buttons" style="margin-top:8px;">',
        '<span class="player-link" id="editVideoOpenPlayer">Open Media Player. <i class="fas fa-external-link-alt"></i></span>',
      '</div>')
    if (node) {
      html.push('<div class="w3-row">',
        '<label for="shape" class="w3-col s4">' + t('Shape') + '</label>',
      selectOptions('shape', node.shape, shapes, t('Select shape')),
      '</div>',
      '<div class="w3-row" id="width-height">',
        '<label for="size_width" class="w3-col s2">' + t('Width') + '</label>',
        '<input type="number" id="size_width" name="size.width" value="' + (node.size && node.size.width || '') + '" class="w3-col s4 edit-value">',
        '<label for="size_height" class="w3-col s2">' + t('Height') + '</label>',
        '<input type="number" id="size_height" name="size.height" value="' + (node.size && node.size.height || '') + '" class="w3-col s4 edit-value">',
      '</div>',
      '<div class="w3-row">',
        '<label for="style_fill" class="w3-col s4">' + t('Background') + '</label>',
        '<input type="color" id="style_fill" name="style.fill" value="' + escapeHtml(style.fill || node.color) + '" class="w3-col s4 pointer edit-value">',
        '<div id="style_fill_palette" name="style_fill_palette" class="w3-col s4 pointer"></div>',
      '</div>',
      '<div class="w3-row">',
        '<label for="style_font_color" class="w3-col s3">' + t('Text') + '</label>',
        '<input type="color" id="style_font_color" name="style.font.color" value="' + escapeHtml(font && font.color || '') + '" class="w3-col s3 pointer edit-value">',
        '<div id="style_font_color_palette" name="style_font_color_palette" class="w3-col s3 pointer"></div>',
        selectOptions('style.font.size', fontSizeValue, fontSizes, t('Select font size'), 's3') ,
      '</div>');
    }
    html.push('</div>');
    return html.join('');
  };
  return { template: template };
})();
