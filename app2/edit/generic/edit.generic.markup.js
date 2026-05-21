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
    var resource = node && node.resource || {};
    var uri = String(resource.uri || resource.canonicalUri || '');

    if (!uri && wuwei.util && typeof wuwei.util.getResourceOriginalPath === 'function') {
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
    var uri = '';
    if (wuwei.util && typeof wuwei.util.getResourceFilePath === 'function' &&
      node && node.resource) {
      uri = wuwei.util.getResourceFilePath(node.resource, 'thumbnail', node) || '';
    }
    if (!uri) {
      uri = String(node && node.resource && node.resource.thumbnailUri || '');
    }
    if (wuwei.util && typeof wuwei.util.toStorageRelativePath === 'function' &&
      (/^(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || '')) ||
        /\/(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(uri || '')) ||
        /^\/?(upload|resource|note|thumbnail|content)\//.test(String(uri).replace(/^.*\/wu_wei2\//, '')) ||
        /\/(upload|resource|note|thumbnail|content)\//.test(String(uri || '')))) {
      uri = wuwei.util.toStorageRelativePath(uri, null, '');
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

  function readonlyRow(id, label, value, labelSize, valueSize) {
    return [
      '<div class="w3-row">',
      '  <label for="' + id + '" class="w3-col ' + (labelSize || 's5') + '">' + t(label) + '</label>',
      '  <input type="text" id="' + id + '" class="w3-col ' + (valueSize || 's7') + '" readonly aria-readonly="true" value="' + esc(value || '') + '">',
      '</div>'
    ].join('\n');
  }

  function contentReadonlyRows(node) {
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var contents = (resource.contents && typeof resource.contents === 'object') ? resource.contents : {};
    return [
      readonlyRow('resource_source', 'Source', resource.source || ''),
      readonlyRow('resource_kind', 'Media type', resource.kind || ''),
      readonlyRow('resource_documentKind', 'Document kind', resource.documentKind || ''),
      readonlyRow('resource_videoKind', 'Video kind', resource.videoKind || ''),
      readonlyRow('resource_title', 'Title', resource.title || ''),
      readonlyRow('resource_mimeType', 'MIME', resource.mimeType || ''),
      readonlyRow('resource_uri', 'URL:', resource.uri || ''),
      readonlyRow('resource_canonicalUri', 'Canonical URI', resource.canonicalUri || ''),
      readonlyRow('thumbnailUri', 'THUMBNAIL', getEditableThumbnailUri(node)),
      '<div class="w3-row">',
      '  <label for="resource_contents_pageOffset" class="w3-col s5">' + t('Page offset') + '</label>',
      '  <input type="number" id="resource_contents_pageOffset" name="resource.contents.pageOffset" class="w3-col s7 edit-value" step="1" value="' + esc(contents.pageOffset == null ? '' : contents.pageOffset) + '">',
      '</div>',
      readonlyRow('resource_contents_pageCount', 'Page count', contents.pageCount == null ? '' : contents.pageCount),
      readonlyRow('resource_contents_pageMin', 'Page min', contents.pageMin == null ? '' : contents.pageMin),
      readonlyRow('resource_contents_pageMax', 'Page max', contents.pageMax == null ? '' : contents.pageMax)
    ].join('\n');
  }

  function contentRightsRows(node) {
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var rights = (resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    return [
      readonlyRow('resource_rights_source_title', 'Title', resource.title || ''),
      readonlyRow('resource_rights_source_uri', 'URL:', resource.uri || ''),
      readonlyRow('resource_rights_source_canonicalUri', 'Canonical URI', resource.canonicalUri || ''),
      '<div class="w3-row">',
      '  <label for="resource_rights_owner" class="w3-col s5">' + t('Owner') + '</label>',
      '  <input type="text" id="resource_rights_owner" name="resource.rights.owner" class="w3-col s7 edit-value" value="' + esc(rights.owner || '') + '">',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_copyright" class="w3-col s12">' + t('Copyright') + '</label>',
      '  <textarea id="resource_rights_copyright" name="resource.rights.copyright" class="w3-col s12 edit-value" rows="' + rowcount(rights.copyright || '') + '">' + esc(rights.copyright || '') + '</textarea>',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_license" class="w3-col s5">' + t('License') + '</label>',
      '  <input type="text" id="resource_rights_license" name="resource.rights.license" class="w3-col s7 edit-value" value="' + esc(rights.license || '') + '">',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_attribution" class="w3-col s12">' + t('Credit') + '</label>',
      '  <textarea id="resource_rights_attribution" name="resource.rights.attribution" class="w3-col s12 edit-value" rows="' + rowcount(rights.attribution || '') + '">' + esc(rights.attribution || '') + '</textarea>',
      '</div>'
    ].join('\n');
  }

  function tabbedPaneHtml(tabs) {
    var buttons = [];
    var panels = [];
    tabs.forEach(function (tab, index) {
      buttons.push(
        '<button type="button" class="w3-button w3-small edit-tab-button' + (index ? '' : ' active w3-blue') + '" data-edit-tab="' + tab.id + '">' +
        esc(t(tab.label)) +
        '</button>'
      );
      panels.push(
        '<div class="edit-tab-panel" data-edit-tab-panel="' + tab.id + '" style="display:' + (index ? 'none' : 'block') + ';">' +
        tab.html +
        '</div>'
      );
    });
    return [
      '<div class="edit-tabbed-pane">',
      '<div class="w3-bar w3-light-grey edit-tab-buttons">',
      buttons.join('\n'),
      '</div>',
      panels.join('\n'),
      '</div>'
    ].join('\n');
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
    var labelStyleWidth = getLabelStyleValue(node, 'width', getDefaultLabelWidth(node));
    var labelStyleLines = getLabelStyleValue(node, 'lines', getDefaultLabelLines());
    var labelOffsetX = getLabelStyleValue(node, 'offset.x', getDefaultLabelOffsetX());
    var labelOffsetY = getLabelStyleValue(node, 'offset.y', getDefaultLabelOffsetY());
    var html = [];
    var displayHtml = [];
    var contentTabs;

    html.push(
      '<form id="editform" class="generic form-group content" onsubmit="return false;">'
    );

    if (!(node && 'Memo' === node.type) && !option.flock) {
      displayHtml.push(wuwei.edit.style.markup.labelRows({
        label: label,
        align: fontAlign,
        labelSize: 's5',
        alignSize: 's7'
      }));
    }

    if ('Memo' !== node.type && (node.label || 'PageMarker' === node.type || 'Segment' === node.type || 'Topic' === node.type || 'Content' === node.type)) {
      displayHtml.push(
        wuwei.edit.style.markup.labelLayoutRows({
          width: labelStyleWidth,
          lines: labelStyleLines,
          offsetX: labelOffsetX,
          offsetY: labelOffsetY
        })
      );
    }

    if (!option.flock) {
      displayHtml.push(
        wuwei.edit.style.markup.descriptionRows({
          node: node,
          format: (node.description && node.description.format) || 'plain/text',
          body: value || ''
        }),
        '<hr>'
      );
    }

    displayHtml.push(
      wuwei.edit.style.markup.shapeSizeRows({
        shape: shape,
        size: node.size,
        options: shapes
      })
    );

    if ('Memo' === node.type) {
      displayHtml.push(
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
        '</div>',
        '<div class="w3-row">',
        '  <label for="style_memo_foldSize" class="w3-col s5">' + t('Fold size') + '</label>',
        '  <input type="number" id="style_memo_foldSize" name="style.memo.foldSize" class="w3-col s7 edit-value" min="0" step="1" value="' + esc(memoStyle.foldSize || 32) + '">',
        '</div>'
      );
    }

    displayHtml.push(
      wuwei.edit.style.markup.paintRows({
        style: style,
        fontSize: fontSizeValue,
        fillPaletteId: 'style_fill_palette',
        fontPaletteId: 'style_font_color_palette'
      })
    );

    if ('Topic' === node.type && !option.flock) {
      displayHtml.push(
        '<div class="w3-row">',
        '  <label for="applyToGroup" class="w3-col s10">' + t('Apply to all group members') + '</label>',
        '  <input type="checkbox" id="applyToGroup" name="applyToGroup" class="w3-col s2" ' + ((option && option.applyToGroup) ? 'checked' : '') + '>',
        '</div>'
      );
    }

    if ('Content' === node.type && !option.flock) {
      contentTabs = [
        { id: 'display', label: 'Display', html: displayHtml.join('\n') },
        { id: 'content', label: 'Content', html: contentReadonlyRows(node) },
        { id: 'rights', label: 'Source / Rights', html: contentRightsRows(node) }
      ];
      html.push(tabbedPaneHtml(contentTabs));
    }
    else {
      html.push(displayHtml.join('\n'));
    }

    html.push('</form>');

    return html.join('\n');
  };

  function selectOptions(name, value, options, placeholder, size) {
    return wuwei.edit.markup.selectOptions(name, value, options, placeholder, size);
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

  function t(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
}());
// edit.generic.markup.js last updated 2026-03-26
