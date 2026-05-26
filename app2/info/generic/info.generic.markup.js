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
  function infoFallbackHtml(uri) {
    if (wuwei.info && typeof wuwei.info.iframeNoticeHtml === 'function') {
      return wuwei.info.iframeNoticeHtml(uri);
    }
    return [
      '<div class="iframe-fallback" style="display:block;">',
      t('This page may require login or block iframe preview. Open it in a tab or window.'),
      '<br><a href="' + wuwei.util.encodeHtml(uri) + '" target="_blank" rel="noopener noreferrer">' + wuwei.util.encodeHtml(uri) + '</a>',
      '</div>'
    ].join('');
  }

  function openActionsHtml(uri, options) {
    if (wuwei.info && typeof wuwei.info.openActionsHtml === 'function') {
      return wuwei.info.openActionsHtml(uri, options);
    }
    return '<div class="' + wuwei.util.encodeHtml((options && options.className) || 'link') + '">' +
      '<a href="' + wuwei.util.encodeHtml(uri) + '" target="_blank" rel="noopener noreferrer">' +
      t('Click to open tab') + '<i class="fas fa-external-link-alt"></i></a></div>';
  }

  const template = function (param) {
    let
      node = param.node,
      option = param.option || {};
    let displayedPageNumber = getDisplayedPageNumber(option);
    const util = wuwei.util;
    let uri = resolveViewerUri(node, option);
    let label = node.label || '';
    let descriptionHtml = '';
    let rights = getResourceRights(node);
    let credit = rights.attribution || rights.credit || '';
    let license = rights.license || '';
    let fontSize = (node.style && node.style.font && node.style.font.size) || 14;
    let fontClass = 'font-size-M';
    let thumbnailUri = resolveThumbnailUri(node);
    descriptionHtml = renderDescriptionSections(node.description);
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
          style="display:block; width:100%; min-height:480px; border:none; overflow:auto; box-sizing:border-box;"></iframe>
        ${infoFallbackHtml(uri)}
        ${openActionsHtml(uri, {
          className: 'link info-generic-actions',
          windowFeatures: 'width=600,height=400,resizable=yes,scrollbars=yes'
        })}`
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
      ${descriptionHtml
        ? descriptionHtml
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

  function descriptionEntryBody(entry) {
    if (!entry || 'object' !== typeof entry) {
      return '';
    }
    return (typeof entry.body === 'string') ? entry.body : String(entry.text || '');
  }

  function normalizeDescriptionEntries(description) {
    var entries = [];
    var i, entry;
    if (Array.isArray(description)) {
      for (i = 0; i < description.length; i += 1) {
        entry = description[i] || {};
        entries.push({
          role: String(entry.role || (entries.length ? 'supplement' : 'original')),
          format: String(entry.format || 'plain/text'),
          body: descriptionEntryBody(entry)
        });
      }
      return entries;
    }
    if (description && typeof description === 'object') {
      return [{
        role: 'original',
        format: String(description.format || 'plain/text'),
        body: descriptionEntryBody(description)
      }];
    }
    return [];
  }

  function renderFormattedDescription(body, format) {
    var source = String(body || '');
    var mode = String(format || 'plain/text').toLowerCase();
    var html = '';
    if (!source.trim()) {
      return '';
    }
    if (mode.indexOf('html') >= 0) {
      html = source;
    }
    else if ((mode.indexOf('markdown') >= 0 || mode === 'md') &&
      window.marked && typeof window.marked.parse === 'function') {
      try { html = window.marked.parse(source); }
      catch (e) { html = ''; }
    }
    else if ((mode.indexOf('markdown') >= 0 || mode === 'md') &&
      window.markdownit && typeof window.markdownit === 'function') {
      try { html = window.markdownit({ html: false, linkify: true }).render(source); }
      catch (e2) { html = ''; }
    }
    else if ((mode.indexOf('asciidoc') >= 0 || mode === 'adoc') &&
      wuwei.util && typeof wuwei.util.renderAsciiDoc === 'function') {
      try {
        html = wuwei.util.renderAsciiDoc(source, {
          showtitle: false,
          allowHtml: true
        });
      }
      catch (e3) { html = ''; }
    }
    if (!html) {
      html = '<p>' + wuwei.util.encodeHtml(source)
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>') + '</p>';
    }
    return sanitizeDescriptionHtml(html);
  }

  function renderDescriptionSections(description) {
    var entries = normalizeDescriptionEntries(description);
    var html = [];
    var i, entry, bodyHtml, label;
    for (i = 0; i < entries.length; i += 1) {
      entry = entries[i];
      bodyHtml = renderFormattedDescription(entry.body, entry.format);
      if (!bodyHtml) {
        continue;
      }
      label = entry.role === 'supplement' ? t('Supplement') : t('Description');
      html.push(
        '<section class="info-description info-description-' + wuwei.util.encodeHtml(entry.role) + '">',
        '  <h6>' + wuwei.util.encodeHtml(label) + ' <small>(' + wuwei.util.encodeHtml(entry.format) + ')</small></h6>',
        '  <div class="value rich-description">' + bodyHtml + '</div>',
        '</section>'
      );
    }
    return html.join('');
  }

  function sanitizeDescriptionHtml(html) {
    var template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll('script, style, iframe, object, embed').forEach(function (el) {
      el.remove();
    });
    template.content.querySelectorAll('*').forEach(function (el) {
      Array.from(el.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var value = String(attr.value || '');
        if (name.indexOf('on') === 0 || (/(href|src|xlink:href)/.test(name) && /^\s*javascript:/i.test(value))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return template.innerHTML;
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
      option.viewpointPoint
    );
    var explicitUri = option && (option.contentViewerUri || option.pdfjsUri)
      ? String(option.contentViewerUri || option.pdfjsUri || '')
      : '';
    var page = option && (option.page || option.pageNumber || option.viewpointPageNumber);
    var computedUri;

    if (point && wuwei.viewpoint && typeof wuwei.viewpoint.getContentTargetViewerUrl === 'function') {
      computedUri = wuwei.viewpoint.getContentTargetViewerUrl(node, page, point);
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
    uri = String(embed.uri || (resource && ((resource.original && resource.original.url) || resource.uri || resource.canonicalUri)) || '').trim();
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
      : String((resource && ((resource.original && resource.original.url) || (resource.original && resource.original.url) || resource.uri || resource.canonicalUri)) || '');
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
    var parsed, area, path, uid, basePath, direct;
    var text = String(uri || '').trim();

    if (wuwei.util && typeof wuwei.util.getResourceDirectFileUri === 'function') {
      direct = wuwei.util.getResourceDirectFileUri(wuwei.util.getResource ? wuwei.util.getResource(node) : (node && node.resource), 'original', node);
      if (direct) {
        return new URL(direct, window.location.origin).href;
      }
    }

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

  function applyPageFragment(uri, option) {
    var page = option && option.page;
    var text = String(uri || '');
    if ((page == null || page === '') && option) {
      page = option.viewpointPageNumber;
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
// info.generic.markup.js last modified 2026-03-2805-07
