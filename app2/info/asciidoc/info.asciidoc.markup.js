/**
 * info.asciidoc.markup.js
 * wuwei info.asciidoc template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.info = wuwei.info || {};
wuwei.info.asciidoc = wuwei.info.asciidoc || {};
wuwei.info.asciidoc.markup = (function () {
  'use strict';

  const template = function (param) {
    var html = param && param.html ? param.html : '';

    return `
<div class="info info-asciidoc">
  <div class="w3-container info-asciidoc-body">${html}</div>
</div>`;
  };

  return {
    template: template
  };
})();
// info.asciidoc.markup.js last updated 2026-03-26

