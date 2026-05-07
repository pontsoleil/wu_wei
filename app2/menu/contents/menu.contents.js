/**
 * menu.contents.js
 * UI-facing commands for document contents axes.
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.contents = wuwei.menu.contents || {};

(function (ns) {
  'use strict';

  var contents = wuwei.contents;

  function getPageTargetSpec(target) {
    return contents && typeof contents.getPageTargetSpec === 'function'
      ? contents.getPageTargetSpec(target)
      : null;
  }

  function getPageOpenUrl(target) {
    var spec = getPageTargetSpec(target);
    if (!spec || !spec.documentNode || !contents || typeof contents.getDocumentViewerUrl !== 'function') {
      return '';
    }
    return contents.getDocumentViewerUrl(spec.documentNode, spec.pageNumber, spec.point);
  }

  function openPageInInfo(target) {
    var spec = getPageTargetSpec(target);
    if (!spec || !spec.documentNode || !wuwei.info || typeof wuwei.info.open !== 'function') {
      return false;
    }
    wuwei.info.open(spec.documentNode, {
      page: spec.pageNumber,
      contentsPage: true,
      contentsPoint: spec.point || target,
      displayedPageMarker: spec.point || target,
      editTarget: spec.point || target,
      pdfjsUri: contents.getDocumentViewerUrl(spec.documentNode, spec.pageNumber, spec.point)
    });
    return true;
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
  ns.getPageTargetSpec = getPageTargetSpec;
  ns.getPageOpenUrl = getPageOpenUrl;
  ns.openPageInInfo = openPageInInfo;
  ns.addTableOfContents = addTableOfContents;
})(wuwei.menu.contents);
