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
      '<section id="edit-contents-axis" class="edit-panel edit-contents-panel" style="display:none;">',
        '<h3 class="edit-panel-title">' + t('Contents axis appearance') + '</h3>',
        '<input type="hidden" id="editContentsAxisId">',
        '<div class="edit-field">',
          '<label for="editContentsAxisDirection" class="w3-col s4">' + t('Direction') + '</label>',
          '<select id="editContentsAxisDirection" class="w3-col s8 edit-value">',
            '<option value="horizontal">' + t('horizontal') + '</option>',
            '<option value="vertical">' + t('vertical') + '</option>',
          '</select>',
        '</div>',
        '<div class="edit-field">',
          '<label for="editContentsAxisLength" class="w3-col s3">' + t('Axis length') + ' (px)</label>',
          '<input id="editContentsAxisLength" class="w3-col s3 edit-value" type="number" step="1" min="60">',
        '</div>',
        '<div class="edit-fiel">',
          '<label for="editContentsAxisStrokeWidth" class="w3-col s3">' + t('Axis width') + ' (px)</label>',
          '<input id="editContentsAxisStrokeWidth" class="w3-col s3 edit-value" type="number" step="1" min="1">',
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
          '<div id="pageNumberRow" class="w3-row">',
            '<label for="pageNumber" class="w3-col s4">ページ番号:</label>',
            '<input type="number" id="pageNumber" name="pageNumber" class="w3-col s8 edit-value" min="1" step="1">',
          '</div>',
          '<div id="anchorHrefRow" class="w3-row" style="display:none;">',
            '<label for="anchorHref" class="w3-col s4">Anchor href:</label>',
            '<input type="text" id="anchorHref" name="anchorHref" class="w3-col s8 edit-value" placeholder="#3-xbrl-csv-report-structure">',
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
            '<input type="text" id="style_font_size" name="style.font.size" class="w3-col s3 edit-value">',
          '</div>',
          '<div class="w3-row">',
            '<label for="style_font_align" class="w3-col s3">Align</label>',
            '<select id="style_font_align" name="style.font.align" class="w3-col s4 edit-value">',
              '<option value="left">left</option>',
              '<option value="center">center</option>',
              '<option value="right">right</option>',
            '</select>',
            '<label for="labelOffset" class="w3-col s2">Gap</label>',
            '<input type="number" id="labelOffset" name="labelOffset" class="w3-col s3 edit-value" step="1" min="0">',
          '</div>',
          '<div class="w3-row">',
            '<label for="applyToContentsGroup" class="w3-col s10">グループメンバーへ一括適用</label>',
            '<input type="checkbox" id="applyToContentsGroup" class="w3-col s2">',
          '</div>',
        '</form>',
      '</section>'
    ].join('\n');
  }

  function panelsHtml() {
    return [axisPanelHtml(), pageMarkerPanelHtml()].join('\n');
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
