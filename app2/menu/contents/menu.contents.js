/**
 * menu.contents.js
 * UI-facing commands for document contents axes and contentTarget markers.
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.contents = wuwei.menu.contents || {};

(function (ns) {
  'use strict';

  var contents = wuwei.contents;

  function getContentTargetSpec(target) {
    return contents && typeof contents.getContentTargetSpec === 'function'
      ? contents.getContentTargetSpec(target)
      : null;
  }

  function getContentTargetOpenUrl(target) {
    var spec = getContentTargetSpec(target);
    if (!spec || !spec.documentNode || !contents || typeof contents.getContentTargetViewerUrl !== 'function') {
      return '';
    }
    return contents.getContentTargetViewerUrl(spec.documentNode, spec.pageNumber, spec.point);
  }

  function openContentTargetInInfo(target) {
    var spec = getContentTargetSpec(target);
    var point;

    if (!spec || !spec.point || !wuwei.info || !wuwei.info.contents ||
      typeof wuwei.info.contents.openContentTargetInInfo !== 'function') {
      return false;
    }

    point = spec.point || target;
    return wuwei.info.contents.openContentTargetInInfo(point);
  }


  function snackbar(type, message) {
    if (wuwei.menu && wuwei.menu.snackbar && typeof wuwei.menu.snackbar.open === 'function') {
      wuwei.menu.snackbar.open({ type: type || 'info', message: message });
    }
    else if (message) {
      window.alert(message);
    }
  }

  async function addTableOfContents(target) {
    var group;
    if (!contents || typeof contents.addTableOfContents !== 'function') {
      snackbar('error', wuwei.nls.translate('Contents module is not available.'));
      return null;
    }
    try {
      if (wuwei.log && typeof wuwei.log.savePrevious === 'function') {
        wuwei.log.savePrevious();
      }
      group = await contents.addTableOfContents(target, { silent: false, axis: 'horizontal' });
      if (group && wuwei.log && typeof wuwei.log.storeLog === 'function') {
        wuwei.log.storeLog({ operation: 'edit' });
        snackbar('success', wuwei.nls.translate('Table of contents was added.'));
      }
      return group;
    }
    catch (e) {
      console.error(e);
      snackbar('error', e && e.message ? e.message : wuwei.nls.translate('Failed to add table of contents.'));
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
  ns.addTableOfContents = addTableOfContents;
})(wuwei.menu.contents);
// menu.contents.js last modified 2026-05-11
