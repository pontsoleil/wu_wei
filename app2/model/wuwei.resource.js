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

  function getLogicalUri(nodeOrResource) {
    const resource = getResource(nodeOrResource);
    return String(resource.uri || resource.canonicalUri || '');
  }

  function getRolePath(nodeOrResource, role) {
    const node = getNode(nodeOrResource);
    const resource = getResource(nodeOrResource);
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
    const sourceRole = resource.contents && resource.contents.sourceRole || '';
    if (resource.documentKind === 'office') {
      return getRoleUrl(nodeOrResource, sourceRole || 'preview');
    }
    if (resource.documentKind === 'pdf') {
      return getRoleUrl(nodeOrResource, sourceRole || 'original');
    }
    return getRoleUrl(nodeOrResource, sourceRole || 'original');
  }

  function getThumbnailUrl(nodeOrResource) {
    return getRoleUrl(nodeOrResource, 'thumbnail');
  }

  function initModule() { }

  return {
    /** Resource */
    list: list,
    search: search,
    update: update,
    remove: remove,
    getLogicalUri: getLogicalUri,
    getRolePath: getRolePath,
    getRoleUrl: getRoleUrl,
    getDirectUploadUrl: getDirectUploadUrl,
    getOfficeViewerUrl: getOfficeViewerUrl,
    getOpenUrl: getOpenUrl,
    getViewerUrl: getViewerUrl,
    getThumbnailUrl: getThumbnailUrl,
    /** init */
    initModule: initModule
  };
})();
// wuwei.resource.js
