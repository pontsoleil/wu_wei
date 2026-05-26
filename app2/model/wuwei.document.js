/**
 * wuwei.document.js
 * Document content model helpers.
 *
 * This module owns document-specific semantics such as PDF/Office/HTML
 * document kind, page count, first page number, page offset, and conversion
 * between document page numbers and viewer page numbers. Viewpoint/PageMarker
 * modules call this module but keep axis and member editing responsibilities.
 */
wuwei.document = (function () {
  'use strict';

  var util = wuwei.util;

  function getResource(nodeOrResource) {
    if (wuwei.resource && typeof wuwei.resource.getResource === 'function') {
      return wuwei.resource.getResource(nodeOrResource);
    }
    if (!nodeOrResource) { return {}; }
    return nodeOrResource.resource && typeof nodeOrResource.resource === 'object'
      ? nodeOrResource.resource
      : nodeOrResource;
  }

  function getKind(nodeOrResource) {
    if (wuwei.resource && typeof wuwei.resource.getKind === 'function') {
      return wuwei.resource.getKind(nodeOrResource);
    }
    return String(getResource(nodeOrResource).kind || '').toLowerCase();
  }

  function getDocumentKind(nodeOrResource) {
    var resource = getResource(nodeOrResource);
    var text = String(resource.documentKind || '').toLowerCase();
    if (text) { return text; }
    if (util && typeof util.getDocumentKindByExtension === 'function') {
      return String(util.getDocumentKindByExtension(
        nodeOrResource && nodeOrResource.resource ? nodeOrResource : null,
        resource,
        (resource.original && resource.original.url) || resource.uri || resource.canonicalUri || ''
      ) || '').toLowerCase();
    }
    return '';
  }

  function isHtmlDocument(nodeOrResource) {
    var resource = getResource(nodeOrResource);
    var kind = getKind(nodeOrResource);
    var documentKind = getDocumentKind(nodeOrResource);
    var mimeType = String(resource.mimeType || resource.type || '').toLowerCase();
    var source = String(resource.source || '').toLowerCase();
    var original = (resource.original && typeof resource.original === 'object') ? resource.original : {};
    var href = String(
      original.url ||
      original.canonicalUrl ||
      resource.uri ||
      resource.canonicalUri ||
      ''
    );

    return !!(
      documentKind === 'html' ||
      kind === 'webpage' ||
      kind === 'web' ||
      kind === 'html' ||
      mimeType.indexOf('text/html') === 0 ||
      mimeType.indexOf('application/xhtml+xml') === 0 ||
      (source === 'remote' && /\.(?:html?|xhtml)(?:[?#].*)?$/i.test(href)) ||
      (util && typeof util.isDocumentKindByExtension === 'function' &&
        util.isDocumentKindByExtension(
          nodeOrResource && nodeOrResource.resource ? nodeOrResource : null,
          resource,
          (resource.original && resource.original.url) || resource.uri || resource.canonicalUri || '',
          'html'
        ))
    );
  }

  function isDocumentNode(node) {
    if (!node || node.type !== 'Content') { return false; }
    return getKind(node) === 'document' || !!getDocumentKind(node) || isHtmlDocument(node);
  }

  function isContentTargetNode(node) {
    var resource, viewpoint, pageCount, documentKind;

    if (!node || node.type !== 'Content') { return false; }

    resource = getResource(node);
    viewpoint = (resource.viewpoint && typeof resource.viewpoint === 'object') ? resource.viewpoint : ((resource.contents && typeof resource.contents === 'object') ? resource.contents : {});
    pageCount = Number(viewpoint.pageCount || 0);
    documentKind = getDocumentKind(node);

    /*
     * PageMarker-capable targets are determined from resource kind / document
     * kind / extension and known content targets. mimeType is reference
     * information and is not the primary branching key.
     */
    return !!(
      documentKind === 'pdf' ||
      documentKind === 'office' ||
      documentKind === 'html' ||
      documentKind === 'text' ||
      isHtmlDocument(node) ||
      (Number.isFinite(pageCount) && pageCount > 0)
    );
  }

  function getDocumentPageMeta(nodeOrResource, create) {
    var resource;

    if (!nodeOrResource) { return null; }

    if (nodeOrResource.resource && typeof nodeOrResource.resource === 'object') {
      if (nodeOrResource.type && nodeOrResource.type !== 'Content') { return null; }
      resource = nodeOrResource.resource;
    }
    else {
      resource = nodeOrResource;
    }

    if (!resource.viewpoint || typeof resource.viewpoint !== 'object') {
      if (resource.contents && typeof resource.contents === 'object') {
        resource.viewpoint = resource.contents;
        delete resource.contents;
      }
      else {
        if (!create) { return null; }
        resource.viewpoint = {};
      }
    }
    return resource.viewpoint;
  }

  function getPageCount(nodeOrResource) {
    var resource = getResource(nodeOrResource);
    var viewpoint = (resource.viewpoint && typeof resource.viewpoint === 'object') ? resource.viewpoint : ((resource.contents && typeof resource.contents === 'object') ? resource.contents : {});
    var media = (resource.media && typeof resource.media === 'object') ? resource.media : {};
    var n = Number(viewpoint.pageCount || media.pageCount || 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function hasKnownPages(nodeOrResource) {
    return getPageCount(nodeOrResource) > 0;
  }

  function getFirstPageNumber(nodeOrResource) {
    var meta = getDocumentPageMeta(nodeOrResource, false);
    var value = Number(meta && meta.firstPageNumber);

    if (Number.isFinite(value) && value >= 1) {
      return Math.floor(value);
    }

    /* Legacy compatibility: older notes may only have pageOffset. */
    value = Number(meta && meta.pageOffset);
    if (Number.isFinite(value) && value >= 0) {
      return Math.floor(value) + 1;
    }

    return 1;
  }

  function getPageOffset(nodeOrResource) {
    return Math.max(0, getFirstPageNumber(nodeOrResource) - 1);
  }

  function setFirstPageNumber(nodeOrResource, firstPageNumber) {
    var meta;

    if (!nodeOrResource || !Number.isFinite(Number(firstPageNumber))) {
      return false;
    }
    firstPageNumber = Math.max(1, Math.floor(Number(firstPageNumber)));
    meta = getDocumentPageMeta(nodeOrResource, true);
    if (!meta) { return false; }

    meta.firstPageNumber = firstPageNumber;
    meta.pageOffset = firstPageNumber - 1;
    if (nodeOrResource.resource) {
      nodeOrResource.changed = true;
    }
    return true;
  }

  function setPageOffset(nodeOrResource, pageOffset) {
    if (!Number.isFinite(Number(pageOffset))) {
      return false;
    }
    return setFirstPageNumber(nodeOrResource, Math.max(0, Math.floor(Number(pageOffset))) + 1);
  }

  function toViewerPageNumber(nodeOrResource, pageNumber) {
    var value = Number(pageNumber);
    if (!Number.isFinite(value)) {
      value = getFirstPageNumber(nodeOrResource);
    }
    value = Math.floor(value);
    return Math.max(1, value - getPageOffset(nodeOrResource));
  }

  function toDocumentPageNumber(nodeOrResource, viewerPageNumber) {
    var value = Math.floor(Number(viewerPageNumber || 1));
    if (!Number.isFinite(value)) { value = 1; }
    return Math.max(1, value + getPageOffset(nodeOrResource));
  }

  function getPageNumberRange(nodeOrResource) {
    var first = getFirstPageNumber(nodeOrResource);
    var count = getPageCount(nodeOrResource);
    return {
      min: first,
      max: count > 0 ? first + count - 1 : null,
      pageOffset: getPageOffset(nodeOrResource),
      pageCount: count,
      hasPageCount: count > 0
    };
  }

  function clampPageNumber(nodeOrResource, pageNumber) {
    var range = getPageNumberRange(nodeOrResource);
    var value = Math.floor(Number(pageNumber || range.min || 1));

    if (!Number.isFinite(value)) { value = range.min || 1; }
    value = Math.max(1, value);
    if (range.max != null) {
      value = Math.max(range.min, Math.min(range.max, value));
    }
    return value;
  }


  function isLocalHost() {
    return !!(util && typeof util.isLocalHost === 'function' && util.isLocalHost());
  }

  function isLoadFileUri(uri) {
    return /(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || ''));
  }

  function safeDecodeURIComponent(value) {
    try {
      return decodeURIComponent(String(value || ''));
    }
    catch (e) {
      return String(value || '');
    }
  }

  function canUseOfficeViewer(uri) {
    var parsed;
    if (!/^https?:\/\//i.test(String(uri || ''))) {
      return false;
    }
    try {
      parsed = new URL(uri, window.location.href);
      if (/^(?:localhost|127\.0\.0\.1|\[?::1\]?)$/i.test(parsed.hostname)) {
        return false;
      }
      return true;
    }
    catch (e) {
      return false;
    }
  }

  function getResourceOwnerId(nodeOrResource) {
    var node = nodeOrResource && nodeOrResource.resource ? nodeOrResource : null;
    var resource = getResource(nodeOrResource);
    var audit = (resource.audit && 'object' === typeof resource.audit) ? resource.audit : {};
    var rights = (resource.rights && 'object' === typeof resource.rights) ? resource.rights : {};
    var nodeAudit = (node && node.audit && 'object' === typeof node.audit) ? node.audit : {};
    return String(
      audit.owner ||
      audit.createdBy ||
      rights.owner ||
      nodeAudit.owner ||
      nodeAudit.createdBy ||
      (util && typeof util.getCurrentUserId === 'function' ? util.getCurrentUserId() : '') ||
      ''
    ).trim();
  }

  function getAppBasePath() {
    var path = (window.location && window.location.pathname) ? window.location.pathname : '/wu_wei2/';
    var marker = '/wu_wei2/';
    var idx = path.indexOf(marker);
    if (idx >= 0) {
      return path.slice(0, idx + marker.length);
    }
    return '/wu_wei2/';
  }

  function encodeStoragePath(path) {
    return String(path || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .map(function (part) { return encodeURIComponent(part); })
      .join('/');
  }

  function toOfficeViewerFetchUri(uri, nodeOrResource) {
    var parsed, area, path, uid, basePath;
    var text = String(uri || '').trim();

    try {
      parsed = new URL(text, window.location.href);
    }
    catch (e) {
      return text;
    }

    area = parsed.searchParams.get('area') || '';
    path = parsed.searchParams.get('path') || '';
    uid = parsed.searchParams.get('user_id') || getResourceOwnerId(nodeOrResource);
    if (!path || area !== 'upload' || !isLoadFileUri(parsed.pathname + parsed.search)) {
      return parsed.href;
    }

    basePath = getAppBasePath();
    return new URL(basePath + 'data/' + encodeURIComponent(uid) + '/upload/' + encodeStoragePath(path), window.location.origin).href;
  }

  function asOfficeViewerUrl(uri, nodeOrResource) {
    if (!canUseOfficeViewer(uri)) {
      return '';
    }
    return 'https://view.officeapps.live.com/op/embed.aspx?src=' +
      encodeURIComponent(toOfficeViewerFetchUri(uri, nodeOrResource));
  }

  function isPdfLikeUri(uri) {
    var text = String(uri || '');
    var parsed;
    if (/\.pdf(?:[?#].*)?$/i.test(text)) {
      return true;
    }
    try {
      parsed = new URL(text, window.location.href);
      return /\.pdf$/i.test(safeDecodeURIComponent(parsed.searchParams.get('path') || '').split('#')[0].split('?')[0]);
    }
    catch (e) {
      return /\.pdf$/i.test(safeDecodeURIComponent(text).split('#')[0].split('?')[0]);
    }
  }

  function getViewerUrl(nodeOrResource, opt) {
    var resource = getResource(nodeOrResource);
    var documentKind = getDocumentKind(nodeOrResource);
    var viewpoint = (resource.viewpoint && typeof resource.viewpoint === 'object') ? resource.viewpoint : ((resource.contents && typeof resource.contents === 'object') ? resource.contents : {});
    var role = opt && opt.role || viewpoint.sourceRole || '';
    var preview = '';
    var original = '';
    var officeViewer = '';

    if (wuwei.resource && typeof wuwei.resource.getRuntimeUrl === 'function') {
      if (documentKind === 'office') {
        preview = wuwei.resource.getRuntimeUrl(nodeOrResource, role || 'pdf-preview') ||
          wuwei.resource.getRuntimeUrl(nodeOrResource, 'preview') || '';
        original = wuwei.resource.getRuntimeUrl(nodeOrResource, 'original', { mode: 'officeViewer' }) ||
          wuwei.resource.getRuntimeUrl(nodeOrResource, 'original') ||
          String((resource.original && resource.original.url) || resource.uri || resource.canonicalUri || '');
        if (isLocalHost() && preview) {
          return preview;
        }
        officeViewer = asOfficeViewerUrl(original, nodeOrResource);
        return officeViewer || preview || original;
      }
      return wuwei.resource.getRuntimeUrl(nodeOrResource, role || 'original');
    }
    return String((resource.original && resource.original.url) || resource.uri || resource.canonicalUri || '');
  }

  function getViewerPageUrl(nodeOrResource, pageNumber, opt) {
    var uri = getViewerUrl(nodeOrResource, opt || {});
    var viewerPage = toViewerPageNumber(nodeOrResource, pageNumber);
    if (!uri || !Number.isFinite(Number(viewerPage))) {
      return uri || '';
    }
    if (!isPdfLikeUri(uri) && String(uri).indexOf('/pdfjs/') < 0 && String(uri).indexOf('viewer.html') < 0) {
      return uri;
    }
    return String(uri).replace(/#.*$/, '') + '#page=' + encodeURIComponent(Math.max(1, Math.floor(Number(viewerPage))));
  }

  function getOpenUrl(nodeOrResource, opt) {
    if (wuwei.resource && typeof wuwei.resource.getOpenUrl === 'function') {
      return wuwei.resource.getOpenUrl(nodeOrResource, opt || {});
    }
    return String((getResource(nodeOrResource).original && getResource(nodeOrResource).original.url) || getResource(nodeOrResource).uri || getResource(nodeOrResource).canonicalUri || '');
  }

  function initModule() { }

  return {
    getResource: getResource,
    getKind: getKind,
    getDocumentKind: getDocumentKind,
    isDocumentNode: isDocumentNode,
    isHtmlDocument: isHtmlDocument,
    isHtmlDocumentNode: isHtmlDocument,
    isContentTargetNode: isContentTargetNode,
    getDocumentPageMeta: getDocumentPageMeta,
    getPageCount: getPageCount,
    hasKnownPages: hasKnownPages,
    getFirstPageNumber: getFirstPageNumber,
    getPageOffset: getPageOffset,
    setFirstPageNumber: setFirstPageNumber,
    setPageOffset: setPageOffset,
    toViewerPageNumber: toViewerPageNumber,
    toDocumentPageNumber: toDocumentPageNumber,
    getPageNumberRange: getPageNumberRange,
    clampPageNumber: clampPageNumber,
    getViewerUrl: getViewerUrl,
    getViewerPageUrl: getViewerPageUrl,
    getOpenUrl: getOpenUrl,
    initModule: initModule
  };
})();
// wuwei.document.js
