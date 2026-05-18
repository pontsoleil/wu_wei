/**
 * edit.generic.markup.js
 * wuwei edit.generic template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.generic = wuwei.edit.generic || {};

wuwei.edit.generic.markup = ( function () {
  function getFontAlign(node) {
    var align = node && node.style && node.style.font && node.style.font.align;
    return align ? String(align).toLowerCase() : 'center';
  }

  function normalizeFontSizeValue(value) {
    if (value == null || value === '' || Number(value) === 14) {
      return '12pt';
    }
    if ('number' === typeof value || /^\d+(\.\d+)?$/.test(String(value))) {
      return String(value) + 'pt';
    }
    return String(value);
  }

  function getMediaKindValue(node) {
    var resource = (node && node.resource) || {};
    var resourceKind = String(resource.kind || '').toLowerCase();
    var resourceMimeType = String(resource.mimeType || '').toLowerCase();
    var resourceUri = String(resource.uri || '').toLowerCase();
    var host = '';

    try {
      host = new URL(resourceUri, window.location.href).hostname.toLowerCase();
    }
    catch (e) {
      host = '';
    }

    if (host === 'youtu.be' ||
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'vimeo.com' ||
      host === 'www.vimeo.com' ||
      host === 'player.vimeo.com' ||
      /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)(\/|$|\?)/.test(resourceUri)) {
      return 'video';
    }
    if (resourceKind === 'web') {
      return 'webpage';
    }
    if (resourceKind === 'pdf' || resourceKind === 'office') {
      return 'document';
    }
    if (resourceKind === 'image' || resourceKind === 'video' || resourceKind === 'audio') {
      return resourceKind;
    }
    if (resourceMimeType.indexOf('video/') === 0) {
      return 'video';
    }
    if (resourceMimeType.indexOf('image/') === 0) {
      return 'image';
    }
    if (resourceMimeType.indexOf('audio/') === 0) {
      return 'audio';
    }
    if (resourceMimeType.indexOf('application/pdf') === 0 ||
      resourceMimeType.indexOf('application/msword') === 0 ||
      resourceMimeType.indexOf('application/vnd.ms-excel') === 0 ||
      resourceMimeType.indexOf('application/vnd.ms-powerpoint') === 0 ||
      resourceMimeType.indexOf('application/vnd.openxmlformats-officedocument') === 0) {
      return 'document';
    }
    if (/^https?:\/\//.test(resourceUri)) {
      return 'webpage';
    }
    return '';
  }

  function getEditableResourceUri(node) {
    var uri = (node && node.resource && node.resource.uri) || '';
    if (wuwei.util && typeof wuwei.util.getResourceOriginalPath === 'function') {
      uri = wuwei.util.getResourceOriginalPath(node) || uri;
    }
    if (wuwei.util && typeof wuwei.util.toStorageRelativePath === 'function' &&
      (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || '')) ||
        /^\/?upload\//.test(String(uri).replace(/^.*\/wu_wei2\//, '')) ||
        /\/upload\//.test(String(uri || '')))) {
      uri = wuwei.util.toStorageRelativePath(uri, null, 'upload');
    }
    return getSnapshotDisplayPath(node, 'original', uri);
  }

  function getEditableThumbnailUri(node) {
    var uri = String(node && node.resource && node.resource.thumbnailUri || '');
    if (!uri && wuwei.util && typeof wuwei.util.getResourceFilePath === 'function' &&
      node && node.resource) {
      uri = wuwei.util.getResourceFilePath(node.resource, 'thumbnail', node) || '';
    }
    if (wuwei.util && typeof wuwei.util.toStorageRelativePath === 'function' &&
      (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || '')) ||
        /^\/?(resource|note)\//.test(String(uri).replace(/^.*\/wu_wei2\//, '')) ||
        /\/(resource|note)\//.test(String(uri || '')))) {
      uri = wuwei.util.toStorageRelativePath(uri, null, /(?:^|\/)note\//.test(String(uri || '')) ? 'note' : 'resource');
    }
    return getSnapshotDisplayPath(node, 'thumbnail', uri);
  }

  function getSnapshotDisplayPath(node, role, current) {
    var resource = node && node.resource;
    var storage = resource && resource.storage;
    var files = storage && Array.isArray(storage.files) ? storage.files : [];
    var snapshotPath = String(storage && storage.snapshotPath || '').replace(/\\/g, '/');
    var file, raw, path, uid, i;

    if (/^\d{4}\/\d{2}\/\d{2}\//.test(String(current || ''))) {
      return current;
    }
    if (!snapshotPath || !wuwei.util || typeof wuwei.util.toStorageRelativePath !== 'function') {
      return current;
    }
    for (i = 0; i < files.length; i += 1) {
      file = files[i] || {};
      if (String(file.role || '').toLowerCase() !== String(role || '').toLowerCase()) {
        continue;
      }
      raw = String(file.path || '').replace(/\\/g, '/').trim();
      if (!raw || /^(?:https?:|cgi-bin\/|server\/|\d{4}\/\d{2}\/\d{2}\/)/i.test(raw)) {
        return current;
      }
      uid = String(
        (resource.audit && (resource.audit.owner || resource.audit.createdBy)) ||
        (node.audit && (node.audit.owner || node.audit.createdBy)) ||
        ''
      ).trim();
      path = wuwei.util.toStorageRelativePath(snapshotPath.replace(/\/+$/, '') + '/' + raw, uid, 'note');
      return path || current;
    }
    return current;
  }

  function isManagedResourceNode(node) {
    var resource = node && node.resource;
    var storage = resource && resource.storage;
    var files = storage && Array.isArray(storage.files) ? storage.files : [];

    return !!(
      files.length ||
      files.length
    );
  }


  function getResourceContentsValue(node, key) {
    var contents = node && node.resource && node.resource.contents;
    var value = contents && contents[key];
    return Number.isFinite(Number(value)) ? String(Math.floor(Number(value))) : '';
  }


  function getLabelStyleValue(node, path, fallback) {
    var labelStyle = node && node.style && node.style.label;
    var offset;
    if (!labelStyle || 'object' !== typeof labelStyle) {
      return fallback;
    }
    if ('offset.x' === path || 'offset.y' === path) {
      offset = labelStyle.offset || {};
      return Number.isFinite(Number(offset[path.slice(-1)])) ? Number(offset[path.slice(-1)]) : fallback;
    }
    return Number.isFinite(Number(labelStyle[path])) ? Number(labelStyle[path]) : (labelStyle[path] || fallback);
  }


  function getDefaultLabelStyle() {
    return (wuwei.common && wuwei.common.defaultStyle && wuwei.common.defaultStyle.label) || {};
  }

  function getDefaultLabelWidth(node) {
    var style = getDefaultLabelStyle();
    var width = Number(style.width);
    if (Number.isFinite(width) && width > 0) { return width; }
    return node && node.size && Number(node.size.width) > 0 ? Number(node.size.width) : 120;
  }

  function getDefaultLabelLines() {
    var lines = Number(getDefaultLabelStyle().lines);
    return Number.isFinite(lines) && lines > 0 ? Math.floor(lines) : 1;
  }

  function getDefaultLabelOffsetX() {
    var offset = getDefaultLabelStyle().offset || {};
    var x = Number(offset.x);
    return Number.isFinite(x) ? x : 0;
  }

  function getDefaultLabelOffsetY() {
    var offset = getDefaultLabelStyle().offset || {};
    var y = Number(offset.y);
    return Number.isFinite(y) ? y : 0;
  }

  const template = function (param) {
    const
      common = wuwei.common,
      lang = common.nls.LANG,
      shapes = common.shapes,
      fontSizes = common.fontSizes,
      positions = common.positions;
    let
      node = param.node,
      shape = node.shape,
      label = node.label || '',
      style = node.style || {},
      font = (node.style && node.style.font) || {},
      value = ((node.description && typeof node.description.body === 'string')
        ? node.description.body
        : ''),
      option = param.option || {};
    var fontAlign = getFontAlign(node);
    var fontSizeValue = normalizeFontSizeValue(font && font.size);
    var memoStyle = (style && style.memo && typeof style.memo === 'object') ? style.memo : {};
    var memoCorner = memoStyle.corner || 'bottom-right';
    var storagePathAttrs = isManagedResourceNode(node) ? ' readonly aria-readonly="true"' : '';
    var labelStyleWidth = getLabelStyleValue(node, 'width', getDefaultLabelWidth(node));
    var labelStyleLines = getLabelStyleValue(node, 'lines', getDefaultLabelLines());
    var labelOffsetX = getLabelStyleValue(node, 'offset.x', getDefaultLabelOffsetX());
    var labelOffsetY = getLabelStyleValue(node, 'offset.y', getDefaultLabelOffsetY());
    var html = [];

    html.push(
      '<form id="editform" class="generic form-group content" onsubmit="return false;">'
    );

    if (!(node && 'Memo' === node.type)) {
      if (!option.flock) {
        html.push(
          '<div class="w3-row">',
          '  <textarea id="label" name="label" class="w3-col s12 edit-value" rows="' + rowcount(label) + '" ',
          '      placeholder="' + t('Label') + '">' + label + '</textarea>',
          '</div>',
          '<div class="w3-row">',
          '  <label class="w3-col s5">' + t('align') + '</label>',
          labelAlignIcons(fontAlign, 's7'),
          '</div>'
        );
      }
    }

    if (node.label || 'PageMarker' === node.type || 'Segment' === node.type || 'Topic' === node.type || 'Content' === node.type) {
      html.push(
        '<div class="w3-row" id="style_label_width-row">',
        '  <label for="style_label_width" class="w3-col s3">' + t('width') + '</label>',
        '  <input type="number" id="style_label_width" name="style.label.width" value="' + labelStyleWidth + '" class="w3-col s3 edit-value" min="1" step="1">',
        '  <label for="style_label_lines" class="w3-col s3">' + t('lines') + '</label>',
        '  <input type="number" id="style_label_lines" name="style.label.lines" value="' + labelStyleLines + '" class="w3-col s3 edit-value" min="1" step="1">',
        '</div>',
        '<div class="w3-row" id="style_label_offset_x-row">',
        '  <label for="style_label_offset_x" class="w3-col s3">' + t('offset X') + '</label>',
        '  <input type="number" id="style_label_offset_x" name="style.label.offset.x" value="' + labelOffsetX + '" class="w3-col s3 edit-value" step="1">',
        '  <label for="style_label_offset_y" class="w3-col s3">' + t('offset Y') + '</label>',
        '  <input type="number" id="style_label_offset_y" name="style.label.offset.y" value="' + labelOffsetY + '" class="w3-col s3 edit-value" step="1">',
        '</div>'
      );
    }

    if (!option.flock) {
      html.push(
        '<div class="w3-row">',
        '  <textarea id="description_body" name="description.body" class="w3-col s12 edit-value" rows="' + rowcount(value || '') + '">' + (value || '') + '</textarea>',
        '</div>',
        '<hr>'
      );
    }

    if ('Content' === node.type && !option.flock) {
      html.push(
        '<div class="w3-row">',
        '  <label for="resource_uri" class="w3-col s2">URL:</label>',
        '  <input type="text" id="resource_uri" name="resource.uri" class="w3-col s10 edit-value"',
        storagePathAttrs + ' value="' + getEditableResourceUri(node) + '">',
        '</div>',

        '<div class="w3-row">',
        '  <label for="resource_kind" class="w3-col s6">' + t('Media type') + '</label>',
        selectOptions('resource.kind',
          getMediaKindValue(node),
          [
            { value: '', label: 'auto' },
            { value: 'webpage', label: 'webpage' },
            { value: 'document', label: 'document' },
            { value: 'image', label: 'image' },
            { value: 'video', label: 'video' },
            { value: 'audio', label: 'audio' }
          ],
          null,
          's6'),
        '</div>',

        '<div class="w3-row">',
        '  <label for="resource_contents_pageMin" class="w3-col s5">' + t('Page min') + '</label>',
        '  <input type="number" id="resource_contents_pageMin" name="resource.contents.pageMin" class="w3-col s7 edit-value"',
        ' min="1" step="1" value="' + getResourceContentsValue(node, 'pageMin') + '">',
        '</div>',

        '<div class="w3-row">',
        '  <label for="resource_contents_pageMax" class="w3-col s5">' + t('Page max') + '</label>',
        '  <input type="number" id="resource_contents_pageMax" name="resource.contents.pageMax" class="w3-col s7 edit-value"',
        ' min="1" step="1" value="' + getResourceContentsValue(node, 'pageMax') + '">',
        '</div>',

        '<div class="w3-row">',
        '  <label for="thumbnailUri" class="w3-col s5">' + t('THUMBNAIL') + '</label>',
        '  <input type="text" id="thumbnailUri" name="resource.thumbnailUri" class="w3-col s7 edit-value"',
        storagePathAttrs + ' value="' + getEditableThumbnailUri(node) + '">',
        '</div>',

        '<div class="w3-row">',
        '  <label for="resource_rights_attribution" class="w3-col s5">' + t('Credit') + '</label>',
        '  <input type="text" id="resource_rights_attribution" name="resource.rights.attribution" class="w3-col s7 edit-value"',
        ' value="' + ((node.resource && node.resource.rights && node.resource.rights.attribution) || '') + '">',
        '</div>',

        '<div class="w3-row">',
        '  <label for="resource_rights_license" class="w3-col s5">' + t('License') + '</label>',
        '  <input type="text" id="resource_rights_license" name="resource.rights.license" class="w3-col s7 edit-value"',
        ' value="' + ((node.resource && node.resource.rights && node.resource.rights.license) || '') + '">',
        '</div>'
      );
    }

    html.push(
      '<div class="w3-row" style="display:' + ('MEMO' === shape ? 'none' : 'block') + '">',
      '  <label for="shape" class="w3-col s5">' + t('Shape') + '</label>',
      selectOptions('shape', shape, shapes, '' + t('Shape'),'s7'),
      '</div>',

      '<div class="w3-row" id="radius" style="display:' + ('CIRCLE' === shape ? 'block' : 'none') + '">',
      '  <label for="size_radius" class="w3-col s4">' + t('Radius') + '</label>',
      '  <input type="number" id="size_radius" name="size.radius" value="' + (node.size && node.size.radius) + '" class="w3-col s8 edit-value">',
      '</div>',

      '<div class="w3-row" id="width-height" style="display:' + ('CIRCLE' === shape ? 'none' : 'block') + '">',
      '  <label for="size_width" class="w3-col s2">' + t('Width') + '</label>',
      '  <input type="number" id="size_width" name="size.width" value="' + (node.size && node.size.width) + '" class="w3-col s4 edit-value">',
      '  <label for="size_height" class="w3-col s2">' + t('Height') + '</label>',
      '  <input type="number" id="size_height" name="size.height" value="' + (node.size && node.size.height) + '" class="w3-col s4 edit-value">',
      '</div>'
    );

    if ('Memo' === node.type) {
      html.push(
        '<div class="w3-row">',
        '  <label for="style_memo_corner" class="w3-col s5">' + t('Folded corner') + '</label>',
        selectOptions('style.memo.corner',
          memoCorner,
          [
            { value: 'bottom-right', label: 'BOTTOM_RIGHT' },
            { value: 'bottom-left', label: 'BOTTOM_LEFT' },
            { value: 'top-left', label: 'TOP_LEFT' },
            { value: 'top-right', label: 'TOP_RIGHT' }
          ],
          null,
          's7'),
        '</div>'
      );
    }

    html.push(
      '<div class="w3-row">',
      '  <label for="style_fill" class="w3-col s4">' + t('Background') + '</label>',
      '  <input type="color" id="style_fill" name="style.fill" value="' + (style.fill) + '" class="w3-col s4 pointer edit-value">',
      '  <div id="style_fill_palette" name="style_fill_palette" class="w3-col s4 pointer"></div>',
      '</div>',

      '<div class="w3-row">',
      '  <label for="style_font_color" class="w3-col s3">' + t('Text') + '</label>',
      '  <input type="color" id="style_font_color" name="style.font.color" value="' + (font && font.color) + '" class="w3-col s3 pointer edit-value">',
      '  <div id="style_font_color_palette" name="style_font_color_palette" class="w3-col s3 pointer"></div>',
      selectOptions('style.font.size', fontSizeValue, fontSizes, 'Select font size', 's3'),
      '</div>'
    );

    if ('Topic' === node.type && !option.flock) {
      html.push(
        '<div class="w3-row">',
        '  <label for="applyToGroup" class="w3-col s10">' + t('Apply to all group members') + '</label>',
        '  <input type="checkbox" id="applyToGroup" name="applyToGroup" class="w3-col s2" ' + ((option && option.applyToGroup) ? 'checked' : '') + '>',
        '</div>'
      );
    }

    html.push('</form>');

    return html.join('\n');
  };

  function labelAlignIcons(value, size) {
    value = String(value || 'center').toLowerCase();
    return [
      '<div class="nFont_text-anchor w3-col ' + (size || 's8') + '">',
      '  <i class="nFont_text-anchor start fas fa-align-left ' + (('left' === value) ? 'checked' : '') + '" title="left"></i>',
      '  <i class="nFont_text-anchor middle fas fa-align-center ' + (('center' === value) ? 'checked' : '') + '" title="center"></i>',
      '  <i class="nFont_text-anchor end fas fa-align-right ' + (('right' === value) ? 'checked' : '') + '" title="right"></i>',
      '</div>'
    ].join('');
  }

  function selectOptions(name, value, options, placeholder, size) {
    return wuwei.edit.markup.selectOptions(name, value, options, placeholder, size);
  }

  function rowcount(str) {
    return wuwei.edit.markup.rowcount(str);
  }

  function t(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
}());
// edit.generic.markup.js last updated 2026-03-26
