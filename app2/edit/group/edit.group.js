/**
 * edit.group.js
 * group editor controller
 */
wuwei.edit = wuwei.edit || {};
wuwei.edit.group = wuwei.edit.group || {};

(function (ns) {
  'use strict';

  var stateMap = {
    group: null,
    previousType: ''
  };

  function $(id) {
    return document.getElementById(id);
  }

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function defaultSpineForType(type) {
    var style = (wuwei.common && wuwei.common.defaultStyle && wuwei.common.defaultStyle.group) || {};
    var simple = style.simple || {};
    var spine = {};

    spine.kind = ('simple' === type) ? (simple.kind || style.kind || 'DASHED') : (style.kind || 'SOLID');
    spine.color = style.color || '#888888';
    spine.width = ('simple' === type) ? toNumber(simple.width, 2) : toNumber(style.width, 6);
    spine.padding = toNumber(style.padding, 'simple' === type ? 16 : 12);
    spine.paddingTop = spine.padding;
    spine.paddingRight = spine.padding;
    spine.paddingBottom = spine.padding;
    spine.paddingLeft = spine.padding;
    spine.visible = true;
    return spine;
  }

  function applySpineToFields(spine) {
    var fieldMap = {
      spine_kind: 'kind',
      spine_width: 'width',
      spine_color: 'color',
      spine_padding: 'padding',
      spine_padding_top: 'paddingTop',
      spine_padding_right: 'paddingRight',
      spine_padding_bottom: 'paddingBottom',
      spine_padding_left: 'paddingLeft'
    };

    Object.keys(fieldMap).forEach(function (id) {
      var el = $(id);
      if (el) {
        el.value = spine[fieldMap[id]];
      }
    });
    if ($('spine_visible')) {
      $('spine_visible').checked = false !== spine.visible;
    }
  }

  function bindTypeChangeHandler() {
    var typeEl = $('type');

    if (!typeEl) {
      return;
    }
    typeEl.onchange = function () {
      applySpineToFields(defaultSpineForType(typeEl.value || 'simple'));
    };
  }

  function resolveGroup(target) {
    if (!target) {
      return null;
    }
    if (wuwei.model && typeof wuwei.model.findGroupByTarget === 'function') {
      return wuwei.model.findGroupByTarget(target);
    }
    if (target.groupRef && wuwei.model && typeof wuwei.model.findGroupById === 'function') {
      return wuwei.model.findGroupById(target.groupRef);
    }
    if (target.id && wuwei.model && typeof wuwei.model.findGroupById === 'function') {
      return wuwei.model.findGroupById(target.id);
    }
    return null;
  }

  function canOpen(target) {
    return !!resolveGroup(target);
  }

  function open(target) {
    var group = resolveGroup(target);
    var pane = $('edit-group');

    if (!group || !pane || !wuwei.edit.group.markup) {
      return false;
    }

    stateMap.group = group;
    stateMap.previousType = group.type || 'simple';
    pane.innerHTML = wuwei.edit.group.markup.template(group);
    pane.style.display = 'block';
    bindTypeChangeHandler();

    return true;
  }

  function commit() {
    var group = stateMap.group;
    var previousType;
    var typeEl, nameEl, descriptionEl, visibleEl, moveTogetherEl;
    var spineKindEl, spineWidthEl, spineColorEl, spinePaddingEl, spineVisibleEl;
    var spinePaddingTopEl, spinePaddingRightEl, spinePaddingBottomEl, spinePaddingLeftEl;
    var nextType;
    var typeChanged;
    var defaultSpine;
    var basePadding;

    if (!group || !$('edit-group')) {
      return true;
    }

    previousType = stateMap.previousType || group.type || 'simple';
    typeEl = $('type');
    nameEl = $('name');
    descriptionEl = $('description_body');
    visibleEl = $('visible');
    moveTogetherEl = $('moveTogether');
    spineKindEl = $('spine_kind');
    spineWidthEl = $('spine_width');
    spineColorEl = $('spine_color');
    spinePaddingEl = $('spine_padding');
    spinePaddingTopEl = $('spine_padding_top');
    spinePaddingRightEl = $('spine_padding_right');
    spinePaddingBottomEl = $('spine_padding_bottom');
    spinePaddingLeftEl = $('spine_padding_left');
    spineVisibleEl = $('spine_visible');

    if (nameEl) {
      group.name = nameEl.value || '';
    }
    group.description = (group.description && 'object' === typeof group.description)
      ? group.description
      : { format: 'plain', body: '' };
    if (descriptionEl) {
      group.description.body = descriptionEl.value || '';
    }
    if (visibleEl) {
      group.visible = !!visibleEl.checked;
    }
    if (moveTogetherEl) {
      group.moveTogether = !!moveTogetherEl.checked;
    }

    nextType = typeEl ? typeEl.value : group.type;
    if (['simple', 'horizontal', 'vertical'].indexOf(nextType) >= 0) {
      typeChanged = previousType !== nextType;
      group.type = nextType;
      group.orientation = ('simple' === nextType) ? 'auto' : nextType;
    }

    group.spine = (group.spine && 'object' === typeof group.spine) ? group.spine : {};
    if (typeChanged) {
      defaultSpine = defaultSpineForType(group.type);
      group.spine.kind = defaultSpine.kind;
      group.spine.width = defaultSpine.width;
      group.spine.color = defaultSpine.color;
      group.spine.padding = defaultSpine.padding;
      group.spine.paddingTop = defaultSpine.paddingTop;
      group.spine.paddingRight = defaultSpine.paddingRight;
      group.spine.paddingBottom = defaultSpine.paddingBottom;
      group.spine.paddingLeft = defaultSpine.paddingLeft;
      group.spine.visible = defaultSpine.visible;
      applySpineToFields(group.spine);
    }
    else {
      group.spine.kind = spineKindEl ? (spineKindEl.value || 'SOLID') : (group.spine.kind || 'SOLID');
      group.spine.width = toNumber(spineWidthEl && spineWidthEl.value, 'simple' === group.type ? 2 : 6);
      group.spine.color = (spineColorEl && spineColorEl.value) || group.spine.color || '#888888';
      group.spine.padding = toNumber(spinePaddingEl && spinePaddingEl.value, 'simple' === group.type ? 16 : 12);
      basePadding = group.spine.padding;
      group.spine.paddingTop = toNumber(spinePaddingTopEl && spinePaddingTopEl.value, basePadding);
      group.spine.paddingRight = toNumber(spinePaddingRightEl && spinePaddingRightEl.value, basePadding);
      group.spine.paddingBottom = toNumber(spinePaddingBottomEl && spinePaddingBottomEl.value, basePadding);
      group.spine.paddingLeft = toNumber(spinePaddingLeftEl && spinePaddingLeftEl.value, basePadding);
      group.spine.visible = spineVisibleEl ? !!spineVisibleEl.checked : true;
    }

    if (('vertical' === previousType && 'horizontal' === group.type) ||
      ('horizontal' === previousType && 'vertical' === group.type)) {
      if (wuwei.model && typeof wuwei.model.reflowGroupMembers === 'function') {
        wuwei.model.reflowGroupMembers(group, group.type);
      }
    }
    else if (wuwei.model && typeof wuwei.model.setGraphFromCurrentPage === 'function') {
      wuwei.model.setGraphFromCurrentPage();
    }

    group.audit = (group.audit && 'object' === typeof group.audit) ? group.audit : {};
    group.audit.lastModifiedBy =
      (wuwei.common.state.currentUser && wuwei.common.state.currentUser.user_id) ||
      wuwei.common.state.user_id ||
      '';
    group.audit.lastModifiedAt = new Date().toISOString();
    stateMap.previousType = group.type;
    return true;
  }

  function close() {
    var pane = $('edit-group');
    stateMap.group = null;
    stateMap.previousType = '';
    if (pane) {
      pane.innerHTML = '';
      pane.style.display = 'none';
    }
  }

  ns.canOpen = canOpen;
  ns.open = open;
  ns.commit = commit;
  ns.close = close;
})(wuwei.edit.group);
