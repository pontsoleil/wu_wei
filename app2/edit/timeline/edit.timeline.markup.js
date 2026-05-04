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
        '<h3 id="editTimelineAxisTitle" class="edit-panel-title">' + translate('Timeline axis') + '</h3>',
        '<input type="hidden" id="editTimelineAxisId">',
        '<input type="hidden" id="editTimelineAxisStart" value="0">',
        '<input type="hidden" id="editTimelineAxisEnd" value="0">',
        '<div id="editTimelineAxisMediaRow" class="edit-field">',
          '<label for="editTimelineAxisMedia" class="w3-col s4">' + translate('Media') + '</label>',
          '<input id="editTimelineAxisMedia" class="w3-col s8" type="text" readonly>',
        '</div>',
        '<div id="editTimelineAxisDirectionRow" class="edit-field">',
          '<label for="editTimelineAxisDirection" class="w3-col s4">' + translate('Direction') + '</label>',
          '<select id="editTimelineAxisDirection" class="w3-col s8">',
            '<option value="horizontal">' + translate('horizontal') + '</option>',
            '<option value="vertical">' + translate('vertical') + '</option>',
          '</select>',
        '</div>',
        '<div id="editTimelineAxisEndRow" class="edit-field">',
          '<label class="w3-col s4">' + translate('Media length') + '</label>',
          '<input id="editTimelineAxisEndText" class="w3-col s8" type="text" readonly value="00:00">',
        '</div>',
        '<div id="editTimelineAxisDefaultDurationRow" class="edit-field">',
          '<label for="editTimelineAxisDefaultDuration" class="w3-col s6">' + translate('Default play duration') + '</label>',
          '<input id="editTimelineAxisDefaultDuration" class="w3-col s6" type="number" step="1" min="1">',
        '</div>',
        '<div id="editTimelineAxisLengthRow" class="edit-field">',
          '<label for="editTimelineAxisLength" class="w3-col s3">' + translate('Axis length') + ' (px)</label>',
          '<input id="editTimelineAxisLength" class="w3-col s3" type="number" step="1" min="60">',
        '</div>',
        '<div id="editTimelineAxisStrokeWidthRow" class="edit-field">',
          '<label for="editTimelineAxisStrokeWidth" class="w3-col s3">' + translate('Axis width') + ' (px)</label>',
          '<input id="editTimelineAxisStrokeWidth" class="w3-col s3" type="number" step="1" min="1">',
        '</div>',
        '<div id="editTimelineAxisStrokeColorRow" class="edit-field">',
          '<label for="editTimelineAxisStrokeColor" class="w3-col s4">' + translate('Axis color') + '</label>',
          '<div class="edit-color-inline w3-col s8">',
            '<input id="editTimelineAxisStrokeColor" class="w3-col s4" type="color">',
            '<div id="editTimelineAxisStrokeColorPalette" class="edit-color-palette w3-col s4"></div>',
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
          '<label for="editTimelinePointMediaStartText" class="w3-col s6">' + translate('Start time') + '</label>',
          '<input id="editTimelinePointMediaStartText" class="w3-col s6" type="text" value="00:00" inputmode="numeric" placeholder="mm:ss ' + translate('or') + ' hh:mm:ss">',
          '<input id="editTimelinePointMediaStart" type="hidden" value="0">',
        '</div>',

        '<div id="editTimelinePointEndRow" class="edit-field">',
          '<label for="editTimelinePointMediaEndText" class="w3-col s6">' + translate('End time') + '</label>',
          '<input id="editTimelinePointMediaEndText" class="w3-col s6" type="text" value="00:00" inputmode="numeric" placeholder="mm:ss ' + translate('or') + ' hh:mm:ss">',
          '<input id="editTimelinePointMediaEnd" type="hidden" value="0">',
        '</div>',

        '<div id="editTimelinePointDurationRow" class="edit-field">',
          '<label for="editTimelinePointDurationText" class="w3-col s6">' + translate('Play duration') + '</label>',
          '<input id="editTimelinePointDurationText" class="w3-col s6" type="text" value="00:00" inputmode="numeric" placeholder="mm:ss ' + translate('or') + ' hh:mm:ss">',
          '<input id="editTimelinePointDuration" type="hidden" value="0">',
        '</div>',

        '<div class="edit-field">',
          '<label for="editTimelinePointName" class="w3-col s4">' + translate('Label') + '</label>',
          '<input id="editTimelinePointName" class="w3-col s8" type="text">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editTimelinePointValue">' + translate('info') + '</label>',
          '<textarea id="editTimelinePointValue" rows="4"></textarea>',
        '</div>',

        '<div class="edit-field">',
          '<label for="editTimelinePointColor" class="w3-col s6">' + translate('Background Color') + '</label>',
          '<div class="edit-color-inline">',
            '<input id="editTimelinePointColor" class="w3-col s6" type="color">',
            '<div id="editTimelinePointColorPalette" class="edit-color-palette w3-col s6"></div>',
          '</div>',
        '</div>',

        '<div class="edit-field">',
          '<label for="editTimelinePointOutlineWidth" class="w3-col s3">' + translate('Outline') + '</label>',
          '<input id="editTimelinePointOutlineWidth" class="w3-col s3" type="number" step="1" min="0">',
          '<input id="editTimelinePointOutlineColor" class="w3-col s3" type="color">',
          '<div id="editTimelinePointOutlineColorPalette" class="edit-color-palette w3-col s3"></div>',
        '</div>',

        '<div class="edit-field">',
          '<label for="editTimelinePointFontColor" class="w3-col s4">' + translate('Text Color') + '</label>',
          '<div class="edit-color-inline">',
            '<input id="editTimelinePointFontColor" class="w3-col s4" type="color">',
            '<div id="editTimelinePointFontColorPalette" class="edit-color-palette w3-col s4"></div>',
          '</div>',
        '</div>',

        '<div class="edit-field">',
          '<label for="applyToTimelineGroup" class="w3-col s10">グループメンバーへ一括適用</label>',
          '<input type="checkbox" id="applyToTimelineGroup" class="w3-col s2">',
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
