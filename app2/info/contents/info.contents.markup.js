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

  function axisTemplate(param) {
    var group = (param && param.group) || {};
    return '' +
      '<section class="contents-info contents-axis-info">' +
        '<div class="contents-heading-wrap">' +
          '<h3 class="contents-heading">' + esc(group.name || t('Contents')) + '</h3>' +
        '</div>' +
        '<div class="contents-grid">' +
          block(t('Axis'), group.orientation || '', 'axis') +
          block(t('Unit'), (group.axis && group.axis.unit) || 'page', 'unit') +
          block(t('Length'), group.length || '', 'length') +
          block(t('Pages'), (param && param.pageCount) || group.pageCount || '', 'pages') +
          block(t('Markers'), (param && param.markerCount) || 0, 'markers') +
          block(t('Document'), (param && param.documentName) || '', 'document') +
        '</div>' +
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
