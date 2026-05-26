/**
 * wuwei.info.template.js
 * wuwei info template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.info = wuwei.info || {};
wuwei.info.markup = ( function () {
  const template = function () {
    var html = `
<!--Card-->
<!--Card header-->
<header class="w3-container">
  <h2 id="infoPaneTitle" class="pane-title">
    <i id="infoPaneTitleIcon" class="fas fa-info fa-lg fa-fw"></i>
    <span id="infoPaneTitleText" class="pane-title-text"></span>
  </h2>
  <div class="pane-header-actions" aria-label="Pane actions">
    <!-- EDIT BUTTON: shown only for records editable by the current user -->
    <a id="editOpen" class="pane-edit-action" title="編集" aria-label="編集" style="display:none;">
      <i class="fas fa-pencil-alt fa-lg fa-fw"></i>
    </a>
    <!-- WIDEN BUTTON -->
    <a id="infoWiden">
      <i class="fas fa-arrows-alt-h fa-lg fa-fw"></i>
    </a>
    <!-- DISMISS BUTTON -->
    <a id="infoDismiss">
      <i class="fa fa-times fa-lg fa-fw"></i>
    </a>
  </div>
</header>
<!--/.Card header-->
<!--Card content-->
<div id="info-generic"></div>
<div id="info-group"></div>
<div id="info-uploaded"></div>
<div id="info-video"></div>
<div id="info-audio"></div>
<div id="info-image"></div>
<div id="info-asciidoc"></div>
<div id="info-timeline"></div>
<div id="info-viewpoint"></div>
<!--/.Card content-->
<!--/.Card-->
`;
  return html;
};

  function rowcount(text) {
    return wuwei.edit.markup.rowcount(text);
  }

  function t(str) {
    return wuwei.nls.translate(str);
  }

  return {
    rowcount: rowcount,
    translate: t,
    template: template
  };
})();
// wuwei.info.markup.js last updated 2026-04-16
