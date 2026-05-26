/**
 * info.document.markup.js
 * wuwei info.document template
 *
 * Renders document Content nodes through wuwei.document / wuwei.resource.
 */
wuwei.info = wuwei.info || {};
wuwei.info.document = wuwei.info.document || {};
wuwei.info.document.markup = (function () {
  'use strict';

  function t(str) {
    return wuwei.nls.translate(str);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escJs(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  function rowcount(value) {
    return wuwei.info.markup.rowcount(value || '');
  }

  function getResource(node) {
    if (wuwei.resource && typeof wuwei.resource.getResource === 'function') {
      return wuwei.resource.getResource(node);
    }
    return (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
  }

  function getDisplayedPageNumber(option) {
    var point = option && (
      option.displayedContentTarget ||
      option.displayedPageMarker ||
      option.contentTarget ||
      option.contentTargetPoint ||
      option.contentsPoint
    );
    var value = point && point.pageNumber;
    if (value == null || value === '') {
      value = option && (option.pageNumber || option.contentsPageNumber || option.page);
    }
    return value == null || value === '' ? '' : String(value);
  }

  function getFrameUrl(node, option) {
    var page = getDisplayedPageNumber(option);
    var url = '';
    if (wuwei.document && typeof wuwei.document.getViewerPageUrl === 'function') {
      url = wuwei.document.getViewerPageUrl(node, page || null, option || {});
    }
    else if (wuwei.document && typeof wuwei.document.getViewerUrl === 'function') {
      url = wuwei.document.getViewerUrl(node, option || {});
    }
    else if (wuwei.resource && typeof wuwei.resource.getViewerUrl === 'function') {
      url = wuwei.resource.getViewerUrl(node);
    }
    return String(url || '');
  }

  function getRights(node) {
    var resource = getResource(node);
    var rights = (resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    return {
      credit: String(rights.attribution || rights.credit || resource.attribution || resource.credit || ''),
      license: String(rights.license || resource.license || ''),
      owner: String(rights.owner || resource.owner || '')
    };
  }

  function template(param) {
    var node = param && param.node;
    var option = param && param.option;
    var resource = getResource(node);
    var description = node && node.description;
    var body = (description && typeof description.body === 'string') ? description.body : '';
    var label = (node && node.label) ||  '';
    var frameUrl = getFrameUrl(node, option);
    var openUrl = (wuwei.document && typeof wuwei.document.getOpenUrl === 'function')
      ? wuwei.document.getOpenUrl(node, option || {})
      : frameUrl;
    var page = getDisplayedPageNumber(option);
    var documentKind = (wuwei.document && typeof wuwei.document.getDocumentKind === 'function')
      ? wuwei.document.getDocumentKind(node)
      : (resource.documentKind || '');
    var rights = getRights(node);

    return [
      '<form id="infoform" class="form-group info document">',
      label ? '<div class="w3-row"><textarea id="label" class="w3-col s12" rows="' + rowcount(label) + '" disabled>' + esc(label) + '</textarea></div>' : '',
      documentKind ? '<div class="w3-row"><label class="w3-col s5">' + t('Document kind') + '</label><span class="w3-col s7">' + esc(documentKind) + '</span></div>' : '',
      page ? '<div class="w3-row info-page-number"><label class="w3-col s5">' + t('Page number') + '</label><span class="w3-col s7">' + esc(page) + '</span></div>' : '',
      frameUrl ? '<iframe id="infoDocumentFrame" class="info-document-frame" src="' + esc(frameUrl) + '"></iframe>' : '',
      frameUrl ? '<div class="info-document-actions"><span class="player w3-row" onclick="wuwei.info.openWindow(\'' + escJs(openUrl || frameUrl) + '\', \'wuwei\', \'width=800, height=600\')">' + t('Click to open window') + '<i class="fas fa-external-link-alt"></i></span></div>' : '',
      body ? '<div class="w3-row"><textarea id="description_body" class="w3-col s12" rows="' + rowcount(body) + '" disabled>' + esc(body) + '</textarea></div>' : '',
      rights.credit ? '<div class="w3-row"><label class="w3-col s4">' + t('Credit') + '</label><input type="text" class="w3-col s8" value="' + esc(rights.credit) + '" disabled></div>' : '',
      rights.license ? '<div class="w3-row"><label class="w3-col s4">' + t('License') + '</label><input type="text" class="w3-col s8" value="' + esc(rights.license) + '" disabled></div>' : '',
      '</form>'
    ].join('\n');
  }

  return { template: template };
})();
// info.document.markup.js
