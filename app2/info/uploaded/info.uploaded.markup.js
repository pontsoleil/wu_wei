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
  const template = function( param ) {
    let
      node = param.node,
      option = param.option;
    const
      common = wuwei.common,
      lang = common.nls.LANG,
      value = node.value,
      creativeCommons = common.nls.creativeCommons[lang];
    let uri = resolveInfoUri(node);
    let label = (node && node.label) || "";
    let size;
    let width, height;
    if (node && !!node.size) {
      size = node.size;
      width = size.width;
      height = size.height;
    } else {
      width = null; height = null;
    }
    uri = resolveFrameUri(node, uri);
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
    var html = `
<form id="infoform" class="form-group info">
  ${label
    ? `<div class="w3-row">
        <textarea id="rName" name="label" data-path="label" class="w3-col s12" rows="${rowcount(label)}" 
            placeholder="${translate('Label')}" disabled>${label}</textarea>
      </div>`
    : ''
  }
  ${uri
    ? `<iframe id="infoFrame" onerror="wuwei.info.iframeError()" src="${frameUri}"
        style="width:100%; min-height:480px; border:none; overflow:auto;"></iframe>`
    : ``
  }
  ${uri
    ? `<span class="player w3-row" onclick="wuwei.info.openWindow('${jsUri}', 'wuwei', 'width=600, height=400')">
        ${translate('Click to open window')}<i class="fas fa-external-link-alt"></i>
      </span>`
    : ``
  }
  ${node.value && 'string' === typeof node.value && node.value.length > 0
    ? `<div class="w3-row">
        <textarea id="rValue" name="description.body" data-path="description.body" class="w3-col s12" rows="${rowcount(node.value)}"
            placeholder="${translate('Comment')}" disabled>${toText(node.value)}</textarea>
      </div>`
    : ''
  }
</form>
`;
    return html;
  };

  function toText(str) {
    str = str.replace(/\n/gi, "");
    str = str.replace(/<br\s*[\/]?>/gi, "\n");
    return str;
  }

  function rowcount(str) {
    return wuwei.info.markup.rowcount(str);
  }

  function translate(str) {
    return wuwei.info.markup.translate(str);
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
    var resource = (node && node.resource && 'object' === typeof node.resource) ? node.resource : {};
    var media = (resource.media && 'object' === typeof resource.media) ? resource.media : {};
    var mimeType = String(resource.mimeType || media.mimeType || (node && (node.contenttype || node.contentType)) || '').toLowerCase();
    var viewer = (resource.viewer && 'object' === typeof resource.viewer) ? resource.viewer : {};
    var embed = (viewer.embed && 'object' === typeof viewer.embed) ? viewer.embed : {};
    var snapshotSources = (resource.snapshotSources && 'object' === typeof resource.snapshotSources) ? resource.snapshotSources : {};
    if (isOfficeResource(resource, mimeType)) {
      return resolveOfficeInfoUri(node, resource, viewer, embed, snapshotSources);
    }
    if (wuwei.util && typeof wuwei.util.getResourceOriginalUri === 'function' &&
      (isPdfResource(node, resource, mimeType) ||
        isInlineMediaMime(mimeType))) {
      return wuwei.util.getResourceOriginalUri(node) || '';
    }
    if (wuwei.util && typeof wuwei.util.getResourceUri === 'function') {
      return wuwei.util.getResourceUri(node) || '';
    }
    return (
      embed.uri ||
      snapshotSources.previewUri ||
      resource.uri ||
      resource.canonicalUri ||
      snapshotSources.originalUri ||
      ''
    );
  }

  function resolveFrameUri(node, uri) {
    var resource = (node && node.resource && 'object' === typeof node.resource) ? node.resource : {};
    var media = (resource.media && 'object' === typeof resource.media) ? resource.media : {};
    var mimeType = String(resource.mimeType || media.mimeType || (node && (node.contenttype || node.contentType)) || '').toLowerCase();
    if (isOfficeResource(resource, mimeType)) {
      return uri;
    }
    return uri;
  }

  function resolveOfficeInfoUri(node, resource, viewer, embed, snapshotSources) {
    var previewUri = getOfficePreviewUri(node, resource, viewer, embed, snapshotSources);
    var originalUri;

    if (previewUri) {
      return previewUri;
    }
    originalUri = wuwei.util && typeof wuwei.util.getResourceOriginalUri === 'function'
      ? wuwei.util.getResourceOriginalUri(node)
      : (resource.canonicalUri || resource.uri || snapshotSources.originalUri || '');
    if (canUseOfficeViewer(originalUri)) {
      return 'https://view.officeapps.live.com/op/embed.aspx?src=' +
        encodeURIComponent(toOfficeViewerFetchUri(originalUri, node));
    }
    return originalUri || '';
  }

  function getOfficePreviewUri(node, resource, viewer, embed, snapshotSources) {
    var candidates = [];
    if (wuwei.util && typeof wuwei.util.getResourceFileUri === 'function') {
      candidates.push(wuwei.util.getResourceFileUri(resource, 'preview', node));
    }
    candidates.push(
      embed.previewUri,
      embed.uri,
      viewer.previewUri,
      snapshotSources.previewUri,
      resource.previewUri
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

  function isOfficeResource(resource, mimeType) {
    var text = String(mimeType || '').toLowerCase();
    var uriText = [
      resource && resource.uri,
      resource && resource.canonicalUri,
      resource && resource.name,
      resource && resource.label
    ].join(' ').toLowerCase();
    if (wuwei.util && typeof wuwei.util.isOfficeDocument === 'function' &&
      wuwei.util.isOfficeDocument(text)) {
      return true;
    }
    return /(?:msword|ms-excel|ms-powerpoint|officedocument|\.docx?\b|\.xlsx?\b|\.pptx?\b)/.test(text + ' ' + uriText);
  }

  function isInlineMediaMime(mimeType) {
    var text = String(mimeType || '').toLowerCase();
    return text.indexOf('image/') === 0 ||
      text.indexOf('video/') === 0 ||
      text.indexOf('audio/') === 0;
  }

  function isPdfResource(node, resource, mimeType) {
    var original = '';
    var text;
    if (String(mimeType || '').toLowerCase().indexOf('application/pdf') === 0) {
      return true;
    }
    if (wuwei.util && typeof wuwei.util.getResourceOriginalUri === 'function') {
      original = wuwei.util.getResourceOriginalUri(node) || '';
    }
    text = [
      original,
      resource && resource.uri,
      resource && resource.canonicalUri,
      resource && resource.name,
      resource && resource.label,
      resource && resource.title,
      node && node.uri,
      node && node.label,
      node && node.name
    ].join(' ');
    return isPdfLikeUri(text);
  }

  function isPdfLikeUri(uri) {
    return /\.pdf(?:[?#].*)?$/i.test(String(uri || '')) ||
      /[?&](?:mimeType|content_type)=application%2Fpdf/i.test(String(uri || ''));
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

  return {
    template: template
  };
} ());
// info.uploaded.markup.js last modified 2026-04-20
