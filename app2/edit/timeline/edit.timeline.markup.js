/**
 * edit.timeline.markup.js
 * timeline editor template
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.timeline = wuwei.edit.timeline || {};

wuwei.edit.timeline.markup = (function () {
  'use strict';

  function axisPanelHtml() {
    return [
      '<section id="edit-timeline-axis" class="edit-panel edit-timeline-panel" style="display:none;">',
        '<h3 class="edit-panel-title">' + translate('Timeline axis') + '</h3>',
        '<input type="hidden" id="editTimelineAxisId">',
        '<input type="hidden" id="editTimelineAxisStart" value="0">',
        '<input type="hidden" id="editTimelineAxisEnd" value="0">',
        '<div class="edit-field">',
          '<label for="editTimelineAxisMedia">' + translate('Media') + '</label>',
          '<input id="editTimelineAxisMedia" type="text" readonly>',
        '</div>',
        '<div class="edit-field">',
          '<label for="editTimelineAxisDirection">' + translate('Direction') + '</label>',
          '<select id="editTimelineAxisDirection">',
            '<option value="horizontal">' + translate('horizontal') + '</option>',
            '<option value="vertical">' + translate('vertical') + '</option>',
          '</select>',
        '</div>',
        '<div class="edit-field">',
          '<label>' + translate('Media length') + '</label>',
          '<input id="editTimelineAxisEndText" type="text" readonly value="00:00">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editTimelineAxisDefaultDuration">' + translate('Default play duration') + '</label>',
          '<input id="editTimelineAxisDefaultDuration" type="number" step="1" min="1">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editTimelineAxisLength">' + translate('Axis length') + ' (px)</label>',
          '<input id="editTimelineAxisLength" type="number" step="1" min="60">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editTimelineAxisStrokeWidth">' + translate('Axis width') + ' (px)</label>',
          '<input id="editTimelineAxisStrokeWidth" type="number" step="1" min="1">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editTimelineAxisStrokeColor">' + translate('Axis color') + '</label>',
          '<div class="edit-color-inline">',
            '<input id="editTimelineAxisStrokeColor" type="color">',
            '<div id="editTimelineAxisStrokeColorPalette" class="edit-color-palette"></div>',
          '</div>',
        '</div>',
      '</section>'
    ].join('\n');
  }

  function pointPanelHtml() {
    return [
      '<section id="edit-timeline-point" class="edit-panel edit-timeline-panel" style="display:none;">',
        '<h3 class="edit-panel-title">' + translate('Timeline segment') + '</h3>',
        '<input type="hidden" id="editTimelinePointId">',
        '<input type="hidden" id="editTimelinePointMediaStart" value="0">',
        '<input type="hidden" id="editTimelinePointMediaEnd" value="0">',
        '<input type="hidden" id="editTimelinePointDuration" value="0">',

        '<div class="edit-field edit-timeline-preview-field">',
          '<label>' + translate('Video preview') + '</label>',
          '<div id="editTimelinePreviewHost" class="edit-timeline-preview-host"></div>',
          '<div class="edit-actions edit-timeline-capture-actions">',
            '<button id="editTimelineCaptureToStart" type="button">' + translate('Set current time to start') + '</button>',
            '<button id="editTimelineCaptureToEnd" type="button">' + translate('Set current time to end') + '</button>',
            '<button id="editTimelineCaptureThumbnail" type="button">' + translate('Create thumbnail') + '</button>',
          '</div>',
        '</div>',

        '<div id="editTimelinePointStartRow" class="edit-field">',
          '<label for="editTimelinePointMediaStartText">' + translate('Start time') + '</label>',
          '<input id="editTimelinePointMediaStartText" type="text" value="00:00" inputmode="numeric" placeholder="mm:ss ' + translate('or') + ' hh:mm:ss">',
          '<input id="editTimelinePointMediaStart" type="hidden" value="0">',
        '</div>',

        '<div id="editTimelinePointEndRow" class="edit-field">',
          '<label for="editTimelinePointMediaEndText">' + translate('End time') + '</label>',
          '<input id="editTimelinePointMediaEndText" type="text" value="00:00" inputmode="numeric" placeholder="mm:ss ' + translate('or') + ' hh:mm:ss">',
          '<input id="editTimelinePointMediaEnd" type="hidden" value="0">',
        '</div>',

        '<div id="editTimelinePointDurationRow" class="edit-field">',
          '<label for="editTimelinePointDurationText">' + translate('Play duration') + '</label>',
          '<input id="editTimelinePointDurationText" type="text" value="00:00" inputmode="numeric" placeholder="mm:ss ' + translate('or') + ' hh:mm:ss">',
          '<input id="editTimelinePointDuration" type="hidden" value="0">',
        '</div>',

        '<div class="edit-field">',
          '<label for="editTimelinePointName">' + translate('Label') + '</label>',
          '<input id="editTimelinePointName" type="text">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editTimelinePointValue">' + translate('info') + '</label>',
          '<textarea id="editTimelinePointValue" rows="4"></textarea>',
        '</div>',

        '<div class="edit-field">',
          '<label for="editTimelinePointColor">' + translate('Background Color') + '</label>',
          '<div class="edit-color-inline">',
            '<input id="editTimelinePointColor" type="color">',
            '<div id="editTimelinePointColorPalette" class="edit-color-palette"></div>',
          '</div>',
        '</div>',

        '<div class="edit-field">',
          '<label for="editTimelinePointFontColor">' + translate('Text Color') + '</label>',
          '<div class="edit-color-inline">',
            '<input id="editTimelinePointFontColor" type="color">',
            '<div id="editTimelinePointFontColorPalette" class="edit-color-palette"></div>',
          '</div>',
        '</div>',
        
        '<div class="edit-actions">',
          '<button id="editTimelinePointDelete" type="button">' + translate('Delete') + '</button>',
        '</div>',
      '</section>'
    ].join('\n');
  }

  function panelsHtml() {
    return [axisPanelHtml(), pointPanelHtml()].join('');
  }

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    axisPanelHtml: axisPanelHtml,
    pointPanelHtml: pointPanelHtml,
    panelsHtml: panelsHtml
  };
})();
