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
        // '<h3 class="edit-panel-title">' + t('Edit perspective') + '</h3>',
        '<input type="hidden" id="editContentsAxisId">',
        // '<h4 class="edit-section-title">' + t('Perspective info') + '</h4>',
        '<div class="edit-field">',
          '<label for="editContentsAxisLabel" class="w3-col s4">' + t('Label') + '</label>',
          '<input id="editContentsAxisLabel" class="w3-col s8 edit-value" type="text">',
        '</div>',
        // '<h4 class="edit-section-title">' + t('Representative appearance') + '</h4>',
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
        // '<h4 class="edit-section-title">' + t('Axis properties') + '</h4>',
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
          '<label for="editContentsFirstPageNumber" class="w3-col s6">' + t('First page number') + '</label>',
          '<input id="editContentsFirstPageNumber" class="w3-col s6 edit-value" type="number" step="1" min="1" value="1">',
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
        // '<h3 class="edit-panel-title">' + t('Contents PageMarker') + '</h3>',
        '<form id="editform" class="contents-page-marker form-group content" onsubmit="return false;">',
          '<input type="hidden" id="editContentsPageMarkerId">',
          wuwei.edit.style.markup.labelRows({
            label: '',
            align: 'center',
            labelSize: 's4',
            alignLabel: 'Label align',
            alignSize: 's8'
          }),
          wuwei.edit.style.markup.labelLayoutRows({ width: 120, lines: 1, offsetX: 0, offsetY: 0 }),
          wuwei.edit.style.markup.descriptionRows({
            format: 'plain/text',
            body: ''
          }),
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
          wuwei.edit.style.markup.shapeSizeRows({
            prefix: 'editContentsPageMarker',
            name: 'editContentsPageMarkerShape',
            shape: 'CIRCLE',
            size: { radius: 18 },
            options: nodeShapeOptions()
          }),
          '<hr>',
          wuwei.edit.style.markup.paintRows({
            includeLine: true,
            fillPaletteId: 'editContentsPageFillPalette',
            linePaletteId: 'editContentsPageOutlinePalette',
            fontPaletteId: 'editContentsPageFontPalette',
            fontSize: '12pt'
          }),
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
