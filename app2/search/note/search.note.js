/**
 * search.note.js
 * search.note module
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.search.note = ( function () {
  const common = wuwei.common,
        menu = wuwei.menu,
        search = wuwei.search,
        fileMap = new Map(),
        stateMap = {
          start: null,
          count: null
        };
  let searchNote;

  function showInfo(id) {
    const file = fileMap.get(id);
    console.log(file);
    wuwei.info.open(null, file);
  }

  function noterecord(id) {
    const file = fileMap.get(id);
    console.log(file);
    const
      map = {
        command: 'noterecord',
        param: {
          id: id,
          file: file
        }
      };
    wuwei.search.searchRender(map);
  }

  function registerButton() {
    let button = document.getElementById('search-button'),
        text = button.innerHTML;
    button.innerHTML = `${wuwei.nls.translate('Notebook')}<br>${text}`;
    button.style.fontSize = '6pt';
    button.style.lineHeight = '11px';
    document.getElementById('search-button').addEventListener('click', function(e) {
      e.preventDefault();
      var loading = document.getElementById('loading'),
          currentUser = common.state.currentUser,
          user_id = currentUser.user_id,
          term = document.getElementById('search-text').value;
      loading.classList.remove('hidden');
      term = term.replace(/ /g, '+');
      if (user_id) {
        wuwei.file.searchFile({term: term})
        .then(responseText => {
          console.log(responseText);
          loading.classList.add('hidden');
          listNote(responseText);
        })
        .catch(err => {
          console.log(err);
          menu.snackbar.open({'type': 'error', 'message': err});
        });
      } else {
        menu.snackbar.open({type: 'warn', message: 'Please logged in.'});
      }
    });
  }

  function listNote(responseText) {
    if (responseText.indexOf('{') >= 0) {
      try {
        const response = JSON.parse(responseText);
        if (response.r) {
          const files = response.r;
          files.forEach(file => {
            fileMap.set(file.id, file);
          });
          searchNote.innerHTML = wuwei.search.note.markup.template(/*year, month,*/files);
        }
      }
      catch(e) { console.log(e); }
    }
    else if (responseText.trim().match(/^ERROR/)) {
      menu.snackbar.open({ type: 'error', message: responseText });
      return nullNotes;
    }
    else {
      menu.snackbar.open({'type': 'error', 'message': response});
    }
  }

  function open() {
    let today = new Date(),
        // year = today.getFullYear(),
        // month = today.getMonth() + 1,
        currentUser = common.state.currentUser,
        user_id = currentUser.user_id;
    searchNote = document.getElementById('search-note');
    searchNote.style.display = 'block';
    searchNote.innerHTML = search.note.markup.template();
    // search.note.markup.add_calendar(year, month);
    registerButton();
  }

  function close() {
    document.getElementById('search-note').style.display = 'none';
  }

  function initModule() {
  }

  return {
    showInfo: showInfo,
    noterecord: noterecord,
    open: open,
    close: close,
    initModule: initModule
  };
})();
// search.note.js
