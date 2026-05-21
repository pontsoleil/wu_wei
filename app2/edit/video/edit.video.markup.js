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

  function getFontAlign(node) {
    var align = node && node.style && node.style.font && node.style.font.align;
    return align ? String(align).toLowerCase() : 'center';
  }
  function getMediaKindValue(resource) {
    const kind = String(resource && resource.kind || '').toLowerCase();
    const mimeType = String(resource && resource.mimeType || '').toLowerCase();
    if (kind === 'video' || mimeType.indexOf('video/') === 0) { return 'video'; }
    if (kind === 'audio' || mimeType.indexOf('audio/') === 0) { return 'audio'; }
    if (kind === 'image' || mimeType.indexOf('image/') === 0) { return 'image'; }
    if (kind === 'document') { return 'document'; }
    if (resource && resource.documentKind === 'html') { return 'webpage'; }
    return kind || '';
  }

  function rowcount(value) {
    return wuwei.edit.markup.rowcount(value || '');
  }

  function readonlyRow(id, label, value, labelSize, valueSize) {
    return [
      '<div class="w3-row">',
      '  <label for="' + id + '" class="w3-col ' + (labelSize || 's5') + '">' + t(label) + '</label>',
      '  <input type="text" id="' + id + '" class="w3-col ' + (valueSize || 's7') + '" readonly aria-readonly="true" value="' + escapeHtml(value || '') + '">',
      '</div>'
    ].join('\n');
  }

  function contentRows(resource) {
    var contents = (resource && resource.contents && typeof resource.contents === 'object') ? resource.contents : {};
    return [
      readonlyRow('resource_source', 'Source', resource.source || ''),
      readonlyRow('resource_kind', 'Media type', resource.kind || getMediaKindValue(resource) || ''),
      readonlyRow('resource_documentKind', 'Document kind', resource.documentKind || ''),
      readonlyRow('resource_videoKind', 'Video kind', resource.videoKind || ''),
      readonlyRow('resource_title', 'Title', resource.title || ''),
      readonlyRow('resource_mimeType', 'MIME', resource.mimeType || ''),
      readonlyRow('resource_uri', 'URL:', resource.uri || ''),
      readonlyRow('resource_canonicalUri', 'Canonical URI', resource.canonicalUri || ''),
      readonlyRow('thumbnailUri', 'THUMBNAIL', resource.thumbnailUri || ''),
      '<div class="w3-row">',
      '  <label for="resource_contents_pageOffset" class="w3-col s5">' + t('Page offset') + '</label>',
      '  <input type="number" id="resource_contents_pageOffset" name="resource.contents.pageOffset" class="w3-col s7 edit-value" step="1" value="' + escapeHtml(contents.pageOffset == null ? '' : contents.pageOffset) + '">',
      '</div>',
      readonlyRow('resource_contents_pageCount', 'Page count', contents.pageCount == null ? '' : contents.pageCount),
      readonlyRow('resource_contents_pageMin', 'Page min', contents.pageMin == null ? '' : contents.pageMin),
      readonlyRow('resource_contents_pageMax', 'Page max', contents.pageMax == null ? '' : contents.pageMax)
    ].join('\n');
  }

  function rightsRows(resource) {
    var rights = (resource && resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    return [
      readonlyRow('resource_rights_source_title', 'Title', resource.title || ''),
      readonlyRow('resource_rights_source_uri', 'URL:', resource.uri || ''),
      readonlyRow('resource_rights_source_canonicalUri', 'Canonical URI', resource.canonicalUri || ''),
      '<div class="w3-row">',
      '  <label for="resource_rights_owner" class="w3-col s5">' + t('Owner') + '</label>',
      '  <input type="text" id="resource_rights_owner" name="resource.rights.owner" class="w3-col s7 edit-value" value="' + escapeHtml(rights.owner || '') + '">',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_copyright" class="w3-col s12">' + t('Copyright') + '</label>',
      '  <textarea id="resource_rights_copyright" name="resource.rights.copyright" class="w3-col s12 edit-value" rows="' + rowcount(rights.copyright || '') + '">' + escapeHtml(rights.copyright || '') + '</textarea>',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_license" class="w3-col s5">' + t('License') + '</label>',
      '  <input type="text" id="resource_rights_license" name="resource.rights.license" class="w3-col s7 edit-value" value="' + escapeHtml(rights.license || '') + '">',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_attribution" class="w3-col s12">' + t('Attribution') + '</label>',
      '  <textarea id="resource_rights_attribution" name="resource.rights.attribution" class="w3-col s12 edit-value" rows="' + rowcount(rights.attribution || '') + '">' + escapeHtml(rights.attribution || '') + '</textarea>',
      '</div>'
    ].join('\n');
  }

  function tabbedPaneHtml(tabs) {
    return [
      '<div class="edit-tabbed-pane">',
      '<div class="w3-bar w3-light-grey edit-tab-buttons">',
      tabs.map(function (tab, index) {
        return '<button type="button" class="w3-button w3-small edit-tab-button' + (index ? '' : ' active w3-blue') + '" data-edit-tab="' + tab.id + '">' + escapeHtml(t(tab.label)) + '</button>';
      }).join('\n'),
      '</div>',
      tabs.map(function (tab, index) {
        return '<div class="edit-tab-panel" data-edit-tab-panel="' + tab.id + '" style="display:' + (index ? 'none' : 'block') + ';">' + tab.html + '</div>';
      }).join('\n'),
      '</div>'
    ].join('\n');
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
    const fontAlign = getFontAlign(node);
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
    var displayHtml = [];
    displayHtml.push('<div class="edit">',
      wuwei.edit.style.markup.labelRows({
        label: title,
        align: fontAlign,
        labelSize: 's4',
        alignLabel: 'Label align',
        alignSize: 's8'
      }),
      wuwei.edit.style.markup.descriptionRows({
        node: node,
        format: (description && description.format) || 'plain/text',
        body: value
      }),
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
      displayHtml.push(
        wuwei.edit.style.markup.shapeSizeRows({
          shape: node.shape,
          size: node.size,
          options: shapes
        }),
        wuwei.edit.style.markup.paintRows({
          style: style,
          fontSize: fontSizeValue,
          fillPaletteId: 'style_fill_palette',
          fontPaletteId: 'style_font_color_palette'
        })
      );
    }
    displayHtml.push('</div>');
    html.push(
      '<form id="editform" class="video form-group content" onsubmit="return false;">',
      tabbedPaneHtml([
        { id: 'display', label: 'Display', html: displayHtml.join('') },
        { id: 'content', label: 'Content', html: contentRows(resource) },
        { id: 'rights', label: 'Source / Rights', html: rightsRows(resource) }
      ]),
      '</form>'
    );
    return html.join('');
  };
  return { template: template };
})();
