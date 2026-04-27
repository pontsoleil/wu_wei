/**
 * info.uploaded.js
 * info.uploaded module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.info = wuwei.info || {};
wuwei.info.uploaded = wuwei.info.uploaded || {};

(function (ns) {

  function open(param) {
    var info_uploaded = document.getElementById('info-uploaded');
    if (info_uploaded) {
      info_uploaded.innerHTML = wuwei.info.uploaded.markup.template(param);
      info_uploaded.style.display = 'block';
    }
  }

  function close() {
    var info_uploaded = document.getElementById('info-uploaded');
    if (info_uploaded) {
      info_uploaded.innerHTML = '';
      info_uploaded.style.display = 'none';
    }
  }

  ns.open = open;
  ns.close = close;
})(wuwei.info.uploaded);
// info.uploaded.js
