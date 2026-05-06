/**
 * info.group.markup.js
 * group information template
 */
wuwei.info = wuwei.info || {};
wuwei.info.group = wuwei.info.group || {};
wuwei.info.group.markup = (function () {
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

  function descriptionText(group) {
    if (!group || !group.description) {
      return '';
    }
    if ('string' === typeof group.description) {
      return group.description;
    }
    return group.description.body || '';
  }

  function template(param) {
    var group = param && param.group ? param.group : {};
    var memberCount = Array.isArray(group.members) ? group.members.length : 0;

    return `
<div class="info info-group">
  <div class="w3-row info-title-wrap">
    <h5 class="w3-col s12 info-title">${esc(group.name || t('Group'))}</h5>
  </div>
  <div class="w3-container">
    <p><strong>${t('Shape')}:</strong> ${esc(group.type || 'simple')}</p>
    <p><strong>${t('Members')}:</strong> ${memberCount}</p>
    ${descriptionText(group)
      ? `<p class="value">${esc(descriptionText(group))}</p>`
      : ''
    }
  </div>
</div>`;
  }

  return {
    template: template
  };
})();
