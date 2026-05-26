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
    if (wuwei.resource && typeof wuwei.resource.getResource === 'function') {
      return wuwei.resource.getResource(node);
    }
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
    if (wuwei.resource && typeof wuwei.resource.getRuntimeUrl === 'function') {
      return wuwei.resource.getRuntimeUrl(node, 'original');
    }
    return String(resource.canonicalUri || resource.uri || '');
  }

  function getDuration(node) {
    var resource = getResource(node);
    var media = resource && resource.media && typeof resource.media === 'object' ? resource.media : {};
    var values = [media.durationSeconds, media.duration, resource.duration];
    for (var i = 0; i < values.length; i += 1) {
      var n = Number(values[i]);
      if (Number.isFinite(n) && n > 0) { return n; }
    }
    return 0;
  }

  function setDuration(node, duration) {
    var n = Number(duration);
    var resource;
    if (!node || !Number.isFinite(n) || n <= 0) { return false; }
    resource = getResource(node);
    resource.media = resource.media && typeof resource.media === 'object' ? resource.media : {};
    resource.media.kind = resource.media.kind || 'video';
    resource.media.durationSeconds = n;
    resource.duration = n;
    node.resource = resource;
    node.changed = true;
    return true;
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
    resource = (node.resource && typeof node.resource === 'object') ? node.resource : {};
    owner = String(resource.owner || getCurrentUserId() || '');
    now = new Date().toISOString();
    subtype = getHostedSubtype(text);
    mimeType = getVideoMimeType(text, resource.mimeType);

    resource.source = /^https?:\/\//i.test(text) ? 'remote' : (resource.source || 'remote');
    resource.kind = 'video';
    resource.videoKind = subtype || resource.videoKind || '';
    resource.uri = text;
    resource.canonicalUri = text;
    resource.original = (resource.original && typeof resource.original === 'object') ? resource.original : {};
    if (resource.source === 'remote' || /^https?:\/\//i.test(text)) {
      resource.original.type = 'remote';
      resource.original.url = text;
      resource.original.canonicalUrl = resource.original.canonicalUrl || text;
      resource.original.accessedAt = resource.original.accessedAt || '';
      resource.original.identifiers = Array.isArray(resource.original.identifiers) ? resource.original.identifiers : [];
    }
    resource.mimeType = mimeType;
    resource.title = resource.title || node.label || text || 'Video';
    resource.owner = owner;
    resource.copyright = resource.copyright || '';
    if (node.timeRange && Number.isFinite(Number(node.timeRange.end)) && Number(node.timeRange.end) > 0) {
      resource.media = resource.media && typeof resource.media === 'object' ? resource.media : {};
      resource.media.kind = resource.media.kind || 'video';
      resource.media.durationSeconds = Number(node.timeRange.end);
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
    delete resource.storage;

    node.resource = resource;
    return resource;
  }

  function detectSource(node) {
    var resource = getResource(node);
    var url = getVideoSource(node);
    var subtype = String(resource.videoKind || '').toLowerCase();
    var kind = String(resource.kind || '').toLowerCase();
    if (subtype === 'youtube' || isHostedYouTube(url)) {
      return {
        provider: 'youtube',
        id: extractYouTubeId(url), 
        url: url
      };
    }
    if (subtype === 'vimeo' || isHostedVimeo(url)) {
      var vimeo = extractVimeoInfo(url);
      return {
        provider: 'vimeo',
        id: vimeo.id,
        h: vimeo.h,
        url: vimeo.url
      };
    }
    if (kind === 'video' || (wuwei.util && wuwei.util.isDocumentKindByExtension &&
      wuwei.util.isDocumentKindByExtension(node, resource, url, 'video'))) {
      return {
        provider: 'html5',
        src: toAbsUrl(url),
        url: url
      };
    }
    return {
      provider: 'unknown',
      url: url
    };
  }

  function getEmbedUrl(node) {
    var source = detectSource(node);
    if (source.provider === 'youtube' && source.id) {
      return 'https://www.youtube.com/embed/' + encodeURIComponent(source.id);
    }
    if (source.provider === 'vimeo' && source.id) {
      return 'https://player.vimeo.com/video/' + encodeURIComponent(source.id) +
        (source.h ? ('?h=' + encodeURIComponent(source.h)) : '');
    }
    return '';
  }

  function initModule() { }

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
  wuwei.video.getDuration = getDuration;
  wuwei.video.setDuration = setDuration;
  wuwei.video.setVideoSource = setVideoSource;
  wuwei.video.detectSource = detectSource;
  wuwei.video.getEmbedUrl = getEmbedUrl;
  wuwei.video.isVideoNode = isVideoNode;
  wuwei.video.open = open;
  wuwei.video.close = close;
  wuwei.video.initModule = initModule;
})(window);
