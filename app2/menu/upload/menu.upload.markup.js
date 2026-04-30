/**
 * menu.upload.template.js
 * menu.upload template
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.menu = wuwei.menu || {};
wuwei.menu.upload = wuwei.menu.upload || {};
wuwei.menu.upload.markup = ( function () {
  function template() {
    let state = wuwei.common.state,
        currentUser = state.currentUser,
        current = wuwei.common.current || {},
        user = currentUser.login,
        user_id = currentUser.user_id,
        note_id = current.note_id || 'new_note',
        token = currentUser.token,
        uploadAction = (wuwei.util && typeof wuwei.util.getServerUrl === 'function')
          ? wuwei.util.getServerUrl('upload')
          : 'server/upload.cgi';
    const html = `
  <div class="upload w3-modal-content w3-animate-zoom w3-card-4" style="width:50%">
    <header class="w3-container">
      <i onclick="wuwei.menu.upload.close()"
          class="fas fa-times w3-right w3-button w3-transparent w3-large w3-margin-bottom"></i>
      <h2 class="w3-wide w3-margin-bottom">${translate('Upload')}</h2>
    </header>
    <form onsubmit="wuwei.menu.upload.upload(this); return false;"
        action="${uploadAction}" method="post" enctype="multipart/form-data"
        class="w3-container w3-white w3-center">
      <input type="hidden" id="user" name="user" value="${user}">
      <input type="hidden" id="user_id" name="user_id" value="${user_id}">
      <input type="hidden" id="note_id" name="note_id" value="${note_id}">
      <input type="hidden" id="token" name="token" value="${token}">
      <p><input type="file" name="file" class="w3-input w3-border"
          placeholder="${translate('File')}"></p>
      <p><input type="text" name="fullname" class="w3-input w3-border"
          placeholder="${translate('Name')}"></p>
      <div id="progressbar"></div>
      <button type="submit" value="Submit"
          class="w3-button w3-padding-large w3-indigo w3-margin-top w3-margin-bottom">
        ${translate('Upload')}
      </button>
      <input type="button" onclick="wuwei.menu.upload.close()"
          class="w3-button w3-padding-large w3-gray w3-margin-top w3-margin-bottom"
          value="${translate('Close')}">
    </form>
  </div>
  `;
    return html;
  }

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    template: template
  };
})();
// menu.upload.markup.js
