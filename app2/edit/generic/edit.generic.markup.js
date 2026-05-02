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
    var anchor;
    if (align) {
      return String(align).toLowerCase();
    }
    anchor = node && node.font && node.font['text-anchor'];
    if ('start' === anchor) { return 'left'; }
    if ('end' === anchor) { return 'right'; }
    return 'center';
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
    var uri = (node && (node.thumbnailUri || node.thumbnail)) || '';
    if (wuwei.util && typeof wuwei.util.getResourceFilePath === 'function' &&
      node && node.resource) {
      uri = wuwei.util.getResourceFilePath(node.resource, 'thumbnail', node) || uri;
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
      (resource && resource.origin && resource.origin.type === 'upload') ||
      node && node.option === 'upload'
    );
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
      font = (node.style && node.style.font) || node.font || {},
      line = (node.style && node.style.line) || {},
      value = ((node.description && typeof node.description.body === 'string')
        ? node.description.body
        : ''),
      option = param.option || {};
    var fontAlign = getFontAlign(node);
    var fontSizeValue = normalizeFontSizeValue(font && font.size);
    var memoStyle = (style && style.memo && typeof style.memo === 'object') ? style.memo : {};
    var memoCorner = memoStyle.corner || 'bottom-right';
    var storagePathAttrs = isManagedResourceNode(node) ? ' readonly aria-readonly="true"' : '';
    var html = [];

    html.push(
      '<form id="editform" class="generic form-group content" onsubmit="return false;">'
    );

    if (!(node && 'Memo' === node.type)) {
      if (!option.flock) {
        html.push(
          '<div class="w3-row">',
          '  <textarea id="rName" name="label" data-path="label" class="w3-col s12" rows="' + rowcount(label) + '" ',
          '      placeholder="' + translate('Label') + '">' + label + '</textarea>',
          '</div>',
          '<div class="nFont_text-anchor w3-row">',
          '  <i class="nFont_text-anchor start fas fa-align-left ' + (('left' === fontAlign) ? 'checked' : '') + '"></i>',
          '  <i class="nFont_text-anchor middle fas fa-align-center ' + (('center' === fontAlign) ? 'checked' : '') + '"></i>',
          '  <i class="nFont_text-anchor end fas fa-align-right ' + (('right' === fontAlign) ? 'checked' : '') + '"></i>',
          '</div>'
        );
      }
    }

    if (!option.flock) {
      html.push(
        '<div class="w3-row">',
        '  <textarea id="rValue" name="description.body" data-path="description.body" class="w3-col s12" rows="' + rowcount(value || '') + '">' + (value || '') + '</textarea>',
        '</div>',
        (node && (node.topicKind === 'contents-page' || option.entry)
          ? '<div class="w3-row">' +
            '  <label for="contentsPageNumber" class="w3-col s4">&#12506;&#12540;&#12472;&#30058;&#21495;:</label>' +
            '  <input type="text" id="contentsPageNumber" name="pageNumber" data-path="pageNumber" class="w3-col s8" value="' + (node.pageNumber || '') + '">' +
            '</div>'
          : ''),
        '<hr>'
      );
    }

    if ('Content' === node.type && !option.flock) {
      html.push(
        '<div class="w3-row">',
        '  <label for="rUri" class="w3-col s2">URL:</label>',
        '  <input type="text" id="rUri" name="resource.uri" data-path="resource.uri" class="w3-col s10"',
        storagePathAttrs + ' value="' + getEditableResourceUri(node) + '">',
        '</div>',

        '<div class="w3-row">',
        '  <label for="resource_kind" data-path="resource.kind" class="w3-col s6">' + translate('Media type') + '</label>',
        selectOptions('resource_kind',
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
          's6').replace('name="resource_kind"', 'name="resource.kind" '),
        '</div>',

        '<div class="w3-row">',
        '  <label for="thumbnailUri" class="w3-col s5">' + translate('THUMBNAIL') + '</label>',
        '  <input type="text" id="thumbnailUri" name="thumbnailUri" data-path="thumbnailUri" class="w3-col s7"',
        storagePathAttrs + ' value="' + getEditableThumbnailUri(node) + '">',
        '</div>',

        '<div class="w3-row">',
        '  <label for="resourceRightsAttribution" class="w3-col s5">' + translate('Credit') + '</label>',
        '  <input type="text" id="resourceRightsAttribution" name="resource.rights.attribution" data-path="resource.rights.attribution" class="w3-col s7"',
        ' value="' + ((node.resource && node.resource.rights && node.resource.rights.attribution) || (node.resource && node.resource.attribution) || '') + '">',
        '</div>',

        '<div class="w3-row">',
        '  <label for="resourceRightsLicense" class="w3-col s5">' + translate('License') + '</label>',
        '  <input type="text" id="resourceRightsLicense" name="resource.rights.license" data-path="resource.rights.license" class="w3-col s7"',
        ' value="' + ((node.resource && node.resource.rights && node.resource.rights.license) || (node.resource && node.resource.license) || '') + '">',
        '</div>'
      );
    }

    html.push(
      '<div class="w3-row" style="display:' + ('MEMO' === shape ? 'none' : 'block') + '">',
      '  <label for="shape" class="w3-col s5">' + translate('Shape') + '</label>',
      selectOptions('shape', shape, shapes, '' + translate('Shape'),'s7').replace('name="shape"', 'name="shape" data-path="shape"'),
      '</div>',

      '<div class="w3-row" id="radius" style="display:' + ('CIRCLE' === shape ? 'block' : 'none') + '">',
      '  <label for="size_radius" class="w3-col s4">' + translate('Radius') + '</label>',
      '  <input type="number" id="size_radius" name="size.radius" data-path="size.radius" value="' + (node.size && node.size.radius) + '" class="w3-col s8">',
      '</div>',

      '<div class="w3-row" id="width-height" style="display:' + ('CIRCLE' === shape ? 'none' : 'block') + '">',
      '  <label for="size_width" class="w3-col s2">' + translate('Width') + '</label>',
      '  <input type="number" id="size_width" name="size.width" data-path="size.width" value="' + (node.size && node.size.width) + '" class="w3-col s4">',
      '  <label for="size_height" class="w3-col s2">' + translate('Height') + '</label>',
      '  <input type="number" id="size_height" name="size.height" data-path="size.height" value="' + (node.size && node.size.height) + '" class="w3-col s4">',
      '</div>'
    );

    if ('Memo' === node.type) {
      html.push(
        '<div class="w3-row">',
        '  <label for="style_memo_corner" class="w3-col s5">折り返し角</label>',
        selectOptions('style_memo_corner',
          memoCorner,
          [
            { value: 'bottom-right', label: 'BOTTOM_RIGHT' },
            { value: 'bottom-left', label: 'BOTTOM_LEFT' },
            { value: 'top-left', label: 'TOP_LEFT' },
            { value: 'top-right', label: 'TOP_RIGHT' }
          ],
          null,
          's7').replace('name="style_memo_corner"', 'name="style.memo.corner" data-path="style.memo.corner"'),
        '</div>'
      );
    }

    if ('Topic' === node.type && node.text) {
      html.push(
        '<div class="w3-row" id="text_position">',
        '  <label for="text_position" class="w3-col s4">' + translate('Text position') + '</label>',
        selectOptions('text_position', node.text.position, positions, 'Select text position').replace('name="text_position"', 'name="text.position" data-path="text.position"'),
        '</div>',
        '<div class="w3-row" id="text_width-height">',
        '  <label for="text_width" class="w3-col s2">' + translate('Width') + '</label>',
        '  <input type="number" id="text_width" name="text.width" data-path="text.width" value="' + node.text.width + '" class="w3-col s4">',
        '  <label for="text_height" class="w3-col s2">' + translate('Height') + '</label>',
        '  <input type="number" id="text_height" name="text.height" data-path="text.height" value="' + node.text.height + '" class="w3-col s4">',
        '</div>'
      );
    }

    html.push(
      '<div class="w3-row">',
      '  <label for="style_fill" class="w3-col s4">' + translate('Background') + '</label>',
      '  <input type="color" id="style_fill" name="style.fill" data-path="style.fill" value="' + (style.fill) + '" class="w3-col s4 pointer">',
      '  <div id="style_fill_palette" name="style_fill_palette" class="w3-col s4 pointer"></div>',
      '</div>',

      '<div class="w3-row">',
      '  <label for="nFont_color" class="w3-col s3">' + translate('Text') + '</label>',
      '  <input type="color" id="nFont_color" name="style.font.color" data-path="style.font.color" value="' + (font && font.color) + '" class="w3-col s3 pointer">',
      '  <div id="style_font_color" name="style_font_color" class="w3-col s3 pointer"></div>',
      selectOptions('nFont_size', fontSizeValue, fontSizes, 'Select font size', 's3').replace('name="nFont_size"', 'name="style.font.size" data-path="style.font.size"'),
      '</div>'
    );

    if ('Topic' === node.type && !option.flock) {
      html.push(
        '<div class="w3-row">',
        '  <label for="applyToGroup" class="w3-col s10">グループに一括適用</label>',
        '  <input type="checkbox" id="applyToGroup" name="applyToGroup" class="w3-col s2" ' + ((option && option.applyToGroup) ? 'checked' : '') + '>',
        '</div>'
      );
    }

    html.push('</form>');

    return html.join('\n');
  };

  function selectOptions(name, value, options, placeholder, size) {
    return wuwei.edit.markup.selectOptions(name, value, options, placeholder, size);
  }

  function rowcount(str) {
    return wuwei.edit.markup.rowcount(str);
  }

  function translate(str) {
    return wuwei.edit.markup.translate(str);
  }

  return {
    template: template
  };
}());
// edit.generic.markup.js last updated 2026-03-26
