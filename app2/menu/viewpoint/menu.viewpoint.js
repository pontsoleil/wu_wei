/**
 * menu.viewpoint.js
 * UI-facing commands for document viewpoint axes and contentTarget markers.
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.viewpoint = wuwei.menu.viewpoint || {};

(function (ns) {
  'use strict';

  var viewpoint = wuwei.viewpoint;

  function getContentTargetSpec(target) {
    return viewpoint && typeof viewpoint.getContentTargetSpec === 'function'
      ? viewpoint.getContentTargetSpec(target)
      : null;
  }

  function getContentTargetOpenUrl(target) {
    var spec = getContentTargetSpec(target);
    if (!spec || !spec.documentNode || !viewpoint || typeof viewpoint.getContentTargetViewerUrl !== 'function') {
      return '';
    }
    return viewpoint.getContentTargetViewerUrl(spec.documentNode, spec.pageNumber, spec.point);
  }

  function openContentTargetInInfo(target) {
    var spec = getContentTargetSpec(target);
    var point;

    if (!spec || !wuwei.info || !wuwei.info.viewpoint) {
      return false;
    }

    if (spec.point && typeof wuwei.info.viewpoint.openContentTargetInInfo === 'function') {
      point = spec.point || target;
      return wuwei.info.viewpoint.openContentTargetInInfo(point);
    }

    if (spec.group && typeof wuwei.info.viewpoint.openAxis === 'function') {
      return wuwei.info.viewpoint.openAxis(spec.group);
    }

    return false;
  }


  function snackbar(type, message) {
    if (wuwei.menu && wuwei.menu.snackbar && typeof wuwei.menu.snackbar.open === 'function') {
      wuwei.menu.snackbar.open({ type: type || 'info', message: message });
    }
    else if (message) {
      window.alert(message);
    }
  }

  async function addViewpointAxis(target) {
    var group;
    if (!viewpoint || typeof viewpoint.addViewpointAxis !== 'function') {
      snackbar('error', wuwei.nls.translate('Viewpoint module is not available.'));
      return null;
    }
    try {
      if (wuwei.log && typeof wuwei.log.savePrevious === 'function') {
        wuwei.log.savePrevious();
      }
      group = await viewpoint.addViewpointAxis(target, { silent: false, axis: 'horizontal' });
      if (group && wuwei.log && typeof wuwei.log.storeLog === 'function') {
        wuwei.log.storeLog({ operation: 'edit' });
        snackbar('success', wuwei.nls.translate('Viewpoint axis was added.'));
      }
      return group;
    }
    catch (e) {
      console.error(e);
      snackbar('error', e && e.message ? e.message : wuwei.nls.translate('Failed to add viewpoint axis.'));
      return null;
    }
  }

  function initModule() {
    return true;
  }

  ns.initModule = initModule;
  ns.getContentTargetSpec = getContentTargetSpec;
  ns.getContentTargetOpenUrl = getContentTargetOpenUrl;
  ns.openContentTargetInInfo = openContentTargetInInfo;
  ns.addViewpointAxis = addViewpointAxis;
})(wuwei.menu.viewpoint);
// menu.viewpoint.js last modified 2026-05-11
