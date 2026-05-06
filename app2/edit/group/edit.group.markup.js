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
    <textarea id="editGroupName" class="w3-col s12" rows="2" placeholder="${t('Label')}">${esc(group && group.name)}</textarea>
  </div>
  <div class="w3-row">
    <textarea id="editGroupDescription" class="w3-col s12" rows="4" placeholder="${t('Description')}">${esc(description.body)}</textarea>
  </div>
<!--  <div class="w3-row">
    <label class="w3-col s6"><input type="checkbox" id="editGroupVisible"${checked(group && group.visible)}> ${t('Visible')}</label>
    <label class="w3-col s6"><input type="checkbox" id="editGroupMoveTogether"${checked(group && group.moveTogether)}> ${t('Move together')}</label>
  </div> -->
  <div class="w3-row">
    <label for="editGroupType" class="w3-col s4">${t('Shape')}</label>
    <select id="editGroupType" class="w3-col s8">
      <option value="simple"${selected(group && group.type, 'simple')}>${t('Simple group')}</option>
      <option value="horizontal"${selected(group && group.type, 'horizontal')}>${t('Horizontal group')}</option>
      <option value="vertical"${selected(group && group.type, 'vertical')}>${t('Vertical group')}</option>
    </select>
  </div>
  <div class="w3-row">
    <label for="editGroupSpineKind" class="w3-col s4">${t('Line')}</label>
    <select id="editGroupSpineKind" class="w3-col s8">${lineKindOptions(spine.kind)}</select>
  </div>
  <div class="w3-row">
    <label for="editGroupSpineWidth" class="w3-col s4">${t('Size')}</label>
    <input type="number" id="editGroupSpineWidth" class="w3-col s4" value="${num(spine.width, isSimple ? 2 : 6)}">
    <input type="color" id="editGroupSpineColor" class="w3-col s4 pointer" value="${esc(spine.color || '#888888')}">
  </div>
  <div class="w3-row">
    <label for="editGroupSpinePadding" class="w3-col s6">Padding</label>
    <input type="number" id="editGroupSpinePadding" class="w3-col s6" value="${num(spine.padding, isSimple ? 16 : 12)}">
    <!-- <label class="w3-col s4"><input type="checkbox" id="editGroupSpineVisible"${checked(spine.visible)}> ${t('Visible')}</label>-->
  </div>
</form>`;
  }

  return {
    template: template
  };
})();
