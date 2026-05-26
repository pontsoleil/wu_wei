/**
 * info.admin.markup.js
 * Admin pane markup
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.info = wuwei.info || {};
wuwei.info.admin = wuwei.info.admin || {};
wuwei.info.admin.markup = (function () {
  'use strict';

  const container = function () {
    return '<div id="info-admin"></div>';
  };

  const titleText = function () {
    return '管理(Admin)ペイン';
  };

  const iconClass = function () {
    // Keep this icon aligned with the Admin context-menu item.
    return 'fas fa-tools fa-lg fa-fw';
  };

  return {
    container: container,
    titleText: titleText,
    iconClass: iconClass
  };
}());
