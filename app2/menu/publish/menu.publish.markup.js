/**
 * menu.publish.markup.js
 * Publish result modal template.
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.publish = wuwei.menu.publish || {};
wuwei.menu.publish.markup = (function () {
  function result_template(publicUrl) {
    const safeUrl = escapeHtml(publicUrl || '');
    return `
      <div class="publish-window w3-card-4">
        <header class="publish-window-header">
          <h3>${translate('Published')}</h3>
          <button type="button"
              class="publish-window-close"
              onclick="wuwei.menu.publish.close(); return false;"
              aria-label="${translate('Close')}">
            <i class="fas fa-times"></i>
          </button>
        </header>
        <div class="publish-result">
        <p class="publish-result-note">${translate('Published note is view-only. Editing, saving, and downloading are disabled.')}</p>
        <label for="publishUrl">${translate('Public URL')}</label>
        <p>
          <input id="publishUrl" class="w3-input w3-border" type="text" readonly value="${safeUrl}">
        </p>
        <div class="publish-result-permissions">
          <div><span>${translate('Edit')}</span><strong>${translate('Disabled')}</strong></div>
          <div><span>${translate('Save')}</span><strong>${translate('Disabled')}</strong></div>
          <div><span>${translate('Download')}</span><strong>${translate('Disabled')}</strong></div>
        </div>
        <p class="publish-result-actions">
          <button type="button"
              onclick="wuwei.menu.publish.openPublishedUrl(); return false;"
              class="w3-button w3-indigo w3-margin-right">
            ${translate('Open in new tab')}
          </button>
          <button type="button"
              onclick="wuwei.menu.publish.copyPublishedUrl(); return false;"
              class="w3-button w3-teal">
            ${translate('Copy URL')}
          </button>
        </p>
        </div>
      </div>`;
  }

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    result_template: result_template
  };
})();
