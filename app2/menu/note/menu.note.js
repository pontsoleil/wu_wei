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
    notes,
    currentNoteFormat = 'ver2';

  function sortNote(a, b) {
    if (a.timestamp > b.timestamp) {
      return -1;
    }
    if (a.timestamp < b.timestamp) {
      return 1;
    }
    return 0;
  }



  function normaliseNoteFormat(value) {
    value = String(value || '').trim().toLowerCase();
    if (value === 'v0') return 'ver0';
    if (value === 'v1') return 'ver1';
    if (value === 'v2' || value === 'current') return 'ver2';
    if (value === 'ver0' || value === 'ver1' || value === 'ver2') return value;
    return '';
  }

  function noteFormatOf(data) {
    const format = normaliseNoteFormat(data && (data.note_format || data.format));
    const loader = String(data && data.loader || '').trim().toLowerCase();
    if (format) return format;
    if (loader === 'load-note-v0') return 'ver0';
    if (loader === 'load-note-v1') return 'ver1';
    return 'ver2';
  }

  function loaderForNoteFormat(format, loader) {
    format = normaliseNoteFormat(format) || 'ver2';
    loader = String(loader || '').trim();
    if (loader) return loader;
    if (format === 'ver0') return 'load-note-v0';
    if (format === 'ver1') return 'load-note-v1';
    return 'load-note';
  }

  function noteMatchesCurrentFormat(note, requestedFormat) {
    requestedFormat = normaliseNoteFormat(requestedFormat);
    if (!requestedFormat) return true;
    return noteFormatOf(note) === requestedFormat;
  }

  function addLegacyListFlags(data, format) {
    format = normaliseNoteFormat(format);
    if (format === 'ver0') {
      data.note_format = 'ver0';
      data.include_ver0 = 1;
      data.include_v0 = 1;
      return;
    }
    if (format === 'ver1') {
      data.note_format = 'ver1';
      data.include_ver1 = 1;
      data.include_v1 = 1;
      return;
    }
    if (format === 'ver2') {
      data.note_format = 'ver2';
    }
  }



  function escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderNoteListThumbnail(value) {
    var thumbnail = decodeMaybe(value || '').trim();
    var src;

    if (!thumbnail) {
      return '';
    }

    // Existing notes may store the thumbnail as an SVG fragment.
    if (thumbnail.charAt(0) === '<') {
      return thumbnail;
    }

    // Legacy v0/v1 note lists may store the thumbnail as a URL or local path.
    // Do not discard it; expand it into an image element for the gallery.
    src = thumbnail.replace(/\\/g, '/');
    return '<img class="thumbnail" src="' + escapeAttr(src) + '" alt="">';
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
      end_date: endDate || startDate,
      note_format: normaliseNoteFormat(currentNoteFormat) || '',
      include_ver0: document.getElementById('note-include-ver0')
        ? document.getElementById('note-include-ver0').checked
        : false,
      include_ver1: document.getElementById('note-include-ver1')
        ? document.getElementById('note-include-ver1').checked
        : false
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
    const includeV0El = document.getElementById('note-include-ver0');
    const includeV1El = document.getElementById('note-include-ver1');
    if (includeV0El) includeV0El.checked = !!filters.include_ver0;
    if (includeV1El) includeV1El.checked = !!filters.include_ver1;
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
    
    var thumbnail = (wuwei.note && typeof wuwei.note.updatePageThumbnail === 'function')
      ? wuwei.note.updatePageThumbnail(current.page)
      : util.buildMiniatureSvgString({
        width: 200,
        height: 200,
        nodes: graph.nodes,
        links: graph.links
      });
    if (thumbnail) {
      current.page.thumbnail = thumbnail;
    }
    noteEl.innerHTML = wuwei.menu.note.markup.save_template(name, description, thumbnail || current.page.thumbnail || '');

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
    if (filters.note_format) {
      addLegacyListFlags(req, filters.note_format);
    }
    else {
      if (filters.include_ver0) req.include_ver0 = true;
      if (filters.include_ver1) req.include_ver1 = true;
    }

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
          const thumbnail = renderNoteListThumbnail(data.thumbnail || '');

          const noteKey = String(data.note_key || data.key || data.dir || data.id || '');
          thumbnails[noteKey] = thumbnail;

          const description = decodeMaybe(data.description || '');
          let note_name = decodeMaybe(data.note_name || '').replace(/[\n]/g, '');

          notes.push({
            id: data.id,
            user_id: data.user_id,
            note_name,
            description,
            dir: data.dir,
            note_key: data.note_key || data.key || data.dir || '',
            size: data.size,
            timestamp: data.timestamp,
            thumbnail,
            note_format: noteFormatOf(data),
            loader: loaderForNoteFormat(noteFormatOf(data), data.loader)
          });
        }

        notes = notes.filter(note => noteMatchesCurrentFormat(note, filters.note_format));
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
          const note_key = el.dataset.noteKey || el.dataset.key || el.querySelector('input.note_key')?.value || el.querySelector('input.note_id')?.value;
          const thumbEl = el.querySelector('div.thumbnail');
          if (note_key && thumbEl && thumbnails[note_key]) {
            thumbEl.innerHTML = thumbnails[note_key];
          }
        });

        const current_page = 1 + Math.floor((start - 1) / (count_org * per_page));
        wuwei.menu.pagination.create('pagination', current_page, count_org, per_page, total, function (nextStart, nextCount) {
          search(nextStart, nextCount);
        });

        const seq = Math.floor(start / count_org);
        const page_div = document.querySelectorAll('.pagination div')[seq];
        if (page_div) page_div.classList.add('active');
      })
      .catch(error => notifyError(error));
  }

  /**
   * list notes
   */
  function list(start, count, options) {
    options = options || {};
    currentNoteFormat = normaliseNoteFormat(options.note_format || options.format) || currentNoteFormat || 'ver2';
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

    const listRequest = {};
    addLegacyListFlags(listRequest, currentNoteFormat);
    wuwei.note.listNote(_start, _count, listRequest)
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
          const thumbnail = renderNoteListThumbnail(data.thumbnail || '');

          const noteKey = String(data.note_key || data.key || data.dir || data.id || '');
          thumbnails[noteKey] = thumbnail;

          const description = decodeMaybe(data.description || '');
          let note_name = decodeMaybe(data.note_name || '').replace(/[\n]/g, '');

          notes.push({
            id: data.id,
            user_id: data.user_id,
            note_name,
            description,
            dir: data.dir,
            note_key: data.note_key || data.key || data.dir || '',
            size: data.size,
            timestamp: data.timestamp,
            thumbnail,
            note_format: noteFormatOf(data),
            loader: loaderForNoteFormat(noteFormatOf(data), data.loader)
          });
        }

        notes = notes.filter(note => noteMatchesCurrentFormat(note, currentNoteFormat));
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
          const note_key = el.dataset.noteKey || el.dataset.key || el.querySelector('input.note_key')?.value || el.querySelector('input.note_id')?.value;
          const thumbEl = el.querySelector('div.thumbnail');
          if (note_key && thumbEl && thumbnails[note_key]) {
            thumbEl.innerHTML = thumbnails[note_key];
          }
        });

        const current_page = 1 + Math.floor((start - 1) / (count_org * per_page));
        wuwei.menu.pagination.create('pagination', current_page, count_org, per_page, total, function (nextStart, nextCount) {
          list(nextStart, nextCount, { note_format: currentNoteFormat });
        });

        const seq = Math.floor(start / count_org);
        const page_div = document.querySelectorAll('.pagination div')[seq];
        if (page_div) page_div.classList.add('active');
      })
      .catch(error => notifyError(error));
  }

  function clearSearch() {
    restoreNoteSearchFilters({ term: '', start_date: '', end_date: '', note_format: currentNoteFormat, include_ver0: currentNoteFormat === 'ver0', include_ver1: currentNoteFormat === 'ver1' });
    list(1, _count || 12, { note_format: currentNoteFormat });
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
          updateCurrentNoteNameDisplay(current);

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

  function normalizeExportNoteId(value) {
    let text = String(value || '').trim();

    if (/^t-/i.test(text)) {
      text = text.slice(2);
    }

    text = text.replace(/^_+/, '');

    const m = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (m) {
      return m[0].toLowerCase();
    }

    if (wuwei.util && typeof wuwei.util.createUuid === 'function') {
      return String(wuwei.util.createUuid() || '')
        .replace(/^t-/i, '')
        .replace(/^_+/, '')
        .toLowerCase();
    }

    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID().toLowerCase();
    }

    return String(Date.now());
  }

  function makeFileName(ext) {
    const current = wuwei.common.current || {};
    const noteId = normalizeExportNoteId(current.note_id);
    const base = `t-${noteId}`.replace(/[\\/:*?"<>|]+/g, '_');
    return `${base}${ext || '.txt'}`;
  }

  function noteJsonTextFromFileText(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '').trim();
    if (/^\{/.test(raw)) {
      return raw;
    }
    throw new Error('ERROR NOTE JSON NOT FOUND');
  }

  function summarizeImportedNote(noteJson) {
    const summary = {
      note_id: noteJson && noteJson.note_id,
      pages: 0,
      viewpointGroups: [],
      pageMarkers: []
    };
    const pages = Array.isArray(noteJson && noteJson.pages) ? noteJson.pages : [];
    summary.pages = pages.length;
    pages.forEach(function (page, pageIndex) {
      (page.groups || []).forEach(function (group) {
        if (group && group.type === 'viewpoint') {
          summary.viewpointGroups.push({
            page: pageIndex + 1,
            id: group.id,
            documentRef: group.documentRef,
            mediaRef: group.mediaRef,
            pageCount: group.pageCount,
            members: (group.members || []).length,
            entries: (group.members || []).map(function (member) {
              return {
                nodeId: member && member.nodeId,
                pageNumber: member && member.pageNumber
              };
            })
          });
        }
      });
      (page.nodes || []).forEach(function (node) {
        if (node && (node.type === 'PageMarker' || node.topicKind === 'viewpoint-page')) {
          summary.pageMarkers.push({
            page: pageIndex + 1,
            id: node.id,
            type: node.type,
            topicKind: node.topicKind,
            groupRef: node.groupRef,
            documentRef: node.documentRef,
            pageNumber: node.pageNumber,
            label: node.label
          });
        }
      });
    });
    return summary;
  }

  function decodeZipName(bytes) {
    try {
      return new TextDecoder('utf-8').decode(bytes);
    }
    catch (e) {
      let out = '';
      for (let i = 0; i < bytes.length; i += 1) {
        out += String.fromCharCode(bytes[i]);
      }
      return out;
    }
  }

  function findEndOfCentralDirectory(view) {
    const min = Math.max(0, view.byteLength - 65557);
    for (let p = view.byteLength - 22; p >= min; p -= 1) {
      if (view.getUint32(p, true) === 0x06054b50) {
        return p;
      }
    }
    throw new Error('ERROR ZIP CENTRAL DIRECTORY NOT FOUND');
  }

  function inflateRawZipData(data) {
    if (typeof DecompressionStream !== 'function') {
      return Promise.reject(new Error('ERROR Browser cannot inflate ZIP data'));
    }
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer();
  }

  function readZipEntryText(file, targetName) {
    targetName = String(targetName || 'note.json').replace(/\\/g, '/');
    return file.arrayBuffer().then(function (buffer) {
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);
      const eocd = findEndOfCentralDirectory(view);
      const entryCount = view.getUint16(eocd + 10, true);
      let cdOffset = view.getUint32(eocd + 16, true);
      let found = null;

      for (let i = 0; i < entryCount; i += 1) {
        if (view.getUint32(cdOffset, true) !== 0x02014b50) {
          throw new Error('ERROR ZIP CENTRAL DIRECTORY IS INVALID');
        }
        const method = view.getUint16(cdOffset + 10, true);
        const compressedSize = view.getUint32(cdOffset + 20, true);
        const fileNameLength = view.getUint16(cdOffset + 28, true);
        const extraLength = view.getUint16(cdOffset + 30, true);
        const commentLength = view.getUint16(cdOffset + 32, true);
        const localHeaderOffset = view.getUint32(cdOffset + 42, true);
        const name = decodeZipName(bytes.slice(cdOffset + 46, cdOffset + 46 + fileNameLength)).replace(/\\/g, '/');
        if (name === targetName || name.replace(/^.*\//, '') === targetName) {
          found = { method, compressedSize, localHeaderOffset, name };
          break;
        }
        cdOffset += 46 + fileNameLength + extraLength + commentLength;
      }

      if (!found) {
        throw new Error('ERROR ' + targetName + ' not found in ZIP');
      }
      if (view.getUint32(found.localHeaderOffset, true) !== 0x04034b50) {
        throw new Error('ERROR ZIP LOCAL HEADER IS INVALID');
      }
      const localNameLength = view.getUint16(found.localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(found.localHeaderOffset + 28, true);
      const dataStart = found.localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + found.compressedSize);
      if (found.method === 0) {
        return compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
      }
      if (found.method === 8) {
        return inflateRawZipData(compressed);
      }
      throw new Error('ERROR Unsupported ZIP compression method: ' + found.method);
    }).then(function (textBuffer) {
      return new TextDecoder('utf-8').decode(textBuffer);
    });
  }

  function readNoteJsonFromZipInBrowser(file) {
    return readZipEntryText(file, 'note.json').then(function (noteText) {
      const noteJsonText = noteJsonTextFromFileText(noteText);
      return JSON.parse(noteJsonText);
    });
  }

  function openBusyModal(message) {
    if (wuwei.menu.modal && typeof wuwei.menu.modal.open === 'function') {
      wuwei.menu.modal.open({
        type: 'info',
        message: message,
        timeout: 0
      });
    }
  }

  function closeBusyModal() {
    if (wuwei.menu.modal && typeof wuwei.menu.modal.close === 'function') {
      wuwei.menu.modal.close();
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function downloadFile() {
    try {
      const current = wuwei.common.current || {};
      const cu = wuwei.common.state && wuwei.common.state.currentUser;
      if (!cu || !cu.user_id) {
        wuwei.menu.snackbar.open({ type: 'error', message: 'ERROR NOT LOGGED IN' });
        return;
      }
      openBusyModal('Exporting note. Please wait...');
      wuwei.note.saveNote().then(function () {
        const noteId = wuwei.common.current && wuwei.common.current.note_id;
        if (!noteId) {
          throw new Error('ERROR NOTE ID NOT FOUND');
        }
        const action = wuwei.util.getAction('export-note');
        const url = `${action}?id=${encodeURIComponent(noteId)}&user_id=${encodeURIComponent(cu.user_id)}`;
        return fetch(url, { credentials: 'same-origin' }).then(function (response) {
          if (!response.ok) {
            throw new Error('ERROR Failed to export note: HTTP ' + response.status);
          }
          const contentType = String(response.headers.get('content-type') || '').toLowerCase();
          if (contentType.indexOf('text/') === 0 || contentType.indexOf('json') >= 0) {
            return response.text().then(function (text) {
              throw new Error(String(text || '').trim() || 'ERROR Failed to export note');
            });
          }
          return response.blob();
        });
      }).then(function (blob) {
        downloadBlob(blob, makeFileName('.zip'));
      }).catch(function (e) {
        console.error(e);
        wuwei.menu.snackbar.open({
          type: 'error',
          message: e && e.message ? e.message : 'ERROR Failed to export note'
        });
      }).finally(function () {
        closeBusyModal();
      });
    }
    catch (e) {
      closeBusyModal();
      console.error(e);
      wuwei.menu.snackbar.open({
        type: 'error',
        message: e && e.message ? e.message : 'ERROR Failed to export note'
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
    input.accept = '.zip,application/zip';
    input.click();
    return false;
  }

  function renderCurrentNoteNow() {
    if (!wuwei.draw) {
      return;
    }
    if ('simulation' === wuwei.common.graph.mode && typeof wuwei.draw.restart === 'function') {
      wuwei.draw.restart();
    }
    else if (typeof wuwei.draw.refresh === 'function') {
      wuwei.draw.refresh();
    }
  }

  function updateCurrentNoteNameDisplay(current) {
    var nameEl;
    var descEl;

    if (wuwei.note && typeof wuwei.note.updateNoteNameDisplay === 'function') {
      wuwei.note.updateNoteNameDisplay(current || wuwei.common.current);
      return;
    }

    nameEl = document.querySelector('#note_name .name');
    descEl = document.querySelector('#note_name .description');
    if (nameEl) {
      nameEl.textContent = current && current.note_name || '';
    }
    if (descEl) {
      descEl.textContent = current && current.description || '';
    }
  }

  function applyImportedNote(noteJson) {
    const cu = wuwei.common.state && wuwei.common.state.currentUser || {};
    noteJson.exchange = Object.assign({}, noteJson.exchange || {}, {
      imported: true,
      mode: 'imported',
      source: 'import',
      importedBy: cu.user_id || '',
      importedAt: new Date().toISOString()
    });
    noteJson.jointNoteState = 'imported';
    noteJson.note_scope = 'personal';
    noteJson.team_id = '';
    const current = wuwei.note.updateNote(noteJson);
    updateCurrentNoteNameDisplay(current);
    renderCurrentNoteNow();
    setTimeout(function () {
      if (Array.isArray(current.pages) && current.pages.length > 1) {
        wuwei.menu.refreshPagenation();
      }
      renderCurrentNoteNow();
      wuwei.menu.checkPage();
    }, 0);
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
    openBusyModal('Importing note. Please wait...');
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
    }).finally(function () {
      closeBusyModal();
    });
  }

  function importFile(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) { return; }
    if (/\.zip$/i.test(file.name || '') || /zip/i.test(file.type || '')) {
      importZipFile(file);
      return;
    }
    wuwei.menu.snackbar.open({ type: 'error', message: 'ERROR Import note requires export ZIP' });
  }

  function getNoteRef(el) {
    const target = el && el.closest ? el.closest('.note') || el : el;
    const dataset = (target && target.dataset) || {};
    const valueOf = function (selector) {
      const found = target && target.querySelector ? target.querySelector(selector) : null;
      return found ? found.value : '';
    };
    const note_format = normaliseNoteFormat(dataset.noteFormat || dataset.format || valueOf('input.note_format'));
    return {
      id: String(dataset.id || dataset.noteId || valueOf('input.note_id') || ''),
      note_key: String(dataset.noteKey || dataset.key || dataset.dir || valueOf('input.note_key') || ''),
      note_format: note_format,
      loader: loaderForNoteFormat(note_format, dataset.loader || valueOf('input.note_loader') || '')
    };
  }

  function parseLoadedNoteJson(responseText) {
    responseText = (responseText == null) ? '' : String(responseText);

    const rawHead = responseText.trim();

    if (/^ERROR/.test(rawHead)) {
      throw new Error(responseText);
    }

    if (/^#!\s*\/bin\/sh/.test(rawHead)) {
      throw new Error('ERROR Cannot execute bin/sh');
    }

    let decodedText = decodeMaybe(responseText);
    decodedText = decodedText.replace(/^\uFEFF/, '');
    decodedText = decodedText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    decodedText = decodedText.replace(/\u0006/g, ' ');
    decodedText = decodedText.trim();

    return JSON.parse(decodedText);
  }

  function openNoteFromJson(noteJson) {
    current = wuwei.note.updateNote(noteJson);

    updateCurrentNoteNameDisplay(current);

    renderCurrentNoteNow();

    setTimeout(() => {
      if (Array.isArray(current.pages) && current.pages.length > 1) {
        wuwei.menu.refreshPagenation();
      }

      renderCurrentNoteNow();
      wuwei.menu.checkPage();
    }, 0);
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

    const noteRef = getNoteRef(el);

    if (!noteRef.note_key && !noteRef.id) {
      wuwei.menu.snackbar.open({ type: 'error', message: 'ERROR NOTE KEY NOT SPECIFIED' });
      wuwei.menu.modal.close();
      return;
    }

    const isVer0 = noteRef.note_format === 'ver0' || noteRef.loader === 'load-note-v0';
    const isVer1 = noteRef.note_format === 'ver1' || noteRef.loader === 'load-note-v1';
    let loadPromise;

    if (isVer0) {
      if (!wuwei.note.v0 || typeof wuwei.note.v0.loadNote !== 'function') {
        wuwei.menu.snackbar.open({ type: 'error', message: 'ERROR wuwei.note.v0 is not loaded' });
        wuwei.menu.modal.close();
        return;
      }
      wuwei.note.newNote();
      loadPromise = wuwei.note.v0.loadNote(noteRef);
    }
    else if (isVer1) {
      if (!wuwei.note.v1 || typeof wuwei.note.v1.loadNote !== 'function') {
        wuwei.menu.snackbar.open({ type: 'error', message: 'ERROR wuwei.note.v1 is not loaded' });
        wuwei.menu.modal.close();
        return;
      }
      wuwei.note.newNote();
      loadPromise = wuwei.note.v1.loadNote(noteRef);
    }
    else {
      loadPromise = wuwei.note.loadNote(noteRef).then(parseLoadedNoteJson);
    }

    loadPromise
      .then(noteJson => {
        openNoteFromJson(noteJson);
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
    const target = el && el.closest ? el.closest('.note') : el;
    const noteRef = getNoteRef(target || el);
    const note_id = noteRef.id;
    if (!noteRef.note_key && !note_id) {
      console.warn('remove note: note key is missing');
      return false;
    }
    wuwei.note.removeNote(noteRef)
      .then(responseText => {
        if (responseText.indexOf('#! /bin/sh') >= 0) {
          responseText = 'ERROR Cannnot execute bin/sh';
          wuwei.menu.snackbar.open({ type: 'error', message: responseText });
        }
        else if (/^ERROR|^500 Internal Server Error/.test(String(responseText || '').trim())) {
          wuwei.menu.snackbar.open({ type: 'error', message: decodeMaybe(responseText).replace(/[\n]/g, '').trim() });
        }
        else {
          const noteEl = target && target.classList && target.classList.contains('note')
            ? target
            : (target && target.closest ? target.closest('.note') : null);
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
// menu.note.js last modified 2026-05-11

// menu.note.js revised 2026-05-11
