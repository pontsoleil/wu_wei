/**
 * wuwei.file.js
 * file module
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
wuwei.file = (function () {
  var
    /** common */
    common = wuwei.common,
    current = common.current,
    /** state */
    state = common.state,
    currentUser = state.currentUser,
    user_id = currentUser.user_id,
    user = currentUser.login,
    token = currentUser.token,
    loggedIn = state.loggedIn,
    /** util */
    util = wuwei.util,
    /** menu */
    menu = wuwei.menu,
    /** home */
    home = wuwei.home;

  function remove(el) {
    el.parentNode.removeChild(el);
  }

  /** File */
  class File {
    constructor(param) {
    }
  }

  /**
   * 
   * @param {*} param 
   */
  function FileFactory(param) {
    if (!param) {
      return null;
    }
    const file = new File(param);
    return file;
  }

  /**
   * 
   */
  function listFile(param) {
    const today = new Date();
    let start, count, year, month, date;
    if (param) {
      start = param.start;
      count = param.count;
      year = param.year;
      month = param.month;
      date = param.date;
    } else {
      start = 1;
      count = 12;
    }
    if (!year) {
      year = today.getFullYear();
    }
    if (!month) {
      month = today.getMonth() + 1;
    }
    currentUser = state.currentUser;
    // user_id = currentUser.user_id;
    user = currentUser.login;
    token = currentUser.token;
    const data = {
      // user_id: user_id,
      user: user,
      token: token,
      start: start || 1,
      count: count || 12,
      year: year,
      month: month
    };
    if (date) {
      data.date = date;
    }
    return ajaxRequest('server/list-resource.cgi', data, 'POST', 30000);
  }

  /**
 * 
 */
  function searchFile(param) {
    const today = new Date();
    let
      term, start, count, year, month;
    if (param) {
      term = param.term;
      start = param.start;
      count = param.count;
    } else {
      start = 1;
      count = 12;
    }
    if (!term) {
      return;
    } else if (term.match('/ /')) {
      term = term.replace(/ /g, '+');
    }
    currentUser = state.currentUser;
    // user_id = currentUser.user_id;
    user = currentUser.login;
    token = currentUser.token;
    if (!user_id) {
      currentUser.user_id = user_id = wuwei.util.getCookie('wuwei_user_id');
      // currentUser.user = user = wuwei.util.getCookie('user');
    }
    const data = {
      // user_id: user_id,
      user: user,
      token: token,
      start: start || 1,
      count: count || 12,
      term: term
    };
    return ajaxRequest('server/search-resource.cgi', data, 'POST', 30000);
  }
  /**
   * 
   * @param {*} file_id 
   */
  function removeFile(file_id) {
    currentUser = wuwei.common.state.currentUser;
    // user_id = currentUser.user_id;
    user = currentUser.login;
    token = currentUser.token;
    const data = {
      // user_id: user_id,
      user: user,
      token: token,
      id: file_id
    };
    return ajaxRequest('server/remove-resource.cgi', data, 'POST', 5000);
  }

  function initModule() { }

  return {
    /** File */
    File: File,
    FileFactory: FileFactory,
    listFile: listFile,
    searchFile: searchFile,
    removeFile: removeFile,
    /** init */
    initModule: initModule
  };
})();
// wuwei.file.js
