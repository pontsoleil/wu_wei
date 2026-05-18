/**
 * menu.note.template.js
 * menu.note template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.note = wuwei.menu.note || {};
wuwei.menu.note.markup = ( function () {
  function save_template(name, description, thumbnail) {
    return `
<div class="save w3-modal-content w3-animate-zoom w3-card-4">
  <header class="w3-container">
    <i onclick="wuwei.menu.note.close()"
        class="fas fa-times w3-right w3-button w3-transparent w3-large w3-margin-bottom"></i>
    <h2 class="w3-wide w3-margin-bottom">${translate('Save Notebook')}</h2>
  </header>
  <form onsubmit="wuwei.menu.note.save(this); return false;"
      class="w3-container w3-white w3-center">
    <div class="thumbnail w3-center">${thumbnail}</div>
    <div id="progressbar"></div>
    <div>
      <input name="name" value="${name}"
          class="w3-input w3-border" type="text"
          placeholder="${translate('Enter note name')}">
    </div>
    <div>
      <textarea name="description" class="w3-input w3-border">${description}</textarea>
    </div>
    <button type="submit" value="Submit"
        class="w3-button w3-padding-large w3-indigo w3-margin-top w3-margin-bottom">
      ${translate('Save Notebook')}
    </button>
    <input type="button" onclick="wuwei.menu.note.close()"
        class="w3-button w3-padding-large w3-gray w3-margin-top w3-margin-bottom"
        value="${translate('Close')}">
  </form>
  <div class="ajax_result w3-container w3-center"></div>
</div>
`;}

  /**
   * The template listing the user's notes.
   * @param {object} notes - The json retrurned from the server.
   * @param {string} notes.id - The id of the note.
   * @param {string} notes.user_id - The user's id who create the note.
   * @param {string} notes.note_name - The note's name.
   * @param {string} notes.description - The note's description.
   * @param {string} notes.dir - The note's stored relative directory from user's note directory.
   * @param {integer} notes.size - The note's file size.
   * @param {string} notes.timestamp - The timestamp when the note last modified. YYYY-MM-DD+HH:MM:SS.SSSSSSSSSS
   * @param {string} notes.thumbnail - The note's thumbnail.
   */
  function list_template(notes) {
    function parseTimestamp(timestamp) {
      const normalized = String(timestamp || '').trim().replace(/\+/g, ' ');
      const datetime = /^(\d{4}-\d{2}-\d{2})(?:[T\s]+(\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?)?/.exec(normalized);
      if (datetime && datetime[1]) {
        return {
          date: datetime[1],
          time: datetime[2] || ''
        };
      }
      return {
        date: '-',
        time: ''
      };
    }

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function decodeDescription(value) {
      if (!value) {
        return '';
      }
      try {
        return decodeURIComponent(value);
      }
      catch (e) {
        return String(value || '');
      }
    }

    function noteDomId(note, index) {
      const key = String((note && (note.note_key || note.dir || note.key)) || (note && note.id) || index || '');
      return 'note_' + encodeURIComponent(key).replace(/[^A-Za-z0-9_-]/g, '_');
    }

    function noteGallery(notes) {
      if (!notes) {
        notes = [];
      }
      const gallery = notes.map((note, index) => {
        note = note || {};
        const noteId = String(note.id || note.note_id || '');
        const noteKey = String(note.note_key || note.key || note.dir || '');
        const noteFormat = String(note.note_format || note.format || 'ver2');
        const loader = String(note.loader || (noteFormat === 'ver0' ? 'load-note-v0' : (noteFormat === 'ver1' ? 'load-note-v1' : 'load-note')));
        const formatLabel = noteFormat === 'ver0'
          ? '<p class="format">' + escapeHtml(translate('ver0 note')) + '</p>'
          : (noteFormat === 'ver1'
            ? '<p class="format">' + escapeHtml(translate('ver1 note')) + '</p>'
            : '');
        const datetime = parseTimestamp(note.timestamp);
        const date = datetime.date;
        const time = datetime.time;
        const size = wuwei.menu.markup.nFormatter(note.size, 1);
        const description = decodeDescription(note.description);
        const domId = noteDomId(note, index);
        return `
        <div class="note" id="${escapeHtml(domId)}"
            data-id="${escapeHtml(noteId)}"
            data-note-key="${escapeHtml(noteKey)}"
            data-key="${escapeHtml(noteKey)}"
            data-note-format="${escapeHtml(noteFormat)}"
            data-loader="${escapeHtml(loader)}"
            onclick="wuwei.menu.note.load(this)">
          <input type="hidden" class="note_id" value="${escapeHtml(noteId)}">
          <input type="hidden" class="note_key" value="${escapeHtml(noteKey)}">
          <input type="hidden" class="note_format" value="${escapeHtml(noteFormat)}">
          <input type="hidden" class="note_loader" value="${escapeHtml(loader)}">
          <div class="flip-card">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <div class="thumbnail"></div>
              </div>
              <div class="flip-card-back">
                <div class="desc">
                  <p class="name">${escapeHtml(note.note_name || note.name || '')}</p>
                  ${formatLabel}
                  <p>${escapeHtml(date)} ${escapeHtml(time)} ${escapeHtml(size)}</p>
                  <p>${escapeHtml(description)}</p>
                </div>
                <i data-id="${escapeHtml(noteId)}" data-note-key="${escapeHtml(noteKey)}"
                    onclick="wuwei.menu.note.remove(this, event); return false;"
                    class="remove fas fa-trash w3-button w3-transparent w3-large"></i>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
      return gallery;
    }
    return `
<div class="list w3-modal-content w3-animate-zoom w3-card-4">
  <header class="w3-container">
    <h2 class="w3-wide w3-margin-bottom">${translate('List of Notebooks')}</h2>
    <i onclick="wuwei.menu.note.close()"
        class="fas fa-times w3-right w3-button w3-transparent w3-large w3-margin-bottom"></i>
    <div class="w3-left w3-transparent w3-large w3-margin-bottom note-search-filter">
        <input type="text" id="search-text" class="note-search-text" placeholder="${translate('Keyword')}">
        <input type="date" id="note-date-start" title="${translate('Start date')}">
        <input type="date" id="note-date-end" title="${translate('End date')}">
        <label class="note-include-ver0" title="${translate('Include ver0 notes')}">
          <input type="checkbox" id="note-include-ver0">
          ${translate('ver0')}
        </label>
        <label class="note-include-ver1" title="${translate('Include ver1 notes')}">
          <input type="checkbox" id="note-include-ver1">
          ${translate('ver1')}
        </label>
        <button type="button" onclick="wuwei.menu.note.search(); return false;">${translate('Search')}</button>
        <button type="button" onclick="wuwei.menu.note.clearSearch(); return false;">${translate('Clear')}</button>
    </div>
    <div id="pagination" class="w3-right w3-transparent w3-large w3-margin-bottom"></div>
    <div class="ajax_result"></div>
  </header>
  <div id="gallery" class="${wuwei.common.state.iOS? 'iOS' : ''}">${noteGallery(notes)}</div>
</div>`;
  }

  function translate(str) {
    return wuwei.nls.translate(str);
  }

  return {
    save_template: save_template,
    list_template: list_template
  };
})();
// menu.note.markup.js revised 2026-03-09
