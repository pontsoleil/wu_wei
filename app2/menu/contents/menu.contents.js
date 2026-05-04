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
    return contents.getDocumentViewerUrl(spec.documentNode, spec.pageNumber);
  }

  function openPageInInfo(target) {
    var spec = getPageTargetSpec(target);
    if (!spec || !spec.documentNode || !wuwei.info || typeof wuwei.info.open !== 'function') {
      return false;
    }
    wuwei.info.open(spec.documentNode, {
      page: spec.pageNumber,
      contentsPage: true,
      pdfjsUri: contents.getDocumentViewerUrl(spec.documentNode, spec.pageNumber)
    });
    return true;
  }

  function initModule() {
    return true;
  }

  ns.initModule = initModule;
  ns.getPageTargetSpec = getPageTargetSpec;
  ns.getPageOpenUrl = getPageOpenUrl;
  ns.openPageInInfo = openPageInInfo;
})(wuwei.menu.contents);
