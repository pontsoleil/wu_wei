/**
 * edit.content.markup.js
 * Viewpoint axis editor template
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.viewpoint = wuwei.edit.viewpoint || {};

wuwei.edit.viewpoint.markup = (function () {
  'use strict';

  function tabbedPaneHtml(tabs) {
    return [
      '<div class="edit-tabbed-pane edit-viewpoint-tabbed-pane">',
      '<div class="w3-bar w3-light-grey edit-tab-buttons">',
      tabs.map(function (tab, index) {
        return '<button type="button" class="w3-button w3-small edit-tab-button' + (index ? '' : ' active w3-blue') + '" data-edit-tab="' + tab.id + '">' + t(tab.label) + '</button>';
      }).join('\n'),
      '</div>',
      tabs.map(function (tab, index) {
        return '<div class="edit-tab-panel" data-edit-tab-panel="' + tab.id + '" style="display:' + (index ? 'none' : 'block') + ';">' + tab.html + '</div>';
      }).join('\n'),
      '</div>'
    ].join('\n');
  }

  function axisPanelHtml() {
    var contentHtml = [
        '<div class="edit-field">',
          '<label for="editViewpointAxisLabel" class="w3-col s4">' + t('Label') + '</label>',
          '<input id="editViewpointAxisLabel" class="w3-col s8 edit-value" type="text">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editViewpointAxisDirection" class="w3-col s4">' + t('Direction') + '</label>',
          '<select id="editViewpointAxisDirection" class="w3-col s8 edit-value">',
            '<option value="horizontal">' + t('horizontal') + '</option>',
            '<option value="vertical">' + t('vertical') + '</option>',
          '</select>',
        '</div>',
        '<div class="edit-field">',
          '<label for="editViewpointFirstPageNumber" class="w3-col s6">' + t('First page number') + '</label>',
          '<input id="editViewpointFirstPageNumber" class="w3-col s6 edit-value" type="number" step="1" min="1" value="1">',
        '</div>'
    ].join('\n');

    var shapeHtml = [
        '<div class="edit-field">',
          '<label for="editViewpointRepShape" class="w3-col s4">' + t('Shape') + '</label>',
          selectOptions('editViewpointRepShape', 'RECTANGLE', nodeShapeOptions(), 'Shape', 's8'),
        '</div>',
        '<div id="editViewpointRepSizeRadiusRow" class="edit-field" style="display:none;">',
          '<label for="editViewpointRepSizeRadius" class="w3-col s4">' + t('Radius') + '</label>',
          '<input id="editViewpointRepSizeRadius" class="w3-col s8 edit-value" type="number" step="1" min="1">',
        '</div>',
        '<div id="editViewpointRepSizeWidthHeightRow" class="edit-field">',
          '<label for="editViewpointRepSizeWidth" class="w3-col s2">' + t('Width') + '</label>',
          '<input id="editViewpointRepSizeWidth" class="w3-col s4 edit-value" type="number" step="1" min="1">',
          '<label for="editViewpointRepSizeHeight" class="w3-col s2">' + t('Height') + '</label>',
          '<input id="editViewpointRepSizeHeight" class="w3-col s4 edit-value" type="number" step="1" min="1">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editViewpointAxisLength" class="w3-col s6">' + t('Axis length') + ' (px)</label>',
          '<input id="editViewpointAxisLength" class="w3-col s6 edit-value" type="number" step="1" min="60">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editViewpointAxisStrokeWidth" class="w3-col s6">' + t('Axis width') + ' (px)</label>',
          '<input id="editViewpointAxisStrokeWidth" class="w3-col s6 edit-value" type="number" step="1" min="1">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editViewpointAxisStrokeColor" class="w3-col s4">' + t('Axis color') + '</label>',
          '<div class="edit-color-inline w3-col s8">',
            '<input id="editViewpointAxisStrokeColor" class="w3-col s4" type="color">',
            '<div id="editViewpointAxisStrokeColorPalette" class="edit-color-palette w3-col s4"></div>',
          '</div>',
        '</div>'
    ].join('\n');

    return [
      '<section id="edit-viewpoint-axis" class="edit-panel edit-viewpoint-panel content" style="display:none;">',
        '<input type="hidden" id="editViewpointAxisId">',
        tabbedPaneHtml([
          { id: 'shape', label: 'Shape', html: shapeHtml },
          { id: 'content', label: '_Content', html: contentHtml }
        ]),
      '</section>'
    ].join('\n');
  }

  function pageMarkerPanelHtml() {
    function t(str) {
      return wuwei.nls.translate(str);
    }

    var contentHtml = [
          '<input type="hidden" id="editViewpointPageMarkerId">',
          wuwei.edit.style.markup.labelRows({
            label: '',
            align: 'center',
            labelSize: 's4',
            alignLabel: 'Label align',
            alignSize: 's8'
          }),
          wuwei.edit.style.markup.descriptionRows({
            format: 'plain/text',
            body: ''
          }),
          '<div id="documentPageMarkerFields" class="viewpoint-document-marker-fields">',
            '<div id="pageNumberRow" class="w3-row">',
              '<label for="pageNumber" class="w3-col s4">' + t('Page number') + ':</label>',
              '<input type="number" id="pageNumber" name="pageNumber" class="w3-col s8 edit-value" min="1" step="1">',
            '</div>',
          '</div>',
          '<div id="htmlPageMarkerFields" class="viewpoint-html-marker-fields" style="display:none;">',
            '<div id="anchorHrefRow" class="w3-row">',
              '<label for="htmlAnchorHref" class="w3-col s4">Anchor href:</label>',
              '<input type="text" id="htmlAnchorHref" name="anchorHref" class="w3-col s8 edit-value" placeholder="#3-xbrl-csv-report-structure">',
            '</div>',
          '</div>'
    ].join('\n');

    var shapeHtml = [
          wuwei.edit.style.markup.labelLayoutRows({ width: 120, lines: 1, offsetX: 0, offsetY: 0 }),
          wuwei.edit.style.markup.shapeSizeRows({
            prefix: 'editViewpointPageMarker',
            name: 'editViewpointPageMarkerShape',
            shape: 'CIRCLE',
            size: { radius: 18 },
            options: nodeShapeOptions()
          }),
          '<hr>',
          wuwei.edit.style.markup.paintRows({
            includeLine: true,
            fillPaletteId: 'editViewpointPageFillPalette',
            linePaletteId: 'editViewpointPageOutlinePalette',
            fontPaletteId: 'editViewpointPageFontPalette',
            fontSize: '12pt'
          }),
          '<div class="w3-row">',
            '<label for="applyToViewpointGroup" class="w3-col s10">' + t('Apply to group members') + '</label>',
            '<input type="checkbox" id="applyToViewpointGroup" class="w3-col s2">',
          '</div>'
    ].join('\n');

    return [
      '<section id="edit-viewpoint-page-marker" class="edit-panel edit-viewpoint-panel" style="display:none;">',
        '<form id="editform" class="viewpoint-page-marker form-group content" onsubmit="return false;">',
          tabbedPaneHtml([
            { id: 'shape', label: 'Shape', html: shapeHtml },
            { id: 'content', label: '_Content', html: contentHtml }
          ]),
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
