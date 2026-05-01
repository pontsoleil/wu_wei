/**
 * menu.upload.js
 * menu.upload module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2019,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.menu = wuwei.menu || {};
wuwei.menu.upload = wuwei.menu.upload || {};

(function (ns) {
  const
    util = wuwei.util,
    model = wuwei.model,
    common = wuwei.common,
    graph = common.graph,
    menu = wuwei.menu;


  function open() {
    console.log('wuwei.menu.upload.open()');
    if (common.state && common.state.loggedIn && common.state.currentUser && common.state.currentUser.user_id) {
      const uploadEl = document.getElementById('upload');
      uploadEl.innerHTML = menu.upload.markup.template();
      uploadEl.style.display = 'block';
      return;
    }
    wuwei.menu.login.check().then(param => {
      console.log(param);
      const uploadEl = document.getElementById('upload');
      uploadEl.innerHTML = menu.upload.markup.template();
      uploadEl.style.display = 'block';
    })
      .catch(error => {
        console.log(error);
        menu.snackbar.open({ type: error.type, message: error.message });
      });
  }


  function close() {
    const loginEl = document.getElementById('upload');
    loginEl.innerHTML = '';
    loginEl.style.display = 'none';
  }


  function upload(form) {
    const fileInput = form.querySelector('input[type="file"][name="file"]');
    const f = fileInput && fileInput.files ? fileInput.files[0] : null;
    const requestedLabelEl = form.querySelector('input[name="fullname"]');
    const requestedLabel = requestedLabelEl ? String(requestedLabelEl.value || '').trim() : '';
    let noteIdEl = form.querySelector('input[name="note_id"]');
    if (!noteIdEl) {
      noteIdEl = document.createElement('input');
      noteIdEl.type = 'hidden';
      noteIdEl.name = 'note_id';
      form.appendChild(noteIdEl);
    }
    noteIdEl.value = (common.current && common.current.note_id) || 'new_note';

    let scriptName = 'upload';

    if (f) {
      const name = (f.name || '').toLowerCase();
      const type = (f.type || '').toLowerCase();
      const isVideo =
        type.startsWith('video/') ||
        /\.(mp4|webm|ogg|mov|m4v)$/.test(name);

      scriptName = isVideo ? 'upload-video' : 'upload';
    }

    form.action = util.getServerUrl(scriptName);
    form.method = 'post';

    wuwei.menu.progressbar.open();

    AjaxSubmit(form)
      .then(responseText => {
        const txt = (responseText ?? '').trim();

        if (!txt) {
          menu.snackbar.open({ type: 'error', message: 'ERROR empty response' });
          return;
        }

        if (txt.includes('#!') || txt.includes('Traceback')) {
          menu.snackbar.open({ type: 'error', message: txt });
          return;
        }

        if (txt[0] !== '{') {
          menu.snackbar.open({ type: 'error', message: txt });
          return;
        }

        let response;
        try {
          response = JSON.parse(txt);
        } catch (e) {
          console.log(e);
          wuwei.menu.snackbar.open({ message: txt, type: 'warning' });
          return;
        }

        if (response.error) {
          menu.snackbar.open({ type: 'error', message: response.error });
          return;
        }

        console.log(response);

        if (requestedLabel) {
          response.label = requestedLabel;
          response.name = requestedLabel;
          if (response.resource && response.resource.identity) {
            response.resource.identity.title = requestedLabel;
          }
        }

        let name = response.label || response.name;
        if (!name && response.uri) {
          name = response.uri.split('/').pop();
        }

        menu.snackbar.open({ type: 'success', message: name + ' uploaded' });

        const logData = model.addUploadedContent(response);
        if (wuwei.home && typeof wuwei.home.addResource === 'function') {
          wuwei.home.addResource(response);
        }
        wuwei.log.storeLog({ operation: scriptName});

        setTimeout(() => {
          close();
          if ('draw' === graph.mode) {
            wuwei.draw.refresh();
          } else if ('simulation' === graph.mode) {
            wuwei.draw.restart();
          }
        }, 1000);
      })
      .catch(e => {
        console.log(e);
        menu.snackbar.open({ type: 'error', message: String(e) });
      });
  }

  ns.open = open;
  ns.upload = upload;
  ns.close = close;
})(wuwei.menu.upload);
// menu.upload.js revised 2026-04-07
