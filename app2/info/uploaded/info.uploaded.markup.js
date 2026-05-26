/**
 * info.uploaded.markup.js
 * wuwei info.uploaded template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.info = wuwei.info || {};
wuwei.info.uploaded = wuwei.info.uploaded || {};
wuwei.info.uploaded.markup = ( function () {
  function fallbackNotice(uri, className) {
    if (wuwei.info && typeof wuwei.info.iframeNoticeHtml === 'function') {
      return wuwei.info.iframeNoticeHtml(uri, { className: className || 'iframe-fallback w3-row' });
    }
    return '<div class="' + escapeAttr(className || 'iframe-fallback w3-row') + '" style="display:block;">' +
      t('This page may require login or block iframe preview. Open it in a tab or window.') +
      '<br><a href="' + escapeAttr(uri) + '" target="_blank" rel="noopener noreferrer">' + escapeAttr(uri) + '</a></div>';
  }

  function fallbackActions(uri, options) {
    if (wuwei.info && typeof wuwei.info.openActionsHtml === 'function') {
      return wuwei.info.openActionsHtml(uri, options);
    }
    return '<div class="' + escapeAttr((options && options.className) || 'w3-row info-uploaded-actions') + '">' +
      '<a href="' + escapeAttr(uri) + '" target="_blank" rel="noopener noreferrer">' +
      t('Click to open tab') + '<i class="fas fa-external-link-alt"></i></a></div>';
  }

  const template = function( param ) {
    let
      node = param.node,
      option = param.option;
    const
      common = wuwei.common,
      lang = common.nls.LANG,
      value = (node.description && typeof node.description.body === 'string') ? node.description.body : '',
      creativeCommons = common.nls.creativeCommons[lang];
    let uri = resolveInfoUri(node);
    let label = (node && node.label) || "";
    let displayedPageNumber = getDisplayedPageNumber(option);
    let viewerPageNumber = getViewerPageNumber(node, option, displayedPageNumber);
    let size;
    let width, height;
    if (node && !!node.size) {
      size = node.size;
      width = size.width;
      height = size.height;
    } else {
      width = null; height = null;
    }
    if (option && (option.contentViewerUri || option.pdfjsUri)) {
      uri = String(option.contentViewerUri || option.pdfjsUri || '');
      if (hasPageValue(viewerPageNumber) && !/#page=/i.test(uri) && isPdfLikeUri(uri)) {
        uri = appendPageFragment(uri, viewerPageNumber);
      }
    }
    else {
      uri = resolveFrameUri(node, uri);
      if (hasPageValue(viewerPageNumber)) {
        uri = appendPageFragment(uri, viewerPageNumber);
      }
    }
    // Info pane renders the resource body. Stored values may be plain
    // YYYY/MM/DD/... paths, but iframe/video/img must receive a load-file URL.
    if (uri && wuwei.util && typeof wuwei.util.toPublicResourceUri === 'function' &&
      !/^https?:\/\//i.test(uri) && !isLoadFileUri(uri)) {
      var area = inferStorageArea(uri, 'upload');
      var ownerId = getResourceOwnerId(node);
      uri = wuwei.util.toPublicResourceUri(area,
        wuwei.util.toStorageRelativePath ? wuwei.util.toStorageRelativePath(uri, ownerId, area) : uri,
        ownerId);
    }
    var frameUri = escapeAttr(uri);
    var jsUri = escapeJsString(uri);
    var rights = getResourceRights(node);
    var credit = rights.attribution || rights.credit || '';
    var license = rights.license || '';
    var html = `
<form id="infoform" class="form-group info">
  ${label
    ? `<div class="w3-row">
        <textarea id="label" name="label" class="w3-col s12" rows="${rowcount(label)}"
            placeholder="${t('Label')}" disabled>${label}</textarea>
      </div>`
    : ''
  }
  ${displayedPageNumber
    ? `<div class="w3-row info-page-number">
        <label class="w3-col s5">${t('Page number')}</label>
        <span class="w3-col s7">${escapeAttr(displayedPageNumber)}</span>
      </div>`
    : ''
  }
  ${uri
    ? fallbackNotice(uri, 'iframe-fallback w3-row')
    : ``
  }
  ${uri
    ? fallbackActions(uri, {
        className: 'w3-row info-uploaded-actions',
        windowFeatures: 'width=600,height=400'
      })
    : ``
  }
  ${uri
    ? `<iframe id="infoFrame" onerror="wuwei.info.iframeError()" src="${frameUri}"
        style="width:100%; min-height:360px; border:none; overflow:auto;"></iframe>`
    : ``
  }
  ${value && value.length > 0
    ? `<div class="w3-row">
        <textarea id="description_body" name="description.body" class="w3-col s12" rows="${rowcount(value)}"
            placeholder="${t('Comment')}" disabled>${toText(value)}</textarea>
      </div>`
    : ''
  }
  ${credit
    ? `<div class="w3-row">
        <label class="w3-col s4">${t('Credit')}</label>
        <input type="text" class="w3-col s8" value="${escapeAttr(credit)}" disabled>
      </div>`
    : ''
  }
  ${license
    ? `<div class="w3-row">
        <label class="w3-col s4">${t('License')}</label>
        <input type="text" class="w3-col s8" value="${escapeAttr(license)}" disabled>
      </div>`
    : ''
  }
</form>
`;
    return html;
  };

  function getDisplayedPageNumber(option) {
    var point = option && (
      option.displayedContentTarget ||
      option.displayedPageMarker ||
      option.contentTarget ||
      option.contentTargetPoint ||
      option.viewpointPoint
    );
    var value = point && point.pageNumber;
    if (value == null || value === '') {
      value = option && (option.pageNumber || option.viewpointPageNumber || option.page);
    }
    if (value == null || value === '') {
      return '';
    }
    return String(value);
  }


  function getViewerPageNumber(node, option, displayedPageNumber) {
    var value = option && (option.viewerPage || option.pdfPage || '');
    if (value == null || value === '') {
      value = displayedPageNumber || option && option.page || '';
    }
    if (value == null || value === '') {
      return '';
    }
    if (wuwei.document && typeof wuwei.document.toViewerPageNumber === 'function' &&
      wuwei.document.isDocumentNode && wuwei.document.isDocumentNode(node)) {
      return wuwei.document.toViewerPageNumber(node, value);
    }
    return value;
  }

  function toText(str) {
    str = str.replace(/\n/gi, "");
    str = str.replace(/<br\s*[\/]?>/gi, "\n");
    return str;
  }

  function rowcount(str) {
    return wuwei.info.markup.rowcount(str);
  }

  function t(str) {
    return wuwei.nls.translate(str);
  }

  function getResourceRights(node) {
    var resource = (node && node.resource && 'object' === typeof node.resource) ? node.resource : {};
    var rights = (resource.rights && 'object' === typeof resource.rights) ? resource.rights : {};
    return {
      attribution: String(rights.attribution || resource.attribution || ''),
      credit: String(rights.credit || resource.credit || ''),
      license: String(rights.license || resource.license || '')
    };
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeJsString(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  function resolveInfoUri(node) {
    var helperUri = '';
    var resource = (node && node.resource && 'object' === typeof node.resource) ? node.resource : {};

    if (wuwei.document && typeof wuwei.document.isDocumentNode === 'function' &&
      wuwei.document.isDocumentNode(node) && typeof wuwei.document.getViewerUrl === 'function') {
      helperUri = wuwei.document.getViewerUrl(node) || '';
    }
    else if (wuwei.video && typeof wuwei.video.isVideoNode === 'function' &&
      wuwei.video.isVideoNode(node) && typeof wuwei.video.getVideoSource === 'function') {
      helperUri = wuwei.video.getVideoSource(node) || '';
    }
    else if (wuwei.audio && typeof wuwei.audio.isAudioNode === 'function' &&
      wuwei.audio.isAudioNode(node) && typeof wuwei.audio.getAudioSource === 'function') {
      helperUri = wuwei.audio.getAudioSource(node) || '';
    }
    else if (wuwei.resource && typeof wuwei.resource.getPrimaryPreviewUrl === 'function') {
      helperUri = wuwei.resource.getPrimaryPreviewUrl(node) || '';
    }

    if (helperUri) {
      return helperUri;
    }

    return (
      resource.uri ||
      resource.canonicalUri ||
      resource.previewUri ||
      resource.thumbnailUri ||
      ''
    );
  }

  function resolveFrameUri(node, uri) {
    return uri;
  }

  function isHtmlResource(node, resource) {
    return !!(wuwei.util && typeof wuwei.util.isDocumentKindByExtension === 'function' &&
      wuwei.util.isDocumentKindByExtension(node, resource, '', 'html'));
  }

  function resolveHtmlInfoUri(node, resource, embed, snapshotSources) {
    var original = wuwei.util && typeof wuwei.util.getResourceOriginalUri === 'function'
      ? wuwei.util.getResourceOriginalUri(node)
      : '';
    var fileOriginal = wuwei.util && typeof wuwei.util.getResourceFileUri === 'function'
      ? wuwei.util.getResourceFileUri(resource, 'original', node)
      : '';

    /* HTML/web resources are normal iframe targets. */
    return String(
      fileOriginal ||
      original ||
      (embed && embed.uri) ||
      resource.canonicalUri ||
      resource.uri ||
      snapshotSources.originalUri ||
      snapshotSources.previewUri ||
      ''
    ).trim();
  }

  function resolveOfficeInfoUri(node, resource, viewer, embed, snapshotSources) {
    var previewUri = getOfficePreviewUri(node, resource, viewer, embed, snapshotSources);
    var originalUri;

    if (previewUri && wuwei.util && typeof wuwei.util.isLocalHost === 'function' && wuwei.util.isLocalHost()) {
      return previewUri;
    }
    originalUri = wuwei.util && typeof wuwei.util.getResourceOriginalUri === 'function'
      ? wuwei.util.getResourceOriginalUri(node)
      : ((resource.original && resource.original.url) || (resource.original && resource.original.url) || resource.uri || resource.canonicalUri || snapshotSources.originalUri || '');
    if (canUseOfficeViewer(originalUri)) {
      return 'https://view.officeapps.live.com/op/embed.aspx?src=' +
        encodeURIComponent(toOfficeViewerFetchUri(originalUri, node));
    }
    return originalUri || '';
  }

  function getOfficePreviewUri(node, resource, viewer, embed, snapshotSources) {
    var candidates = [];
    if (wuwei.util && typeof wuwei.util.getResourcePdfPreviewUri === 'function') {
      candidates.push(wuwei.util.getResourcePdfPreviewUri(node));
    }
    if (wuwei.util && typeof wuwei.util.getResourceFileUri === 'function') {
      candidates.push(wuwei.util.getResourceFileUri(resource, 'preview', node));
    }
    if (wuwei.util && typeof wuwei.util.getResourcePreviewUri === 'function') {
      candidates.push(wuwei.util.getResourcePreviewUri(node));
    }
    candidates.push(
      resource.previewPdfUri,
      resource.previewPdfUrl,
      resource.convertedPdfUri,
      resource.convertedPdfUrl,
      resource.pdfUri,
      resource.pdfUrl,
      resource.uri,
      resource.canonicalUri,
      embed.previewPdfUri,
      embed.previewPdfUrl,
      embed.pdfUri,
      embed.pdfUrl,
      embed.previewUri,
      embed.uri,
      viewer.previewPdfUri,
      viewer.previewPdfUrl,
      viewer.pdfUri,
      viewer.pdfUrl,
      viewer.previewUri,
      viewer.uri,
      snapshotSources.previewPdfUri,
      snapshotSources.previewPdfUrl,
      snapshotSources.pdfUri,
      snapshotSources.pdfUrl,
      snapshotSources.previewUri,
      resource.previewUri,
      resource.previewUrl
    );
    return firstPdfLikeUri(candidates);
  }

  function firstPdfLikeUri(candidates) {
    var i, uri;
    for (i = 0; i < candidates.length; i += 1) {
      uri = String(candidates[i] || '').trim();
      if (uri && isPdfLikeUri(uri)) {
        return uri;
      }
    }
    return '';
  }

  function isOfficeResource(node, resource) {
    return !!(wuwei.util && typeof wuwei.util.isDocumentKindByExtension === 'function' &&
      wuwei.util.isDocumentKindByExtension(node, resource, '', 'office'));
  }

  function isInlineMediaByExtension(node, resource) {
    var kind = wuwei.util && typeof wuwei.util.getDocumentKindByExtension === 'function'
      ? wuwei.util.getDocumentKindByExtension(node, resource, '')
      : '';
    return kind === 'image' || kind === 'video' || kind === 'audio';
  }

  function isPdfResource(node, resource) {
    return !!(wuwei.util && typeof wuwei.util.isDocumentKindByExtension === 'function' &&
      wuwei.util.isDocumentKindByExtension(node, resource, '', 'pdf'));
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

  function toOfficeViewerFetchUri(uri, node) {
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
    uid = parsed.searchParams.get('user_id') || getResourceOwnerId(node);
    if (!path || area !== 'upload' || !isLoadFileUri(parsed.pathname + parsed.search)) {
      return parsed.href;
    }

    basePath = getAppBasePath();
    return new URL(basePath + 'data/' + encodeURIComponent(uid) + '/upload/' + encodeStoragePath(path), window.location.origin).href;
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

  function inferStorageArea(uri, fallback) {
    var text = String(uri || '').replace(/\\/g, '/');
    var m;
    try {
      m = text.match(/[?&]area=([^&]+)/);
      if (m) {
        return decodeURIComponent(m[1]) || fallback;
      }
    }
    catch (e) { /* keep fallback */ }
    m = text.match(/(?:^|\/)(upload|resource|note|thumbnail|content)\//);
    return m ? m[1] : fallback;
  }

  function getResourceOwnerId(node) {
    var resource = (node && node.resource && 'object' === typeof node.resource) ? node.resource : {};
    var audit = (resource.audit && 'object' === typeof resource.audit) ? resource.audit : {};
    var rights = (resource.rights && 'object' === typeof resource.rights) ? resource.rights : {};
    var nodeAudit = (node && node.audit && 'object' === typeof node.audit) ? node.audit : {};
    return String(
      audit.owner ||
      audit.createdBy ||
      rights.owner ||
      nodeAudit.owner ||
      nodeAudit.createdBy ||
      (wuwei.util && typeof wuwei.util.getCurrentUserId === 'function' ? wuwei.util.getCurrentUserId() : '') ||
      ''
    ).trim();
  }

  function isLoadFileUri(uri) {
    return /(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || ''));
  }

  function hasPageValue(page) {
    return page != null && page !== '';
  }

  function appendPageFragment(uri, page) {
    var n = Number(page);
    if (!Number.isFinite(n)) { n = 1; }
    n = Math.max(1, Math.floor(n));
    var text = String(uri || '').replace(/#.*$/, '');
    return text ? (text + '#page=' + encodeURIComponent(n)) : '';
  }

  return {
    template: template
  };
} ());
// info.uploaded.markup.js last modified 2026-04-20
