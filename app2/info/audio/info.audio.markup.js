/**
 * info.audio.markup.js
 * wuwei info.audio template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.info = wuwei.info || {};
wuwei.info.audio = wuwei.info.audio || {};

wuwei.info.audio.markup = (function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function t(str) {
    return wuwei.nls.translate(str);
  }

  function rowcount(str) {
    return wuwei.info.markup.rowcount(str || '');
  }

  function shouldRenderDescription(description) {
    var role, format;
    if (!description || typeof description !== 'object') {
      return false;
    }
    if (wuwei.info && typeof wuwei.info.shouldRenderInfoDescription === 'function') {
      return wuwei.info.shouldRenderInfoDescription(description);
    }
    role = String(description.role || 'original').toLowerCase();
    format = String(description.format || 'plain/text').toLowerCase();
    if (role !== 'original') {
      return true;
    }
    return !(format === 'asciidoc' || format === 'adoc' ||
      format === 'markdown' || format === 'md' ||
      format === 'html' || format === 'text/html' ||
      format.indexOf('asciidoc') >= 0 ||
      format.indexOf('markdown') >= 0 ||
      format.indexOf('html') >= 0);
  }

  function renderDescription(description) {
    var format;
    var body;
    var html;
    if (!shouldRenderDescription(description)) {
      return '';
    }
    format = String(description.format || 'plain/text').toLowerCase();
    body = String(description.body || '');
    if (!body.trim()) {
      return '';
    }
    if ((format.indexOf('asciidoc') >= 0 || format === 'adoc') &&
      wuwei.util && typeof wuwei.util.renderAsciiDoc === 'function') {
      try {
        html = wuwei.util.renderAsciiDoc(body, { showtitle: false, allowHtml: true });
      }
      catch (e) {
        html = '';
      }
    }
    if (!html) {
      html = '<p>' + escapeHtml(body).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
    }
    return html;
  }

  function metadataRows(resource, src, durationStr) {
    var rights = (resource && resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    return [
      '<dl class="info-audio-metadata">',
      '<dt>' + t('Source') + '</dt><dd>' + escapeHtml(resource.source || '') + '</dd>',
      '<dt>' + t('Audio kind') + '</dt><dd>' + escapeHtml(resource.audioKind || '') + '</dd>',
      '<dt>' + t('MIME') + '</dt><dd>' + escapeHtml(resource.mimeType || '') + '</dd>',
      '<dt>' + t('Runtime URL') + '</dt><dd>' + escapeHtml(src || '') + '</dd>',
      '<dt>' + t('Duration') + '</dt><dd id="infoAudioDuration">' + escapeHtml(durationStr || '') + '</dd>',
      rights.owner ? '<dt>' + t('Owner') + '</dt><dd>' + escapeHtml(rights.owner) + '</dd>' : '',
      rights.license ? '<dt>' + t('License') + '</dt><dd>' + escapeHtml(rights.license) + '</dd>' : '',
      rights.attribution ? '<dt>' + t('Credit') + '</dt><dd>' + escapeHtml(rights.attribution) + '</dd>' : '',
      '</dl>'
    ].join('\n');
  }

  function template(param) {
    var node = param.node;
    var resource = param.resource || {};
    var src = param.src || '';
    var mimeType = resource.mimeType || 'audio/mpeg';
    var title = (node && node.label) ||  src || 'Audio';
    var descriptionHtml = renderDescription(node && node.description);
    var html = [];

    html.push(
      '<div class="info audio-info">',
      '<h5 id="label" rows="' + rowcount(title) + '">' + escapeHtml(title) + '</h5>'
    );
    if (src) {
      html.push(
        '<div class="info-audio-player-host">',
        '<audio id="infoAudioPlayer" class="info-audio-player" controls preload="metadata">',
        '<source src="' + escapeHtml(src) + '" type="' + escapeHtml(mimeType) + '">',
        '</audio>',
        '</div>',
        '<span class="player w3-row" id="infoAudioOpen">' + t('Click to open window') + '<i class="fas fa-external-link-alt"></i></span>'
      );
    }
    html.push(metadataRows(resource, src, param.durationStr));
    if (descriptionHtml) {
      html.push('<div class="w3-container audio-description rich-description">' + descriptionHtml + '</div>');
    }
    html.push('</div>');
    return html.join('\n');
  }

  return { template: template };
})();
// info.audio.markup.js
