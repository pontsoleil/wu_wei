/**
 * wuwei.data.js
 * data module
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.data = (function () {
  const common = wuwei.common,
    state = common.state,
    stateMap = {
      status: null,
      socket: null,
      anon_user: null,
      is_connected: false,
      room: null,
      members: {},
      user: null,
      chatee: null,
      // message
      message: {},
      // note
      note_id: null,
      note_map: {}
    },
    configMap = {
      MONITOR: true,
      NOTE_ID: null,
      CHAT_MODE: null,
      ROOM: null, // note_id
      USER_ID: null,
      USERID: null,
      anon_id: null,
      clearChat: function () { }
    };
  let model,
    draw,
    menu,
    personProto,
    People,
    Note,
    Chat;
  // Utility
  //
  const isEmpty = (v) => {
    return undefined === v || null === v || '' === v;
  }

  const notEmpty = (v) => {
    return !isEmpty(v);
  }

  const isArray = (v) => {
    if (undefined === v || null === v || '' === v) { return false; }
    return '[object Array]' === Object.prototype.toString.call(v);
  }

  const isObject = (v) => {
    if (undefined === v || null === v || '' === v) { return false; }
    return '[object Object]' === Object.prototype.toString.call(v);
  }

  const deleteFromArray = (array, element) => {
    var index = array.indexOf(element);
    if (index >= 0) {
      array.splice(index, 1);
      return true;
    }
    return false;
  }

  const deleteFromArrayByid = (array, element) => {
    var index = -1, i;
    for (i = array.length - 1; i >= 0; i--) {
      if (element.id === array[i].id) {
        index = i;
        break;
      }
    }
    if (index >= 0) {
      array.splice(index, 1);
      return true;
    }
    return false;
  };

  const replaceElement = (items, item, newItem) => {
    var index = items.indexOf(item);
    if (~index) {
      items[index] = newItem;
    }
  };

  const ioAvailable = () => {
    var socket = stateMap.socket;
    return notEmpty(socket);
  }

  const ioUnavailable = () => {
    return !ioAvailable();
  }

  const isShared = (initial) => {
    var is_shared, _socket = null;
    if (ioUnavailable()) { return false; }
    _socket = getSocket();
    if (notEmpty(_socket)) {
      _socket = _socket.socket;
    }
    is_shared = notEmpty(configMap.USER_ID) && configMap.USER_ID > 0;
    if (initial) {
      return is_shared;
    }
    is_shared = is_shared && state.chatMode.active && 'disabled' !== state.chatMode.active;
    return is_shared;
  }

  // Pub/Sub Pattern event handler
  // see https://gist.github.com/learncodeacademy/777349747d8382bfb722
  const Events = {
    subscribers: new Map(),
    subscribe(name, fn) {
      if (typeof fn !== 'function') {
        throw new Error('Second parameter must be a function');
      }
      if (typeof name !== 'string') {
        throw new Error('First parameter must be a string');
      }
      if (!this.subscribers.has(name)) {
        this.subscribers.set(name, new Map());
      }
      if (fn.name === '') {
        throw new Error('Function cannot be annonymous')
      } else {
        this.subscribers.get(name).set(fn.name, fn)
      }
    },
    unsubscribe(name, fnName) {
      if (this.subscribers.has(name)) {
        if (this.subscribers.get(name).get(fnName)) {
          this.subscribers.get(name).delete(fnName);
          this.subscribers.get(name).size === 0 ? this.subscribers.delete(name) : null;
        } else {
          throw new Error(`Subscriber "${fnName}" not found`);
        }
      } else {
        return false;
      }
    },
    publish(name, data) {
      if (this.subscribers.has(name)) {
        this.subscribers.get(name).forEach(fn => fn(data));
      } else {
        return false;
      }
    }
  };

  // functions
  const connectIo = (namespace) => {
    // local function
    const publishSocketStatus = (status) => {
      console.log('-- socket status %s', status);
      if (state.chatMode.active) {
        Events.publish('socket-status', status);
      }
    };

    const toJoin = (data) => {
      console.log(data.value);
      /** {
        login: "kcua"
        user_id: "d5d14711-fc69-4711-95b3-79a635884d00"
        name: "京都芸大"
        role: ""
        room: "a06312f1abab47a696cd88d5c8a70226"
        socket_id: "/wuwei#F_8uh_J_zQf9IqwbAAAB"
      } */
      let user = data.value;
      if (user) {
        let user_id = user.user_id,
          chatDiv = document.getElementById('chat'),
          entryMessage = user.name + "さんが入室しました。";
        chatDiv.classList.remove('w3-hide');
        chatDiv.classList.add('w3-show');
        wuwei.menu.chat.markup.appendMsg(entryMessage);
        stateMap.members[user_id] = user;
      }
    }

    const userList = (data) => {
      console.log(data.value);
      let userMap = data.value,
        memberDiv = document.getElementById('member'),
        memberListDiv = document.getElementById('memberList');
      memberDiv.classList.remove('w3-hide');
      memberDiv.classList.add('w3-show');
      memberListDiv.innerHTML = '';
      for (let socketid in userMap) {
        let user = userMap[socketid];
        if (user) {
          let user_id = user.user_id;
          user.socketid = socketid;
          stateMap.members[user_id] = user;
          let entryMessage = user.name;
          wuwei.menu.chat.markup.appendMember(entryMessage);
        }
      }
    }

    const toLoad = (data) => {
      let value = data.value;
      try {
        value = JSON.parse(value);
        let sender = value.sender;
        if (sender && sender.name) {
          menu.chat.markup.appendMsg(`${sender.name}さん　ノートを読み込みました`);
        }
        value = value.value;
        model.toLoad(value);
        draw.refresh();
      }
      catch (e) { console.log(e); }
    }

    const toCreate = (data) => {
      let value = data.value;
      try {
        value = JSON.parse(value);
        let sender = value.sender;
        if (sender && sender.name) {
          menu.chat.markup.appendMsg(`${sender.name}が作成`);
        }
        value = value.value;
        model.toCreate(value);
        draw.refresh();
      }
      catch (e) { console.log(e); }
    }

    const toModify = (data) => {
      let value = data.value;
      try {
        value = JSON.parse(value);
        let sender = value.sender;
        if (sender && sender.name) {
          menu.chat.markup.appendMsg(`${sender.name}が変更`);
        }
        value = value.value;
        model.toModify(value);
        draw.refresh();
      }
      catch (e) { console.log(e); }
    }

    const toRemove = (data) => {
      let value = data.value;
      try {
        value = JSON.parse(value);
        let sender = value.sender;
        if (sender && sender.name) {
          menu.chat.markup.appendMsg(`${sender.name}が削除`);
        }
        value = value.value;
        model.toRemove(value);
        draw.refresh();
      }
      catch (e) { console.log(e); }
    }

    const toRefresh = (data) => {
      let value = data.value;
      try {
        value = JSON.parse(value);
        // sender = stateMap.members[value.sender];
        // menu.chat.markup.appendMsg(`${sender.name}が更新`);
      }
      catch (e) { console.log(e); }
    }

    if (stateMap.socket) {
      return stateMap.socket;
    }
    state.chatMode.active = true;
    // let socket;
    try {
      if (io) {
        const socket = io('/' + namespace);
        // socket status
        socket.on('connecting', function (data) {
          console.info(data);
          stateMap.status = 'connecting'; publishSocketStatus(stateMap.status);
        });
        socket.on('connect', function (data) {
          console.info(data);
          stateMap.status = 'connect'; publishSocketStatus(stateMap.status);
        });
        socket.on('connect_failed', function (data) {
          console.info(data);
          stateMap.status = 'connect_failed'; publishSocketStatus(stateMap.status);
        });
        socket.on('disconnect', function (data) {
          console.info(data);
          stateMap.status = 'disconnect'; publishSocketStatus(stateMap.status);
        });
        socket.on('reconnecting', function (data) {
          console.info(data);
          stateMap.status = 'reconnecting'; publishSocketStatus(stateMap.status);
        });
        socket.on('reconnect', function (data) {
          console.info(data);
          stateMap.status = 'reconnect'; publishSocketStatus(stateMap.status);
        });
        socket.on('reconnect_failed', function (data) {
          console.info(data);
          stateMap.status = 'reconnect_failed'; publishSocketStatus(stateMap.status);
        });
        socket.on('connect_error', function (data) {
          console.info(data);
          stateMap.status = 'reconnect_failed'; publishSocketStatus(stateMap.status);
        });
        // chat
        socket.on('to_join', (data) => {
          toJoin(data);
        });
        socket.on('user_list', (data) => {
          userList(data);
        });
        socket.on('to_client', (data) => {
          menu.chat.markup.appendMsg(data.value);
        });
        // draw
        socket.on('to_load', (data) => {
          toLoad(data);
        });
        socket.on('to_create', (data) => {
          toCreate(data);
        });
        socket.on('to_update', (data) => {
          toModify(data);
        });
        socket.on('to_delete', (data) => {
          toRemove(data);
        });
        socket.on('to_refresh', (data) => {
          toRefresh(data);
        });
        stateMap.socket = socket;
        stateMap.status = 'ioOK';
        publishSocketStatus(stateMap.status);
        return stateMap.socket;
      }
      return null;
    }
    catch (e) {
      console.log(e.toString());
      stateMap.status = 'ioNG';
      publishSocketStatus(stateMap.status);
      if (state.chatMode.active && 'disabled' !== state.chatMode.active) {
        console.error(e.toString());
      }
      return null;
    }
  }

  function getSocket() { return stateMap.socket; };
  function getStatus() { return stateMap.status; };

  personProto = {
    get_is_user: function () {
      return this.user_id === stateMap.user && stateMap.user.user_id;
    },
    get_is_anon: function () {
      return this.userid === stateMap.anon_user && stateMap.anon_user.userid;
    }
  };

  function clearMembers() {
    var user = stateMap.user;
    stateMap.members = {};
    if (user) {
      stateMap.members[user.userid] = user;
    }
  }

  function completeRegister(data) {
    if (configMap.MONITOR) { console.debug('completeRegister \n', data); }
    var
      user_data = data[0],
      user,
      userid = user_data.userid;
    user = stateMap.members[userid];
    Chat.join(user);
    stateMap.members[userid] = user;
    stateMap.user = user;
    Events.publish('register', [stateMap.user]);
  };

  function completeDeregister(data) {
    if (configMap.MONITOR) { console.debug('completeDeregister \n', data); }
    var
      user_data = data[0],
      user,
      userid = user_data.userid;
    user = stateMap.members[userid];
    Chat.leave(user); // leave_chat()
    delete stateMap.members[userid];
    stateMap.user = stateMap.anon_user;
    clearMembers();
    Events.publish('deregister', [stateMap.user]);
  };

  function completeJoin(data) {
    if (configMap.MONITOR) { console.debug('completeJoin \n', data); }
    /** {
      "event":"to_client_join",
      "room":"note01",
      "userid":"wuwei",
      "name":"wuwei",
      "sid":"36jr1u6ECevbXMMlAAAG",
      "is_online":true,
      "timestamp":"2019-03-14T02:13:26.002Z",
      "members":{
        "nobu":{"sid":"1pRFNuEzxjlqC-SnAAAB","user":{"room":"note01","userid":"nobu","name":"nobu","is_onlune":true}},
        "wuwei":{"sid":"36jr1u6ECevbXMMlAAAG","user":{"room":"note01","userid":"wuwei","name":"wuwei","is_onlune":true}}
      }
    }*/
    var userid, user, member, sid, members = {};
    userid = data.userid;
    if (notEmpty(userid)) {
      user = People.set_user(data.members[userid].user);
      Events.publish('join', user);
    }
    wuwei.util.copyObject(data.members, members);
    for (userid in members) {
      if (members.hasOwnProperty(userid)) {
        member = members[userid];
        user = member.user;
        sid = member.sid;
        user.sid = sid;
        stateMap.members[userid] = user;
      }
    }
  };

  function completeRejoin(data) {
    if (configMap.MONITOR) { console.debug('completeRejoin \n', data); }
    var userid = data.userid;
    if (notEmpty(userid)) {
      let user = People.set_user(data);
      Events.publish('rejoin', user);
    }
  };

  function completeLeave(data) {
    if (configMap.MONITOR) { console.debug('completeLeave \n', data); }
    Object.keys(stateMap.members).forEach(function (key) {
      delete stateMap.members[key];
    });
    configMap.clearChat(); // Clear chat pane
    stateMap.chatee = null;
    Chat.set_chatee('');
  };

  function makePerson(person_map) {
    var
      person,
      keys, i,
      key, value,
      userid = person_map.userid;// || person_map.cid; //cid for anon user

    if (userid === undefined) {
      console.warn('client id required');
      return null;
    }

    person = Object.create(personProto);

    if (person && person_map) {
      keys = Object.keys(person_map);
      for (i = keys.length - 1; i >= 0; i--) {
        key = keys[i];
        value = person_map[key];
        if (notEmpty(value)) {
          person[key] = value;
        }
      }
    }

    stateMap.members[userid] = person;
    return person;
  };

  function removePerson(person) {
    if (!person) { return false; }
    if (person._id === configMap.anon_id) {
      // cannot remove anonymous person
      return false;
    }
    if (person.userid && stateMap.members[person.userid]) {
      delete stateMap.members[person.userid];
    }
    return true;
  };

  People = (function _people() {
    var
      get_user,
      set_user,
      remove,
      list,
      register,
      deregister;

    get_user = function (userid) {
      if (isEmpty(userid)) {// return all user
        return stateMap.user;
      }
      if (notEmpty(userid)) {
        return stateMap.members[userid];
      }
      return null;
    };

    set_user = function (user_data) {
      var
        userid,
        user;
      userid = user_data.userid;
      if (notEmpty(userid)) {
        user = get_user(userid);
      } else {
        return null;
      }
      if (isEmpty(user)) {
        user = makePerson({
          userid: user_data.userid,
          name: user_data.name,
          room: user_data.room,
          tapped: user_data.tapped,
          is_online: user_data.is_online
        });
        return user;
      }
      wuwei.util.copyObject(user_data, user);
      stateMap.user = stateMap.members[userid] = user;
      return user;
    };

    remove = function (user_data) {
      return removePerson(user_data);
    };

    list = function () {
      return stateMap.members;
    };

    register = function (user_data) {
      var
        user,
        userid,
        initial;

      stateMap.is_connected = true;

      stateMap.user = makePerson(user_data);

      if (configMap.MONITOR) { console.info('registeruser > makePerson \nstateMap.user:\n', stateMap.user); }

      userid = user_data.userid;
      // initial = true;
      // if (isShared(initial)) {
      user = People.get_user(userid);
      stateMap.socket.emit('register', user, function (user_data) {
        console.info('-- register->\n', user_data);
        if (isEmpty(user_data.error)) {
          People.set_user({
            'userid': user_data.userid,
            'user_id': user_data.user_id,
            'name': user_data.name,
            'room': user_data.room
          });
        } else {
          console.warn('register' + user_data.error);
        }
        completeRegister([user_data]);
      });
    };

    deregister = function (user_data) {
      var
        user,
        userid,
        username,
        initial;

      userid = user_data.userid;
      username = user_data.username;
      initial = true;
      if (isShared(initial)) {
        console.info('>> from user#%s %s sendDeregister emit register_user', userid, username);
        user = People.get_user(userid);
        stateMap.socket.emit('deregister', user, function (user_data) {
          console.info('-- deregister->\n', user_data);
          if (isEmpty(user_data.error)) {
            completeDeregister([user_data]);
          } else {
            console.warn('deregister' + user_data.error);
          }
        });
      }
    };

    return {
      get_user: get_user,
      set_user: set_user,
      remove: remove,
      register: register,
      deregister: deregister,
      list: list
    };
  }());

  function getNote(noteid) {
    // if (configMap.MONITOR) {console.debug('> getNote noteid=' + noteid); }
    if (notEmpty(noteid)) {
      return stateMap.note_map[noteid];
    }
    return stateMap.note_map;
  };

  function makeNote(note_data) {
    /*
     * note_data = {
     *   noteid
     *   etc.
     * }
     */
    if (configMap.MONITOR) { console.debug('> makeNote', note_data); }
    if (isEmpty(note_data)) {
      console.warn('makeNote parameter contents is EMPTY.');
      return null;
    }
    var newNote = {};

    wuwei.util.copyObject(note_data, newNote);
    stateMap.note = newNote;
    return newNote;
  };

  function updateNote(note_data) {
    if (configMap.MONITOR) { console.debug('> updateNote', note_data); }
    if (isEmpty(note_data)) {
      console.warn('updateNote note_data is EMPTY.');
      return null;
    }
    var
      noteid = note_data.noteid,
      note;
    note = getNote(noteid);
    if (note) {
      wuwei.util.copyObject(note_data, note);
      configMap.Global.OWNER_ID = note.ownerId;
      if (configMap.isNumber(configMap.Global.OWNER_ID)) {
        configMap.Global.OWNER_ID = 0 | configMap.Global.OWNER_ID;
      }
      configMap.Global.OWNER_NAME = note.ownerName;
    } else {
      return null;
    }
    return note;
  };

  function removeNote(noteid) {
    if (configMap.MONITOR) { console.debug('> removeNote noteid=' + noteid); }
    if (isEmpty(noteid)) { return false; }
    if (notEmpty(stateMap.note_map[noteid])) {
      delete stateMap.note_map[noteid];
    }
    return true;
  };

  Note = (function _note() {
    var
      get_by_pid,
      get_note,
      empty, init, list,
      add, update, remove,
      migrate;

    get_by_pid = function (noteid) {
      return stateMap.note_map[noteid];
    };

    get_note = function () { return stateMap.note; };

    empty = function () {
      stateMap.note_map = {};
      stateMap.nodeEdges_indexer = {};
      stateMap.coreEdges_indexer = {};
      stateMap.headNode_indexer = {};
      stateMap.headCore_indexer = {};
      stateMap.log = {};
      stateMap.redoLog = {};
      stateMap.previousCores = {};
      stateMap.previousNodes = {};
      stateMap.person_map = {};
    };

    init = function (note_data) {
      if (isEmpty(configMap.Global)) { return; }
      /* note_data = {
       *   noteid,
       *   note
       *   etc.
       */
      if (configMap.MONITOR) { console.debug('> note.init \nnote_data:\n', note_data); }
      var
        ownerId,
        ownerName,
        pid, pname, _Page, layers,
        newNote;

      if (isEmpty(note_data)) {
        console.warn('>note.init note_data is EMPTY.');
        return false;
      }
      pid = note_data.noteid;
      if (isEmpty(pid)) {
        console.warn('>note.init noteid is EMPTY.');
        return false;
      }
      pname = note_data.note;
      _Page = note_data.Page;
      layers = note_data.layers;

      if (isEmpty(layers)) {
        ownerId = note_data.ownerId || configMap.Global.USER_ID || 0;
        ownerName = note_data.ownerName || configMap.Global.USER_NAME || '';
        newNote = stateMap.note_map[pid] = {
          'noteid': pid,
          'notename': pname,
          'ownerId': ownerId,
          'ownerName': ownerName,
          'Page': _Page || {},
          'layers': layers || {}
        };
        return newNote;
      }

      newNote = makeNote(note_data);

      return newNote;
    };

    list = function (noteid) {
      var notes;
      notes = stateMap.note_map;
      if (wuwei.util.isEmptyObject(notes)) {
        console.warn('Note.list EMPTY notes');
        return null;
      }
      if (notEmpty(noteid)) {
        return getNote(noteid);
      }
      return notes;
    };

    add = function (note_data) {
      var
        noteid = note_data.noteid,
        newNote;
      if (configMap.MONITOR) { console.debug('> Note.add', note_data); }
      if (isEmpty(note_data)) {
        console.warn('Note.add note_data is EMPTY.');
        return null;
      }

      newNote = makeNote(note_data);

      newNote.version = configMap.Global.VERSION;
      stateMap.note_map[noteid] = newNote;
      return newNote;
    };

    remove = function (noteid) {
      if (configMap.MONITOR) { console.debug('> Note.remove noteid=', noteid); }
      if (isEmpty(noteid)) {
        console.warn('Note.remove noteid is EMPTY.');
        return false;
      }
      var ret;
      ret = removeNote(noteid);
      return ret;
    };

    update = function (note_data) {
      if (configMap.MONITOR) { console.debug('> Note.update', note_data); }
      if (isEmpty(note_data)) {
        console.warn('Note.update note_data is EMPTY.');
        return null;
      }
      var ret;
      ret = updateNote(note_data);
      return ret;
    };

    return {
      get_by_pid: get_by_pid,
      get_note: get_note,
      empty: empty,
      init: init,
      list: list,
      add: add,
      update: update,
      remove: remove
    };
  }());

  Chat = (function _chat() {
    var
      note_id,
      // function
      init,
      setRoom,
      list_user, check_user,
      join_chat, leave_chat, rejoin_chat,
      get_chatee, send_msg, set_chatee;

    stateMap.chatee = null;

    // Begin internal methods
    const _message = (data) => {
      console.log(data);
    };

    const _personal = (data) => {
      console.log(data);
    };

    const _connect_socket = (namespace, callback) => {
      var socket = connectIo(namespace);
      if (callback && 'function' === typeof callback) {
        callback(socket);
      }
      return socket;
    };

    const _update_list = (arg_list) => {
      var
        users_data,
        i,
        person_map,
        person,
        is_chatee_online = false,
        note, layer;

      if (isEmpty(arg_list[0])) { return; }

      document.querySelector('.mark').classList.remove('present');

      users_data = arg_list[0].users_data;
      if (isEmpty(users_data)) { return; }
      for (i = users_data.length - 1; i >= 0; i--) {
        person_map = users_data[i];

        if (notEmpty(person_map)) {
          document.querySelector('#mark_' + person_map.userid).classList.add('present');

          note = Note.list(pid);
          if (notEmpty(note) && notEmpty(note.layers)) {
            layer = note.layers[person_map.userid];

            if (wuwei.util.isEmptyObject(layer)) {
              layer = Layer.init({
                'note_id': configMap.TAO.id,
                'userid': person_map.userid,
                'uuid': person_map.uuid,
                'username': person_map.username
              });
            } else {
              if (isEmpty(layer.username)) {
                layer.username = person_map.username;
              }
            }
          }

          // if user defined, update css_map and skip remainder
          if (isEmpty(stateMap.user) || // new
            (notEmpty(person_map.userid) &&
              notEmpty(person_map.name) &&
              stateMap.user.user_id !== person_map.user_id)) {
            person = makePerson(person_map);
            if (stateMap.chatee && stateMap.chatee.userid === person_map.uesrid) {
              is_chatee_online = true;
              stateMap.chatee = person;
            }
          }
        }
      }
      // If stateMap.chatee is no longer online, we unset the stateMap.chatee
      // which triggers the 'set-chatee' global event
      if (stateMap.chatee && !is_chatee_online) {
        set_chatee(null);
      }
    };

    const _userlist = (data) => {
      if (configMap.MONITOR) { console.debug('_userlist', data); }
      if (data !== stateMap.message[data.sender_id]) {
        stateMap.message[data.sender_id] = data;
        _update_list(data);
        Events.publish('userlist', data);
      }
    };

    const _usercheck = (data) => {
      if (configMap.MONITOR) { console.debug('_usercheck', data); }
      if (data !== stateMap.message[data.sender_id]) {
        stateMap.message[data.sender_id] = data;
        Events.publish('usercheck', data);
      }
    };

    const _userjoin = (data) => {
      if (configMap.MONITOR) { console.debug('_userjoin', data); }
      if (isEmpty(data.error)) {
        People.set_user(data);
        Events.publish('join', data);
      }
    };

    const _userleave = (data) => {
      if (configMap.MONITOR) { console.debug('_userleave', data); }
      var data;
      if (data !== stateMap.message[data.sender_id]) {
        stateMap.message[data.userid] = data;
        Events.publish('leave', data);
      }
    };

    const _chatupdate = (data) => {
      if (configMap.MONITOR) { console.debug('_chatupdate', data); }
      Events.publish('chatupdate', data);
    };
    // End internal methods

    leave_chat = function (user_data) {
      if (configMap.MONITOR) { console.debug('leave_chat \nuser_data:\n', user_data); }
      var
        userid,
        user;
      note_id = user_data.note_id;
      userid = user_data.userid;

      stateMap.chatee = null;
      stateMap.is_connected = false;

      if (isShared()) {
        user = People.get_user(userid);
        stateMap.socket.emit('leave', user, function (user_data) {
          console.info('-- leave->\n', user_data);
          if (isEmpty(user_data.error)) {
            completeLeave(user_data);
          } else {
            console.warn('leave ERROR:' + JSON.stringify(user_data.error));
          }
        });
      }
    };

    join_chat = function (user_data) {
      /** user_data = {
        login: currentUser.login,
        user_id: currentUser.user_id,
        name: currentUser.name,
        role: currentUser.role,
        room: room
      } */
      if (configMap.MONITOR) { console.debug('Chat.join \n', user_data); }
      if (stateMap.socket) {
        stateMap.socket.emit('join', user_data, function (data) {
          console.info('-- join callback ->\n', data);
          if (isEmpty(data.error)) {
            completeJoin(data);
          } else {
            console.error(data.error);
            console.warn('join:' + JSON.stringify(data.error));
          }
        });
      } else {
        console.error('socket not defined');
      }
    };

    rejoin_chat = function () {
      var
        user,
        userid,
        user_id,
        initial;

      initial = true;
      if (isShared(initial)) {
        userid = configMap.USERID;
        user_id = configMap.USER_ID;
        user = People.get_user(userid);
        if (configMap.MONITOR) { console.debug('rejoin_chat \nuser:\n', user); }
        stateMap.socket.emit('rejoin', user, function (user_data) {
          console.info('-- rejoin->\n', user_data);
          if (isEmpty(user_data.error)) {
            completeRejoin(user_data);
          } else {
            console.warn('rejoin ERROR:' + user_data.error);
          }
        });
      }
    };

    send_msg = function (message) {
      var
        user, room,
        chat_map;
      if (isEmpty(stateMap.socket)) { return false; }
      user = stateMap.user;
      room = stateMap.room;
      chat_map = {
        'room': room,
        'dest_id': stateMap.chatee.userid,
        'dest_name': stateMap.chatee.name,
        'userid': user.userid,
        'name': user.name,
        'message': message
      };
      _chatupdate(chat_map);
      stateMap.socket.emit('update_chat', chat_map, function (data) {
        console.info('<- to_client_chat_update data:', data);
      });
    };

    get_chatee = function () { return stateMap.chatee; };

    set_chatee = function (chatee) {
      if (chatee) {
        if (stateMap.chatee && stateMap.chatee.userid === chatee.userid) {
          return false;
        }
        if (stateMap.user.userid === chatee.userid) {
          return false;
        }
      }
      Events.publish('set-chatee',
        { old_chatee: stateMap.chatee, new_chatee: chatee }
      );
      stateMap.chatee = chatee;
      return true;
    };

    list_user = function () {
      var
        msg_map;

      if (configMap.TAO &&
        configMap.TAO.id &&
        configMap.TEAM) {
        note_id = configMap.TAO.id;
        room_name = note_id;
      } else {
        room_name = '';
      }
      if (isShared()) {
        msg_map = {
          'room': room_name,
          'user': stateMap.user
        };
        console.debug('list_user \nmsg_map:\n', msg_map);

        stateMap.socket.emit('list_user', msg_map, function (user_data) {
          console.info('-- list_user\t-> \nuser_data:\n', user_data);
          Events.publish('userlist', user_data);
        });
      }
    };

    check_user = function (note_id, userids) {
      var
        msg_map;

      if (note_id &&
        configMap.TAO &&
        configMap.TAO.id) {
        note_id = configMap.TAO.id;
      }
      msg_map = {
        'room': configMap.ROOM,
        'senderId': configMap.USERID,
        'userids': userids
      };
      if (isShared()) {
        stateMap.socket.emit('check_user', msg_map, function (message) {
          console.info('-- check_user\t-> %s', message);
        });
      }
    };

    setRoom = function (room) {
      stateMap.room = room;
    }

    init = function (namespace) {
      var socket = _connect_socket(namespace || '');
      if (!stateMap.socket) { return false; }
      socket.on('to_client', _message);
      socket.on('personal', _personal);
      socket.on('client_join', _userjoin);

      socket.on('to_client_userlist', _userlist);
      socket.on('to_client_check', _usercheck);
      socket.on('to_client_register', completeRegister);
      socket.on('to_client_deregister', completeDeregister);
      socket.on('to_client_leave', _userleave);
      socket.on('to_client_disconnect', _userleave);
      socket.on('to_client_join', _userjoin);
      socket.on('to_client_rejoin', _userjoin);
      socket.on('to_client_chat_update', _chatupdate);
    };

    return {
      init: init,
      setRoom: setRoom,
      listuser: list_user,
      checkuser: check_user,
      join: join_chat,
      rejoin: rejoin_chat,
      leave: leave_chat,
      get_chatee: get_chatee,
      send_msg: send_msg,
      set_chatee: set_chatee
    };
  }()); // Chat

  // Begin public method /initModule/
  const initModule = () => {
    console.log('wuwei.data.initModule()');
    model = wuwei.model;
    draw = wuwei.draw;
    menu = wuwei.menu;
    stateMap.chatee = { userid: 'all', name: 'All' };
    Events.subscribe('socket-status', SocketStatus = (data) => console.log(`SocketStatus ${JSON.stringify(data)}`));
  };

  return {
    stateMap: stateMap,
    Chat: Chat,
    Events: Events,
    connectIo: connectIo,
    getStatus: getStatus,
    getSocket: getSocket,
    initModule: initModule
  };
}());
// wuwei.data.js

