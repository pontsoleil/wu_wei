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
    if (!term) {
      return Promise.resolve({ r: [], count: 0, count_org: 0, start: param.start || 0 });
    }
    const data = currentAuthData({
      start: param.start || 0,
      count: param.count || 24,
      term: term
    });
    return ajaxRequest(util.getServerUrl('find-resource'), data, 'POST', 30000);
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

  function initModule() { }

  return {
    /** Resource */
    list: list,
    search: search,
    update: update,
    remove: remove,
    /** init */
    initModule: initModule
  };
})();
// wuwei.resource.js
