/**
 * edit.image.markup.js
 * wuwei edit.image template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.image = wuwei.edit.image || {};
wuwei.edit.image.markup = (function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
    return match ? (match[1] + getUrlHash(s)) : s;
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
      '  <input type="text" id="' + id + '" name="' + String(id || '').replace(/_/g, '.') + '" class="w3-col ' + (valueSize || 's7') + ' edit-value" value="' + escapeHtml(value || '') + '"' + (placeholder ? (' placeholder="' + escapeHtml(placeholder) + '"') : '') + '>',
      '</div>'
    ].join('\n');
  }

  function resourceTextRow(resource, id, label, value, labelSize, valueSize, placeholder) {
    return isRemoteResource(resource)
      ? editableTextRow(id, label, value, labelSize, valueSize, placeholder)
      : readonlyRow(id, label, value, labelSize, valueSize);
  }

  function imageUriInputRow(node, value) {
    var visible = String(node && node.shape || '').toUpperCase() === 'THUMBNAIL';
    value = editableResourceUrl(value);
    return [
      '<div class="w3-row thumbnail-uri-row" style="display:' + (visible ? 'block' : 'none') + ';">',
      '  <label for="resource_uri" class="w3-col s5">' + t('URL:') + '</label>',
      '  <input type="text" id="resource_uri" name="resource.uri" class="w3-col s7 edit-value" value="' + escapeHtml(value || '') + '" placeholder="' + escapeHtml('https://... or upload path') + '">',
      '</div>'
    ].join('\n');
  }

  function getImageUrl(node) {
    if (wuwei.resource && typeof wuwei.resource.getPrimaryPreviewUrl === 'function') {
      return editableResourceUrl(wuwei.resource.getPrimaryPreviewUrl(node) || '');
    }
    if (wuwei.resource && typeof wuwei.resource.getOriginalUrl === 'function') {
      return editableResourceUrl(wuwei.resource.getOriginalUrl(node) || '');
    }
    return editableResourceUrl(String(node && node.resource && (node.resource.canonicalUri || node.resource.uri) || ''));
  }

  function getThumbnailUrl(node, resource) {
    if (wuwei.resource && typeof wuwei.resource.getThumbnailUrl === 'function') {
      return editableResourceUrl(wuwei.resource.getThumbnailUrl(node) || '');
    }
    return editableResourceUrl(resource && (resource.thumbnailUri || resource.thumbnailUrl) || '');
  }

  function getImageOriginalEditUrl(node, resource) {
    resource = resource || {};

    if (wuwei.resource && typeof wuwei.resource.getRolePath === 'function') {
      var rolePath = wuwei.resource.getRolePath(node, 'original');
      if (rolePath) {
        return editableResourceUrl(rolePath);
      }
    }

    if (wuwei.util && typeof wuwei.util.getResourceFilePath === 'function') {
      var filePath = wuwei.util.getResourceFilePath(resource, 'original', node);
      if (filePath) {
        return editableResourceUrl(filePath);
      }
    }

    if (resource.original && typeof resource.original === 'object' && resource.original.url) {
      return editableResourceUrl(resource.original.url);
    }

    if (wuwei.resource && typeof wuwei.resource.getOriginalUrl === 'function') {
      var originalUrl = wuwei.resource.getOriginalUrl(node);
      if (originalUrl) {
        return editableResourceUrl(originalUrl);
      }
    }

    return editableResourceUrl(resource.uri || '');
  }

  function getPreviewUrl(node) {
    if (wuwei.resource && typeof wuwei.resource.getPreviewUrl === 'function') {
      return editableResourceUrl(wuwei.resource.getPreviewUrl(node) || '');
    }
    return '';
  }

  function getOriginalUrl(node) {
    if (wuwei.resource && typeof wuwei.resource.getOriginalUrl === 'function') {
      return editableResourceUrl(wuwei.resource.getOriginalUrl(node) || '');
    }
    return editableResourceUrl(String(node && node.resource && (node.resource.canonicalUri || node.resource.uri) || ''));
  }

  function imagePreviewHtml(node) {
    var src = getImageUrl(node);
    if (!src) {
      return '';
    }
    return [
      '<div class="edit-image-content-preview">',
      '  <label class="w3-col s12">' + t('Image preview') + '</label>',
      '  <div class="edit-image-preview-host">',
      '    <img class="edit-image-preview" src="' + escapeHtml(src) + '" alt="' + escapeHtml(t('Image preview')) + '">',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  function getMediaValue(resource, key) {
    var media = resource && resource.media && typeof resource.media === 'object' ? resource.media : {};
    return media[key] || resource && resource[key] || '';
  }

  function contentRows(resource, node) {
    var previewUrl = getPreviewUrl(node);
    var originalUrl = getOriginalUrl(node);
    var runtimeUrl = getImageUrl(node);
    return [
      imagePreviewHtml(node),
      readonlyRow('resource_source', 'Source', resource.source || ''),
      readonlyRow('resource_kind', 'Media type', resource.kind || 'image'),
      resourceTextRow(resource, 'resource_imageKind', 'Image kind', resource.imageKind || '', 's5', 's7', 'jpeg / png / webp'),
      resourceTextRow(resource, 'resource_title', 'Title', resource.title || ''),
      readonlyRow('resource_mimeType', 'MIME', resource.mimeType || ''),
      resourceTextRow(resource, 'resource_uri', 'URL:', editableResourceUrl(resource.uri || (resource.original && resource.original.url) || ''), 's5', 's7', 'https://...'),
      readonlyRow('resource_runtimeUri', 'Runtime URL', runtimeUrl),
      readonlyRow('resource_originalUri', 'Original URL', originalUrl),
      readonlyRow('resource_previewUri', 'Preview URL', previewUrl),
      readonlyRow('resource_media_width', 'Width', getMediaValue(resource, 'width')),
      readonlyRow('resource_media_height', 'Height', getMediaValue(resource, 'height'))
    ].join('\n');
  }

  function rightsRows(resource) {
    var rights = (resource && resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    return [
      readonlyRow('resource_rights_source_title', 'Title', resource.title || ''),
      readonlyRow('resource_rights_source_uri', 'URL:', editableResourceUrl(resource.uri || '')),
      readonlyRow('resource_rights_source_canonicalUri', 'Canonical URI', editableResourceUrl(resource.canonicalUri || '')),
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

  function template(param) {
    var node = param.node;
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : (param.resource || {});
    var common = wuwei.common;
    var shapes = common.shapes;
    var style = node && node.style ? node.style : {};
    var font = (node && node.style && node.style.font) || (node && node.font) || {};
    var fontSizeValue = normalizeFontSizeValue(font && font.size);
    var fontAlign = getFontAlign(node);
    var description = node && node.description;
    var value = (description && typeof description.body === 'string') ? description.body : '';
    var title = (node && node.label) || resource.title || resource.uri || 'Image';
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
      })
    );
    if (node) {
      displayHtml.push(
        wuwei.edit.style.markup.shapeSizeRows({
          shape: node.shape,
          size: node.size,
          options: shapes
        }),
        imageUriInputRow(node, getImageOriginalEditUrl(node, resource)),
        wuwei.edit.style.markup.paintRows({
          style: style,
          includeLine: true,
          fontSize: fontSizeValue,
          fillPaletteId: 'style_fill_palette',
          linePaletteId: 'style_line_color_palette',
          fontPaletteId: 'style_font_color_palette'
        })
      );
    }
    displayHtml.push('</div>');

    return [
      '<form id="editform" class="image form-group content" onsubmit="return false;">',
      tabbedPaneHtml([
        { id: 'display', label: 'Display', html: displayHtml.join('') },
        { id: 'rights', label: 'Source / Rights', html: rightsRows(resource) }
      ]),
      '</form>'
    ].join('\n');
  }

  return { template: template };
})();
// edit.image.markup.js
