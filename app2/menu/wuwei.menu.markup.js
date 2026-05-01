/**
 * wuwei.menu.markup.js
 * wuwei menu template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.markup = (function () {

  function template(lang) {
    var common = wuwei.common,
      state = common.state,
      current = common.current;
    var nls = common.nls;
    var Selecting = common.state.Selecting;
    var html = [];

    // top controls
    html.push(`
  <a id="open_controls">
    <span>&#9650</span>
  </a>

  <a id="open_miniature">
    <span>▼</span>
  </a>

  <a href="#" id="filterIcon" class="command">
    <i class="fas fa-filter fa-lg fa-fw"></i>
    <span class="tooltiptext">${translate('Filter')}</span>
  </a>
  <a href="#" id="searchIcon" class="command">
    <i class="fas fa-search fa-lg fa-fw"></i>
    <span class="tooltiptext">${translate('Search')}</span>
  </a>
<!--  <a id="share_mode" class="command">
    <i class="fab fa-slideshare"></i>
  </a>
-->
  <a id="setting" class="simulation command">
    <i class="fas fa-cog"></i>
  </a>

  <a id="draw_mode" class="command">
    <i></i>
  </a>

  <a id="user_status" ${state.loggedIn ? `class="loggedIn"` : ''}>
    <i class="fas fa-user"></i>
  </a>

  <div id="note_name">
    <span class="name"></span>
    <span class="description"></span>
  </div>

  <div id="page_name">
    <span class="pp"></span>
    <span class="name"></span>
    <span class="description"></span>
  </div>

  <select id="language">
`);
    html.push(
      nls.label.map(function (option) {
        var language = localStorage.getItem('language');
        if (language) {
          nls.LANG = language;
        }
        if (nls.LANG === option.value) {
          return `<option value="${option.value}" selected>${option.label}</option>`;
        }
        return `<option value="${option.value}">${option.label}</option>`;
      }).join('')
    );
    html.push(`
  </select>

  <div class="wifi isOnline" id="state">
    <span class="bar1"></span>
    <span class="bar2"></span>
    <span class="bar3"></span>
  </div>

  <div id="controls" class="hidden">
    <div id="zoom" class="active" placement="top">
      <i id="zoomin" class="zoom-in fa fa-plus fa-lg fa-fw"></i>
      <i class="resetview icon fas fa-equals fa-lg fa-fw"></i>
      <span class="resetview scale"></span>
      <i id="zoomout" class="zoom-out fa fa-minus fa-lg fa-fw"></i>
    </div>
    <div id="undo" onclick="wuwei.menu.undoClicked(); return false;">
      <i class="icon fa fa-reply fa-2x"></i>
      <p id="p_undo">${translate('Undo')}</p>
    </div>
    <div id="redo" onclick="wuwei.menu.redoClicked(); return false;">
      <i class="icon fa fa-share fa-2x"></i>
      <p id="p_redo">${translate('Redo')}</p>
    </div>
  </div>

  <div id="Pagination"></div>
  <div id="pageThumbnail"></div>
`);

    // heading menu
    html.push([`
  <div class="heading-menu">
    <a href="#" id="mainIcon" class="main">
      <div class="menu-icon">
        <span class="bar1"></span>
        <span class="bar2"></span>
        <span class="bar3"></span>
      </div>
    </a>
    <a href="#" id="noteIcon" class="command">
      <i class="fas fa-book fa-lg fa-fw"></i>
      <span class="tooltiptext">${translate('Notebook')}</span>
    </a>
    <a href="#" id="pageIcon" class="command">
      <i class="far fa-file fa-lg fa-fw"></i>
      <span class="tooltiptext">${translate('Pages')}</span>
    </a>
    <a href="#" id="newIcon" class="command">
      <i class="fas fa-plus fa-lg fa-fw"></i>
      <span class="tooltiptext">${translate('New')}</span>
    </a>
    <a href="#" id="flockIcon" class="command">
      <i class="far fa-object-group fa-lg fa-fw"></i>
      <span class="tooltiptext">${translate('Flock')}</span>
    </a>`,
  `</div>`
    ]);

    // note menu
    html.push(`
  <div id="noteMenu" class="pulldown note" style="display: none;">
    <span class="header">
      <i class="fa fa-book fa-fw">&nbsp;${translate('Notebook')}</i>
      <i class="fas fa-times fa-fw">&nbsp;${translate('Notebook')}</i>
    </span>
    <hr>
    <div class="operators">
      <div class="operator Login notlogin">
        <i class="fas fa-sign-in-alt fa-fw"></i>
        <span>${translate('Please log in.')}</span>
      </div>
      <div class="operator New loggedin">
        <i class="fa fa-plus fa-fw"></i>
        <span>${translate('New')}</span>
      </div>
      <div class="operator Discard loggedin" ${state.viewOnly ? 'style="display:none"' : ''}>
        <i class="fas fa-ban fa-fw"></i>
        <span>${translate('Discard')}</span>
      </div>
      <div class="operator Open loggedin">
        <i class="fas fa-book-open fa-fw"></i>
        <span>${translate('Open')}</span>
      </div>
      <div class="operator Save loggedin" ${state.viewOnly ? 'style="display:none"' : ''}>
        <i class="rotate90 fas fa-bars fa-fw"></i>
        <span>${translate('Save')}</span>
      </div>
      <div class="operator Download loggedin" ${state.viewOnly ? 'style="display:none"' : ''}>
        <i class="fas fa-file-download fa-fw"></i>
        <span>${translate('Download note file')}</span>
      </div>
      <div class="operator UploadNote loggedin" ${state.viewOnly ? 'style="display:none"' : ''}>
        <i class="fas fa-file-upload fa-fw"></i>
        <span>${translate('Upload note file')}</span>
        <input id="noteFileInput" type="file" accept=".zip,.txt,.json,.wuwei,.note,application/zip,application/json,text/plain" style="display:none">
      </div>
      <div class="operator Publish loggedin" ${state.viewOnly ? 'style="display:none"' : ''}>
        <i class="fas fa-share-square fa-fw"></i>
        <span>${translate('Publish')}</span>
      </div>
      <div class="operator Logout loggedin">
        <i class="fas fa-sign-out-alt fa-fw"></i>
        <span>${translate('Logout')}</span>
      </div>
    </div>
  </div>
`);

    // page menu
    html.push(`
  <div id="pageMenu" class="pulldown page" style="display: none;">
    <span class="header">
      <i class="far fa-file fa-fw">&nbsp;${translate('Pages')}</i>
      <i class="fas fa-times fa-fw">&nbsp;${translate('Pages')}</i>
    </span>
    <hr>
    <div class="operators">
      <div class="operator List">
        <i class="fas fa-th fa-fw"></i>
        <span>${translate('List')}</span>
      </div>
      <div class="operator Name">
        <i class="fas fa-signature fa-fw"></i>
        <span>${translate('Name')}</span>
      </div>
      <div class="operator Copy">
        <i class="far fa-clone fa-fw"></i>
        <span>${translate('Copy')}</span>
      </div>
      <div class="operator New">
        <i class="fa fa-plus fa-fw"></i>
        <span>${translate('New Page')}</span>
      </div>
    </div>
  </div>
`);

    // new menu
    html.push(`
  <div id="newMenu" class="pulldown new" style="display: none;">
    <span class="header">
      <i class="fa fa-plus fa-fw">&nbsp;${translate('New')}</i>
      <i class="fas fa-times fa-fw">&nbsp;${translate('New')}</i>
    </span>
    <hr>
    <div class="operators">
      <div class="operator Content">
        <i class="fa fa-th-large fa-fw"></i>
        <span>${translate('Content')}</span>
      </div>
      <div class="operator Topic">
        <i class="fa fa-tag fa-fw"></i>
        <span>${translate('Topic')}</span>
      </div>
      <div class="operator Memo">
        <i class="far fa-sticky-note fa-fw"></i>
        <span>${translate('Memo')}</span>
      </div>
      <div class="operator Upload">
        <i class="fas fa-cloud-upload-alt fa-fw"></i>
        <span>${translate('Upload')}</span>
      </div>
      <div class="operator Paste" style="display:none">
        <i class="fas fa-paste fa-fw"></i>
        <span>${translate('Paste')}</span>
      </div>
      <div class="operator Clone" style="display:none">
        <i class="far fa-clone fa-fw"></i>
        <span>${translate('Clone')}</span>
      </div>
    </div>
  </div>
`);

    // flock menu
    html.push(`
  <div id="flockMenu" class="pulldown flock" style="display: none;">
    <span class="header">
      <i class="far fa-object-group fa-fw">${translate('Flock')}</i>
      <i class="fas fa-times fa-fw">&nbsp;${translate('Flock')}</i>
    </span>
    <div class="operators">
      <div class="operator-section">
        <div class="operator-section-title">${translate('Align')}</div>
      <div class="operator AlignTop selecting">
        <i class="fas fa-align-left fa-rotate-90 fa-fw"></i>
        <span>${translate('Align Top')}</span>
      </div>
      <div class="operator AlignHorizontal selecting">
        <i class="fas fa-align-center fa-rotate-90 fa-fw"></i>
        <span>${translate('Align Horizontal')}</span>
      </div>
      <div class="operator AlignBottom selecting">
        <i class="fas fa-align-right fa-rotate-90 fa-fw"></i>
        <span>${translate('Align Bottom')}</span>
      </div>
      <div class="operator AlignLeft selecting">
        <i class="fas fa-align-left fa-fw"></i>
        <span>${translate('Align Left')}</span>
      </div>
      <div class="operator AlignVertical selecting">
        <i class="fas fa-align-center fa-fw"></i>
        <span>${translate('Align Vertical')}</span>
      </div>
      <div class="operator AlignRight selecting">
        <i class="fas fa-align-right fa-fw"></i>
        <span>${translate('Align Right')}</span>
      </div>
      <div class="operator HorizontalEqual selecting">
        <i class="fas fa-arrows-alt-h fa-fw"></i>
        <span>${translate('Horizontal Equal')}</span>
      </div>
      <div class="operator VerticalEqual selecting">
        <i class="fas fa-arrows-alt-v fa-fw"></i>
        <span>${translate('Vertical Equal')}</span>
      </div>
      </div>
      <div class="operator-section">
        <div class="operator-section-title">${translate('Define / Ungroup')}</div>
      <div class="operator DefineSimpleGroup selecting">
        <i class="far fa-object-group fa-fw"></i>
        <span>${translate('Define simple group')}</span>
      </div>
      <div class="operator DefineHorizontalGroup selecting">
        <i class="fas fa-grip-lines fa-fw"></i>
        <span>${translate('Define horizontal axis group')}</span>
      </div>
      <div class="operator DefineVerticalGroup selecting">
        <i class="fas fa-grip-lines-vertical fa-fw"></i>
        <span>${translate('Define vertical axis group')}</span>
      </div>
      <div class="operator Ungroup selecting">
        <i class="far fa-object-ungroup fa-fw"></i>
        <span>${translate('Ungroup')}</span>
      </div>
      </div>
      <div class="operator-section">
        <div class="operator-section-title">${translate('Other')}</div>
      <div class="operator Copy selecting">
        <i class="fa fa-clone fa-fw"></i>
        <span>${translate('Copy')}</span>
      </div>
      <div class="operator Clipboard selecting">
        <i class="far fa-clipboard fa-fw"></i>
        <span>${translate('Clipboard')}</span>
      </div>
      <div class="operator Paste selecting" style="display:none">
        <i class="fas fa-paste fa-fw"></i>
        <span>${translate('Paste')}</span>
      </div>
      <div class="operator Clone selecting" style="display:none">
        <i class="far fa-clone fa-fw"></i>
        <span>${translate('Clone')}</span>
      </div>
      <div class="operator Edit selecting">
        <i class="fas fa-edit fa-fw"></i>
        <span>${translate('Edit')}</span>
      </div>
      <div class="operator DeselectFlock selecting">
        <span>${translate('Deselect')}</span>
      </div>
      </div>
    </div>
  </div>
`);

    // filter menu
    html.push(`
  <div id="filterMenu" class="pulldown" style="display: none;">
    <span class="header">
      <i class="fa fa-filter fa-fw">${translate('Filter')}</i>
    </span>
    <div class="operators">
      <div class="operator">
        <span>${translate('Show All')}</span>
      </div>
      <div class="operator">
        <span>${translate('Clear Screen')}</span>
      </div>
    </div>
  </div>
`);

    // panes
    html.push(`  <div id="settingPane" class="w3-modal hidden"></div>`);
    html.push(`  <div id="chatPane" class="w3-modal hidden"></div>`);

    // context menus
    html.push(`
  <div id="contextCMND" class="contextMenu collapsed">
    <i class="toggler fas fa-times fa-lg"></i>
    <div class="operators">
    </div>
  </div>

  <div id="contextEDIT" class="contextMenu collapsed">
    <i class="toggler fas fa-times fa-lg"></i>
    <div class="operators">
    </div>
  </div>

  <div id="contextINFO" class="contextMenu collapsed">
    <i class="toggler fas fa-times fa-lg"></i>
    <div class="operators">
    </div>
  </div>
`);

    return html.join('\n');
  }

  /**
   * Format number with unit like K, M, G, T, P, E.
   * @param {integer} num - The original number.
   * @param {integer} digits - The number of digits after decimal point.
   * see https://stackoverflow.com/questions/9461621/format-a-number-as-2-5k-if-a-thousand-or-more-otherwise-900
   */
  function nFormatter(num, digits) {
    var si = [
      { value: 1, symbol: '' },
      { value: 1E3, symbol: 'K' },
      { value: 1E6, symbol: 'M' },
      { value: 1E9, symbol: 'G' },
      { value: 1E12, symbol: 'T' },
      { value: 1E15, symbol: 'P' },
      { value: 1E18, symbol: 'E' }
    ];
    var rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    var i;
    for (i = si.length - 1; i > 0; i--) {
      if (num >= si[i].value) {
        break;
      }
    }
    return (num / si[i].value).toFixed(digits).replace(rx, "$1") + si[i].symbol;
  }

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template,
    nFormatter: nFormatter
  };
}());
// wuwei.menu.markup.js 2026-04-16
