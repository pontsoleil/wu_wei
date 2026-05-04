/**
 * menu.timeline.markup.js
 * menu timeline template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.timeline = wuwei.menu.timeline || {};
wuwei.menu.timeline.markup = (function () {
  'use strict';

  function template() {
    return [``].join('\n');
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function html5Preview(param) {
    param = param || {};
    return '<video controls playsinline preload="metadata" autoplay style="width:100%;height:auto;display:block;" src="' +
      esc(param.src || '') + '"></video>';
  }

  function playerHolder(param) {
    param = param || {};
    return '<div id="' + esc(param.id || '') + '" style="width:100%;aspect-ratio:16/9;"></div>';
  }

  return {
    template: template,
    html5Preview: html5Preview,
    playerHolder: playerHolder
  };
}());
// menu.timeline.markup.js 2026-04-01
