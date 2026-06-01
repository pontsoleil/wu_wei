/**
 * edit.link.markup.js
 * wuwei edit.link template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.link = wuwei.edit.link || {};

wuwei.edit.link.markup = ( function () {
  function normalizeFontSizeValue(value) {
    if (value == null || value === '' || Number(value) === 14) { return '12pt'; }
    if ('number' === typeof value || /^\d+(\.\d+)?$/.test(String(value))) { return String(value) + 'pt'; }
    return String(value);
  }

  function finiteOr(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeLineKind(value) {
    if (!value) { return 'SOLID'; }
    if ('1.5 1.5' === value) { return 'DOTTED'; }
    if ('4 2' === value) { return 'DASHED'; }
    if ('6 3' === value) { return 'LONG_DASHED'; }
    if ('LONG-DASHED' === value) { return 'LONG_DASHED'; }
    return String(value);
  }

  function controlPointRows(link) {
    var shape = String(link && link.shape || 'NORMAL').toUpperCase();
    var x = Number.isFinite(Number(link && link.x)) ? Number(link.x) : '';
    var y = Number.isFinite(Number(link && link.y)) ? Number(link.y) : '';
    var x2 = Number.isFinite(Number(link && link.x2)) ? Number(link.x2) : '';
    var y2 = Number.isFinite(Number(link && link.y2)) ? Number(link.y2) : '';

    if (shape === 'NORMAL') {
      return '';
    }
    if (shape === 'HORIZONTAL2' || shape === 'VERTICAL2') {
      return `
  <div class="w3-row">
    <label for="link_control_x" class="w3-col s2">${t('Control')}</label>
    <input type="number" id="link_control_x" name="x" value="${x}" class="w3-col s2 edit-value" step="1">
    <input type="number" id="link_control_y" name="y" value="${y}" class="w3-col s2 edit-value" step="1">
    <input type="number" id="link_control_x2" name="x2" value="${x2}" class="w3-col s3 edit-value" step="1">
    <input type="number" id="link_control_y2" name="y2" value="${y2}" class="w3-col s3 edit-value" step="1">
  </div>`;
    }
    return `
  <div class="w3-row">
    <label for="link_control_x" class="w3-col s3">${t('Control')}</label>
    <input type="number" id="link_control_x" name="x" value="${x}" class="w3-col s4 edit-value" step="1">
    <input type="number" id="link_control_y" name="y" value="${y}" class="w3-col s5 edit-value" step="1">
  </div>`;
  }

  const template = function( param ) {
    let
      link = param.link || {},
      option = param.option;
    const style = link.style || {};
    const line = style.line || {};
    const font = style.font || {};
    const labelStyle = style.label || {};
    const labelOffset = labelStyle.offset || {};
    const routing = (link.routing && 'object' === typeof link.routing) ? link.routing : {};
    const fontSizeValue = normalizeFontSizeValue(font && font.size);
    const label = link.label || '';
    const relation = link.relation || '';
    const shapeValue = link.shape || 'NORMAL';
    const lineKindValue = normalizeLineKind(line.kind);
    const lineWidthValue = finiteOr(line.width, 2);
    const lineColorValue = line.color || '#888888';
    const fontColorValue = font.color || '#000000';
    const labelOffsetXValue = Number.isFinite(Number(labelOffset.x)) ? Number(labelOffset.x) : 0;
    const labelOffsetYValue = Number.isFinite(Number(labelOffset.y)) ? Number(labelOffset.y) : 0;
    const startArrow = routing.startArrow || {};
    const endArrow = routing.endArrow || {};
    const
      common = wuwei.common,
      lang = common.nls.LANG,
      motivations = common.motivations,
      shapes = common.linkShapes,
      markerShapes = common.markerShapes,
      strokeDasharray = common.strokeDasharray,
      fontSizes = common.fontSizes;
    const arrowShapes = [{ value: '', label: 'NONE' }].concat(markerShapes || []);
    var html = `
<form id="editform" class="link form-group content">
  <div class="w3-row">
    <textarea id="label" name="label" class="w3-col s12 edit-value" rows="${rowcount(label)}" 
        placeholder="${t('Label')}">${escapeHtml(label)}</textarea>
  </div>
  <div class="w3-row">
    <label for="shape" class="w3-col s4">${t('Shape')}</label>`;  
html += `    ${selectOptions('shape', shapeValue, shapes, t('Shape'), 's4')}`;
html += `    ${selectOptions('style.line.kind', lineKindValue, strokeDasharray, t('Stroke'), 's4')}
  </div>
  ${controlPointRows(link)}
  <div class="w3-row">
    <label for="routing_startArrow_kind" class="w3-col s3">${t('Start arrow')}</label>
    ${selectOptions('routing.startArrow.kind', startArrow.kind || '', arrowShapes, '', 's3')}
    <label for="routing_startArrow_size" class="w3-col s3">${t('Size')}</label>
    <input type="number" id="routing_startArrow_size" name="routing.startArrow.size" value="${finiteOr(startArrow.size, 12)}" class="w3-col s3 edit-value">
  </div>
  <div class="w3-row">
    <label for="routing_endArrow_kind" class="w3-col s3">${t('End arrow')}</label>
    ${selectOptions('routing.endArrow.kind', endArrow.kind || '', arrowShapes, '', 's3')}
    <label for="routing_endArrow_size" class="w3-col s3">${t('Size')}</label>
    <input type="number" id="routing_endArrow_size" name="routing.endArrow.size" value="${finiteOr(endArrow.size, 12)}" class="w3-col s3 edit-value">
  </div>
  <div class="w3-row">
    <label for="style_line_width" class="w3-col s3">${t('Size')}</label>  
    <input type="number" id="style_line_width" name="style.line.width" value="${lineWidthValue}" class="w3-col s3 edit-value">
    <input type="color" id="style_line_color" name="style.line.color" value="${escapeHtml(lineColorValue)}" class="w3-col s3 pointer edit-value">
    <div id="style_line_color_palette" name="style_line_color_palette" class="w3-col s3 pointer"></div>
  </div>
  <div class="w3-row">
    <label for="style_font_size" class="w3-col s3">${t('Text')}</label>  
    ${selectOptions('style.font.size', fontSizeValue, fontSizes, 'Select font size', 's3')}
    <input type="color" id="style_font_color" name="style.font.color" value="${escapeHtml(fontColorValue)}" class="w3-col s3 pointer edit-value">
    <div id="style_font_color_palette" name="style_font_color_palette" class="w3-col s3 pointer"></div>
  </div>
  <div class="w3-row">
    <label for="style_label_offset_x" class="w3-col s3">${t('offset X')}</label>
    <input type="number" id="style_label_offset_x" name="style.label.offset.x" value="${labelOffsetXValue}" class="w3-col s3 edit-value" step="1">
    <label for="style_label_offset_y" class="w3-col s3">${t('offset Y')}</label>
    <input type="number" id="style_label_offset_y" name="style.label.offset.y" value="${labelOffsetYValue}" class="w3-col s3 edit-value" step="1">
  </div>
  <div class="w3-row">
    <label for="relation" class="w3-col s3">${t('Role')}</label>
    <input type="checkbox" id="editRole" class="w3-col s1">
    <input type="text" id="relation" name="relation" value="${escapeHtml(relation)}" class="w3-col s8 edit-value">
  </div>
  <div class="w3-row">
    <button type="button" id="link_reverse" class="w3-button w3-small w3-col s12">
      <i class="fas fa-exchange-alt fa-fw"></i>${t('Reverse')}
    </button>
  </div>
</form>
`;
    return html;
  };

  function selectOptions(name, value, options, placeholder, size) {
    return wuwei.edit.markup.selectOptions(name, value, options, placeholder, size);
  }

  function rowcount(str) {
    return wuwei.edit.markup.rowcount(str);
  }

  function t(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
} ());
// edit.link.markup.js 2023-06-12
