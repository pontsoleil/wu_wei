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
    <div class="pane-header-actions" aria-label="Edit pane actions">
      <!-- INFO BUTTON -->
      <a id="infoOpen">
        <i class="fas fa-info fa-lg fa-fw"></i>
      </a>
      <!-- WIDEN BUTTON -->
      <a id="editWiden">
        <i class="fas fa-arrows-alt-h fa-lg fa-fw"></i>
      </a>
      <!-- DISMISS BUTTON -->
      <a id="editDismiss">
        <i class="fa fa-times fa-lg fa-fw"></i>
      </a>
    </div>
  </header>`);

    html.push(`
  <div id="edit-generic"></div>
  <div id="edit-group"></div>
  <div id="edit-link"></div>
  <div id="edit-uploaded"></div>
  <div id="edit-video"></div>
  <div id="edit-audio"></div>
  <div id="edit-image"></div>
  <div id="edit-viewpoint">`);
    if (wuwei.edit &&
      wuwei.edit.viewpoint &&
      wuwei.edit.viewpoint.markup &&
      typeof wuwei.edit.viewpoint.markup.panelsHtml === 'function') {
      html.push(wuwei.edit.viewpoint.markup.panelsHtml());
    }
    html.push(`</div>
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


  function pathToFieldId(path) {
    if (!path) { return ''; }
    return String(path).replace(/\./g, '_');
  }


  function selectOptions(name, value, options, placeholder, size, multiple, cb) {
    options = options || [];
    size = size || 's8';

    var modelPath = String(name || '');
    var fieldId = pathToFieldId(modelPath);
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
      '<select id="' + fieldId + '" name="' + modelPath + '"',
      ' class="w3-col ' + size + ' edit-value"',
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


  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readonlyTextRow(id, label, value, labelSize, valueSize) {
    return [
      '<div class="w3-row">',
      '  <label for="' + escapeHtml(id) + '" class="w3-col ' + (labelSize || 's5') + '">' + translate(label) + '</label>',
      '  <input type="text" id="' + escapeHtml(id) + '" class="w3-col ' + (valueSize || 's7') + '" readonly aria-readonly="true" value="' + escapeHtml(value || '') + '">',
      '</div>'
    ].join('\n');
  }

  function editableTextRow(path, label, value, labelSize, valueSize) {
    var id = pathToFieldId(path);
    return [
      '<div class="w3-row">',
      '  <label for="' + escapeHtml(id) + '" class="w3-col ' + (labelSize || 's5') + '">' + translate(label) + '</label>',
      '  <input type="text" id="' + escapeHtml(id) + '" name="' + escapeHtml(path) + '" class="w3-col ' + (valueSize || 's7') + ' edit-value" value="' + escapeHtml(value || '') + '">',
      '</div>'
    ].join('\n');
  }

  function resourceOriginalRows(resource, options) {
    var html = [];
    var original;
    var source;
    var storage;
    var files;
    var file;
    var i;
    options = options || {};
    resource = resource && typeof resource === 'object' ? resource : {};
    original = resource.original && typeof resource.original === 'object' ? resource.original : {};
    source = String(resource.source || original.type || '').toLowerCase();
    storage = resource.storage && typeof resource.storage === 'object' ? resource.storage : {};
    files = Array.isArray(storage.files) ? storage.files : [];
    if (source === 'remote' || original.type === 'remote' || original.url || original.canonicalUrl) {
      html.push(editableTextRow('resource.original.url', 'Reference URL', original.url || resource.uri || resource.canonicalUri || ''));
      html.push(editableTextRow('resource.original.canonicalUrl', 'Canonical URL', original.canonicalUrl || resource.canonicalUri || ''));
      html.push(readonlyTextRow('resource_original_accessedAt', 'Accessed at', original.accessedAt || ''));
      html.push(editableTextRow('resource.original.identifiers', 'Identifiers', Array.isArray(original.identifiers) ? JSON.stringify(original.identifiers) : ''));
      return html.join('\n');
    }
    html.push(readonlyTextRow('resource_original_type', 'Original type', original.type || source || 'upload'));
    html.push(readonlyTextRow('resource_original_storageRole', 'Original storage role', original.storageRole || 'original'));
    for (i = 0; i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.role || '').toLowerCase() === String(original.storageRole || 'original').toLowerCase()) {
        html.push(readonlyTextRow('resource_original_path', 'Original path', file.path || ''));
        html.push(readonlyTextRow('resource_original_fileName', 'Original file', file.file_name || file.name || ''));
        break;
      }
    }
    return html.join('\n');
  }

  function rowcount(text, minRows, maxRows) {
    text = String(text || '');
    minRows = Number(minRows || 1);
    maxRows = Number(maxRows || 16);

    var rows = text.split(/\r\n|\r|\n/).length;

    if (rows < minRows) {
      rows = minRows;
    }
    if (rows > maxRows) {
      rows = maxRows;
    }
    return rows;
  }

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    escapeHtml: escapeHtml,
    readonlyTextRow: readonlyTextRow,
    editableTextRow: editableTextRow,
    resourceOriginalRows: resourceOriginalRows,
    selectOptions: selectOptions,
    rowcount: rowcount,
    translate: translate,
    template: template
  };
})();
// wuwei.edit.markup.js 2026-04-16
