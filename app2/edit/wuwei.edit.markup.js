/**
 * wuwei.edit.markup.js
 * wuwei edit template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.edit = wuwei.edit || {};

wuwei.edit.markup = (function () {
  const template = function () {
    var html = []
    html.push(`
  <header class="w3-container">
    <h2>
      <i id="editIcon" class="fas fa-edit fa-lg fa-fw"></i>
      <i id="editSave" class="fas fa-save fa-lg fa-fw"></i>
    </h2>
    <!-- DISMISS BUTTON -->
    <a id="editDismiss">
      <i class="fa fa-times fa-lg fa-fw"></i>
    </a>
    <!-- WIDEN BUTTON -->
    <a id="editWiden">
      <i class="fas fa-arrows-alt-h fa-lg fa-fw"></i>
    </a>
    <!-- INFO BUTTON -->
    <a id="infoOpen">
      <i class="fas fa-info fa-lg fa-fw"></i>
    </a>
  </header>`);

    html.push(`
  <div id="edit-generic"></div>
  <div id="edit-link"></div>
  <div id="edit-uploaded"></div>
  <div id="edit-video"></div>
  <div id="edit-timeline">`);
    if (wuwei.edit &&
      wuwei.edit.timeline &&
      wuwei.edit.timeline.markup &&
      typeof wuwei.edit.timeline.markup.panelsHtml === 'function') {
      html.push(wuwei.edit.timeline.markup.panelsHtml());
    }
    html.push('</div>');
    return html.join('\n');
  };


  function selectOptions(name, value, options, placeholder, size, multiple, cb) {
    options = options || [];
    size = size || 's8';
    var modelPathMap = {
      nFont_size: 'style.font.size',
      lFont_size: 'style.font.size',
      nShape: 'shape',
      lShape: 'shape',
      lStrokedash: 'style.line.kind',
      lStartArrow_kind: 'routing.startArrow.kind',
      lEndArrow_kind: 'routing.endArrow.kind',
      rMedia_kind: 'resource.kind'
    };
    var modelPath = modelPathMap[name] || '';
    var fieldName = modelPath || name;

    var values;
    if (multiple) {
      if (Array.isArray(value)) {
        values = value;
      }
      else if (typeof value === 'undefined' || value === null || value === '') {
        values = [];
      }
      else {
        values = [value];
      }
    }
    else {
      values = (typeof value === 'undefined' || value === null) ? '' : String(value);
    }

    var html = [];

    html.push(
      '<select id="' + name + '" name="' + fieldName + '"',
      modelPath ? ' data-path="' + modelPath + '"' : '',
      ' class="w3-col ' + size + '"',
      multiple ? ' multiple="multiple"' : '',
      cb ? ' onchange="' + cb + '()"' : '',
      '>'
    );

    if (placeholder) {
      if (multiple) {
        html.push('<option value="" disabled>' + translate(placeholder) + '</option>');
      }
      else {
        html.push(
          '<option value="" disabled' + (values === '' ? ' selected' : '') + '>' +
          translate(placeholder) +
          '</option>'
        );
      }
    }

    options.forEach(function (option) {
      var selected = '';
      if (multiple) {
        selected = values.indexOf(option.value) >= 0 ? ' selected' : '';
      }
      else {
        selected = String(option.value) === values ? ' selected' : '';
      }

      html.push(
        '<option value="' + option.value + '"' + selected + '>' +
        translate(option.label) +
        '</option>'
      );
    });

    html.push('</select>');
    return html.join('');
  }


  function rowcount(text) {
    function getByteCount(str) {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(str);
      return encoded.length;
    }
    let countRows = 0;
    const ROW_NUM = 28;
    const lines = text.split('\n');
    for (let line of lines) {
      let lineBytes = getByteCount(line);
      countRows += Math.ceil(lineBytes / ROW_NUM);
    }
    if (countRows < 5) {
      countRows = 5;
    } else if (countRows > 16) {
      countRows = 16;
    }
    return countRows;
  }


  function translate(str) {
    return wuwei.nls.translate(str);
  }


  return {
    selectOptions: selectOptions,
    rowcount: rowcount,
    translate: translate,
    template: template
  };
})();
// wuwei.edit.markup.js 2026-04-16
