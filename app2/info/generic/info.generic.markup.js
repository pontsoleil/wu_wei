/**
 * info.generic.markup.js
 * wuwei info.generic template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.info = wuwei.info || {};
wuwei.info.generic = wuwei.info.generic || {};
wuwei.info.generic.markup = (function () {
  const template = function (param) {
    let
      node = param.node,
      option = param.option || {};
    let displayedPageNumber = getDisplayedPageNumber(option);
    const util = wuwei.util;
    let uri = resolveViewerUri(node, option);
    let label = node.label || '';
    let value = '';
    let rights = getResourceRights(node);
    let credit = rights.attribution || rights.credit || '';
    let license = rights.license || '';
    let fontSize = (node.style && node.style.font && node.style.font.size) || 14;
    let fontClass = 'font-size-M';
    let thumbnailUri = resolveThumbnailUri(node);
    if (node.description && typeof node.description.body === 'string') {
      value = node.description.body;
    }
    let width, height;
    if ('object' === typeof node.size && node.size.width) {
      width = +node.size.width;
      height = +node.size.height;
      height = 256 * height / width;
      width = 256;
    }
    var html = `
<!--Card-->
<div class="info">
  <!--Card image-->
  ${'Memo' !== node.type && label
        ? `<div class="w3-row info-title-wrap">
        <h5 id="label" name="label" data-path="label" class="w3-col s12 info-title"></h5>
      </div>`
        : ''
      }
  ${displayedPageNumber
      ? `<div class="w3-row info-page-number">
          <label class="w3-col s5">${t('Page number')}</label>
          <span class="w3-col s7">${wuwei.util.encodeHtml(displayedPageNumber)}</span>
        </div>`
      : ''
  }
  ${uri
      ? `<iframe id="infoFrame"
          src="${wuwei.util.encodeHtml(uri)}"
          data-resource-uri="${wuwei.util.encodeHtml(uri)}"
          onload="this.dataset.loaded='1'"
          onerror="wuwei.info.iframeError()"
          style="display:block; width:100%; min-height:768px; border:none; overflow:auto; box-sizing:border-box;"></iframe>
        <div class="iframe-fallback" style="display:none;">
          ${t('This site refused to be displayed in an iframe.')}
          <br><a href="${wuwei.util.encodeHtml(uri)}" target="_blank" rel="noopener noreferrer">${wuwei.util.encodeHtml(uri)}</a>
        </div>
        <div class="link"
          data-open-uri="${wuwei.util.encodeHtml(uri)}"
          onclick="wuwei.info.openWindow(this.getAttribute('data-open-uri'), null, 'width=600,height=400,resizable=yes,scrollbars=yes')">
          ${t('Click to open window')}<i class="fas fa-external-link-alt"></i>
        </div>`
      : (thumbnailUri
        ? `<div class="frame">
            <img src="${wuwei.util.encodeHtml(thumbnailUri)}"
              style="display:block; max-width:100%; height:auto;"
              ${uri
                ? `onclick="wuwei.info.openWindow('${uri}', null, 'width=600,height=400,resizable=yes,scrollbars=yes')"`
                : ''
              }>
          </div>`
        : '')
  }
  <!--/.Card image-->
  <div class="w3-container ${fontClass}" style="font-size:${Number(fontSize) || 14}px;">
      <!--Card content-->
      ${value
        ? `<p class="value">${wuwei.util.encodeHtml(
            String(value).replace(/\\n/g, '\n')
          )}</p>`
        : ``
      }
      ${credit
        ? `<p class="credit"><strong>${t('Credit')}:</strong> ${wuwei.util.encodeHtml(credit)}</p>`
        : ``
      }
      ${license
        ? `<p class="license"><strong>${t('License')}:</strong> ${wuwei.util.encodeHtml(license)}</p>`
        : ``
      }
    </div>
  <!--/.Card content-->
</div>
<!--/.Card-->
`;
    return html;
  };

  function t(str) {
    return wuwei.nls.translate(str);
  }

  function getResourceRights(node) {
    var util = wuwei.util || {};
    var resource = (util.getResource && util.getResource(node)) ||
      ((node && node.resource && 'object' === typeof node.resource) ? node.resource : {});
    var rights = (resource && resource.rights && 'object' === typeof resource.rights) ? resource.rights : {};
    return {
      attribution: String(rights.attribution || resource.attribution || ''),
      credit: String(rights.credit || resource.credit || ''),
      license: String(rights.license || resource.license || '')
    };
  }


  function resolveViewerUri(node, option) {
    var point = option && (
      option.displayedContentTarget ||
      option.displayedPageMarker ||
      option.contentTarget ||
      option.contentTargetPoint ||
      option.contentsPoint
    );
    var explicitUri = option && (option.contentViewerUri || option.pdfjsUri)
      ? String(option.contentViewerUri || option.pdfjsUri || '')
      : '';
    var page = option && (option.page || option.pageNumber || option.contentsPageNumber);
    var computedUri;

    if (point && wuwei.contents && typeof wuwei.contents.getContentTargetViewerUrl === 'function') {
      computedUri = wuwei.contents.getContentTargetViewerUrl(node, page, point);
      if (computedUri) {
        return prepareViewerUriForInfo(node, computedUri);
      }
    }

    if (explicitUri) {
      return prepareViewerUriForInfo(node, applyPageFragment(explicitUri, option));
    }
    return prepareViewerUriForInfo(node, applyPageFragment(resolveInfoUri(node), option));
  }

  function resolveInfoUri(node) {
    var util = wuwei.util || {};
    var resource = util.getResource && util.getResource(node);
    var viewer = (resource && resource.viewer && 'object' === typeof resource.viewer) ? resource.viewer : {};
    var embed = (viewer.embed && 'object' === typeof viewer.embed) ? viewer.embed : {};
    var uri = '';

    if (resource && isOfficeLikeResource(node, resource)) {
      return resolveOfficeInfoUri(node, resource);
    }

    if (resource && isHtmlLikeResource(node, resource)) {
      return resolveHtmlInfoUri(node, resource, embed);
    }

    if (resource && util.getResourceFileUri) {
      uri = util.getResourceFileUri(resource, 'preview', node) ||
        util.getResourceFileUri(resource, 'original', node);
    }
    if (!uri && util.getResourcePreviewUri) {
      uri = util.getResourcePreviewUri(node) || '';
    }
    if (uri) {
      return uri;
    }

    // Current model: external references are represented as normal URLs.
    uri = String(embed.uri || (resource && (resource.uri || resource.canonicalUri)) || '').trim();
    if (/^https?:\/\//i.test(uri) && uri.indexOf('/wu_wei2/') < 0) {
      return uri;
    }
    return '';
  }

  function isHtmlLikeResource(node, resource, uri) {
    var util = wuwei.util || {};
    return !!(util.isDocumentKindByExtension &&
      util.isDocumentKindByExtension(node, resource, uri, 'html'));
  }

  function resolveHtmlInfoUri(node, resource, embed) {
    var util = wuwei.util || {};
    var original = util.getResourceOriginalUri ? util.getResourceOriginalUri(node) : '';
    var fileOriginal = util.getResourceFileUri ? util.getResourceFileUri(resource, 'original', node) : '';

    /*
     * HTML/web contents must be displayed exactly as a normal page in the
     * iframe.  Do not replace them with a preview image/PDF or text-viewer.
     */
    return String(
      fileOriginal ||
      original ||
      resource.canonicalUri ||
      resource.uri ||

      ''
    ).trim();
  }

  function isOfficeLikeResource(node, resource) {
    var util = wuwei.util || {};
    return !!(util.isDocumentKindByExtension &&
      util.isDocumentKindByExtension(node, resource, '', 'office'));
  }

  function resolveOfficeInfoUri(node, resource) {
    var util = wuwei.util || {};
    var previewUri = util.getResourcePdfPreviewUri ? util.getResourcePdfPreviewUri(node) : '';
    var originalUri;

    if (previewUri && util.isLocalHost && util.isLocalHost()) {
      return previewUri;
    }
    originalUri = util.getResourceOriginalUri
      ? util.getResourceOriginalUri(node)
      : String((resource && (resource.canonicalUri || resource.uri)) || '');
    if (canUseOfficeViewer(originalUri)) {
      return 'https://view.officeapps.live.com/op/embed.aspx?src=' +
        encodeURIComponent(toOfficeViewerFetchUri(originalUri, node));
    }
    return previewUri || originalUri || '';
  }

  function canUseOfficeViewer(uri) {
    var parsed;
    if (!/^https?:\/\//i.test(String(uri || ''))) {
      return false;
    }
    try {
      parsed = new URL(uri, window.location.href);
      return !/^(?:localhost|127\.0\.0\.1|\[?::1\]?)$/i.test(parsed.hostname);
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
    if (!path || area !== 'upload' || !/(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(parsed.pathname + parsed.search)) {
      return parsed.href;
    }

    basePath = getAppBasePathForInfo();
    return new URL(basePath + 'data/' + encodeURIComponent(uid) + '/upload/' + encodeStoragePathForInfo(path), window.location.origin).href;
  }

  function getResourceOwnerId(node) {
    var util = wuwei.util || {};
    var resource = util.getResource && util.getResource(node) || {};
    var audit = (resource.audit && 'object' === typeof resource.audit) ? resource.audit : {};
    var rights = (resource.rights && 'object' === typeof resource.rights) ? resource.rights : {};
    var nodeAudit = (node && node.audit && 'object' === typeof node.audit) ? node.audit : {};
    return String(
      audit.owner ||
      audit.createdBy ||
      rights.owner ||
      nodeAudit.owner ||
      nodeAudit.createdBy ||
      (util.getCurrentUserId ? util.getCurrentUserId() : '') ||
      ''
    ).trim();
  }

  function getAppBasePathForInfo() {
    var path = (window.location && window.location.pathname) ? window.location.pathname : '/wu_wei2/';
    var marker = '/wu_wei2/';
    var idx = path.indexOf(marker);
    return idx >= 0 ? path.slice(0, idx + marker.length) : '/wu_wei2/';
  }

  function encodeStoragePathForInfo(path) {
    return String(path || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .map(function (part) { return encodeURIComponent(part); })
      .join('/');
  }

  function prepareViewerUriForInfo(node, uri) {
    var util = wuwei.util || {};
    var resource = util.getResource && util.getResource(node);
    if (!uri) { return ''; }
    if (isHtmlLikeResource(node, resource || {}, uri)) {
      return uri;
    }
    if (isTextLikeResource(node, uri)) {
      return getTextViewerUri(uri);
    }
    return uri;
  }

  function isTextLikeResource(node, uri) {
    var util = wuwei.util || {};
    var resource = util.getResource && util.getResource(node);
    return !!(util.isDocumentKindByExtension &&
      util.isDocumentKindByExtension(node, resource || {}, uri, 'text'));
  }

  function getTextViewerUri(uri) {
    var url = String(uri || '').trim();
    var basePath;
    var marker;
    var idx;

    if (!url) { return ''; }
    if (/\/app2\/viewer\/text-viewer\.html(?:[?#]|$)/i.test(url)) {
      return url;
    }
    if (!/^(https?:|blob:|data:|\/)/i.test(url) && !/^\/\//.test(url)) {
      url = new URL(url, location.href.substr(0, location.href.lastIndexOf('/') + 1)).href;
    }
    else if (/^\/\//.test(url)) {
      url = location.protocol + url;
    }

    basePath = (window.location && window.location.pathname) ? window.location.pathname : '/wu_wei2/';
    marker = '/wu_wei2/';
    idx = basePath.indexOf(marker);
    basePath = idx >= 0 ? basePath.slice(0, idx + marker.length) : '/wu_wei2/';

    return new URL(basePath + 'app2/viewer/text-viewer.html?file=' + encodeURIComponent(url), window.location.origin).href;
  }

  function resolveThumbnailUri(node) {
    var util = wuwei.util || {};
    if (util.getResourceThumbnailUri) {
      return util.getResourceThumbnailUri(node) || '';
    }
    return '';
  }

  function iframe_error() {
    setTimeout(function () {
      document.getElementById('info_iframe').classList.add('d-none');
    }, 1000);
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
    if (value == null || value === '') {
      return '';
    }
    return String(value);
  }

  function applyPageFragment(uri, option) {
    var page = option && option.page;
    var text = String(uri || '');
    if ((page == null || page === '') && option) {
      page = option.contentsPageNumber;
    }
    if (page == null || page === '' || !text || /#page=/i.test(text) || !isPdfLikeUri(text)) {
      return text;
    }
    page = Number(page);
    if (!Number.isFinite(page)) { page = 1; }
    return text.replace(/#.*$/, '') + '#page=' + encodeURIComponent(Math.max(1, Math.floor(page)));
  }

  function isPdfLikeUri(uri) {
    var text = String(uri || '');
    var decoded = text;
    try { decoded = decodeURIComponent(text); } catch (e) { decoded = text; }
    return /\.pdf(?:[?#].*)?$/i.test(decoded);
  }

  return {
    template: template
  };
})();
// info.generic.markup.js last modified 2026-03-28
