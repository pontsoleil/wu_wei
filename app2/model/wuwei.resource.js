/**
 * wuwei.resource.js
 * resource module
 *
  * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.resource = (function () {
  var
    /** common */
    common = wuwei.common,
    /** state */
    state = common.state,
    currentUser = state.currentUser,
    // user = currentUser.user,
    user_id = currentUser.user_id,
    /** util */
    util = wuwei.util;

  function currentAuthData(extra) {
    currentUser = state.currentUser || {};
    user_id = currentUser.user_id;
    return Object.assign({
      user_id: user_id,
      user: currentUser.login || '',
      token: currentUser.token || ''
    }, extra || {});
  }

  function list(param) {
    const today = new Date();
    param = param || {};
    const data = currentAuthData({
      start: param.start || 0,
      count: param.count || 24,
      year: param.year || today.getFullYear(),
      month: param.month || (today.getMonth() + 1)
    });
    if (param.date) {
      data.date = param.date;
    }
    return ajaxRequest(util.getServerUrl('list-resource'), data, 'POST', 30000);
  }

  function search(param) {
    param = param || {};
    const term = String(param.term || '').trim();
    if (!term && !param.date && !param.start_date && !param.end_date && !param.year && !param.month) {
      return Promise.resolve(JSON.stringify({ r: [], count: 0, count_org: 0, start: param.start || 0 }));
    }
    const data = currentAuthData({
      start: param.start || 0,
      count: param.count || 24
    });
    if (term) {
      data.term = term;
    }
    ['year', 'month', 'date', 'start_date', 'end_date', 'scope'].forEach(function (key) {
      if (param[key]) {
        data[key] = param[key];
      }
    });
    return ajaxRequest(util.getServerUrl('search-resource'), data, 'POST', 30000);
  }

  function encodeBase64Json(value) {
    const json = JSON.stringify(value || {});
    return btoa(unescape(encodeURIComponent(json)));
  }

  function update(resource) {
    const resourceDoc = resource && resource.resource && 'object' === typeof resource.resource
      ? Object.assign({}, resource.resource)
      : Object.assign({}, resource || {});
    if (!resourceDoc.id && resource && resource.id) {
      resourceDoc.id = resource.id;
    }
    const data = currentAuthData({
      id: resourceDoc.id,
      resource_json_base64: encodeBase64Json(resourceDoc)
    });
    return ajaxRequest(util.getServerUrl('update-resource'), data, 'POST', 5000);
  };

  function remove(id) {
    const data = currentAuthData({ id: id });
    return ajaxRequest(util.getServerUrl('remove-resource'), data, 'POST', 5000);
  };



  function getNode(nodeOrResource) {
    return nodeOrResource && nodeOrResource.resource ? nodeOrResource : null;
  }

  function getResource(nodeOrResource) {
    if (!nodeOrResource) { return {}; }
    return nodeOrResource.resource && typeof nodeOrResource.resource === 'object'
      ? nodeOrResource.resource
      : nodeOrResource;
  }

  function getFileByRole(nodeOrResource, role) {
    const resource = getResource(nodeOrResource);
    return util && typeof util.getResourceFile === 'function'
      ? util.getResourceFile(resource, role || 'original')
      : null;
  }

  function getOriginal(resource) {
    resource = getResource(resource);
    return resource.original && typeof resource.original === 'object' ? resource.original : {};
  }

  function getRemoteUrl(nodeOrResource) {
    var resource = getResource(nodeOrResource);
    var original = getOriginal(resource);
    return String(original.url || resource.uri || resource.canonicalUri || '');
  }

  function getCanonicalUrl(nodeOrResource) {
    var resource = getResource(nodeOrResource);
    var original = getOriginal(resource);
    return String(original.canonicalUrl || resource.canonicalUri || '');
  }

  function getViewpoint(nodeOrResource, create) {
    var resource = getResource(nodeOrResource);
    if (!resource || typeof resource !== 'object') {
      return create ? {} : null;
    }
    if (!resource.viewpoint || typeof resource.viewpoint !== 'object') {
      if (resource.contents && typeof resource.contents === 'object') {
        resource.viewpoint = resource.contents;
        delete resource.contents;
      }
      else if (create) {
        resource.viewpoint = {};
      }
    }
    return resource.viewpoint && typeof resource.viewpoint === 'object' ? resource.viewpoint : null;
  }

  function setRemoteOriginal(nodeOrResource, url, canonicalUrl) {
    var resource = getResource(nodeOrResource);
    var original;
    if (!resource || typeof resource !== 'object') {
      return resource;
    }
    original = resource.original && typeof resource.original === 'object' ? resource.original : {};
    original.type = original.type || 'remote';
    if (url !== undefined) { original.url = String(url || ''); }
    if (canonicalUrl !== undefined) { original.canonicalUrl = String(canonicalUrl || ''); }
    original.accessedAt = original.accessedAt || '';
    original.identifiers = Array.isArray(original.identifiers) ? original.identifiers : [];
    resource.original = original;
    return resource;
  }

  function getLogicalUri(nodeOrResource) {
    const resource = getResource(nodeOrResource);
    const source = String(resource.source || '').toLowerCase();
    const original = getOriginal(resource);
    const originalFile = getFileByRole(resource, original.storageRole || 'original') || getFileByRole(resource, 'original') || {};
    if (source === 'remote' || original.type === 'remote') {
      return String(original.url || original.canonicalUrl || resource.uri || resource.canonicalUri || '');
    }
    return String(originalFile.path || resource.uri || resource.canonicalUri || '');
  }

  function getRolePath(nodeOrResource, role) {
    const node = getNode(nodeOrResource);
    const resource = getResource(nodeOrResource);
    const source = String(resource.source || '').toLowerCase();
    if ((source === 'remote' || (resource.original && resource.original.type === 'remote')) && (role || 'original') === 'original') {
      return getRemoteUrl(resource);
    }
    if (util && typeof util.getResourceFilePath === 'function') {
      return util.getResourceFilePath(resource, role || 'original', node) || getLogicalUri(resource);
    }
    return getLogicalUri(resource);
  }

  function getRoleUrl(nodeOrResource, role, opt) {
    const node = getNode(nodeOrResource);
    const resource = getResource(nodeOrResource);
    const source = String(resource.source || '').toLowerCase();
    const roleName = role || 'original';
    const storage = resource.storage || {};
    const file = getFileByRole(resource, roleName) || {};
    const area = file.area || storage.area || (source === 'upload' ? 'upload' : 'resource');
    const path = getRolePath(nodeOrResource, roleName);
    const mode = opt && opt.mode || '';
    let direct = '';

    if (source === 'remote' || /^https?:\/\//i.test(path)) {
      return path;
    }

    if ((mode === 'officeViewer' || mode === 'direct') &&
        util && typeof util.getResourceDirectFileUri === 'function') {
      direct = util.getResourceDirectFileUri(resource, roleName, node);
      if (direct) { return direct; }
    }

    if (util && typeof util.toPublicResourceUri === 'function') {
      return util.toPublicResourceUri(area, path, null, roleName);
    }
    return path;
  }

  function getDirectUploadUrl(nodeOrResource, role) {
    return getRoleUrl(nodeOrResource, role || 'original', { mode: 'direct' });
  }

  function getOfficeViewerUrl(nodeOrResource, role) {
    return getRoleUrl(nodeOrResource, role || 'original', { mode: 'officeViewer' });
  }

  function getOpenUrl(nodeOrResource) {
    return getRoleUrl(nodeOrResource, 'original');
  }

  function getViewerUrl(nodeOrResource) {
    const resource = getResource(nodeOrResource);
    const viewpoint = getViewpoint(resource, false) || {};
    const sourceRole = viewpoint.sourceRole || '';

    if (isDocument(nodeOrResource) && wuwei.document &&
        typeof wuwei.document.getViewerUrl === 'function') {
      return wuwei.document.getViewerUrl(nodeOrResource);
    }
    if (isVideo(nodeOrResource) && wuwei.video &&
        typeof wuwei.video.getVideoSource === 'function') {
      return wuwei.video.getVideoSource(nodeOrResource);
    }
    if (isAudio(nodeOrResource) && wuwei.audio &&
        typeof wuwei.audio.getAudioSource === 'function') {
      return wuwei.audio.getAudioSource(nodeOrResource);
    }
    return getRoleUrl(nodeOrResource, sourceRole || 'original');
  }

  function getThumbnailUrl(nodeOrResource) {
    return getRoleUrl(nodeOrResource, 'thumbnail');
  }


  function getKind(nodeOrResource) {
    const resource = getResource(nodeOrResource);
    return String(resource.kind || '').toLowerCase();
  }

  function getDocumentKind(nodeOrResource) {
    const resource = getResource(nodeOrResource);
    return String(resource.documentKind || '').toLowerCase();
  }

  function getVideoKind(nodeOrResource) {
    const resource = getResource(nodeOrResource);
    return String(resource.videoKind || '').toLowerCase();
  }

  function getAudioKind(nodeOrResource) {
    const resource = getResource(nodeOrResource);
    return String(resource.audioKind || '').toLowerCase();
  }

  function getImageKind(nodeOrResource) {
    const resource = getResource(nodeOrResource);
    return String(resource.imageKind || '').toLowerCase();
  }

  function isDocument(nodeOrResource) {
    var resource = getResource(nodeOrResource);
    var uri = getLogicalUri(resource);
    return getKind(nodeOrResource) === 'document' ||
      getKind(nodeOrResource) === 'html' ||
      !!getDocumentKind(nodeOrResource) ||
      !!(util && typeof util.isDocumentKindByExtension === 'function' &&
        (util.isDocumentKindByExtension(getNode(nodeOrResource), resource, uri, 'pdf') ||
          util.isDocumentKindByExtension(getNode(nodeOrResource), resource, uri, 'office') ||
          util.isDocumentKindByExtension(getNode(nodeOrResource), resource, uri, 'html')));
  }

  function isVideo(nodeOrResource) {
    return getKind(nodeOrResource) === 'video' ||
      !!(wuwei.video && typeof wuwei.video.isVideoNode === 'function' && wuwei.video.isVideoNode(getNode(nodeOrResource) || nodeOrResource));
  }

  function isAudio(nodeOrResource) {
    return getKind(nodeOrResource) === 'audio' ||
      !!(wuwei.audio && typeof wuwei.audio.isAudioNode === 'function' && wuwei.audio.isAudioNode(getNode(nodeOrResource) || nodeOrResource));
  }

  function isImage(nodeOrResource) {
    var resource = getResource(nodeOrResource);
    var uri = getLogicalUri(resource);
    var mime = String(resource.mimeType || '').toLowerCase();
    return getKind(nodeOrResource) === 'image' ||
      mime.indexOf('image/') === 0 ||
      /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)(\?|#|$)/i.test(uri);
  }

  function getStorageFiles(nodeOrResource) {
    const resource = getResource(nodeOrResource);
    const storage = resource.storage || {};
    return Array.isArray(storage.files) ? storage.files : [];
  }

  function findFileByRole(nodeOrResource, role) {
    return getFileByRole(nodeOrResource, role || 'original');
  }

  function getOriginalUrl(nodeOrResource) {
    return getRoleUrl(nodeOrResource, 'original');
  }

  function getPreviewUrl(nodeOrResource) {
    return getRoleUrl(nodeOrResource, 'preview');
  }

  function getPdfPreviewUrl(nodeOrResource) {
    return getRoleUrl(nodeOrResource, 'pdf-preview');
  }

  function getRuntimeUrl(nodeOrResource, role, opt) {
    return getRoleUrl(nodeOrResource, role || 'original', opt || {});
  }

  function getPrimaryPreviewUrl(nodeOrResource) {
    const resource = getResource(nodeOrResource);
    if (isDocument(nodeOrResource) && wuwei.document &&
        typeof wuwei.document.getViewerUrl === 'function') {
      return wuwei.document.getViewerUrl(nodeOrResource) || getRoleUrl(nodeOrResource, 'original');
    }
    if (isVideo(nodeOrResource) && wuwei.video &&
        typeof wuwei.video.getVideoSource === 'function') {
      return wuwei.video.getVideoSource(nodeOrResource) || getRoleUrl(nodeOrResource, 'original');
    }
    if (isAudio(nodeOrResource) && wuwei.audio &&
        typeof wuwei.audio.getAudioSource === 'function') {
      return wuwei.audio.getAudioSource(nodeOrResource) || getRoleUrl(nodeOrResource, 'original');
    }
    if (resource.kind === 'image') {
      return getRoleUrl(nodeOrResource, 'original');
    }
    return getViewerUrl(nodeOrResource);
  }

  function initModule() { }

  return {
    /** Resource */
    list: list,
    search: search,
    update: update,
    remove: remove,
    getNode: getNode,
    getResource: getResource,
    getOriginal: getOriginal,
    getRemoteUrl: getRemoteUrl,
    getCanonicalUrl: getCanonicalUrl,
    getViewpoint: getViewpoint,
    setRemoteOriginal: setRemoteOriginal,
    getKind: getKind,
    getDocumentKind: getDocumentKind,
    getVideoKind: getVideoKind,
    getAudioKind: getAudioKind,
    getImageKind: getImageKind,
    isDocument: isDocument,
    isVideo: isVideo,
    isAudio: isAudio,
    isImage: isImage,
    getStorageFiles: getStorageFiles,
    getFileByRole: getFileByRole,
    findFileByRole: findFileByRole,
    getLogicalUri: getLogicalUri,
    getRolePath: getRolePath,
    getRoleUrl: getRoleUrl,
    getRuntimeUrl: getRuntimeUrl,
    getDirectUploadUrl: getDirectUploadUrl,
    getOfficeViewerUrl: getOfficeViewerUrl,
    getOpenUrl: getOpenUrl,
    getOriginalUrl: getOriginalUrl,
    getPreviewUrl: getPreviewUrl,
    getPdfPreviewUrl: getPdfPreviewUrl,
    getViewerUrl: getViewerUrl,
    getPrimaryPreviewUrl: getPrimaryPreviewUrl,
    getThumbnailUrl: getThumbnailUrl,
    /** init */
    initModule: initModule
  };
})();
// wuwei.resource.js
