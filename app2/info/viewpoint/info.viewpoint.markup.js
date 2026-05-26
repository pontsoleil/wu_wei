/**
 * info.viewpoint.markup.js
 * viewpoint axis and PageMarker info template
 */
wuwei.info = wuwei.info || {};
wuwei.info.viewpoint = wuwei.info.viewpoint || {};
wuwei.info.viewpoint.markup = (function () {
  'use strict';

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function t(text) {
    return wuwei.nls.translate(text);
  }

  function block(label, value, klass) {
    if (!!label) {
      return '' +
        '<div class="viewpoint-field ' + (klass || '') + '">' +
          '<div class="viewpoint-label">' + esc(label) + '</div>' +
          '<div class="viewpoint-value">' + esc(value) + '</div>' +
        '</div>';
    }
    return '' +
      '<div class="viewpoint-field ' + (klass || '') + '">' +
        '<div class="viewpoint-value">' + esc(value) + '</div>' +
      '</div>';
  }

  function markerListTemplate(markers) {
    markers = Array.isArray(markers) ? markers : [];
    if (!markers.length) { return ''; }

    return '' +
      '<div class="viewpoint-marker-list-wrap">' +
      '<h4 class="viewpoint-subheading">' + esc(t('PageMarkers')) + '</h4>' +
      '<div class="viewpoint-marker-list">' +
      markers.map(function (marker) {
        var hasAnchor = !!marker.anchorHref;
        var refLabel = hasAnchor ? t('Anchor href') : t('Page number');
        var refValue = hasAnchor ? marker.anchorHref : marker.pageNumber;
        return '' +
          '<div class="viewpoint-marker-row">' +
          '<div class="viewpoint-marker-title">' + esc(marker.label || t('PageMarker')) + '</div>' +
          '<div class="viewpoint-marker-ref"><span>' + esc(refLabel) + ':</span> ' + esc(refValue) + '</div>' +
          (marker.description
            ? '<pre class="viewpoint-marker-description">' + esc(marker.description) + '</pre>'
            : '') +
          '</div>';
      }).join('') +
      '</div>' +
      '</div>';
  }

  function axisTemplate(param) {
    var group = (param && param.group) || {};
    var markers = (param && param.markers) || [];
    var showPageOffset = !!(param && param.showPageOffset);
    var pageOffset = showPageOffset && Number.isFinite(Number(param.pageOffset))
      ? Math.max(0, Math.floor(Number(param.pageOffset)))
      : 0;

    return '' +
      '<section class="viewpoint-info viewpoint-axis-info">' +
      '<div class="viewpoint-heading-wrap">' +
      '<h3 class="viewpoint-heading">' + esc(group.name || t('Viewpoint')) + '</h3>' +
      '</div>' +
      '<div class="viewpoint-grid">' +
      block(t('Axis'), group.orientation || '', 'axis') +
      block(t('Unit'), (group.axis && group.axis.unit) || 'page', 'unit') +
      (showPageOffset ? block(t('Page offset'), pageOffset, 'page-offset') : '') +
      block(t('Markers'), (param && param.markerCount) || 0, 'markers') +
      block(t('Document'), (param && param.documentName) || '', 'document') +
      '</div>' +
      markerListTemplate(markers) +
      '</section>';
  }

  function markerTemplate(param) {
    var point = (param && param.point) || {};
    var pageNumber = (param && param.pageNumber) || point.pageNumber || 1;
    var documentName = (param && param.documentName) || '';
    var markerLabel = point.label || ('p.' + pageNumber);
    var viewerUri = String((param && param.viewerUri) || '');
    var anchorHref = String(point.htmlAnchorHref || point.anchorHref || '');
    var description = (point.description && 'object' === typeof point.description)
      ? point.description.body
      : (point.value || '');

    return '' +
      '<section class="viewpoint-info viewpoint-marker-info">' +
      '<div class="viewpoint-heading-wrap">' +
      '<h3 class="viewpoint-heading">' + esc(documentName || t('Viewpoint')) + '</h3>' +
      '</div>' +
      '<div class="viewpoint-grid">' +
      block(null, markerLabel, 'marker-label') +
      block(t('Page number'), pageNumber, 'page') +
      (anchorHref ? block(t('Anchor href'), anchorHref, 'anchor') : '') +
      // block(t('Axis'), (param && param.axisName) || '', 'axis') +
      // block(t('Document'), documentName, 'document') +
      '</div>' +
      (viewerUri
        ? '<div class="viewpoint-viewer-wrap">' +
        wuwei.info.iframeNoticeHtml(viewerUri, { className: 'viewpoint-iframe-notice' }) +
        wuwei.info.openActionsHtml(viewerUri, {
          className: 'viewpoint-open-window',
          windowFeatures: 'width=600,height=400,resizable=yes,scrollbars=yes'
        }) +
        '<iframe id="infoViewpointFrame" class="viewpoint-viewer-frame" src="' + esc(viewerUri) + '" ' +
        'onerror="wuwei.info.iframeError()"></iframe>' +
        '</div>'
        : '') +
      (description
        ? '<div class="viewpoint-memo-wrap">' +
        '<div class="viewpoint-label">' + esc(t('Comment')) + '</div>' +
        '<pre class="viewpoint-memo">' + esc(description) + '</pre>' +
        '</div>'
        : '') +
      '</section>';
  }

  function paneTemplate() {
    return '<div id="info-viewpoint" class="viewpoint-pane" style="display:none"></div>';
  }

  return {
    paneTemplate: paneTemplate,
    axisTemplate: axisTemplate,
    markerTemplate: markerTemplate
  };
})();
