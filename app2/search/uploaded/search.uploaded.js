/**
 * search.uploaded.js
 * search.uploaded module
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.search.uploaded = ( function () {

  const common = wuwei.common,
        menu = wuwei.menu,
        search = wuwei.search,
        fileMap = new Map(),
        stateMap = {
          start: null,
          count: null
        };
  let searchUploaded,
      year, month;

  function showInfo(id) {
    const file = fileMap.get(id);
    console.log(file);
    wuwei.info.open(null, file);
  }

  function filerecord(id) {
    const file = fileMap.get(id);
    console.log(file);
    const
      map = {
        command: 'filerecord',
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
    button.innerHTML = `${wuwei.nls.translate('Upload')}${text}`;
    button.style.fontSize = '6pt';
    button.style.lineHeight = '11px';
    document.getElementById('search-button').addEventListener('click', function(e) {
      e.preventDefault();
      var currentUser = common.state.currentUser,
          user_id = currentUser.user_id,
          term = document.getElementById('search-text').value;
      term = term.replace(/ /g, '+');
      if (user_id) {
        wuwei.file.searchFile({
          term: term
        })
        .then(responseText => {
          console.log(responseText);
          listFiles(responseText);
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
  
  function listFiles(responseText) {
    if (responseText.indexOf('{') >= 0) {
      let response;
      try {
        response = JSON.parse(responseText);
      }
      catch(e) { console.log(e); }
      if (response.r) {
        const files = response.r;
        files.forEach(file => {
          fileMap.set(file.id, file);
        });
        searchUploaded.innerHTML = wuwei.search.uploaded.markup.template(year, month, files);
        registerButton();
      }
//      search.uploaded.markup.add_calendar(year, month);
    } else if (responseText.indexOf('#! /bin/sh') >= 0) {
      responseText = 'ERROR Cannnot execute bin/sh';
      menu.snackbar.open({type: 'error', message: responseText });
    } else {
      menu.snackbar.open({'type': 'error', 'message': response});
    }
  }

  function open() {
    const
      today = new Date(),
      currentUser = common.state.currentUser,
      user_id = currentUser.user_id;
    year = today.getFullYear();
    month = today.getMonth() + 1;
    searchUploaded = document.getElementById('search-uploaded');
    searchUploaded.style.display = 'block';
    searchUploaded.innerHTML = search.uploaded.markup.template(year, month);
//    search.uploaded.markup.add_calendar(year, month);
    registerButton();
  }

  function close() {
    document.getElementById('search-uploaded').style.display = 'none';
  }

  function initModule() {
  }

  return {
    showInfo: showInfo,
    filerecord: filerecord,
    open: open,
    close: close,
    initModule: initModule
  };
})();
// search.uploaded.js
