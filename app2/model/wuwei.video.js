/**
 * wuwei.video.js
 * Video content model helpers.
 */
(function (root) {
  'use strict';

  var wuwei = root.wuwei = root.wuwei || {};
  wuwei.video = wuwei.video || {};

  function toAbsUrl(href) {
    if (!href) { return ''; }
    if (/^(https?:|blob:|data:)/i.test(href)) { return href; }
    if (href.charAt(0) === '/') { return href; }
    return location.href.slice(0, location.href.lastIndexOf('/') + 1) + href.replace(/^\.\//, '');
  }

  function normaliseSeconds(value) {
    var n = Number(value || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function isHostedYouTube(url) {
    return /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\b/i.test(String(url || ''));
  }

  function isHostedVimeo(url) {
    return /^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\b/i.test(String(url || ''));
  }

  function extractYouTubeId(url) {
    var s = String(url || '');
    var m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m) { return m[1]; }
    m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (m) { return m[1]; }
    m = s.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  function extractVimeoInfo(url) {
    var out = { id: '', h: '', url: String(url || '').trim() };
    var u, m;
    try {
      u = new URL(out.url, location.href);
      out.h = u.searchParams.get('h') || '';
      m = u.pathname.match(/\/(?:video\/)?([0-9]+)(?:\/([A-Za-z0-9_-]+))?/);
      if (m) {
        out.id = m[1];
        out.h = out.h || m[2] || '';
      }
    }
    catch (e) {
      m = out.url.match(/vimeo\.com\/(?:video\/)?([0-9]+)(?:\/([A-Za-z0-9_-]+))?/);
      if (m) {
        out.id = m[1];
        out.h = out.h || m[2] || '';
      }
    }
    return out;
  }

  function extractVimeoId(url) {
    return extractVimeoInfo(url).id;
  }

  function getResource(node) {
    return (node && node.resource && typeof node.resource === 'object') ? node.resource : {};
  }

  function getCurrentUserId() {
    if (wuwei.util && typeof wuwei.util.getCurrentUserId === 'function') {
      return String(wuwei.util.getCurrentUserId() || '');
    }
    if (wuwei.common && wuwei.common.state && wuwei.common.state.currentUser) {
      return String(wuwei.common.state.currentUser.user_id || '');
    }
    return '';
  }

  function getHostedSubtype(url) {
    if (isHostedYouTube(url)) { return 'youtube'; }
    if (isHostedVimeo(url)) { return 'vimeo'; }
    return '';
  }

  function getVideoMimeType(url, previous) {
    var subtype = getHostedSubtype(url);
    if (subtype === 'youtube' || subtype === 'vimeo') {
      return 'text/html';
    }
    if (previous) {
      return previous;
    }
    if (/\.webm(\?|#|$)/i.test(url)) { return 'video/webm'; }
    if (/\.og[gv](\?|#|$)/i.test(url)) { return 'video/ogg'; }
    if (/\.(mov|m4v)(\?|#|$)/i.test(url)) { return 'video/quicktime'; }
    return 'video/mp4';
  }

  function getVideoSource(node) {
    var resource = getResource(node);
    return String(resource.canonicalUri || resource.uri || '');
  }

  function setVideoSource(node, url) {
    var text = String(url || '').trim();
    var resource;
    var owner;
    var now;
    var subtype;
    var mimeType;
    if (!node) {
      return null;
    }
    node.option = 'video';
    resource = (node.resource && typeof node.resource === 'object') ? node.resource : {};
    owner = String(resource.owner || getCurrentUserId() || '');
    now = new Date().toISOString();
    subtype = getHostedSubtype(text);
    mimeType = getVideoMimeType(text, resource.mimeType);

    resource.kind = 'video';
    resource.subtype = subtype || resource.subtype || '';
    resource.uri = text;
    resource.canonicalUri = text;
    resource.mimeType = mimeType;
    resource.title = resource.title || node.label || text || 'Video';
    resource.thumbnailUri = resource.thumbnailUri || node.thumbnailUri || '';
    resource.owner = owner;
    resource.copyright = resource.copyright || '';
    resource.media = (resource.media && typeof resource.media === 'object') ? resource.media : {};
    resource.media.kind = 'video';
    resource.media.subtype = subtype || resource.media.subtype || '';
    resource.media.mimeType = mimeType;
    if (node.timeRange && Number.isFinite(Number(node.timeRange.end)) && Number(node.timeRange.end) > 0) {
      resource.media.duration = Number(node.timeRange.end);
      resource.duration = Number(node.timeRange.end);
    }
    resource.rights = (resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    resource.rights.owner = resource.rights.owner || owner;
    resource.rights.copyright = resource.rights.copyright || resource.copyright || '';
    resource.rights.license = resource.rights.license || '';
    resource.rights.attribution = resource.rights.attribution || '';
    resource.audit = (resource.audit && typeof resource.audit === 'object') ? resource.audit : {};
    resource.audit.owner = resource.audit.owner || owner;
    resource.audit.createdBy = resource.audit.createdBy || owner;
    resource.audit.createdAt = resource.audit.createdAt || now;
    resource.audit.lastModifiedBy = owner;
    resource.audit.lastModifiedAt = now;
    resource.viewer = (resource.viewer && typeof resource.viewer === 'object') ? resource.viewer : {};
    resource.viewer.supportedModes = ['infoPane', 'newTab', 'newWindow', 'download'];
    resource.viewer.defaultMode = resource.viewer.defaultMode || 'infoPane';
    resource.viewer.embed = (resource.viewer.embed && typeof resource.viewer.embed === 'object') ? resource.viewer.embed : {};
    resource.viewer.embed.enabled = !!text;
    resource.viewer.embed.uri = text;
    resource.viewer.embed.thumbnailUri = resource.thumbnailUri || '';
    resource.viewer.thumbnailUri = resource.thumbnailUri || '';

    delete resource.storage;
    delete resource.snapshotSources;
    delete resource.identity;

    node.resource = resource;
    return resource;
  }

  function detectSource(node) {
    var resource = getResource(node);
    var url = getVideoSource(node);
    var subtype = String(resource.subtype || '').toLowerCase();
    var kind = String(resource.kind || '').toLowerCase();
    var mime = String(resource.mimeType || '').toLowerCase();
    if (subtype === 'youtube' || isHostedYouTube(url)) {
      return { provider: 'youtube', id: extractYouTubeId(url), url: url };
    }
    if (subtype === 'vimeo' || isHostedVimeo(url)) {
      var vimeo = extractVimeoInfo(url);
      return { provider: 'vimeo', id: vimeo.id, h: vimeo.h, url: vimeo.url };
    }
    if (kind === 'video' || mime.indexOf('video/') === 0 || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url)) {
      return { provider: 'html5', src: toAbsUrl(url), url: url };
    }
    return { provider: 'unknown', url: url };
  }

  function isVideoNode(node) {
    return !!(node && node.type === 'Content' && detectSource(node).provider !== 'unknown');
  }

  function open(node, option) {
    return !!(wuwei.menu && wuwei.menu.video &&
      typeof wuwei.menu.video.open === 'function' &&
      wuwei.menu.video.open(node, option || {}));
  }

  function close() {
    if (wuwei.menu && wuwei.menu.video && typeof wuwei.menu.video.close === 'function') {
      wuwei.menu.video.close();
    }
  }

  wuwei.video.normaliseSeconds = normaliseSeconds;
  wuwei.video.isHostedYouTube = isHostedYouTube;
  wuwei.video.isHostedVimeo = isHostedVimeo;
  wuwei.video.extractYouTubeId = extractYouTubeId;
  wuwei.video.extractVimeoInfo = extractVimeoInfo;
  wuwei.video.extractVimeoId = extractVimeoId;
  wuwei.video.getVideoSource = getVideoSource;
  wuwei.video.setVideoSource = setVideoSource;
  wuwei.video.detectSource = detectSource;
  wuwei.video.isVideoNode = isVideoNode;
  wuwei.video.open = open;
  wuwei.video.close = close;
})(window);
