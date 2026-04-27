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

    function noteGallery(notes) {
      if (!notes) {
        notes = [];
      }
      const gallery = notes.map(note => {
        const datetime = parseTimestamp(note.timestamp);
        const date = datetime.date;
        const time = datetime.time;
        const size = wuwei.menu.markup.nFormatter(note.size, 1);
        const description = note.description && decodeURIComponent(note.description) || '';
        return `
        <div class="note" id="note_${note.id}"
            data-id="${note.id}" onclick="wuwei.menu.note.load(this)">
          <input type="hidden" class="note_id" value="${note.id}">
          <div class="flip-card">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <div class="thumbnail"></div>
              </div>
              <div class="flip-card-back" data-id="${note.id}">
                <div class="desc">
                  <p class="name">${note.note_name}</p>
                  <p>${date} ${time} ${size}</p>
                  <p>${description}</p>
                </div>
                <i data-id="${note.id}" onclick="wuwei.menu.note.remove(this, event); return false;"
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
    <p onchange="wuwei.menu.note.search()"
        class="w3-left w3-transparent w3-large w3-margin-bottom">
        <input type="text" id="search-text" class="search">
    </p>
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
