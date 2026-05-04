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
    renderDescription,
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
      durationStr,
      previewHtml,
      descriptionHtml,
      html;

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
    durationStr = (duration != null && duration > 0) ? fmt(duration) : '00:00:00';

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

    descriptionHtml = renderDescription(node && node.description);

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
      '<input id="infoVideoStart" name="timeRange.start" data-path="timeRange.start" type="hidden" value="' + escapeAttr(startStr) + '">',
      '<input id="infoVideoEnd" name="timeRange.end" data-path="timeRange.end" type="hidden" value="' + escapeAttr(endStr) + '">',
      '<div class="video-duration" id="infoVideoDuration">' + escapeHtml(durationStr) + '</div>',
      '</div>'
    );

    html.push(
      '<div class="w3-container font-size-' + escapeAttr(fontSize) + ' video-description rich-description">',
      descriptionHtml,
      '</div>',
      '<span class="player w3-row" id="infoVideoOpenPlayer">',
      'Open Media Player. <i class="fas fa-external-link-alt"></i>',
      '</span>',
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

  renderDescription = function (description) {
    var format, body, html;
    if (!description || 'object' !== typeof description) {
      return '';
    }
    format = String(description.format || 'plain/text').toLowerCase();
    body = String(description.body || '');
    if (!body.trim()) {
      return '';
    }
    if (format.indexOf('html') >= 0) {
      html = body;
    }
    else if ((format.indexOf('markdown') >= 0 || format === 'md') &&
      window.marked && typeof window.marked.parse === 'function') {
      try { html = window.marked.parse(body); }
      catch (e) { html = ''; }
    }
    else if ((format.indexOf('markdown') >= 0 || format === 'md') &&
      window.markdownit && typeof window.markdownit === 'function') {
      try { html = window.markdownit({ html: false, linkify: true }).render(body); }
      catch (e2) { html = ''; }
    }
    else if ((format.indexOf('asciidoc') >= 0 || format === 'adoc') &&
      window.wuwei && wuwei.util && typeof wuwei.util.renderAsciiDoc === 'function') {
      try {
        html = wuwei.util.renderAsciiDoc(body, {
          showtitle: false,
          allowHtml: true
        });
      }
      catch (e3) { html = ''; }
    }
    if (!html) {
      html = '<p>' + escapeHtml(body).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
    }
    return sanitizeDescriptionHtml(html);
  };

  function sanitizeDescriptionHtml(html) {
    var template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll('script, style, iframe, object, embed').forEach(function (el) {
      el.remove();
    });
    template.content.querySelectorAll('*').forEach(function (el) {
      Array.from(el.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var value = String(attr.value || '');
        if (name.indexOf('on') === 0 || (/(href|src|xlink:href)/.test(name) && /^\s*javascript:/i.test(value))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return template.innerHTML;
  }

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
