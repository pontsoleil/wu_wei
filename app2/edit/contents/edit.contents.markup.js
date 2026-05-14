/**
 * edit.content.markup.js
 * Contents axis editor template
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.contents = wuwei.edit.contents || {};

wuwei.edit.contents.markup = (function () {
  'use strict';

  function axisPanelHtml() {
    return [
      '<section id="edit-contents-axis" class="edit-panel edit-contents-panel content" style="display:none;">',
        '<input type="hidden" id="editContentsAxisId">',
        '<div class="edit-field">',
          '<label for="editContentsAxisLabel" class="w3-col s4">' + t('Label') + '</label>',
          '<input id="editContentsAxisLabel" class="w3-col s8 edit-value" type="text">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editContentsRepShape" class="w3-col s4">' + t('Shape') + '</label>',
          selectOptions('editContentsRepShape', 'RECTANGLE', nodeShapeOptions(), 'Shape', 's8'),
        '</div>',
        '<div id="editContentsRepSizeRadiusRow" class="edit-field" style="display:none;">',
          '<label for="editContentsRepSizeRadius" class="w3-col s4">' + t('Radius') + '</label>',
          '<input id="editContentsRepSizeRadius" class="w3-col s8 edit-value" type="number" step="1" min="1">',
        '</div>',
        '<div id="editContentsRepSizeWidthHeightRow" class="edit-field">',
          '<label for="editContentsRepSizeWidth" class="w3-col s2">' + t('Width') + '</label>',
          '<input id="editContentsRepSizeWidth" class="w3-col s4 edit-value" type="number" step="1" min="1">',
          '<label for="editContentsRepSizeHeight" class="w3-col s2">' + t('Height') + '</label>',
          '<input id="editContentsRepSizeHeight" class="w3-col s4 edit-value" type="number" step="1" min="1">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editContentsAxisDirection" class="w3-col s4">' + t('Direction') + '</label>',
          '<select id="editContentsAxisDirection" class="w3-col s8 edit-value">',
            '<option value="horizontal">' + t('horizontal') + '</option>',
            '<option value="vertical">' + t('vertical') + '</option>',
          '</select>',
        '</div>',
        '<div class="edit-field">',
          '<label for="editContentsAxisLength" class="w3-col s6">' + t('Axis length') + ' (px)</label>',
          '<input id="editContentsAxisLength" class="w3-col s6 edit-value" type="number" step="1" min="60">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editContentsPageOffset" class="w3-col s6">' + t('Page offset') + '</label>',
          '<input id="editContentsPageOffset" class="w3-col s6 edit-value" type="number" step="1" min="0" value="0">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editContentsAxisStrokeWidth" class="w3-col s6">' + t('Axis width') + ' (px)</label>',
          '<input id="editContentsAxisStrokeWidth" class="w3-col s6 edit-value" type="number" step="1" min="1">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editContentsAxisStrokeColor" class="w3-col s4">' + t('Axis color') + '</label>',
          '<div class="edit-color-inline w3-col s8">',
            '<input id="editContentsAxisStrokeColor" class="w3-col s4" type="color">',
            '<div id="editContentsAxisStrokeColorPalette" class="edit-color-palette w3-col s4"></div>',
          '</div>',
        '</div>',
      '</section>'
    ].join('\n');
  }

  function pageMarkerPanelHtml() {
    function t(str) {
      return wuwei.nls.translate(str);
    }

    return [
      '<section id="edit-contents-page-marker" class="edit-panel edit-contents-panel" style="display:none;">',
        '<h3 class="edit-panel-title">' + t('Contents PageMarker') + '</h3>',
        '<form id="editform" class="contents-page-marker form-group content" onsubmit="return false;">',
          '<input type="hidden" id="editContentsPageMarkerId">',
          '<div class="w3-row">',
            '<textarea id="label" name="label" class="w3-col s12 edit-value" rows="1" placeholder="' + t('Label') + '"></textarea>',
          '</div>',
          '<div class="w3-row">',
            '<textarea id="description_body" name="description.body" class="w3-col s12 edit-value" rows="3"></textarea>',
          '</div>',
          '<div id="documentPageMarkerFields" class="contents-document-marker-fields">',
            '<div id="pageNumberRow" class="w3-row">',
              '<label for="pageNumber" class="w3-col s4">' + t('Page number') + ':</label>',
              '<input type="number" id="pageNumber" name="pageNumber" class="w3-col s8 edit-value" min="1" step="1">',
            '</div>',
          '</div>',
          '<div id="htmlPageMarkerFields" class="contents-html-marker-fields" style="display:none;">',
            '<div id="anchorHrefRow" class="w3-row">',
              '<label for="htmlAnchorHref" class="w3-col s4">Anchor href:</label>',
              '<input type="text" id="htmlAnchorHref" name="anchorHref" class="w3-col s8 edit-value" placeholder="#3-xbrl-csv-report-structure">',
            '</div>',
          '</div>',
          '<div class="w3-row">',
            '<label for="editContentsPageMarkerShape" class="w3-col s4">' + t('Shape') + '</label>',
            selectOptions('editContentsPageMarkerShape', 'CIRCLE', nodeShapeOptions(), 'Shape', 's8'),
          '</div>',
          '<div id="editContentsPageMarkerSizeRadiusRow" class="w3-row">',
            '<label for="editContentsPageMarkerSizeRadius" class="w3-col s4">' + t('Radius') + '</label>',
            '<input type="number" id="editContentsPageMarkerSizeRadius" class="w3-col s8 edit-value" min="1" step="1">',
          '</div>',
          '<div id="editContentsPageMarkerSizeWidthHeightRow" class="w3-row" style="display:none;">',
            '<label for="editContentsPageMarkerSizeWidth" class="w3-col s2">' + t('Width') + '</label>',
            '<input type="number" id="editContentsPageMarkerSizeWidth" class="w3-col s4 edit-value" min="1" step="1">',
            '<label for="editContentsPageMarkerSizeHeight" class="w3-col s2">' + t('Height') + '</label>',
            '<input type="number" id="editContentsPageMarkerSizeHeight" class="w3-col s4 edit-value" min="1" step="1">',
          '</div>',
          '<hr>',
          '<div class="w3-row">',
            '<label for="style_fill" class="w3-col s4">' + t('Background') + '</label>',
            '<input type="color" id="style_fill" name="style.fill" class="w3-col s4 pointer edit-value">',
            '<div id="editContentsPageFillPalette" class="edit-color-palette w3-col s4 pointer"></div>',
          '</div>',
          '<div class="w3-row">',
            '<label for="style_line_width" class="w3-col s3">' + t('Outline') + '</label>',
            '<input type="number" id="style_line_width" name="style.line.width" class="w3-col s3 edit-value" step="1" min="0">',
            '<input type="color" id="style_line_color" name="style.line.color" class="w3-col s3 pointer edit-value">',
            '<div id="editContentsPageOutlinePalette" class="edit-color-palette w3-col s3 pointer"></div>',
          '</div>',
          '<div class="w3-row">',
            '<label for="style_font_color" class="w3-col s3">' + t('Text') + '</label>',
            '<input type="color" id="style_font_color" name="style.font.color" class="w3-col s3 pointer edit-value">',
            '<div id="editContentsPageFontPalette" class="edit-color-palette w3-col s3 pointer"></div>',
            selectOptions('style.font.size', '12pt', wuwei.common.fontSizes, 'Size', 's3'),
          '</div>',
          '<div class="w3-row">',
            '<label class="w3-col s4">' + t('Label align') + '</label>',
            labelAlignIcons('center', 's8'),
          '</div>',
          '<div class="w3-row">',
            '<label for="style_label_width" class="w3-col s4">' + t('Label width') + '</label>',
            '<input type="number" id="style_label_width" name="style.label.width" class="w3-col s8 edit-value" step="1" min="1">',
          '</div>',
          '<div class="w3-row">',
            '<label for="style_label_lines" class="w3-col s4">' + t('Label lines') + '</label>',
            '<input type="number" id="style_label_lines" name="style.label.lines" class="w3-col s8 edit-value" step="1" min="1">',
          '</div>',
          '<div class="w3-row">',
            '<label for="style_label_offset_x" class="w3-col s4">' + t('Label offset X') + '</label>',
            '<input type="number" id="style_label_offset_x" name="style.label.offset.x" class="w3-col s8 edit-value" step="1">',
          '</div>',
          '<div class="w3-row">',
            '<label for="style_label_offset_y" class="w3-col s4">' + t('Label offset Y') + '</label>',
            '<input type="number" id="style_label_offset_y" name="style.label.offset.y" class="w3-col s8 edit-value" step="1">',
          '</div>',
          '<div class="w3-row">',
            '<label for="applyToContentsGroup" class="w3-col s10">' + t('Apply to group members') + '</label>',
            '<input type="checkbox" id="applyToContentsGroup" class="w3-col s2">',
          '</div>',
        '</form>',
      '</section>'
    ].join('\n');
  }

  function panelsHtml() {
    return [axisPanelHtml(), pageMarkerPanelHtml()].join('\n');
  }

  function labelAlignIcons(value, size) {
    value = String(value || 'center').toLowerCase();
    return [
      '<div class="nFont_text-anchor w3-col ' + (size || 's8') + '">',
      '  <i class="nFont_text-anchor start fas fa-align-left ' + (('left' === value) ? 'checked' : '') + '" title="left"></i>',
      '  <i class="nFont_text-anchor middle fas fa-align-center ' + (('center' === value) ? 'checked' : '') + '" title="center"></i>',
      '  <i class="nFont_text-anchor end fas fa-align-right ' + (('right' === value) ? 'checked' : '') + '" title="right"></i>',
      '</div>'
    ].join('');
  }


  function nodeShapeOptions() {
    return (wuwei.common.shapes || []).filter(function (item) {
      return item && item.value !== 'THUMBNAIL';
    });
  }

  function selectOptions(name, value, options, placeholder, size) {
    return wuwei.edit.markup.selectOptions(name, value, options, placeholder, size);
  }

  function t(str) {
    return wuwei.nls.translate(str);
  }

  return {
    axisPanelHtml: axisPanelHtml,
    pageMarkerPanelHtml: pageMarkerPanelHtml,
    panelsHtml: panelsHtml,

  };
})();
