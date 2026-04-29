/**
 * wuwei.csv.js
 * csv module
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2019, Nobuyuki SAMBUICHI
 **/
wuwei.csv = ( function () {
  var
  /** common */
    common = wuwei.common,
    graph = common.graph,
    current = common.current,
  /** state */
    state = common.state,
    currentUser = state.currentUser,
    user_id = currentUser.user_id,
  /** util */
    util = wuwei.util,
  /** menu */
    menu = wuwei.menu,
  /** draw */
    draw = wuwei.draw,
  /** model */
    model = wuwei.model;

/** csv */
  class csv {
    constructor() {
    }
  }

  /**
   * 
   * @param {*} csv_id 
   */
  function loadCsv(csv_id) {
    // currentUser = state.currentUser;
    // user_id = currentUser.user_id;
    // if (!user_id) {
    //   currentUser.user_id = user_id = wuwei.util.getCookie('user_id');
    //   currentUser.user = user = wuwei.util.getCookie('user');
    // }
    // const data = {
    //   user_id: user_id,
    //   id: csv_id
    // };
    var req = new XMLHttpRequest();
    req.open('get', `server/csv/${csv_id}.csv`, true);
    req.send(null);

    wuwei.menu.modal.open({ message: 'Loading csv', type: 'info', timeout: 5000 });
    req.onload = function() {
      wuwei.menu.modal.close();
      var responseText = req.responseText;
      console.log(responseText);
      if (responseText.trim().match(/^ERROR/)) {
        menu.snackbar.open({ type: 'error', message: responseText });
      } else if (responseText.match(/^#! \/bin\/sh/)) {
        responseText = 'ERROR Cannnot execute bin/sh';
        menu.snackbar.open({ type: 'error', message: responseText });
      } else {
        console.log(responseText);
        var tmp = responseText.split('\n');
        var line = [];
        for (var i = 1, len = tmp.length; i < len; i++) {
          var record = tmp[i].split(',');
          if (!line[record[0]]) {
            line[record[0]] = {};
          }
          line[record[0]][record[1]] = record[2];
        }
        console.log(line);
        // wuwei.note.updateNote(noteJson);
        // document.querySelector('#note_name .name').innerHTML = common.current.note_name || '';
        // document.querySelector('#note_name .description').innerHTML = common.current.description || '';
        /*
        setTimeout(() => {
          if ((wuwei.common.current.pages || []).length > 1) {
            wuwei.menu.refreshPagenation();
          }
          if ('draw' === graph.mode) {
            draw.refresh();
          } else if ('simulation' === graph.mode) {
            draw.restart();
          }
        }, 500);
        */
      }
    }

  }

  function initModule() {

  }

  return {
  /** Csv */
    loadCsv: loadCsv,
  /** init */
    initModule: initModule
  };
})();
// wuwei.csv.js
