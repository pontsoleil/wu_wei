/**
 * menu.modal.js
 * menu.modal module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.modal = wuwei.menu.modal || {};

( function (ns) {
  var callback;
  /**
   * 
   * @param {*} param
   * @param {*} param.message
   * @param {*} param.type - Bootstrap color, e.g. info, success, danger, warning
   * @param {*} param.input_type
   * @param {*} param.callback
   * @param {*} param.timeout 
   */
  function open(param) {
    // param: { type, message, input_type, callback }
    param = param || {};
    const modalEl = document.getElementById('modal');
    const timeout = (typeof param.timeout === 'number') ? param.timeout : 5000;
    modalEl.innerHTML = wuwei.menu.modal.markup.template(param);
    modalEl.style.display='block';
    if (param.html) {
      modalEl.classList.add('html');
    }
    else {
      modalEl.classList.remove('html');
    }
    if (param.input_type) {
      modalEl.classList.add('input');
      callback = param.callback;
      return;
    }
    modalEl.classList.remove('input');
    if (timeout > 0) {
      setTimeout(() => {
        close();
      }, timeout);
    }
    modalEl.classList.remove('hidden');
  }

  function input() {
    var req = document.getElementById('req').value;
    callback(req);
    close();
  }

  function close() {
    const modalEl = document.getElementById('modal');
    modalEl.innerHTML = '';
    modalEl.style.display = 'none';
    modalEl.classList.remove('html');
    modalEl.classList.remove('input');
  }

  ns.open = open;
  ns.input = input;
  ns.close = close;
})(wuwei.menu.modal);
// menu.modal.js last modified 2026-04-07
