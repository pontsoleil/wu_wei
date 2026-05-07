/**
 * edit.group.markup.js
 * group editor template
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.group = wuwei.edit.group || {};

wuwei.edit.group.markup = (function () {
  'use strict';

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function t(text) {
    return (wuwei.nls && typeof wuwei.nls.translate === 'function')
      ? wuwei.nls.translate(text)
      : text;
  }

  function selected(value, expected) {
    return String(value || '') === expected ? ' selected' : '';
  }

  function checked(value) {
    return false === value ? '' : ' checked';
  }

  function num(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function paddingSide(spine, key, fallback) {
    return num(spine && spine[key], num(spine && spine.padding, fallback));
  }

  function lineKindOptions(value) {
    var kind = value || 'SOLID';
    return [
      ['SOLID', 'Solid'],
      ['DASHED', 'Dashed'],
      ['DOTTED', 'Dotted'],
      ['LONG_DASHED', 'Long dashed']
    ].map(function (option) {
      return '<option value="' + option[0] + '"' + selected(kind, option[0]) + '>' +
        t(option[1]) +
        '</option>';
    }).join('');
  }

  function template(group) {
    var spine = (group && group.spine && 'object' === typeof group.spine) ? group.spine : {};
    var isSimple = group && group.type === 'simple';
    var description = (group && group.description && 'object' === typeof group.description)
      ? group.description
      : { body: '' };

    return `
<form id="editform" class="group form-group content">
  <div class="w3-row">
    <textarea id="name" name="name" class="w3-col s12 edit-value" rows="2" placeholder="${t('Label')}">${esc(group && group.name)}</textarea>
  </div>
  <div class="w3-row">
    <textarea id="description_body" name="description.body" class="w3-col s12 edit-value" rows="4" placeholder="${t('Description')}">${esc(description.body)}</textarea>
  </div>
  <div class="w3-row">
    <label class="w3-col s6"><input type="checkbox" id="visible" name="visible" class="edit-value"${checked(group && group.visible)}> ${t('Visible')}</label>
    <label class="w3-col s6"><input type="checkbox" id="moveTogether" name="moveTogether" class="edit-value"${checked(group && group.moveTogether)}> ${t('Move together')}</label>
  </div>
  <div class="w3-row">
    <label for="type" class="w3-col s4">${t('Shape')}</label>
    <select id="type" name="type" class="w3-col s8 edit-value">
      <option value="simple"${selected(group && group.type, 'simple')}>${t('Simple group')}</option>
      <option value="horizontal"${selected(group && group.type, 'horizontal')}>${t('Horizontal group')}</option>
      <option value="vertical"${selected(group && group.type, 'vertical')}>${t('Vertical group')}</option>
    </select>
  </div>
  <div class="w3-row">
    <label for="spine_kind" class="w3-col s4">${t('Line')}</label>
    <select id="spine_kind" name="spine.kind" class="w3-col s8 edit-value">${lineKindOptions(spine.kind)}</select>
  </div>
  <div class="w3-row">
    <label for="spine_width" class="w3-col s4">${t('Size')}</label>
    <input type="number" id="spine_width" name="spine.width" class="w3-col s4 edit-value" value="${num(spine.width, isSimple ? 2 : 6)}">
    <input type="color" id="spine_color" name="spine.color" class="w3-col s4 pointer edit-value" value="${esc(spine.color || '#888888')}">
  </div>
  <div class="w3-row">
    <label for="spine_padding" class="w3-col s4">Padding</label>
    <input type="number" id="spine_padding" name="spine.padding" class="w3-col s4 edit-value" value="${num(spine.padding, isSimple ? 16 : 12)}">
    <label class="w3-col s4"><input type="checkbox" id="spine_visible" name="spine.visible" class="edit-value"${checked(spine.visible)}> ${t('Visible')}</label>
  </div>
  <div class="w3-row">
    <label for="spine_padding_top" class="w3-col s4">${t('Padding top')}</label>
    <input type="number" id="spine_padding_top" name="spine.paddingTop" class="w3-col s2 edit-value" value="${paddingSide(spine, 'paddingTop', 16)}">
    <label for="spine_padding_right" class="w3-col s4">${t('Right')}</label>
    <input type="number" id="spine_padding_right" name="spine.paddingRight" class="w3-col s2 edit-value" value="${paddingSide(spine, 'paddingRight', 16)}">
  </div>
  <div class="w3-row">
    <label for="spine_padding_bottom" class="w3-col s4">${t('Padding bottom')}</label>
    <input type="number" id="spine_padding_bottom" name="spine.paddingBottom" class="w3-col s2 edit-value" value="${paddingSide(spine, 'paddingBottom', 16)}">
    <label for="spine_padding_left" class="w3-col s4">${t('Left')}</label>
    <input type="number" id="spine_padding_left" name="spine.paddingLeft" class="w3-col s2 edit-value" value="${paddingSide(spine, 'paddingLeft', 16)}">
  </div>
</form>`;
  }

  return {
    template: template
  };
})();
