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
        '<h3 id="editTimelineAxisTitle" class="edit-panel-title">' + t('Timeline axis') + '</h3>',
        '<input type="hidden" id="editTimelineAxisId">',
        '<input type="hidden" id="editTimelineAxisStart" value="0">',
        '<input type="hidden" id="editTimelineAxisEnd" value="0">',
        '<div id="editTimelineAxisMediaRow" class="edit-field">',
          '<label for="editTimelineAxisMedia" class="w3-col s4">' + t('Media') + '</label>',
          '<input id="editTimelineAxisMedia" class="w3-col s8" type="text" readonly>',
        '</div>',
        '<div id="editTimelineAxisDirectionRow" class="edit-field">',
          '<label for="editTimelineAxisDirection" class="w3-col s4">' + t('Direction') + '</label>',
          '<select id="editTimelineAxisDirection" class="w3-col s8">',
            '<option value="horizontal">' + t('horizontal') + '</option>',
            '<option value="vertical">' + t('vertical') + '</option>',
          '</select>',
        '</div>',
        '<div id="editTimelineAxisEndRow" class="edit-field">',
          '<label class="w3-col s4">' + t('Media length') + '</label>',
          '<input id="editTimelineAxisEndText" class="w3-col s8" type="text" readonly value="00:00">',
        '</div>',
        '<div id="editTimelineAxisDefaultDurationRow" class="edit-field">',
          '<label for="editTimelineAxisDefaultDuration" class="w3-col s6">' + t('Default play duration') + '</label>',
          '<input id="editTimelineAxisDefaultDuration" class="w3-col s6" type="number" step="1" min="1">',
        '</div>',
        '<div id="editTimelineAxisLengthRow" class="edit-field">',
          '<label for="editTimelineAxisLength" class="w3-col s3">' + t('Axis length') + ' (px)</label>',
          '<input id="editTimelineAxisLength" class="w3-col s3" type="number" step="1" min="60">',
        '</div>',
        '<div id="editTimelineAxisStrokeWidthRow" class="edit-field">',
          '<label for="editTimelineAxisStrokeWidth" class="w3-col s3">' + t('Axis width') + ' (px)</label>',
          '<input id="editTimelineAxisStrokeWidth" class="w3-col s3" type="number" step="1" min="1">',
        '</div>',
        '<div id="editTimelineAxisStrokeColorRow" class="edit-field">',
          '<label for="editTimelineAxisStrokeColor" class="w3-col s4">' + t('Axis color') + '</label>',
          '<div class="edit-color-inline w3-col s8">',
            '<input id="editTimelineAxisStrokeColor" class="w3-col s4" type="color">',
            '<div id="editTimelineAxisStrokeColorPalette" class="edit-color-palette w3-col s4"></div>',
          '</div>',
        '</div>',
      '</section>'
    ].join('\n');
  }

  function pointPanelHtml() {
    function t(str) {
      return wuwei.nls.translate(str);
    }

    return [
      '<section id="edit-timeline-point" class="edit-panel edit-timeline-panel" style="display:none;">',
        '<h3 class="edit-panel-title">' + t('Timeline segment') + '</h3>',
        '<input type="hidden" id="editTimelinePointId">',
        '<input type="hidden" id="editTimelinePointMediaStart" value="0">',
        '<input type="hidden" id="editTimelinePointMediaEnd" value="0">',
        '<input type="hidden" id="editTimelinePointDuration" value="0">',

        '<div class="edit-field edit-timeline-preview-field">',
          '<label>' + t('Video preview') + '</label>',
          '<div id="editTimelinePreviewHost" class="edit-timeline-preview-host"></div>',
          '<div class="edit-actions edit-timeline-capture-actions">',
            '<button id="editTimelineCaptureToStart" type="button">' + t('Set current time to start') + '</button>',
            '<button id="editTimelineCaptureToEnd" type="button">' + t('Set current time to end') + '</button>',
            '<button id="editTimelineCaptureThumbnail" type="button">' + t('Create thumbnail') + '</button>',
          '</div>',
        '</div>',

        '<div id="editTimelinePointStartRow" class="edit-field">',
          '<label for="editTimelinePointMediaStartText" class="w3-col s6">' + t('Start time') + '</label>',
          '<input id="editTimelinePointMediaStartText" class="w3-col s6" type="text" value="00:00" inputmode="numeric" placeholder="mm:ss ' + t('or') + ' hh:mm:ss">',
          '<input id="editTimelinePointMediaStart" type="hidden" value="0">',
        '</div>',

        '<div id="editTimelinePointEndRow" class="edit-field">',
          '<label for="editTimelinePointMediaEndText" class="w3-col s6">' + t('End time') + '</label>',
          '<input id="editTimelinePointMediaEndText" class="w3-col s6" type="text" value="00:00" inputmode="numeric" placeholder="mm:ss ' + t('or') + ' hh:mm:ss">',
          '<input id="editTimelinePointMediaEnd" type="hidden" value="0">',
        '</div>',

        '<div id="editTimelinePointDurationRow" class="edit-field">',
          '<label for="editTimelinePointDurationText" class="w3-col s6">' + t('Play duration') + '</label>',
          '<input id="editTimelinePointDurationText" class="w3-col s6" type="text" value="00:00" inputmode="numeric" placeholder="mm:ss ' + t('or') + ' hh:mm:ss">',
          '<input id="editTimelinePointDuration" type="hidden" value="0">',
        '</div>',

        '<div class="edit-field">',
          '<label for="editTimelinePointName" class="w3-col s4">' + t('Label') + '</label>',
          '<input id="editTimelinePointName" class="w3-col s8" type="text">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editTimelinePointValue">' + t('info') + '</label>',
          '<textarea id="editTimelinePointValue" rows="4"></textarea>',
        '</div>',

        '<div class="edit-field">',
          '<label for="style_fill" class="w3-col s6">' + t('Background Color') + '</label>',
          '<div class="edit-color-inline">',
            '<input id="style_fill" class="w3-col s6" type="color">',
            '<div id="editTimelinePointColorPalette" class="edit-color-palette w3-col s6"></div>',
          '</div>',
        '</div>',

        '<div class="edit-field">',
          '<label for="style_line_width" class="w3-col s3">' + t('Outline') + '</label>',
          '<input id="style_line_width" class="w3-col s3" type="number" step="1" min="0">',
          '<input id="style_line_color" class="w3-col s3" type="color">',
          '<div id="editTimelinePointOutlineColorPalette" class="edit-color-palette w3-col s3"></div>',
        '</div>',

        '<div class="edit-field">',
          '<label for="style_font_color" class="w3-col s4">' + t('Text Color') + '</label>',
          '<div class="edit-color-inline">',
            '<input id="style_font_color" class="w3-col s4" type="color">',
            '<div id="editTimelinePointFontColorPalette" class="edit-color-palette w3-col s4"></div>',
          '</div>',
        '</div>',

        '<div class="edit-field">',
          '<label for="applyToTimelineGroup" class="w3-col s10">' + t('Apply to group members') + '</label>',
          '<input type="checkbox" id="applyToTimelineGroup" class="w3-col s2">',
        '</div>',
        
        '<div class="edit-actions">',
          '<button id="editTimelinePointDelete" type="button">' + t('Delete') + '</button>',
        '</div>',
      '</section>'
    ].join('\n');
  }

  function panelsHtml() {
    return [axisPanelHtml(), pointPanelHtml()].join('');
  }

  function t(str) {
    return wuwei.nls.translate(str);
  }

  return {
    axisPanelHtml: axisPanelHtml,
    pointPanelHtml: pointPanelHtml,
    panelsHtml: panelsHtml
  };
})();
