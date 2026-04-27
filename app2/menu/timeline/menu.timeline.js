/**
 * menu.timeline.js
 * thin menu-facing wrapper around wuwei.timeline
 */
wuwei.menu = wuwei.menu || {};
wuwei.menu.timeline = wuwei.menu.timeline || {};

(function (ns) {
  'use strict';

  var timeline = wuwei.timeline;

  function getCurrentPage() { return timeline.getCurrentPage(); }
  function isAxisGroup(group) { return timeline.isAxisGroup(group); }
  function isTimelinePoint(node) { return timeline.isTimelinePoint(node); }
  function isTimelineAxisLink(link) { return timeline.isTimelineAxisLink(link); }
  function createAxisGroup(axis, videoNode, option) { return timeline.createAxisGroup(axis, videoNode, option); }
  function addTimePoint() { return timeline.addTimePoint(); }
  function addTimePointToGroup(group, patch) { return timeline.addTimePointToGroup(group, patch); }
  function relayoutAxisGroup(groupOrId) { return timeline.relayoutAxisGroup(groupOrId); }
  function updateAxisGroup(groupOrId, patch) { return timeline.updateAxisGroup(groupOrId, patch); }
  function updateTimePoint(pointOrId, patch) { return timeline.updateTimePoint(pointOrId, patch); }
  function deleteTimePoint(pointOrId) { return timeline.deleteTimePoint(pointOrId); }

  function deleteSelectedPoint() {
    var point = timeline.getSelectedTimelinePoint();
    if (!point) { return false; }
    if (!window.confirm('この時刻点を削除しますか？')) { return false; }
    return timeline.deleteTimePoint(point);
  }

  function editSelected() {
    var point = timeline.getSelectedTimelinePoint();
    var group;
    if (point) {
      if (wuwei.edit && typeof wuwei.edit.open === 'function') {
        wuwei.edit.open(point, { editor: false, citation: false, cc: false });
      }
      else if (wuwei.edit && wuwei.edit.timeline && typeof wuwei.edit.timeline.open === 'function') {
        wuwei.edit.timeline.open(point);
      }
      return point;
    }
    group = timeline.findAxisGroupFromSelection();
    if (group) {
      if (wuwei.edit && typeof wuwei.edit.open === 'function') {
        wuwei.edit.open(group, { editor: false, citation: false, cc: false });
      }
      else if (wuwei.edit && wuwei.edit.timeline && typeof wuwei.edit.timeline.open === 'function') {
        wuwei.edit.timeline.open(group);
      }
      return group;
    }
    return null;
  }

  function getTimelinePlaybackSpec(point) { return timeline.getTimelinePlaybackSpec(point); }
  function getTimelineTargetSpec(target) { return timeline.getTimelineTargetSpec(target); }
  function confirmSavedRender(target) { return timeline.confirmSavedRender(target); }
  function formatTime(seconds) { return timeline.formatTime(seconds); }
  function initModule() { return true; }

  ns.initModule = initModule;
  ns.getCurrentPage = getCurrentPage;
  ns.createAxisGroup = createAxisGroup;
  ns.addTimePoint = addTimePoint;
  ns.addTimePointToGroup = addTimePointToGroup;
  ns.editSelected = editSelected;
  ns.deleteSelectedPoint = deleteSelectedPoint;
  ns.deleteTimePoint = deleteTimePoint;
  ns.updateAxisGroup = updateAxisGroup;
  ns.updateTimePoint = updateTimePoint;
  ns.isAxisGroup = isAxisGroup;
  ns.isTimelinePoint = isTimelinePoint;
  ns.relayoutAxisGroup = relayoutAxisGroup;
  ns.getTimelinePlaybackSpec = getTimelinePlaybackSpec;
  ns.formatTime = formatTime;
  ns.isTimelineAxisLink = isTimelineAxisLink;
  ns.getTimelineTargetSpec = getTimelineTargetSpec;
  ns.confirmSavedRender = confirmSavedRender;
})(wuwei.menu.timeline);
