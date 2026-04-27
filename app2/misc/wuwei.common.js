/**
 * wuwei.common.js
 * common data module
 *
 * WuWei is a free to use open source knowledge modeling tool.
 * More information on WuWei can be found on WuWei homepage.
 * https://www.wuwei.space/blog/
 *
 * WuWei is copyrighted free software by Nobuyuki SAMBUICHI.
 *
 * Copyright (c) 2013-2021, SAMBUICHI Professional Engineer's Office All rights reserved.
 **/
wuwei.common = (function () {
  var href = window.location.href;
  var home = href.substr(0, href.indexOf('/', 10));
  /** setting */
  var setting = window.setting || {};
  var constants = window.constants || {};
  var simulation = null;
  var log = true;

  function createTempOwnerId() {
    var key = 'wuwei_temp_owner_id';
    var value = '';
    try {
      value = window.sessionStorage ? (window.sessionStorage.getItem(key) || '') : '';
    } catch (e) { value = ''; }
    if (!value) {
      value = 'guest_' + Date.now() + '_' + Math.random().toString(16).slice(2);
      try {
        if (window.sessionStorage) {
          window.sessionStorage.setItem(key, value);
        }
      } catch (e) { }
    }
    return value;
  }

  var TEMP_OWNER_ID = createTempOwnerId();

  function createGuestCurrentUser() {
    return {
      login: 'guest',
      user_id: TEMP_OWNER_ID,
      name: 'Guest',
      role: null,
      token: null
    };
  }

  function getCurrentOwnerId() {
    return (state && state.currentUser && state.currentUser.user_id) || TEMP_OWNER_ID;
  }

  function isTemporaryOwnerId(ownerId) {
    return 'string' === typeof ownerId && 0 === ownerId.indexOf('guest_');
  }

  var timelineEdit = {
    mode: '',
    targetId: '',
    groupId: '',
    pointId: '',
    mediaRef: ''
  };

  var filter = {
    enabled: false,
    year: false,
    beginningYear: 0,
    endingYear: 3000,
    group: [],
    role: []
  }

  var PUBLIC = [
    { user_id: 'dd99d0a5-566b-41cf-934d-127a89e13ba1', login: 'guest', user: 'Guest' },
    { user_id: '0dbfa104-accd-4188-8b1b-f2e25d38e638', login: 'data', user: 'XBRL' }
  ];

  var nls = {
    LANG: 'ja',
    label: [
      { value: 'ja', label: '日本語' },
      { value: 'en', label: 'English' },
      { value: 'et', label: 'Eesti' },
      { value: 'fi', label: 'Suomi' },
      { value: 'kr', label: '한국어' },
      { value: 'tw', label: '華語(台灣)' },
      { value: 'cn', label: '中文' }
    ],
    cke: {
      'ja': 'ja',
      'en': 'en',
      'et': 'et',
      'fi': 'fi',
      'kr': 'ko',
      'tw': 'cn',
      'cn': 'zh-cn'

    },
    creativeCommons: {
      cn: { name: '创作共用', url: 'http://creativecommons.net.cn/' },
      en: { name: 'Creative Commons', url: 'https://creativecommons.org/' },
      ja: { name: 'クリエイティブ・コモンズ', url: 'https://creativecommons.jp/' },
      kr: { name: '크리에이티브 커먼즈', url: 'http://cckorea.org/' },
      tw: { name: '創作共用', url: 'http://creativecommons.tw/' },
      et: { name: 'Creative Commons', url: 'https://creativecommons.org/' },
      fi: { name: 'Creative Commons', url: 'https://creativecommons.org/' }
    },
    copyrights: {
      ja: [ // クリエイティブ・コモンズ https://creativecommons.jp/
        { value: 'CC0', label: 'いかなる権利も保有しない(CC0)' },
        { value: 'CC BY', label: '表示(CC BY)' },
        { value: 'CC BY-SA', label: '表示-継承(CC BY-SA)' },
        { value: 'CC BY-ND', label: '表示-改変禁止(CC BY-ND)' },
        { value: 'CC BY-NC', label: '表示-非営利(CC BY-NC)' },
        { value: 'CC BY-NC-SA', label: '表示-非営利-継承(CC BY-NC-SA)' },
        { value: 'CC BY-NC-ND', label: '表示-非営利-改変禁止(CC BY-NC-ND)' }
      ],
      en: [ // Creative Commons https://creativecommons.org/
        { value: 'CC0', label: 'No Rights Reserved(CC0)' },
        { value: 'CC BY', label: 'Attribution(CC BY)' },
        { value: 'CC BY-SA', label: 'Attribution-ShareAlike(CC BY-SA)' },
        { value: 'CC BY-ND', label: 'Attribution-No Derivative Works(CC BY-ND)' },
        { value: 'CC BY-NC', label: 'Attribution-Noncommercial(CC BY-NC)' },
        { value: 'CC BY-NC-SA', label: 'Attribution-Noncommercial-ShareAlike(CC BY-NC-SA)' },
        { value: 'CC BY-NC-ND', label: 'Attribution-Noncommercial-No Derivative Works(CC BY-NC-ND)' }
      ],
      kr: [ // 크리에이티브 커먼즈 http://cckorea.org/
        { value: 'CC0', label: '퍼블릭 도메인(CC0)' },
        { value: 'CC BY', label: '저작자 표시(CC BY)' },
        { value: 'CC BY-SA', label: '저작자 표시-동일조건 변경 허락(CC BY-SA)' },
        { value: 'CC BY-ND', label: '저작자 표시-변경 금지(CC BY-ND)' },
        { value: 'CC BY-NC', label: '저작자 표시-비영리(CC BY-NC)' },
        { value: 'CC BY-NC-SA', label: '저작자 표시-비영리-동일조건 변경 허락(CC BY-NC-SA)' },
        { value: 'CC BY-NC-ND', label: '저작자 표시-비영리-변경 금지(CC BY-NC-ND)' }
      ],
      cn: [ // 创作共用 http://creativecommons.net.cn/
        { value: 'CC0', label: '公眾領域貢獻宣告(CC0)' },
        { value: 'CC BY', label: '创作共用-署名(CC BY)' },
        { value: 'CC BY-SA', label: '创作共用-署名-相同方式分享(CC BY-SA)' },
        { value: 'CC BY-ND', label: '创作共用-署名-禁止改作(CC BY-ND)' },
        { value: 'CC BY-NC', label: '创作共用-署名-非商業性(CC BY-NC)' },
        { value: 'CC BY-NC-SA', label: '创作共用-署名-非商業性-相同方式分享(CC BY-NC-SA)' },
        { value: 'CC BY-NC-ND', label: '创作共用-署名-非商業性-禁止改作(CC BY-NC-ND)' }
      ],
      tw: [ // 創作共用 http://creativecommons.tw/
        { value: 'CC0', label: '公眾領域貢獻宣告(CC0)' },
        { value: 'CC BY', label: '姓名標示(CC BY)' },
        { value: 'CC BY-SA', label: '姓名標示-相同方式分享(CC BY-SA)' },
        { value: 'CC BY-ND', label: '姓名標示-禁止改作(CC BY-ND)' },
        { value: 'CC BY-NC', label: '姓名標示-非商業性(CC BY-NC)' },
        { value: 'CC BY-NC-SA', label: '姓名標示-非商業性-相同方式分享(CC BY-NC-SA)' },
        { value: 'CC BY-NC-ND', label: '姓名標示-非商業性-禁止改作(CC BY-NC-ND)' }
      ],
      et: [ // Creative Commons https://creativecommons.org/ wiki https://wiki.creativecommons.org/wiki/Estonia
        { value: 'CC0', label: 'Õigusi ei reserveerita (CC0)' },
        { value: 'CC BY', label: 'Autorile viitamine (CC BY)' },
        { value: 'CC BY-SA', label: 'Autorile viitamine-Jagamine samadel tingimustel (CC BY-SA)' },
        { value: 'CC BY-ND', label: 'Autorile viitamine-Tuletatud teosed keelatud (CC BY-ND)' },
        { value: 'CC BY-NC', label: 'Autorile viitamine-Mitteäriline kasutus (CC BY-NC)' },
        { value: 'CC BY-NC-SA', label: 'Autorile viitamine-Mitteäriline kasutus-Jagamine samadel tingimustel (CC BY-NC-SA)' },
        { value: 'CC BY-NC-ND', label: 'Autorile viitamine-Mitteäriline kasutus-Tuletatud teosed keelatud (CC BY-NC-ND)' }
      ],
      fi: [ // Creative Commons https://creativecommons.org/ wiki https://wiki.creativecommons.org/wiki/Finland
        { value: 'CC0', label: 'Ei oikeuksia pidätetty (CC0)' },
        { value: 'CC BY', label: 'Nimeä (CC BY)' },
        { value: 'CC BY-SA', label: 'Nimeä-Jaa samoin (CC BY-SA)' },
        { value: 'CC BY-ND', label: 'Nimeä-Ei muutoksia (CC BY-ND)' },
        { value: 'CC BY-NC', label: 'Nimeä-Ei kaupallinen (CC BY-NC)' },
        { value: 'CC BY-NC-SA', label: 'Nimeä-Ei kaupallinen-Jaa samoin (CC BY-NC-SA)' },
        { value: 'CC BY-NC-ND', label: 'Nimeä-Ei kaupallinen-Ei muutoksia (CC BY-NC-ND)' }
      ]
    }
  };

  var current = { // current note
    note_id: null,
    note_name: '',
    description: '',
    currentPage: 1,
    page: {
      pp: 1,
      name: '',
      description: '',
      nodes: [],
      links: [],
      groups: [],
      transform: {
        x: 0,
        y: 0,
        scale: 1
      },
      thumbnail: null,
      audit: null
    },
    pages: {},
    audit: null
  };

  var notes = {};

  var graph = {
    mode: '',
    nodes: [],
    links: [],
    groups: [],
    translate: {
      x: 0,
      y: 0,
      scale: 1
    }
  };
  var resourceIndexer = {};
  var associationIndexer = {};
  var previous = {
    page: {
      nodes: [],
      links: [],
      groups: []
    }
  };

  var groupSetting = {};
  var roleSetting = {};

  var miniature = {
    width: 200,
    height: 200,
    scale: 2,
    x1: null,
    y1: null,
    offsetH: null,
    offsetV: null,
    xTranslation: null,
    yTranslation: null,
  };

  var state = {
    iOS: null,
    browser: 'unknown',
    isOnline: false,
    win: null,
    doc: null,
    year: null,
    month: null,
    terms: {},
    attributes: new Map(),
    filteredAttribute: new Map(),
    filteredS3object: new Map(),
    searchTerms: {
      year: null,
      prefix: null,
      student: null,
      faculty: null,
      subject: null
    },
    responseTerms: {
      year: null,
      prefix: null,
      student: null,
      faculty: null,
      subject: null
    },
    _Map: new Map(),
    annotate: {
      id: null,
      type: null, // webpage or pdfjs
      caller: null, // home or wuwei
      iframeId: null,
      uri: null, // retrieved content location
      url: null, // original site url
      retrieved: null,
      annotations: null // Array of annotation
    },
    annotates: {},
    pdfjsPage: null, // pdfjs annotation
    currentUser: createGuestCurrentUser(),
    loggedIn: false,
    chatMode: {
      active: false,
      room: null,
      member: []
    },
    // chat: null,
    viewing: false,
    viewOnly: false,
    published: false,
    control_width: 0,
    svgId: 'draw',
    canvasId: 'canvas',
    zoomActive: true,
    dragArea: { x0: null, y0: null, x1: null, y1: null },
    dragging: false,
    dragMoveIds: null,
    dragMoveAnchor: null,
    dragMoveOrigin: null,
    dragMoveConstraint: null,
    groupDragIds: null,
    groupDragAnchor: null,
    groupDragOrigin: null,
    groupDragAxisOrigin: null,
    selectedGroupIds: [],
    modal: false,
    previousEdit: {
      node: null,
      resource: null,
      link: null,
      association: null
    },
    hoveredNode: null,
    editingNode: null,
    editingResource: null,
    startNode: null,
    menuTimer: null,
    Connecting: false,
    Selecting: false,
    Copying: false,
    Editing: false,
    Searching: false,
    PreSearch: false,
    editNode: null,
    infoNode: null,
    // Chatmode: false,
    Drawmode: ['draw', 'view', 'simulation'],
    drawmodeIdx: 0,
    Extra: false,
    copyingNodes: null,
    selectedFilter: '',
    selectedSearch: '',
    selectedEdit: '',
    selectedInfo: '',
    start: null,
    count: null,
    timelineEdit: null
  };


  var undoLog = new Map();
  var redoLog = new Map();
  var MAX_LOG = 16;

  var MENU_RADIUS = 32;
  var DRG_CNTRL_OFFSET = 6;

  var positions = [
    { value: 'CENTER', label: 'CENTER' },
    { value: 'LEFT', label: 'LEFT' },
    { value: 'RIGHT', label: 'RIGHT' },
    { value: 'TOP', label: 'TOP' },
    { value: 'BOTTOM', label: 'BOTTOM' },
    { value: 'TOP_LEFT', label: 'TOP_LEFT' },
    { value: 'BOTTOM_LEFT', label: 'BOTTOM_LEFT' },
    { value: 'TOP_RIGHT', label: 'TOP_RIGHT' },
    { value: 'BOTTOM_RIGHT', label: 'BOTTOM_RIGHT' }
  ];

  var shapes = [
    { value: 'RECTANGLE', label: 'RECTANGLE' },
    { value: 'CIRCLE', label: 'CIRCLE' },
    { value: 'ROUNDED', label: 'ROUNDED' },
    { value: 'ELLIPSE', label: 'ELLIPSE' },
    { value: 'TRIANGLE', label: 'TRIANGLE' },
    { value: 'RHOMBUS', label: 'RHOMBUS' },
    { value: 'THUMBNAIL', label: 'THUMBNAIL' }
  ];

  var linkShapes = [
    { value: 'NORMAL', label: 'NORMAL' },
    { value: 'HORIZONTAL', label: 'HORIZONTAL' },
    { value: 'VERTICAL', label: 'VERTICAL' },
    { value: 'HORIZONTAL2', label: 'HORIZONTAL2' },
    { value: 'VERTICAL2', label: 'VERTICAL2' }
  ];

  var markerShapes = [
    { value: 'ARROW', label: 'ARROW' },
    { value: 'HOLLOW-ARROW', label: 'HOLLOW-ARROW' },
    { value: 'LINE-ARROW', label: 'LINE-ARROW' },
    { value: 'RHOMBUS', label: 'RHOMBUS' },
    { value: 'HOLLOW-RHOMBUS', label: 'HOLLOW-RHOMBUS' },
    { value: 'CIRCLE', label: 'CIRCLE' },
    { value: 'HOLLOW-CIRCLE', label: 'HOLLOW-CIRCLE' }
  ];

  var strokeDasharray = [
    { value: 'SOLID', label: 'SOLID' },
    { value: 'DOTTED', label: 'DOTTED' },
    { value: 'DASHED', label: 'DASHED' },
    { value: 'LONG_DASHED', label: 'LONG-DASHED' }
  ];

  var Color = {
    transparent: 'rgba(255, 250, 240, 0.1)',
    canvasBackground: '#f9f8f7',
    shadowBackground: '#000000',
    svgBackground: '#fff',
    viewport: '#b55', // miniature canvas
    outerHovered: 'rgba(229, 239, 247, 0.5)',
    innerHovered: 'rgba(237, 229, 229, 0.8)',
    outerEditing: 'rgba(185, 85, 181, 0.5)', //rgba(65, 105, 225, 0.5)
    innerEditing: 'rgba(205, 105, 201, 0.8)',
    outerStart: 'rgba(138, 43, 226, 0.5)',
    innerStart: 'rgba(229, 247, 244, 0.8)',
    outerSelected: 'rgba(247, 13, 26, 0.5)',
    innerSelected: 'rgba(247, 13, 26, 0.5)',
    flockSelected: 'rgba(237, 249, 249, 0.5)',
    trunkSelected: 'rgba(237, 249, 249, 0.5)',
    outerFocused: 'rgba(237, 229, 229, 0.5)',
    innerFocused: '#87ceeb',
    controlHovered: 'rgba(200, 218, 208, 0.6)',
    selectingRect: 'rgba(229, 237, 229, 0.4)',
    defaultShadowColor: '#fff',
    // textIncomplete: '#c00',
    // textComplete: '#333',
    forceVector: '#080',
    forceEndpoint: '#fff',
    nodeFill: '#FFFFF0',//Ivory:"rgb(255, 255, 240)"
    nodeText: '#303030',
    nodeOutline: '#d7d8d9',
    contentFill: '#EEEFFF',//AliceBlue:"rgb(240, 248, 255)"
    contentOutline: '#d7d8d9',
    // Keep Color self-contained so common can initialize before colorPalette.
    segmentFill: 'rgb(255, 255, 240)',
    segmentOutline: 'rgb(169, 169, 169)',
    mwmo: '#FFF7B0',
    // flock: 'rgba(255, 250, 240, 0.2)',
    // flockOutline: '#7a7b7c',
    // flockMember: '#3af',
    // anchor: '#333',
    link: '#c0c0c0',
    linkText: '#303030',
    // identifierOutline: '#544',
    // identifierSelectedFill: '#766',
    // identifierUnselectedFill: '#fff',
    nameCopying: '#ff69b4',
    edgeCopying: '#FA58F4',
    nodeCopying: '#fff0f5'
  };

  var actionColor = {
    info: { background: '#18C7D4', color: '#37B1BA' },
    success: { background: '#40c6c6', color: '#00ff00' },
    warning: { background: '#FE9733', color: '#FEA933' },
    error: { background: '#F571BE', color: '#ff0000' }
  };

  var colorPalette = {
    Maroon: "rgb(128, 0, 0)", // red,3202.6
    DarkRed: "rgb(139, 0, 0)", // red,3421.9
    Brown: "rgb(165, 42, 42)", // red,4102.2
    FireBrick: "rgb(178, 34, 34)", // red,4269.2
    Crimson: "rgb(220, 20, 60)", // red,4989.6
    IndianRed: "rgb(205, 92, 92)", // red,5402.8
    Red: "rgb(255, 0, 0)", // red,5569.4
    PaleVioletRed: "rgb(219, 112, 147)", // red,6003.5
    Tomato: "rgb(255, 99, 71)", // red,6177.2
    RosyBrown: "rgb(188, 143, 143)", // red,6240.5
    LightCoral: "rgb(240, 128, 128)", // red,6479.9
    Salmon: "rgb(250, 128, 114)", // red,6579.2
    DarkSalmon: "rgb(233, 150, 122)", // red,6784.2
    LightPink: "rgb(255, 182, 193)", // red,7733.8
    Pink: "rgb(255, 192, 203)", // red,7947.8
    Gold: "rgb(255, 215, 0)", // red,8243.1
    LawnGreen: "rgb(124, 252, 0)", // red,8420.6
    Chartreuse: "rgb(127, 255, 0)", // red,8505.1
    MistyRose: "rgb(255, 228, 225)", // red,8717.1
    LavenderBlush: "rgb(255, 240, 245)", // red,9007.2
    Snow: "rgb(255, 250, 250)", // red,9226.2

    SaddleBrown: "rgb(139, 69, 19)", // orange,4029.8
    Sienna: "rgb(160, 82, 45)", // orange,4569.3
    Chocolate: "rgb(210, 105, 30)", // orange,5624.2
    OrangeRed: "rgb(255, 69, 0)", // orange,5829.3
    DarkGoldenrod: "rgb(184, 134, 11)", // orange,5878.7
    Peru: "rgb(205, 133, 63)", // orange,6095.0
    Coral: "rgb(255, 127, 80)", // orange,6587.5
    DarkOrange: "rgb(255, 140, 0)", // orange,6775.6
    Goldenrod: "rgb(218, 165, 32)", // orange,6868.0
    SandyBrown: "rgb(244, 164, 96)", // orange,7134.7
    LightSalmon: "rgb(255, 160, 122)", // orange,7200.7
    Tan: "rgb(210, 180, 140)", // orange,7210.9
    Orange: "rgb(255, 165, 0)", // orange,7230.0
    BurlyWood: "rgb(222, 184, 135)", // orange,7386.5
    Wheat: "rgb(245, 222, 179)", // orange,8436.2
    PeachPuff: "rgb(255, 218, 185)", // orange,8436.6
    NavajoWhite: "rgb(255, 222, 173)", // orange,8500.8
    Moccasin: "rgb(255, 228, 181)", // orange,8638.5
    Bisque: "rgb(255, 228, 196)", // orange,8662.8
    AntiqueWhite: "rgb(250, 235, 215)", // orange,8808.3
    BlanchedAlmond: "rgb(255, 235, 205)", // orange,8824.8
    PapayaWhip: "rgb(255, 239, 213)", // orange,8922.9
    Linen: "rgb(250, 240, 230)", // orange,8942.6
    OldLace: "rgb(253, 245, 230)", // orange,9067.7
    Seashell: "rgb(255, 245, 238)", // orange,9096.7
    Cornsilk: "rgb(255, 248, 220)", // orange,9125.3
    FloralWhite: "rgb(255, 250, 240)", // orange,9205.6

    DarkOliveGreen: "rgb(85, 107, 47)", // yellow,4405.9
    Olive: "rgb(128, 128, 0)", // yellow,5243.3
    OliveDrab: "rgb(107, 142, 35)", // yellow,5480.2
    DarkKhaki: "rgb(189, 183, 107)", // yellow,7075.5
    YellowGreen: "rgb(154, 205, 50)", // yellow,7353.6
    Khaki: "rgb(240, 230, 140)", // yellow,8520.9
    PaleGoldenrod: "rgb(238, 232, 170)", // yellow,8588.7
    GreenYellow: "rgb(173, 255, 47)", // yellow,8671.7
    Beige: "rgb(245, 245, 220)", // yellow,8997.0
    Yellow: "rgb(255, 255, 0)", // yellow,9110.8
    LightGoldenrodYellow: "rgb(250, 250, 210)", // yellow,9118.1
    LemonChiffon: "rgb(255, 250, 205)", // yellow,9142.0
    LightYellow: "rgb(255, 255, 224)", // yellow,9281.0
    Ivory: "rgb(255, 255, 240)", // yellow,9311.0

    DarkGreen: "rgb(0, 100, 0)", // green,3942.4
    Green: "rgb(0, 128, 0)", // green,4806.1
    ForestGreen: "rgb(34, 139, 34)", // green,5158.0
    SeaGreen: "rgb(46, 139, 87)", // green,5225.5
    MediumSeaGreen: "rgb(60, 179, 113)", // green,6403.1
    DarkSeaGreen: "rgb(143, 188, 143)", // green,6965.3
    LimeGreen: "rgb(50, 205, 50)", // green,7043.3
    MediumAquamarine: "rgb(102, 205, 170)", // green,7282.6
    LightGreen: "rgb(144, 238, 144)", // green,8206.1
    MediumSpringGreen: "rgb(0, 250, 154)", // green,8306.4
    Lime: "rgb(0, 255, 0)", // green,8352.2
    SpringGreen: "rgb(0, 255, 127)", // green,8404.7
    PaleGreen: "rgb(152, 251, 152)", // green,8564.0
    Aquamarine: "rgb(127, 255, 212)", // green,8676.0
    Honeydew: "rgb(240, 255, 240)", // green,9219.7
    MintCream: "rgb(245, 255, 250)", // green,9269.9

    MidnightBlue: "rgb(25, 25, 112)", // blue,2215.8
    Navy: "rgb(0, 0, 128)", // blue,2229.2
    DarkBlue: "rgb(0, 0, 139)", // blue,2382.2
    MediumBlue: "rgb(0, 0, 205)", // blue,3256.2
    DarkSlateGray: "rgb(47, 79, 79)", // blue,3454.8
    Blue: "rgb(0, 0, 255)", // blue,3880.2
    RoyalBlue: "rgb(65, 105, 225)", // blue,4917.6
    Teal: "rgb(0, 128, 128)", // blue,4963.2
    SteelBlue: "rgb(70, 130, 180)", // blue,5295.7
    DarkCyan: "rgb(0, 139, 139)", // blue,5302.6
    SlateGray: "rgb(112, 128, 144)", // blue,5313.2
    LightSlateGray: "rgb(119, 136, 153)", // blue,5577.9
    DodgerBlue: "rgb(30, 144, 255)", // blue,5917.7
    CadetBlue: "rgb(95, 158, 160)", // blue,6034.2
    CornflowerBlue: "rgb(100, 149, 237)", // blue,6106.5
    LightSeaGreen: "rgb(32, 178, 170)", // blue,6454.5
    DeepSkyBlue: "rgb(0, 191, 255)", // blue,7045.2
    DarkTurquoise: "rgb(0, 206, 209)", // blue,7276.9
    MediumTurquoise: "rgb(72, 209, 204)", // blue,7392.3
    LightSteelBlue: "rgb(176, 196, 222)", // blue,7506.3
    SkyBlue: "rgb(135, 206, 235)", // blue,7576.6
    LightSkyBlue: "rgb(135, 206, 250)", // blue,7621.3
    Turquoise: "rgb(64, 224, 208)", // blue,7769.8
    LightBlue: "rgb(173, 216, 230)", // blue,7964.9
    PowderBlue: "rgb(176, 224, 230)", // blue,8162.9
    PaleTurquoise: "rgb(175, 238, 238)", // blue,8498.7
    Aqua: "rgb(0, 255, 255)", // blue,8624.7
    Cyan: "rgb(0, 255, 255)", // blue,8624.7
    Lavender: "rgb(230, 230, 250)", // blue,8646.0
    AliceBlue: "rgb(240, 248, 255)", // blue,9101.5
    GhostWhite: "rgb(248, 248, 255)", // blue,9150.7
    LightCyan: "rgb(224, 255, 255)", // blue,9160.8
    Azure: "rgb(240, 255, 255)", // blue,9250.9

    Indigo: "rgb(75, 0, 130)", // indigo,2742.8
    DarkSlateBlue: "rgb(72, 61, 139)", // indigo,3436.0
    BlueViolet: "rgb(138, 43, 226)", // indigo,4505.0
    SlateBlue: "rgb(106, 90, 205)", // indigo,4692.9
    MediumSlateBlue: "rgb(123, 104, 238)", // indigo,5280.3
    Amethyst: "rgb(153, 102, 204)", // indigo,5307.0
    MediumPurple: "rgb(147, 112, 219)", // indigo,5511.9

    Purple: "rgb(128, 0, 128)", // violet,3531.9
    DarkMagenta: "rgb(139, 0, 139)", // violet,3773.7
    DarkViolet: "rgb(148, 0, 211)", // violet,4377.1
    DarkOrchid: "rgb(153, 50, 204)", // violet,4587.3
    MediumVioletRed: "rgb(199, 21, 133)", // violet,4775.3
    MediumOrchid: "rgb(186, 85, 211)", // violet,5427.2
    DeepPink: "rgb(255, 20, 147)", // violet,5746.3
    Fuchsia: "rgb(255, 0, 255)", // violet,6140.9
    Magenta: "rgb(255, 0, 255)", // violet,6140.9
    Orchid: "rgb(218, 112, 214)", // violet,6197.2
    HotPink: "rgb(255, 105, 180)", // violet,6444.2
    Violet: "rgb(238, 130, 238)", // violet,6782.1
    Plum: "rgb(221, 160, 221)", // violet,7078.5
    Thistle: "rgb(216, 191, 216)", // violet,7645.1

    Black: "rgb(0, 0, 0)", // gray,0.0
    DimGray: "rgb(105, 105, 105)", // gray,4586.5
    Gray: "rgb(128, 128, 128)", // gray,5376.3
    DarkGray: "rgb(169, 169, 169)", // gray,6718.1
    Silver: "rgb(192, 192, 192)", // gray,7441.6
    LightGrey: "rgb(211, 211, 211)", // gray,8026.2
    Gainsboro: "rgb(220, 220, 220)", // gray,8299.4
    WhiteSmoke: "rgb(245, 245, 245)", // gray,9046.9
    White: "rgb(255, 255, 255)", // gray,9341.6
  }

  var fontSizes = [
    { value: '24pt', label: 'XL' },
    { value: '18pt', label: 'LL' },
    { value: '14pt', label: 'L' },
    { value: '12pt', label: 'M' },
    { value: '10pt', label: 'S' },
    { value: '8pt', label: 'SS' },
    { value: '6pt', label: 'XS' }
  ];

  var defaultFont = {
    family: 'sans-serif',
    size: 14,
    color: Color.nodeText,
    align: "center"
  };

  var defaultSize = {
    width: 120, // minimum width for rendering
    height: 32,
    radius: 20,
    content: 100,
    memo: 160
  };

  var defaultStyle = {
    topic: {
      fill: Color.nodeFill,
      font: defaultFont,
      line: {
        kind: "SOLID",
        color: Color.nodeOutline,
        width: 1
      }
    },
    content: {
      fill: Color.contentFill,
      font: defaultFont,
      line: {
        kind: "SOLID",
        color: Color.contentOutline,
        width: 1
      }
    },
    segment: {
      fill: Color.segmentFill,
      font: defaultFont,
      line: {
        kind: "SOLID",
        color: Color.segmentOutline,
        width: 1
      }
    },
    memo: {
      fill: Color.memo,
      font: defaultFont,
      line: {
        kind: "SOLID",
        color: "#666666",
        width: 1
      },
      memo: {
        corner: "bottom-right",
        foldSize: 32
      }
    }
  };

  var MAX_EXPANDS = 32;

  var motivations = [
    { value: 'bookmarking', label: 'bookmarking' },
    { value: 'tagging', label: 'tagging' },
    { value: 'highlighting', label: 'highlighting' },
    { value: 'commenting', label: 'commenting' },
    { value: 'describing', label: 'describing' },
    { value: 'linking', label: 'linking' },
    { value: 'classifying', label: 'classifying' },
    { value: 'assessing', label: 'assessing' },
    { value: 'identifying', label: 'identifying' },
    { value: 'editing', label: 'editing' },
    { value: 'moderating', label: 'moderating' },
    { value: 'questioning', label: 'questioning' },
    { value: 'replying', label: 'replying' },
    { value: '', label: 'none' }
  ];

  var resourceTypes = [
    { value: 'TextualBody', label: 'TextualBody' },
    { value: 'Text', label: 'Text' },
    { value: 'Book', label: 'Book' },
    { value: 'Art', label: 'Art' },
    { value: 'Image', label: 'Image' },
    { value: 'Video', label: 'Video' },
    { value: 'Sound', label: 'Sound' },
    { value: 'Dataset', label: 'Dataset' },
    { value: 'other', label: 'other' }
  ];

  var mimeTypes = {
    ".avi": { mimeType: "video/x-msvideo", kindOfDocument: "AVI: Audio Video Interleave" },
    ".bmp": { mimeType: "image/bmp", kindOfDocument: "Windows OS/2 Bitmap Graphics" },
    ".css": { mimeType: "text/css", kindOfDocument: "Cascading Style Sheets (CSS)" },
    ".csv": { mimeType: "text/csv", kindOfDocument: "Comma-separated values (CSV)" },
    ".doc": { mimeType: "application/msword", kindOfDocument: "Microsoft Word" },
    ".docx": { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kindOfDocument: "Microsoft Word (OpenXML)" },
    ".epub": { mimeType: "application/epub+zip", kindOfDocument: "Electronic publication (EPUB)" },
    ".gz": { mimeType: "application/gzip", kindOfDocument: "GZip Compressed Archive" },
    ".gif": { mimeType: "image/gif", kindOfDocument: "Graphics Interchange Format (GIF)" },
    ".htm": { mimeType: "text/html", kindOfDocument: "HyperText Markup Language (HTML)" },
    ".html": { mimeType: "text/html", kindOfDocument: "HyperText Markup Language (HTML)" },
    ".ico": { mimeType: "image/vnd.microsoft.icon", kindOfDocument: "Icon format" },
    ".jpeg": { mimeType: "image/jpeg", kindOfDocument: "JPEG images" },
    ".jpg": { mimeType: "image/jpeg", kindOfDocument: "JPEG images" },
    ".js": { mimeType: "text/javascript", kindOfDocument: "JavaScript" },
    ".json": { mimeType: "application/json", kindOfDocument: "JSON format" },
    ".jsonld": { mimeType: "application/ld+json", kindOfDocument: "JSON-LD format" },
    ".mp3": { mimeType: "audio/mpeg", kindOfDocument: "MP3 audio" },
    ".mpeg": { mimeType: "video/mpeg", kindOfDocument: "MPEG Video" },
    ".png": { mimeType: "image/png", kindOfDocument: "Portable Network Graphics" },
    ".pdf": { mimeType: "application/pdf", kindOfDocument: "Adobe Portable Document Format (PDF)" },
    ".php": { mimeType: "application/php", kindOfDocument: "Hypertext Preprocessor (Personal Home Page)" },
    ".ppt": { mimeType: "application/vnd.ms-powerpoint", kindOfDocument: "Microsoft PowerPoint" },
    ".pptx": { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kindOfDocument: "Microsoft PowerPoint (OpenXML)" },
    ".rtf": { mimeType: "application/rtf", kindOfDocument: "Rich Text Format (RTF)" },
    ".sh": { mimeType: "application/x-sh", kindOfDocument: "Bourne shell script" },
    ".svg": { mimeType: "image/svg+xml", kindOfDocument: "Scalable Vector Graphics (SVG)" },
    ".swf": { mimeType: "application/x-shockwave-flash", kindOfDocument: "Small web format (SWF) or Adobe Flash document" },
    ".tar": { mimeType: "application/x-tar", kindOfDocument: "Tape Archive (TAR)" },
    ".tif": { mimeType: "image/tiff", kindOfDocument: "Tagged Image File Format (TIFF)" },
    ".tiff": { mimeType: "image/tiff", kindOfDocument: "Tagged Image File Format (TIFF)" },
    ".txt": { mimeType: "text/plain", kindOfDocument: "Text, (generally ASCII or ISO 8859-n)" },
    ".wav": { mimeType: "audio/wav", kindOfDocument: "Waveform Audio Format" },
    ".xhtml": { mimeType: "application/xhtml+xml", kindOfDocument: "XHTML" },
    ".xls": { mimeType: "application/vnd.ms-excel", kindOfDocument: "Microsoft Excel" },
    ".xlsx": { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kindOfDocument: "Microsoft Excel (OpenXML)" },
    ".xml": { mimeType: "application/xml", kindOfDocument: "XML(if not readable from casual users (RFC 3023, section 3))" },
    ".xml": { mimeType: "text/xml", kindOfDocument: "XML(if readable from casual users (RFC 3023, section 3))" },
    ".zip": { mimeType: "application/zip", kindOfDocument: "ZIP archive" }
  }

  var UPLOAD_ALLOWED = {
    pdf: {
      extension: ['pdf'],
      max: 25165824
    },
    text: {
      extension: ['txt', 'xml', 'xsd'],
      max: 25165824
    },
    image: {
      extension: ['jpg', 'jpeg', 'png', 'gif'],
      max: 25165824
    },
    video: {
      extension: ['mp4'], // 'm4p', 'm4v', 'mov',
      max: 25165824
    },
    audio: {
      extension: ['mp3'],
      max: 25165824
    },
    // cf. https://support.office.com/en-us/article/View-Office-documents-online-1CC2EA26-0F7B-41F7-8E0E-6461A104544E
    word: {
      extension: ['docx'/*, 'docm', 'dotm', 'dotx'*/],
      max: 10485760
    },
    excel: {
      extension: ['xlsx'/*, 'xlsb', 'xls', 'xlsm'*/],
      max: 5242880
    },
    powerpoint: {
      extension: ['pptx'/*, 'ppsx', 'ppt', 'pps', 'pptm', 'potm', 'ppam', 'potx', 'ppsm'*/],
      max: 10485760
    }
  };

  return {
    timelineEdit: timelineEdit,
    PUBLIC: PUBLIC,
    href: href,
    home: home,
    setting: setting,
    constants: constants,
    simulation: simulation,
    log: log,
    filter: filter,
    nls: nls,
    current: current,
    notes: notes,
    graph: graph,
    resourceIndexer: resourceIndexer,
    associationIndexer: associationIndexer,
    groupSetting: groupSetting,
    roleSetting: roleSetting,
    miniature: miniature,
    state: state,
    TEMP_OWNER_ID: TEMP_OWNER_ID,
    createGuestCurrentUser: createGuestCurrentUser,
    getCurrentOwnerId: getCurrentOwnerId,
    isTemporaryOwnerId: isTemporaryOwnerId,
    previous: previous,
    undoLog: undoLog,
    redoLog: redoLog,
    MAX_LOG: MAX_LOG,
    MENU_RADIUS: MENU_RADIUS,
    DRG_CNTRL_OFFSET: DRG_CNTRL_OFFSET,
    positions: positions,
    shapes: shapes,
    linkShapes: linkShapes,
    markerShapes: markerShapes,
    strokeDasharray: strokeDasharray,
    fontSizes: fontSizes,
    defaultFont: defaultFont,
    defaultSize: defaultSize,
    defaultStyle: defaultStyle,
    MAX_EXPANDS: MAX_EXPANDS,
    motivations: motivations,
    resourceTypes: resourceTypes,
    mimeTypes: mimeTypes,
    Color: Color,
    actionColor: actionColor,
    colorPalette: colorPalette,
    UPLOAD_ALLOWED: UPLOAD_ALLOWED
  };
})();
// wuwei.common.js 2023-10-23
