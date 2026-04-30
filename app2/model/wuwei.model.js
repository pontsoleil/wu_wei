/**
 * wuwei.model.js
 * model module
 *
 * WuWei is a free to use open source knowledge modeling tool.
 *
 * WuWei is licensed under the MIT License
 * Copyright (c) 2013-2020, 2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 **/
wuwei.model = (function () {
  var
    newShape = IntersectionParams.newShape,
    /** common */
    common = wuwei.common,
    graph = common.graph,
    Color = common.Color,
    defaultSize = common.defaultSize || {
      width: 120,
      height: 32,
      radius: 20,
      content: 100,
      memo: 160
    },
    defaultFont = common.defaultFont || {
      family: 'sans-serif',
      size: 14,
      color: '#000000',
      align: 'center'
    },
    state = common.state,
    /** util */
    util = wuwei.util,
    /** menu */
    menu,
    /** draw */
    draw,
    /** log */
    log,
    /** nls */
    nls = wuwei.nls,
    translate = function (value) {
      return (nls && typeof nls.translate === 'function') ? (nls.translate(value) || value) : value;
    },
    /** default */
    defaultNode = {
      shape: 'RECTANGLE', // RECTANGLE CIRCLE ROUNDED ELLIPSE THUMBNAIL
      size: {
        width: defaultSize.width,
        height: defaultSize.height
      },
      visible: true,
      label: translate("新規トピック"),
      description: {
        format: "asciidoc",
        body: ""
      },
      style: {
        fill: Color.nodeFill,
        font: defaultFont,
        line: {
          kind: "SOLID",
          color: Color.nodeOutline,
          width: 1
        }
      }
    },
    defaultLink = {
      shape: "NORMAL",
      visible: true,
      label: "",
      description: {
        format: "plain",
        body: ""
      },
      style: {
        font: defaultFont,
        line: {
          kind: "SOLID",
          color: Color.link,
          width: 2
        }
      },
    },
    /** Node */
    Node,
    NodeFactory,
    createNode,
    removeNode,
    addNode, updateNode, showNodes, hideNodes,
    // copyNode,
    findNodeById,
    /** Link */
    Link,
    LinkFactory,
    connect,
    reverse,
    normal,
    horizontal,
    vertical,
    horizontal2,
    vertical2,
    createLink,
    removeLink,
    updateLink, showLinks, hideLinks,
    findLinkById,
    // findLinkByIdx,
    findLinksByNode,
    findOtherNode,
    countHiddenLink,
    /** function */
    newPosition,
    addSimpleContent,
    addSimpleTopic,
    addSimpleMemo,
    addSimpleTable,
    addUploadedContent,
    addS3object,
    addContent,
    addTopic,
    addMemo,
    addTable,
    setMultipleLine,
    createGroup,
    renderNode,
    featurePoints,
    hierarchyLink,
    hierarchyLink2,
    renderLink,
    closestPoint,
    pathString2points,
    points2pathString,
    updateLinkCount,
    getCtypeSetting,
    addCtypeNode,
    getRtypeSetting,
    addRtypeLink,
    /** 2026-03 */
    getCurrent,
    getCurrentPage,
    setGraphFromCurrentPage,
    syncPageFromGraph,
    wrapWithPageSync,
    /** constant */
    MENU_TIMEOUT = 1000,
    GRID = 4,
    ROUND = 16,
    /** function */
    cut,
    erase,
    bloom,
    hide,
    root,
    forward,
    backward,
    wilt,
    showAll,
    copy,
    clipboard,
    paste,
    clone,
    setVisible,

    refreshCurrentDraw,
    restartCurrentDraw,
    initModule;

  function makeAudit() {
    var cu = (common.state && common.state.currentUser) ? common.state.currentUser : {};
    return {
      owner: cu.login || cu.name || 'guest',
      createdBy: cu.user_id || common.getCurrentOwnerId(),
      createdAt: new Date().toISOString(),
      lastModifiedBy: '',
      lastModifiedAt: ''
    };
  }

  function assertNoLegacyRuntimeFields(record, kind) {
    if (!record || 'object' !== typeof record) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(record, 'hidden')) {
      throw new Error(kind + ' contains legacy runtime field: hidden');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'owner')) {
      throw new Error(kind + ' contains legacy runtime field: owner');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'owner_id')) {
      throw new Error(kind + ' contains legacy runtime field: owner_id');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'ownerId')) {
      throw new Error(kind + ' contains legacy runtime field: ownerId');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'name')) {
      throw new Error(kind + ' contains legacy runtime field: name');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'uri')) {
      throw new Error(kind + ' contains legacy runtime field: uri');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'url')) {
      throw new Error(kind + ' contains legacy runtime field: url');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'format')) {
      throw new Error(kind + ' contains legacy runtime field: format');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'download_url')) {
      throw new Error(kind + ' contains legacy runtime field: download_url');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'media')) {
      throw new Error(kind + ' contains legacy runtime field: media');
    }
  }

  function getRecordOwnerId(record) {
    assertNoLegacyRuntimeFields(record, 'Runtime record');
    if (!record || 'object' !== typeof record) {
      return '';
    }
    if (!record.audit || 'object' !== typeof record.audit || !record.audit.createdBy) {
      throw new Error('Runtime record must provide audit.createdBy');
    }
    return String(record.audit.createdBy);
  }

  function makeNodeStyle(fillColor) {
    return {
      fill: fillColor || Color.nodeFill,
      font: {
        family: defaultFont.family || 'sans-serif',
        size: defaultFont.size || 14,
        color: defaultFont.color || '#000000',
        align: defaultFont.align || 'center'
      },
      line: {
        kind: 'SOLID',
        color: Color.nodeOutline || '#666666',
        width: 1
      }
    };
  }

  function makeMemoStyle() {
    return {
      fill: '#FFF7B0',
      font: {
        family: defaultFont.family || 'sans-serif',
        size: defaultFont.size || 14,
        color: defaultFont.color || '#000000',
        align: defaultFont.align || 'center'
      },
      line: {
        kind: 'SOLID',
        color: Color.nodeOutline || '#666666',
        width: 1
      }
    };
  }

  function makeLinkStyle() {
    return {
      font: {
        family: defaultFont.family || 'sans-serif',
        size: defaultFont.size || 14,
        color: defaultFont.color || '#000000',
        align: defaultFont.align || 'center'
      },
      line: {
        kind: 'SOLID',
        color: Color.link || '#888888',
        width: 2
      }
    };
  }

  function makeContentResource(kind, title, mimeType) {
    return {
      kind: kind || 'general',
      uri: '',
      canonicalUri: '',
      mimeType: mimeType || 'text/plain',
      title: title || '',
      owner: '',
      copyright: '',
      viewer: {
        supportedModes: ['infoPane', 'newTab', 'newWindow', 'download'],
        defaultMode: 'infoPane'
      }
    };
  }

  function isNodeShown(node) {
    return !!(node && node.visible && !node.filterout);
  }

  function isLinkShown(link) {
    return !!(link && link.visible && !link.filterout);
  }

  function setNodeShown(node, shown) {
    if (!node) { return; }
    node.visible = !!shown;
  }

  function setLinkShown(link, shown) {
    if (!link) { return; }
    link.visible = !!shown;
  }

  findLinksByNode = function (node) {
    var links = [];
    var visibles = [];
    var hiddens = [];
    var link, otherNode;

    if (!node || !node.id) {
      return { links: [], visibles: [], hiddens: [] };
    }

    for (link of (graph.links || [])) {
      if (link.from !== node.id && link.to !== node.id) {
        continue;
      }

      util.appendById(links, link);
      otherNode = findOtherNode(link, node);

      if (isLinkShown(link) && (!otherNode || isNodeShown(otherNode))) {
        util.appendById(visibles, link);
      } else {
        util.appendById(hiddens, link);
      }
    }

    return {
      links: links,
      visibles: visibles,
      hiddens: hiddens
    };
  };

  findOtherNode = function (link, node) {
    if (!link || !node) {
      return null;
    }
    if (node.id === link.from) {
      return findNodeById(link.to);
    }
    if (node.id === link.to) {
      return findNodeById(link.from);
    }
    return null;
  };

  countHiddenLink = function (node) {
    var allLinks;

    if (!node || !node.id || !node.visible) {
      return 0;
    }

    allLinks = findLinksByNode(node);
    return (allLinks && allLinks.hiddens) ? allLinks.hiddens.length : 0;
  };

  function getTimelineVisibilityMembers(group) {
    var page = common.current && common.current.page;
    var sourceNodes = (page && page.nodes) ? page.nodes : graph.nodes;
    return (sourceNodes || []).filter(function (node) {
      return node && node.type === 'Segment' && node.groupRef === group.id;
    });
  }

  function getTimelineVisibilityAxisLinks(group) {
    return (graph.links || []).filter(function (link) {
      return isTimelineVisibilityAxisLink(link) && link.groupRef === group.id;
    });
  }

  function setTimelineFamilyVisible(group, visible, nodesBucket, linksBucket, hideConnectedLinks) {
    var changed = false;
    var members, axisLinks, member, linked, visibles, i, j;
    var shown = !!visible;

    nodesBucket = nodesBucket || [];
    linksBucket = linksBucket || [];

    if (!group) {
      return false;
    }

    if (group.visible !== shown) {
      group.visible = shown;
      changed = true;
    }

    members = getTimelineVisibilityMembers(group);
    for (i = 0; i < members.length; i++) {
      member = members[i];
      if (!member) {
        continue;
      }

      // hide 時は、member を隠す前に可視リンクを拾う
      visibles = [];
      if (!shown && hideConnectedLinks) {
        visibles = (findLinksByNode(member) || {}).visibles || [];
      }

      if (member.visible !== shown) {
        setNodeShown(member, shown);
        changed = true;
      }
      util.appendById(nodesBucket, member);

      if (!shown && hideConnectedLinks) {
        for (j = 0; j < visibles.length; j++) {
          linked = visibles[j];
          if (!linked) {
            continue;
          }
          if (isTimelineVisibilityAxisLink(linked) && linked.groupRef === group.id) {
            continue;
          }
          if (linked.visible) {
            setLinkShown(linked, false);
            changed = true;
          }
          util.appendById(linksBucket, linked);
        }
      }
    }

    axisLinks = getTimelineVisibilityAxisLinks(group);
    for (i = 0; i < axisLinks.length; i++) {
      if (!axisLinks[i]) {
        continue;
      }

      if (axisLinks[i].visible !== shown) {
        setLinkShown(axisLinks[i], shown);
        changed = true;
      }
      util.appendById(linksBucket, axisLinks[i]);
    }

    return changed;
  }

  refreshCurrentDraw = function () {
    if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
      wuwei.draw.refresh();
    }
  };

  restartCurrentDraw = function () {
    if (wuwei.draw && typeof wuwei.draw.restart === 'function') {
      wuwei.draw.restart();
    }
  };

  reverse = function (param) {
    var link = param && param[0];
    var from, to, routing, startArrow, endArrow;

    if (!link) {
      console.log('reverse NO link.');
      return null;
    }

    from = link.from;
    to = link.to;

    if (!from || !to) {
      console.log('reverse NO from or to. link:', link);
      return null;
    }

    // 端点を反転
    link.from = to;
    link.to = from;

    // 矢印定義があれば始点・終点を入れ替える
    routing = (link.routing && typeof link.routing === 'object') ? link.routing : null;
    if (routing) {
      startArrow = routing.startArrow;
      endArrow = routing.endArrow;
      routing.startArrow = endArrow;
      routing.endArrow = startArrow;
    }

    // 監査更新が必要なら反映
    if (link.audit && typeof link.audit === 'object') {
      link.audit.lastModifiedBy =
        (state.currentUser && state.currentUser.user_id) || common.TEMP_OWNER_ID;
      link.audit.lastModifiedAt = (new Date()).toISOString();
    }

    return {
      command: 'reverse',
      param: {
        node: [],
        link: [link]
      }
    };
  };

  normal = function (param) {
    var link = param && param[0];

    if (!link) {
      console.log('normal NO link.');
      return null;
    }

    link.shape = 'NORMAL';

    if (link.audit && typeof link.audit === 'object') {
      link.audit.lastModifiedBy =
        (state.currentUser && state.currentUser.user_id) || common.TEMP_OWNER_ID;
      link.audit.lastModifiedAt = (new Date()).toISOString();
    }

    return {
      command: 'normal',
      param: {
        node: [],
        link: [link]
      }
    };
  };

  horizontal = function (param) {
    var link = param && param[0];

    if (!link) {
      console.log('horizontal NO link.');
      return null;
    }

    link.shape = 'HORIZONTAL';

    if (link.audit && typeof link.audit === 'object') {
      link.audit.lastModifiedBy =
        (state.currentUser && state.currentUser.user_id) || common.TEMP_OWNER_ID;
      link.audit.lastModifiedAt = (new Date()).toISOString();
    }

    return {
      command: 'horizontal',
      param: {
        node: [],
        link: [link]
      }
    };
  };

  vertical = function (param) {
    var link = param && param[0];

    if (!link) {
      console.log('vertical NO link.');
      return null;
    }

    link.shape = 'VERTICAL';

    if (link.audit && typeof link.audit === 'object') {
      link.audit.lastModifiedBy =
        (state.currentUser && state.currentUser.user_id) || common.TEMP_OWNER_ID;
      link.audit.lastModifiedAt = (new Date()).toISOString();
    }

    return {
      command: 'vertical',
      param: {
        node: [],
        link: [link]
      }
    };
  };

  horizontal2 = function (param) {
    var link = param && param[0];

    if (!link) {
      console.log('horizontal2 NO link.');
      return null;
    }

    link.shape = 'HORIZONTAL2';

    if (link.audit && typeof link.audit === 'object') {
      link.audit.lastModifiedBy =
        (state.currentUser && state.currentUser.user_id) || common.TEMP_OWNER_ID;
      link.audit.lastModifiedAt = (new Date()).toISOString();
    }

    return {
      command: 'horizontal2',
      param: {
        node: [],
        link: [link]
      }
    };
  };

  vertical2 = function (param) {
    var link = param && param[0];

    if (!link) {
      console.log('vertical2 NO link.');
      return null;
    }

    link.shape = 'VERTICAL2';

    if (link.audit && typeof link.audit === 'object') {
      link.audit.lastModifiedBy =
        (state.currentUser && state.currentUser.user_id) || common.TEMP_OWNER_ID;
      link.audit.lastModifiedAt = (new Date()).toISOString();
    }

    return {
      command: 'vertical2',
      param: {
        node: [],
        link: [link]
      }
    };
  };

  /** group */
  function makeStablePseudoId(holder, key) {
    if (!holder) {
      return '_' + uuid.v4();
    }
    if (!holder[key]) {
      holder[key] = '_' + uuid.v4();
    }
    return holder[key];
  }

  // simple は page.groups を正本とし、表示時だけ pseudo node を生成する。
  function buildSimpleGroupPseudoNode(group) {
    if (!group || false === group.visible || 'simple' !== group.type) {
      return null;
    }
    return {
      id: makeStablePseudoId(group, 'pseudoNodeId'),
      type: 'Group',
      pseudo: true,
      groupType: 'simple',
      groupRef: group.id,
      visible: true,
      changed: true,
      x: 0,
      y: 0,
      size: { width: 0, height: 0 },
      audit: makeAudit(),
      font: defaultFont,
      color: 'none',
      outline: '#888888'
    };
  }

  // vertical / horizontal group は spine 表示用の pseudo link を持つ。
  function buildTopicGroupPseudoLink(group) {
    if (!group || false === group.visible) {
      return null;
    }
    if (!('vertical' === group.type || 'horizontal' === group.type)) {
      return null;
    }
    return {
      id: makeStablePseudoId(group, 'pseudoLinkId'),
      type: 'Link',
      pseudo: true,
      shape: 'NORMAL',
      groupType: group.type,
      groupRef: group.id,
      visible: true,
      color: (group.spine && group.spine.color) || '#888888',
      size: (group.spine && group.spine.width) || 6,
      font: defaultLink.style.font,
      audit: makeAudit()
    };
  }

  // timeline axis は group 定義から pseudo link を作る。
  function buildTimelineAxisPseudoLink(group) {
    if (!group || false === group.visible || 'timeline' !== group.type) {
      return null;
    }
    return {
      id: makeStablePseudoId(group, 'axisPseudoLinkId'),
      type: 'Link',
      pseudo: true,
      shape: 'NORMAL',
      linkType: 'timeline-axis',
      groupType: 'timelineAxis',
      groupRef: group.id,
      visible: true,
      color: (group.spine && group.spine.color) || '#888888',
      size: (group.spine && group.spine.width) || 4,
      font: defaultLink.style.font,
      audit: makeAudit()
    };
  }

  // page.groups を唯一の正本とし、描画時だけ擬似 node/link を作る。
  function buildGroupPseudoGroups(page) {
    var result = { nodes: [], links: [] };

    ((page && page.groups) || []).forEach(function (group) {
      var node, link;

      if (!group || false === group.visible) {
        return;
      }

      if ('simple' === group.type) {
        node = buildSimpleGroupPseudoNode(group);
        if (node) {
          result.nodes.push(node);
        }
        return;
      }

      if ('vertical' === group.type || 'horizontal' === group.type) {
        link = buildTopicGroupPseudoLink(group);
        if (link) {
          result.links.push(link);
        }
        return;
      }

      if ('timeline' === group.type) {
        link = buildTimelineAxisPseudoLink(group);
        if (link) {
          result.links.push(link);
        }
        return;
      }

      if (wuwei.timeline &&
        typeof wuwei.timeline.isAxisGroup === 'function' &&
        wuwei.timeline.isAxisGroup(group) &&
        typeof wuwei.timeline.buildTimelineAxisPseudoLink === 'function') {
        link = wuwei.timeline.buildTimelineAxisPseudoLink(group);
        if (link) {
          result.links.push(link);
        }
      }
    });

    return result;
  }

  createGroup = function (param) {
    param = param || {};
    var spine = param.spine || {};
    var timeline = (param.timeline && 'object' === typeof param.timeline) ? param.timeline : {};
    var members = Array.isArray(param.members)
      ? param.members.map(function (member, index) {
        if ('string' === typeof member) {
          return {
            nodeId: member,
            order: index + 1,
            role: 'member'
          };
        }
        return {
          nodeId: member && member.nodeId,
          order: Number((member && member.order) || (index + 1)),
          role: (member && member.role) || 'member'
        };
      }).filter(function (member) {
        return !!member.nodeId;
      })
      : [];

    return {
      id: param.id || util.createUuid(),
      name: param.name || '',
      type: param.type || 'simple',
      groupType: param.groupType,
      description: (param.description && 'object' === typeof param.description)
        ? param.description
        : { format: 'plain', body: '' },
      visible: (typeof param.visible === 'boolean') ? param.visible : (param.enabled !== false),
      moveTogether: (false !== param.moveTogether),
      orientation: param.orientation || 'auto',
      spine: ('simple' === param.type) ? undefined : {
        kind: spine.kind || 'SOLID',
        color: spine.color || '#888888',
        width: Number(spine.width || 6),
        padding: Number(spine.padding || 12)
      },
      timeline: ('timeline' === param.type) ? {
        unit: timeline.unit || 'second',
        start: Number.isFinite(Number(timeline.start)) ? Number(timeline.start) : (Number.isFinite(Number(param.timeStart)) ? Number(param.timeStart) : 0),
        end: Number.isFinite(Number(timeline.end)) ? Number(timeline.end) : (Number.isFinite(Number(param.timeEnd)) ? Number(param.timeEnd) : 0),
        mediaRef: timeline.mediaRef || param.mediaRef || '',
        defaultPlayDuration: Number.isFinite(Number(timeline.defaultPlayDuration)) ? Number(timeline.defaultPlayDuration) : (Number.isFinite(Number(param.defaultPlayDuration)) ? Number(param.defaultPlayDuration) : 15)
      } : undefined,
      members: members,
      axis: param.axis ? util.clone(param.axis) : undefined,
      origin: param.origin ? util.clone(param.origin) : undefined,
      mediaRef: param.mediaRef || (timeline && timeline.mediaRef) || '',
      defaultPlayDuration: Number.isFinite(Number(param.defaultPlayDuration))
        ? Number(param.defaultPlayDuration)
        : (Number.isFinite(Number(timeline.defaultPlayDuration)) ? Number(timeline.defaultPlayDuration) : undefined),
      timeStart: Number.isFinite(Number(param.timeStart)) ? Number(param.timeStart) : undefined,
      timeEnd: Number.isFinite(Number(param.timeEnd)) ? Number(param.timeEnd) : undefined,
      length: Number.isFinite(Number(param.length)) ? Number(param.length) : undefined,
      audit: param.audit || makeAudit()
    };
  };

  // Node
  Node = function (param) {
    param = param || {};
    assertNoLegacyRuntimeFields(param, 'Node');
    var self = {};
    var pos;
    // var currentUser = (state && state.currentUser) ? state.currentUser : {};
    // var userName = currentUser.name || currentUser.login || 'guest';
    // var userId = currentUser.user_id || common.TEMP_OWNER_ID;

    Object.keys(param).forEach(function (key) {
      self[key] = param[key];
    });

    if (!self.id) {
      self.id = util.createUuid();
    }

    self.type = self.type || 'Topic';
    self.label = ('string' === typeof self.label) ? self.label : '';

    self.description = (self.description && 'object' === typeof self.description)
      ? self.description
      : {
        format: 'asciidoc',
        body: ('string' === typeof self.value) ? self.value : ''
      };

    // 最終モデルは visible を直値で持つ
    self.visible = (typeof self.visible === 'boolean') ? self.visible : true;

    // runtime only
    self.changed = !!self.changed;
    self.dragging = !!self.dragging;
    self.filterout = !!self.filterout;

    self.audit = (self.audit && 'object' === typeof self.audit) ? self.audit : makeAudit();
    self.shape = self.shape || 'RECTANGLE';

    if (!self.size || 'object' !== typeof self.size) {
      self.size = {};
    }

    if ('CIRCLE' === self.shape) {
      self.size.radius = finiteOr(self.size.radius, common.defaultSize.radius);
      delete self.size.width;
      delete self.size.height;
    }
    else if ('Topic' == self.type) {
      self.size.width = finiteOr(self.size.width, common.defaultSize.width);
      self.size.height = finiteOr(self.size.height, common.defaultSize.height);
      delete self.size.radius;
    }
    else if ('MEMO' === self.shape) {
      self.size.width = finiteOr(self.size.width, common.defaultSize.memo);
      self.size.height = finiteOr(self.size.height, common.defaultSize.memo);
      delete self.size.radius;
    }
    else {
      self.size.width = finiteOr(self.size.width, common.defaultSize.content);
      self.size.height = finiteOr(self.size.height, common.defaultSize.content);
      delete self.size.radius;
    }

    self.style = (self.style && 'object' === typeof self.style) ? self.style : {};

    if (!self.style.fill) {
      if ('Memo' === self.type) {
        self.style.fill = '#FFF7B0';
      }
      else if ('Content' === self.type) {
        self.style.fill = Color.contentFill || Color.nodeFill;
      }
      else {
        self.style.fill = Color.nodeFill;
      }
    }

    self.style.font = self.style.font || common.defaultFont;

    self.style.line = self.style.line || {
      kind: 'SOLID',
      color: Color.nodeOutline,
      width: 1
    };

    // runtime mirror for draw/text rendering
    self.color = self.style.fill;
    self.outline = self.style.line.color;
    self.font = {
      size: finiteOr(self.style.font.size, 14),
      color: self.style.font.color || common.defaultFont.color,
      family: self.style.font.family || common.defaultFont.family,
      'text-anchor':
        (self.style.font.align === 'left') ? 'start' :
          ((self.style.font.align === 'right') ? 'end' : 'middle')
    };

    pos = newPosition(param.x, param.y);
    self.x = finiteOr(param.x, finiteOr(self.x, finiteOr(pos.x, 0)));
    self.y = finiteOr(param.y, finiteOr(self.y, finiteOr(pos.y, 0)));

    self.vx = finiteOr(self.vx, 0);
    self.vy = finiteOr(self.vy, 0);

    if (param.fx === null || self.fx === null) {
      self.fx = null;
    } else if (typeof param.fx !== 'undefined') {
      self.fx = finiteOr(param.fx, self.x);
    } else {
      self.fx = null;
    }

    if (param.fy === null || self.fy === null) {
      self.fy = null;
    } else if (typeof param.fy !== 'undefined') {
      self.fy = finiteOr(param.fy, self.y);
    } else {
      self.fy = null;
    }

    // type-specific optional attributes:
    // topicKind, time, groupRef, axisRole などは
    // 標準ではここで既定値を与えない。
    // 必要な node 生成側で明示的に設定する。

    if ('Content' === self.type) {
      self.resource = (self.resource && 'object' === typeof self.resource) ? self.resource : {};
      self.resource.kind = self.resource.kind || 'general';
      self.resource.uri = self.resource.uri || '';
      self.resource.canonicalUri = self.resource.canonicalUri || '';
      self.resource.mimeType = self.resource.mimeType || 'text/plain';
      self.resource.title = self.resource.title || self.label || '';
      self.resource.owner = self.resource.owner || '';
      self.resource.copyright = self.resource.copyright || '';
      self.resource.viewer = (self.resource.viewer && 'object' === typeof self.resource.viewer)
        ? self.resource.viewer
        : {
          supportedModes: ['infoPane', 'newTab', 'newWindow', 'download'],
          defaultMode: 'infoPane'
        };
    } else {
      delete self.resource;
    }

    if ('THUMBNAIL' === self.shape) {
      self.thumbnailUri = self.thumbnailUri || '';
    } else {
      delete self.thumbnailUri;
    }

    if ('MEMO' === self.shape) {
      self.style.memo = (self.style.memo && 'object' === typeof self.style.memo)
        ? self.style.memo
        : common.defaultStyle.memo;
    } else {
      delete self.style.memo;
    }

    if (!Number.isFinite(self.x)) { self.x = 0; }
    if (!Number.isFinite(self.y)) { self.y = 0; }
    if (!Number.isFinite(self.vx)) { self.vx = 0; }
    if (!Number.isFinite(self.vy)) { self.vy = 0; }
    if (self.fx !== null && !Number.isFinite(self.fx)) { self.fx = self.x; }
    if (self.fy !== null && !Number.isFinite(self.fy)) { self.fy = self.y; }

    return self;
  };

  function finiteOr(value, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? value : fallback;
  }

  function safeEventCoord(value, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? value : fallback;
  }

  function cloneForLog(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    }
    catch (e) {
      return obj;
    }
  }

  function ensureFiniteNodePosition(d) {
    var pos;

    if (!d) {
      return;
    }

    pos = newPosition(0, 0);

    d.x = finiteOr(d.x, finiteOr(pos.x, 0));
    d.y = finiteOr(d.y, finiteOr(pos.y, 0));
    d.vx = finiteOr(d.vx, 0);
    d.vy = finiteOr(d.vy, 0);

    if (d.fx !== null && typeof d.fx !== 'undefined') {
      d.fx = finiteOr(d.fx, d.x);
    }
    if (d.fy !== null && typeof d.fy !== 'undefined') {
      d.fy = finiteOr(d.fy, d.y);
    }
  }

  function getSelectedNonGroupNodeIds(page) {
    var ids = [];
    var seen = {};

    d3.selectAll('g.node.selected').each(function () {
      var nodeId = this.id;
      var groups = [];

      if (!nodeId || seen[nodeId]) {
        return;
      }

      groups = findGroupsByNodeId(nodeId).filter(function (group) {
        return group && false !== group.visible;
      });

      if (!groups.length) {
        ids.push(nodeId);
        seen[nodeId] = true;
      }
    });

    return ids;
  }

  function getDragMoveIds(page, d) {
    var nodeGroups = [];
    var selectedIds;

    if (!d) {
      return [];
    }

    nodeGroups = findGroupsByNodeId(d.id).filter(function (group) {
      return group && false !== group.visible;
    });

    // group 所属 node は常に単独移動
    if (nodeGroups.length > 0) {
      return [d.id];
    }

    // 非 group node のみ通常複数選択移動
    selectedIds = getSelectedNonGroupNodeIds(page);
    if (!state.Selecting &&
      d3.select('g.node#' + d.id).classed('selected') &&
      selectedIds.length > 1 &&
      selectedIds.indexOf(d.id) >= 0) {
      return selectedIds;
    }

    return [d.id];
  }

  function getDragMoveConstraint(d) {
    var page = getCurrentPage();
    var nodeGroups = [];
    var topicGroups;

    if (!page || !d) {
      return null;
    }

    nodeGroups = findGroupsByNodeId(d.id).filter(function (group) {
      return group && false !== group.visible;
    });

    topicGroups = nodeGroups.filter(function (group) {
      return group && ('horizontal' === group.type || 'vertical' === group.type);
    });

    if (!topicGroups.length) {
      return null;
    }

    return getGroupOrientation(topicGroups[0].id);
  }

  function buildDragMoveOrigin(ids) {
    var origin = {};

    (ids || []).forEach(function (id) {
      var node = findNodeById(id);
      if (!node) {
        return;
      }
      ensureFiniteNodePosition(node);
      origin[id] = { x: node.x, y: node.y };
    });

    return origin;
  }

  function updateEditingCircleForNode(node) {
    var editingCircle = document.getElementById('Editing');
    if (!editingCircle || !node || !node.id) {
      return;
    }
    if (editingCircle.dataset.node_id !== node.id || '1' !== editingCircle.style.opacity) {
      return;
    }
    editingCircle.setAttribute('cx', node.x);
    editingCircle.setAttribute('cy', node.y);
  }

  Node.prototype.dragstarted = function (d) {
    var page, ownerId;

    if ('view' === graph.mode) { return; }
    ownerId = getRecordOwnerId(d);
    if (ownerId && ownerId !== common.getCurrentOwnerId()) { return; }

    ensureFiniteNodePosition(d);

    d.dragging = true;
    state.dragging = true;
    menu.closeContextMenu();

    page = common.current ? common.current.page : null;

    if ('draw' === graph.mode) {
      state.dragMoveIds = getDragMoveIds(page, d);
      state.dragMoveAnchor = { x: d.x, y: d.y };
      state.dragMoveOrigin = buildDragMoveOrigin(state.dragMoveIds);
      state.dragMoveConstraint = getDragMoveConstraint(d);

      (state.dragMoveIds || []).forEach(function (id) {
        var node = findNodeById(id);
        if (!node) {
          return;
        }
        ensureFiniteNodePosition(node);
      });
    }
    else if ('simulation' === graph.mode) {
      draw.restart({ nodes: graph.nodes, links: graph.links });

      if (!d3.event.active) {
        common.simulation.alphaTarget(0.3).restart();
      }

      d.fx = d.x;
      d.fy = d.y;

      state.dragMoveIds = [d.id];
      state.dragMoveAnchor = { x: d.x, y: d.y };
      state.dragMoveOrigin = buildDragMoveOrigin(state.dragMoveIds);
      state.dragMoveConstraint = null;
    }
  };

  function rerenderByGraphMode() {
    if ('simulation' === graph.mode) {
      if (wuwei.draw && typeof wuwei.draw.restart === 'function') {
        wuwei.draw.restart({ nodes: graph.nodes, links: graph.links });
      }
    }
    else {
      if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
        wuwei.draw.refresh();
      }
    }
    util.drawMiniature();
  }

  // Timeline endpoint drag updates only axis geometry.
  // Media time range (axis.start / axis.end) is preserved.
  // Axis display length is stored in group.length.
  function updateTimelineAxisGeometryByEndpointDrag(group, pageNode, x, y) {
    if (wuwei.timeline && typeof wuwei.timeline.updateTimelineAxisGeometryByEndpointDrag === 'function') {
      return wuwei.timeline.updateTimelineAxisGeometryByEndpointDrag(group, pageNode, x, y);
    }
    return false;
  }

  // Mid-point drag updates media time only.
  function updateTimelineSegmentTimeFromPosition(group, pageNode, x, y) {
    if (wuwei.timeline && typeof wuwei.timeline.updateTimelineSegmentTimeFromPosition === 'function') {
      return wuwei.timeline.updateTimelineSegmentTimeFromPosition(group, pageNode, x, y);
    }
    return false;
  }

  function handleTimelineSegmentDrag(d, eventX, eventY) {
    if (wuwei.timeline && typeof wuwei.timeline.handleSegmentDrag === 'function') {
      return wuwei.timeline.handleSegmentDrag(d, eventX, eventY);
    }
    return false;
  }

  Node.prototype.dragged = function (d) {
    var eventX, eventY, deltaX, deltaY, page, moved, ownerId;

    if ('view' === graph.mode) { return; }
    ownerId = getRecordOwnerId(d);
    if (ownerId && ownerId !== common.getCurrentOwnerId()) { return; }

    ensureFiniteNodePosition(d);

    state.dragging = true;
    d.dragging = true;

    page = common.current ? common.current.page : null;
    eventX = safeEventCoord(d3.event && d3.event.x, d.x);
    eventY = safeEventCoord(d3.event && d3.event.y, d.y);

    if (page && handleTimelineSegmentDrag(d, eventX, eventY)) {
      moved = findNodeById(d.id);
      if (moved) {
        d.x = moved.x;
        d.y = moved.y;
        d.fx = moved.x;
        d.fy = moved.y;
        d.vx = 0;
        d.vy = 0;
        d.changed = true;
      }

      rerenderByGraphMode();
      return;
    }

    if ('draw' === graph.mode) {
      if (!Array.isArray(state.dragMoveIds) || !state.dragMoveOrigin || !state.dragMoveAnchor) {
        return;
      }

      deltaX = eventX - finiteOr(state.dragMoveAnchor.x, d.x);
      deltaY = eventY - finiteOr(state.dragMoveAnchor.y, d.y);

      if ('horizontal' === state.dragMoveConstraint) {
        deltaY = 0;
      }
      else if ('vertical' === state.dragMoveConstraint) {
        deltaX = 0;
      }

      (state.dragMoveIds || []).forEach(function (nodeId) {
        var page = getCurrentPage();
        var movedNode = findNodeById(nodeId);
        var origin = state.dragMoveOrigin[nodeId];

        if (!movedNode || !origin) {
          return;
        }

        ensureFiniteNodePosition(movedNode);

        movedNode.x = finiteOr(origin.x, movedNode.x) + deltaX;
        movedNode.y = finiteOr(origin.y, movedNode.y) + deltaY;
        movedNode.fx = movedNode.x;
        movedNode.fy = movedNode.y;
        movedNode.vx = 0;
        movedNode.vy = 0;
        movedNode.changed = true;
      });

      if (wuwei.draw && typeof wuwei.draw.refresh === 'function') {
        wuwei.draw.refresh();
      }
      (state.dragMoveIds || [d.id]).forEach(function (nodeId) {
        updateEditingCircleForNode(findNodeById(nodeId));
      });
      util.drawMiniature();
    }
    else if ('simulation' === graph.mode) {
      d.fx = d.x = finiteOr(eventX, d.x);
      d.fy = d.y = finiteOr(eventY, d.y);
      d.vx = 0;
      d.vy = 0;

      updateEditingCircleForNode(d);
      util.drawMiniature();
    }
  };

  Node.prototype.dragended = function (d) {
    var movedNodes = [];
    var page, eventX, eventY, pageNode, ownerId;

    if ('view' === graph.mode) { return; }
    ownerId = getRecordOwnerId(d);
    if (ownerId && ownerId !== common.getCurrentOwnerId()) { return; }

    state.dragging = false;
    d.dragging = false;

    page = common.current ? common.current.page : null;
    eventX = safeEventCoord(d3.event && d3.event.x, d.x);
    eventY = safeEventCoord(d3.event && d3.event.y, d.y);

    if (page && handleTimelineSegmentDrag(d, eventX, eventY)) {
      pageNode = findNodeById(d.id);
      if (pageNode) {
        d.x = pageNode.x;
        d.y = pageNode.y;
        d.fx = null;
        d.fy = null;
        d.vx = 0;
        d.vy = 0;
        movedNodes.push(cloneForLog(pageNode));
      }
      state.dragMoveIds = null;
      state.dragMoveOrigin = null;
      state.dragMoveAnchor = null;
      state.dragMoveConstraint = null;
      rerenderByGraphMode();
      log.storeLog({ operation: 'drag' });
      return;
    }

    if ('draw' === graph.mode) {
      (state.dragMoveIds || [d.id]).forEach(function (id) {
        var page = getCurrentPage();
        var node = findNodeById(id);
        if (!node) {
          return;
        }

        ensureFiniteNodePosition(node);

        node.fx = null;
        node.fy = null;
        node.vx = finiteOr(node.vx, 0);
        node.vy = finiteOr(node.vy, 0);

        updateEditingCircleForNode(node);
        movedNodes.push(cloneForLog(node));
      });
    }
    else if ('simulation' === graph.mode) {
      ensureFiniteNodePosition(d);

      d.fx = null;
      d.fy = null;
      d.vx = finiteOr(d.vx, 0);
      d.vy = finiteOr(d.vy, 0);

      if (!d3.event.active) {
        common.simulation.alphaTarget(0);
      }

      updateEditingCircleForNode(d);
      movedNodes.push(cloneForLog(d));
    }
    util.drawMiniature();
    state.dragMoveIds = null;
    state.dragMoveOrigin = null;
    state.dragMoveAnchor = null;
    state.dragMoveConstraint = null;
    log.storeLog({ operation: 'drag' });
  };

  NodeFactory = function (param) {
    if (!param || !param.id) {
      return null;
    }
    return new Node(param);
  };

  createNode = function (param) {
    if (!param) { return null; }
    var node = NodeFactory(param);
    var page = getCurrentPage();
    if (!node) { return null; }
    if (page) {
      if (!Array.isArray(page.nodes)) { page.nodes = []; }
      util.appendById(page.nodes, node);
    }
    /** append graph.nodes */
    util.appendById(graph.nodes, node);
    return node;
  };

  removeNode = function (param) {
    var
      page = getCurrentPage(),
      id = param.id,
      node = findNodeById(id),
      connectedLinks,
      links,
      link, linkids = [];

    if (!id) {
      return linkids;
    }

    /** remove from current page nodes */
    if (page && Array.isArray(page.nodes)) {
      util.removeById(page.nodes, id);
      removeNodeFromAllGroups(id);
    }

    /** remove from graph.nodes */
    util.removeById(graph.nodes, id);

    /** remove connected links */
    connectedLinks = findLinksByNode(node);
    if (connectedLinks) {
      links = connectedLinks.links;
      if (links) {
        for (link of links) {
          link.visible = false;
          linkids.push(link.id);
          removeLink(link);
        }
      }
    }
    return linkids;
  };

  addNode = function (item) {
    let node = item.node;
    if ('ROUNDED' === node.shape) {
      if (!node.size.rx || !node.size.ry) {
        if (node.size.width > node.size.height) {
          node.size.rx = node.size.height / 2;
          node.size.ry = node.size.height / 2;
        }
        else {
          node.size.rx = node.size.width / 2;
          node.size.ry = node.size.width / 2;
        }
      }
    }
    else if ('ELLIPSE' === node.shape) {
      if (undefined === node.size.rx || undefined === node.size.ry) {
        node.size.rx = node.size.width / 2;
        node.size.ry = node.size.height / 2;
      }
    }

    node = createNode(node);
    return { node: node };
  };

  updateNode = function (node) {
    var page = getCurrentPage();
    if (page) {
      if (!Array.isArray(page.nodes)) { page.nodes = []; }
      util.appendById(page.nodes, node);
    }
    util.appendById(common.graph.nodes, node);
  };

  showNodes = function (nodes) {
    for (let node of nodes) {
      node.visible = true;
      updateNode(node);
    }
  };

  hideNodes = function (nodes) {
    for (let node of nodes) {
      if (node.visible) {
        node.visible = false;
        updateNode(node);
      }
    }
  };

  const
    digit = '(-?\\d*\\.?\\d+)',
    digits = '(-?\\d*\\.?\\d+),(-?\\d*\\.?\\d+)',
    //
    // HORIZONTAL
    // 1) M(P1)-LPa-Q(P2)Pb-VPc-Q(P3)Pd-L(P4)
    rgx1h = new RegExp(`M${digits} L${digits} Q${digits} ${digits} V${digit} Q${digits} ${digits} L${digits}`),
    // 2) M(P1)-LPa-Q(P2)Pb-V(P3)
    rgx2h = new RegExp(`M${digits} L${digits} Q${digits} ${digits} V${digit}`),
    // 3) M(P2)-VPc-Q(P3)Pd-L(P4)
    rgx3h = new RegExp(`M${digits} V${digit} Q${digits} ${digits} L${digits}`),
    // 4) M(P2)-V(P3)
    rgx4h = new RegExp(`M${digits} V${digit}`),
    //
    // VERTICAL
    // 1) M(P1)-LPa-Q(P2)Pb-HPc-Q(P3)Pd-L(P4)
    rgx1v = new RegExp(`M${digits} L${digits} Q${digits} ${digits} H${digit} Q${digits} ${digits} L${digits}`),
    // 2) M(P1)-LPa-Q(P2)Pb-H(P3)
    rgx2v = new RegExp(`M${digits} L${digits} Q${digits} ${digits} H${digit}`),
    // 3) M(P2)-HPc-Q(P3)Pd-L(P4)
    rgx3v = new RegExp(`M${digits} H${digit} Q${digits} ${digits} L${digits}`),
    // 4) M(P2)-H(P3)
    rgx4v = new RegExp(`M${digits} H${digit}`),
    //
    // HORIZONTAL2
    // 1) Q(P2)Pb-LPc-Q(P3)Pd-VPe-Q(P4)Pf-LPg-Q(P5)
    rgxH1 = new RegExp(`Q${digits} ${digits} L${digits} Q${digits} ${digits} V${digit} Q${digits} ${digits} L${digits} Q${digits}`),
    // 2) Q(P2)Pb-LPc-Q(P3)Pd-VPe-Q(P4)Pf-L(P5)
    rgxH2 = new RegExp(`Q${digits} ${digits} L${digits} Q${digits} ${digits} V${digit} Q${digits} ${digits} L${digits}`),
    // 3) Q(P2)Pb-LPc-Q(P3)Pd-V(P4)
    rgxH3 = new RegExp(`Q${digits} ${digits} L${digits} Q${digits} ${digits} V${digit}`),
    // 4) M(P2)-LPc-Q(P3)Pd-VPe-Q(P4)Pf-LPg-Q(P5)
    rgxH4 = new RegExp(`M${digits} L${digits} Q${digits} ${digits} V${digit} Q${digits} ${digits} L${digits} Q${digits}`),
    // 5) M(P2)-LPc-Q(P3)Pd-VPe-Q(P4)Pf-L(P5)
    rgxH5 = new RegExp(`M${digits} L${digits} Q${digits} ${digits} V${digit} Q${digits} ${digits} L${digits}`),
    // 6) M(P2)-LPc-Q(P3)Pd-V(P4)
    rgxH6 = new RegExp(`M${digits} L${digits} Q${digits} ${digits} V${digit}`),
    // 7) M(P3)-VPe-Q(P4)Pf-LPg-Q(P5)
    rgxH7 = new RegExp(`M${digits} V${digit} Q${digits} ${digits} L${digits} Q${digits}`),
    // 8) M(P3)-VPe-Q(P4)Pf-L(P5)'
    rgxH8 = new RegExp(`M${digits} V${digit} Q${digits} ${digits} L${digits}`),
    // 9) M(P3)-V(P4)'
    rgxH9 = new RegExp(`M${digits} V${digit}`),
    //
    // VERTICAL2
    // 1) Q(P2)Pb-LPc-Q(P3)Pd-HPe-Q(P4)Pf-LPg-Q(P5)
    rgxV1 = new RegExp(`Q${digits} ${digits} L${digits} Q${digits} ${digits} H${digit} Q${digits} ${digits} L${digits} Q${digits}`),
    // 2) Q(P2)Pb-LPc-Q(P3)Pd-HPe-Q(P4)Pf-L(P5)
    rgxV2 = new RegExp(`Q${digits} ${digits} L${digits} Q${digits} ${digits} H${digit} Q${digits} ${digits} L${digits}`),
    // 3) Q(P2)Pb-LPc-Q(P3)Pd-HP4
    rgxV3 = new RegExp(`Q${digits} ${digits} L${digits} Q${digits} ${digits} H${digit}`),
    // 4) M(P2)-LPc-Q(P3)Pd-HPe-Q(P4)Pf-LPg-Q(P5)
    rgxV4 = new RegExp(`M${digits} L${digits} Q${digits} ${digits} H${digit} Q${digits} ${digits} L${digits} Q${digits}`),
    // 5) M(P2)-LPc-Q(P3)Pd-HPe-Q(P4)Pf-LP5
    rgxV5 = new RegExp(`M${digits} L${digits} Q${digits} ${digits} H${digit} Q${digits} ${digits} L${digits}`),
    // 6) M(P2)-LPc-Q(P3)Pd-H(P4)
    rgxV6 = new RegExp(`M${digits} L${digits} Q${digits} ${digits} H${digit}`),
    // 7) M(P3)-HPe-Q(P4)Pf-LPg-Q(P5)
    rgxV7 = new RegExp(`M${digits} H${digit} Q${digits} ${digits} L${digits} Q${digits}`),
    // 8) M(P3)-HPe-Q(P4)Pf-L(P5)'
    rgxV8 = new RegExp(`M${digits} H${digit} Q${digits} ${digits} L${digits}`),
    // 9) M(P3)-H(P4)'
    rgxV9 = new RegExp(`M${digits} H${digit}`);

  Link = function (param) {
    param = param || {};
    assertNoLegacyRuntimeFields(param, 'Link');

    var self = {};
    var currentUser = (state && state.currentUser) ? state.currentUser : {};
    var userName = currentUser.name || currentUser.login || 'guest';
    var userId = currentUser.user_id || common.TEMP_OWNER_ID;

    self.id = param.id || util.createUuid();

    self.type = 'Link';

    self.from = param.from || '';
    self.to = param.to || '';

    self.relation = param.relation || '';
    self.label = ('string' === typeof param.label) ? param.label : '';

    self.description = (param.description && 'object' === typeof param.description)
      ? param.description
      : {
        format: 'plain',
        body: String(param.description || '')
      };

    self.x = finiteOr(param.x, 0);
    self.y = finiteOr(param.y, 0);

    self.shape = param.shape || 'NORMAL';
    self.visible = (typeof param.visible === 'boolean') ? param.visible : true;

    self.style = (param.style && 'object' === typeof param.style) ? param.style : {};

    self.style.font = self.style.font || {
      size: common.defaultFont.size,
      color: common.defaultFont.color,
      family: common.defaultFont.family,
      align: 'center'
    };

    self.style.line = self.style.line || {
      kind: 'SOLID',
      color: defaultLink.style.line.color,
      width: defaultLink.style.line.size
    };

    self.routing = (param.routing && 'object' === typeof param.routing) ? param.routing : {};
    self.routing.path = self.routing.path || '';

    self.filterout = !!param.filterout; // runtime only

    self.audit = (param.audit && 'object' === typeof param.audit) ? param.audit : makeAudit();

    // runtime mirror
    self.font = {
      size: finiteOr(self.style.font.size, common.defaultFont.size),
      color: self.style.font.color || common.defaultFont.color,
      family: self.style.font.family || common.defaultFont.family
    };
    self.color = self.style.line.color;
    self.size = finiteOr(self.style.line.width, defaultLink.style.line.width);

    if (!Number.isFinite(self.x)) { self.x = 0; }
    if (!Number.isFinite(self.y)) { self.y = 0; }

    return self;
  };

  function startPoint(link) {
    let path, x, y, match;
    if (!link.path) {
      x = y = 0;
    } else {
      path = link.path;
      match = path.match(/^M([-]?\d*\.?\d*),([-]?\d*\.?\d*)/);
      if (!match) {
        x = y = 0;
      }
      else {
        x = +match[1]; y = +match[2];
      }
    }
    return { x: x, y: y };
  }

  function endPoint(link) {
    let path, x, y, match1;
    if (!link.path) {
      x = y = 0;
    }
    else {
      path = link.path;
      match1 = path.match(/[QL]([-]?\d*\.?\d*),([-]?\d*\.?\d*)$/);
      if (match1) {
        x = +match1[1]; y = +match1[2];
      }
      else {
        let match2 = path.match(/([-]?\d*\.?\d*),([-]?\d*\.?\d*) H([-]?\d*\.?\d*)$/);
        if (match2) {
          x = +match2[3]; y = +match2[2];
        }
        else {
          let match3 = path.match(/([-]?\d*\.?\d*),([-]?\d*\.?\d*) V([-]?\d*\.?\d*)$/);
          if (match3) {
            x = +match3[1]; y = +match3[3];
          }
        }
      }
    }
    return { x: x, y: y };
  }

  function strokeDasharrayForLineKind(kind, width) {
    var dash;
    if (!kind || 'SOLID' === kind) { return ''; }
    if ('DOTTED' === kind) { dash = [1.5, 1.5]; }
    else if ('DASHED' === kind) { dash = [4, 2]; }
    else if ('LONG_DASHED' === kind || 'LONG-DASHED' === kind) { dash = [6, 3]; }
    else if (/^\s*\d+(\.\d+)?\s+\d+(\.\d+)?/.test(String(kind))) {
      dash = String(kind).trim().split(/\s+/).map(Number);
    }
    else { return ''; }
    return dash
      .map(function (w) { return w * (1 + Math.log2(width || 1)); })
      .join(' ');
  }

  function buildArrowPath(kind, size) {
    var length = Number(size) || 12;
    var half = Math.max(2, length / 4);
    if (!kind) { return null; }
    if ('LINE-ARROW' === kind) {
      return {
        d: 'M-' + length + ',-' + half + ' L0,0 L-' + length + ',' + half,
        fill: 'none'
      };
    }
    if ('RHOMBUS' === kind || 'HOLLOW-RHOMBUS' === kind) {
      return {
        d: 'M0,0 L-' + (length / 2) + ',-' + half + ' L-' + length + ',0 L-' + (length / 2) + ',' + half + ' Z',
        fill: ('HOLLOW-RHOMBUS' === kind) ? 'none' : null
      };
    }
    if ('CIRCLE' === kind || 'HOLLOW-CIRCLE' === kind) {
      var r = Math.max(2, length / 3);
      return {
        d: 'M0,0 m-' + r + ',0 a' + r + ',' + r + ' 0 1,0 ' + (r * 2) + ',0 a' + r + ',' + r + ' 0 1,0 -' + (r * 2) + ',0',
        fill: ('HOLLOW-CIRCLE' === kind) ? 'none' : null
      };
    }
    return {
      d: 'M0,0 L-' + length + ',-' + half + ' V' + half + ' Z',
      fill: ('HOLLOW-ARROW' === kind) ? 'none' : null
    };
  }

  function applyLinkMarkers(d3link, link, pathEl, color, width) {
    var routing, pathLength, startArrow, endArrow, ref, start, startNext, end, endPrev;

    if (!d3link || !pathEl) {
      return;
    }

    d3link.selectAll('path.Marker,path.StartMarker,path.EndMarker').remove();

    routing = (link.routing && 'object' === typeof link.routing) ? link.routing : {};
    startArrow = routing.startArrow;
    endArrow = routing.endArrow;
    pathLength = pathEl.getTotalLength();
    if (!pathLength) {
      return;
    }

    function appendMarker(className, arrow, point, nextPoint) {
      var shape, alpha;
      if (!arrow || !arrow.kind) {
        return;
      }
      shape = buildArrowPath(arrow.kind, arrow.size || 12);
      if (!shape) {
        return;
      }
      alpha = 180 * Math.atan2(point.y - nextPoint.y, point.x - nextPoint.x) / Math.PI;
      d3link.append('path')
        .attr('class', className)
        .attr('d', shape.d)
        .attr('fill', shape.fill === null ? color : shape.fill)
        .attr('stroke', color)
        .attr('stroke-width', width)
        .attr('transform', 'translate(' + point.x + ',' + point.y + ') rotate(' + alpha + ')');
    }

    ref = Math.min(16, pathLength / 2);
    start = pathEl.getPointAtLength(0);
    startNext = pathEl.getPointAtLength(ref);
    end = pathEl.getPointAtLength(pathLength);
    endPrev = pathEl.getPointAtLength(pathLength - ref);

    appendMarker('StartMarker Marker', startArrow, start, startNext);
    appendMarker('EndMarker Marker', endArrow, end, endPrev);
  }

  function getLinkPath(link) {
    return (((link || {}).routing || {}).path) || '';
  }

  function getLinkEndPositionKey(end) {
    return ('start' === end) ? 'startPosition' : 'endPosition';
  }

  function getLinkEndPosition(link, end) {
    var key = getLinkEndPositionKey(end);
    return (((link || {}).routing || {})[key]) || '';
  }

  function setLinkEndPosition(link, end, value) {
    var key = getLinkEndPositionKey(end);
    link.routing = link.routing || {};
    if (value === null || value === undefined || '' === value) {
      delete link.routing[key];
    } else {
      link.routing[key] = value;
    }
  }

  function getLinkEndNode(link, end) {
    var nodeId = ('start' === end) ? link.from : link.to;
    return nodeId ? findNodeById(nodeId) : null;
  }

  function swapLinkPathMirror(link) {
    // render/hierarchyLink 側がまだ link.path を使う場合の暫定 mirror
    if (link && link.routing) {
      link.path = link.routing.path || '';
    }
    return link;
  }

  function getEventContextPoint() {
    var ev = (d3.event && d3.event.sourceEvent) ? d3.event.sourceEvent : d3.event;
    var x = ev && Number.isFinite(Number(ev.clientX)) ? Number(ev.clientX) :
      (ev && Number.isFinite(Number(ev.x)) ? Number(ev.x) : NaN);
    var y = ev && Number.isFinite(Number(ev.clientY)) ? Number(ev.clientY) :
      (ev && Number.isFinite(Number(ev.y)) ? Number(ev.y) : NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return wuwei.util.pContext({ x: x, y: y });
  }

  Link.prototype.dragstarted = function (d) {
    if ('view' === graph.mode) { return; }

    const se = (d3.event && d3.event.sourceEvent) ? d3.event.sourceEvent : d3.event;
    if (se && se.stopImmediatePropagation) { se.stopImmediatePropagation(); }

    d.dragging = true;
    state.dragging = true;

    let icons = document.querySelectorAll('.ContextMenu');
    for (let icon of icons) {
      icon.classList.add('collapsed');
    }
    document.getElementById('Hovered').style.opacity = '0';

    const mx = (se && isFinite(se.x)) ? se.x : ((se && isFinite(se.clientX)) ? se.clientX : 0);
    const my = (se && isFinite(se.y)) ? se.y : ((se && isFinite(se.clientY)) ? se.clientY : 0);

    let mouse = wuwei.util.pContext({ x: mx, y: my });
    let link = findLinkById(d.id) || d;

    if (!link || !getLinkPath(link)) { return; }

    let sP = startPoint(link), eP = endPoint(link);

    d._dragEnd = null;
    if (Math.abs(mouse.x - sP.x) + Math.abs(mouse.y - sP.y) < 8) {
      d._dragEnd = 'start';
      console.log(`mouse[${mouse.x.toFixed(1)},${mouse.y.toFixed(1)}] START[${sP.x.toFixed(1)},${sP.y.toFixed(1)}]`);
    }
    else if (Math.abs(mouse.x - eP.x) + Math.abs(mouse.y - eP.y) < 8) {
      d._dragEnd = 'end';
      console.log(`mouse[${mouse.x.toFixed(1)},${mouse.y.toFixed(1)}] END[${eP.x.toFixed(1)},${eP.y.toFixed(1)}]`);
    }
    else if (['HORIZONTAL2', 'VERTICAL2'].includes(link.shape) &&
      link._controlPoint &&
      Number.isFinite(Number(link._controlPoint.x)) &&
      Number.isFinite(Number(link._controlPoint.y))) {
      d._dragControlPoint = {
        x: Number(link._controlPoint.x),
        y: Number(link._controlPoint.y)
      };
    }
  };

  function updateEndPoint(link, mouse, end) {
    const INC = 4, DIFF = 12;
    const pointer = document.getElementById('Pointer');

    let endNode = getLinkEndNode(link, end);
    if (!endNode) {
      return link;
    }

    let fp = featurePoints(endNode),
      CX = fp.x, CY = fp.y, TY = fp.TY, RX = fp.RX, BY = fp.BY, LX = fp.LX,
      _r, x, y;

    function round(value) {
      let d = Math.round(value / INC),
        v = INC * d;
      d = `${d < 0 ? '-' : ''}${Math.abs(d)}`;
      return { diff: d, value: v };
    }

    let position = getLinkEndPosition(link, end);
    if (position) {
      let m = String(position).match(/^([TRBL])([-+]?\d+)$/);
      position = m ? m[1] : null;
    }

    if (['VERTICAL', 'HORIZONTAL', 'VERTICAL2', 'HORIZONTAL2'].includes(link.shape)) {
      if ('L' === position) {
        if (Math.abs(mouse.x - LX) < DIFF && TY < mouse.y && mouse.y < BY) {
          _r = round(mouse.y - CY); x = LX; y = CY + _r.value; setLinkEndPosition(link, end, `L${_r.diff}`);
        }
      }
      else if ('R' === position) {
        if (Math.abs(mouse.x - RX) < DIFF && TY < mouse.y && mouse.y < BY) {
          _r = round(mouse.y - CY); x = RX; y = CY + _r.value; setLinkEndPosition(link, end, `R${_r.diff}`);
        }
      }
      else if ('T' === position) {
        if (Math.abs(mouse.y - TY) < DIFF && LX < mouse.x && mouse.x < RX) {
          _r = round(mouse.x - CX); x = CX + _r.value; y = TY; setLinkEndPosition(link, end, `T${_r.diff}`);
        }
      }
      else if ('B' === position) {
        if (Math.abs(mouse.y - BY) < DIFF && LX < mouse.x && mouse.x < RX) {
          _r = round(mouse.x - CX); x = CX + _r.value; y = BY; setLinkEndPosition(link, end, `B${_r.diff}`);
        }
      }
      else {
        if (Math.abs(mouse.x - LX) < DIFF && TY < mouse.y && mouse.y < BY) {
          _r = round(mouse.y - CY); x = LX; y = CY + _r.value; setLinkEndPosition(link, end, `L${_r.diff}`);
        }
        else if (Math.abs(mouse.x - RX) < DIFF && TY < mouse.y && mouse.y < BY) {
          _r = round(mouse.y - CY); x = RX; y = CY + _r.value; setLinkEndPosition(link, end, `R${_r.diff}`);
        }
        else if (Math.abs(mouse.y - TY) < DIFF && LX < mouse.x && mouse.x < RX) {
          _r = round(mouse.x - CX); x = CX + _r.value; y = TY; setLinkEndPosition(link, end, `T${_r.diff}`);
        }
        else if (Math.abs(mouse.y - BY) < DIFF && LX < mouse.x && mouse.x < RX) {
          _r = round(mouse.x - CX); x = CX + _r.value; y = BY; setLinkEndPosition(link, end, `B${_r.diff}`);
        }
      }
    }

    if (isFinite(x) && isFinite(y)) {
      pointer.setAttribute('cx', `${x}`);
      pointer.setAttribute('cy', `${y}`);
      pointer.style.opacity = '1';
    }
    return link;
  }

  Link.prototype.dragged = function (d) {
    if ('view' === graph.mode) { return; }

    const se = (d3.event && d3.event.sourceEvent) ? d3.event.sourceEvent : d3.event;
    if (se && se.stopImmediatePropagation) { se.stopImmediatePropagation(); }
    if (!state.dragging) { d.dragging = false; return; }

    const mx = (se && isFinite(se.x)) ? se.x : se.clientX;
    const my = (se && isFinite(se.y)) ? se.y : se.clientY;

    const mouse = wuwei.util.pContext({ x: mx, y: my }),
      hit = (d._dragControlPoint &&
        Number.isFinite(Number(d._dragControlPoint.x)) &&
        Number.isFinite(Number(d._dragControlPoint.y)))
        ? d._dragControlPoint
        : null,
      selected = document.getElementById('Selected'),
      pointer = document.getElementById('Pointer');

    let end = null;
    let DIFF = 8;
    let link = findLinkById(d.id);

    if ('draw' !== graph.mode || !link) {
      return;
    }

    let path = getLinkPath(link);
    let sP = startPoint(link), eP = endPoint(link);

    if (Math.abs(mouse.x - sP.x) + Math.abs(mouse.y - sP.y) < DIFF) {
      end = 'start';
      link = updateEndPoint(link, mouse, end);
    }
    else if (Math.abs(mouse.x - eP.x) + Math.abs(mouse.y - eP.y) < DIFF) {
      end = 'end';
      link = updateEndPoint(link, mouse, end);
    }

    if (end && getLinkEndPosition(link, end)) {
      pointer.style.opacity = '1';
      selected.style.opacity = '0';
    }
    else {
      pointer.style.opacity = '0';
      selected.style.opacity = '1';
    }

    let match,
      match1h, match2h, match3h, match4h,
      match1v, match2v, match3v, match4v,
      matchH1, matchH2, matchH3, matchH4, matchH5, matchH6, matchH7, matchH8, matchH9,
      matchV1, matchV2, matchV3, matchV4, matchV5, matchV6, matchV7, matchV8, matchV9,
      move = {},
      X1, X2, Y1, Y2,
      P2, P3, P4, P5;

    DIFF = 36;
    d3.select('#ContextMenu').attr('transform', `translate(${mouse.x},${mouse.y})`);
    const control = ['HORIZONTAL2', 'VERTICAL2'].includes(link.shape) ? (hit || mouse) : mouse;

    if ('HORIZONTAL' === link.shape) {
      if (path) {
        match1h = path.trim().match(rgx1h);
        match2h = path.trim().match(rgx2h);
        match3h = path.trim().match(rgx3h);
        match4h = path.trim().match(rgx4h);
      }
      if (match1h) {
        match = match1h; X1 = +match[5]; Y1 = +match[6]; X2 = +match[10]; Y2 = +match[11];
      }
      else if (match2h) {
        match = match2h; X1 = +match[5]; Y1 = +match[6]; X2 = +match[5]; Y2 = +match[9];
      }
      else if (match3h) {
        match = match3h; X1 = +match[1]; Y1 = +match[2]; X2 = +match[4]; Y2 = +match[5];
      }
      else if (match4h) {
        match = match4h; X1 = +match[1]; Y1 = +match[2]; X2 = +match[1]; Y2 = +match[3];
      }
      if (isFinite(X1) && isFinite(X2) && isFinite(Y1) && isFinite(Y2)) {
        if (Math.abs(control.x - X1) < DIFF) {
          move.x = mouse.x - link.x;
        }
      }
      if (!isFinite(move.x) && Math.abs(control.x - link.x) < DIFF) {
        move.x = mouse.x - link.x;
      }
    }
    else if ('VERTICAL' === link.shape) {
      if (path) {
        match1v = path.trim().match(rgx1v);
        match2v = path.trim().match(rgx2v);
        match3v = path.trim().match(rgx3v);
        match4v = path.trim().match(rgx4v);
      }
      if (match1v) {
        match = match1v; X1 = +match[5]; Y1 = +match[6]; X2 = +match[10]; Y2 = +match[11];
      }
      else if (match2v) {
        match = match2v; X1 = +match[5]; Y1 = +match[6]; X2 = +match[9]; Y2 = +match[8];
      }
      else if (match3v) {
        match = match3v; X1 = +match[1]; Y1 = +match[2]; X2 = +match[4]; Y2 = +match[5];
      }
      else if (match4v) {
        match = match4v; X1 = +match[1]; Y1 = +match[2]; X2 = +match[3]; Y2 = +match[2];
      }
      if (isFinite(X1) && isFinite(X2) && isFinite(Y1) && isFinite(Y2)) {
        if (Math.abs(control.y - Y1) < 16) {
          move.y = mouse.y - link.y;
        }
      }
      if (!isFinite(move.y) && Math.abs(control.y - link.y) < DIFF) {
        move.y = mouse.y - link.y;
      }
    }
    else if ('HORIZONTAL2' === link.shape) {
      if (path) {
        matchH1 = path.trim().match(rgxH1);
        matchH2 = path.trim().match(rgxH2);
        matchH3 = path.trim().match(rgxH3);
        matchH4 = path.trim().match(rgxH4);
        matchH5 = path.trim().match(rgxH5);
        matchH6 = path.trim().match(rgxH6);
        matchH7 = path.trim().match(rgxH7);
        matchH8 = path.trim().match(rgxH8);
        matchH9 = path.trim().match(rgxH9);
      }
      if (matchH1) {
        match = matchH1; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[7], y: +match[8] }; P4 = { x: +match[12], y: +match[13] }; P5 = { x: +match[18], y: +match[19] };
      }
      else if (matchH2) {
        match = matchH2; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[7], y: +match[8] }; P4 = { x: +match[12], y: +match[13] }; P5 = { x: +match[16], y: +match[17] };
      }
      else if (matchH3) {
        match = matchH3; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[7], y: +match[8] }; P4 = { x: +match[7], y: +match[11] };
      }
      else if (matchH4) {
        match = matchH4; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[5], y: +match[6] }; P4 = { x: +match[10], y: +match[11] }; P5 = { x: +match[16], y: +match[17] };
      }
      else if (matchH5) {
        match = matchH5; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[5], y: +match[6] }; P4 = { x: +match[10], y: +match[11] }; P5 = { x: +match[14], y: +match[15] };
      }
      else if (matchH6) {
        match = matchH6; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[5], y: +match[6] }; P4 = { x: +match[5], y: +match[9] };
      }
      else if (matchH7) {
        match = matchH7; P3 = { x: +match[1], y: +match[2] }; P4 = { x: +match[4], y: +match[5] }; P5 = { x: +match[10], y: +match[11] };
      }
      else if (matchH8) {
        match = matchH8; P3 = { x: +match[1], y: +match[2] }; P4 = { x: +match[4], y: +match[5] }; P5 = { x: +match[8], y: +match[9] };
      }
      else if (matchH9) {
        match = matchH9; P3 = { x: +match[1], y: +match[2] }; P4 = { x: +match[1], y: +match[3] };
      }

      if (!P3 || !P4) {
        P3 = {
          x: Number(link.x),
          y: Number(link.y)
        };
        P4 = {
          x: Number(link.x),
          y: Number.isFinite(Number(link.y2)) ? Number(link.y2) : Number(link.y)
        };
      }
      X1 = P3.x; Y1 = P3.y; X2 = P4.x; Y2 = P4.y;

      if (Math.abs(X1 - control.x) < 16 &&
        ((Y2 < control.y && control.y < Y1) || (Y1 < control.y && control.y < Y2))) {
        move.x = mouse.x - X1;
      }
      else if (P2 && Math.abs(Y1 - control.y) < 16 &&
        ((P2.x < control.x && control.x < X1) || (X1 < control.x && control.x < P2.x))) {
        move.y = mouse.y - Y1;
      }
      else if (P5 && Math.abs(Y2 - control.y) < 16 &&
        ((X2 < control.x && control.x < P5.x) || (P5.x < control.x && control.x < X2))) {
        move.y2 = mouse.y - Y2;
      }
      if (!isFinite(move.x) && !isFinite(move.y) && !isFinite(move.y2)) {
        if (Number.isFinite(X1) && Math.abs(control.x - X1) < DIFF) {
          move.x = mouse.x - X1;
        }
        else if (Number.isFinite(Y1) && Math.abs(control.y - Y1) < DIFF) {
          move.y = mouse.y - Y1;
        }
        else if (Number.isFinite(Y2) && Math.abs(control.y - Y2) < DIFF) {
          move.y2 = mouse.y - Y2;
        }
      }
    }
    else if ('VERTICAL2' === link.shape) {
      if (path) {
        matchV1 = path.trim().match(rgxV1);
        matchV2 = path.trim().match(rgxV2);
        matchV3 = path.trim().match(rgxV3);
        matchV4 = path.trim().match(rgxV4);
        matchV5 = path.trim().match(rgxV5);
        matchV6 = path.trim().match(rgxV6);
        matchV7 = path.trim().match(rgxV7);
        matchV8 = path.trim().match(rgxV8);
        matchV9 = path.trim().match(rgxV9);
      }
      if (matchV1) {
        match = matchV1; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[7], y: +match[8] }; P4 = { x: +match[12], y: +match[13] }; P5 = { x: +match[18], y: +match[19] };
      }
      else if (matchV2) {
        match = matchV2; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[7], y: +match[8] }; P4 = { x: +match[12], y: +match[13] }; P5 = { x: +match[16], y: +match[17] };
      }
      else if (matchV3) {
        match = matchV3; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[7], y: +match[8] }; P4 = { x: +match[11], y: +match[8] };
      }
      else if (matchV4) {
        match = matchV4; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[5], y: +match[6] }; P4 = { x: +match[10], y: +match[11] }; P5 = { x: +match[16], y: +match[17] };
      }
      else if (matchV5) {
        match = matchV5; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[5], y: +match[6] }; P4 = { x: +match[10], y: +match[11] }; P5 = { x: +match[14], y: +match[15] };
      }
      else if (matchV6) {
        match = matchV6; P2 = { x: +match[1], y: +match[2] }; P3 = { x: +match[5], y: +match[6] }; P4 = { x: +match[9], y: +match[6] };
      }
      else if (matchV7) {
        match = matchV7; P3 = { x: +match[1], y: +match[2] }; P4 = { x: +match[4], y: +match[5] }; P5 = { x: +match[10], y: +match[11] };
      }
      else if (matchV8) {
        match = matchV8; P3 = { x: +match[1], y: +match[2] }; P4 = { x: +match[4], y: +match[5] }; P5 = { x: +match[8], y: +match[9] };
      }
      else if (matchV9) {
        match = matchV9; P3 = { x: +match[1], y: +match[2] }; P4 = { x: +match[3], y: +match[2] };
      }

      if (!P3 || !P4) {
        P3 = {
          x: Number(link.x),
          y: Number(link.y)
        };
        P4 = {
          x: Number.isFinite(Number(link.x2)) ? Number(link.x2) : Number(link.x),
          y: Number(link.y)
        };
      }
      X1 = P3.x; Y1 = P3.y; X2 = P4.x; Y2 = P4.y;

      if (Math.abs(Y1 - control.y) < DIFF &&
        ((X2 < control.x && control.x < X1) || (X1 < control.x && control.x < X2))) {
        move.y = mouse.y - Y1;
      }
      else if (P2 && Math.abs(X1 - control.x) < DIFF &&
        ((P2.y < control.y && control.y < Y1) || (Y1 < control.y && control.y < P2.y))) {
        move.x = mouse.x - X1;
      }
      else if (P5 && Math.abs(X2 - control.x) < DIFF &&
        ((Y2 < control.y && control.y < P5.y) || (P5.y < control.y && control.y < Y2))) {
        move.x2 = mouse.x - X2;
      }
      if (!isFinite(move.x) && !isFinite(move.x2) && !isFinite(move.y)) {
        if (Number.isFinite(Y1) && Math.abs(control.y - Y1) < DIFF) {
          move.y = mouse.y - Y1;
        }
        else if (Number.isFinite(X1) && Math.abs(control.x - X1) < DIFF) {
          move.x = mouse.x - X1;
        }
        else if (Number.isFinite(X2) && Math.abs(control.x - X2) < DIFF) {
          move.x2 = mouse.x - X2;
        }
      }
    }

    if ('NORMAL' === link.shape) {
      link.straight = false;
      link.x = mouse.x;
      link.y = mouse.y;
      link = renderLink(link);
    }
    else if (['HORIZONTAL', 'VERTICAL'].includes(link.shape)) {
      if (move && (isFinite(move.x) || isFinite(move.y))) {
        link = hierarchyLink(link, move);
      }
      else if (end && getLinkEndPosition(link, end)) {
        link = hierarchyLink(link, null);
      }
      else {
        menu.closeContextMenu();
        state.dragging = false;
        d.dragging = false;
      }
    }
    else if (['HORIZONTAL2', 'VERTICAL2'].includes(link.shape)) {
      let startNode = findNodeById(link.from),
        endNodeNode = findNodeById(link.to),
        startPos = getLinkEndPosition(link, 'start'),
        endPos = getLinkEndPosition(link, 'end'),
        sPos = featurePoints(startNode, startPos),
        tPos = featurePoints(endNodeNode, endPos);

      if (move && (isFinite(move.x) || isFinite(move.x2) || isFinite(move.y) || isFinite(move.y2))) {
        if ('HORIZONTAL2' === link.shape) {
          if (isFinite(move.y)) {
            if ((startPos && ['R', 'L'].includes(startPos[0])) ||
              (sPos.TY < mouse.y && mouse.y < sPos.BY)) {
              setLinkEndPosition(link, 'start', null);
            }
          }
          else if (isFinite(move.y2)) {
            if ((endPos && ['R', 'L'].includes(endPos[0])) ||
              (tPos.TY < mouse.y && mouse.y < tPos.BY)) {
              setLinkEndPosition(link, 'end', null);
            }
          }
        }
        else if ('VERTICAL2' === link.shape) {
          if (isFinite(move.x)) {
            if ((startPos && ['T', 'B'].includes(startPos[0])) ||
              (sPos.LX < mouse.x && mouse.x < sPos.RX)) {
              setLinkEndPosition(link, 'start', null);
            }
          }
          else if (isFinite(move.x2)) {
            if ((endPos && ['T', 'B'].includes(endPos[0])) ||
              (tPos.LX < mouse.x && mouse.x < tPos.RX)) {
              setLinkEndPosition(link, 'end', null);
            }
          }
        }
        link = hierarchyLink2(link, move, { P2: P2, P3: P3, P4: P4, P5: P5 });
      }
      else if (end && getLinkEndPosition(link, end)) {
        link = hierarchyLink2(link, null, { P2: P2, P3: P3, P4: P4, P5: P5 });
      }
      else {
        menu.closeContextMenu();
        state.dragging = false;
        d.dragging = false;
      }
    }

    swapLinkPathMirror(link);

    var editingCircle = document.getElementById('Editing');
    if (editingCircle && editingCircle.dataset.link_id === link.id && '1' === editingCircle.style.opacity) {
      editingCircle.setAttribute('cx', link.x);
      editingCircle.setAttribute('cy', link.y);
    }
  };

  Link.prototype.dragended = function (d) {
    if ('view' === graph.mode) { return; }

    const se = (d3.event && d3.event.sourceEvent) ? d3.event.sourceEvent : d3.event;
    if (se && se.stopImmediatePropagation) { se.stopImmediatePropagation(); }

    state.dragging = false;
    d.dragging = false;
    delete d._dragEnd;
    delete d._dragControlPoint;

    menu.closeContextMenu();
    document.getElementById('Hovered').style.opacity = '1';
    document.getElementById('Pointer').style.opacity = '0';

    util.drawMiniature();
    log.storeLog({ operation: 'drag' });
  };

  LinkFactory = function (param) {
    if (!param || !param.id) {
      return null;
    }
    return new Link(param);
  };

  connect = function (source_node, target_node, rtype) {
    var linkId, link, midX, midY;

    if (!source_node || !target_node) {
      return null;
    }

    linkId = util.createUuid();
    midX = (Number(source_node.x || 0) + Number(target_node.x || 0)) / 2;
    midY = (Number(source_node.y || 0) + Number(target_node.y || 0)) / 2;

    link = createLink({
      id: linkId,
      type: 'Link',
      from: source_node.id,
      to: target_node.id,
      x: midX,
      y: midY,
      shape: 'NORMAL',
      visible: true,
      relation: undefined === rtype ? '' : rtype,
      label: '',
      description: {
        format: 'plain',
        body: ''
      },
      style: makeLinkStyle(),
      routing: {
        path: '',
        endArrow: {
          kind: 'ARROW',
          size: 12
        }
      },
      audit: makeAudit()
    });

    if (!link) {
      return null;
    }

    state.Connecting = false;

    return {
      command: 'connect',
      param: {
        node: [source_node, target_node],
        link: [link]
      }
    };
  };

  createLink = function (param) {
    if (!param) {
      return null;
    }
    var link = LinkFactory(param);
    var page = getCurrentPage();
    if (!link) {
      return null;
    }
    if (page) {
      if (!Array.isArray(page.links)) { page.links = []; }
      util.appendById(page.links, link);
    }
    wuwei.util.appendById(graph.links, link);
    return link;
  };

  removeLink = function (param) {
    var id = param && param.id;
    var page = getCurrentPage();
    if (!id) {
      return;
    }
    if (page && Array.isArray(page.links)) {
      util.removeById(page.links, id);
    }
    util.removeById(graph.links, id);
  };

  updateLink = function (link) {
    var page = getCurrentPage();
    if (page) {
      if (!Array.isArray(page.links)) { page.links = []; }
      util.appendById(page.links, link);
    }
    util.appendById(common.graph.links, link);
  };

  addLink = function (item) {
    let link = item.link;
    link = createLink(link);
    return { link: link };
  }

  showLinks = function (links) {
    for (let link of links) {
      link.visible = true;
      updateLink(link);
    }
  };

  hideLinks = function (links) {
    for (let link of links) {
      link.visible = false;
      updateLink(link);
    }
  };

  findLinkById = function (id) {// lookup link by it's id
    for (let link of graph.links) {
      if (id === link.id) {
        return link;
      }
    }
    return null;
  };

  findLinksByNode = function (node) {
    let links = [],
      visibles = [],
      hiddens = [],
      undefineds = [],
      otherNode;

    if (!node || !node.id) {
      return { links, visibles, hiddens, undefineds };
    }

    for (const link of (graph.links || [])) {
      if (!link || !link.from || !link.to) {
        util.appendById(undefineds, link);
        continue;
      }

      if (link.from !== node.id && link.to !== node.id) {
        continue;
      }

      otherNode = findOtherNode(link, node);
      util.appendById(links, link);

      if (!otherNode) {
        util.appendById(undefineds, link);
        continue;
      }

      if (isLinkShown(link) && isNodeShown(otherNode)) {
        util.appendById(visibles, link);
      }
      else {
        util.appendById(hiddens, link);
      }
    }

    return { links, visibles, hiddens, undefineds };
  };

  findOtherNode = function (link, node) {
    if (!link || !node || !node.id || !link.from || !link.to) {
      return null;
    }

    if (node.id === link.from) {
      return findNodeById(link.to);
    }
    if (node.id === link.to) {
      return findNodeById(link.from);
    }

    return null;
  };

  countHiddenLink = function (node) {
    var allLinks;

    if (!node || !node.id || !isNodeShown(node)) {
      return 0;
    }

    allLinks = findLinksByNode(node);
    return (allLinks && allLinks.hiddens) ? allLinks.hiddens.length : 0;
  };

  const toLoad = (value) => {
    const nodes = (value && value.nodes) ? value.nodes : [];
    const links = (value && value.links) ? value.links : [];
    for (const node of nodes) {
      if (undefined === node.visible) { node.visible = true; }
      addNode({ node: node });
    }
    for (const link of links) {
      if (undefined === link.visible) { link.visible = true; }
      addLink({ link: link });
    }
  };

  const toCreate = (value) => {
    const nodes = (value && value.nodes) ? value.nodes : [];
    const links = (value && value.links) ? value.links : [];
    for (const node of nodes) {
      if (undefined === node.visible && false === node.filterout) {
        node.visible = true;
      }
      addNode({ node: node });
    }
    for (const link of links) {
      if (undefined === link.visible && false === link.filterout) {
        link.visible = true;
      }
      addLink({ link: link });
    }
  };

  const toModify = (value) => {
    const nodes = (value && value.nodes) ? value.nodes : [];
    const links = (value && value.links) ? value.links : [];
    for (const node of nodes) { updateNode(node); }
    for (const link of links) { updateLink(link); }
    draw.refresh();
  };

  const toRemove = (value) => {
    const nodes = (value && value.nodes) ? value.nodes : [];
    const links = (value && value.links) ? value.links : [];
    for (const id of nodes) { removeNode({ id: id }); }
    for (const id of links) { removeLink({ id: id }); }
    draw.refresh();
  };

  /*  const toRefresh = (value) => {
  
    }*/

  // -- Add
  function getSafeContextPoint() {
    var center = util.pContext({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
      center = { x: 0, y: 0 };
    }
    return center;
  }

  newPosition = function (x, y) {
    x = Number(x);
    y = Number(y);
    if (!Number.isFinite(x)) { x = 0; }
    if (!Number.isFinite(y)) { y = 0; }
    var
      r = 80 * (1 + Math.random()),
      theta = 2 * Math.PI * Math.random(),
      newX = x + r * Math.cos(theta),
      newY = y + r * Math.sin(theta);
    if (!Number.isFinite(newX)) { newX = 0; }
    if (!Number.isFinite(newY)) { newY = 0; }
    return { x: newX, y: newY };
  };

  addSimpleContent = function () {
    var
      center = getSafeContextPoint(),
      newP = newPosition(center.x, center.y),
      xP = newP.x,
      yP = newP.y,
      id = util.createUuid(),
      title = translate('New Content'),
      node;

    node = createNode({
      id: id,
      type: 'Content',
      x: xP,
      y: yP,
      shape: 'RECTANGLE',
      label: title,
      description: { format: 'asciidoc', body: '' },
      resource: {
        kind: 'general',
        uri: '',
        canonicalUri: '',
        mimeType: 'text/plain',
        title: title,
        owner: '',
        copyright: '',
        viewer: {
          supportedModes: ['infoPane', 'newTab', 'newWindow', 'download'],
          defaultMode: 'infoPane'
        }
      },
      thumbnailUri: '',
      size: {
        width: defaultSize.content,
        height: defaultSize.content
      },
      style: common.defaultStyle.content,
      visible: true
    });

    const logData = {
      command: 'addSimpleContent',
      param: { node: [node], /*resource: [],*/ link: []/*, association: []*/ }
    };
    return logData;
  };

  addSimpleTopic = function () {
    var
      center = getSafeContextPoint(),
      newP = newPosition(center.x, center.y),
      xP = newP.x,
      yP = newP.y,
      id = util.createUuid(),
      title = translate('New Topic'),
      node;

    node = createNode({
      id: id,
      type: 'Topic',
      x: xP,
      y: yP,
      shape: 'RECTANGLE',
      label: title,
      description: {
        format: 'asciidoc',
        body: ''
      },
      size: {
        width: common.defaultSize.width,
        height: common.defaultSize.height
      },
      style: common.defaultStyle.topic,
      visible: true
    });

    const logData = {
      command: 'addSimpleTopic',
      param: {
        node: [node],
        link: []
      }
    };
    return logData;
  };

  addSimpleMemo = function () {
    var
      center = getSafeContextPoint(),
      newP = newPosition(center.x, center.y),
      xP = newP.x,
      yP = newP.y,
      id = util.createUuid();
    var node;

    node = createNode({
      id: id,
      type: 'Memo',
      x: xP,
      y: yP,
      shape: 'MEMO',
      size: {
        width: defaultSize.memo,
        height: defaultSize.memo
      },
      style: common.defaultStyle.memo,
      description: {
        format: 'asciidoc',
        body: ''
      },
      visible: true
    });

    const logData = {
      command: 'addSimpleMemo',
      param: {
        node: [node],
        link: []
      }
    };
    return logData;
  };

  addContent = function (targets) {
    const target_node = targets[0];
    const created = addSimpleContent().param;
    const source_node = created.node[0];

    const newP = newPosition(source_node.x, source_node.y);
    source_node.x = newP.x;
    source_node.y = newP.y;

    const c = connect(source_node, target_node).param;
    const link = c.link[0];

    return {
      command: 'addContent',
      param: { node: [source_node, target_node], link: [link] }
    };
  };

  addTopic = function (targets) {
    var target_node = targets[0];
    var created = addSimpleTopic().param;
    var source_node = created.node[0];

    var newP = newPosition(source_node.x, source_node.y);
    source_node.x = newP.x;
    source_node.y = newP.y;

    var c = connect(source_node, target_node).param;
    var link = c.link[0];

    return {
      command: 'addTopic',
      param: { node: [source_node, target_node], link: [link] }
    };
  };

  addMemo = function (targets) {
    var target_node = targets[0];
    var created = addSimpleMemo().param;
    var source_node = created.node[0];

    var newP = newPosition(source_node.x, source_node.y);
    source_node.x = newP.x;
    source_node.y = newP.y;

    var c = connect(source_node, target_node).param;
    var link = c.link[0];

    return {
      command: 'addMemo',
      param: { node: [source_node, target_node], link: [link] }
    };
  };

  // --- environment helper ---------------------------------------------
  function getRuntimeEnv() {
    const origin = (window.location.origin || '').toLowerCase();

    // 例:
    // local  http://localhost, http://127.0.0.1, http://192.168.x.x
    // ec2    https://www.sambuichi.jp など
    const isLocal =
      /^https?:\/\/localhost(?::\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin) ||
      /^https?:\/\/192\.168\.\d+\.\d+(?::\d+)?$/.test(origin);

    return {
      origin: origin,
      isLocal: isLocal,
      isEc2: !isLocal
    };
  }

  function getCgiPath(name) {
    const env = getRuntimeEnv();

    if (env.isLocal) {
      // 例: http://localhost/nocgi-bin/upload.py
      return `${window.location.origin}/nocgi-bin/${name}.py`;
    }

    // 例: https://www.sambuichi.jp/wu_wei2/server/upload.cgi
    return `${window.location.origin}/wu_wei2/server/${name}.cgi`;
  }

  function isHostedVideoUrl(uri) {
    var host = '';
    var lower = String(uri || '').trim().toLowerCase();
    if (!lower) {
      return false;
    }
    try {
      host = new URL(lower, window.location.href).hostname.toLowerCase();
    }
    catch (e) {
      host = '';
    }
    return host === 'youtu.be' ||
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'vimeo.com' ||
      host === 'www.vimeo.com' ||
      host === 'player.vimeo.com' ||
      /^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)(\/|$|\?)/.test(lower);
  }

  addUploadedContent = function (response) {
    const
      center = getSafeContextPoint(),
      newP = newPosition(center.x, center.y),
      xP = newP.x,
      yP = newP.y,
      id = util.createUuid(),
      content_id = 'webpage' === response.option
        ? response.id
        : util.isUUIDid(response.id)
          ? response.id
          : util.isUUID(response.id)
            ? `_${response.id}`
            : response.id,
      uri = response.uri,
      format = response.format || response.contenttype,
      resourceDef = response.resource || null,
      value = response.value || {},
      file = value.file || '';

    const lcFormat = (format || '').toLowerCase();
    const lcUri = (uri || '').toLowerCase();
    const duration = (value && null != value.duration) ? parseFloat(value.duration) : NaN;

    const isVideo =
      (lcFormat && 0 === lcFormat.indexOf('video/')) ||
      isHostedVideoUrl(uri || response.url || '') ||
      /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(lcUri);

    const videoMedia = isVideo
      ? { start: 0, end: (Number.isFinite(duration) ? duration : null) }
      : null;

    let
      thumbnail = value.thumbnail ? value.thumbnail.uri : null,
      thumbnail_size = value.thumbnail ? value.thumbnail.size : null,
      color;

    const isTextPlain = 'text/plain' === lcFormat;
    const isOffice = util.isOfficeDocument ? util.isOfficeDocument(format) : false;
    const isLocal = util.isLocalHost ? util.isLocalHost() : false;

    let nodeUrl = response.url || '';
    let downloadUrl = response.download_url || response.url || '';

    const resourceViewer = resourceDef && resourceDef.viewer ? resourceDef.viewer : {};
    const resourceEmbed = resourceViewer && resourceViewer.embed ? resourceViewer.embed : {};
    const resourceSnapshots = resourceDef && resourceDef.snapshotSources ? resourceDef.snapshotSources : {};
    const resourceIdentity = resourceDef && resourceDef.identity ? resourceDef.identity : {};

    function isIconThumbnail(value) {
      return /^fa-/.test(String(value || ''));
    }

    function resolveUploadedThumbnail() {
      const candidates = [
        resourceDef && util.getResourceFileUri ? util.getResourceFileUri(resourceDef, 'thumbnail') : '',
        value.thumbnail && value.thumbnail.uri,
        resourceViewer.thumbnailUri,
        resourceEmbed.thumbnailUri,
        resourceSnapshots.thumbnailUri
      ];

      for (let i = 0; i < candidates.length; i++) {
        const candidate = String(candidates[i] || '').trim();
        if (candidate && !isIconThumbnail(candidate)) {
          return candidate;
        }
      }
      return '';
    }

    thumbnail = resolveUploadedThumbnail() || thumbnail;

    if (isOffice || isTextPlain) {
      if (isOffice) {
        if (!thumbnail) {
          thumbnail = util.getOfficeIcon ? util.getOfficeIcon(format) : 'fa-file';
        }
      } else if (isTextPlain) {
        if (!thumbnail) {
          thumbnail = 'fa-file-alt';
        }
      }

      if (!thumbnail_size) {
        const guessed = (file || '')
          .split(',')
          .filter(function (f) {
            return f.match(/[0-9]* x [0-9]*/);
          });

        if (guessed && guessed.length > 0) {
          thumbnail_size = guessed[0].trim();
        } else {
          thumbnail_size = isIconThumbnail(thumbnail) ? '40x60' : '77x100';
        }
      }

      if (thumbnail && isIconThumbnail(thumbnail)) {
        color = '#505050';
      }
    }

    if (isOffice) {
      if (isLocal) {
        nodeUrl =
          response.preview_url ||
          (value.pdf && value.pdf.url) ||
          response.url ||
          '';
        downloadUrl = response.download_url || response.url || '';
      } else if (response.url) {
        nodeUrl =
          'https://view.officeapps.live.com/op/view.aspx?src=' +
          encodeURIComponent(response.url);
        downloadUrl = response.download_url || response.url;
      }
    } else {
      nodeUrl = response.url || response.uri || '';
      downloadUrl = response.download_url || response.url || response.uri || '';
    }

    let
      node,
      shape,
      label = response.label || response.name;

    if (!label) {
      label = uri.split('/').pop();
    }

    const runtimeResourceUri = resourceIdentity.uri || resourceEmbed.uri || resourceSnapshots.previewUri || nodeUrl || uri || resourceIdentity.canonicalUri || resourceSnapshots.originalUri || '';
    const snapshotThumbnailUri = thumbnail && !isIconThumbnail(thumbnail) ? thumbnail : '';
    const runtimeResource = resourceDef ? Object.assign({}, resourceDef, {
      id: resourceDef.id || content_id,
      kind: (resourceDef.media && resourceDef.media.kind) || resourceDef.kind || 'general',
      uri: runtimeResourceUri,
      canonicalUri: resourceIdentity.canonicalUri || resourceDef.canonicalUri || runtimeResourceUri,
      mimeType: (resourceDef.media && resourceDef.media.mimeType) || resourceDef.mimeType || format || 'text/plain',
      title: resourceIdentity.title || resourceDef.title || label || '',
      owner: (resourceDef.rights && resourceDef.rights.owner) || resourceDef.owner || '',
      copyright: (resourceDef.rights && resourceDef.rights.copyright) || resourceDef.copyright || '',
      snapshotSources: Object.assign({}, resourceSnapshots, {
        originalUri: resourceIdentity.canonicalUri || resourceSnapshots.originalUri || downloadUrl || '',
        previewUri: resourceEmbed.uri || resourceIdentity.uri || resourceSnapshots.previewUri || nodeUrl || uri || '',
        thumbnailUri: snapshotThumbnailUri || resourceSnapshots.thumbnailUri || ''
      }),
      viewer: resourceViewer
    }) : null;

    let iw, ih, w, h;
    w = defaultSize.content;
    h = defaultSize.content;

    if (thumbnail && thumbnail_size) {
      const wh = thumbnail_size.split('x');
      if (wh.length === 2) {
        iw = +wh[0];
        ih = +wh[1];
        if (iw > ih && iw > defaultSize.content) {
          w = defaultSize.content;
          h = ih * defaultSize.content / iw;
        } else if (ih > iw && ih > defaultSize.content) {
          h = defaultSize.content;
          w = iw * defaultSize.content / ih;
        } else {
          w = iw;
          h = ih;
        }
      }
    }

    shape = thumbnail ? 'THUMBNAIL' : 'RECTANGLE';

    node = createNode({
      id: id,
      type: 'Content',
      x: xP,
      y: yP,
      shape: shape,
      label: label,
      description: {
        format: 'asciidoc',
        body: ''
      },
      resourceRef: (resourceDef && resourceDef.id) || content_id,
      resource: runtimeResource || {
        kind: isVideo ? 'video' : (isOffice ? 'office' : (isTextPlain ? 'document' : ('webpage' === response.option ? 'webpage' : 'general'))),
        uri: nodeUrl || uri || '',
        canonicalUri: downloadUrl || nodeUrl || uri || '',
        mimeType: format || 'text/plain',
        title: label,
        owner: '',
        copyright: '',
        snapshotSources: {
          originalUri: downloadUrl || '',
          previewUri: nodeUrl || uri || '',
          thumbnailUri: snapshotThumbnailUri || ''
        },
        viewer: {
          supportedModes: ['infoPane', 'newTab', 'newWindow', 'download'],
          defaultMode: 'infoPane'
        }
      },
      thumbnailUri: thumbnail || '',
      timeRange: videoMedia,
      size: {
        width: w,
        height: h
      },
      style: makeNodeStyle('undefined' === typeof color ? Color.contentFill : color),
      visible: true
    });
    if (!videoMedia) {
      delete node.timeRange;
    }

    return {
      command: 'addSimpleContent',
      param: {
        node: [node],
        link: []
      }
    };
  };

  setMultipleLine = function (item) {
    var
      t = item.text, // svg text
      WIDTH = item.width,
      HEIGHT = item.height,
      verticalAlign = item.verticalAlign || 'top',
      OFFSET_X = item.offsetx || 0,
      OFFSET_Y = item.offsety || 0,
      SPACING = 2,
      tArray,
      content,
      bbox, // x0, y0,
      lineHeight,
      lines, words, word,
      tempText, tempWidth, tempHeight,
      i, li, j, lj, idx, lineLength, ltr,
      line = '',
      isLineSinglebype;

    function lineTspanY(lineI, lineCount) {
      var y;
      switch (verticalAlign) {
        case 'center':
          y = OFFSET_Y + (lineI - (lineCount - 1) / 2) * lineHeight;
          break;
        case 'top':
          y = OFFSET_Y + lineI * lineHeight;
          break;
        case 'bottom':
          y = OFFSET_Y - ((lineCount - 1) - lineI) * lineHeight;
          break;
      }
      return y ? y + 'px' : 0;
    }

    function lineTspanAttrs() {
      switch (verticalAlign) {
        case 'center':
          return '.35em';
        case 'top':
          return '1em';
        case 'bottom':
          return 0;
      }
    }

    // Check if character is single byte
    // @param c result of s.charCodeAt(i)
    //
    function isSingleByte(c) {
      // count character bytes according to following sites.
      // http://www.tagindex.com/kakolog/q4bbs/1001/1270.html
      // http://www.geocities.jp/scs00046/pages/2006112701.html
      var result;
      result =
        (c >= 0x0 && c < 0x81) ||
        (c === 0xf8f0) ||
        (c >= 0xff61 && c < 0xffa0) ||
        (c >= 0xf8f1 && c < 0xf8f4);
      return !!result;
    }

    content = (t && t.node() && t.text()) ? t.text().trim() : '';
    if (!content) { return; }

    bbox = t.node().getBBox();
    lineHeight = bbox.height + SPACING;
    lines = content.split(/\n/);
    tempHeight = lineHeight;
    tempText = '';
    tArray = [];

    LOOP: for (i = 0, li = lines.length; i < li; i++) {
      if (i > 0) {
        tArray.push(tempText);
        tempText = '';
      }
      line = lines[i];
      lineLength = line.length;
      if (0 === lineLength) {
        tempHeight += lineHeight;
        if (tempHeight > HEIGHT - lineHeight) {
          break LOOP;
        }
        tempText = '';
      }
      else {
        isLineSinglebype = true;
        for (idx = 0; idx < lineLength; idx++) {
          isLineSinglebype = isLineSinglebype && isSingleByte(line.charCodeAt(idx));
        }
        if (isLineSinglebype) {
          words = line.split(' ');
          for (j = 0, lj = words.length; j < lj; j++) {
            word = words[j];
            t.text(`${tempText} ${word}`);
            tempWidth = t.node().getBBox().width;
            if (tempWidth > WIDTH) {
              tArray.push(tempText);
              tempText = '';
              t.text(word);
              tempHeight += lineHeight;
              if (tempHeight > HEIGHT - lineHeight) {
                tArray[tArray.length - 1] += '...';
                break LOOP;
              }
              else {
                tempText = word;
              }
            }
            else {
              tempText += ` ${word}`;
            }
          }
        }
        else {
          for (idx = 0; idx < lineLength; idx++) {
            ltr = line.charAt(idx);
            t.text(tempText + ltr);
            tempWidth = t.node().getBBox().width;
            if (tempWidth > WIDTH) {
              tArray.push(tempText);
              tempText = '';
              t.text(ltr);
              tempHeight += lineHeight;
              if (tempHeight > HEIGHT - lineHeight) {
                tArray[tArray.length - 1] += '...';
                break LOOP;
              }
              else {
                tempText = ltr;
              }
            }
            else {
              tempText += ltr;
            }
          }
        }
      }
    }
    t.text('');

    if (tempText) {
      tArray.push(tempText.trim());
    }

    t.empty();
    var lineCount = tArray.length;
    for (var lineI = 0; lineI < lineCount; lineI++) {
      line = tArray[lineI];
      t.append('tspan')
        .attr('x', OFFSET_X)
        .attr('y', lineTspanY(lineI, lineCount))
        .attr('dy', lineTspanAttrs())
        .text(line);
    }
  };

  function getTopLabelAnchor(shape, width, height, radius, text_anchor, gap) {
    var x, bottomY;

    if ('CIRCLE' === shape) {
      if ('start' === text_anchor) {
        x = -radius;
      }
      else if ('end' === text_anchor) {
        x = radius;
      }
      else {
        x = 0;
      }
      // 折り返し文字列全体の下端を合わせる基準位置
      bottomY = -radius - gap;
    }
    else {
      if ('start' === text_anchor) {
        x = -width / 2;
      }
      else if ('end' === text_anchor) {
        x = width / 2;
      }
      else {
        x = 0;
      }
      // 折り返し文字列全体の下端を合わせる基準位置
      bottomY = -height / 2 - gap;
    }

    return {
      x: x,
      bottomY: bottomY
    };
  }

  function renderWrappedTopLabel(d3node, node, label, options) {
    var shape = node.shape;
    var size = node.size || {};
    var width = (size && size.width) || defaultSize.width;
    var height = (size && size.height) || defaultSize.height;
    var radius = (size && size.radius) || defaultSize.radius;
    var font = node.font || {};
    var font_family = (font && font.family) || 'Arial';
    var font_size = (font && font.size) || '10pt';
    var font_color = (font && font.color) || '#303030';
    var text_anchor = font['text-anchor'] || 'middle';
    var alignment_baseline = font['alignment-baseline'] || 'baseline';

    var labelGap = (options && options.labelGap != null) ? options.labelGap : 10;
    var lineHeight = (options && options.lineHeight != null) ? options.lineHeight : 20;
    var maxWidthFactor = (options && options.maxWidthFactor != null) ? options.maxWidthFactor : 3;

    var anchor = getTopLabelAnchor(shape, width, height, radius, text_anchor, labelGap);
    var baseFigureWidth;
    var wrapWidth;
    var gText;
    var tspans;
    var bbox;
    var dy;
    var i;
    var originalText;

    // 基準図形幅
    if ('CIRCLE' === shape) {
      baseFigureWidth = 2 * radius;
    }
    else {
      baseFigureWidth = width;
    }

    // ラベル幅は基準図形の3倍以内
    wrapWidth = Math.max(1, baseFigureWidth * maxWidthFactor);

    gText = d3node.append('text')
      .attr('class', 'node-label')
      .attr('x', anchor.x)
      .attr('y', 0)
      .attr('font-family', font_family)
      .attr('font-size', font_size)
      .attr('fill', font_color)
      .attr('text-anchor', text_anchor)
      .attr('alignment-baseline', alignment_baseline)
      .text(label);

    setMultipleLine({
      text: gText,
      width: wrapWidth,
      height: 9999,
      offsetx: 0,
      offsety: 0
    });

    tspans = gText.selectAll('tspan').nodes();

    // setMultipleLine が1行時に tspan を作らない場合に備える
    if (!tspans.length) {
      originalText = gText.text();
      gText.text(null);
      gText.append('tspan').text(originalText);
      tspans = gText.selectAll('tspan').nodes();
    }

    for (i = 0; i < tspans.length; i++) {
      tspans[i].setAttribute('x', anchor.x + 'px');
      tspans[i].setAttribute('y', (i * lineHeight) + 'px');
    }

    // 折り返し文字列全体の下端を、図形上端から一定間隔の位置に合わせる
    bbox = gText.node().getBBox();
    dy = anchor.bottomY - (bbox.y + bbox.height);
    gText.attr('transform', 'translate(0,' + dy + ')');
  }

  function toggleSelectedNodeElement(nodeData) {
    var d3node = d3.select('g.node#' + nodeData.id);
    var selectedCircle = d3node.select('circle.selected');

    if (!selectedCircle.empty()) {
      d3node.classed('selected', false);
      selectedCircle.remove();
    }
    else {
      d3node
        .classed('selected', true)
        .append('circle')
        .attr('class', 'selected')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 32)
        .attr('fill', 'none')
        .attr('stroke', common.Color.outerSelected)
        .attr('stroke-width', 2)
        .datum(nodeData);
    }
  }

  function isSimpleGroupPseudoNode(node) {
    return !!(node &&
      true === node.pseudo &&
      'Group' === node.type &&
      'simple' === node.groupType &&
      node.groupRef);
  }

  function isTopicGroupPseudoLink(link) {
    return !!(link &&
      true === link.pseudo &&
      ('horizontal' === link.groupType || 'vertical' === link.groupType) &&
      link.groupRef);
  }

  function isTimelineGroupPseudoLink(link) {
    return !!(link &&
      true === link.pseudo &&
      'timelineAxis' === link.groupType &&
      link.groupRef);
  }


  function buildGroupDragOrigin(group) {
    var snapshot = {
      members: {},
      origin: null,
      axisAnchor: null
    };

    if (!group) {
      return snapshot;
    }

    (group.members || []).forEach(function (member) {
      var nodeId = (member && member.nodeId) ? member.nodeId : member;
      var node = findNodeById(nodeId);
      if (!node) {
        return;
      }
      snapshot.members[nodeId] = {
        x: finiteOr(node.x, 0),
        y: finiteOr(node.y, 0)
      };
    });

    if (group.origin) {
      snapshot.origin = {
        x: finiteOr(group.origin.x, 0),
        y: finiteOr(group.origin.y, 0)
      };
    }

    if (group.axis && group.axis.anchor) {
      snapshot.axisAnchor = {
        x: finiteOr(group.axis.anchor.x, 0),
        y: finiteOr(group.axis.anchor.y, 0)
      };
    }

    return snapshot;
  }


  function applyGroupTranslate(group, origin, dx, dy) {
    Object.keys((origin && origin.members) || {}).forEach(function (nodeId) {
      var node = findNodeById(nodeId);
      var base = origin.members[nodeId];
      if (!node || !base) {
        return;
      }

      node.x = finiteOr(base.x, 0) + dx;
      node.y = finiteOr(base.y, 0) + dy;
      node.fx = null;
      node.fy = null;
      node.vx = 0;
      node.vy = 0;
      node.changed = true;
    });

    if (origin && origin.origin) {
      group.origin = group.origin || {};
      group.origin.x = finiteOr(origin.origin.x, 0) + dx;
      group.origin.y = finiteOr(origin.origin.y, 0) + dy;
    }

    if (origin && origin.axisAnchor) {
      group.axis = group.axis || {};
      group.axis.anchor = group.axis.anchor || {};
      group.axis.anchor.x = finiteOr(origin.axisAnchor.x, 0) + dx;
      group.axis.anchor.y = finiteOr(origin.axisAnchor.y, 0) + dy;
    }
  }

  /**
   * getGroupDragContextPoint
   *
   * group drag 用のポインタ位置を context 座標で返す。
   */
  function getGroupDragContextPoint() {
    var se, src, sx, sy, p;

    // 元イベントを取得
    se = (d3.event && d3.event.sourceEvent) ? d3.event.sourceEvent : d3.event;
    src = se;

    // touch は先頭 touch / changedTouch を使う
    if (src && src.changedTouches && src.changedTouches.length > 0) {
      src = src.changedTouches[0];
    }
    else if (src && src.touches && src.touches.length > 0) {
      src = src.touches[0];
    }

    sx = (src && Number.isFinite(Number(src.clientX)))
      ? Number(src.clientX)
      : ((src && Number.isFinite(Number(src.x))) ? Number(src.x) : 0);

    sy = (src && Number.isFinite(Number(src.clientY)))
      ? Number(src.clientY)
      : ((src && Number.isFinite(Number(src.y))) ? Number(src.y) : 0);

    // 画面座標 → canvas/context 座標へ変換
    p = util.pContext({ x: sx, y: sy });

    return (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
      ? { x: Number(p.x), y: Number(p.y) }
      : { x: 0, y: 0 };
  }

  function groupDragStarted(group) {
    var page = common.current ? common.current.page : null;
    var point;

    if (!group) {
      return;
    }

    point = getGroupDragContextPoint();

    state.groupDragGroupId = group.id;
    state.groupDragAnchor = {
      x: finiteOr(point.x, 0),
      y: finiteOr(point.y, 0)
    };
    state.groupDragOrigin = buildGroupDragOrigin(group);
    state.dragging = true;
    state.hoverLockUntil = Date.now() + 250;

    if (menu && typeof menu.closeContextMenu === 'function') {
      menu.closeContextMenu();
    }
  }


  function groupDragEnded(group) {
    var isAxisGroup = !!(group && group.type === 'timeline');

    state.groupDragGroupId = null;
    state.groupDragAnchor = null;
    state.groupDragOrigin = null;
    state.dragging = false;
    state.hoverLockUntil = Date.now() + 150;

    if (isAxisGroup) {
      setGraphFromCurrentPage();
    }

    if (draw && typeof draw.refresh === 'function') {
      draw.refresh();
    }
    if (util && typeof util.drawMiniature === 'function') {
      util.drawMiniature();
    }
  }

  /**
   * renderNode
   *
   * 通常 node と pseudo group node を同じ描画入口で扱う。
   *
   * - simple は page.groups の定義から生成した pseudo node として graph.nodes に載る。
   * - pseudo group node は実データ node ではなく、group 全体の表示と操作の入口を与えるためのもの。
   * - ここで pseudo group node を先に判定し、専用 render 関数へ振り分けることで、
   *   通常 Topic / Content / Memo などの描画ロジックと分離する。
   * - group を node/link-first で扱うため、menu や drag の入口も node/link と同じ流れに寄せる。
   */
  function isTimelineTouchMenuTarget(node) {
    return !!(node && node.type === 'Segment' && node.groupRef);
  }

  function getTouchScreenPoint(ev) {
    var src = ev;

    if (!src) {
      return null;
    }
    if (src.changedTouches && src.changedTouches.length > 0) {
      src = src.changedTouches[0];
    }
    else if (src.touches && src.touches.length > 0) {
      src = src.touches[0];
    }

    if (!src) {
      return null;
    }

    return {
      x: Number.isFinite(Number(src.clientX)) ? Number(src.clientX) : 0,
      y: Number.isFinite(Number(src.clientY)) ? Number(src.clientY) : 0
    };
  }

  function bindTimelinePointTouchMenu(d3node, node) {
    var touchState = null;
    var TOUCH_TAP_TOLERANCE = 10;

    function resetTouchState() {
      touchState = null;
    }

    function openPointMenu(target) {
      var resolved = target && target.id ? (findNodeById(target.id) || target) : target;

      window.setTimeout(function () {
        if (!resolved || state.dragging) {
          return;
        }
        clearTimeout(state.menuTimer);
        if (menu && typeof menu.openContextMenu === 'function') {
          menu.openContextMenu({
            node: resolved,
            position: {
              x: Number.isFinite(Number(resolved.x)) ? Number(resolved.x) : 0,
              y: Number.isFinite(Number(resolved.y)) ? Number(resolved.y) : 0
            }
          });
        }
      }, 0);
    }

    if (!d3node || d3node.empty()) {
      return;
    }

    if (!isTimelineTouchMenuTarget(node)) {
      d3node.on('touchstart.timelinePointMenu', null);
      d3node.on('touchmove.timelinePointMenu', null);
      d3node.on('touchend.timelinePointMenu', null);
      d3node.on('touchcancel.timelinePointMenu', null);
      return;
    }

    d3node
      .style('touch-action', 'manipulation')
      .on('touchstart.timelinePointMenu', function (d) {
        var ev = d3.event;
        var p = getTouchScreenPoint(ev);

        touchState = {
          start: p,
          moved: false,
          id: d && d.id ? d.id : (node && node.id)
        };

        if (ev && typeof ev.stopPropagation === 'function') {
          ev.stopPropagation();
        }
      })
      .on('touchmove.timelinePointMenu', function () {
        var ev = d3.event;
        var p = getTouchScreenPoint(ev);

        if (!touchState || !touchState.start || !p) {
          return;
        }

        if (Math.abs(p.x - touchState.start.x) > TOUCH_TAP_TOLERANCE ||
          Math.abs(p.y - touchState.start.y) > TOUCH_TAP_TOLERANCE) {
          touchState.moved = true;
        }
      })
      .on('touchend.timelinePointMenu', function (d) {
        var ev = d3.event;
        var shouldOpen = !!(touchState && !touchState.moved);
        var target = d && d.id ? d : node;

        if (shouldOpen) {
          if (ev && typeof ev.preventDefault === 'function') {
            ev.preventDefault();
          }
          if (ev && typeof ev.stopPropagation === 'function') {
            ev.stopPropagation();
          }
        }

        resetTouchState();

        if (shouldOpen) {
          openPointMenu(target);
        }
      })
      .on('touchcancel.timelinePointMenu', function () {
        resetTouchState();
      });
  }

  function buildMemoPath(width, height, corner, foldSize) {
    var halfW = width / 2;
    var halfH = height / 2;
    var fold = Math.max(0, Math.min(Number(foldSize || 32), Math.min(width, height) / 2));
    var c = (corner || 'bottom-right').toLowerCase();

    if ('top-left' === c) {
      return [
        'M', (-halfW + fold), ',', (-halfH),
        'L', halfW, ',', (-halfH),
        'L', halfW, ',', halfH,
        'L', -halfW, ',', halfH,
        'L', -halfW, ',', (-halfH + fold),
        'L', (-halfW + fold), ',', (-halfH),
        'Z'
      ].join('');
    }

    if ('bottom-left' === c) {
      return [
        'M', -halfW, ',', -halfH,
        'L', halfW, ',', -halfH,
        'L', halfW, ',', halfH,
        'L', (-halfW + fold), ',', halfH,
        'L', -halfW, ',', (halfH - fold),
        'L', -halfW, ',', -halfH,
        'Z'
      ].join('');
    }

    if ('bottom-right' === c) {
      return [
        'M', -halfW, ',', -halfH,
        'L', halfW, ',', -halfH,
        'L', halfW, ',', (halfH - fold),
        'L', (halfW - fold), ',', halfH,
        'L', -halfW, ',', halfH,
        'L', -halfW, ',', -halfH,
        'Z'
      ].join('');
    }

    // default: bottom-right
    return [
      'M', -halfW, ',', -halfH,
      'L', halfW, ',', -halfH,
      'L', halfW, ',', (halfH - fold),
      'L', (halfW - fold), ',', halfH,
      'L', -halfW, ',', halfH,
      'L', -halfW, ',', -halfH,
      'Z'
    ].join('');
  }

  function buildMemoFoldInnerPath(width, height, corner, foldSize) {
    var halfW = width / 2;
    var halfH = height / 2;
    var fold = Math.max(0, Math.min(Number(foldSize || 32), Math.min(width, height) / 2));
    var c = (corner || 'bottom-right').toLowerCase();

    if ('top-left' === c) {
      return [
        'M', (-halfW + fold), ',', -halfH,
        'L', (-halfW + fold), ',', (-halfH + fold),
        'L', -halfW, ',', (-halfH + fold)
      ].join('');
    }

    if ('bottom-left' === c) {
      return [
        'M', (-halfW + fold), ',', halfH,
        'L', (-halfW + fold), ',', (halfH - fold),
        'L', -halfW, ',', (halfH - fold)
      ].join('');
    }

    if ('bottom-right' === c) {
      return [
        'M', (halfW - fold), ',', halfH,
        'L', (halfW - fold), ',', (halfH - fold),
        'L', halfW, ',', (halfH - fold)
      ].join('');
    }

    // default: bottom-right
    return [
      'M', (halfW - fold), ',', halfH,
      'L', (halfW - fold), ',', (halfH - fold),
      'L', halfW, ',', (halfH - fold)
    ].join('');
  }

  renderNode = function (node) {
    if (!node) {
      return null;
    }

    if (isSimpleGroupPseudoNode(node)) {
      return renderSimpleGroupNode(node);
    }

    if (node.changed) {
      node.changed = false;
    }

    var id = node.id,
      d3node = d3.select(`g.node#${id}`);

    if (!d3node || !d3node.node()) {
      const canvasSel = d3.select(`g#${state.canvasId}`);
      if (!canvasSel.node()) {
        console.warn('renderNode: canvas <g> not found', state.canvasId, 'nodeId=', id);
        return null;
      }
      d3node = canvasSel.append('g')
        .attr('id', function (d) { return node.id; })
        .attr('class', 'node')
        .attr('transform', function (d) {
          return `translate(${node.x},${node.y})`;
        })
        .datum(function (d) { return node; })
        .on('mouseover', function (d, i) {
          clearTimeout(state.menuTimer);
          menu.openContextMenu({ node: d });
        })
        .on('mouseout', function () {
          d3.event.preventDefault();
          clearTimeout(state.menuTimer);
          state.menuTimer = setTimeout(function () {
            menu.closeContextMenu();
          }, MENU_TIMEOUT);
        })
        .on('click', function (d) {
          if (!state.Selecting || 'view' === graph.mode) {
            return;
          }
          d3.event.stopPropagation();
          toggleSelectedNodeElement(d);
          if (menu && typeof menu.closeContextMenu === 'function') {
            menu.closeContextMenu();
          }
        })
        .on('dblclick', function (d) {
          if (window.wuwei &&
            wuwei.video &&
            typeof wuwei.video.isVideoNode === 'function' &&
            wuwei.video.isVideoNode(d)) {
            wuwei.video.open(d);
          }
        })
        .call(
          d3.drag()
            .on('start', Node.prototype.dragstarted)
            .on('drag', Node.prototype.dragged)
            .on('end', Node.prototype.dragended)
        );
    }
    else {
      d3node.selectAll('*').remove();
      d3node
        .attr('class', 'node')
        .attr('transform', function (d) {
          return `translate(${node.x},${node.y})`;
        })
        .datum(function () {
          return node;
        });
    }

    bindTimelinePointTouchMenu(d3node, node);

    var
      type = node.type,
      shape = node.shape,
      description = node.description,
      table = node.table,
      label,
      href,
      size = node.size,
      width = (size && size.width) || defaultSize.width,
      height = (size && size.height) || defaultSize.height,
      radius = (size && size.radius) || defaultSize.radius,
      cols = size.cols,
      color = node.color,
      outline = node.outline,
      font = node.font,
      font_family = (font && font.family) || 'Arial',
      font_size = (font && font.size) || '10pt',
      font_color = (font && font.color) || '#303030',
      text_anchor = node.font['text-anchor'],
      alignment_baseline = node.font['alignment-baseline'],
      thumbnail,
      resourceUri,
      linkCount,
      padding,
      gText,
      item,
      linkCountNode;
    thumbnail = node.thumbnailUri || node.thumbnail || '';
    if (util.getResourceThumbnailUri) {
      let resourceThumbnail = util.getResourceThumbnailUri(node);
      const staleResourceThumbnail = /[?&]area=resource(?:&|$)/.test(String(thumbnail || ''));
      if (staleResourceThumbnail && (!resourceThumbnail || resourceThumbnail === thumbnail) &&
        common.current && common.current.note_id === 'new_note' && util.toPublicResourceUri) {
        const match = String(thumbnail || '').match(/[?&]path=([^&]+)/);
        const oldPath = match ? decodeURIComponent(match[1]) : '';
        const draftPath = oldPath.replace(
          /^(\d{4}\/\d{2}\/\d{2}\/(_[0-9a-f-]+)\/thumbnail\.[A-Za-z0-9]+)$/i,
          function (_all, _path, resourceId) {
            return oldPath.replace(resourceId + '/', 'new_note/resource/' + resourceId + '/');
          }
        );
        if (draftPath && draftPath !== oldPath) {
          resourceThumbnail = util.toPublicResourceUri('note', draftPath, util.getCurrentUserId && util.getCurrentUserId());
        }
      }
      if (resourceThumbnail && !/^fa-/.test(resourceThumbnail) &&
        (!thumbnail || /^fa-/.test(thumbnail) || staleResourceThumbnail || resourceThumbnail !== thumbnail)) {
        thumbnail = resourceThumbnail;
        node.thumbnailUri = resourceThumbnail;
        if (node.size && node.size.width <= 40 && node.size.height <= 60) {
          node.size.width = 77;
          node.size.height = 100;
          width = node.size.width;
          height = node.size.height;
        }
      }
    }
    resourceUri = (node.resource && node.resource.uri) || '';

    if (width < 0) {
      width = 1;
    }
    if (height < 0) {
      height = 1;
    }

    linkCount = countHiddenLink(node);

    label = node.label;

    if ('ROUNDED' === shape && !radius) {
      if (isFinite(width) && isFinite(height)) {
        if (width > height) {
          radius = height / 2;
        }
        else {
          radius = width / 2;
        }
      }
      else {
        radius = defaultSize.radius;
      }
    }
    if ('CIRCLE' === shape && !radius) {
      radius = defaultSize.radius;
    }

    if ('CIRCLE' === shape) {
      d3node.append('circle')
        .attr('class', 'shape-node')
        .attr('r', radius)
        .attr('stroke', outline)
        .attr('fill', color);
    }
    else if ('RECTANGLE' === shape) {
      d3node.append('rect')
        .attr('class', 'shape-node')
        .attr('x', -width / 2)
        .attr('y', -height / 2)
        .attr('width', width)
        .attr('height', height)
        .attr('stroke', outline)
        .attr('fill', color);
    }
    else if ('ELLIPSE' === shape) {
      d3node.append('rect')
        .attr('class', 'shape-node')
        .attr('x', -width / 2)
        .attr('y', -height / 2)
        .attr('width', width)
        .attr('height', height)
        .attr('rx', width / 2)
        .attr('ry', height / 2)
        .attr('stroke', outline)
        .attr('fill', color);
    }
    else if ('ROUNDED' === shape) {
      d3node.append('rect')
        .attr('class', 'shape-node')
        .attr('x', -width / 2)
        .attr('y', -height / 2)
        .attr('width', width)
        .attr('height', height)
        .attr('rx', radius)
        .attr('ry', radius)
        .attr('stroke', outline)
        .attr('fill', color);
    }
    else if ('TRIANGLE' === shape) {
      var points = `0,${-2 * height / 3} ${-width / 2},${height / 3} ${width / 2},${height / 3}`;
      d3node.append('polygon') //		    <polygon points="250,60 100,400 400,400" class="triangle" />
        .attr('class', 'shape-node')
        .attr('x', -width / 2)
        .attr('y', -height / 2)
        .attr('width', width)
        .attr('height', height)
        .attr('points', points)
        .attr('stroke', outline)
        .attr('fill', color);
    }
    else if ('RHOMBUS' === shape) {
      var points = `0,${-height / 2}, ${-width / 2},0 0,${height / 2} ${width / 2},0`;
      d3node.append('polygon')
        .attr('class', 'shape-node')
        .attr('x', -width / 2)
        .attr('y', -height / 2)
        .attr('width', width)
        .attr('height', height)
        .attr('points', points)
        .attr('stroke', outline)
        .attr('fill', color);
    }
    else if ('MEMO' === shape) {
      var memoStyle = (node.style && node.style.memo && typeof node.style.memo === 'object')
        ? node.style.memo
        : {};
      var memoCorner = memoStyle.corner || 'bottom-right';
      var memoFoldSize = finiteOr(memoStyle.foldSize, 32);
      var memoPath = buildMemoPath(width, height, memoCorner, memoFoldSize);
      var memoFoldInnerPath = buildMemoFoldInnerPath(width, height, memoCorner, memoFoldSize);

      d3node.append('path')
        .attr('class', 'memo-node')
        .attr('d', memoPath)
        .attr('fill', 'url(#vertical-gradation)');

      d3node.append('path')
        .attr('class', 'memo-fold-inner')
        .attr('d', memoFoldInnerPath)
        .attr('fill', 'none')
        .attr('stroke', memoStyle.foldStroke || '#b8b8b8')
        .attr('stroke-width', 1.2)
        .attr('stroke-linecap', 'square')
        .attr('stroke-linejoin', 'miter')
        .attr('pointer-events', 'none');

      d3node.append('path')
        .attr('class', 'shape-node')
        .attr('d', memoPath)
        .attr('filter', 'url(#dropshadow)')
        .attr('opacity', '0.3')
        .attr('fill', node.color);

      /*d3node.append('path')
        .attr('class', 'memo-node')
        .attr('d',
          `M${-width / 2},${-height / 2}` +
          ` l0,${4 * height / 5}` +
          ` a${width / 10},${height / 5} 0 0,0 ${width / 10},${height / 5}` +
          ` l${width},0` +
          ` a${width / 10},${height / 5} 0 0,1 -${width / 10},-${height / 5}` +
          ` l0,-${4 * height / 5} z`)
        .attr('fill', 'url(#vertical-gradation)');
      d3node.append('path')
        .attr('class', 'shape-node')
        .attr('d',
          `M${-width / 2},${-height / 2}` +
          ` l0,${4 * height / 5}` +
          ` a${width / 10},${height / 5} 0 0,0 ${width / 10},${height / 5}` +
          ` l${width},0` +
          ` a${width / 10},${height / 5} 0 0,1 -${width / 10},-${height / 5}` +
          ` l0,-${4 * height / 5} z`)
        .attr('filter', 'url(#dropshadow)')
        .attr('opacity', '0.3')
        .attr('fill', node.color);
        */
    }
    else if ('THUMBNAIL' === shape && thumbnail) {
      // const resource = node;
      let rgx = /fa-file-.*/; // icon svg for pdf, docx, ...
      if (thumbnail.match(rgx)) {
        const useEl = document.createElementNS("http://www.w3.org/2000/svg", 'use');
        useEl.setAttribute('x', -width / 2);
        useEl.setAttribute('y', -height / 2);
        useEl.setAttribute('width', width);
        useEl.setAttribute('height', height);
        useEl.setAttribute('fill', node.color);
        if ('safari' === state.browser) {
          useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${thumbnail}`);
        }
        else {
          useEl.setAttribute('href', `#${thumbnail}`);
        }
        /** append shape */
        const gEl = (d3node && d3node.node && d3node.node()) || document.getElementById(id);
        if (gEl) { gEl.appendChild(useEl); } else { console.warn('renderNode: node <g> not found for append', id); }
      }
      else {
        // see https://stackoverflow.com/questions/27245673/svg-image-element-not-displaying-in-safari
        const imageEl = document.createElementNS("http://www.w3.org/2000/svg", 'image');
        imageEl.setAttribute('x', -width / 2);
        imageEl.setAttribute('y', -height / 2);
        imageEl.setAttribute('width', width);
        imageEl.setAttribute('height', height);
        if ('safari' === state.browser) {
          imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', thumbnail);
        }
        else {
          imageEl.setAttribute('href', thumbnail);
        }
        /** append shape */
        const gEl = (d3node && d3node.node && d3node.node()) || document.getElementById(id);
        if (gEl) { gEl.appendChild(imageEl); } else { console.warn('renderNode: node <g> not found for append', id); }
        if (resourceUri && resourceUri.toLowerCase().match(/\.pdf$/)) {
          const borderEl = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
          borderEl.setAttribute('x', -width / 2);
          borderEl.setAttribute('y', -height / 2);
          borderEl.setAttribute('width', width);
          borderEl.setAttribute('height', height);
          borderEl.setAttribute('stroke', common.Color.contentOutline);
          borderEl.setAttribute('fill', 'none');
          /** append border */
          const gEl = (d3node && d3node.node && d3node.node()) || document.getElementById(id);
          if (gEl) { gEl.appendChild(borderEl); } else { console.warn('renderNode: node <g> not found for append', id); }
        }
      }
    }

    if (!text_anchor) {
      if ('Content' === type) {
        text_anchor = 'start';
      }
      else {
        text_anchor = 'middle';
      }
    }

    if (!alignment_baseline) {
      if ('Content' === type) {
        alignment_baseline = 'baseline';
      }
      else {
        alignment_baseline = 'middle';
      }
    }

    if (('THUMBNAIL' === shape || 'Content' === type) && label) {
      renderWrappedTopLabel(d3node, node, label, {
        paddingX: 4,
        labelGap: 10,
        lineHeight: 20
      });
    }

    padding = { x: 4, y: 4 };

    // Render plain text labels for ordinary Topic nodes and real timeline Segment nodes.
    // Segment is stored as a real node in page.nodes, so it should show its label like Topic.
    if (('Topic' === type || 'Segment' === type) && 'THUMBNAIL' !== shape && label) {
      gText = d3node.append('text')
        .attr('class', 'node-label')
        .attr('font-family', font_family)
        .attr('font-size', font_size)
        .attr('fill', font_color)
        .attr('text-anchor', text_anchor)
        .attr('alignment-baseline', alignment_baseline)
        .text(label);
      if ('CIRCLE' === shape) {
        item = {
          text: gText,
          width: width,
          height: 2 * radius,
          offsetx: 0,
          offsety: -radius
        };
      }
      else {
        item = {
          text: gText,
          width: 2 * width,
          height: height,
          offsetx: 0,
          offsety: 0
        };
      }

      setMultipleLine(item);

      var
        tspans = d3.selectAll(`g.node#${node.id} text.node-label tspan`).nodes(),
        line_count = tspans.length,
        start = -20 * line_count / 2;
      for (var i = 0; i < line_count; i++) {
        if ('start' === text_anchor) {
          tspans[i].setAttribute('x', (padding.x - (width / 2)) + 'px');
        }
        else if ('end' === text_anchor) {
          tspans[i].setAttribute('x', ((width / 2) - padding.x) + 'px');
        }
        else if ('middle' === text_anchor) { }
        tspans[i].setAttribute('y', (start + 20 * i) + 'px');
      }
    }

    function renderNodeAdocHtml(node, type) {
      var source = '';

      if (!node) {
        return '';
      }

      if ('Memo' === type) {
        source = (node.description && typeof node.description.body === 'string')
          ? node.description.body
          : '';
      }
      else if ('Content' === type) {
        if (node.description && typeof node.description.body === 'string' && node.description.body) {
          source = node.description.body;
        }
        else if (typeof node.value === 'string') {
          source = node.value;
        }
        else if (node.value && typeof node.value.comment === 'string') {
          source = node.value.comment;
        }
      }

      if (!source || !source.trim()) {
        return '';
      }

      if (wuwei.util && typeof wuwei.util.renderAsciiDoc === 'function') {
        return wuwei.util.renderAsciiDoc(source, {
          showtitle: false,
          allowHtml: true,
          attributes: {
            icons: 'font'
          }
        });
      }

      return source;
    }

    if ('Memo' === type) {
      item = {
        width: width - 2 * padding.x,
        height: height - 2 * padding.y,
        offsetx: padding.x - width / 2,
        offsety: padding.y - height / 2,
        verticalAlign: 'top'
      };
      var memoHtml = renderNodeAdocHtml(node, type);
      if (memoHtml) {
        d3node
          .append('foreignObject')
          .attr('x', item.offsetx)
          .attr('y', item.offsety)
          .attr('width', item.width)
          .attr('height', item.height)
          .append('xhtml:div')
          .style('font-family', font_family)
          .style('font-size', font_size)
          .style('color', font_color)
          .html(memoHtml);
      }
      d3node.selectAll('rect.cover-description').raise();
    }
    else if (('Content' === type || 'Annotation' === type) &&
      'THUMBNAIL' !== shape) {
      if ('CIRCLE' === shape) {
        item = {
          width: 2 * (radius - padding.x),
          height: 2 * (radius - padding.y),
          offsetx: padding.x - radius,
          offsety: padding.y - radius
        };
      }
      else {
        item = {
          width: width - 2 * padding.x,
          height: height - 2 * padding.y,
          offsetx: padding.x - width / 2,
          offsety: padding.y - height / 2,
          verticalAlign: 'top'
        };
      }

      var _html;
      if ('Annotation' === type) {
        _html = node.value.citation;
      }
      else {
        _html = renderNodeAdocHtml(node, type);
      }
      if ('string' === typeof _html && _html.length > 0) {
        d3node
          .append('foreignObject')
          .attr('x', item.offsetx)
          .attr('y', item.offsety)
          .attr('width', item.width)
          .attr('height', item.height)
          .append('xhtml:div')
          .style('font-family', font_family)
          .style('font-size', font_size)
          .style('color', font_color)
          .html(_html);
      }
      d3node.selectAll('rect.cover-description').raise();
    }

    linkCountNode = d3node.append('text')
      .attr('class', 'link-count')
      .attr('font-family', font_family)
      .attr('font-size', '10pt')
      .attr('fill', '#d00000')
      .attr('stroke', 'none')
      .attr('text-anchor', 'end');
    if ('CIRCLE' === shape) {
      linkCountNode
        .attr('x', radius)
        .attr('y', -radius);
    }
    else {
      linkCountNode
        .attr('x', width / 2)
        .attr('y', -height / 2);
    }
    if ('THUMBNAIL' === shape || 'Content' === type) {
      linkCountNode
        .attr('text-anchor', 'start')
        .attr('x', 3 + width / 2)
        .attr('y', 11 - (height / 2));
    }
    if (linkCount > 0) {
      linkCountNode.text(linkCount);
    }
    else {
      linkCountNode.text('');
    }
  }

  /**
   * groupDragStarted
   *
   * group drag 開始時の基準点を保存する。
   *
   * 設計意図:
   * - drag 開始点と drag 中の点は、必ず同じ座標系(context 座標)で取得する。
   * - d3.event.x/y と clientX/clientY->pContext が混在すると、
   *   canvas の translate / scale が入った時に右下へずれる。
   * - そのため getGroupDragContextPoint() に統一する。
   *
   * また、drag 開始時に hover menu を閉じ、一定時間 hover 再表示を抑止する。
   * これにより drag 開始直後の menu 割り込みを防ぐ。
   */
  function groupDragStarted(group) {
    var page = common.current ? common.current.page : null;
    var point;

    if (!group) {
      return;
    }

    point = getGroupDragContextPoint();

    state.groupDragGroupId = group.id;
    state.groupDragAnchor = {
      x: finiteOr(point.x, 0),
      y: finiteOr(point.y, 0)
    };
    state.groupDragOrigin = buildGroupDragOrigin(group);
    state.dragging = true;
    state.hoverLockUntil = Date.now() + 250;

    cancelGroupHoverMenu(true);
  }

  /**
   * groupDragged
   *
   * drag 開始時の基準点との差分(dx, dy)を group members 全体へ適用する。
   *
   * 設計意図:
   * - group 自体を動かすのではなく、members の node 座標、
   *   および必要に応じて group.origin / group.axis.anchor を更新する。
   * - こうすることで、group は page.groups の定義として保ちつつ、
   *   実 node の位置に反映できる。
   */
  function groupDragged(group) {
    var point, dx, dy;
    var isAxisGroup;

    if (!group || !state.groupDragOrigin || !state.groupDragAnchor) {
      return;
    }

    point = getGroupDragContextPoint();

    dx = finiteOr(point.x, 0) - finiteOr(state.groupDragAnchor.x, 0);
    dy = finiteOr(point.y, 0) - finiteOr(state.groupDragAnchor.y, 0);

    /*
     * 軸そのものの drag は平行移動。
     * - 左右上下へ自由に移動できる
     * - 軸長は変えない
     * - セグメント相対配置も変えない
     */
    applyGroupTranslate(group, state.groupDragOrigin, dx, dy);

    isAxisGroup = !!(group && group.type === 'timeline');

    if (isAxisGroup) {
      setGraphFromCurrentPage();
    }

    if (draw && typeof draw.refresh === 'function') {
      draw.refresh();
    }
    if (util && typeof util.drawMiniature === 'function') {
      util.drawMiniature();
    }
  }

  /**
   * groupDragEnded
   *
   * group drag 状態を解除し、hover menu の再表示を少し遅らせる。
   *
   * 設計意図:
   * - drag 終了直後はポインタがまだ hit 領域上にあることが多い。
   * - その瞬間に hover menu が再表示されると操作感が悪いため、
   *   hoverLockUntil を少し先まで設定して再表示を抑える。
   */
  function groupDragEnded(group) {
    state.groupDragGroupId = null;
    state.groupDragAnchor = null;
    state.groupDragOrigin = null;
    state.dragging = false;
    state.hoverLockUntil = Date.now() + 150;

    var isAxisGroup = !!(group && group.type === 'timeline');
    if (isAxisGroup) {
      setGraphFromCurrentPage();
    }

    if (draw && typeof draw.refresh === 'function') {
      draw.refresh();
    }
    if (util && typeof util.drawMiniature === 'function') {
      util.drawMiniature();
    }
  }

  /**
   * renderSimpleGroupNode
   *
   * simple を pseudo node として描画する。
   *
   * 設計意図:
   * - simple 自体は page.nodes に存在しないため、page.groups の定義から pseudo node を生成して描画する。
   * - 見た目用の破線枠(group-box)と、操作用の hit 領域(group-box-hit)を分離する。
   * - group-box は表示専用で、ユーザーに group の範囲を示す。
   * - group-box-hit は hover / context menu / drag の入口であり、操作性を確保するために別要素とする。
   *
   * 重要:
   * - group-box-hit は全面の透明面ではなく、stroke のみで pointer-events を受ける構成にする。
   * - これにより、枠線付近では group 全体の drag / menu を扱い、
   *   枠の内側では member node へのイベントを通して、各 node の drag / menu を妨げない。
   * - group 全体を動かしたい時は枠線をつかみ、個別 node を動かしたい時は node 本体をつかむ。
   *
   * hover menu:
   * - hover で即座に menu を出すと drag 開始と干渉しやすい。
   * - そのため遅延付き scheduleGroupHoverMenu() を使い、drag 中やボタン押下中は開かないようにする。
   */
  function renderSimpleGroupNode(node) {
    var group = findGroupById(node.groupRef);
    var box = resolveGroupBox(group && group.id);
    var canvas = d3.select('g#' + state.canvasId);
    var g;
    var touchState = null;
    var TOUCH_TAP_TOLERANCE = 12;

    function getBoxCenter() {
      return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
      };
    }

    function getTouchPoint(ev) {
      var src = ev;

      if (!src) {
        return null;
      }
      if (src.changedTouches && src.changedTouches.length > 0) {
        src = src.changedTouches[0];
      }
      else if (src.touches && src.touches.length > 0) {
        src = src.touches[0];
      }

      if (!src) {
        return null;
      }

      return {
        x: Number.isFinite(Number(src.clientX)) ? Number(src.clientX) : 0,
        y: Number.isFinite(Number(src.clientY)) ? Number(src.clientY) : 0
      };
    }

    function resetTouchState() {
      touchState = null;
    }

    function openGroupBoxMenu() {
      var pos = getBoxCenter();

      window.setTimeout(function () {
        if (state.dragging || state.groupDragGroupId) {
          return;
        }
        cancelGroupHoverMenu(false);
        if (menu && typeof menu.openContextMenu === 'function') {
          menu.openContextMenu({
            node: node,
            position: pos
          });
        }
      }, 80);
    }

    if (!group || !box) {
      return null;
    }

    d3.select('g.node#' + node.id).remove();

    g = canvas.append('g')
      .attr('class', 'node group-node')
      .attr('id', node.id)
      .datum(node);

    g.append('rect')
      .attr('class', 'group-box')
      .attr('x', box.x)
      .attr('y', box.y)
      .attr('width', box.width)
      .attr('height', box.height)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', 'none')
      .attr('stroke', '#666666')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '8,4');

    g.append('rect')
      .attr('class', 'group-box-hit')
      .attr('x', box.x)
      .attr('y', box.y)
      .attr('width', box.width)
      .attr('height', box.height)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16)
      .style('cursor', 'move')
      .style('pointer-events', 'stroke')
      .style('touch-action', 'none')
      .style('-ms-touch-action', 'none')
      .style('-webkit-user-select', 'none')
      .style('-webkit-touch-callout', 'none')
      .style('-webkit-tap-highlight-color', 'transparent')
      .on('mouseover', function () {
        d3.event.preventDefault();
        scheduleGroupHoverMenu({
          node: node,
          position: getBoxCenter()
        });
      })
      .on('mousemove', function () {
        if (!canOpenGroupHoverMenu()) {
          cancelGroupHoverMenu(false);
        }
      })
      .on('mouseout', function () {
        d3.event.preventDefault();
        clearTimeout(state.menuTimer);
        state.menuTimer = setTimeout(function () {
          if (!state.dragging && !state.groupDragGroupId) {
            menu.closeContextMenu();
          }
        }, MENU_TIMEOUT);
      })
      .on('touchstart', function () {
        var ev = d3.event;
        var p = getTouchPoint(ev);

        touchState = {
          start: p,
          moved: false
        };

        cancelGroupHoverMenu(false);

        if (ev && typeof ev.stopPropagation === 'function') {
          ev.stopPropagation();
        }
      })
      .on('touchmove', function () {
        var ev = d3.event;
        var p = getTouchPoint(ev);

        if (!touchState || !touchState.start || !p) {
          return;
        }

        if (Math.abs(p.x - touchState.start.x) > TOUCH_TAP_TOLERANCE ||
          Math.abs(p.y - touchState.start.y) > TOUCH_TAP_TOLERANCE) {
          touchState.moved = true;

          if (ev && typeof ev.preventDefault === 'function') {
            ev.preventDefault();
          }
          if (ev && typeof ev.stopPropagation === 'function') {
            ev.stopPropagation();
          }
        }
      })
      .on('touchend', function () {
        var ev = d3.event;
        var shouldOpen = !!(touchState && !touchState.moved);

        if (shouldOpen) {
          if (ev && typeof ev.preventDefault === 'function') {
            ev.preventDefault();
          }
          if (ev && typeof ev.stopPropagation === 'function') {
            ev.stopPropagation();
          }
        }

        resetTouchState();

        if (shouldOpen) {
          openGroupBoxMenu();
        }
      })
      .on('touchcancel', function () {
        resetTouchState();
      })
      .call(
        d3.drag()
          .on('start', function () { groupDragStarted(group); })
          .on('drag', function () { groupDragged(group); })
          .on('end', function () { groupDragEnded(group); })
      );

    return g;
  }


  function getLinkStartNode(link) {
    return link && link.from ? findNodeById(link.from) : null;
  }

  function getLinkEndNode(link) {
    return link && link.to ? findNodeById(link.to) : null;
  }

  function getStartPosition(link) {
    return (link && link.routing && link.routing.startPosition) || '';
  }

  function getEndPosition(link) {
    return (link && link.routing && link.routing.endPosition) || '';
  }

  function setStartPosition(link, value) {
    link.routing = link.routing || {};
    if (!value) delete link.routing.startPosition;
    else link.routing.startPosition = value;
  }

  function setEndPosition(link, value) {
    link.routing = link.routing || {};
    if (!value) delete link.routing.endPosition;
    else link.routing.endPosition = value;
  }


  featurePoints = function (node, position) {
    let x, y,
      pos = util.getPosition(node),
      table, thead, tbody, columns, rows,
      width, height, col_width, row_height,
      rgx = /^([TRBL])([-+]?\d+)$/,
      rgxT = /^C(\d+)R(\d+)$/,
      INC = 4,
      col, row, base, diff,
      shape = node.shape,
      size = node.size,
      radius = +size.radius,
      TY, RX, BY, LX, W, H,
      hD = 0, vD = 0, pD = 1.5;
    x = pos.x;
    y = pos.y;

    /** node */
    if ('CIRCLE' === shape) {
      W = radius * 2; H = radius * 2;
    }
    else {
      W = +size.width; H = +size.height;
    }
    TY = y - H / 2;
    RX = x + W / 2;
    BY = y + H / 2;
    LX = x - W / 2;
    if ('TRIANGLE' === shape) {
      TY = y - (2 * H / 3);
      BY = y + (H / 3);
    }

    return {
      'x': x,
      'y': y,
      'TY': TY,
      'RX': RX,
      'BY': BY,
      'LX': LX
    };
  }

  function nearest(v, v1, v2) {
    if (Math.abs(v1 - v) < Math.abs(v2 - v)) {
      return v1;
    }
    return v2;
  }

  function hierarchyH(link, sPos, tPos, move) {
    let
      sX = sPos.x, sY = sPos.y, sTY = sPos.TY, sRX = sPos.RX, sBY = sPos.BY, sLX = sPos.LX,
      tX = tPos.x, tY = tPos.y, tTY = tPos.TY, tRX = tPos.RX, tBY = tPos.BY, tLX = tPos.LX,
      X, Y, sCY, tCY, sCX, tCX,
      P1, P2, P3, P4,
      dx, pathString;

    function updatePointsH(link) {
      X = link.x; Y = link.y;
      sCY = nearest(Y, sTY, sBY); tCY = nearest(Y, tTY, tBY);
      sCX = nearest(X, sLX, sRX); tCX = nearest(X, tLX, tRX);
      // source
      if (sLX < X && X < sRX) {
        console.log('1) X inside of Source-> P1 null');
        P1 = null; P2 = { x: X, y: sCY };
      }
      else {
        console.log('2) X outside of Source');
        P1 = { x: sCX, y: sY }; P2 = { x: X, y: sY };
      }
      // target
      if (tLX < X && X < tRX) {
        console.log('3) X inside of Target -> P4 null');
        P3 = { x: X, y: tCY }; P4 = null;
      }
      else {
        console.log('4) X outside of Target');
        P3 = { x: X, y: tY }; P4 = { x: tCX, y: tY };
      }
      // points
      let x1, y1, x2, y2, x3, y3, x4, y4,
        xa, ya, xb, yb, xc, yc, xd, yd;
      x1 = P1 && P1.x; y1 = P1 && P1.y;
      x2 = P2.x; y2 = P2.y;
      x3 = P3.x; y3 = P3.y;
      x4 = P4 && P4.x; y4 = P4 && P4.y;
      if (P1) {
        // (xa,ya)
        if (Math.abs(x2 - x1) > ROUND) {
          xa = x2 - Math.sign(x2 - x1) * ROUND;
        }
        else { xa = x1; }
        ya = y1
        // (xb,yb)
        xb = x2;
        if (Math.abs(y3 - y2) > 2 * ROUND) {
          yb = y2 + Math.sign(y3 - y2) * ROUND;
        }
        else { yb = (y2 + y3) / 2; }
      }
      if (P4) {
        // (xc,yc)
        xc = x3;
        if (P1 && Math.abs(y3 - y2) > 2 * ROUND || Math.abs(y3 - y2) > ROUND) {
          yc = y3 - Math.sign(y3 - y2) * ROUND;
        }
        else { yc = P1 && (y2 + y3) / 2 || y2; }
        // (xd,yd)
        if (Math.abs(x4 - x3) > ROUND) {
          xd = x3 + Math.sign(x4 - x3) * ROUND;
        }
        else { xd = x4; }
        yd = y3;
      }
      // pathString
      if (P1) {
        if (P4) {
          console.log('*1* MP1-LPa-Q(P2)Pb-VPc-Q(P3)Pd-LP4');
          pathString = `M${x1},${y1} L${xa},${ya} Q${x2},${y2} ${xb},${yb} V${yc} Q${x3},${y3} ${xd},${yd} L${x4},${y4}`;
        }
        else {
          console.log('*2* MP1-LPa-Q(P2)Pb-VP3');
          pathString = `M${x1},${y1} L${xa},${ya} Q${x2},${y2} ${xb},${yb} V${y3}`;
        }
      }
      else {
        if (P4) {
          console.log('*3* MP2-VPc-Q(P3)Pd-LP4');
          pathString = `M${x2},${y2} V${yc} Q${x3},${y3} ${xd},${yd} L${x4},${y4}`;
        }
        else {
          console.log('*4* P2-P3');
          pathString = `M${x2},${y2} V${y3}`;
        }
      }
      console.log(`${P1 ? `P1[${Math.round(P1.x)}),${Math.round(P1.y)}]` : ''} ${P2 ? `P2[${Math.round(P2.x)},${Math.round(P2.y)}]` : ''} ${P3 ? `P3[${Math.round(P3.x)},${Math.round(P3.y)}]` : ''} ${P4 ? `P4[${Math.round(P4.x)},${Math.round(P4.y)}]` : ''}`);
      // console.log(pathString);
      return pathString;
    } // END updatePointsH()
    if (link && sPos && tPos) {
      X = link.x; Y = link.y;
      if (move && isFinite(move.x)) {
        console.log('move horizontal link');
        dx = move.x;
        console.log(`M0 move x ${dx}`);
        // update points
        X += dx; Y = (sY + tY) / 2;
        link.x = X; link.y = Y;
        pathString = updatePointsH(link);
      }
      else {
        console.log('move from/target');
        link.x = X; link.y = (sY + tY) / 2;
        pathString = updatePointsH(link);
      }
    }
    // link.x = X; link.y = Y;
    return {
      link: link,
      pathString: pathString
    };
  }

  function hierarchyV(link, sPos, tPos, move) {
    let sX = sPos.x, sY = sPos.y, sTY = sPos.TY, sRX = sPos.RX, sBY = sPos.BY, sLX = sPos.LX,
      tX = tPos.x, tY = tPos.y, tTY = tPos.TY, tRX = tPos.RX, tBY = tPos.BY, tLX = tPos.LX,
      X, Y, sCY, tCY,
      dy, pathString;
    function updatePointsV(link) {
      X = link.x; Y = link.y;
      sCX = nearest(X, sLX, sRX); tCX = nearest(X, tLX, tRX);
      sCY = nearest(Y, sTY, sBY); tCY = nearest(Y, tTY, tBY);
      // source
      if (sTY < Y && Y < sBY) {
        console.log('1) Y inside of Source -> P1 null');
        P1 = null; P2 = { x: sCX, y: Y };
      }
      else {
        console.log('2) Y outside of Source');
        P1 = { x: sX, y: sCY }; P2 = { x: sX, y: Y };
      }
      // target
      if (tTY < Y && Y < tBY) {
        console.log('3) Y inside of Target -> P4 null');
        P3 = { x: tCX, y: Y }; P4 = null;
      }
      else {
        console.log('4) Y outside of Target');
        P3 = { x: tX, y: Y }; P4 = { x: tX, y: tCY };
      }
      // points
      let x1, y1, x2, y2, x3, y3, x4, y4,
        xa, ya, xb, yb, xc, yc, xd, yd;
      x1 = P1 && P1.x; y1 = P1 && P1.y;
      x2 = P2.x; y2 = P2.y;
      x3 = P3.x; y3 = P3.y;
      x4 = P4 && P4.x; y4 = P4 && P4.y;
      if (P1) {
        // (xa,ya)
        if (Math.abs(y2 - y1) > ROUND) {
          ya = y2 - Math.sign(y2 - y1) * ROUND;
        }
        else { ya = y1; }
        xa = x1
        // (xb,yb)
        yb = y2;
        if (Math.abs(x3 - x2) > 2 * ROUND) {
          xb = x2 + Math.sign(x3 - x2) * ROUND;
        }
        else { xb = (x2 + x3) / 2; }
      }
      if (P4) {
        // (xc,yc)
        yc = y3;
        if (P1 && Math.abs(x3 - x2) > 2 * ROUND || Math.abs(x3 - x2) > ROUND) {
          xc = x3 - Math.sign(x3 - x2) * ROUND;
        }
        else { xc = P1 && (x2 + x3) / 2 || x2; }
        // (xd,yd)
        if (Math.abs(y4 - y3) > ROUND) {
          yd = y3 + Math.sign(y4 - y3) * ROUND;
        }
        else { yd = y4; }
        xd = x3;
      }
      // pathString
      if (P1) {
        if (P4) {
          console.log('*1* MP1-LPa-Q(P2)Pb-HPc-Q(P3)Pd-LP4');
          pathString = `M${x1},${y1} L${xa},${ya} Q${x2},${y2} ${xb},${yb} H${xc}` +
            ` Q${x3},${y3} ${xd},${yd} L${x4},${y4}`;
        }
        else {
          console.log('*2* MP1-LPa-Q(P2)Pb-HP3');
          pathString = `M${x1},${y1} L${xa},${ya} Q${x2},${y2} ${xb},${yb} H${x3}`;
        }
      }
      else {
        if (P4) {
          console.log('*3* MP2-HPc-Q(P3)Pd-LP4');
          pathString = `M${x2},${y2} H${xc}` +
            ` Q${x3},${y3} ${xd},${yd} L${x4},${y4}`;
        }
        else {
          console.log('*4* P2-P3');
          pathString = `M${x2},${y2} H${x3}`;
        }
      }
      console.log(`${P1 ? `P1[${Math.round(P1.x)}),${Math.round(P1.y)}]` : ''} ${P2 ? `P2[${Math.round(P2.x)},${Math.round(P2.y)}]` : ''} ${P3 ? `P3[${Math.round(P3.x)},${Math.round(P3.y)}]` : ''} ${P4 ? `P4[${Math.round(P4.x)},${Math.round(P4.y)}]` : ''}`);
      // console.log(pathString);
      return pathString;
    } // END updatePointsV()
    if (link && sPos && tPos) {
      X = link.x; Y = link.y;
      if (move && isFinite(move.y)) {
        console.log('move vertical link');
        dy = move.y;
        console.log(`M0 move y ${dy}`);
        // update points
        X = (sX + tX) / 2; Y += dy;
        link.x = X; link.y = Y;
        pathString = updatePointsV(link);
      }
      else {
        console.log('move source/target');
        link.x = (sX + tX) / 2; link.y = Y;
        pathString = updatePointsV(link);
      }
    }
    // link.x = X; link.y = Y;
    return {
      link: link,
      pathString: pathString
    };
  }

  function renderLinkLabel(d3link, link, x, y) {
    if (!d3link || !link) {
      return;
    }

    const label = link.label || '';
    const font = (link.style && link.style.font) ? link.style.font : (link.font || {});
    const fontFamily = font.family || 'Arial';
    const fontSize = font.size || '10pt';
    const fontColor = font.color || '#303030';
    const align = font.align || 'center';

    const textAnchor =
      (align === 'left') ? 'start' :
        (align === 'right') ? 'end' :
          'middle';

    if (!label) {
      d3link.select('text.label').remove();
      return;
    }

    let text = d3link.select('text.label');
    if (!text.node()) {
      text = d3link.append('text')
        .attr('class', 'label');
    }

    text
      .attr('x', x)
      .attr('y', y)
      .attr('font-family', fontFamily)
      .attr('font-size', fontSize)
      .attr('fill', fontColor)
      .attr('text-anchor', textAnchor)
      .attr('dominant-baseline', 'middle')
      .text(label);
  }

  hierarchyLink = function (link, move) {
    if (!link || !link.visible ||
      'NORMAL' === link.shape ||
      'simulation' === graph.mode) {
      return null;
    }

    var id = link.id,
      label = link.label,
      shape = link.shape,
      color = link.style.line.color || '#c0c0c0',
      size = link.style.line.width || 2,
      font = link.style.font,
      font_family = (font && font.family) || 'Arial',
      font_size = (font && font.size) || '10pt',
      font_color = (font && font.color) || '#303030';

    let source = getLinkStartNode(link),
      target = getLinkEndNode(link);

    if (!source || !target) {
      return null;
    }

    let sPos = featurePoints(source),
      tPos = featurePoints(target),
      position, rgx = /^([TRBL])([-+]?\d+)$/, match, value;

    if (getStartPosition(link)) {
      position = getStartPosition(link);
      match = position.match(rgx);
      if (match) {
        value = +match[2];
        switch (match[1]) {
          case 'T':
          case 'B':
            sPos.x += GRID * value; break;
          case 'R':
          case 'L':
            sPos.y += GRID * value; break;
        }
      }
    }

    if (getEndPosition(link)) {
      position = getEndPosition(link);
      match = position.match(rgx);
      if (match) {
        value = +match[2];
        switch (match[1]) {
          case 'T':
          case 'B':
            tPos.x += GRID * value; break;
          case 'R':
          case 'L':
            tPos.y += GRID * value; break;
        }
      }
    }

    let hierarchyPath = null,
      pathString = '';

    if ('HORIZONTAL' === shape) {
      hierarchyPath = hierarchyH(link, sPos, tPos, move);
    }
    else if ('VERTICAL' === shape) {
      hierarchyPath = hierarchyV(link, sPos, tPos, move);
    }
    else {
      return null;
    }

    if (!hierarchyPath) {
      return null;
    }

    link = hierarchyPath.link;
    pathString = hierarchyPath.pathString;

    let d3link = d3.select(`g.link#${id}`);
    if (!pathString) {
      d3link.remove();
      return link;
    }

    link.routing = link.routing || {};
    link.routing.path = pathString;

    // runtime mirror が必要なら残す
    link.path = pathString;

    util.appendById(graph.links, link);

    if (!d3link || !d3link.node()) {
      d3link = d3.select(`g#${state.canvasId}`).append('g')
        .attr('id', link.id)
        .attr('class', 'link')
        .datum(link)
        .on('mouseover', function (d) {
          clearTimeout(state.menuTimer);
          menu.openContextMenu({ link: d, position: getEventContextPoint() });
        })
        .on('mouseout', function () {
          d3.event.preventDefault();
          clearTimeout(state.menuTimer);
          state.menuTimer = setTimeout(function () {
            menu.closeContextMenu();
          }, MENU_TIMEOUT);
        });
    }

    if (label) {
      renderLinkLabel(d3link, link, link.x, link.y);
    }

    let linkEl = document.getElementById(id),
      pathEl = linkEl && linkEl.querySelector('path.Path');

    if (!pathEl) {
      let d3path = d3link.append('path')
        .attr('class', 'Path')
        .attr('fill', 'none')
        .attr('opacity', 1)
        .attr('stroke', color)
        .attr('stroke-width', size);

      pathEl = linkEl && linkEl.querySelector('path.Path');
    }

    if (!pathEl) {
      return link;
    }

    pathEl.setAttribute('d', link.routing.path);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', color);
    pathEl.setAttribute('stroke-width', size);
    applyLinkMarkers(d3link, link, pathEl, color, size);

    return link;
  };

  function hierarchyPathH(link, sPos, tPos, points, move) {
    let sX = sPos.x, sY = sPos.y, sTY = sPos.TY, sRX = sPos.RX, sBY = sPos.BY, sLX = sPos.LX,
      tX = tPos.x, tY = tPos.y, tTY = tPos.TY, tRX = tPos.RX, tBY = tPos.BY, tLX = tPos.LX,
      X, Y, Y2, sCY1, sCY2, tCY1, tCY2, sCX, tCX,
      dy, dx, dy2, pathString;
    function updatePointsH(P3, P4) {
      X = P3.x; Y1 = P3.y; Y2 = P4.y;
      if (undefined === Y2) {
        Y1 = sY; Y2 = tY;
        P3.y = Y1; P4.y = Y2;
      }
      sCY1 = nearest(Y1, sTY, sBY); sCY2 = nearest(Y2, sTY, sBY);
      tCY1 = nearest(Y1, tTY, tBY); tCY2 = nearest(Y2, tTY, tBY);
      sCX = nearest(X, sLX, sRX); tCX = nearest(X, tLX, tRX);
      // source
      if (sTY < Y1 && Y1 < sBY) {
        if (sLX < X && X < sRX) {
          console.log('1) X inside & Y1 inside of Source-> P2, P1 null');
          P1 = null; P2 = null;
          P3 = { x: X, y: sCY2 }; link.y = sCY2;
        }
        else {
          console.log('2) X outside & Y1 inside of Source');
          P1 = null; P2 = { x: sCX, y: Y1 };
        }
      }
      else {
        if (sLX < X && X < sRX) {
          console.log('3) X inside & Y1 outside of Source');
          P1 = null; P2 = { x: X, y: sCY2 };
        }
        else {
          console.log('4) X outside & Y1 outside of Source');
          P1 = { x: sX, y: sCY1 }; P2 = { x: sX, y: Y1 };
        }
      }
      // target
      if (tTY < Y2 && Y2 < tBY) {
        if (tLX < X && X < tRX) {
          console.log('5) X inside & Y2 inside of Target -> P5, P6 null');
          P6 = null; P5 = null; P4 = { x: X, y: tCY1 }; link.y = tCY1;
        }
        else {
          console.log('6) X outside & Y2 inside of Target');
          P6 = null; P5 = { x: tCX, y: Y2 };
        }
      }
      else {
        if (tLX < X && X < tRX) {
          console.log('7) X inside & Y2 outside of Target');
          P5 = { x: X, y: tCY2 }; P6 = null;
        }
        else {
          console.log('8) X outside & Y2 outside of Target');
          P5 = { x: tX, y: Y2 }; P6 = { x: tX, y: tCY2 };
        }
      }
      // points
      let x1, y1, x2, y2, x3, y3, x4, y4, x5, y5, x6, y6,
        xa, ya, xb, yb, xc, yc, xd, yd, xe, ye, xf, yf, xg, yg, xh, yh;
      if (P1) {
        x1 = P1.x; y1 = P1.y; x2 = P2.x; y2 = P2.y; x3 = P3.x; y3 = P3.y;
        // (xa,ya)
        xa = x2;
        if (Math.abs(y2 - y1) > ROUND) {
          ya = y2 - Math.sign(y2 - y1) * ROUND;
        }
        else { ya = y1; }
        // (xb,yb)
        if (Math.abs(x3 - x2) > 2 * ROUND) {
          xb = x2 + Math.sign(x3 - x2) * ROUND;
        }
        else { xb = (x2 + x3) / 2; }
        yb = y2;
      }
      if (P2) {
        x2 = P2.x; y2 = P2.y; x3 = P3.x; y3 = P3.y; x4 = P4.x; y4 = P4.y;
        // (xc,yc)
        if (P1 && Math.abs(x3 - x2) > 2 * ROUND || Math.abs(x3 - x2) > ROUND) {
          xc = x3 - Math.sign(x3 - x2) * ROUND;
        }
        else { xc = P1 && (x2 + x3) / 2 || x2; }
        yc = y3;
        // (xd,yd)
        xd = x3;
        if (Math.abs(y4 - y3) > 2 * ROUND) {
          yd = y3 + Math.sign(y4 - y3) * ROUND;
        }
        else { yd = (y3 + y4) / 2; }
      }
      if (P5) {
        x3 = P3.x; y3 = P3.y; x4 = P4.x; y4 = P4.y; x5 = P5.x; y5 = P5.y;
        // (xe,ye)
        xe = x4;
        if (Math.abs(y4 - y3) > 2 * ROUND) {
          ye = y4 - Math.sign(y4 - y3) * ROUND;
        }
        else { ye = (y3 + y4) / 2; }
        // (xf,yf)
        if (P6 && Math.abs(x5 - x4) > 2 * ROUND || Math.abs(x5 - x4) > ROUND) {
          xf = x4 + Math.sign(x5 - x4) * ROUND;
        }
        else { xf = P6 && (x4 + x5) / 2 || x5; }
        yf = y4;
      }
      if (P6) {
        x4 = P4.x; y4 = P4.y; x5 = P5.x; y5 = P5.y; x6 = P6.x; y6 = P6.y;
        // (xg,yg)
        if (Math.abs(x5 - x4) > 2 * ROUND) {
          xg = x5 - Math.sign(x5 - x4) * ROUND;
        }
        else { xg = (x4 + x5) / 2; }
        yg = y5;
        // (xh,yh)
        xh = x5;
        if (Math.abs(y6 - y5) > ROUND) {
          yh = y5 + Math.sign(y6 - y5) * ROUND;
        }
        else { yh = y6; }
      }
      // pathString
      if (P1) {
        if (P6) {
          console.log('*1* MP1-LPa-Q(P2)Pb-LPc-Q(P3)Pd-VPe-Q(P4)Pf-LPg-Q(P5)Ph-LP6');
          pathString = `M${x1},${y1} L${xa},${ya} Q${x2},${y2} ${xb},${yb} L${xc},${yc} Q${x3},${y3} ${xd},${yd} V${ye}` +
            ` Q${x4},${y4} ${xf},${yf} L${xg},${yg} Q${x5},${y5} ${xh},${yh} L${x6},${y6}`;
        }
        else if (P5) {
          console.log('*2* MP1-LPa-Q(P2)Pb-LPc-Q(P3)Pd-VPe-Q(P4)Pf-LP5');
          pathString = `M${x1},${y1} L${xa},${ya} Q${x2},${y2} ${xb},${yb} L${xc},${yc} Q${x3},${y3} ${xd},${yd} V${ye}` +
            ` Q${x4},${y4} ${xf},${yf} L${x5},${y5}`;
        }
        else {
          console.log('*3* MP1-LPa-Q(P2)Pb-LPc-Q(P3)Pd-VP4');
          pathString = `M${x1},${y1} L${xa},${ya} Q${x2},${y2} ${xb},${yb} L${xc},${yc} Q${x3},${y3} ${xd},${yd} V${y4}`;
        }
      }
      else if (P2) {
        if (P6) {
          console.log('*4* MP2-LPc-Q(P3)Pd-VPe-Q(P4)Pf-LPg-Q(P5)Ph-LP6');
          pathString = `M${x2},${y2} L${xc},${yc} Q${x3},${y3} ${xd},${yd} V${ye}` +
            ` Q${x4},${y4} ${xf},${yf} L${xg},${yg} Q${x5},${y5} ${xh},${yh} L${x6},${y6}`;
        }
        else if (P5) {
          console.log('*5* MP2-LPc-Q(P3)Pd-VPe-Q(P4)Pf-LP5');
          pathString = `M${x2},${y2} L${xc},${yc} Q${x3},${y3} ${xd},${yd} V${ye}` +
            ` Q${x4},${y4} ${xf},${yf} L${x5},${y5}`;
        }
        else {
          console.log('*6* MP2-LPc-Q(P3)Pd-VP4');
          pathString = `M${x2},${y2} L${xc},${yc} Q${x3},${y3} ${xd},${yd} V${y4}`;
        }
      }
      else {
        if (P6) {
          console.log('*7* MP3-VPe-Q(P4)Pf-LPg-Q(P5)Ph-LP6');
          pathString = `M${x3},${y3} V${ye}` +
            ` Q${x4},${y4} ${xf},${yf} L${xg},${yg} Q${x5},${y5} ${xh},${yh} L${x6},${y6}`;
        }
        else if (P5) {
          console.log('*8* MP3-VPe-Q(P4)Pf-LP5');
          pathString = `M${x3},${y3} V${ye}` +
            ` Q${x4},${y4} ${xf},${yf} L${x5},${y5}`;
        }
        else {
          console.log('*9* P3-P4');
          pathString = `M${x3},${y3} V${y4}`;
        }
      }
      console.log(`${P1
        ? `P1[${Math.round(P1.x)}),${Math.round(P1.y)}]` : ''} ${P2 ? `P2[${Math.round(P2.x)},${Math.round(P2.y)}]` : ''} ${P3 ? `P3[${Math.round(P3.x)},${Math.round(P3.y)}]` : ''} ${P4 ? `P4[${Math.round(P4.x)},${Math.round(P4.y)}]` : ''} ${P5 ? `P5[${Math.round(P5.x)},${Math.round(P5.y)}]` : ''} ${P6 ? `P6[${Math.round(P6.x)},${Math.round(P6.y)}]` : ''}`);
      // console.log(pathString);
      return pathString;
    } // END updatePointsH()

    if (link && sPos && tPos) {
      let Diff = 2;
      if (points && move && (isFinite(move.y) || isFinite(move.x) || isFinite(move.y2))) {
        console.log('-- move horizontal link');
        P2 = points.P2; P3 = points.P3; P4 = points.P4; P5 = points.P5;
        X = P3.x; Y1 = P3.y; Y2 = P4.y;
        link.x = X; link.y = Y1; link.y2 = Y2;
        if (isFinite(move.x)) {
          dx = move.x;
          console.log(`-- M0 move x ${dx}`);
          X += dx;
          P3.x = X; P4.x = X; link.x = X;
          if ((sLX - Diff < X && X < sLX) || (sRX < X && X < sRX + Diff)) {
            console.log('-- M0 X on border of Source');
            P3.y = sY; link.y = sY;
          }
          else if ((tLX - Diff < X && X < tLX) || (tRX < X && X < tRX + Diff)) {
            console.log('-- M0 X on border of Target');
            P4.y = tY; link.y2 = tY;
          }
        }
        else if (isFinite(move.y)) {
          dy = move.y;
          console.log(`-- M1 move y ${dy}`);
          Y1 += dy;
          P3.y = Y1; link.y = Y1;
        }
        else if (isFinite(move.y2)) {
          dy2 = move.y2;
          console.log(`-- M2 move y2 ${dy2}`);
          Y2 += dy2;
          P4.y = Y2; link.y2 = Y2;
        }
        else {
          return {
            link: link,
            points: {
              P1: P1, P2: P2, P3: P3, P4: P4, P5: P5, P6: P6
            },
            pathString: null
          };
        }
        // update points
        pathString = updatePointsH(P3, P4);
      }
      else {
        console.log('move source/target');
        X = link.x; Y = link.y; Y2 = link.y2;
        P3 = { x: X, y: Y }; P4 = { x: X, y: Y2 };
        pathString = updatePointsH(P3, P4);
      }
    }
    return {
      link: link,
      points: {
        P1: P1, P2: P2, P3: P3, P4: P4, P5: P5, P6: P6
      },
      pathString: pathString
    };
  }

  function hierarchyPathV(link, sPos, tPos, points, move) {
    let sX = sPos.x, sY = sPos.y, sTY = sPos.TY, sRX = sPos.RX, sBY = sPos.BY, sLX = sPos.LX,
      tX = tPos.x, tY = tPos.y, tTY = tPos.TY, tRX = tPos.RX, tBY = tPos.BY, tLX = tPos.LX,
      X1, X2, Y, sCY, tCY,
      dy, dx, dx2, pathString;
    function updatePointsV(P3, P4) {
      X1 = P3.x; Y = P3.y; X2 = P4.x;
      if (!X2) {
        X1 = sX; X2 = tX;
        P3.x = X1; P4.x = X2;
      }
      sCX1 = nearest(X1, sLX, sRX); sCX2 = nearest(X2, sLX, sRX);
      tCX1 = nearest(X1, tLX, tRX); tCX2 = nearest(X2, tLX, tRX);
      sCY = nearest(Y, sTY, sBY); tCY = nearest(Y, tTY, tBY);
      // adjust position
      const rgx = /^([TRBL])([-+]?\d+)$/;
      if (link.source_position) {
        let match = link.source_position.match(rgx);
        if (match) {
          value = +match[2];
          switch (match[1]) {
            case 'T': sX += GRID * value; break;
            case 'B': sX += GRID * value; break;
            case 'R': sY += GRID * value; break;
            case 'L': sY += GRID * value; break;
          }
        }
      }
      if (link.target_position) {
        let match = link.target_position.match(rgx);
        if (match) {
          value = +match[2];
          switch (match[1]) {
            case 'T': tX += GRID * value; break;
            case 'B': tX += GRID * value; break;
            case 'R': tY += GRID * value; break;
            case 'L': tY += GRID * value; break;
          }
        }
      }
      // update points
      if (sLX < X1 && X1 < sRX) {
        if (sTY < Y && Y < sBY) {
          console.log('1) Y inside & X1 inside of Source -> P2, P1 null');
          P1 = null; P2 = null;
          P3 = { x: sCX2, y: Y }; link.x = sCX2;
        }
        else {
          console.log('2) Y outside & X1 inside of Source');
          P1 = null; P2 = { x: X1, y: sCY };
        }
      }
      else {
        if (sTY < Y && Y < sBY) {
          console.log('3) Y inside & X1 outside of Source');
          P1 = null; P2 = { x: sCX2, y: Y };
        }
        else {
          console.log('4) Y outside & X1 outside of Source');
          P1 = { x: sCX1, y: sY }; P2 = { x: X1, y: sY };
        }
      }
      if (tLX < X2 && X2 < tRX) {
        if (tTY < Y && Y < tBY) {
          console.log('5) Y inside & X2 inside of Target -> P5, P6 null');
          P6 = null; P5 = null; P4 = { x: tCX1, y: Y }; link.x = tCX1;
        }
        else {
          console.log('6) Y outside & X2 inside of Target');
          P5 = { x: X2, y: tCY }; P6 = null;
        }
      }
      else {
        if (tTY < Y && Y < tBY) {
          console.log('7) Y inside & X2 outside of Target');
          P5 = { x: tCX2, y: Y }; P6 = null;
        }
        else {
          console.log('8) Y outside & X2 outside of Target');
          P5 = { x: X2, y: tY }; P6 = { x: tCX2, y: tY };
        }
      }
      // pathString
      let x1, y1, x2, y2, x3, y3, x4, y4, x5, y5, x6, y6,
        xa, ya, xb, yb, xc, yc, xd, yd, xe, ye, xf, yf, xg, yg, xh, yh;
      // points
      if (P1) {
        x1 = P1.x; y1 = P1.y; x2 = P2.x; y2 = P2.y; x3 = P3.x; y3 = P3.y;
        // (xa,ya)
        if (Math.abs(x2 - x1) > ROUND) {
          xa = x2 - Math.sign(x2 - x1) * ROUND;
        }
        else { xa = x1; }
        ya = y2;
        // (xb,yb)
        xb = x2;
        if (Math.abs(y3 - y2) > 2 * ROUND) {
          yb = y2 + Math.sign(y3 - y2) * ROUND;
        }
        else { yb = (y2 + y3) / 2; }
      }
      if (P2) {
        x2 = P2.x; y2 = P2.y; x3 = P3.x; y3 = P3.y; x4 = P4.x; y4 = P4.y;
        // (xc,yc)
        xc = x3;
        if (P1 && Math.abs(y3 - y2) > 2 * ROUND || Math.abs(y3 - y2) > ROUND) {
          yc = y3 - Math.sign(y3 - y2) * ROUND;
        }
        else { yc = P1 && (y2 + y3) / 2 || y2; }
        // (xd,yd)
        if (Math.abs(x4 - x3) > 2 * ROUND) {
          xd = x3 + Math.sign(x4 - x3) * ROUND;
        }
        else { xd = (x3 + x4) / 2; }
        yd = y3;
      }
      if (P5) {
        x3 = P3.x; y3 = P3.y; x4 = P4.x; y4 = P4.y; x5 = P5.x; y5 = P5.y;
        // (xe,ye)
        if (Math.abs(x4 - x3) > 2 * ROUND) {
          xe = x4 - Math.sign(x4 - x3) * ROUND;
        }
        else { xe = (x3 + x4) / 2; }
        ye = y4;
        // (xf,yf)
        xf = x4;
        if (P6 && Math.abs(y5 - y4) > 2 * ROUND || Math.abs(y5 - y4) > ROUND) {
          yf = y4 + Math.sign(y5 - y4) * ROUND;
        }
        else { yf = P6 && (y4 + y5) / 2 || y5; }
      }
      if (P6) {
        x4 = P4.x; y4 = P4.y; x5 = P5.x; y5 = P5.y; x6 = P6.x; y6 = P6.y;
        // (xg,yg)
        xg = x5;
        if (Math.abs(y5 - y4) > 2 * ROUND) {
          yg = y5 - Math.sign(y5 - y4) * ROUND;
        }
        else { yg = (y4 + y5) / 2; }
        // (xh,yh)
        if (Math.abs(x6 - x5) > ROUND) {
          xh = x5 + Math.sign(x6 - x5) * ROUND;
        }
        else { xh = x6; }
        yh = y5;
      }
      // pathString
      if (P1) {
        if (P6) {
          console.log('*1* MP1-LPa-Q(P2)Pb-LPc-Q(P3)Pd-HPe-Q(P4)Pf-LPg-Q(P5)Ph-LP6');
          pathString = `M${x1},${y1} L${xa},${ya} Q${x2},${y2} ${xb},${yb} L${xc},${yc} Q${x3},${y3} ${xd},${yd} H${xe}` +
            ` Q${x4},${y4} ${xf},${yf} L${xg},${yg} Q${x5},${y5} ${xh},${yh} L${x6},${y6}`;
        }
        else if (P5) {
          console.log('*2* MP1-LPa-Q(P2)Pb-LPc-Q(P3)Pd-HPe-Q(P4)Pf-LP5');
          pathString = `M${x1},${y1} L${xa},${ya} Q${x2},${y2} ${xb},${yb} L${xc},${yc} Q${x3},${y3} ${xd},${yd} H${xe}` +
            ` Q${x4},${y4} ${xf},${yf} L${x5},${y5}`;
        }
        else {
          console.log('*3* MP1-LPa-Q(P2)Pb-LPc-Q(P3)Pd-HP4');
          pathString = `M${x1},${y1} L${xa},${ya} Q${x2},${y2} ${xb},${yb} L${xc},${yc} Q${x3},${y3} ${xd},${yd} H${x4}`;
        }
      }
      else if (P2) {
        if (P6) {
          console.log('*4* MP2-LPc-Q(P3)Pd-HPe-Q(P4)Pf-LPg-Q(P5)Ph-LP6');
          pathString = `M${x2},${y2} L${xc},${yc} Q${x3},${y3} ${xd},${yd} H${xe}` +
            ` Q${x4},${y4} ${xf},${yf} L${xg},${yg} Q${x5},${y5} ${xh},${yh} L${x6},${y6}`;
        }
        else if (P5) {
          console.log('*5* MP2-LPc-Q(P3)Pd-HPe-Q(P4)Pf-LP5');
          pathString = `M${x2},${y2} L${xc},${yc} Q${x3},${y3} ${xd},${yd} H${xe}` +
            ` Q${x4},${y4} ${xf},${yf} L${x5},${y5}`;
        }
        else {
          console.log('*6* MP2-LPc-Q(P3)Pd-HP4');
          pathString = `M${x2},${y2} L${xc},${yc} Q${x3},${y3} ${xd},${yd} H${x4}`;
        }
      }
      else {
        if (P6) {
          console.log('*7* MP3-HPe-Q(P4)Pf-LPg-Q(P5)Ph-LP6');
          pathString = `M${x3},${y3} H${xe}` +
            ` Q${x4},${y4} ${xf},${yf} L${xg},${yg} Q${x5},${y5} ${xh},${yh} L${x6},${y6}`;
        }
        else if (P5) {
          console.log('*8* MP3-HPe-Q(P4)Pf-LP5');
          pathString = `M${x3},${y3} H${xe}` +
            ` Q${x4},${y4} ${xf},${yf} L${x5},${y5}`;
        }
        else {
          console.log('*9* P3-P4');
          pathString = `M${x3},${y3} H${x4}`;
        }
      }
      console.log(`${P1 ? `P1[${Math.round(P1.x)}),${Math.round(P1.y)}]` : ''} ${P2 ? `P2[${Math.round(P2.x)},${Math.round(P2.y)}]` : ''} ${P3 ? `P3[${Math.round(P3.x)},${Math.round(P3.y)}]` : ''} ${P4 ? `P4[${Math.round(P4.x)},${Math.round(P4.y)}]` : ''} ${P5 ? `P5[${Math.round(P5.x)},${Math.round(P5.y)}]` : ''} ${P6 ? `P6[${Math.round(P6.x)},${Math.round(P6.y)}]` : ''}`);
      // console.log(pathString);
      return pathString;
    }

    if (link && sPos && tPos) {
      let Diff = 2;
      if (points && move && (isFinite(move.y) || isFinite(move.x) || isFinite(move.x2))) {
        console.log('-- move vertical link');
        P2 = points.P2; P3 = points.P3; P4 = points.P4; P5 = points.P5;
        X1 = P3.x; Y = P3.y; X2 = P4.x;
        link.x = X1; link.y = Y; link.x2 = X2;
        if (isFinite(move.y)) {
          dy = move.y;
          console.log(`-- M0 move y ${dy}`);
          Y += dy;
          P3.y = Y; P4.y = Y; link.y = Y;
          if ((sTY - Diff < Y && Y < sTY) || (sBY < Y && Y < sBY + Diff)) {
            console.log('-- M0 Y on border of Source');
            P3.x = sX; link.x = sX;
          }
          else if ((tTY - Diff < Y && Y < tTY) || (tBY < Y && Y < tBY + Diff)) {
            console.log('-- M0 Y on border of Target');
            P4.x = tX; link.x2 = tX;
          }
        }
        else if (isFinite(move.x)) {
          dx = move.x;
          console.log(`-- M1 move x ${dx}`);
          X1 += dx;
          P3.x = X1; link.x = X1;
        }
        else if (isFinite(move.x2)) {
          dx2 = move.x2;
          console.log(`-- M2 move x2 ${dx2}`);
          X2 += dx2;
          P4.x = X2; link.x2 = X2;
        }
        else {
          return {
            link: link,
            points: {
              P1: P1, P2: P2, P3: P3, P4: P4, P5: P5, P6: P6
            },
            pathString: null
          };
        }
        // update points
        pathString = updatePointsV(P3, P4);
      }
      else {
        console.log('move source/target');
        X = link.x; Y = link.y; X2 = link.x2;
        P3 = { x: X, y: Y }; P4 = { x: X2, y: Y };
        pathString = updatePointsV(P3, P4);
      }
    }
    return {
      link: link,
      points: {
        P1: P1, P2: P2, P3: P3, P4: P4, P5: P5, P6: P6
      },
      pathString: pathString
    };
  }

  hierarchyLink2 = function (link, move, points) {
    if (!link || !link.visible ||
      'NORMAL' === link.shape ||
      'simulation' === graph.mode) {
      return null;
    }

    let id = link.id,
      label = link.label,
      shape = link.shape,
      color = link.style.line.color || '#c0c0c0',
      size = link.style.line.width || 2,
      font = link.style.font,
      font_family = (font && font.family) || 'Arial',
      font_size = (font && font.size) || '10pt',
      font_color = (font && font.color) || '#303030';

    let source = getLinkStartNode(link),
      target = getLinkEndNode(link);

    if (!source || !target) {
      return null;
    }

    let sPos = featurePoints(source),
      tPos = featurePoints(target),
      startPos = getStartPosition(link),
      endPos = getEndPosition(link),
      match,
      value,
      rgx = /^([TRBL])([-+]?\d+)$/;

    if (startPos) {
      match = String(startPos).match(rgx);
      if (match) {
        value = +match[2];
        switch (match[1]) {
          case 'T':
          case 'B':
            sPos.x += GRID * value;
            break;
          case 'R':
          case 'L':
            sPos.y += GRID * value;
            break;
        }
      }
    }

    if (endPos) {
      match = String(endPos).match(rgx);
      if (match) {
        value = +match[2];
        switch (match[1]) {
          case 'T':
          case 'B':
            tPos.x += GRID * value;
            break;
          case 'R':
          case 'L':
            tPos.y += GRID * value;
            break;
        }
      }
    }

    let hierarchyPath = null,
      pathString = '';

    if ('HORIZONTAL2' === shape) {
      if (move && (isFinite(move.y) || isFinite(move.x) || isFinite(move.y2)) && points) {
        hierarchyPath = hierarchyPathH(link, sPos, tPos, points, move);
      } else {
        hierarchyPath = hierarchyPathH(link, sPos, tPos);
      }
    }
    else if ('VERTICAL2' === shape) {
      if (move && (isFinite(move.y) || isFinite(move.x) || isFinite(move.x2)) && points) {
        hierarchyPath = hierarchyPathV(link, sPos, tPos, points, move);
      } else {
        hierarchyPath = hierarchyPathV(link, sPos, tPos);
      }
    }
    else {
      return null;
    }

    if (!hierarchyPath) {
      return null;
    }

    link = hierarchyPath.link;
    pathString = hierarchyPath.pathString;

    let d3link = d3.select(`g.link#${id}`);
    if (!pathString) {
      d3link.remove();
      return link;
    }

    link.routing = link.routing || {};
    link.routing.path = pathString;

    // runtime mirror
    link.path = pathString;

    util.appendById(graph.links, link);

    if (!d3link || !d3link.node()) {
      d3link = d3.select(`g#${state.canvasId}`).append('g')
        .attr('id', link.id)
        .attr('class', 'link')
        .datum(link)
        .on('mouseover', function (d) {
          clearTimeout(state.menuTimer);
          menu.openContextMenu({ link: d, position: getEventContextPoint() });
        })
        .on('mouseout', function () {
          d3.event.preventDefault();
          clearTimeout(state.menuTimer);
          state.menuTimer = setTimeout(function () {
            menu.closeContextMenu();
          }, MENU_TIMEOUT);
        });
    }

    if (label) {
      const lx = (isFinite(link.x) ? link.x : (sPos.x + tPos.x) / 2);
      const ly = (isFinite(link.y) ? link.y : (sPos.y + tPos.y) / 2);
      renderLinkLabel(d3link, link, lx, ly);
    }

    let linkEl = document.getElementById(id),
      pathEl = linkEl && linkEl.querySelector('path.Path');

    if (!pathEl) {
      let d3path = d3link.append('path')
        .attr('class', 'Path')
        .attr('fill', 'none')
        .attr('opacity', 1)
        .attr('stroke', color)
        .attr('stroke-width', size);

      let strokedash = strokeDasharrayForLineKind(link.style.line.kind, size);
      if (strokedash) {
        d3path.attr('stroke-dasharray', strokedash);
      }

      pathEl = linkEl && linkEl.querySelector('path.Path');
    }

    if (!pathEl) {
      return link;
    }

    pathEl.setAttribute('d', link.routing.path);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', color);
    pathEl.setAttribute('stroke-width', size);
    let strokedash = strokeDasharrayForLineKind(link.style.line.kind, size);
    if (strokedash) {
      pathEl.setAttribute('stroke-dasharray', strokedash);
    }
    else {
      pathEl.removeAttribute('stroke-dasharray');
    }

    applyLinkMarkers(d3link, link, pathEl, color, size);

    return link;
  };

  /**
   * renderLink
   *
   * 通常 link と pseudo group link を同じ描画入口で扱う。
   *
   * - topicGroup は pseudo link として graph.links に載せる。
   * - これにより、group 軸を draw 側 overlay ではなく model 側の link 描画として一元管理できる。
   * - menu / hover / drag も link 経由で扱えるため、groupOverlay 依存を減らしやすい。
   */
  renderLink = function (link) {
    if (!link || !link.visible) {
      return null;
    }

    if (isTopicGroupPseudoLink(link)) {
      return renderTopicGroupLink(link);
    }

    if (isTimelineGroupPseudoLink(link)) {
      return renderTimelineGroupLink(link);
    }

    var id = link.id,
      label = link.label || '',
      color = link.style.line.color || '#c0c0c0',
      size = link.style.line.width || 2,
      font = link.style.font || {},
      font_family = font.family || 'Arial',
      font_size = font.size || '10pt',
      font_color = font.color || '#303030',
      intersections = [],
      ref1 = 16,
      ref2 = 4,
      overlays1,
      overlays2,
      mid,
      points,
      rgx = /^([TRBL])([-+]?\d+)$/,
      INC = 4;

    var routing = (link.routing && typeof link.routing === 'object') ? link.routing : (link.routing = {});
    var startPosition = routing.startPosition || '';
    var endPosition = routing.endPosition || '';

    var source = findNodeById(link.from),
      target = findNodeById(link.to);

    if (!source || !target) {
      return null;
    }

    function getNodeGeometry(node) {
      var pos = util.getPosition(node),
        shape = node.shape,
        size = node.size || {},
        radius = +size.radius,
        width = +size.width,
        height = +size.height;

      return {
        x: pos.x,
        y: pos.y,
        shape: shape,
        radius: radius,
        width: width,
        height: height
      };
    }

    function pushAnchorByPosition(positionText, geom) {
      var match, base, diff, x, y;

      if (!positionText) {
        return false;
      }

      match = String(positionText).match(rgx);
      if (!match) {
        return false;
      }

      base = match[1];
      diff = +match[2];

      switch (base) {
        case 'T':
          x = geom.x + diff * INC;
          y = geom.y - ((geom.radius) || (geom.height / 2));
          break;
        case 'R':
          x = geom.x + ((geom.radius) || (geom.width / 2));
          y = geom.y + diff * INC;
          break;
        case 'B':
          x = geom.x + diff * INC;
          y = geom.y + ((geom.radius) || (geom.height / 2));
          break;
        case 'L':
          x = geom.x - ((geom.radius) || (geom.width / 2));
          y = geom.y + diff * INC;
          break;
        default:
          return false;
      }

      intersections.push({ x: x, y: y });
      return true;
    }

    function intersectNodeBoundary(geom, path, isSource) {
      var shape, overlays;

      switch (geom.shape) {
        case 'RECTANGLE':
        case 'ROUNDED':
        case 'THUMBNAIL':
        case 'MEMO':
          shape = newShape('rect', {
            x: geom.x - geom.width / 2,
            y: geom.y - geom.height / 2,
            width: geom.width,
            height: geom.height
          });
          overlays = intersect(shape, path);
          break;

        case 'ELLIPSE':
          shape = newShape('ellipse', {
            cx: geom.x,
            cy: geom.y,
            rx: geom.width / 2,
            ry: geom.height / 2
          });
          overlays = intersect(shape, path);
          break;

        case 'CIRCLE':
          shape = newShape('circle', {
            cx: geom.x,
            cy: geom.y,
            r: geom.radius
          });
          overlays = intersect(shape, path);
          break;

        case 'TRIANGLE':
          shape = newShape('rect', {
            x: geom.x - geom.width / 2,
            y: geom.y - 2 * geom.height / 3,
            width: geom.width,
            height: geom.height
          });
          overlays = intersect(shape, path);
          break;

        case 'RHOMBUS':
          shape = newShape('ellipse', {
            cx: geom.x,
            cy: geom.y,
            rx: geom.width / 2,
            ry: geom.height / 2
          });
          overlays = intersect(shape, path);
          break;

        default:
          shape = newShape('rect', {
            x: geom.x - geom.width / 2,
            y: geom.y - geom.height / 2,
            width: geom.width,
            height: geom.height
          });
          overlays = intersect(shape, path);
          break;
      }

      if (overlays && overlays.points && overlays.points.length > 0) {
        intersections.push(overlays.points[0]);
      } else {
        intersections.push({ x: mid.x, y: mid.y });
      }

      if (isSource) {
        overlays1 = overlays;
      } else {
        overlays2 = overlays;
      }
    }

    var sGeom = getNodeGeometry(source),
      tGeom = getNodeGeometry(target),
      sX = sGeom.x,
      sY = sGeom.y,
      tX = tGeom.x,
      tY = tGeom.y;

    mid = {
      x: (sX + tX) / 2,
      y: (sY + tY) / 2
    };

    // runtime only
    var isStraight = (typeof link.straight === 'boolean')
      ? link.straight
      : !/\sQ/.test(String(routing.path || ''));

    if (isStraight) {
      link.x = mid.x;
      link.y = mid.y;
      points = [
        { x: sX, y: sY },
        { x: tX, y: tY }
      ];
    } else {
      mid = {
        x: (typeof link.x === 'number') ? link.x : mid.x,
        y: (typeof link.y === 'number') ? link.y : mid.y
      };
      points = [
        { x: sX, y: sY },
        { x: mid.x, y: mid.y },
        { x: tX, y: tY }
      ];
    }

    var rawPathString = points2pathString(points);
    var rawPath = newShape('path', { d: rawPathString });

    if (!pushAnchorByPosition(startPosition, sGeom)) {
      intersectNodeBoundary(sGeom, rawPath, true);
    }

    if (!pushAnchorByPosition(endPosition, tGeom)) {
      intersectNodeBoundary(tGeom, rawPath, false);
    }

    var pathString = '';
    if (isStraight) {
      pathString = `M${intersections[0].x},${intersections[0].y} L${intersections[1].x},${intersections[1].y}`;
      link.x = Math.round((intersections[0].x + intersections[1].x) / 2);
      link.y = Math.round((intersections[0].y + intersections[1].y) / 2);
    } else {
      points = [
        { x: intersections[0].x, y: intersections[0].y },
        { x: mid.x, y: mid.y },
        { x: intersections[1].x, y: intersections[1].y }
      ];
      pathString = points2pathString(points);
      if (!pathString) {
        return null;
      }
    }

    routing.path = pathString;

    // runtime mirror
    link.path = pathString;

    util.appendById(graph.links, link);

    let d3link = d3.select(`g.link#${id}`);
    if (!d3link || !d3link.node()) {
      d3link = d3.select(`g#${state.canvasId}`).append('g')
        .attr('id', link.id)
        .attr('class', 'link')
        .datum(link)
        .on('mouseover', function (d) {
          clearTimeout(state.menuTimer);
          menu.openContextMenu({ link: d, position: getEventContextPoint() });
        })
        .on('mouseout', function () {
          d3.event.preventDefault();
          clearTimeout(state.menuTimer);
          state.menuTimer = setTimeout(function () {
            menu.closeContextMenu();
          }, MENU_TIMEOUT);
        })
        .call(d3.drag()
          .on('start', Link.prototype.dragstarted)
          .on('drag', Link.prototype.dragged)
          .on('end', Link.prototype.dragended));
    }

    d3link.call(d3.drag()
      .on('start', Link.prototype.dragstarted)
      .on('drag', Link.prototype.dragged)
      .on('end', Link.prototype.dragended));

    let linkEl = document.getElementById(id),
      pathEl = linkEl && linkEl.querySelector('path.Path');

    if (!pathEl) {
      let d3path = d3link.append('path')
        .attr('class', 'Path')
        .attr('fill', 'none')
        .attr('opacity', 1)
        .attr('stroke', color)
        .attr('stroke-width', size);

      let strokedash = strokeDasharrayForLineKind(link.style.line.kind, size);
      if (strokedash) {
        d3path.attr('stroke-dasharray', strokedash);
      }

      pathEl = linkEl && linkEl.querySelector('path.Path');
    }

    if (!pathEl) {
      return link;
    }

    pathEl.setAttribute('d', routing.path);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', color);
    pathEl.setAttribute('stroke-width', size);
    let strokedash = strokeDasharrayForLineKind(link.style.line.kind, size);
    if (strokedash) {
      pathEl.setAttribute('stroke-dasharray', strokedash);
    }
    else {
      pathEl.removeAttribute('stroke-dasharray');
    }

    applyLinkMarkers(d3link, link, pathEl, color, size);

    if (label) {
      renderLinkLabel(d3link, link, link.x, link.y);
    }

    return link;
  };

  /**
   * group hover menu を開いてよいか判定する。
   *
   * 開かない条件:
   * - 現在 drag 中
   * - group drag 中
   * - hover 抑止時間内
   * - マウスボタン押下中
   *
   * hover menu と drag の干渉を減らすためのガードである。
   */
  function canOpenGroupHoverMenu() {
    var e = (d3.event && d3.event.sourceEvent) ? d3.event.sourceEvent : d3.event;

    if (state.dragging || state.groupDragGroupId) {
      return false;
    }
    if (state.hoverLockUntil && Date.now() < state.hoverLockUntil) {
      return false;
    }
    if (e && typeof e.buttons !== 'undefined' && e.buttons !== 0) {
      return false;
    }
    return true;
  }

  /**
   * group hover menu を遅延表示する。
   *
   * 設計意図:
   * - hover 直後に即 menu を開くと、drag 開始前に menu が割り込むことがある。
   * - 短い遅延を入れることで、単なる通過と操作意図を分けやすくする。
   */
  function scheduleGroupHoverMenu(link, position) {
    clearTimeout(state.menuTimer);

    if (!canOpenGroupHoverMenu()) {
      return;
    }

    state.menuTimer = setTimeout(function () {
      if (state.dragging || state.groupDragGroupId) {
        return;
      }

      menu.openContextMenu({
        link: link,
        position: position
      });
    }, 180);
  }

  /**
   * 保留中の group hover menu を取り消す。
   *
   * drag 開始時や hit 領域離脱時に呼び、不要な menu 表示を防ぐ。
   */
  function cancelGroupHoverMenu(closeMenu) {
    clearTimeout(state.menuTimer);
    if (closeMenu && menu && typeof menu.closeContextMenu === 'function') {
      menu.closeContextMenu();
    }
  }

  /**
   * renderTopicGroupLink
   *
   * topicGroup の spine(軸)を pseudo link として描画する。
   *
   * 設計意図:
   * - topicGroup は page.links の通常 link ではなく、page.groups の定義から生成した pseudo link で表す。
   * - 見える軸線と、操作用の hit 線を分離して描画する。
   *
   * 見える軸線:
   * - member node やラベルの前面に出ると視認性を損なうため、背面に描画する。
   *
   * hit 線:
   * - 透明で太い線を前面に置き、drag / hover / context menu の当たり判定だけを受け持つ。
   * - 見た目は背面、操作性は前面、という役割分担にする。
   *
   * hover menu:
   * - hover で即開くと drag と干渉しやすい。
   * - そのため遅延表示にし、drag 中・ボタン押下中・hover 抑止時間中は開かない。
   *
   * node-link-first 方針:
   * - menu には groupOverlay ではなく pseudo link 自体を渡す。
   * - これにより group を通常 link と同じ入口で扱えるようにする。
   */
  function renderTopicGroupLink(link) {
    var page = common.current ? common.current.page : null;
    var group = findGroupById(link.groupRef);
    var spine = resolveGroupSpine(group && group.id);
    var canvas = d3.select('g#' + state.canvasId);
    var gBack, gHit, firstNode;
    var touchState = null;
    var TOUCH_TAP_TOLERANCE = 12;

    function getAxisMidPoint() {
      return {
        x: (spine.x1 + spine.x2) / 2,
        y: (spine.y1 + spine.y2) / 2
      };
    }

    function getTouchPoint(ev) {
      var src = ev;

      if (!src) {
        return null;
      }
      if (src.changedTouches && src.changedTouches.length > 0) {
        src = src.changedTouches[0];
      }
      else if (src.touches && src.touches.length > 0) {
        src = src.touches[0];
      }

      if (!src) {
        return null;
      }

      return {
        x: Number.isFinite(Number(src.clientX)) ? Number(src.clientX) : 0,
        y: Number.isFinite(Number(src.clientY)) ? Number(src.clientY) : 0
      };
    }

    function resetTouchState() {
      touchState = null;
    }

    function openGroupAxisMenu() {
      var pos = getAxisMidPoint();

      window.setTimeout(function () {
        if (state.dragging || state.groupDragGroupId) {
          return;
        }
        cancelGroupHoverMenu(false);
        if (menu && typeof menu.openContextMenu === 'function') {
          menu.openContextMenu({
            link: link,
            position: pos
          });
        }
      }, 0);
    }

    if (!group || !spine) {
      return null;
    }

    firstNode = canvas.select('g.node').node();
    d3.select('g.link#' + link.id + '__back').remove();
    d3.select('g.link#' + link.id).remove();

    // 見える軸線は node より背面
    gBack = firstNode
      ? d3.select(canvas.node().insertBefore(document.createElementNS('http://www.w3.org/2000/svg', 'g'), firstNode))
      : canvas.append('g');

    gBack
      .attr('class', 'link group-link group-link-back')
      .attr('id', link.id + '__back')
      .datum(link);

    gBack.append('line')
      .attr('class', 'group-axis')
      .attr('x1', spine.x1)
      .attr('y1', spine.y1)
      .attr('x2', spine.x2)
      .attr('y2', spine.y2)
      .attr('stroke', (group.spine && group.spine.color) || '#888')
      .attr('stroke-width', (group.spine && group.spine.width) || 6)
      .attr('stroke-linecap', 'round');

    // 操作用 hit 線は前面
    gHit = canvas.append('g')
      .attr('class', 'link group-link group-link-hit')
      .attr('id', link.id)
      .datum(link);

    gHit.append('line')
      .attr('class', 'group-axis-hit')
      .attr('x1', spine.x1)
      .attr('y1', spine.y1)
      .attr('x2', spine.x2)
      .attr('y2', spine.y2)
      .attr('stroke', 'transparent')
      .attr('stroke-width', 20)
      .style('cursor', 'move')
      .style('pointer-events', 'stroke')
      .style('touch-action', 'none')
      .style('-ms-touch-action', 'none')
      .style('-webkit-user-select', 'none')
      .style('-webkit-touch-callout', 'none')
      .style('-webkit-tap-highlight-color', 'transparent')
      .on('mouseover', function () {
        d3.event.preventDefault();
        scheduleGroupHoverMenu(link, getAxisMidPoint());
      })
      .on('mousemove', function () {
        if (!canOpenGroupHoverMenu()) {
          cancelGroupHoverMenu(false);
        }
      })
      .on('mouseout', function () {
        d3.event.preventDefault();
        clearTimeout(state.menuTimer);
        state.menuTimer = setTimeout(function () {
          if (!state.dragging && !state.groupDragGroupId) {
            menu.closeContextMenu();
          }
        }, MENU_TIMEOUT);
      })
      .on('touchstart', function () {
        var ev = d3.event;
        var p = getTouchPoint(ev);

        touchState = {
          start: p,
          moved: false
        };

        cancelGroupHoverMenu(false);

        if (ev && typeof ev.stopPropagation === 'function') {
          ev.stopPropagation();
        }
      })
      .on('touchmove', function () {
        var ev = d3.event;
        var p = getTouchPoint(ev);

        if (!touchState || !touchState.start || !p) {
          return;
        }

        if (Math.abs(p.x - touchState.start.x) > TOUCH_TAP_TOLERANCE ||
          Math.abs(p.y - touchState.start.y) > TOUCH_TAP_TOLERANCE) {
          touchState.moved = true;

          if (ev && typeof ev.preventDefault === 'function') {
            ev.preventDefault();
          }
          if (ev && typeof ev.stopPropagation === 'function') {
            ev.stopPropagation();
          }
        }
      })
      .on('touchend', function () {
        var ev = d3.event;
        var shouldOpen = !!(touchState && !touchState.moved);

        if (shouldOpen) {
          if (ev && typeof ev.preventDefault === 'function') {
            ev.preventDefault();
          }
          if (ev && typeof ev.stopPropagation === 'function') {
            ev.stopPropagation();
          }
        }

        resetTouchState();

        // tap のときだけ menu、move したら drag 優先
        if (shouldOpen) {
          openGroupAxisMenu();
        }
      })
      .on('touchcancel', function () {
        resetTouchState();
      })
      .call(
        d3.drag()
          .on('start', function () { groupDragStarted(group); })
          .on('drag', function () { groupDragged(group); })
          .on('end', function () { groupDragEnded(group); })
      );

    return gHit;
  }

  /**
   * renderTimelineGroupLink
   *
   * timeline axis は page.groups の axis / segments から都度再構成する。
   * page.links に実体 link を持たず、擬似 link と擬似 point を組み合わせて描画する。
   *
   * スマホ対策:
   * - 透明 hit 線を node の前面ではなく背面に置く。
   *   これにより、軸上に重なる Segment node がタップを受けやすくなる。
   * - さらに hit 線自体に touchend を付け、hover が無い環境でも
   *   軸タップで context menu を開けるようにする。
   * - 移動を伴う操作は drag とみなし、tap のときだけ menu を開く。
   */
  function renderTimelineGroupLink(link) {
    var group = findGroupById(link.groupRef);
    var canvas, gBack, gHit, firstNode, hitLine;
    var axis, anchor, start, end, length, orientation, x1, y1, x2, y2;
    var touchState = null;
    var TOUCH_TAP_TOLERANCE = 12;

    function getAxisMidPoint() {
      return {
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2
      };
    }

    function resetTouchState() {
      touchState = null;
    }

    function openAxisMenu() {
      var pos = getAxisMidPoint();
      window.setTimeout(function () {
        if (state.dragging || state.groupDragGroupId) {
          return;
        }
        cancelGroupHoverMenu(false);
        if (menu && typeof menu.openContextMenu === 'function') {
          menu.openContextMenu({
            link: link,
            position: pos
          });
        }
      }, 0);
    }

    function openAxisMenuByTouch() {
      var pos = getAxisMidPoint();

      window.setTimeout(function () {
        if (state.groupDragGroupId) {
          return;
        }
        cancelGroupHoverMenu(false);
        if (menu && typeof menu.openContextMenu === 'function') {
          menu.openContextMenu({
            link: link,
            position: pos
          });
        }
      }, 80);
    }

    if (!group) {
      return null;
    }

    axis = group.axis || {};
    anchor = {
      x: (axis.anchor && Number.isFinite(Number(axis.anchor.x))) ? Number(axis.anchor.x) : ((group.origin && Number.isFinite(Number(group.origin.x))) ? Number(group.origin.x) : 0),
      y: (axis.anchor && Number.isFinite(Number(axis.anchor.y))) ? Number(axis.anchor.y) : ((group.origin && Number.isFinite(Number(group.origin.y))) ? Number(group.origin.y) : 0)
    };
    start = Number.isFinite(Number(group.timeStart)) ? Number(group.timeStart) : Number(axis.start || 0);
    end = Number.isFinite(Number(group.timeEnd)) ? Number(group.timeEnd) : Number(axis.end || start);
    length = Math.max(60, Number(group.length || 480));
    orientation = (group.orientation === 'vertical') ? 'vertical' : 'horizontal';

    x1 = anchor.x;
    y1 = anchor.y;
    x2 = (orientation === 'vertical') ? anchor.x : (anchor.x + length);
    y2 = (orientation === 'vertical') ? (anchor.y + length) : anchor.y;

    canvas = d3.select('g#' + state.canvasId);
    firstNode = canvas.select('g.node').node();
    d3.select('g.link#' + link.id + '__back').remove();
    d3.select('g.link#' + link.id).remove();

    /*
     * 見える軸線は node 背面
     */
    gBack = firstNode
      ? d3.select(canvas.node().insertBefore(document.createElementNS('http://www.w3.org/2000/svg', 'g'), firstNode))
      : canvas.append('g');

    gBack
      .attr('class', 'link timeline-group-link timeline-group-link-back')
      .attr('id', link.id + '__back')
      .datum(link);

    gBack.append('line')
      .attr('class', 'timeline-axis')
      .attr('x1', x1)
      .attr('y1', y1)
      .attr('x2', x2)
      .attr('y2', y2)
      .attr('stroke', (group.spine && group.spine.color) || group.strokeColor || link.style.line.color || '#888')
      .attr('stroke-width', Number((group.spine && group.spine.width) || group.strokeWidth || link.strokeWidth || 6))
      .attr('stroke-linecap', 'round');

    /*
     * hit 線も node 背面へ置く。
     * これで開始 / 中間 / 終端セグメントがタップを取りやすくなる。
     */
    gHit = firstNode
      ? d3.select(canvas.node().insertBefore(document.createElementNS('http://www.w3.org/2000/svg', 'g'), firstNode))
      : canvas.append('g');

    gHit
      .attr('class', 'link timeline-group-link timeline-group-link-hit')
      .attr('id', link.id)
      .datum(link);

    hitLine = gHit.append('line')
      .attr('class', 'timeline-axis-hit')
      .attr('x1', x1)
      .attr('y1', y1)
      .attr('x2', x2)
      .attr('y2', y2)
      .attr('stroke', 'transparent')
      .attr('stroke-width', 20)
      .style('cursor', 'move')
      .style('pointer-events', 'stroke')
      .style('touch-action', 'none')
      .style('-ms-touch-action', 'none')
      .style('-webkit-user-select', 'none')
      .style('-webkit-touch-callout', 'none')
      .style('-webkit-tap-highlight-color', 'transparent')
      .on('mouseover', function () {
        d3.event.preventDefault();
        clearTimeout(state.menuTimer);
        scheduleGroupHoverMenu(link, getAxisMidPoint());
      })
      .on('mousemove', function () {
        if (!canOpenGroupHoverMenu()) {
          cancelGroupHoverMenu(false);
        }
      })
      .on('mouseout', function () {
        d3.event.preventDefault();
        clearTimeout(state.menuTimer);
        state.menuTimer = setTimeout(function () {
          if (!state.dragging && !state.groupDragGroupId) {
            menu.closeContextMenu();
          }
        }, MENU_TIMEOUT);
      })
      .on('touchstart', function () {
        var ev = d3.event;
        var p = getTouchPoint(ev);

        touchState = {
          start: p,
          moved: false
        };

        cancelGroupHoverMenu(false);

        if (ev && typeof ev.stopPropagation === 'function') {
          ev.stopPropagation();
        }
      })
      .on('touchmove', function () {
        var ev = d3.event;
        var p = getTouchPoint(ev);

        if (!touchState || !touchState.start || !p) {
          return;
        }

        if (Math.abs(p.x - touchState.start.x) > TOUCH_TAP_TOLERANCE ||
          Math.abs(p.y - touchState.start.y) > TOUCH_TAP_TOLERANCE) {
          touchState.moved = true;

          if (ev && typeof ev.preventDefault === 'function') {
            ev.preventDefault();
          }
          if (ev && typeof ev.stopPropagation === 'function') {
            ev.stopPropagation();
          }
        }
      })
      .on('touchend', function () {
        var ev = d3.event;
        var shouldOpen = !!(touchState && !touchState.moved);

        if (shouldOpen) {
          if (ev && typeof ev.preventDefault === 'function') {
            ev.preventDefault();
          }
          if (ev && typeof ev.stopPropagation === 'function') {
            ev.stopPropagation();
          }
        }

        resetTouchState();

        if (shouldOpen) {
          openAxisMenuByTouch();
        }
      })
      .on('touchcancel', function () {
        resetTouchState();
      })
      .call(
        d3.drag()
          .on('start', function () { groupDragStarted(group); })
          .on('drag', function () { groupDragged(group); })
          .on('end', function () { groupDragEnded(group); })
      );

    return gHit;
  }

  // https://bl.ocks.org/mbostock/8027637
  // var m = d3.mouse(this),
  //     p = closestPoint(path.node(), m); // m is mouse point in Context
  closestPoint = function (pathNode, point) {
    if (!pathNode || !point) {
      return null;
    }

    var pathLength = pathNode.getTotalLength(),
      precision = 8,
      best,
      bestLength,
      bestDistance = Infinity;

    function distance2(p) {
      var dx = p.x - point.x,
        dy = p.y - point.y;
      return dx * dx + dy * dy;
    }

    // linear scan for coarse approximation
    for (var scan, scanLength = 0, scanDistance; scanLength <= pathLength; scanLength += precision) {
      if ((scanDistance = distance2(scan = pathNode.getPointAtLength(scanLength))) < bestDistance) {
        best = scan, bestLength = scanLength, bestDistance = scanDistance;
      }
    }

    // binary search for precise estimate
    precision /= 2;
    while (precision > 0.5) {
      var before,
        after,
        beforeLength,
        afterLength,
        beforeDistance,
        afterDistance;
      if ((beforeLength = bestLength - precision) >= 0 && (beforeDistance = distance2(before = pathNode.getPointAtLength(beforeLength))) < bestDistance) {
        best = before, bestLength = beforeLength, bestDistance = beforeDistance;
      }
      else if ((afterLength = bestLength + precision) <= pathLength && (afterDistance = distance2(after = pathNode.getPointAtLength(afterLength))) < bestDistance) {
        best = after, bestLength = afterLength, bestDistance = afterDistance;
      }
      else {
        precision /= 2;
      }
    }

    best = {
      x: best.x,
      y: best.y,
      distance: Math.sqrt(bestDistance)
    };
    return best;
  }

  pathString2points = function (pathString) {
    if (!pathString) {
      return null;
    }
    var points = [];
    var controls = pathString.replace(/\s+/g, ' ').split(' ');
    for (var i = 0; i < controls.length; i++) {
      var control = controls[i];
      if (control) {
        var matched = control.match(/([MQL]?)(-?\d*\.?\d*),(-?\d*\.?\d*)/);
        if (matched) {
          points.push({ code: matched[1], x: matched[2], y: matched[3] });
        }
      }
    }
    return points;
  };

  points2pathString = function (points) {
    var pathString;
    if (points.length > 3) {
      pathString = points.map(function (d) {
        return `${d.code ? d.code : ''}${d.x},${d.y}`;
      }).join(' ');
      return pathString;
    }
    else if (3 === points.length) {
      // points = [[x1, y1], [x, y], [x2, y2]]
      // xC = 2*x - (x1 + x2)/2; yC = 2*y - (y1 + y2)/2;
      // result = M x1 y1 Q xC yC x2 y2
      x1 = +points[0].x;
      y1 = +points[0].y;
      x = +points[1].x;
      y = +points[1].y;
      x2 = +points[2].x;
      y2 = +points[2].y;
      xC = 2 * x - (x1 + x2) / 2;
      yC = 2 * y - (y1 + y2) / 2;
      result = `M${x1},${y1} Q${xC},${yC} ${x2},${y2}`;
      return result;
    }
    else if (2 === points.length) {
      // points = [[x1, y1], [x2, y2]]
      // result = M x1 y1 L x2 y2
      x1 = +points[0].x;
      y1 = +points[0].y;
      x2 = +points[1].x;
      y2 = +points[1].y;
      result = `M${x1},${y1} L${x2},${y2}`;
      return result;
    }
    return null;
  };

  updateLinkCount = function () {
    var nodes,
      node,
      linkCount, d3node, d3linkCount;
    nodes = graph.nodes.filter(function (n) {
      return n.visible && !n.filterout;
    });
    for (node of nodes) {
      linkCount = countHiddenLink(node);
      d3node = d3.select(`g.node#${node.id}`);
      if (d3node && d3node.node()) {
        node.linkCount = linkCount;
        d3linkCount = d3node.select('.link-count');
        if (linkCount > 0) {
          d3linkCount.text(linkCount);
        }
        else {
          d3linkCount.text('');
        }
      }
    }
  };

  cut = function (link) {
    var id;

    if (!link || !link.id) {
      return null;
    }

    id = link.id;
    removeLink(link);
    updateLinkCount();

    return {
      command: 'cut',
      param: {
        link: [{ id: id, type: 'Link' }]
      }
    };
  };

  erase = function (nodes) {
    var
      _nodes = [],
      _links = [];
    for (let node of nodes) {
      var id = node.id, link;
      if (util.isLink(node)) {
        link = node;
        removeLink(link);
        _links.push({ id: id, type: 'Link' });
      }
      else {
        /**
         * node and its links
         */
        _links = findLinksByNode(node).links;
        for (link of _links) {
          removeLink(link);
        }
        removeNode({ id: id });
        _nodes.push({ id: id, type: 'Node' });
      }
    }

    updateLinkCount();

    var logData = {
      command: 'erase',
      param: {
        node: _nodes,
        link: _links
      }
    };
    return logData;
  };

  function isTimelineVisibilityPoint(node) {
    return !!(node && node.type === 'Segment' && node.groupRef);
  }

  function isTimelineVisibilityAxisLink(link) {
    return !!(
      link &&
      link.type === 'Link' &&
      (
        link.linkType === 'timeline-axis' ||
        link.groupType === 'timelineAxis'
      ) &&
      link.groupRef
    );
  }

  function getTimelineVisibilityGroup(target) {
    if (!target) {
      return null;
    }
    if (isTimelineVisibilityPoint(target)) {
      return findGroupById(target.groupRef);
    }
    if (isTimelineVisibilityAxisLink(target)) {
      return findGroupById(target.groupRef);
    }
    return null;
  }

  function getTimelineVisibilityMembers(group) {
    var page = common.current && common.current.page;
    var sourceNodes = (page && page.nodes) ? page.nodes : graph.nodes;
    return (sourceNodes || []).filter(function (node) {
      return node && node.type === 'Segment' && node.groupRef === group.id;
    });
  }

  function getTimelineVisibilityAxisLinks(group) {
    return (graph.links || []).filter(function (link) {
      return isTimelineVisibilityAxisLink(link) && link.groupRef === group.id;
    });
  }

  function setTimelineFamilyVisible(group, visible, nodesBucket, linksBucket, hideConnectedLinks) {
    var changed = false;
    var members, axisLinks, member, linked, visibles, i, j;
    var shown = !!visible;

    nodesBucket = nodesBucket || [];
    linksBucket = linksBucket || [];

    if (!group) {
      return false;
    }

    if (group.visible !== shown) {
      group.visible = shown;
      changed = true;
    }

    members = getTimelineVisibilityMembers(group);
    for (i = 0; i < members.length; i++) {
      member = members[i];
      if (!member) {
        continue;
      }

      visibles = [];
      if (!shown && hideConnectedLinks) {
        visibles = (findLinksByNode(member) || {}).visibles || [];
      }

      if (member.visible !== shown) {
        setNodeShown(member, shown);
        changed = true;
      }
      util.appendById(nodesBucket, member);

      if (!shown && hideConnectedLinks) {
        for (j = 0; j < visibles.length; j++) {
          linked = visibles[j];
          if (!linked) {
            continue;
          }
          if (isTimelineVisibilityAxisLink(linked) && linked.groupRef === group.id) {
            continue;
          }
          if (linked.visible) {
            setLinkShown(linked, false);
            changed = true;
          }
          util.appendById(linksBucket, linked);
        }
      }
    }

    axisLinks = getTimelineVisibilityAxisLinks(group);
    for (i = 0; i < axisLinks.length; i++) {
      if (!axisLinks[i]) {
        continue;
      }
      if (axisLinks[i].visible !== shown) {
        setLinkShown(axisLinks[i], shown);
        changed = true;
      }
      util.appendById(linksBucket, axisLinks[i]);
    }

    return changed;
  }

  function isRegularVisibilityGroup(group) {
    return !!(group &&
      ('simple' === group.type || 'horizontal' === group.type || 'vertical' === group.type));
  }

  function getRegularVisibilityAxisLinks(group) {
    if (!group || !group.id) {
      return [];
    }
    return (graph.links || []).filter(function (link) {
      return isTopicGroupPseudoLink(link) && link.groupRef === group.id;
    });
  }

  function getRegularVisibilityGroup(target) {
    var groups;

    if (!target) {
      return null;
    }

    if (target.groupRef && (
      ('Group' === target.type && 'simple' === target.groupType) ||
      isTopicGroupPseudoLink(target)
    )) {
      return findGroupById(target.groupRef);
    }

    if (util && typeof util.isNode === 'function' && util.isNode(target) && target.id) {
      groups = findGroupsByNodeId(target.id).filter(isRegularVisibilityGroup);
      return groups[0] || null;
    }

    return null;
  }

  function setRegularGroupFamilyVisible(group, visible, nodesBucket, linksBucket, hideConnectedLinks) {
    var changed = false;
    var shown = !!visible;
    var members;
    var axisLinks;
    var memberIds = {};

    nodesBucket = nodesBucket || [];
    linksBucket = linksBucket || [];

    if (!isRegularVisibilityGroup(group)) {
      return false;
    }

    if (group.visible !== shown) {
      group.visible = shown;
      changed = true;
    }

    members = findGroupNodes(group.id);
    members.forEach(function (member) {
      if (!member || !member.id) {
        return;
      }
      memberIds[member.id] = true;
      if (member.visible !== shown) {
        setNodeShown(member, shown);
        changed = true;
      }
      util.appendById(nodesBucket, member);
    });

    members.forEach(function (member) {
      var memberLinks;

      if (!member || !member.id) {
        return;
      }

      memberLinks = (findLinksByNode(member) || {}).links || [];
      memberLinks.forEach(function (link) {
        var other;
        var shouldShow;

        if (!link) {
          return;
        }

        if (!shown && hideConnectedLinks) {
          if (link.visible) {
            setLinkShown(link, false);
            changed = true;
          }
          util.appendById(linksBucket, link);
          return;
        }

        if (shown) {
          other = findOtherNode(link, member);
          shouldShow = !!(other && (other.visible || memberIds[other.id]));
          if (shouldShow) {
            if (!link.visible) {
              setLinkShown(link, true);
              changed = true;
            }
            util.appendById(linksBucket, link);
          }
        }
      });
    });

    axisLinks = getRegularVisibilityAxisLinks(group);
    axisLinks.forEach(function (link) {
      if (!link) {
        return;
      }
      if (link.visible !== shown) {
        setLinkShown(link, shown);
        changed = true;
      }
      util.appendById(linksBucket, link);
    });

    return changed;
  }

  bloom = function (_nodes) {
    var nodes = [],
      links = [],
      node,
      another,
      link,
      newP,
      timelineChanged = false,
      timelineGroup,
      allLinks,
      hidden_links,
      count_link;

    for (node of _nodes) {
      timelineGroup = getTimelineVisibilityGroup(node);
      if (timelineGroup) {
        timelineChanged = setTimelineFamilyVisible(timelineGroup, true, nodes, links, false) || timelineChanged;
        continue;
      }

      if (!util.isNode(node)) {
        return null;
      }

      allLinks = findLinksByNode(node);
      hidden_links = (allLinks && allLinks.hiddens) ? allLinks.hiddens : [];
      count_link = 0;

      for (link of hidden_links) {
        count_link++;
        if (count_link > common.MAX_EXPANDS) {
          break;
        }

        setLinkShown(link, true);
        util.appendById(links, link);

        another = findOtherNode(link, node);
        if (!another) {
          continue;
        }

        timelineGroup = getTimelineVisibilityGroup(another);
        if (timelineGroup) {
          timelineChanged = setTimelineFamilyVisible(timelineGroup, true, nodes, links, false) || timelineChanged;
          continue;
        }

        var regularGroup = getRegularVisibilityGroup(another);
        if (regularGroup) {
          setRegularGroupFamilyVisible(regularGroup, true, nodes, links, false);
          continue;
        }

        if (!another.visible) {
          if ('simulation' === graph.mode) {
            newP = newPosition(node.x, node.y);
            another.x = newP.x;
            another.y = newP.y;
          }
          setNodeShown(another, true);
        }

        util.appendById(nodes, another);
      }
    }

    setGraphFromCurrentPage();

    updateLinkCount();

    return {
      command: 'bloom',
      param: {
        node: nodes,
        link: links
      }
    };
  };

  hide = function (_nodes) {
    var nodes = [],
      links = [],
      node, link, _node, visibles,
      timelineChanged = false,
      timelineGroup,
      j, jlen;

    for (_node of _nodes) {
      timelineGroup = getTimelineVisibilityGroup(_node);
      if (timelineGroup) {
        timelineChanged = setTimelineFamilyVisible(timelineGroup, false, nodes, links, true) || timelineChanged;
        continue;
      }

      var regularGroup = getRegularVisibilityGroup(_node);
      if (regularGroup) {
        setRegularGroupFamilyVisible(regularGroup, false, nodes, links, true);
        continue;
      }

      if (util.isLink(_node)) {
        link = findLinkById(_node.id);
        if (link) {
          setLinkShown(link, false);
          util.appendById(links, link);
        }
      }
      else if (util.isNode(_node)) {
        node = findNodeById(_node.id);
        if (!node) {
          continue;
        }
        setNodeShown(node, false);
        util.appendById(nodes, node);

        visibles = (findLinksByNode(node) || {}).visibles || [];
        jlen = visibles.length;
        for (j = 0; j < jlen; j++) {
          link = visibles[j];
          setLinkShown(link, false);
          util.appendById(links, link);
        }
      }
    }

    setGraphFromCurrentPage();
    updateLinkCount();

    return {
      command: 'hide',
      param: {
        node: nodes,
        link: links
      }
    };
  };

  wilt = function (nodes) {
    var
      trace = false,
      root = nodes && nodes[0],
      nodes_data = [],
      links_data = [],
      timelineChanged = false,
      rootTimelineGroup;

    if (!root) { return; }

    rootTimelineGroup = getTimelineVisibilityGroup(root);
    if (rootTimelineGroup) {
      timelineChanged = setTimelineFamilyVisible(rootTimelineGroup, false, nodes_data, links_data, true) || timelineChanged;
      if (timelineChanged) {
        setGraphFromCurrentPage();
      }
      updateLinkCount();
      return {
        command: 'wilt',
        param: {
          node: nodes_data,
          link: links_data
        }
      };
    }

    if ('Link' === root.type) { return; }

    const hiddenNodeIds = new Set();
    const hiddenLinkIds = new Set();

    const visibleLinks = function (n) {
      const r = findLinksByNode(n);
      const arr = (r && r.visibles) ? r.visibles : [];
      return arr.filter(function (l) {
        return l && l.visible;
      });
    };

    const hideNode = function (n) {
      var timelineGroup = getTimelineVisibilityGroup(n);

      if (timelineGroup) {
        timelineChanged = setTimelineFamilyVisible(timelineGroup, false, nodes_data, links_data, true) || timelineChanged;
        return;
      }

      if (!n || !n.visible) { return; }
      if (hiddenNodeIds.has(n.id)) { return; }
      n.visible = false;
      hiddenNodeIds.add(n.id);
      nodes_data.push(n);
    };

    const hideLink = function (l) {
      var timelineGroup = getTimelineVisibilityGroup(l);

      if (timelineGroup) {
        timelineChanged = setTimelineFamilyVisible(timelineGroup, false, nodes_data, links_data, true) || timelineChanged;
        return;
      }

      if (!l || !l.visible) { return; }
      if (hiddenLinkIds.has(l.id)) { return; }
      l.visible = false;
      hiddenLinkIds.add(l.id);
      links_data.push(l);
    };

    const hideRegularGroupByMember = function (memberNode) {
      var groups, changed;

      if (!memberNode || !memberNode.id) {
        return false;
      }

      groups = findGroupsByNodeId(memberNode.id).filter(function (group) {
        return isRegularVisibilityGroup(group) &&
          false !== group.visible &&
          getGroupNodeIds(group).indexOf(root.id) < 0;
      });
      if (!groups.length) {
        return false;
      }

      changed = false;
      groups.forEach(function (group) {
        changed = setRegularGroupFamilyVisible(group, false, nodes_data, links_data, true) || changed;
      });

      return changed;
    };

    const prune = function (node, parentNode, parentLink, depth, path) {
      if (!node || !node.visible) { return false; }

      if (path.has(node.id)) {
        return false;
      }
      path.add(node.id);

      if (parentLink && hideRegularGroupByMember(node)) {
        path.delete(node.id);
        setGraphFromCurrentPage();
        return true;
      }

      let links = visibleLinks(node);
      for (let l of links) {
        if (parentLink && l.id === parentLink.id) { continue; }
        const other = findOtherNode(l, node);
        if (!other || !other.visible) { continue; }
        if (path.has(other.id)) { continue; }

        prune(other, node, l, depth + 1, path);
      }

      links = visibleLinks(node);

      if (parentLink) {
        if (links.length === 1 && links[0].id === parentLink.id) {
          hideLink(parentLink);
          hideNode(node);
          path.delete(node.id);
          return true;
        }
      }

      path.delete(node.id);
      return false;
    };

    const startLinks = visibleLinks(root);
    const path = new Set([root.id]);

    for (let l of startLinks) {
      const other = findOtherNode(l, root);
      if (!other || !other.visible) { continue; }
      prune(other, root, l, 1, path);
    }

    if (timelineChanged) {
      setGraphFromCurrentPage();
    }
    updateLinkCount();

    return {
      command: 'wilt',
      param: {
        node: nodes_data,
        link: links_data
      }
    };
  };

  root = function (_nodes) {
    var
      root = _nodes[0],
      root_id = root.id,
      nodes = [],
      links = [];
    for (let node of graph.nodes) {
      if (node.visible && root_id !== node.id) {
        node.visible = false;
      }
      else if (root_id === node.id) {
        node.visible = true;
      }
      nodes.push(node);
    }
    for (let link of graph.links) {
      if (link.visible) {
        link.visible = false;
      }
      links.push(link);
    }

    updateLinkCount();

    // log
    var logData = {
      command: 'root',
      param: {
        node: nodes,
        link: links
      }
    };
    return logData;
  };

  forward = function (_nodes) {
    var node = _nodes[0];
    graph.nodes = util.append(graph.nodes, node);
    // log
    var logData = {
      command: 'root',
      param: {
        node: graph.nodes,
        link: graph.links
      }
    };
    return logData;
  };

  backward = function (_nodes) {
    var node = _nodes[0];
    graph.nodes = util.prepend(graph.nodes, node);
    // log
    var logData = {
      command: 'root',
      param: {
        node: graph.nodes,
        link: graph.links
      }
    };
    return logData;
  };

  showAll = function () {
    var
      nodes = [],
      links = [];
    for (let node of graph.nodes) {
      node.visible = true;
      nodes.push(node);
    }
    for (let link of graph.links) {
      link.visible = true;
      links.push(link);
    }
    updateLinkCount();
    // log
    var logData = {
      command: 'showAll',
      param: {
        node: nodes,
        link: links
      }
    };
  }

  copy = function (nodes) {
    // Deprecated legacy copy used resources/idx.
    // Flattened model: nodes carry their own content metadata; copy duplicates nodes only.
    const nodes_ = [];
    const diff = newPosition(0, 0);
    for (const node of nodes) {
      const id = util.createUuid();
      const cloned = util.clone(node);
      cloned.id = id;
      cloned.x = (node.x || 0) + diff.x;
      cloned.y = (node.y || 0) + diff.y;
      nodes_.push(NodeFactory(cloned));
      addNode({ node: cloned });
    }
    return {
      command: 'copy',
      param: { node: nodes_ }
    };
  };

  clipboard = function (nodes) {
    state.copyingNodes = [];
    for (let node of nodes) {
      state.copyingNodes.push(node);
    }
    // log
    var logData = {
      command: 'clipboard',
      param: {
        node: state.copyingNodes
      }
    };
    return logData;
  };

  paste = function () {
    const nodes_ = [];
    const center = getSafeContextPoint();
    const r = 80 * (1 + Math.random());
    const theta = 2 * Math.PI * Math.random();
    const dx = r * Math.cos(theta);
    const dy = r * Math.sin(theta);

    for (const node of (state.copyingNodes || [])) {
      const id = util.createUuid();
      const cloned = util.clone(node);
      cloned.id = id;
      cloned.x = (Number.isFinite(cloned.x) ? cloned.x : center.x) + dx;
      cloned.y = (Number.isFinite(cloned.y) ? cloned.y : center.y) + dy;
      nodes_.push(NodeFactory(cloned));
      addNode({ node: cloned });
    }

    return {
      command: 'paste',
      param: { node: nodes_ }
    };
  }

  clone = function () {
    // Clone is paste with a different command name.
    const result = paste();
    if (result) { result.command = 'clone'; }
    return result;
  }

  setVisible = function (node, visible) {
    if (!node) {
      return;
    }

    var changedItems = [];
    var timelineGroup = getTimelineVisibilityGroup(node);
    var regularGroup = getRegularVisibilityGroup(node);

    if (timelineGroup) {
      setTimelineFamilyVisible(timelineGroup, !!visible, changedItems, changedItems, true);
      setGraphFromCurrentPage();
      return changedItems;
    }

    if (regularGroup) {
      setRegularGroupFamilyVisible(regularGroup, !!visible, changedItems, changedItems, true);
      setGraphFromCurrentPage();
      return changedItems;
    }

    function setVisibleNode(_node, _visible) {
      var visibleLinks, _links;

      if (!_node ||
        util.isLink(_node) ||
        util.contains(changedItems, _node)) {
        return;
      }

      _node.visible = !!_visible;
      util.appendById(changedItems, _node);

      if (!_visible) {
        _links = findLinksByNode(_node);
        visibleLinks = (_links && _links.visibles) ? _links.visibles : [];
        for (let _link of visibleLinks) {
          setVisibleLink(_link, false);
        }
      }
    }

    function setVisibleLink(_link, _visible) {
      var source, target;
      var sourceLinks, targetLinks;
      var sourceVisibleLinks, targetVisibleLinks;

      if (!_link ||
        !util.isLink(_link) ||
        util.contains(changedItems, _link)) {
        return;
      }

      _link.visible = !!_visible;
      util.appendById(changedItems, _link);

      source = _link.from ? findNodeById(_link.from) : null;
      target = _link.to ? findNodeById(_link.to) : null;

      if (_visible) {
        if (source) {
          setVisibleNode(source, true);
        }
        if (target) {
          setVisibleNode(target, true);
        }
        return;
      }

      if (source) {
        sourceLinks = findLinksByNode(source);
        sourceVisibleLinks = (sourceLinks && sourceLinks.visibles)
          ? sourceLinks.visibles.filter(function (l) {
            return l.id !== _link.id;
          })
          : [];
        if (sourceVisibleLinks.length === 0) {
          setVisibleNode(source, false);
        }
      }

      if (target) {
        targetLinks = findLinksByNode(target);
        targetVisibleLinks = (targetLinks && targetLinks.visibles)
          ? targetLinks.visibles.filter(function (l) {
            return l.id !== _link.id;
          })
          : [];
        if (targetVisibleLinks.length === 0) {
          setVisibleNode(target, false);
        }
      }
    }

    if (util.isLink(node)) {
      setVisibleLink(node, visible);
    }
    else {
      setVisibleNode(node, visible);
    }

    return changedItems;
  };

  function getCurrent() {
    return wuwei.common && wuwei.common.current ? wuwei.common.current : common.current;
  }

  function normalizePagesForCurrent(current) {
    if (Array.isArray(current.pages)) {
      current.pages.forEach(function (page, index) {
        if (!page.id && wuwei.util && typeof wuwei.util.createUuid === 'function') {
          page.id = wuwei.util.createUuid();
        }
        page.pp = index + 1;
      });
      return current.pages;
    }
    var pages = [];
    if (current.pages && typeof current.pages === 'object') {
      Object.keys(current.pages).sort(function (a, b) {
        var na = Number(a);
        var nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) { return na - nb; }
        return String(a).localeCompare(String(b));
      }).forEach(function (key, index) {
        var page = current.pages[key];
        if (!page) { return; }
        if (!page.id && wuwei.util && typeof wuwei.util.createUuid === 'function') {
          page.id = wuwei.util.createUuid();
        }
        page.pp = index + 1;
        pages.push(page);
      });
    }
    current.pages = pages;
    return pages;
  }

  function createEmptyPage(pp) {
    return {
      id: (wuwei.util && typeof wuwei.util.createUuid === 'function') ? wuwei.util.createUuid() : ('_' + Date.now()),
      pp: pp || 1,
      name: '',
      description: '',
      nodes: [],
      links: [],
      groups: [],
      transform: { x: 0, y: 0, scale: 1 },
      thumbnail: null
    };
  }

  function getCurrentPage(pageRef) {
    const current = getCurrent() || {};
    const pages = normalizePagesForCurrent(current);
    var ref = (typeof pageRef === 'undefined' || pageRef === null) ? current.currentPage : pageRef;
    var page = null;
    if (!pages.length) {
      pages.push(createEmptyPage(1));
    }
    if (typeof ref === 'string' && ref.charAt(0) === '_') {
      page = pages.find(function (item) { return item && item.id === ref; }) || null;
    }
    if (!page && Number.isFinite(Number(ref))) {
      page = pages[Number(ref) - 1] || pages.find(function (item) { return Number(item && item.pp) === Number(ref); }) || null;
    }
    page = page || pages[0];
    if (!Array.isArray(page.groups)) {
      page.groups = [];
    }
    current.currentPage = page.id;
    current.page = page;
    return current.page;
  }


  function getGroupMemberIdsForTimeline(group) {
    if (!group || !Array.isArray(group.members)) {
      return [];
    }
    return group.members.map(function (member) {
      return (member && member.nodeId) ? member.nodeId : member;
    }).filter(Boolean);
  }

  function relayoutTimelineSegmentNodes(group) {
    var page = getCurrentPage();
    var timeline, axis, start, end, range, length, orientation, anchor;
    var memberIds, members;
    if (!(group && group.type === 'timeline')) {
      return;
    }

    axis = group.axis || {};
    timeline = group.timeline || {};
    start = Number.isFinite(Number(timeline.start)) ? Number(timeline.start) : 0;
    end = Number.isFinite(Number(timeline.end)) ? Number(timeline.end) : start;
    end = Math.max(start, end);
    range = Math.max(end - start, 0.0001);
    length = Math.max(60, Number(group.length || 480));
    orientation = (group.orientation === 'vertical') ? 'vertical' : 'horizontal';
    anchor = {
      x: (axis.anchor && Number.isFinite(Number(axis.anchor.x)))
        ? Number(axis.anchor.x)
        : ((group.origin && Number.isFinite(Number(group.origin.x))) ? Number(group.origin.x) : 0),
      y: (axis.anchor && Number.isFinite(Number(axis.anchor.y)))
        ? Number(axis.anchor.y)
        : ((group.origin && Number.isFinite(Number(group.origin.y))) ? Number(group.origin.y) : 0)
    };

    group.axis = group.axis || {};
    group.axis.anchor = anchor;
    group.axis.start = start;
    group.axis.end = end;
    group.timeStart = start;
    group.timeEnd = end;

    memberIds = getGroupMemberIdsForTimeline(group);
    members = memberIds.map(function (id) { return findNodeById(id); }).filter(function (node) {
      return node && node.type === 'Segment';
    });

    members.sort(function (a, b) {
      var ta = Number(a && a.time && a.time.start);
      var tb = Number(b && b.time && b.time.start);
      ta = Number.isFinite(ta) ? ta : start;
      tb = Number.isFinite(tb) ? tb : start;
      return ta - tb;
    });

    group.members = members.map(function (node, index) {
      return {
        nodeId: node.id,
        order: index + 1,
        role: node.axisRole || 'member'
      };
    });

    members.forEach(function (node, index) {
      var timeStart, timeEnd, ratio;

      node.type = 'Segment';
      node.topicKind = 'timeline-point';
      node.groupRef = group.id;
      node.axisRole = node.axisRole || 'point';

      node.time = (node.time && typeof node.time === 'object') ? node.time : {};

      timeStart = Number(node.time.start);
      timeEnd = Number(node.time.end);

      if (!Number.isFinite(timeStart)) {
        timeStart = start;
      }
      if (!Number.isFinite(timeEnd)) {
        timeEnd = timeStart;
      }

      if (node.axisRole === 'start') {
        timeStart = start;
        timeEnd = start;
      }
      else if (node.axisRole === 'end') {
        timeStart = end;
        timeEnd = end;
      }
      else {
        timeStart = Math.max(start, Math.min(end, timeStart));
        timeEnd = Math.max(timeStart, Math.min(end, timeEnd));
      }

      node.time.start = timeStart;
      node.time.end = timeEnd;

      ratio = (timeStart - start) / range;

      node.x = (orientation === 'vertical')
        ? anchor.x
        : (anchor.x + (length * ratio));

      node.y = (orientation === 'vertical')
        ? (anchor.y + (length * ratio))
        : anchor.y;

      node.fx = node.x;
      node.fy = node.y;
      node.shape = 'CIRCLE';
      node.size = { radius: (node.size && node.size.radius) || 20 };

      node.color = (node.axisRole === 'point') ? Color.nodeFill : '#fff8d8';
      node.outline = (node.axisRole === 'point') ? Color.nodeOutline : '#b08a00';
      node.visible = (false !== node.visible);
      node.changed = true;
      node.order = index + 1;

      if (!node.label) { node.label = formatTime(timeStart); }
      delete node.name;
    });
  }

  function setGraphFromCurrentPage() {
    const current = getCurrent();
    const page = getCurrentPage();
    if (page && wuwei.timeline && typeof wuwei.timeline.normalizeAllAxisGroups === 'function') {
      wuwei.timeline.normalizeAllAxisGroups(page);
    }
    const pseudo = buildGroupPseudoGroups(page);
    if (current && page) {
      current.page = page;
      graph.groups = (page.groups || []).slice();
      graph.nodes = (page.nodes || []).slice().concat(pseudo.nodes);
      graph.links = (page.links || []).slice().concat(pseudo.links);
      graph.transform = (page.transform && 'object' === typeof page.transform) ? page.transform : { x: 0, y: 0, scale: 1 };
    }
    return page;
  }

  function syncPageFromGraph() {
    const current = getCurrent();
    const page = getCurrentPage();
    if (!current || !page) {
      return page;
    }
    page.nodes = (graph.nodes || []).filter(function (node) {
      return !(node && node.pseudo);
    });
    page.links = (graph.links || []).filter(function (link) {
      return !(link && link.pseudo);
    });
    current.page = page;
    var pages = normalizePagesForCurrent(current);
    var idx = pages.findIndex(function (item) { return item && item.id === page.id; });
    if (idx < 0) {
      pages.push(page);
    } else {
      pages[idx] = page;
    }
    normalizePagesForCurrent(current);
    return page;
  }

  function wrapWithPageSync(fnOrName, afterRefresh) {
    var fn = fnOrName;

    if ('string' === typeof fnOrName) {
      fn = wuwei.model && wuwei.model[fnOrName];
    }

    if (typeof fn !== 'function') {
      return fn;
    }

    return function () {
      var result = fn.apply(this, arguments);
      syncPageFromGraph();
      if (afterRefresh && wuwei.draw) {
        if (graph.mode === 'simulation') {
          restartCurrentDraw();
        }
        else {
          refreshCurrentDraw();
        }
      }
      return result;
    };
  }

  function findNodeById(nodeId) {
    var page = getCurrentPage();
    if (!page || !Array.isArray(page.nodes) || !nodeId) {
      return null;
    }
    return page.nodes.find(function (g) { return g && g.id === nodeId; }) || null;
  }

  function getGroupMembers(group) {
    if (!group || !Array.isArray(group.members)) {
      return [];
    }
    return group.members.slice();
  }

  function getGroupNodeIds(group) {
    var ids = [];
    if (!group) {
      return ids;
    }
    if (Array.isArray(group.members)) {
      group.members.forEach(function (member) {
        var nodeId = (member && member.nodeId) ? member.nodeId : member;
        if (nodeId && ids.indexOf(nodeId) < 0) {
          ids.push(nodeId);
        }
      });
    }
    return ids;
  }

  function findGroupById(groupId) {
    var page = getCurrentPage();
    if (!page || !Array.isArray(page.groups) || !groupId) {
      return null;
    }
    return page.groups.find(function (g) { return g && g.id === groupId; }) || null;
  }

  function findGroupNodes(groupId) {
    var page = getCurrentPage();
    const group = findGroupById(groupId);
    const index = {};
    ((page && page.nodes) || []).forEach(function (n) {
      if (n && n.id) { index[n.id] = n; }
    });
    return getGroupNodeIds(group).map(function (id) { return index[id] || null; }).filter(Boolean);
  }

  function findGroupsByNodeId(nodeId) {
    var page = getCurrentPage();
    if (!page || !Array.isArray(page.groups) || !nodeId) {
      return [];
    }
    return page.groups.filter(function (g) {
      return g && getGroupNodeIds(g).indexOf(nodeId) >= 0;
    });
  }

  function isNodeInAnyGroup(nodeId) {
    if (!nodeId) {
      return false;
    }
    return findGroupsByNodeId(nodeId).length > 0;
  }

  /**
   * Remove invalid or now-empty group definitions from the page before save/redraw.
   * - simple: keep if it still has at least 1 member
   * - topicGroup(axis): keep if it still has at least 2 segment members
   * - topicGroup(vertical/horizontal): keep if it still has at least 2 members
   * - legacy axis Group: keep if it still has at least 2 members or segments
   */
  function pruneGroups() {
    var page = getCurrentPage();
    if (!page || !Array.isArray(page.groups)) {
      return;
    }
    page.groups = page.groups.filter(function (g) {
      if (!g) {
        return false;
      }
      if ('simple' === g.type) {
        return Array.isArray(g.members) && g.members.length >= 1;
      }
      if ('timeline' === g.type) {
        return Array.isArray(g.members) && g.members.length >= 2;
      }
      if ('horizontal' === g.type || 'vertical' === g.type) {
        return Array.isArray(g.members) && g.members.length >= 2;
      }
      return true;
    });
  }

  function removeNodeFromAllGroups(nodeId) {
    var page = getCurrentPage();
    if (!page || !Array.isArray(page.groups) || !nodeId) {
      return;
    }
    page.groups.forEach(function (g) {
      if (g && Array.isArray(g.members)) {
        g.members = g.members.filter(function (member) {
          var id = (member && member.nodeId) ? member.nodeId : member;
          return id !== nodeId;
        });
      }
    });
    pruneGroups();
  }

  function addNodeToGroup(groupId, nodeId, itemData) {
    var page = getCurrentPage();
    const group = findGroupById(groupId);
    if (!group || !nodeId) {
      return;
    }
    if (!Array.isArray(group.members)) {
      group.members = [];
    }
    if (group.members.some(function (member) {
      var id = (member && member.nodeId) ? member.nodeId : member;
      return id === nodeId;
    })) {
      return;
    }
    group.members.push(Object.assign({ nodeId: nodeId, value: '', order: group.members.length + 1, offset: 0, role: 'member' }, itemData || {}));
  }

  function applyNodeStyleToGroup(sourceNode) {
    var page = getCurrentPage();
    if (!page || !sourceNode || 'Topic' !== sourceNode.type) {
      return;
    }
    sourceNode.changed = true;
    const groups = findGroupsByNodeId(sourceNode.id);
    groups.forEach(function (group) {
      findGroupNodes(group.id).forEach(function (node) {
        if (!node || node.id === sourceNode.id || 'Topic' !== node.type) {
          return;
        }
        node.shape = sourceNode.shape;
        node.color = sourceNode.color;
        node.outline = sourceNode.outline;
        node.size = clone(sourceNode.size || {});
        node.changed = true;
      });
    });
  }

  function getGroupOrientation(groupId) {
    var page = getCurrentPage();
    const group = findGroupById(groupId);
    if (!group || !group.visible) {
      return null;
    }
    let orientation = group.orientation || 'auto';
    if ('auto' !== orientation) {
      return orientation;
    }
    const nodes = findGroupNodes(groupId).filter(function (n) {
      return n && isFinite(n.x) && isFinite(n.y);
    });
    if (nodes.length < 2) {
      return null;
    }
    const xs = nodes.map(function (n) { return n.x; });
    const ys = nodes.map(function (n) { return n.y; });
    return (Math.max.apply(null, xs) - Math.min.apply(null, xs) >= Math.max.apply(null, ys) - Math.min.apply(null, ys)) ? 'horizontal' : 'vertical';
  }

  function getBorderByNodes(nodes) {
    var boundsList;
    var minX, maxX, minY, maxY;

    if (!Array.isArray(nodes) || !nodes.length) {
      return null;
    }

    boundsList = nodes.map(function (node) {
      var x, y, shape, size, width, height, radius;

      if (!node) {
        return null;
      }

      x = Number(node.x);
      y = Number(node.y);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      shape = node.shape || 'RECTANGLE';
      size = node.size || {};

      width = Number(size.width);
      height = Number(size.height);
      radius = Number(size.radius);

      if (!Number.isFinite(width) || width <= 0) {
        width = Number(defaultSize.width || 120);
      }
      if (!Number.isFinite(height) || height <= 0) {
        height = Number(defaultSize.height || 40);
      }
      if (!Number.isFinite(radius) || radius <= 0) {
        radius = Number(defaultSize.radius || 24);
      }

      switch (shape) {
        case 'CIRCLE':
          return {
            minX: x - radius,
            maxX: x + radius,
            minY: y - radius,
            maxY: y + radius
          };

        case 'TRIANGLE':
          return {
            minX: x - width / 2,
            maxX: x + width / 2,
            minY: y - (2 * height / 3),
            maxY: y + (height / 3)
          };

        case 'RHOMBUS':
          return {
            minX: x - width / 2,
            maxX: x + width / 2,
            minY: y - height / 2,
            maxY: y + height / 2
          };

        case 'RECTANGLE':
        case 'ELLIPSE':
        case 'ROUNDED':
        case 'THUMBNAIL':
        case 'MEMO':
        case 'TABLE':
        default:
          return {
            minX: x - width / 2,
            maxX: x + width / 2,
            minY: y - height / 2,
            maxY: y + height / 2
          };
      }
    }).filter(function (bounds) {
      return !!bounds;
    });

    if (!boundsList.length) {
      return null;
    }

    minX = Math.min.apply(null, boundsList.map(function (b) { return b.minX; }));
    maxX = Math.max.apply(null, boundsList.map(function (b) { return b.maxX; }));
    minY = Math.min.apply(null, boundsList.map(function (b) { return b.minY; }));
    maxY = Math.max.apply(null, boundsList.map(function (b) { return b.maxY; }));

    return {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  function resolveGroupBox(groupId) {
    var page = getCurrentPage();
    const group = findGroupById(groupId);
    if (!group || 'simple' !== group.type || !group.visible) {
      return null;
    }
    const nodes = findGroupNodes(groupId).filter(function (n) {
      return n && isFinite(n.x) && isFinite(n.y);
    });
    if (nodes.length < 2) {
      return null;
    }
    const border = getBorderByNodes(nodes);
    if (!border) {
      return null;
    }
    const padding = 16;
    return {
      group: group.id,
      x: border.left - padding,
      y: border.top - padding,
      width: border.width + padding * 2,
      height: border.height + padding * 2,
      stroke: '#666666',
      strokeWidth: 2,
      dasharray: '8 4'
    };
  }

  function resolveGroupSpine(groupId) {
    var page = getCurrentPage();
    const group = findGroupById(groupId);
    if (!group || !('horizontal' === group.type || 'vertical' === group.type) || !group.visible) {
      return null;
    }
    const spine = group.spine || {};
    if (false === spine.visible) {
      return null;
    }
    const nodes = findGroupNodes(groupId).filter(function (n) {
      return n && isFinite(n.x) && isFinite(n.y);
    });
    if (nodes.length < 2) {
      return null;
    }
    const xs = nodes.map(function (n) { return n.x; });
    const ys = nodes.map(function (n) { return n.y; });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    const padding = Number(spine.padding || 12);
    const orientation = getGroupOrientation(groupId);
    if (!orientation) {
      return null;
    }
    if ('vertical' === orientation) {
      const anchorX = group.axis && group.axis.anchor && Number.isFinite(Number(group.axis.anchor.x))
        ? Number(group.axis.anchor.x)
        : (xs.reduce(function (a, b) { return a + b; }, 0) / xs.length);
      return { group: group.id, x1: anchorX, y1: minY - padding, x2: anchorX, y2: maxY + padding, stroke: spine.color || '#666666', strokeWidth: Number(spine.width || 6) };
    }
    const anchorY = group.axis && group.axis.anchor && Number.isFinite(Number(group.axis.anchor.y))
      ? Number(group.axis.anchor.y)
      : (ys.reduce(function (a, b) { return a + b; }, 0) / ys.length);
    return { group: group.id, x1: minX - padding, y1: anchorY, x2: maxX + padding, y2: anchorY, stroke: spine.color || '#666666', strokeWidth: Number(spine.width || 6) };
  }

  initModule = function () {
    util = wuwei.util;
    draw = wuwei.draw;
    menu = wuwei.menu;
    common = wuwei.common;
    state = common.state;
    log = wuwei.log;
  };

  return {
    /** Node */
    Node: Node,
    NodeFactory: NodeFactory,
    createNode: createNode,
    removeNode: removeNode,
    addNode: addNode,
    updateNode: updateNode,
    showNodes: showNodes,
    hideNodes: hideNodes,
    // copyNode: copyNode,
    findNodeById: findNodeById,
    /** Link */
    Link: Link,
    LinkFactory: LinkFactory,
    connect: connect,
    reverse: reverse,
    normal: normal,
    horizontal: horizontal,
    vertical: vertical,
    horizontal2: horizontal2,
    vertical2: vertical2,
    createLink: createLink,
    removeLink: removeLink,
    updateLink: updateLink,
    showLinks: showLinks,
    hideLinks: hideLinks,
    findLinkById: findLinkById,
    // findLinkByIdx: findLinkByIdx,
    findLinksByNode: findLinksByNode,
    findOtherNode: findOtherNode,
    countHiddenLink: countHiddenLink,
    newPosition: newPosition,
    /**  */
    toLoad: toLoad,
    toCreate: toCreate,
    toModify: toModify,
    toRemove: toRemove,
    // toRefresh: toRefresh,
    /** Add */
    addSimpleContent: addSimpleContent,
    addSimpleTopic: addSimpleTopic,
    addSimpleMemo: addSimpleMemo,
    addSimpleTable: addSimpleTable,
    addUploadedContent: addUploadedContent,
    addContent: addContent,
    addTopic: addTopic,
    addMemo: addMemo,
    addTable: addTable,
    setMultipleLine: setMultipleLine,
    featurePoints: featurePoints,
    hierarchyLink: hierarchyLink,
    hierarchyLink2: hierarchyLink2,
    renderLink: renderLink,
    closestPoint: closestPoint,
    pathString2points: pathString2points,
    points2pathString: points2pathString,
    updateLinkCount: updateLinkCount,
    renderNode: renderNode,
    /** 2026-03 */
    getCurrent: getCurrent,
    getCurrentPage: getCurrentPage,

    setGraphFromCurrentPage: setGraphFromCurrentPage,
    syncPageFromGraph: syncPageFromGraph,
    wrapWithPageSync: wrapWithPageSync,
    /** CMND */
    cut: cut,
    erase: erase,
    bloom: bloom,
    hide: hide,
    root: root,
    forward: forward,
    backward: backward,
    wilt: wilt,
    showAll: showAll,
    copy: copy,
    clipboard: clipboard,
    paste: paste,
    clone: clone,
    setVisible: setVisible,
    /** group */
    createGroup: createGroup,
    groupDragStarted: groupDragStarted,
    groupDragged: groupDragged,
    groupDragEnded: groupDragEnded,

    findNodeById: findNodeById,
    getGroupMembers: getGroupMembers,
    getGroupNodeIds: getGroupNodeIds,
    findGroupById: findGroupById,
    findGroupNodes: findGroupNodes,
    findGroupsByNodeId: findGroupsByNodeId,
    isNodeInAnyGroup: isNodeInAnyGroup,
    pruneGroups: pruneGroups,
    removeNodeFromAllGroups: removeNodeFromAllGroups,
    addNodeToGroup: addNodeToGroup,
    applyNodeStyleToGroup: applyNodeStyleToGroup,
    getGroupOrientation: getGroupOrientation,
    resolveGroupBox: resolveGroupBox,
    resolveGroupSpine: resolveGroupSpine,

    /** init */
    initModule: initModule
  };
})();
// wuwei.model.js last modified 2026-04-18
