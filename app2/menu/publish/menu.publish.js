/**
 * menu.publish.js
 * Publish result modal controller.
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.publish = wuwei.menu.publish || {};

(function (ns) {
  let publishedUrl = '';

  function publish(option) {
    option = option || {};
    wuwei.menu.progressbar.open();
    wuwei.note.saveNote(null)
      .then(() => wuwei.note.publishNote())
      .then(responseText => {
        responseText = String(responseText || '');
        if (responseText.indexOf('#! /bin/sh') >= 0) {
          throw new Error('ERROR Cannot execute bin/sh');
        }

        const noteUrl = extractPublishedNoteUrl(responseText);
        if (!noteUrl) {
          throw new Error('ERROR Publish URL is empty');
        }

        const result = `${wuwei.nls.translate('Notebook')} ${wuwei.nls.translate('Publish')}`;
        if (typeof option.close === 'function') {
          option.close();
        }
        open(noteUrl);
        wuwei.menu.snackbar.open({
          type: 'success',
          message: result
        });
      })
      .catch(e => {
        console.log(e);
        wuwei.menu.snackbar.open({
          type: 'error',
          message: e && e.message ? e.message : 'ERROR Publish failed'
        });
      })
      .finally(() => {
        wuwei.menu.progressbar.close();
      });
  }

  function open(noteUrl) {
    publishedUrl = toPublicNoteUrl(noteUrl);
    if (!publishedUrl) {
      wuwei.menu.snackbar.open({ type: 'error', message: 'ERROR Publish URL is empty' });
      return;
    }
    const host = ensureHost();
    host.innerHTML = wuwei.menu.publish.markup.result_template(publishedUrl);
    host.style.display = 'block';
    host.classList.remove('hidden');
  }

  function close() {
    const host = document.getElementById('publishModal');
    if (!host) { return; }
    host.innerHTML = '';
    host.style.display = 'none';
    host.classList.add('hidden');
  }

  function ensureHost() {
    let host = document.getElementById('publishModal');
    if (!host) {
      host = document.createElement('div');
      host.id = 'publishModal';
      host.className = 'publish-modal hidden';
      host.style.display = 'none';
      document.body.appendChild(host);
    }
    return host;
  }

  function extractPublishedNoteUrl(responseText) {
    const decoded = decodeMaybe(responseText).replace(/[\r\n]/g, '').trim();
    if (!decoded) { return ''; }
    if (!/^[\[{]/.test(decoded)) {
      return decoded;
    }
    const json = JSON.parse(decoded);
    return String(json.publicUrl || json.public_url || json.note_url || json.url || json.path || '').trim();
  }

  function decodeMaybe(text) {
    if ('string' !== typeof text) {
      return '';
    }
    if (!/%[0-9A-Fa-f]{2}/.test(text)) {
      return text;
    }
    try {
      return decodeURIComponent(text);
    }
    catch (e) {
      console.warn('decodeURIComponent failed:', e);
      return text;
    }
  }

  function openPublishedUrl() {
    const url = publishedUrl || document.getElementById('publishUrl')?.value || '';
    if (!url) { return false; }
    window.open(url, '_blank', 'noopener');
    return false;
  }

  function copyPublishedUrl() {
    const input = document.getElementById('publishUrl');
    const url = (input && input.value) || publishedUrl || '';
    if (!url) { return false; }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(url)
        .then(() => {
          wuwei.menu.snackbar.open({ type: 'success', message: 'Copied' });
        })
        .catch(() => fallbackCopyUrl(input, url));
      return false;
    }
    fallbackCopyUrl(input, url);
    return false;
  }

  function fallbackCopyUrl(input, url) {
    if (!input) {
      input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
    }
    input.focus();
    input.select();
    document.execCommand('copy');
    if (input.parentNode === document.body && input.id !== 'publishUrl') {
      input.remove();
    }
    wuwei.menu.snackbar.open({ type: 'success', message: 'Copied' });
  }

  function toPublicNoteUrl(noteUrl) {
    const url = String(noteUrl || '').trim();
    if (!url) { return ''; }
    if (/^https?:\/\//i.test(url)) { return url; }
    const path = url.replace(/^\/+/, '');
    return `${window.location.origin}${window.location.pathname}?note=${path}&u=guest`;
  }

  ns.publish = publish;
  ns.open = open;
  ns.close = close;
  ns.openPublishedUrl = openPublishedUrl;
  ns.copyPublishedUrl = copyPublishedUrl;
  ns.toPublicNoteUrl = toPublicNoteUrl;
})(wuwei.menu.publish);
