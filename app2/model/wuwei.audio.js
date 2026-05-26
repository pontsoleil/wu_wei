/**
 * wuwei.audio.js
 * Audio content model helpers.
 */
wuwei.audio = (function () {
  'use strict';

  function getResource(nodeOrResource) {
    if (wuwei.resource && typeof wuwei.resource.getResource === 'function') {
      return wuwei.resource.getResource(nodeOrResource);
    }
    if (!nodeOrResource) { return {}; }
    return nodeOrResource.resource && typeof nodeOrResource.resource === 'object'
      ? nodeOrResource.resource
      : nodeOrResource;
  }

  function getAudioKind(nodeOrResource) {
    if (wuwei.resource && typeof wuwei.resource.getAudioKind === 'function') {
      return wuwei.resource.getAudioKind(nodeOrResource);
    }
    return String(getResource(nodeOrResource).audioKind || '').toLowerCase();
  }

  function getAudioSource(nodeOrResource) {
    var resource = getResource(nodeOrResource);
    if (wuwei.resource && typeof wuwei.resource.getRuntimeUrl === 'function') {
      return wuwei.resource.getRuntimeUrl(nodeOrResource, 'original');
    }
    return String(resource.original && resource.original.url || resource.uri || resource.canonicalUri || '');
  }

  function getDuration(nodeOrResource) {
    var resource = getResource(nodeOrResource);
    var n = Number(resource.media && (resource.media.durationSeconds || resource.media.duration) || resource.duration || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function getAudioMimeType(url, previous) {
    if (previous) { return previous; }
    if (/\.wav(\?|#|$)/i.test(url)) { return 'audio/wav'; }
    if (/\.m4a(\?|#|$)/i.test(url)) { return 'audio/mp4'; }
    if (/\.aac(\?|#|$)/i.test(url)) { return 'audio/aac'; }
    if (/\.flac(\?|#|$)/i.test(url)) { return 'audio/flac'; }
    if (/\.og[ag](\?|#|$)/i.test(url)) { return 'audio/ogg'; }
    return 'audio/mpeg';
  }

  function setAudioSource(node, url) {
    var text = String(url || '').trim();
    var resource;
    var now;
    var owner;

    if (!node) { return null; }
    resource = (node.resource && typeof node.resource === 'object') ? node.resource : {};
    now = new Date().toISOString();
    owner = String(resource.owner || (wuwei.util && wuwei.util.getCurrentUserId && wuwei.util.getCurrentUserId()) || '');

    resource.kind = 'audio';
    resource.source = resource.source || 'remote';
    resource.audioKind = resource.audioKind || (/\.mp3(\?|#|$)/i.test(text) ? 'mp3' : '');
    resource.original = (resource.original && typeof resource.original === 'object') ? resource.original : {};
    resource.original.type = resource.original.type || 'remote';
    resource.original.url = text;
    resource.original.canonicalUrl = resource.original.canonicalUrl || text;
    resource.original.accessedAt = resource.original.accessedAt || now;
    resource.original.identifiers = Array.isArray(resource.original.identifiers) ? resource.original.identifiers : [];
    resource.mimeType = resource.mimeType || getAudioMimeType(text, resource.mimeType);
    delete resource.uri;
    delete resource.canonicalUri;
    delete resource.title;
    resource.rights = (resource.rights && typeof resource.rights === 'object') ? resource.rights : {};
    resource.audit = (resource.audit && typeof resource.audit === 'object') ? resource.audit : {};
    resource.audit.owner = resource.audit.owner || owner;
    resource.audit.createdBy = resource.audit.createdBy || owner;
    resource.audit.createdAt = resource.audit.createdAt || now;
    resource.audit.lastModifiedBy = owner;
    resource.audit.lastModifiedAt = now;

    node.resource = resource;
    return resource;
  }

  function isAudioNode(node) {
    var resource = getResource(node);
    var kind = String(resource.kind || '').toLowerCase();
    var mime = String(resource.mimeType || '').toLowerCase();
    var uri = String(resource.original && resource.original.url || resource.uri || resource.canonicalUri || '');
    return !!(node && node.type === 'Content' && (
      kind === 'audio' ||
      mime.indexOf('audio/') === 0 ||
      /\.(mp3|wav|m4a|aac|flac|ogg|oga)(\?|#|$)/i.test(uri)
    ));
  }

  function initModule() { }

  return {
    getAudioKind: getAudioKind,
    getAudioSource: getAudioSource,
    getDuration: getDuration,
    getAudioMimeType: getAudioMimeType,
    setAudioSource: setAudioSource,
    isAudioNode: isAudioNode,
    initModule: initModule
  };
})();
// wuwei.audio.js
