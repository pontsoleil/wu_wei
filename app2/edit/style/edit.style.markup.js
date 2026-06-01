/**
 * edit.style.markup.js
 * Shared style edit markup.
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.style = wuwei.edit.style || {};

wuwei.edit.style.markup = (function () {
  'use strict';

  function t(str) {
    return wuwei.nls.translate(str);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function rowcount(value) {
    return wuwei.edit.markup.rowcount(value || '');
  }

  function selectOptions(name, value, options, placeholder, size) {
    return wuwei.edit.markup.selectOptions(name, value, options, placeholder, size);
  }

  function labelAlignIcons(value, size) {
    value = String(value || 'center').toLowerCase();
    return [
      '<div class="font_text-anchor w3-col ' + (size || 's8') + '">',
      '  <i class="font_text-anchor start fas fa-align-left ' + (value === 'left' ? 'checked' : '') + '" title="left"></i>',
      '  <i class="font_text-anchor middle fas fa-align-center ' + (value === 'center' ? 'checked' : '') + '" title="center"></i>',
      '  <i class="font_text-anchor end fas fa-align-right ' + (value === 'right' ? 'checked' : '') + '" title="right"></i>',
      '</div>'
    ].join('');
  }

  function shapeOptions() {
    return (wuwei.common.shapes || []).filter(function (item) {
      return item && item.value !== 'THUMBNAIL';
    });
  }

  function labelLayoutRows(param) {
    param = param || {};
    return [
      '<div class="w3-row" id="style_label_width-row">',
      '  <label for="style_label_width" class="w3-col s3">' + t('width') + '</label>',
      '  <input type="number" id="style_label_width" name="style.label.width" value="' + (param.width || '') + '" class="w3-col s3 edit-value" min="1" step="1">',
      '  <label for="style_label_lines" class="w3-col s3">' + t('lines') + '</label>',
      '  <input type="number" id="style_label_lines" name="style.label.lines" value="' + (param.lines || '') + '" class="w3-col s3 edit-value" min="1" step="1">',
      '</div>',
      '<div class="w3-row" id="style_label_offset_x-row">',
      '  <label for="style_label_offset_x" class="w3-col s3">' + t('offset X') + '</label>',
      '  <input type="number" id="style_label_offset_x" name="style.label.offset.x" value="' + (param.offsetX || 0) + '" class="w3-col s3 edit-value" step="1">',
      '  <label for="style_label_offset_y" class="w3-col s3">' + t('offset Y') + '</label>',
      '  <input type="number" id="style_label_offset_y" name="style.label.offset.y" value="' + (param.offsetY || 0) + '" class="w3-col s3 edit-value" step="1">',
      '</div>'
    ].join('\n');
  }

  function descriptionFormatOptions() {
    return [
      { value: 'plain/text', label: 'text' },
      { value: 'asciidoc', label: 'asciidoc' },
      { value: 'markdown', label: 'markdown' },
      { value: 'tex', label: 'TeX' },
      { value: 'html', label: 'HTML' },
      { value: 'other', label: 'other' }
    ];
  }

  function descriptionPlaceholder() {
    return [
      t('Comment'),
      'AsciiDoc examples',
      '*bold text*',
      '_italic text_',
      '[.underline]#underlined text#',
      '[.line-through]#strikethrough text#',
      '^superscript^',
      '~subscript~',
      '* unordered list item',
      '. ordered list item',
      '== Heading level 1',
      '=== Heading level 2',
      '====== Heading level 5',
      '[source]',
      '----',
      'source code',
      '----'
    ].join('\n');
  }

  function labelRows(param) {
    param = param || {};
    return [
      '<div class="w3-row">',
      '  <textarea id="label" name="label" class="w3-col s12 edit-value edit-auto-resize" rows="' + rowcount(param.label || '') + '" placeholder="' + esc(t('Label')) + '">' + esc(param.label || '') + '</textarea>',
      '</div>',
      '<div class="w3-row">',
      '  <label class="w3-col ' + (param.labelSize || 's6') + '">' + t(param.alignLabel || 'align') + '</label>',
      labelAlignIcons(param.align || 'center', param.alignSize || 's6'),
      '</div>'
    ].join('\n');
  }

  function labelTextRows(param) {
    var font;
    param = param || {};
    font = param.font || {};
    return [
      '<div class="w3-row">',
      '  <label for="style_font_color" class="w3-col s3">' + t('Text') + '</label>',
      '  <input type="color" id="style_font_color" name="style.font.color" value="' + esc(font.color || param.fontColor || '#303030') + '" class="w3-col s3 pointer edit-value">',
      '  <div id="' + (param.fontPaletteId || 'style_font_color_palette') + '" class="w3-col s3 pointer"></div>',
      selectOptions('style.font.size', param.fontSize || font.size || '12pt', wuwei.common.fontSizes, 'Select font size', 's3'),
      '</div>'
    ].join('\n');
  }

  function labelControlRows(param) {
    param = param || {};
    return [
      labelRows({
        label: param.label,
        align: param.align,
        labelSize: param.labelSize || 's5',
        alignSize: param.alignSize || 's7'
      }),
      labelLayoutRows(param),
      labelTextRows(param)
    ].join('\n');
  }

  function descriptionEntryBody(entry) {
    if (!entry || 'object' !== typeof entry) {
      return '';
    }
    return (typeof entry.body === 'string') ? entry.body : String(entry.text || '');
  }

  function descriptionOriginalBody(description) {
    var i, entry;
    if (Array.isArray(description)) {
      for (i = 0; i < description.length; i += 1) {
        entry = description[i];
        if (entry && String(entry.role || 'original') === 'original') {
          return descriptionEntryBody(entry);
        }
      }
      return descriptionEntryBody(description[0]);
    }
    return (description && typeof description.body === 'string') ? description.body : '';
  }

  function descriptionOriginalFormat(description) {
    var i, entry;
    if (Array.isArray(description)) {
      for (i = 0; i < description.length; i += 1) {
        entry = description[i];
        if (entry && String(entry.role || 'original') === 'original') {
          return String(entry.format || 'asciidoc');
        }
      }
      return String((description[0] && description[0].format) || 'asciidoc');
    }
    return String((description && description.format) || 'asciidoc');
  }

  function descriptionSupplementBody(description) {
    var uid = String(
      (wuwei.common && wuwei.common.state && wuwei.common.state.currentUser && wuwei.common.state.currentUser.user_id) ||
      (wuwei.common && wuwei.common.state && wuwei.common.state.user_id) ||
      ''
    ).trim();
    var i, entry;
    if (!Array.isArray(description)) {
      return '';
    }
    for (i = description.length - 1; i >= 0; i -= 1) {
      entry = description[i];
      if (entry && String(entry.role || '') === 'supplement' &&
        (!uid || String(entry.createdBy || '') === uid)) {
        return descriptionEntryBody(entry);
      }
    }
    return '';
  }

  function descriptionSupplementFormat(description) {
    var uid = String(
      (wuwei.common && wuwei.common.state && wuwei.common.state.currentUser && wuwei.common.state.currentUser.user_id) ||
      (wuwei.common && wuwei.common.state && wuwei.common.state.user_id) ||
      ''
    ).trim();
    var i, entry;
    if (!Array.isArray(description)) {
      return 'asciidoc';
    }
    for (i = description.length - 1; i >= 0; i -= 1) {
      entry = description[i];
      if (entry && String(entry.role || '') === 'supplement' &&
        (!uid || String(entry.createdBy || '') === uid)) {
        return String(entry.format || 'asciidoc');
      }
    }
    return 'asciidoc';
  }

  function descriptionRows(param) {
    var importedSupplement;
    var originalBody;
    var originalFormat;
    var supplementBody;
    var supplementFormat;
    param = param || {};
    importedSupplement = !!(param.node &&
      wuwei.joint &&
      typeof wuwei.joint.canAppendImportedDescription === 'function' &&
      wuwei.joint.canAppendImportedDescription(param.node, 'description.body', 'node'));
    if (importedSupplement) {
      originalBody = descriptionOriginalBody(param.node.description);
      originalFormat = descriptionOriginalFormat(param.node.description);
      supplementBody = descriptionSupplementBody(param.node.description);
      supplementFormat = descriptionSupplementFormat(param.node.description);
      return [
        '<div class="w3-row">',
        '  <label for="description_original_format" class="w3-col s4">' + t('Format') + '</label>',
        '  <input id="description_original_format" class="w3-col s8" value="' + esc(originalFormat) + '" readonly aria-readonly="true">',
        '</div>',
        '<div class="w3-row">',
        '  <label for="description_original_body" class="w3-col s12">' + t('Description') + '</label>',
        '  <textarea id="description_original_body" class="w3-col s12" rows="' + rowcount(originalBody) + '" readonly aria-readonly="true">' + esc(originalBody) + '</textarea>',
        '</div>',
        '<div class="w3-row">',
        '  <label for="description_supplement_format" class="w3-col s4">' + t('Format') + '</label>',
        selectOptions('description.supplementFormat', supplementFormat, descriptionFormatOptions(), null, 's8'),
        '</div>',
        '<div class="w3-row">',
        '  <label for="description_body" class="w3-col s12">' + t('Supplement') + '</label>',
        '  <textarea id="description_body" name="description.body" class="w3-col s12 edit-value edit-auto-resize" rows="' + rowcount(supplementBody) + '" placeholder="' + esc(param.placeholder || descriptionPlaceholder()) + '">' + esc(supplementBody) + '</textarea>',
        '</div>'
      ].join('\n');
    }
    return [
      '<div class="w3-row">',
      '  <label for="description_format" class="w3-col s4">' + t('Format') + '</label>',
      selectOptions('description.format', param.format || 'plain/text', descriptionFormatOptions(), null, 's8'),
      '</div>',
      '<div class="w3-row">',
      '  <textarea id="description_body" name="description.body" class="w3-col s12 edit-value edit-auto-resize" rows="' + rowcount(param.body || '') + '" placeholder="' + esc(param.placeholder || descriptionPlaceholder()) + '">' + esc(param.body || '') + '</textarea>',
      '</div>'
    ].join('\n');
  }

  function shapeSizeRows(param) {
    param = param || {};
    var prefix = param.prefix || '';
    var shapeId = prefix ? prefix + 'Shape' : 'shape';
    var radiusRowId = prefix ? prefix + 'SizeRadiusRow' : 'radius';
    var widthHeightRowId = prefix ? prefix + 'SizeWidthHeightRow' : 'width-height';
    var radiusId = prefix ? prefix + 'SizeRadius' : 'size_radius';
    var widthId = prefix ? prefix + 'SizeWidth' : 'size_width';
    var heightId = prefix ? prefix + 'SizeHeight' : 'size_height';
    var shape = param.shape || 'RECTANGLE';
    var size = param.size || {};

    return [
      '<div class="' + (param.fieldClass || 'w3-row') + '" style="display:' + (shape === 'MEMO' ? 'none' : 'block') + '">',
      '  <label for="' + shapeId + '" class="w3-col s5">' + t('Shape') + '</label>',
      selectOptions(param.name || 'shape', shape, param.options || shapeOptions(), '' + t('Shape'), 's7').replace('id="' + (param.name || 'shape').replace(/\./g, '_') + '"', 'id="' + shapeId + '"'),
      '</div>',
      '<div class="' + (param.fieldClass || 'w3-row') + '" id="' + radiusRowId + '" style="display:' + (shape === 'CIRCLE' ? 'block' : 'none') + '">',
      '  <label for="' + radiusId + '" class="w3-col s4">' + t('Radius') + '</label>',
      '  <input type="number" id="' + radiusId + '" name="size.radius" value="' + (size.radius || '') + '" class="w3-col s8 edit-value">',
      '</div>',
      '<div class="' + (param.fieldClass || 'w3-row') + '" id="' + widthHeightRowId + '" style="display:' + (shape === 'CIRCLE' ? 'none' : 'block') + '">',
      '  <label for="' + widthId + '" class="w3-col s2">' + t('Width') + '</label>',
      '  <input type="number" id="' + widthId + '" name="size.width" value="' + (size.width || '') + '" class="w3-col s4 edit-value">',
      '  <label for="' + heightId + '" class="w3-col s2">' + t('Height') + '</label>',
      '  <input type="number" id="' + heightId + '" name="size.height" value="' + (size.height || '') + '" class="w3-col s4 edit-value">',
      '</div>'
    ].join('\n');
  }

  function paintRows(param) {
    param = param || {};
    var style = param.style || {};
    var font = style.font || {};
    var line = style.line || {};
    var rows = [];

    rows.push(
      '<div class="w3-row">',
      '  <label for="style_fill" class="w3-col s4">' + t('Background') + '</label>',
      '  <input type="color" id="style_fill" name="style.fill" value="' + (style.fill || param.fill || '#ffffff') + '" class="w3-col s4 pointer edit-value">',
      '  <div id="' + (param.fillPaletteId || 'style_fill_palette') + '" class="w3-col s4 pointer"></div>',
      '</div>'
    );

    if (param.includeLine) {
      rows.push(
        '<div class="w3-row">',
        '  <label for="style_line_kind" class="w3-col s3">' + t('Outline') + '</label>',
        selectOptions('style.line.kind', line.kind || param.lineKind || 'SOLID', wuwei.common.strokeDasharray, t('Stroke'), 's9'),
        '</div>',
        '<div class="w3-row">',
        '  <label for="style_line_width" class="w3-col s3">' + t('Size') + '</label>',
        '  <input type="number" id="style_line_width" name="style.line.width" value="' + (line.width || param.lineWidth || 1) + '" class="w3-col s3 edit-value" step="1" min="0">',
        '  <input type="color" id="style_line_color" name="style.line.color" value="' + (line.color || param.lineColor || '#4c6b8a') + '" class="w3-col s3 pointer edit-value">',
        '  <div id="' + (param.linePaletteId || 'style_line_color_palette') + '" class="w3-col s3 pointer"></div>',
        '</div>'
      );
    }

    if (param.includeFont !== false) {
      rows.push(
        '<div class="w3-row">',
        '  <label for="style_font_color" class="w3-col s3">' + t('Text') + '</label>',
        '  <input type="color" id="style_font_color" name="style.font.color" value="' + (font.color || param.fontColor || '#303030') + '" class="w3-col s3 pointer edit-value">',
        '  <div id="' + (param.fontPaletteId || 'style_font_color_palette') + '" class="w3-col s3 pointer"></div>',
        param.includeFontSize === false ? '' : selectOptions('style.font.size', param.fontSize || font.size || '12pt', wuwei.common.fontSizes, 'Select font size', 's3'),
        '</div>'
      );
    }

    return rows.join('\n');
  }

  function applyPath(target, path, value) {
    var keys = String(path || '').split('.');
    var cursor = target;
    var i;
    if (!target || !path) { return; }
    for (i = 0; i < keys.length - 1; i += 1) {
      cursor[keys[i]] = cursor[keys[i]] && typeof cursor[keys[i]] === 'object' ? cursor[keys[i]] : {};
      cursor = cursor[keys[i]];
    }
    cursor[keys[keys.length - 1]] = value;
  }

  function initPalette(paletteId, inputId, fallbackTarget, fallbackPath) {
    var palette = document.getElementById(paletteId);
    if (!palette || palette.dataset.initialized === '1' ||
      typeof $ !== 'function' || !$.fn || typeof $.fn.colorPalettePicker !== 'function') {
      return;
    }
    $('#' + paletteId).colorPalettePicker({
      lines: 6,
      bootstrap: 4,
      dropdownTitle: t('Standard colours'),
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: paletteId + 'Selected',
      onSelected: function (color) {
        var input = document.getElementById(inputId);
        if (input) {
          input.value = color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (fallbackTarget && fallbackPath) {
          applyPath(fallbackTarget, fallbackPath, color);
        }
      }
    });
    palette.dataset.initialized = '1';
  }

  function initPaletteWithResolver(paletteId, inputResolver) {
    var palette = document.getElementById(paletteId);
    if (!palette || palette.dataset.initialized === '1' ||
      typeof $ !== 'function' || !$.fn || typeof $.fn.colorPalettePicker !== 'function') {
      return;
    }
    $('#' + paletteId).colorPalettePicker({
      lines: 6,
      bootstrap: 4,
      dropdownTitle: t('Standard colours'),
      buttonClass: 'btn btn-light btn-sm dropdown-toggle',
      buttonPreviewName: paletteId + 'Selected',
      onSelected: function (color) {
        var input = typeof inputResolver === 'function' ? inputResolver() : null;
        if (input) {
          input.value = color;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    palette.dataset.initialized = '1';
  }

  function initPalettes(param) {
    param = param || {};
    initPalette(param.fillPaletteId || 'style_fill_palette', param.fillInputId || 'style_fill', param.target, 'style.fill');
    initPalette(param.fontPaletteId || 'style_font_color_palette', param.fontInputId || 'style_font_color', param.target, 'style.font.color');
    if (param.linePaletteId) {
      initPalette(param.linePaletteId, param.lineInputId || 'style_line_color', param.target, 'style.line.color');
    }
  }

  return {
    labelAlignIcons: labelAlignIcons,
    labelRows: labelRows,
    labelTextRows: labelTextRows,
    labelControlRows: labelControlRows,
    descriptionRows: descriptionRows,
    descriptionFormatOptions: descriptionFormatOptions,
    labelLayoutRows: labelLayoutRows,
    shapeSizeRows: shapeSizeRows,
    paintRows: paintRows,
    shapeOptions: shapeOptions,
    initPalette: initPalette,
    initPaletteWithResolver: initPaletteWithResolver,
    initPalettes: initPalettes
  };
}());
