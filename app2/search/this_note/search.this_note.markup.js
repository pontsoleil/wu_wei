/**
 * search.this_note.markup.js
 * Search / display-condition template for the current note page.
 */
wuwei.search.this_note = wuwei.search.this_note || {};
wuwei.search.this_note.markup = (function () {
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function t(str) {
    return wuwei.nls && typeof wuwei.nls.translate === 'function'
      ? wuwei.nls.translate(str)
      : str;
  }

  function conditionPanel(condition) {
    condition = condition || {};
    return [
      '<form id="searchConditionForm" class="form search-condition-form" onsubmit="return false;">',
        '<div class="form-group w3-row">',
          '<label for="search-text" class="w3-col s3">' + t('Keyword') + '</label>',
          '<input type="search" id="search-text" name="q" class="w3-col s9" value="' + esc(condition.keyword || '') + '" aria-label="' + esc(t('Enter search string')) + '">',
        '</div>',
        '<div class="search-actions w3-row">',
          '<button id="search-button" type="button" class="w3-button w3-small w3-blue">' + t('Search') + '</button>',
          '<button id="show-page-all-button" type="button" class="w3-button w3-small w3-green">' + t('Show all page data') + '</button>',
        '</div>',
      '</form>'
    ].join('');
  }

  function resultIcon(result) {
    var type = result && result.type;
    var kind = String(result && result.detail || '').toLowerCase();

    if (type === 'Topic') { return 'fas fa-tag'; }
    if (type === 'Content') {
      if (kind === 'pdf') { return 'far fa-file-pdf'; }
      if (kind === 'web') { return 'fas fa-globe'; }
      if (kind === 'image') { return 'far fa-file-image'; }
      if (kind === 'video') { return 'fas fa-video'; }
      if (kind === 'office') { return 'far fa-file-alt'; }
      return 'far fa-file';
    }
    if (type === 'Memo') { return 'far fa-sticky-note'; }
    if (type === 'Group') { return 'far fa-circle'; }
    if (type === 'Timeline') { return 'fas fa-stream'; }
    if (type === 'Contents') { return 'fas fa-list-ol'; }
    if (type === 'Link') { return 'fas fa-link'; }
    return 'fas fa-circle';
  }

  function resultStatus(result) {
    if (!result) { return ''; }
    if (result.status === 'visible') { return t('Visible'); }
    if (result.status === 'hidden') { return t('Hidden'); }
    return result.status ? t(result.status) : '';
  }

  function resultStatusIcon(result) {
    var status = resultStatus(result);
    var icon = 'far fa-circle';
    if (result && result.status === 'visible') {
      icon = 'fas fa-eye';
    }
    else if (result && result.status === 'hidden') {
      icon = 'fas fa-eye-slash';
    }
    return '<i class="search-result-visibility ' + icon + ' fa-fw" title="' + esc(status) + '" aria-label="' + esc(status) + '"></i>';
  }


  function displayDetail(result) {
    var type = result && result.type;
    if (type === 'Topic' || type === 'Content' || type === 'Group') {
      return '';
    }
    return result && result.detail ? result.detail : '';
  }

  function resultItem(result) {
    var canOpen = result && result.openable;
    var detail = displayDetail(result);
    return [
      '<li class="search-result-item w3-row" data-result-id="' + esc(result.id) + '" data-target-id="' + esc(result.id) + '" data-marker-id="' + esc(result.markerId || result.id) + '">',
        '<div class="search-result-main">',
          resultStatusIcon(result) + ' ',
          '<i class="' + resultIcon(result) + ' fa-fw search-result-type-icon"></i> ',
          '<span class="search-result-title">' + esc(result.label || result.title || '') + '</span>',
          detail ? '<div class="search-result-detail">' + esc(detail) + '</div>' : '',
        '</div>',
        '<div class="search-result-actions">',
          '<button type="button" class="w3-button w3-tiny search-info" data-result-id="' + esc(result.id) + '">' + t('Info') + '</button>',
          canOpen ? '<button type="button" class="w3-button w3-tiny search-open-tab" data-result-id="' + esc(result.id) + '" title="' + esc(t('OpenNewTab')) + '">TAB</button>' : '',
          canOpen ? '<button type="button" class="w3-button w3-tiny search-open-window" data-result-id="' + esc(result.id) + '" title="' + esc(t('OpenWindow')) + '">Win</button>' : '',
        '</div>',
      '</li>'
    ].join('');
  }

  function template(param) {
    param = param || {};
    var results = Array.isArray(param.results) ? param.results : [];
    return [
      conditionPanel(param.condition || {}),
      '<div class="search-result-summary">' + esc(results.length ? (results.length + ' ' + t('matches')) : '') + '</div>',
      '<ul class="list-group search-result-list">',
        results.map(resultItem).join(''),
      '</ul>'
    ].join('');
  }

  return {
    template: template
  };
})();
// search.this_note.markup.js
