/**
 * wuwei.log.js
 * log module supports undo/redo
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.log = (function () {
  'use strict';
  var
    /** wuwei */
    util = wuwei.util,
    menu = wuwei.menu,
    model = wuwei.model,
    /** common */
    common = wuwei.common,
    graph = common.graph,
    state = common.state,
    previous = common.previous,
    /** log */
    undoLog = common.undoLog,
    redoLog = common.redoLog,
    MAX_LOG = 48, //common.MAX_LOG,
    /** current */
    current = common.current,
    note_id = current.note_id,
    pp = current.page.pp,
    user_id = current.user_id,
    /** function */
    savePrevious,
    resumePrevious,
    recordCurrent,
    storeLog,
    opLabel,
    logTop,
    logDateString,
    undoState,
    redoState,
    initModule;

  // ---- snapshot (nodes/links only) -----------------------------------------

  function getCurrentPage() {
    var common = wuwei.common;
    return common && common.current ? common.current.page || null : null;
  }

  savePrevious = function () {
    var page = getCurrentPage();

    previous.page = {
      nodes: page && Array.isArray(page.nodes) ? util.clone(page.nodes) : [],
      links: page && Array.isArray(page.links) ? util.clone(page.links) : [],
      groups: page && Array.isArray(page.groups) ? util.clone(page.groups) : []
    };
  };

  resumePrevious = function () {
    var page = getCurrentPage();

    if (!page || !previous.page) {
      return;
    }

    page.nodes = util.clone(previous.page.nodes || []);
    page.links = util.clone(previous.page.links || []);
    page.groups = util.clone(previous.page.groups || []);
    current.page = page;
    if (Array.isArray(current.pages)) {
      var idx = current.pages.findIndex(function (item) { return item && item.id === page.id; });
      if (idx >= 0) {
        current.pages[idx] = page;
      }
    }

    model.setGraphFromCurrentPage();
  };

  // ---- diff + log ----------------------------------------------------------
  recordCurrent = function (param) {
    // このログエントリがどの操作に対応するかを示す識別子。
    // CREATE / UPDATE / REMOVE などを想定し、undo/redo の説明表示にも使える。
    var operation = (param && param.operation) || '';

    // 現在ページの状態をその場で直接参照すると、
    // 後続の編集で内容が変化して比較基準が壊れる。
    // そのため、比較対象は必ず clone したスナップショットで保持する。
    var page = getCurrentPage();
    var currentNodes = page && Array.isArray(page.nodes) ? util.clone(page.nodes) : [];
    var currentLinks = page && Array.isArray(page.links) ? util.clone(page.links) : [];
    var currentGroups = page && Array.isArray(page.groups) ? util.clone(page.groups) : [];

    // previous.page は「直前に確定した状態」を保持する比較基準。
    // 今回の recordCurrent() は、この previous.page と current の差分だけを記録する。
    var previousPage = previous.page || { nodes: [], links: [], groups: [] };
    var previousNodes = previousPage.nodes || [];
    var previousLinks = previousPage.links || [];
    var previousGroups = previousPage.groups || [];

    // 差分判定を毎回全探索で行うと見通しも効率も悪くなるため、
    // 前回状態は id -> object の map にして比較する。
    var previousNodeMap = {};
    var previousLinkMap = {};

    // 「削除された要素」は current 側を一巡しただけでは分からない。
    // そのため、current に存在する id 一覧を別に保持し、
    // previous 側にだけ存在する id を removed と判定する。
    var currentNodeIds = [];
    var currentLinkIds = [];

    // ノード差分の分類結果。
    // created: 前回に存在せず今回存在する
    // modified: 前回にも今回にも存在するが内容が異なる
    // removed: 前回に存在したが今回存在しない
    var createdNs = [];
    var modifiedNs = [];
    var removedNs = [];

    // リンク差分の分類結果。考え方はノードと同じ。
    var createdLs = [];
    var modifiedLs = [];
    var removedLs = [];

    // groups は node/link のように個別単位で undo を積むよりも、
    // 配列全体を一まとまりの構造として扱った方が安全。
    // そのため groups は whole snapshot として差分記録する。
    var groupsChanged = null;

    // 実際にログへ格納する断片。
    // 変更がなかった区分は null のままにして、ログを簡潔に保つ。
    var createdLog = null;
    var modifiedLog = null;
    var removedLog = null;

    var logJSON;
    var i, node, link, id;

    // 前回ノードの id 索引を構築する。
    // 以後の比較はこの map を使って「同じ id の前回状態」を即座に引けるようにする。
    for (i = 0; i < previousNodes.length; i++) {
      node = previousNodes[i];
      if (node && node.id) {
        previousNodeMap[node.id] = node;
      }
    }

    // 前回リンクの id 索引を構築する。
    for (i = 0; i < previousLinks.length; i++) {
      link = previousLinks[i];
      if (link && link.id) {
        previousLinkMap[link.id] = link;
      }
    }

    // currentNodes を走査して、生成・更新を判定する。
    // ここでは「今あるもの」を基準に見るため、
    // created / modified は判定できるが removed はまだ分からない。
    for (i = 0; i < currentNodes.length; i++) {
      node = currentNodes[i];
      if (!node || !node.id) {
        continue;
      }
      id = node.id;
      currentNodeIds.push(id);

      if (!previousNodeMap[id]) {
        // 前回になかった id が今回あるので新規作成。
        createdNs.push(node);
      }
      else if (!util.isEquivalent(previousNodeMap[id], node)) {
        // 同じ id はあるが内容が変わっているので更新。
        // undo のために previous/current の両方を残す。
        modifiedNs.push({ previous: previousNodeMap[id], current: node });
      }
    }

    // previousNodes を走査して、削除を判定する。
    // 前回あった id が currentNodeIds に存在しなければ削除とみなす。
    for (i = 0; i < previousNodes.length; i++) {
      node = previousNodes[i];
      if (node && node.id && currentNodeIds.indexOf(node.id) < 0) {
        removedNs.push(node);
      }
    }

    // currentLinks を走査して、リンクの生成・更新を判定する。
    for (i = 0; i < currentLinks.length; i++) {
      link = currentLinks[i];
      if (!link || !link.id) {
        continue;
      }
      id = link.id;
      currentLinkIds.push(id);

      if (!previousLinkMap[id]) {
        // 前回になかった link id が今回あるので新規作成。
        createdLs.push(link);
      }
      else if (!util.isEquivalent(previousLinkMap[id], link)) {
        // 同じ id のリンクがあるが内容が違うので更新。
        modifiedLs.push({ previous: previousLinkMap[id], current: link });
      }
    }

    // previousLinks を走査して、リンク削除を判定する。
    for (i = 0; i < previousLinks.length; i++) {
      link = previousLinks[i];
      if (link && link.id && currentLinkIds.indexOf(link.id) < 0) {
        removedLs.push(link);
      }
    }

    // groups は配列全体で比較する。
    // 個別差分に分解すると group 内の構造変更や member 順序変更の扱いが複雑になるため、
    // ここでは previous/current の完全スナップショットとして保持する方針とする。
    if (!util.isEquivalent(previousGroups, currentGroups)) {
      groupsChanged = {
        previous: util.clone(previousGroups),
        current: util.clone(currentGroups)
      };
    }

    // 今回の差分を確定した後で、次回比較用の基準を現在状態に更新する。
    // これにより recordCurrent() は常に「直前確定状態との差分」だけを積み上げる。
    savePrevious();

    // 実際に変更があった区分だけをログに載せる。
    // 空配列を毎回残さないことで、ログ解釈と undo 処理を簡潔にする。
    if (createdNs.length + createdLs.length > 0) {
      createdLog = { nodes: createdNs, links: createdLs };
    }
    if (modifiedNs.length + modifiedLs.length > 0) {
      modifiedLog = { nodes: modifiedNs, links: modifiedLs };
    }
    if (removedNs.length + removedLs.length > 0) {
      removedLog = { nodes: removedNs, links: removedLs };
    }

    // undo 用の 1 エントリを JSON 化して保存する。
    // groups は node/link とは独立した構造差分として記録する。
    logJSON = JSON.stringify({
      operation: operation,
      create: createdLog,
      modify: modifiedLog,
      remove: removedLog,
      groups: groupsChanged
    });

    // 現在ページ単位で undo 履歴を保持する。
    // 新しい操作が発生した時点で redo は無効になるため、必ずクリアする。
    if (!undoLog.has(pp)) undoLog.set(pp, []);
    undoLog.get(pp).push(logJSON);
    redoLog.set(pp, []);

    // 履歴状態に応じて undo/redo ボタンの有効状態を更新する。
    menu.updateUndoRedoButton();
  };

  storeLog = function (item) {
    // operation がないものはログ要求として無効。
    if (!item || !item.operation) return;

    let operation = item.operation;
    pp = current.page.pp;

    // ここでの DELETE は「削除操作を記録する」の意味ではなく、
    // そのページの履歴自体を初期化するための特別コマンド。
    // したがって undo/redo 両方を空にして終了する。
    if ('DELETE' === operation) { // delete log records
      undoLog.set(pp, []);
      redoLog.set(pp, []);
      return;
    }

    // 履歴格納先はページ単位で必ず用意してから使う。
    if (!undoLog.has(pp)) undoLog.set(pp, []);
    if (!redoLog.has(pp)) redoLog.set(pp, []);

    // undo 履歴は上限件数を超えないように管理する。
    // 新規追加前に最古の 1 件を捨て、最近の操作を優先して保持する。
    if (undoLog.get(pp).length === MAX_LOG) {
      undoLog.get(pp).shift();
    }

    // current と previous.page の差分を採取して 1 件の undo ログとして記録する。
    recordCurrent({ operation: operation });
  };

  // ---- misc ----------------------------------------------------------------

  opLabel = function (label) {
    function parseLabel(text) {
      var result = text.replace(/([A-Z]+)/g, " $1").replace(/([A-Z][a-z])/g, " $1");
      var finalResult = result.charAt(0).toUpperCase() + result.slice(1);
      return finalResult;
    }
    const OperationsList = wuwei.menu.OperationsList;
    let operation = OperationsList[label] ? OperationsList[label][0] : label;
    operation = wuwei.nls.translate(operation) || parseLabel(operation);
    return operation;
  };

  logTop = function (type, pp) {
    let log;
    if ('undo' === type) log = undoLog.get(pp);
    else if ('redo' === type) log = redoLog.get(pp);
    if (log && log.length > 0) return log[log.length - 1];
    return null;
  };

  logDateString = function () {
    var d = new Date();
    function pad(n) { return n < 10 ? '0' + n : n; }
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
  };

  // ---- undo/redo (nodes/links only) ----------------------------------------

  undoState = function () {
    let logJSON, undolog, redolog, log;
    pp = current.page.pp;

    undolog = undoLog.get(pp) || [];
    logJSON = (undolog.length > 0)
      ? undolog.pop()
      : '{"operation":"","create":null,"modify":null,"remove":null}';

    redolog = redoLog.get(pp) || [];
    if (redolog.length === MAX_LOG) redolog.shift();
    redolog.push(logJSON);
    redoLog.set(pp, redolog);

    try {
      log = JSON.parse(logJSON);
      if (log === undefined) return;
    } catch (e) { console.log(e); return; }

    let created = log.create,
      modified = log.modify,
      removed = log.remove,
      groups = log.groups,
      nodes, links, page;

    // undo create => remove created ids
    if (created) {
      nodes = (created.nodes || []).map(item => item.id);
      links = (created.links || []).map(item => item.id);
      model.toRemove({ nodes: nodes, links: links });
    }

    // undo modify => restore previous objects
    if (modified) {
      nodes = (modified.nodes || []).map(item => item.previous);
      links = (modified.links || []).map(item => item.previous);
      model.toModify({ nodes: nodes, links: links });
    }

    // undo remove => re-create removed objects
    if (removed) {
      nodes = removed.nodes || [];
      links = removed.links || [];
      model.toCreate({ nodes: nodes, links: links });
    }

    if (groups) {
      page = getCurrentPage();
      if (page) {
        page.groups = util.clone(groups.previous || []);
      }
    }

    model.setGraphFromCurrentPage();
    if (wuwei.draw) {
      if (graph.mode === 'simulation' && typeof wuwei.draw.restart === 'function') {
        wuwei.draw.restart();
      }
      else if (typeof wuwei.draw.refresh === 'function') {
        wuwei.draw.refresh();
      }
    }

    menu.updateUndoRedoButton();
  };

  redoState = function () {
    let logJSON, undolog, redolog, log;
    pp = current.page.pp;

    undolog = undoLog.get(pp) || [];
    redolog = redoLog.get(pp) || [];

    logJSON = (redolog.length > 0)
      ? redolog.pop()
      : '{"operation":"","create":null,"modify":null,"remove":null}';
    redoLog.set(pp, redolog);

    if (undolog.length === MAX_LOG) undolog.shift();
    undolog.push(logJSON);
    undoLog.set(pp, undolog);

    try {
      log = JSON.parse(logJSON);
      if (log === undefined) return;
    } catch (e) { console.log(e); return; }

    let created = log.create,
      modified = log.modify,
      removed = log.remove,
      groups = log.groups,
      nodes, links, page;

    // redo create => create objects
    if (created) {
      nodes = created.nodes || [];
      links = created.links || [];
      model.toCreate({ nodes: nodes, links: links });
    }

    // redo modify => apply current objects
    if (modified) {
      nodes = (modified.nodes || []).map(item => item.current);
      links = (modified.links || []).map(item => item.current);
      model.toModify({ nodes: nodes, links: links });
    }

    // redo remove => remove ids
    if (removed) {
      nodes = (removed.nodes || []).map(item => item.id);
      links = (removed.links || []).map(item => item.id);
      model.toRemove({ nodes: nodes, links: links });
    }

    if (groups) {
      page = getCurrentPage();
      if (page) {
        page.groups = util.clone(groups.current || []);
      }
    }

    model.setGraphFromCurrentPage();
    if (wuwei.draw) {
      if (graph.mode === 'simulation' && typeof wuwei.draw.restart === 'function') {
        wuwei.draw.restart();
      }
      else if (typeof wuwei.draw.refresh === 'function') {
        wuwei.draw.refresh();
      }
    }

    menu.updateUndoRedoButton();
  };

  initModule = function () {
    menu = wuwei.menu;
    undoLog.clear();
    redoLog.clear();
  };

  return {
    savePrevious: savePrevious,
    resumePrevious: resumePrevious,
    recordCurrent: recordCurrent,
    storeLog: storeLog,
    opLabel: opLabel,
    logTop: logTop,
    logDateString: logDateString,
    undoState: undoState,
    redoState: redoState,
    initModule: initModule
  };
})();
// wuwei.log.js 2026-03-04 (nodes/links only)
