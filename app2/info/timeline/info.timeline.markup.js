/**
 * info.timeline.markup.js
 * timeline info template
 *
 * Point information uses the same time meaning as edit.timeline:
 * - Start = mediaStart
 * - End   = mediaEnd
 * - Duration = mediaEnd - mediaStart
 * 
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
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
        '<span class="timeline-label">' + esc(label) + '</span>' +
        '<span class="timeline-value">' + esc(value) + '</span>' +
      '</div>';
  }

  function mediaBasicInfoHtml(info) {
    info = info || {};
    return '' +
      '<div class="timeline-media-info">' +
        '<h4 class="timeline-subheading">' + esc(t('Media information')) + '</h4>' +
        '<div class="timeline-grid">' +
          block(t('Title'), info.title || '', 'title') +
          block(t('Kind'), info.kind || '', 'kind') +
          block(t('Provider'), info.provider || info.videoKind || '', 'provider') +
          block(t('Duration'), info.durationText || '', 'duration') +
        '</div>' +
      '</div>';
  }

  function segmentListHtml(segments) {
    segments = Array.isArray(segments) ? segments : [];
    if (!segments.length) {
      return '' +
        '<div class="timeline-segment-list">' +
          '<h4 class="timeline-subheading">' + esc(t('Segment list')) + '</h4>' +
          '<div class="timeline-empty">' + esc(t('No segments')) + '</div>' +
        '</div>';
    }
    return '' +
      '<div class="timeline-segment-list">' +
        '<h4 class="timeline-subheading">' + esc(t('Segment list')) + '</h4>' +
        '<table class="timeline-segment-table timeline-label-start-table">' +
          '<thead><tr>' +
            '<th>' + esc(t('Label')) + '</th>' +
            '<th>' + esc(t('Start time')) + '</th>' +
          '</tr></thead>' +
          '<tbody>' + segments.map(function (seg) {
            return '<tr>' +
              '<td>' + esc(seg.label || '') + '</td>' +
              '<td>' + esc(seg.startText || '') + '</td>' +
            '</tr>';
          }).join('') + '</tbody>' +
        '</table>' +
      '</div>';
  }

  function axisTemplate(param) {
    var group = (param && param.group) || {};
    return '' +
      '<section class="timeline-info timeline-axis-info">' +
        '<div class="timeline-heading-wrap">' +
          '<h3 class="timeline-heading">' + esc(group.name || 'Timeline') + '</h3>' +
        '</div>' +
        '<div class="timeline-preview-wrap">' +
          '<div id="infoTimelinePreviewHost" class="timeline-preview-host"></div>' +
        '</div>' +
        '<div class="timeline-grid">' +
            block(t('Axis'), group.orientation || '', 'axis') +
            block(t('End'), (param && param.endText) || '', 'end') +
            block(t('Length'), group.length || '', 'length') +
            block(t('Media'), (param && param.mediaName) || '', 'media') +
            block(t('Segments'), (param && param.segmentCount) || 0, 'segments') +
            block(t('Default'), (param && param.defaultPlayDuration) || 0, 'default') +
        '</div>' +
        mediaBasicInfoHtml(param && param.mediaInfo) +
        segmentListHtml(param && param.segments) +
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
            block(t('Start time'), (param && param.startText) || '', 'start') +
            block(t('End time'), (param && param.endText) || '', 'end') +
            block(t('Play duration'), (param && param.durationText) || '', 'duration') +
        '</div>' +
        (memo ? '<div class="timeline-memo-wrap"><div class="timeline-label">' + esc(t('Memo')) + '</div><pre class="timeline-memo">' + esc(memo) + '</pre></div>' : '') +
      '</section>';
  }

  function paneTemplate() {
    return '<div id="info-timeline" class="timeline-pane" style="display:none"></div>';
  }

  function t(text) {
    return wuwei.nls.translate(text);
  }
  return {
    paneTemplate: paneTemplate,
    axisTemplate: axisTemplate,
    pointTemplate: pointTemplate
  };
})();
