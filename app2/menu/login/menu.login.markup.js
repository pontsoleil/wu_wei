/**
 * menu.login.template.js
 * menu.login template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2019, Nobuyuki SAMBUICHI
 **/
wuwei.menu = wuwei.menu || {};
wuwei.menu.login = wuwei.menu.login || {};
wuwei.menu.login.markup = ( function () {
  const template = `
<div class="w3-modal-content w3-animate-zoom w3-card-4" style="width:50%">
  <header class="w3-container">
    <i onclick="wuwei.menu.login.close()"
        class="fas fa-times w3-right w3-button w3-transparent w3-large w3-margin-bottom"></i>
    <h2 class="w3-wide w3-margin-bottom">${translate('Login')}</h2>
  </header>
  <form onsubmit="wuwei.menu.login.login(this); return false;"
      class="w3-container w3-white w3-center">
    <p><input name="user" class="w3-input w3-border" type="text"
        placeholder="${translate('Enter your id')}"></p>
    <p><input name="pw" class="w3-input w3-border" type="password"
        placeholder="${translate('Enter password')}"></p>
    <button type="submit" value="Submit"
        class="w3-button w3-padding-large w3-indigo w3-margin-top w3-margin-bottom">
      ${translate('Login')}
    </button>
    <input type="button" onclick="wuwei.menu.login.close()"
        class="w3-button w3-padding-large w3-gray w3-margin-top w3-margin-bottom"
        value="${translate('Close')}">
  </form>
  <div class="ajax_result w3-container w3-center"></div>
</div>
`;

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
})();