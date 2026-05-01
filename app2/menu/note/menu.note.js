/**
 * menu.note.js
 * menu.note module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.note = wuwei.menu.note || {};

(function (ns) {
  const
    common = wuwei.common,
    graph = common.graph,
    per_page = 5,
    nls = wuwei.nls;
  let
    iOS,
    total,
    count_org,
    _start,
    _count,
    notes;

  function sortNote(a, b) {
    if (a.timestamp > b.timestamp) {
      return -1;
    }
    if (a.timestamp < b.timestamp) {
      return 1;
    }
    return 0;
  }

  function notifyError(error) {
    if ('warn' === error.type) {
      wuwei.menu.snackbar.open({ type: 'warning', message: error.message });
    }
    else {
      wuwei.menu.snackbar.open({ type: 'danger', message: JSON.stringify(error) });
    }
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

  function noteSearchFilters() {
    let startDate = (document.getElementById('note-date-start')?.value || '').trim();
    let endDate = (document.getElementById('note-date-end')?.value || '').trim();
    if (startDate && endDate && endDate < startDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }
    return {
      term: (document.getElementById('search-text')?.value || '').trim(),
      start_date: startDate,
      end_date: endDate || startDate
    };
  }

  function restoreNoteSearchFilters(filters) {
    filters = filters || {};
    const termEl = document.getElementById('search-text');
    const startEl = document.getElementById('note-date-start');
    const endEl = document.getElementById('note-date-end');
    if (termEl) termEl.value = filters.term || '';
    if (startEl) startEl.value = filters.start_date || '';
    if (endEl) endEl.value = filters.end_date || '';
  }

  function open() {
    const
      util = wuwei.util,
      common = wuwei.common,
      current = common.current,
      graph = wuwei.common.graph,
      name = wuwei.common.current.note_name || document.querySelector('#note_name .name').innerHTML,
      noteEl = document.getElementById('note');

    var description = wuwei.common.current.description || document.querySelector('#note_name .description').innerHTML;
    description = decodeMaybe(description);
    
    var thumbnail = util.buildMiniatureSvgString({
      width: 200,
      height: 200,
      nodes: graph.nodes,
      links: graph.links
    });
    current.page.thumbnail = thumbnail
    noteEl.innerHTML = wuwei.menu.note.markup.save_template(name, description, thumbnail);

    noteEl.style.display = 'block';
  }

  /**
   * close note window
   */
  function close() {
    const noteEl = document.getElementById('note');
    noteEl.innerHTML = '';
    noteEl.style.display = 'none';
  }

  /**
   * search notes
   */
  function search(start, count) {
    const filters = noteSearchFilters();
    const term = filters.term;

    const state = wuwei.common.state;
    const noteEl = document.getElementById('note');
    const galleryWidth = window.innerWidth - 60;
    const noteWidth = state.iOS ? 108 : 216;
    const columncount = Math.floor(galleryWidth / noteWidth);
    const galleryHeight = state.iOS ? window.innerHeight - 100 : window.innerHeight - 200;
    const noteHeight = state.iOS ? 108 : 216;

    let rowcount = Math.floor(galleryHeight / noteHeight);
    if (rowcount <= 0) rowcount = 1;

    _count = columncount * rowcount;
    _start = Number(start) || 1;

    const thumbnails = {};
    const nullNotes = {
      term,
      total: 0,
      count_org: 0,
      start: _start,
      count: _count,
      notes: []
    };

    const req = {
      start: _start,
      count: _count
    };
    if (term) req.term = term;
    if (filters.start_date) req.start_date = filters.start_date;
    if (filters.end_date) req.end_date = filters.end_date;

    wuwei.note.searchNote(req)
      .then(responseText => {
        wuwei.menu.modal.close();

        responseText = (responseText == null) ? '' : String(responseText);

        let text = responseText
          .replace(/^\uFEFF/, '')
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
          .trim();

        if (/^ERROR/.test(text)) {
          wuwei.menu.snackbar.open({ type: 'error', message: text });
          return nullNotes;
        }
        if (/^#!\s*\/bin\/sh/.test(text)) {
          wuwei.menu.snackbar.open({
            type: 'error',
            message: 'ERROR Cannot execute bin/sh'
          });
          return nullNotes;
        }

        let response;
        try {
          response = JSON.parse(text);
        } catch (e) {
          console.error('list() JSON parse error:', e);
          console.log('responseText:', responseText);
          wuwei.menu.snackbar.open({ message: text, type: 'warning' });
          return nullNotes;
        }

        total = Number(response.total) || 0;
        count_org = Number(response.count_org) || 0;
        _start = Number(response.start) || _start;
        _count = Number(response.count) || _count;

        const _notes = response.note || [];
        notes = [];

        for (const data of _notes) {
          let thumbnail = decodeMaybe(data.thumbnail || '');
          if (!thumbnail || thumbnail[0] !== '<') thumbnail = '';

          thumbnails[data.id] = thumbnail;

          const description = decodeMaybe(data.description || '');
          let note_name = decodeMaybe(data.note_name || '').replace(/[\n]/g, '');

          notes.push({
            id: data.id,
            user_id: data.user_id,
            note_name,
            description,
            dir: data.dir,
            size: data.size,
            timestamp: data.timestamp,
            thumbnail
          });
        }

        notes.sort(sortNote);

        return {
          term,
          filters,
          total,
          count_org,
          start: _start,
          count: _count,
          notes
        };
      })
      .then(result => {
        if (!result) return;

        const { total, count_org, start, notes } = result;

        noteEl.innerHTML = wuwei.menu.note.markup.list_template(notes);
        restoreNoteSearchFilters(result.filters);
        noteEl.style.display = 'block';

        const elements = noteEl.querySelectorAll('div.note');
        elements.forEach(el => {
          const note_id = el.querySelector('input.note_id')?.value;
          const thumbEl = el.querySelector('div.thumbnail');
          if (note_id && thumbEl && thumbnails[note_id]) {
            thumbEl.innerHTML = thumbnails[note_id];
          }
        });

        const current_page = 1 + Math.floor((start - 1) / (count_org * per_page));
        wuwei.menu.pagination.create('pagination', current_page, count_org, per_page, total, search);

        const seq = Math.floor(start / count_org);
        const page_div = document.querySelectorAll('.pagination div')[seq];
        if (page_div) page_div.classList.add('active');
      })
      .catch(error => notifyError(error));
  }

  /**
   * list notes
   */
  function list(start, count) {
    console.log('wuwei.note.list()');

    const ua = window.navigator.userAgent;
    if (ua.match(/iPad/i)) iOS = 'iPad';
    else if (ua.match(/iPhone/i)) iOS = 'iPhone';
    else iOS = null;

    const state = wuwei.common.state;

    state.iOS = iOS;

    const noteEl = document.getElementById('note');
    _start = Number(start) || 1;

    const galleryWidth = window.innerWidth - 60;
    const noteWidth = state.iOS ? 108 : 216;
    const columncount = Math.floor(galleryWidth / noteWidth);

    const galleryHeight = state.iOS ? window.innerHeight - 100 : window.innerHeight - 200;
    const noteHeight = state.iOS ? 108 : 216;

    let rowcount = Math.floor(galleryHeight / noteHeight);
    if (rowcount <= 0) rowcount = 1;

    if (iOS) noteEl.style['padding-top'] = '20px';

    _count = columncount * rowcount;

    const thumbnails = {};
    const nullNotes = {
      total: 0,
      count_org: 0,
      start: _start,
      count: _count,
      notes: []
    };

    wuwei.note.listNote(_start, _count)
      .then(responseText => {
        wuwei.menu.modal.close();

        responseText = (responseText == null) ? '' : String(responseText);

        let text = responseText
          .replace(/^\uFEFF/, '')
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
          .trim();

        if (/^ERROR/.test(text)) {
          wuwei.menu.snackbar.open({ type: 'error', message: text });
          return nullNotes;
        }
        if (/^#!\s*\/bin\/sh/.test(text)) {
          wuwei.menu.snackbar.open({
            type: 'error',
            message: 'ERROR Cannot execute bin/sh'
          });
          return nullNotes;
        }

        let response;
        try {
          response = JSON.parse(text);
        } catch (e) {
          console.error('list() JSON parse error:', e);
          console.log('responseText:', responseText);
          wuwei.menu.snackbar.open({ message: text, type: 'warning' });
          return nullNotes;
        }

        total = Number(response.total) || 0;
        count_org = Number(response.count_org) || 0;
        _start = Number(response.start) || _start;
        _count = Number(response.count) || _count;

        const _notes = response.note || [];
        notes = [];

        for (const data of _notes) {
          let thumbnail = decodeMaybe(data.thumbnail || '');
          if (!thumbnail || thumbnail[0] !== '<') thumbnail = '';

          thumbnails[data.id] = thumbnail;

          const description = decodeMaybe(data.description || '');
          let note_name = decodeMaybe(data.note_name || '').replace(/[\n]/g, '');

          notes.push({
            id: data.id,
            user_id: data.user_id,
            note_name,
            description,
            dir: data.dir,
            size: data.size,
            timestamp: data.timestamp,
            thumbnail
          });
        }

        notes.sort(sortNote);

        return { total, count_org, start: _start, count: _count, notes };
      })
      .then(result => {
        if (!result) return;

        const { total, count_org, start, notes } = result;

        noteEl.innerHTML = wuwei.menu.note.markup.list_template(notes);
        noteEl.style.display = 'block';

        const elements = noteEl.querySelectorAll('div.note');
        elements.forEach(el => {
          const note_id = el.querySelector('input.note_id')?.value;
          const thumbEl = el.querySelector('div.thumbnail');
          if (note_id && thumbEl && thumbnails[note_id]) {
            thumbEl.innerHTML = thumbnails[note_id];
          }
        });

        const current_page = 1 + Math.floor((start - 1) / (count_org * per_page));
        wuwei.menu.pagination.create('pagination', current_page, count_org, per_page, total, list);

        const seq = Math.floor(start / count_org);
        const page_div = document.querySelectorAll('.pagination div')[seq];
        if (page_div) page_div.classList.add('active');
      })
      .catch(error => notifyError(error));
  }

  function clearSearch() {
    restoreNoteSearchFilters({ term: '', start_date: '', end_date: '' });
    list(1, _count || 12);
  }

  /**
   * save note
   * @param {object} form - HTML form
   */
  function save(form) {
    wuwei.menu.progressbar.open();
    wuwei.note.saveNote(form)
      .then(responseText => {
        responseText = String(responseText || '');
        if (responseText.indexOf('#! /bin/sh') >= 0) {
          responseText = 'ERROR Cannnot execute bin/sh';
          wuwei.menu.snackbar.open({ type: 'error', message: responseText });
        }
        else {
          let note_name = decodeMaybe(responseText).replace(/[\n]/g, '').trim();
          const result = `${wuwei.nls.translate('Notebook saved in cloud as')} ${note_name}`;
          const current = wuwei.common.current;
          current.note_name = note_name;
          document.querySelector('#note .ajax_result').innerHTML = result;
          document.querySelector('#note_name .name').innerHTML = current.note_name;
          document.querySelector('#note_name .description').innerHTML = current.description;

          close();

          wuwei.menu.snackbar.open({
            type: 'success',
            message: result
          });
        }
      })
      .catch(e => {

        close();

        responseText = 'Server returns ' + e.status + ' ' + e.statusText
        wuwei.menu.snackbar.open({
          type: 'error',
          message: responseText
        });
        console.log(e);
      });
  }

  function publish() {
    wuwei.menu.publish.publish({ close: close });
  }

  function makeFileName(ext) {
    const current = wuwei.common.current || {};
    const base = String(current.note_name || current.note_id || 'wuwei-note')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '') || 'wuwei-note';
    return `${base}${ext || '.txt'}`;
  }

  function downloadFile() {
    try {
      const current = wuwei.common.current || {};
      const cu = wuwei.common.state && wuwei.common.state.currentUser;
      const canUseServerBundle = current.note_id && cu && cu.user_id;
      if (canUseServerBundle) {
        wuwei.note.saveNote().then(function () {
          const action = wuwei.util.getAction('export-note');
          const url = `${action}?id=${encodeURIComponent(wuwei.common.current.note_id)}&user_id=${encodeURIComponent(cu.user_id)}`;
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = makeFileName('.zip');
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        }).catch(function (e) {
          console.error(e);
          wuwei.menu.snackbar.open({
            type: 'error',
            message: e && e.message ? e.message : 'ERROR Failed to download note file'
          });
        });
        return;
      }

      const text = wuwei.note.exportNoteText();
      Promise.resolve(text).then(function (noteText) {
        const blob = new Blob([noteText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = makeFileName('.txt');
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      }).catch(function (e) {
        console.error(e);
        wuwei.menu.snackbar.open({
          type: 'error',
          message: e && e.message ? e.message : 'ERROR Failed to download note file'
        });
      });
    }
    catch (e) {
      console.error(e);
      wuwei.menu.snackbar.open({
        type: 'error',
        message: e && e.message ? e.message : 'ERROR Failed to download note file'
      });
    }
  }

  function discard() {
    const message = nls.translate('Discard current note without saving?');
    if (!window.confirm(message)) {
      return false;
    }
    wuwei.note.newNote();
    if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
      wuwei.draw.refresh();
    }
    wuwei.menu.snackbar.open({
      type: 'success',
      message: nls.translate('Discarded current note')
    });
    return true;
  }

  function openFile() {
    const input = document.getElementById('noteFileInput');
    if (!input) {
      wuwei.menu.snackbar.open({ type: 'error', message: 'ERROR note file input is missing' });
      return false;
    }
    input.value = '';
    input.onchange = importFile;
    input.accept = '.zip,.txt,.json,.wuwei,.note,application/zip,application/json,text/plain';
    input.click();
    return false;
  }

  function applyImportedNote(noteJson) {
    const current = wuwei.note.updateNote(noteJson);
    const nameEl = document.querySelector('#note_name .name');
    const descEl = document.querySelector('#note_name .description');
    if (nameEl) { nameEl.textContent = current.note_name || ''; }
    if (descEl) { descEl.textContent = current.description || ''; }
    if (current.pages && Object.keys(current.pages).length > 1) {
      wuwei.menu.refreshPagenation();
    }
    if ('simulation' === wuwei.common.graph.mode) {
      wuwei.draw.restart();
    }
    else {
      wuwei.draw.refresh();
    }
    wuwei.menu.checkPage();
  }

  function importZipFile(file) {
    const cu = wuwei.common.state && wuwei.common.state.currentUser;
    if (!cu || !cu.user_id) {
      wuwei.menu.snackbar.open({ type: 'error', message: 'ERROR NOT LOGGED IN' });
      return;
    }
    const form = new FormData();
    form.append('user_id', cu.user_id);
    form.append('file', file);
    fetch(wuwei.util.getAction('import-note'), {
      method: 'POST',
      body: form,
      credentials: 'same-origin'
    }).then(function (response) {
      return response.text();
    }).then(function (text) {
      text = String(text || '').replace(/^\uFEFF/, '').trim();
      if (/^ERROR/.test(text)) {
        throw new Error(text);
      }
      let noteJson;
      try {
        noteJson = JSON.parse(text);
      }
      catch (e) {
        console.error('import bundle JSON parse error:', e);
        console.log('import response:', text);
        throw new Error('ERROR Invalid imported note JSON');
      }
      applyImportedNote(noteJson);
      wuwei.menu.snackbar.open({ type: 'success', message: 'Imported note bundle' });
    }).catch(function (e) {
      console.error(e);
      wuwei.menu.snackbar.open({
        type: 'error',
        message: e && e.message ? e.message : 'ERROR Failed to import note bundle'
      });
    });
  }

  function importFile(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) { return; }
    if (/\.zip$/i.test(file.name || '') || /zip/i.test(file.type || '')) {
      importZipFile(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const text = String(reader.result || '').replace(/^\uFEFF/, '').trim();
        const noteJson = JSON.parse(text);
        applyImportedNote(noteJson);
        wuwei.menu.snackbar.open({ type: 'success', message: 'Imported note file' });
      }
      catch (e) {
        console.error(e);
        wuwei.menu.snackbar.open({
          type: 'error',
          message: e && e.message ? e.message : 'ERROR Failed to import note file'
        });
      }
    };
    reader.onerror = function () {
      wuwei.menu.snackbar.open({ type: 'error', message: 'ERROR Failed to read note file' });
    };
    reader.readAsText(file, 'utf-8');
  }

  /**
   * load note
   * @param {*} el 
   */
  function load(el) {
    wuwei.common.state.viewOnly = false;
    wuwei.common.state.published = false;
    wuwei.menu.modal.open({
      message: wuwei.nls.translate('Loading'),
      type: 'info',
      timeout: 5000
    });

    const note_id = el.dataset.id;

    wuwei.note.loadNote(note_id)
      .then(responseText => {
        // 念のため文字列化
        responseText = (responseText == null) ? '' : String(responseText);

        // 実行エラー系は parse 前に判定
        const rawHead = responseText.trim();

        if (/^ERROR/.test(rawHead)) {
          wuwei.menu.snackbar.open({ type: 'error', message: responseText });
          return;
        }

        if (/^#!\s*\/bin\/sh/.test(rawHead)) {
          wuwei.menu.snackbar.open({
            type: 'error',
            message: 'ERROR Cannot execute bin/sh'
          });
          return;
        }

        let noteJson;
        try {
          let decodedText = decodeMaybe(responseText);

          // BOM除去
          decodedText = decodedText.replace(/^\uFEFF/, '');

          // JSONとして不正になりやすい制御文字を除去
          // \n \r \t は残し、それ以外の 0x00-0x1F を除去
          decodedText = decodedText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

          // 今回問題になっている \u0006 を空白化
          decodedText = decodedText.replace(/\u0006/g, ' ');

          // 前後の空白のみ除去
          decodedText = decodedText.trim();

          noteJson = JSON.parse(decodedText);
        }
        catch (e) {
          console.error('load() JSON parse error:', e);
          console.log('responseText:', responseText);
          wuwei.menu.snackbar.open({
            type: 'error',
            message: 'ERROR Invalid CGI response'
          });
          return;
        }

        current = wuwei.note.updateNote(noteJson);

        const nameEl = document.querySelector('#note_name .name');
        const descEl = document.querySelector('#note_name .description');

        if (nameEl) {
          nameEl.textContent = current.note_name || '';
        }
        if (descEl) {
          descEl.textContent = current.description || '';
        }

        setTimeout(() => {
          if (current.pages && Object.keys(current.pages).length > 1) {
            wuwei.menu.refreshPagenation();
          }

          if ('simulation' === wuwei.common.graph.mode) {
            wuwei.draw.restart();
          }
          else {
            wuwei.draw.refresh();
          }

          wuwei.menu.checkPage();
        }, 1000);
      })
      .catch(err => {
        console.error(err);
        wuwei.menu.snackbar.open({
          type: 'error',
          message: err && err.message ? err.message : 'ERROR Failed to load note'
        });
      })
      .finally(() => {
        wuwei.menu.modal.close();
        close();
      });
  }

  /**
   * remove note
   */
  function remove(el, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation(); // ★親の note.onclick(load) へ行かせない
    }
    const target = el && el.closest ? el.closest('[data-id]') : el;
    const note_id = (target && target.dataset && target.dataset.id) || '';
    if (!note_id) {
      console.warn('remove note: note id is missing');
      return false;
    }
    wuwei.note.removeNote(note_id)
      .then(responseText => {
        if (responseText.indexOf('#! /bin/sh') >= 0) {
          responseText = 'ERROR Cannnot execute bin/sh';
          wuwei.menu.snackbar.open({ type: 'error', message: responseText });
        }
        else if (/^ERROR|^500 Internal Server Error/.test(String(responseText || '').trim())) {
          wuwei.menu.snackbar.open({ type: 'error', message: decodeMaybe(responseText).replace(/[\n]/g, '').trim() });
        }
        else {
          const noteEl = document.getElementById('note_' + note_id);
          if (noteEl) {
            noteEl.remove();
          }
          close();
          list(_start, _count);
          let decodedText = decodeMaybe(responseText).replace(/[\n]/g, '').trim();
          wuwei.menu.snackbar.open({
            type: 'success',
            message: decodedText
          });
        }
      })
      .catch(e => {
        console.log(e);
      });
  }

  ns.open = open;
  ns.close = close;
  ns.search = search;
  ns.clearSearch = clearSearch;
  ns.list = list;
  ns.load = load;
  ns.save = save;
  ns.publish = publish;
  ns.downloadFile = downloadFile;
  ns.discard = discard;
  ns.openFile = openFile;
  ns.remove = remove;
})(wuwei.menu.note);
// menu.note.js revised 2026-04-16
