/**
 * wuwei.video.markup.js
 * timeline segment aware video template helpers
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
(function (root) {
  'use strict';

  var wuwei = root.wuwei = root.wuwei || {};
  wuwei.video = wuwei.video || {};
  wuwei.video.markup = wuwei.video.markup || {};

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normaliseSeconds(value) {
    var n = Number(value || 0);
    if (!Number.isFinite(n) || n < 0) {
      return 0;
    }
    return n;
  }

  function stripQueryAndHash(value) {
    return String(value || '').split('#')[0].split('?')[0];
  }

  function extractYoutubeId(rawUrl) {
    var url = String(rawUrl || '').trim();
    if (!url) {
      return '';
    }

    var match = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    if (match && match[1]) {
      return match[1];
    }

    return '';
  }

  function extractVimeoId(rawUrl) {
    var url = String(rawUrl || '').trim();
    if (!url) {
      return '';
    }

    var match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (match && match[1]) {
      return match[1];
    }

    return '';
  }

  function buildYoutubeEmbedUrl(rawUrl, startSeconds) {
    var id = extractYoutubeId(rawUrl);
    if (!id) {
      return '';
    }

    var qs = [
      'rel=0',
      'playsinline=1'
    ];

    startSeconds = Math.floor(normaliseSeconds(startSeconds));
    if (startSeconds > 0) {
      qs.push('start=' + startSeconds);
    }

    return 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?' + qs.join('&');
  }

  function buildVimeoEmbedUrl(rawUrl, startSeconds) {
    var id = extractVimeoId(rawUrl);
    if (!id) {
      return '';
    }

    var url = 'https://player.vimeo.com/video/' + encodeURIComponent(id);
    startSeconds = Math.floor(normaliseSeconds(startSeconds));
    if (startSeconds > 0) {
      url += '#t=' + startSeconds + 's';
    }
    return url;
  }

  function getVideoSource(node) {
    if (!node) {
      return '';
    }
    var resource = (node.resource && typeof node.resource === 'object') ? node.resource : {};
    return resource.canonicalUri || resource.uri || '';
  }

  function getSubtype(node) {
    var url = String(getVideoSource(node) || '').toLowerCase();
    if (/youtube\.com|youtu\.be/.test(url)) {
      return 'youtube';
    }
    if (/vimeo\.com/.test(url)) {
      return 'vimeo';
    }
    if (/\.webm(\?|#|$)/.test(url)) {
      return 'webm';
    }
    if (/\.ogg(\?|#|$)/.test(url)) {
      return 'ogg';
    }
    if (/\.mov(\?|#|$)/.test(url)) {
      return 'mov';
    }
    if (/\.m4v(\?|#|$)/.test(url)) {
      return 'm4v';
    }
    return 'mp4';
  }

  function getNativeMime(node) {
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var format = String(resource.mimeType || '');
    if (format) {
      return format;
    }
    switch (getSubtype(node)) {
      case 'webm':
        return 'video/webm';
      case 'ogg':
        return 'video/ogg';
      case 'mov':
        return 'video/quicktime';
      case 'm4v':
        return 'video/x-m4v';
      default:
        return 'video/mp4';
    }
  }

  function buildFrameHtml(src, title, cssClass) {
    return [
      '<iframe',
      ' class="' + esc(cssClass || 'info-video-frame') + '"',
      ' src="' + esc(src) + '"',
      ' title="' + esc(title || 'video') + '"',
      ' allow="autoplay; fullscreen; picture-in-picture; encrypted-media"',
      ' allowfullscreen',
      ' frameborder="0"',
      ' style="display:block;width:100%;height:100%;border:0;background:#000;"',
      '></iframe>'
    ].join('');
  }

  function buildNativeHtml(node, option, cssClass) {
    var src = getVideoSource(node);
    var poster = node && (node.smallThumbnail || node.thumbnail || '');
    return [
      '<video class="' + esc(cssClass || 'info-video-native') + '" controls preload="metadata"',
      poster ? ' poster="' + esc(stripQueryAndHash(poster)) + '"' : '',
      ' style="display:block;width:100%;height:100%;background:#000;"',
      '>',
      '<source src="' + esc(src) + '" type="' + esc(getNativeMime(node)) + '">',
      '</video>'
    ].join('');
  }

  function render(node, option, mode) {
    option = option || {};
    mode = mode || 'inline';
    var range = (node && node.timeRange && typeof node.timeRange === 'object') ? node.timeRange : {};
    var startSeconds = normaliseSeconds(option.startSeconds != null ? option.startSeconds : range.start);
    var subtype = getSubtype(node);
    var url = getVideoSource(node);
    var cssClass = mode === 'modal' ? 'modal-video-frame' : 'info-video-frame';
    var nativeClass = mode === 'modal' ? 'modal-video-native' : 'info-video-native';

    if (subtype === 'youtube') {
      return buildFrameHtml(buildYoutubeEmbedUrl(url, startSeconds), node && node.label, cssClass);
    }
    if (subtype === 'vimeo') {
      return buildFrameHtml(buildVimeoEmbedUrl(url, startSeconds), node && node.label, cssClass);
    }
    return buildNativeHtml(node, option, nativeClass);
  }

  wuwei.video.markup.normaliseSeconds = normaliseSeconds;
  wuwei.video.markup.extractYoutubeId = extractYoutubeId;
  wuwei.video.markup.extractVimeoId = extractVimeoId;
  wuwei.video.markup.buildYoutubeEmbedUrl = buildYoutubeEmbedUrl;
  wuwei.video.markup.buildVimeoEmbedUrl = buildVimeoEmbedUrl;
  wuwei.video.markup.getVideoSource = getVideoSource;
  wuwei.video.markup.getSubtype = getSubtype;
  wuwei.video.markup.getNativeMime = getNativeMime;
  wuwei.video.markup.render = render;
})(window);
