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

  const template = function( param ) {
    let
      link = param.link || {},
      option = param.option;
    const style = link.style || {};
    const line = style.line || {};
    const font = style.font || link.font || {};
    const routing = (link.routing && 'object' === typeof link.routing) ? link.routing : {};
    const fontSizeValue = normalizeFontSizeValue(font && font.size);
    const label = link.label || '';
    const relation = link.relation || '';
    const shapeValue = link.shape || 'NORMAL';
    const lineKindValue = normalizeLineKind(line.kind);
    const lineWidthValue = finiteOr(line.width, finiteOr(link.size, 2));
    const lineColorValue = line.color || '#888888';
    const fontColorValue = font.color || '#000000';
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
    <textarea id="lLabel" name="label" data-path="label" class="w3-col s12" rows="${rowcount(label)}" 
        placeholder="${translate('Label')}">${escapeHtml(label)}</textarea>
  </div>
  <div class="w3-row">
    <label for="lShape" class="w3-col s4">${translate('Shape')}</label>`;  
html += 'draw'==wuwei.common.graph.mode
  ? `    ${selectOptions('lShape', shapeValue, shapes, translate('Shape'), 's4').replace('name="lShape"', 'name="shape" data-path="shape"')}`
  : '';
html += `    ${selectOptions('lStrokedash', lineKindValue, strokeDasharray, translate('Stroke'), 's4').replace('name="lStrokedash"', 'name="style.line.kind" data-path="style.line.kind"')}
  </div>
  <div class="w3-row">
    <label for="lStartArrow_kind" class="w3-col s3">${translate('Start arrow')}</label>
    ${selectOptions('lStartArrow_kind', startArrow.kind || '', arrowShapes, '', 's3').replace('name="lStartArrow_kind"', 'name="routing.startArrow.kind" data-path="routing.startArrow.kind"')}
    <label for="lStartArrow_size" class="w3-col s3">${translate('Size')}</label>
    <input type="number" id="lStartArrow_size" name="routing.startArrow.size" data-path="routing.startArrow.size" value="${finiteOr(startArrow.size, 12)}" class="w3-col s3">
  </div>
  <div class="w3-row">
    <label for="lEndArrow_kind" class="w3-col s3">${translate('End arrow')}</label>
    ${selectOptions('lEndArrow_kind', endArrow.kind || '', arrowShapes, '', 's3').replace('name="lEndArrow_kind"', 'name="routing.endArrow.kind" data-path="routing.endArrow.kind"')}
    <label for="lEndArrow_size" class="w3-col s3">${translate('Size')}</label>
    <input type="number" id="lEndArrow_size" name="routing.endArrow.size" data-path="routing.endArrow.size" value="${finiteOr(endArrow.size, 12)}" class="w3-col s3">
  </div>
  <div class="w3-row">
    <label for="lSize" class="w3-col s3">${translate('Size')}</label>  
    <input type="number" id="lSize" name="style.line.width" data-path="style.line.width" value="${lineWidthValue}" class="w3-col s3">
    <input type="color" id="lColor" name="style.line.color" data-path="style.line.color" value="${escapeHtml(lineColorValue)}" class="w3-col s3 pointer">
    <div id="linkColor" name="linkColor" class="w3-col s3 pointer"></div>
  </div>
  <div class="w3-row">
    <label for="lFont_size" class="w3-col s3">${translate('Text')}</label>  
    ${selectOptions('lFont_size', fontSizeValue, fontSizes, 'Select font size', 's3').replace('name="lFont_size"', 'name="style.font.size" data-path="style.font.size"')}
    <input type="color" id="lFont_color" name="style.font.color" data-path="style.font.color" value="${escapeHtml(fontColorValue)}" class="w3-col s3 pointer">
    <div id="linkFont_color" name="linkFont_color" class="w3-col s3 pointer"></div>
  </div>
  <div class="w3-row">
    <label for="lRelation" class="w3-col s3">${translate('Role')}</label>
    <input type="checkbox" id="editRole" class="w3-col s1">
    <input type="text" id="lRelation" name="relation" data-path="relation" value="${escapeHtml(relation)}" class="w3-col s8">
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

  function translate(str) {
    return wuwei.edit.markup.translate(str);
  }

  return {
    template: template
  };
} ());
// edit.link.markup.js 2023-06-12
