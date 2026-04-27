/**
 * wuwei.sse.js
 * sse module
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, Nobuyuki SAMBUICHI
 **/
ssEvent = ( function () {
  const
  /** common */
    common = wuwei.common,
  /** util */
    util = wuwei.util,
  /** model */
    model = wuwei.model;
  let
    evtSource;

  function open(server) {
    if (window.EventSource) {
      evtSource = new EventSource(server);
      console.log(`url:${evtSource.url} withCredentials:${evtSource.withCredentials} readyState:${evtSource.readyState}`);

      evtSource.onopen = function() {
        console.log(`Connection to server ${server} opened. readyState ${evtSource.readyState}`);
      };

      evtSource.onstatus = function(e) {
        console.log('chat server status', e.data);
      };

      evtSource.onerror = function(e) {
        console.log('chat server EventSource failed.', e);
      };
    }
    else {
      alert('event source does not work in this browser, author a fallback technology');
      // Program Ajax Polling version here or another fallback technology like flash
    }
    return evtSource;
  }

  function close() {
    evtSource.close();
  }

  function initModule() {}

  return {
    open: open,
    close: close,
  /** init */
    initModule: initModule
  };
})();
// wuwei.sse.js
