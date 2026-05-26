/**
 * edit.video.markup.js
 * wuwei edit.video template
 * 
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.video = wuwei.edit.video || {};
wuwei.edit.video.markup = (function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  
  function t(str) {
    return wuwei.nls.translate(str)
  }

  function isLoadFileRuntimeUrl(value) {
    return /(?:^|\/)(?:cgi-bin|server)\/load-file\.(?:py|cgi)\?/i.test(String(value || ''));
  }

  function getUrlHash(value) {
    var s = String(value || '');
    var index = s.indexOf('#');
    return index >= 0 ? s.slice(index) : '';
  }

  function editableResourceUrl(value) {
    var s = String(value || '').trim();
    var match;

    if (!s || !isLoadFileRuntimeUrl(s)) {
      return s;
    }

    match = s.match(/[?&]path=([^&#]*)/);
    if (!match) { return s; }
    try { return decodeURIComponent(match[1]) + getUrlHash(s); }
    catch (e) { return match[1].replace(/%2F/ig, '/') + getUrlHash(s); }
  }

  function selectOptions(name, value, options, placeholder, size) {
    return wuwei.edit.markup.selectOptions(name, value, options, placeholder, size);
  }
  function normalizeFontSizeValue(value) {
    if (value == null || value === '' || Number(value) === 14) { return '12pt'; }
    if ('number' === typeof value || /^\d+(\.\d+)?$/.test(String(value))) { return String(value) + 'pt'; }
    return String(value);
  }

  function getFontAlign(node) {
    var align = node && node.style && node.style.font && node.style.font.align;
    return align ? String(align).toLowerCase() : 'center';
  }
  function getMediaKindValue(resource) {
    const kind = String(resource && resource.kind || '').toLowerCase();
    const mimeType = String(resource && resource.mimeType || '').toLowerCase();
    if (kind === 'video' || mimeType.indexOf('video/') === 0) { return 'video'; }
    if (kind === 'audio' || mimeType.indexOf('audio/') === 0) { return 'audio'; }
    if (kind === 'image' || mimeType.indexOf('image/') === 0) { return 'image'; }
    if (kind === 'document') { return 'document'; }
    if (resource && resource.documentKind === 'html') { return 'webpage'; }
    return kind || '';
  }

  function formatSeconds(sec) {
    sec = Math.max(0, Number(sec) || 0);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function getDurationValue(resource, durationStr) {
    var media = resource && resource.media && typeof resource.media === 'object' ? resource.media : {};
    var values = [
      media.durationSeconds,
      media.duration,
      resource && resource.duration
    ];
    for (var i = 0; i < values.length; i += 1) {
      var n = Number(values[i]);
      if (Number.isFinite(n) && n > 0) {
        return formatSeconds(n);
      }
    }
    return durationStr || '';
  }

  function rowcount(value) {
    return wuwei.edit.markup.rowcount(value || '');
  }

  function readonlyRow(id, label, value, labelSize, valueSize) {
    return [
      '<div class="w3-row">',
      '  <label for="' + id + '" class="w3-col ' + (labelSize || 's5') + '">' + t(label) + '</label>',
      '  <input type="text" id="' + id + '" class="w3-col ' + (valueSize || 's7') + '" readonly aria-readonly="true" value="' + escapeHtml(value || '') + '">',
      '</div>'
    ].join('\n');
  }

  function isRemoteResource(resource) {
    resource = resource && typeof resource === 'object' ? resource : {};
    return String(resource.source || '').toLowerCase() === 'remote' ||
      !!(resource.original && String(resource.original.type || '').toLowerCase() === 'remote') ||
      (!!resource.uri && /^https?:\/\//i.test(String(resource.uri || '')));
  }

  function editableTextRow(id, label, value, labelSize, valueSize, placeholder) {
    return [
      '<div class="w3-row">',
      '  <label for="' + id + '" class="w3-col ' + (labelSize || 's5') + '">' + t(label) + '</label>',
      '  <input type="text" id="' + id + '" name="' + String(id || '').replace(/_/g, '.') + '" class="w3-col ' + (valueSize || 's7') + ' edit-value" value="' + escapeHtml(value || '') + '"' + (placeholder ? (' placeholder="' + escapeHtml(placeholder) + '"') : '') + '>',
      '</div>'
    ].join('\n');
  }

  function resourceTextRow(resource, id, label, value, labelSize, valueSize, placeholder) {
    return isRemoteResource(resource)
      ? editableTextRow(id, label, value, labelSize, valueSize, placeholder)
      : readonlyRow(id, label, value, labelSize, valueSize);
  }

  function thumbnailUriInputRow(node, value) {
    var visible = String(node && node.shape || '').toUpperCase() === 'THUMBNAIL';
    value = editableResourceUrl(value);
    return [
      '<div class="w3-row thumbnail-uri-row" style="display:' + (visible ? 'block' : 'none') + ';">',
      '  <label for="resource_thumbnailUri" class="w3-col s5">' + t('URL:') + '</label>',
      '  <input type="text" id="resource_thumbnailUri" name="resource.thumbnailUri" class="w3-col s7 edit-value" value="' + escapeHtml(value || '') + '" placeholder="' + escapeHtml('https://... or upload path') + '">',
      '</div>'
    ].join('\n');
  }


  function getThumbnailUrl(node, resource) {
    resource = resource || {};
    if (wuwei.resource && typeof wuwei.resource.getThumbnailUrl === 'function') {
      return editableResourceUrl(wuwei.resource.getThumbnailUrl(node) || '');
    }
    if (wuwei.util && typeof wuwei.util.getResourceThumbnailUri === 'function') {
      return editableResourceUrl(wuwei.util.getResourceThumbnailUri(node) || '');
    }
    return editableResourceUrl(resource.thumbnailUri || resource.thumbnailUrl || '');
  }

  function videoPreviewHtml(node) {
    var template = wuwei.menu && wuwei.menu.video && wuwei.menu.video.template;
    var source = wuwei.video && typeof wuwei.video.detectSource === 'function'
      ? wuwei.video.detectSource(node)
      : { provider: 'unknown' };
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var title = node && (node.label || resource.title || resource.uri || 'video');
    var html = '';

    if (!template) {
      return '';
    }
    if (source.provider === 'youtube' && source.id) {
      html = template.iframe({
        src: 'https://www.youtube.com/embed/' + encodeURIComponent(source.id) + '?rel=0&playsinline=1',
        title: title,
        className: 'edit-video-content-frame'
      });
    }
    else if (source.provider === 'vimeo' && source.id) {
      html = template.iframe({
        src: 'https://player.vimeo.com/video/' + encodeURIComponent(source.id) +
          (source.h ? ('?h=' + encodeURIComponent(source.h)) : ''),
        title: title,
        className: 'edit-video-content-frame'
      });
    }
    else if (source.provider === 'html5') {
      html = template.nativeVideo({
        src: source.src || source.url,
        mimeType: resource.mimeType || 'video/mp4',
        poster: wuwei.util && typeof wuwei.util.getResourceThumbnailUri === 'function'
          ? wuwei.util.getResourceThumbnailUri(node)
          : '',
        className: 'edit-video-content-native'
      });
    }
    if (!html) {
      return '';
    }
    return [
      '<div class="edit-video-content-preview">',
      '  <label class="w3-col s12">' + t('Video preview') + '</label>',
      '  <div class="edit-video-content-preview-host">' + html + '</div>',
      '</div>'
    ].join('\n');
  }

  function contentRows(resource, node, param) {
    var media = (resource && resource.media && typeof resource.media === 'object') ? resource.media : {};
    var durationText = getDurationValue(resource, param && param.durationStr);
    return [
      videoPreviewHtml(node),
      readonlyRow('resource_source', 'Source', resource.source || ''),
      readonlyRow('resource_kind', 'Media type', resource.kind || getMediaKindValue(resource) || ''),
      resourceTextRow(resource, 'resource_videoKind', 'Video kind', resource.videoKind || '', 's5', 's7', 'youtube / vimeo / mp4'),
      resourceTextRow(resource, 'resource_title', 'Title', resource.title || ''),
      readonlyRow('resource_mimeType', 'MIME', resource.mimeType || ''),
      resourceTextRow(resource, 'resource_uri', 'URL:', editableResourceUrl(resource.uri || (resource.original && resource.original.url) || ''), 's5', 's7', 'https://...'),
      readonlyRow('resource_media_provider', 'Provider', media.provider || ''),
      readonlyRow('resource_media_videoId', 'Video ID', media.videoId || ''),
      readonlyRow('resource_media_duration', 'Duration', durationText)
    ].join('\n');
  }

  function rightsRows(resource) {
    var rights = (resource && resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    return [
      readonlyRow('resource_rights_source_title', 'Title', resource.title || ''),
      readonlyRow('resource_rights_source_uri', 'URL:', editableResourceUrl(resource.uri || '')),
      readonlyRow('resource_rights_source_canonicalUri', 'Canonical URI', editableResourceUrl(resource.canonicalUri || '')),
      '<div class="w3-row">',
      '  <label for="resource_rights_owner" class="w3-col s5">' + t('Owner') + '</label>',
      '  <input type="text" id="resource_rights_owner" name="resource.rights.owner" class="w3-col s7 edit-value" value="' + escapeHtml(rights.owner || '') + '">',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_copyright" class="w3-col s12">' + t('Copyright') + '</label>',
      '  <textarea id="resource_rights_copyright" name="resource.rights.copyright" class="w3-col s12 edit-value" rows="' + rowcount(rights.copyright || '') + '">' + escapeHtml(rights.copyright || '') + '</textarea>',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_license" class="w3-col s5">' + t('License') + '</label>',
      '  <input type="text" id="resource_rights_license" name="resource.rights.license" class="w3-col s7 edit-value" value="' + escapeHtml(rights.license || '') + '">',
      '</div>',
      '<div class="w3-row">',
      '  <label for="resource_rights_attribution" class="w3-col s12">' + t('Attribution') + '</label>',
      '  <textarea id="resource_rights_attribution" name="resource.rights.attribution" class="w3-col s12 edit-value" rows="' + rowcount(rights.attribution || '') + '">' + escapeHtml(rights.attribution || '') + '</textarea>',
      '</div>'
    ].join('\n');
  }

  function tabbedPaneHtml(tabs) {
    return [
      '<div class="edit-tabbed-pane">',
      '<div class="w3-bar w3-light-grey edit-tab-buttons">',
      tabs.map(function (tab, index) {
        return '<button type="button" class="w3-button w3-small edit-tab-button' + (index ? '' : ' active w3-blue') + '" data-edit-tab="' + tab.id + '">' + escapeHtml(t(tab.label)) + '</button>';
      }).join('\n'),
      '</div>',
      tabs.map(function (tab, index) {
        return '<div class="edit-tab-panel" data-edit-tab-panel="' + tab.id + '" style="display:' + (index ? 'none' : 'block') + ';">' + tab.html + '</div>';
      }).join('\n'),
      '</div>'
    ].join('\n');
  }

  const template = function (param) {
    let node = param.node;
    let resource = (node && node.resource && typeof node.resource === 'object')
      ? node.resource
      : (param.resource || {});
    if (!resource) return '';
    const common = wuwei.common;
    const shapes = common.shapes;
    const fontSizes = common.fontSizes;
    const style = node && node.style ? node.style : {};
    const font = (node && node.style && node.style.font) || (node && node.font) || {};
    const fontSizeValue = normalizeFontSizeValue(font && font.size);
    const fontAlign = getFontAlign(node);
    const resourceUri = resource.canonicalUri || editableResourceUrl(resource.uri || '');
    const description = node && node.description;
    const value = (description && typeof description.body === 'string') ? description.body : '';
    const title = (node && node.label) || resource.title || resourceUri || 'Video';
    var html = [];
    var displayHtml = [];
    displayHtml.push('<div class="edit">',
      wuwei.edit.style.markup.labelRows({
        label: title,
        align: fontAlign,
        labelSize: 's4',
        alignLabel: 'Label align',
        alignSize: 's8'
      }),
      wuwei.edit.style.markup.descriptionRows({
        node: node,
        format: (description && description.format) || 'plain/text',
        body: value
      }))
    if (node) {
      displayHtml.push(
        wuwei.edit.style.markup.shapeSizeRows({
          shape: node.shape,
          size: node.size,
          options: shapes
        }),
        thumbnailUriInputRow(node, getThumbnailUrl(node, resource)),
        wuwei.edit.style.markup.paintRows({
          style: style,
          fontSize: fontSizeValue,
          fillPaletteId: 'style_fill_palette',
          fontPaletteId: 'style_font_color_palette'
        })
      );
    }
    displayHtml.push('</div>');
    html.push(
      '<form id="editform" class="video form-group content" onsubmit="return false;">',
      tabbedPaneHtml([
        { id: 'display', label: 'Display', html: displayHtml.join('') },
        { id: 'content', label: '_Content', html: contentRows(resource, node, param) },
        { id: 'rights', label: 'Source / Rights', html: rightsRows(resource) }
      ]),
      '</form>'
    );
    return html.join('');
  };
  return { template: template };
})();
