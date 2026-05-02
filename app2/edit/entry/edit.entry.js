/*
 * edit.entry.js
 *
 * Contents entry editing extends the generic Topic editor with entry-specific
 * fields supplied by edit.generic.markup.js.
 */
wuwei.edit.entry = (function (ns) {
  'use strict';

  function open(param) {
    param = param || {};
    param.option = param.option || {};
    param.option.entry = true;
    return wuwei.edit.generic.open(param);
  }

  ns.open = open;
  return ns;
})(wuwei.edit.entry || {});
