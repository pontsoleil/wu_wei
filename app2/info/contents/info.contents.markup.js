/**
 * info.contents.markup.js
 * contents axis and PageMarker info template
 */
wuwei.info = wuwei.info || {};
wuwei.info.contents = wuwei.info.contents || {};
wuwei.info.contents.markup = (function () {
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
    return '' +
      '<div class="contents-field ' + (klass || '') + '">' +
        '<div class="contents-label">' + esc(label) + '</div>' +
        '<div class="contents-value">' + esc(value) + '</div>' +
      '</div>';
  }

  function markerListTemplate(markers) {
    markers = Array.isArray(markers) ? markers : [];
    if (!markers.length) { return ''; }

    return '' +
      '<div class="contents-marker-list-wrap">' +
        '<h4 class="contents-subheading">' + esc(t('PageMarkers')) + '</h4>' +
        '<div class="contents-marker-list">' +
          markers.map(function (marker) {
            var hasAnchor = !!marker.anchorHref;
            var refLabel = hasAnchor ? t('Anchor href') : t('Page number');
            var refValue = hasAnchor ? marker.anchorHref : marker.pageNumber;
            return '' +
              '<div class="contents-marker-row">' +
                '<div class="contents-marker-title">' + esc(marker.label || t('PageMarker')) + '</div>' +
                '<div class="contents-marker-ref"><span>' + esc(refLabel) + ':</span> ' + esc(refValue) + '</div>' +
                (marker.description
                  ? '<pre class="contents-marker-description">' + esc(marker.description) + '</pre>'
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
      '<section class="contents-info contents-axis-info">' +
        '<div class="contents-heading-wrap">' +
          '<h3 class="contents-heading">' + esc(group.name || t('Contents')) + '</h3>' +
        '</div>' +
        '<div class="contents-grid">' +
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
    var description = (point.description && 'object' === typeof point.description)
      ? point.description.body
      : (point.value || '');
    return '' +
      '<section class="contents-info contents-marker-info">' +
        '<div class="contents-heading-wrap">' +
          '<h3 class="contents-heading">' + esc(point.label || t('PageMarker')) + '</h3>' +
        '</div>' +
        '<div class="contents-grid">' +
          block(t('Page'), (param && param.pageNumber) || point.pageNumber || 1, 'page') +
          block(t('Axis'), (param && param.axisName) || '', 'axis') +
          block(t('Document'), (param && param.documentName) || '', 'document') +
        '</div>' +
        (description
          ? '<div class="contents-memo-wrap">' +
              '<div class="contents-label">' + esc(t('Comment')) + '</div>' +
              '<pre class="contents-memo">' + esc(description) + '</pre>' +
            '</div>'
          : '') +
      '</section>';
  }

  function paneTemplate() {
    return '<div id="info-contents" class="contents-pane" style="display:none"></div>';
  }

  return {
    paneTemplate: paneTemplate,
    axisTemplate: axisTemplate,
    markerTemplate: markerTemplate
  };
})();
