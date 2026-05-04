/**
 * wuwei.video.markup.js
 *
 * Deprecated compatibility namespace.
 * Video UI templates live in app2/menu/video/menu.video.template.js.
 */
(function (root) {
  'use strict';

  var wuwei = root.wuwei = root.wuwei || {};
  wuwei.video = wuwei.video || {};
  wuwei.video.markup = wuwei.video.markup || {};

  function render(node, option, mode) {
    var template = wuwei.menu && wuwei.menu.video && wuwei.menu.video.template;
    var source = wuwei.video && typeof wuwei.video.detectSource === 'function'
      ? wuwei.video.detectSource(node)
      : { provider: 'unknown' };
    var resource = (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
    var title = node && (node.label || resource.title || resource.uri || 'video');
    var className = mode === 'modal' ? 'modal-video-frame' : 'info-video-frame';
    var nativeClass = mode === 'modal' ? 'modal-video-native' : 'info-video-native';
    if (!template) {
      return '';
    }
    if (source.provider === 'youtube' && source.id) {
      return template.iframe({
        src: 'https://www.youtube.com/embed/' + encodeURIComponent(source.id) +
          '?rel=0&playsinline=1&start=' + Math.floor(Number((option && option.startSeconds) || 0)),
        title: title,
        className: className
      });
    }
    if (source.provider === 'vimeo' && source.id) {
      return template.iframe({
        src: 'https://player.vimeo.com/video/' + encodeURIComponent(source.id),
        title: title,
        className: className
      });
    }
    if (source.provider === 'html5') {
      return template.nativeVideo({
        src: source.src || source.url,
        mimeType: resource.mimeType || 'video/mp4',
        poster: node && (node.smallThumbnail || node.thumbnail || ''),
        className: nativeClass
      });
    }
    return '';
  }

  wuwei.video.markup.render = render;
})(window);
