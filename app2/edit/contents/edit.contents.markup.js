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
        '<h3 class="edit-panel-title">' + translate('Contents axis appearance') + '</h3>',
        '<input type="hidden" id="editContentsAxisId">',
        '<div class="edit-field">',
          '<label for="editContentsAxisDirection" class="w3-col s4">' + translate('Direction') + '</label>',
          '<select id="editContentsAxisDirection" class="w3-col s8">',
            '<option value="horizontal">' + translate('horizontal') + '</option>',
            '<option value="vertical">' + translate('vertical') + '</option>',
          '</select>',
        '</div>',
        '<div class="edit-field">',
          '<label for="editContentsAxisLength" class="w3-col s3">' + translate('Axis length') + ' (px)</label>',
          '<input id="editContentsAxisLength" class="w3-col s3" type="number" step="1" min="60">',
        '</div>',
        '<div class="edit-fiel">',
          '<label for="editContentsAxisStrokeWidth" class="w3-col s3">' + translate('Axis width') + ' (px)</label>',
          '<input id="editContentsAxisStrokeWidth" class="w3-col s3" type="number" step="1" min="1">',
        '</div>',
        '<div class="edit-field">',
          '<label for="editContentsAxisStrokeColor" class="w3-col s4">' + translate('Axis color') + '</label>',
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
        '<h3 class="edit-panel-title">' + translate('Contents PageMarker') + '</h3>',
        '<form id="editform" class="contents-page-marker form-group content" onsubmit="return false;">',
          '<input type="hidden" id="editContentsPageMarkerId">',
          '<div class="w3-row">',
            '<textarea id="rName" name="label" data-path="label" class="w3-col s12" rows="1" placeholder="' + translate('Label') + '"></textarea>',
          '</div>',
          '<div class="w3-row">',
            '<textarea id="rValue" name="description.body" data-path="description.body" class="w3-col s12" rows="3"></textarea>',
          '</div>',
          '<div class="w3-row">',
            '<label for="contentsPageNumber" class="w3-col s4">ページ番号:</label>',
            '<input type="number" id="contentsPageNumber" name="pageNumber" data-path="pageNumber" class="w3-col s8" min="1" step="1">',
          '</div>',
          '<hr>',
          '<div class="w3-row">',
            '<label for="style_fill" class="w3-col s4">' + translate('Background') + '</label>',
            '<input type="color" id="style_fill" name="style.fill" data-path="style.fill" class="w3-col s4 pointer">',
            '<div id="editContentsPageFillPalette" class="edit-color-palette w3-col s4 pointer"></div>',
          '</div>',
          '<div class="w3-row">',
            '<label for="style_line_width" class="w3-col s3">' + translate('Outline') + '</label>',
            '<input type="number" id="style_line_width" name="style.line.width" data-path="style.line.width" class="w3-col s3" step="1" min="0">',
            '<input type="color" id="style_line_color" name="style.line.color" data-path="style.line.color" class="w3-col s3 pointer">',
            '<div id="editContentsPageOutlinePalette" class="edit-color-palette w3-col s3 pointer"></div>',
          '</div>',
          '<div class="w3-row">',
            '<label for="nFont_color" class="w3-col s3">' + translate('Text') + '</label>',
            '<input type="color" id="nFont_color" name="style.font.color" data-path="style.font.color" class="w3-col s3 pointer">',
            '<div id="editContentsPageFontPalette" class="edit-color-palette w3-col s3 pointer"></div>',
            '<input type="text" id="nFont_size" name="style.font.size" data-path="style.font.size" class="w3-col s3">',
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

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    axisPanelHtml: axisPanelHtml,
    pageMarkerPanelHtml: pageMarkerPanelHtml,
    panelsHtml: panelsHtml
  };
})();
