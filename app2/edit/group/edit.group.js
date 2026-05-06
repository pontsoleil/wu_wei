/**
 * edit.group.js
 * group editor controller
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
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
    var spine = {};

    spine.kind = ('simple' === type) ? style.simple.kind : style.kind;
    spine.color = style.color;
    spine.width =  ('simple' === type) ? style.simple.width : style.width;
    spine.padding = style.padding;
    spine.visible = true;
    return spine;
  }

  function applySpineToFields(spine, spineKindEl, spineWidthEl, spineColorEl, spinePaddingEl, spineVisibleEl) {
    if (spineKindEl) {
      spineKindEl.value = spine.kind || '';
    }
    if (spineWidthEl) {
      spineWidthEl.value = spine.width;
    }
    if (spineColorEl) {
      spineColorEl.value = spine.color || '';
    }
    if (spinePaddingEl) {
      spinePaddingEl.value = spine.padding;
    }
    if (spineVisibleEl) {
      spineVisibleEl.checked = false !== spine.visible;
    }
  }

  function applyDefaultSpineForSelectedType() {
    var typeEl = $('editGroupType');
    var spine = defaultSpineForType(typeEl ? typeEl.value : 'simple');

    applySpineToFields(
      spine,
      $('editGroupSpineKind'),
      $('editGroupSpineWidth'),
      $('editGroupSpineColor'),
      $('editGroupSpinePadding'),
      $('editGroupSpineVisible')
    );
  }

  function bindTypeChangeHandler() {
    var typeEl = $('editGroupType');

    if (!typeEl) {
      return;
    }
    typeEl.onchange = applyDefaultSpineForSelectedType;
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
    var nextType, typeChanged, defaultSpine;

    if (!group || !$('edit-group')) {
      return true;
    }

    previousType = stateMap.previousType || group.type || 'simple';
    typeEl = $('editGroupType');
    nameEl = $('editGroupName');
    descriptionEl = $('editGroupDescription');
    visibleEl = $('editGroupVisible');
    moveTogetherEl = $('editGroupMoveTogether');
    spineKindEl = $('editGroupSpineKind');
    spineWidthEl = $('editGroupSpineWidth');
    spineColorEl = $('editGroupSpineColor');
    spinePaddingEl = $('editGroupSpinePadding');
    spineVisibleEl = $('editGroupSpineVisible');

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
      group.spine.visible = defaultSpine.visible;
      applySpineToFields(group.spine, spineKindEl, spineWidthEl, spineColorEl, spinePaddingEl, spineVisibleEl);
    }
    else {
      group.spine.kind = spineKindEl ? (spineKindEl.value || group.spine.kind || 'SOLID') : (group.spine.kind || 'SOLID');
      group.spine.width = toNumber(spineWidthEl && spineWidthEl.value, toNumber(group.spine.width, 6));
      group.spine.color = (spineColorEl && spineColorEl.value) || group.spine.color || '#888888';
      group.spine.padding = toNumber(spinePaddingEl && spinePaddingEl.value, toNumber(group.spine.padding, 12));
      group.spine.visible = spineVisibleEl ? !!spineVisibleEl.checked : false !== group.spine.visible;
    }

    wuwei.model.reflowGroupMembers(group, group.type);

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
