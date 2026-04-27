/**
 * info.timeline.markup.js
 * timeline info template
 *
 * Point information uses the same time meaning as edit.timeline:
 * - Start = mediaStart
 * - End   = mediaEnd
 * - Duration = mediaEnd - mediaStart
 * 

 */
wuwei.info = wuwei.info || {};
wuwei.info.timeline = wuwei.info.timeline || {};
wuwei.info.timeline.markup = (function () {
  'use strict';

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function block(label, value, klass) {
    return '' +
      '<div class="timeline-field ' + (klass || '') + '">' +
        '<div class="timeline-label">' + esc(label) + '</div>' +
        '<div class="timeline-value">' + esc(value) + '</div>' +
      '</div>';
  }

  function axisTemplate(param) {
    var group = (param && param.group) || {};
    return '' +
      '<section class="timeline-info timeline-axis-info">' +
        '<div class="timeline-heading-wrap">' +
          '<h3 class="timeline-heading">' + esc(group.name || 'Timeline') + '</h3>' +
        '</div>' +
        '<div class="timeline-grid">' +
            block(wuwei.nls.translate('Axis'), group.orientation || '', 'axis') +
            block(wuwei.nls.translate('End'), (param && param.endText) || '', 'end') +
            block(wuwei.nls.translate('Length'), group.length || '', 'length') +
            block(wuwei.nls.translate('Media'), (param && param.mediaName) || '', 'media') +
            block(wuwei.nls.translate('Segments'), (param && param.segmentCount) || 0, 'segments') +
            block(wuwei.nls.translate('Default'), (param && param.defaultPlayDuration) || 0, 'default') +
        '</div>' +
      '</section>';
  }

  function pointTemplate(param) {
    var point = (param && param.point) || {};
    var segment = (param && param.segment) || {};
    var memo = (param && param.memo) || '';
    return '' +
      '<section class="timeline-info timeline-point-info">' +
        '<div class="timeline-heading-wrap">' +
          '<h3 class="timeline-heading">' + esc(segment.label || '') + '</h3>' +
        '</div>' +
        '<div class="timeline-preview-wrap">' +
          '<div id="infoTimelinePreviewHost" class="timeline-preview-host"></div>' +
        '</div>' +
        '<div class="timeline-grid">' +
            block(wuwei.nls.translate('Start time'), (param && param.startText) || '', 'start') +
            block(wuwei.nls.translate('End time'), (param && param.endText) || '', 'end') +
            block(wuwei.nls.translate('Play duration'), (param && param.durationText) || '', 'duration') +
        '</div>' +
        (memo ? '<div class="timeline-memo-wrap"><div class="timeline-label">' + esc(wuwei.nls.translate('Memo')) + '</div><pre class="timeline-memo">' + esc(memo) + '</pre></div>' : '') +
      '</section>';
  }

  function paneTemplate() {
    return '<div id="info-timeline" class="timeline-pane" style="display:none"></div>';
  }

  return {
    paneTemplate: paneTemplate,
    axisTemplate: axisTemplate,
    pointTemplate: pointTemplate
  };
})();
