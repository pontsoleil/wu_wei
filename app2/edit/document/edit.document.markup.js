/**
 * edit.document.markup.js
 * wuwei edit.document template
 *
 * Document-specific edit pane.  The document module owns document metadata
 * such as documentKind, page count, firstPageNumber and pageOffset.  Runtime
 * URLs are resolved through wuwei.document / wuwei.resource helpers.
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.document = wuwei.edit.document || {};
wuwei.edit.document.markup = (function () {
  'use strict';

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

  function getResource(node) {
    if (wuwei.resource && typeof wuwei.resource.getResource === 'function') {
      return wuwei.resource.getResource(node);
    }
    return (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
  }

  function getThumbnailUrl(node) {
    var resource = getResource(node);
    if (wuwei.resource && typeof wuwei.resource.getThumbnailUrl === 'function') {
      return editableResourceUrl(wuwei.resource.getThumbnailUrl(node) || '');
    }
    if (wuwei.resource && typeof wuwei.resource.getRolePath === 'function') {
      return wuwei.resource.getRolePath(node, 'thumbnail') || '';
    }
    return editableResourceUrl(resource.thumbnailUri || resource.thumbnailUrl || '');
  }

  function getFontAlign(node) {
    var align = node && node.style && node.style.font && node.style.font.align;
    var anchor;
    if (align) { return String(align).toLowerCase(); }
    anchor = node && node.font && node.font['text-anchor'];
    if (anchor === 'start') { return 'left'; }
    if (anchor === 'end') { return 'right'; }
    return 'center';
  }

  function normalizeFontSizeValue(value) {
    if (value == null || value === '' || Number(value) === 14) { return '12pt'; }
    if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))) { return String(value) + 'pt'; }
    return String(value);
  }

  function readonlyRow(id, label, value, labelSize, valueSize, className) {
    return [
      '<div class="w3-row">',
      '  <label for="' + esc(id) + '" class="w3-col ' + (labelSize || 's5') + '">' + t(label) + '</label>',
      '  <input type="text" id="' + esc(id) + '" class="w3-col ' + (valueSize || 's7') + (className ? (' ' + className) : '') + '" readonly aria-readonly="true" value="' + esc(value || '') + '">',
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

  function documentRows(node) {
    var resource = getResource(node);
    var contents = (resource.contents && typeof resource.contents === 'object') ? resource.contents : {};
    var documentKind = (wuwei.document && typeof wuwei.document.getDocumentKind === 'function')
      ? wuwei.document.getDocumentKind(node)
      : (resource.documentKind || '');
    var pageCount = (wuwei.document && typeof wuwei.document.getPageCount === 'function')
      ? wuwei.document.getPageCount(node)
      : (contents.pageCount || '');
    var firstPageNumber = (wuwei.document && typeof wuwei.document.getFirstPageNumber === 'function')
      ? wuwei.document.getFirstPageNumber(node)
      : (contents.firstPageNumber || 1);
    var pageOffset = (wuwei.document && typeof wuwei.document.getPageOffset === 'function')
      ? wuwei.document.getPageOffset(node)
      : Math.max(0, Number(firstPageNumber || 1) - 1);
    var viewerUrl = (wuwei.document && typeof wuwei.document.getViewerUrl === 'function')
      ? wuwei.document.getViewerUrl(node)
      : '';
    var openUrl = (wuwei.document && typeof wuwei.document.getOpenUrl === 'function')
      ? wuwei.document.getOpenUrl(node)
      : '';

    return [
      readonlyRow('document_resource_source', 'Source', resource.source || ''),
      readonlyRow('document_resource_kind', 'Media type', resource.kind || 'document'),
      resourceTextRow(resource, 'resource_documentKind', 'Document kind', documentKind || resource.documentKind || '', 's5', 's7', 'pdf / html / office / text'),
      resourceTextRow(resource, 'resource_title', 'Title', resource.title || ''),
      readonlyRow('document_resource_mimeType', 'MIME', resource.mimeType || ''),
      resourceTextRow(resource, 'resource_uri', 'URL:', editableResourceUrl(resource.uri || (resource.original && resource.original.url) || ''), 's5', 's7', 'https://...'),
      resourceTextRow(resource, 'resource_canonicalUri', 'Canonical URI', editableResourceUrl(resource.canonicalUri || (resource.original && resource.original.canonicalUrl) || '')),
      resourceTextRow(resource, 'resource_original_url', 'Original URL', editableResourceUrl(resource.original && resource.original.url || resource.uri || ''), 's5', 's7', 'https://...'),
      readonlyRow('document_resource_viewerUrl', 'Viewer URL', viewerUrl || '', 's5', 's7', 'edit-document-viewer-url'),
      readonlyRow('document_resource_openUrl', 'Open URL', openUrl || '', 's5', 's7', 'edit-document-viewer-url'),
      '<div class="w3-row">',
      '  <label for="resource_contents_firstPageNumber" class="w3-col s5">' + t('First page number') + '</label>',
      '  <input type="number" id="resource_contents_firstPageNumber" name="resource.contents.firstPageNumber" class="w3-col s7 edit-value" min="1" step="1" value="' + esc(firstPageNumber || 1) + '">',
      '</div>',
      readonlyRow('resource_contents_pageOffset', 'Page offset', pageOffset),
      readonlyRow('resource_contents_pageCount', 'Page count', pageCount || '')
    ].join('\n');
  }

  function rightsRows(node) {
    var resource = getResource(node);
    var rights = (resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    return [
      readonlyRow('document_rights_source_title', 'Title', resource.title || ''),
      readonlyRow('document_rights_source_uri', 'URL:', editableResourceUrl(resource.uri || '')),
      readonlyRow('document_rights_source_canonicalUri', 'Canonical URI', editableResourceUrl(resource.canonicalUri || '')),
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
      '  <label for="resource_rights_attribution" class="w3-col s12">' + t('Credit') + '</label>',
      '  <textarea id="resource_rights_attribution" name="resource.rights.attribution" class="w3-col s12 edit-value" rows="' + rowcount(rights.attribution || '') + '">' + esc(rights.attribution || '') + '</textarea>',
      '</div>'
    ].join('\n');
  }

  function tabbedPaneHtml(tabs) {
    return [
      '<div class="edit-tabbed-pane">',
      '<div class="w3-bar w3-light-grey edit-tab-buttons">',
      tabs.map(function (tab, index) {
        return '<button type="button" class="w3-button w3-small edit-tab-button' + (index ? '' : ' active w3-blue') + '" data-edit-tab="' + esc(tab.id) + '">' + esc(t(tab.label)) + '</button>';
      }).join('\n'),
      '</div>',
      tabs.map(function (tab, index) {
        return '<div class="edit-tab-panel" data-edit-tab-panel="' + esc(tab.id) + '" style="display:' + (index ? 'none' : 'block') + ';">' + tab.html + '</div>';
      }).join('\n'),
      '</div>'
    ].join('\n');
  }

  function template(param) {
    var node = param && param.node;
    var resource = getResource(node);
    var description = node && node.description;
    var body = (description && typeof description.body === 'string') ? description.body : '';
    var style = node && node.style ? node.style : {};
    var font = (node && node.style && node.style.font) || (node && node.font) || {};
    var title = (node && node.label) || resource.title || resource.uri || 'Document';
    var displayHtml = [];

    displayHtml.push('<div class="edit">');
    displayHtml.push(wuwei.edit.style.markup.labelRows({
      label: title,
      align: getFontAlign(node),
      labelSize: 's4',
      alignLabel: 'Label align',
      alignSize: 's8'
    }));
    displayHtml.push(wuwei.edit.style.markup.descriptionRows({
      node: node,
      format: (description && description.format) || 'plain/text',
      body: body
    }));
    if (node) {
      displayHtml.push(
        wuwei.edit.style.markup.shapeSizeRows({
          shape: node.shape,
          size: node.size,
          options: wuwei.common.shapes
        }),
        thumbnailUriInputRow(node, getThumbnailUrl(node)),
        wuwei.edit.style.markup.paintRows({
          style: style,
          fontSize: normalizeFontSizeValue(font && font.size),
          fillPaletteId: 'style_fill_palette',
          fontPaletteId: 'style_font_color_palette'
        })
      );
    }
    displayHtml.push('</div>');

    return [
      '<form id="editform" class="document form-group content" onsubmit="return false;">',
      tabbedPaneHtml([
        { id: 'display', label: 'Display', html: displayHtml.join('\n') },
        { id: 'document', label: 'Document', html: documentRows(node) },
        { id: 'rights', label: 'Source / Rights', html: rightsRows(node) }
      ]),
      '</form>'
    ].join('\n');
  }

  return { template: template };
})();
// edit.document.markup.js
