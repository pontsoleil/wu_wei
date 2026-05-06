/**
 * wuwei.info.template.js
 * wuwei info template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2019, Nobuyuki SAMBUICHI
 **/
wuwei.info = wuwei.info || {};
wuwei.info.markup = ( function () {
  const template = function () {
    var viewing = wuwei.common.graph.mode === 'view',
        html = `
<!--Card-->
<!--Card header-->
<header class="w3-container">
  <h2>
  <i class="fas fa-info fa-lg fa-fw"></i>
  </h2>
  <!-- DISMISS BUTTON -->
  <a id="infoDismiss">
    <i class="fa fa-times fa-lg fa-fw"></i>
  </a>
  <!-- WIDEN BUTTON -->
  <a id="infoWiden">
    <i class="fas fa-arrows-alt-h fa-lg fa-fw"></i>
  </a>
  <!-- EDIT BUTTON -->
  ${!viewing
    ? `<a id="editOpen">
        <i class="fas fa-edit fa-lg fa-fw"></i>
      </a>`
    : ''
  }
</header>
<!--/.Card header-->
<!--Card content-->
<div id="info-generic"></div>
<div id="info-group"></div>
<div id="info-uploaded"></div>
<div id="info-video"></div>
<div id="info-asciidoc"></div>
<div id="info-timeline"></div>
<!--/.Card content-->
<!--/.Card-->
`;
  return html;
};

  function rowcount(text) {
    return wuwei.edit.markup.rowcount(text);
  }

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    rowcount: rowcount,
    translate: translate,
    template: template
  };
})();
// wuwei.info.markup.js last updated 2026-04-16
