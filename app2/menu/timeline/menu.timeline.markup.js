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

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
}());
// menu.timeline.markup.js 2026-04-01