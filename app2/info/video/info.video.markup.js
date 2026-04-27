/**
 * info.video.markup.js
 * wuwei info.video template (hosted video aware, Vimeo refusal tolerant)
 * 
 * WuWei is a free, open-source knowledge modelling tool.
 * - HTML5: <video>
 * - YouTube / Vimeo: iframe preview
 * - Vimeo may reject embedding depending on privacy settings; therefore
 *   the pane always shows Open player / Open in new tab fallback actions.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.info = wuwei.info || {};
wuwei.info.video = wuwei.info.video || {};

wuwei.info.video.markup = (function () {
  'use strict';

  var
    template,
    escapeHtml,
    escapeAttr,
    rowcount,
    translate;

  template = function (param) {
    var
      node = param.node,
      provider = param.provider || 'html5',
      src = param.src || '',
      rawUrl = param.rawUrl || '',
      embedUrl = param.embedUrl || '',
      start = (param.start != null) ? param.start : 0,
      end = (param.end != null) ? param.end : null,
      duration = (param.duration != null) ? param.duration : null,
      description,
      fontSize,
      title,
      fmt,
      startStr,
      endStr,
      previewHtml,
      hostedHint;

    description = node && node.description && typeof node.description.body === 'string'
      ? node.description.body
      : '';
    fontSize = node && node.font && node.font.size ? node.font.size : 'M';

    title = (node && node.label)
      ? node.label
      : rawUrl
        ? rawUrl
        : 'Video';

    fmt = (wuwei.info.video && typeof wuwei.info.video.formatSeconds === 'function')
      ? wuwei.info.video.formatSeconds
      : function (x) { return String(x); };

    startStr = fmt(start);
    endStr = (end == null || end === '')
      ? ((duration != null && duration > 0) ? fmt(duration) : '')
      : fmt(end);

    if ('html5' === provider) {
      previewHtml =
        '<video id="infoVideoPlayer" controls playsinline preload="metadata" src="' +
        encodeURI(src) + '"></video>';
    }
    else if ('youtube' === provider || 'vimeo' === provider) {
      previewHtml = embedUrl
        ? '<iframe id="infoVideoFrame" src="' + escapeAttr(embedUrl) + '" ' +
        'frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>'
        : '<div class="video-preview-error">' +
        escapeHtml(translate('Preview is unavailable in the info pane.')) +
        '</div>';
    }
    else {
      previewHtml =
        '<div class="video-preview-error">' +
        escapeHtml(translate('Unsupported video source.')) +
        '</div>';
    }

    hostedHint = ('html5' === provider)
      ? ''
      : '<div id="infoVideoHostedHint" class="hosted-hint" ' +
      'style="margin-top:8px; font-size:0.9em; opacity:0.8;">' +
      escapeHtml(translate('Hosted video preview may be blocked. Use Open player or open in a new tab.')) +
      '</div>';

    html = [];
    html.push(
      '<div class="info">',
      '<div>',
      '<h5 id="rName" name="label" data-path="label" rows="' + rowcount(title) + '">' + escapeHtml(title) + '</h5>',
      '</div>'
    );
    html.push(
      '<div class="frame ' + (provider !== 'html5' ? 'hosted' : '') + '">',
      previewHtml,
      '</div>'
    );
    html.push(
      '<div class="controls">',
      '<label class="label">' + translate('clip range') + ':</label>',
      '<div class="time-inputs">',
      '<input id="infoVideoStart" name="timeRange.start" data-path="timeRange.start" type="text" value="' + escapeAttr(startStr) + '" placeholder="start 00:01:23.5" />',
      '<input id="infoVideoEnd" name="timeRange.end" data-path="timeRange.end" type="text" value="' + escapeAttr(endStr) + '" placeholder="end (optional) 00:02:10" />',
      '</div>',
      '</div>'
    );

    html.push(
      '<div class="w3-container font-size-' + escapeAttr(fontSize) + '">',
      '<!--Card content-->',
      description
        ? '<p class="value">' + wuwei.util.encodeHtml(String(description).replace(/\\n/g, '\n')) + '</p>'
        : '',
      '</div>',
      hostedHint,
      '<span class="player w3-row" onclick="wuwei.info.video.openModal()">',
      translate('Open player') + ' <i class="fas fa-external-link-alt"></i>',
      '</span>'
    );
    html.push(
      ((provider !== 'html5' && rawUrl)
        ? '<span class="player w3-row" onclick="wuwei.info.video.openNewTab()">' +
            translate('Open in new tab') + ' <i class="fas fa-external-link-alt"></i>' +
          '</span>'
        : ''),
      '</div>'
    );

    return html.join('');
  };

  escapeHtml = function (s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  escapeAttr = function (s) {
    return escapeHtml(s).replace(/`/g, '&#96;');
  };

  rowcount = function (str) {
    return wuwei.edit.markup.rowcount(str);
  };

  translate = function (str) {
    return (wuwei.nls && typeof wuwei.nls.translate === 'function')
      ? wuwei.nls.translate(str)
      : str;
  };

  return {
    template: template
  };
})();
// info.video.markup.js last modified 2026-04-06
