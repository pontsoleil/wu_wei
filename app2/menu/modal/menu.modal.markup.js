/**
 * menu.modal.template.js
 * menu.modal template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2019, Nobuyuki SAMBUICHI
 **/
wuwei.menu = wuwei.menu || {};
wuwei.menu.modal = wuwei.menu.modal || {};
wuwei.menu.modal.markup = ( function () {
  const template = function(param) {
    // param: { type, message, input_type, callback }
    const type = (param && param.type) || '',
          message_ = (param && param.message) || '',
          html = (param && param.html) || '',
          input_type = (param && param.input_type) || '';

    let message = html ? html : wuwei.nls.translate(message_);

    if (!html && message.length > 128) {
      message = message.substr(0, 128) + '...';
    }
    return `
<div class="message w3-modal-content w3-animate-bottom w3-card-4">
  <header class="w3-container ${translate(type)}">
    <i onclick="wuwei.menu.modal.close()"
        class="fas fa-times w3-right w3-button w3-transparent w3-large w3-margin-bottom"></i>
      ${type
        ? `<h2 class="w3-wide w3-margin-bottom">${translate(type)}</h2>`
        : ''
      }
  </header>
  <div class="w3-container">
    ${html ? message : `<p>${translate(message)}</p>`}
  </div>
  ${input_type
    ? `<div class="w3-container">
        <input id="req" type="${input_type}"/>
        <button type="submit" value="Submit" onclick="wuwei.menu.modal.input()"
            class="w3-button w3-padding-large w3-indigo w3-margin-top w3-margin-bottom">
            OK
        </button>`
    : ''
  }
</div>
`;};

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
})();
