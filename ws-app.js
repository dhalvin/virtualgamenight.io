const WebSocket = require('ws'),
  redis = require('redis'),
  redcli = redis.createClient(process.env.REDIS_URI || 'redis://localhost:6379'),
  redsub = redcli.duplicate(),
  redpub = redcli.duplicate(),
  cookie = require('cookie'),
  cookieParser = require('cookie-parser'),
  { nanoid } = require('nanoid'),
  common = require('./common')
  SyncObjectFactory = require('./SyncableObjects'),
  ObjectStore = require('./ObjectStore');

var wsServer = null;
const rooms = {};
module.exports.start = function(server){
  wsServer =  new WebSocket.Server({server: server});
  setup(wsServer);
  return wsServer;
}

function setup(wss){
  module.exports.connections = {};
  module.exports.rooms = rooms;
  redsub.on("message", function(channel, message){
    BroadcastToRoom(channel.substring('room'.length), message);
  });
  wss.on("connection", function(socket, req){
    var sid = cookieParser.signedCookie(cookie.parse(req.headers.cookie)['connect.sid'], common.SECRET);
    const user = {
      'sid': sid,
      'socket': socket,
      'displayName': '',
      'userid': '',
      'roomid': ''
    }
    onUserConnected(user);

    socket.on("error", function(error){
      console.log("Client Error: " + error);
    });

    socket.on("close", function(){
      onUserDisconnected(user);
    });

    socket.on("message", function(message){
      var data = JSON.parse(message);
      onRequest[data.type](data, user);
    });
  });
}

//This broadcasts message even to sender. Sender is responsible for ignoring own messages.
function BroadcastToRoom(roomid, message){
  for(sess in rooms[roomid]){
    rooms[roomid][sess].socket.send(message);
  }
}

function SendMessage(roomid, message){
  redpub.publish('room'+roomid, JSON.stringify(message));
}

function onUserConnected(user){
  module.exports.connections[user.sid] = user.socket;
  redcli.get('sess:'+user.sid, function(err, reply){
    if(reply){
      var session = JSON.parse(reply);
      console.log("Client: " + session.displayName + " connected to room " + session.roomid);
      SendMessage(session.roomid, {data: session.displayName + " connected to room."});
      redsub.subscribe('room'+session.roomid);
      if(session.roomid in rooms){
        rooms[session.roomid][user.sid] = user;
      }
      else{
        rooms[session.roomid] = {};
        rooms[session.roomid][user.sid] = user;
      }
      user.displayName = session.displayName;
      user.roomid = session.roomid;
      user.userid = session.userid;
    }
    if(err){
      console.log('Error retrieving session for sid: ' + user.sid);
      console.log(err);
    }
  });
}

function onUserDisconnected(user){
  redcli.get('sess:'+user.sid, function(err, reply){
    if(reply){
      var session = JSON.parse(reply);
      console.log("Client: " + session.displayName + " disconnected from room " + session.roomid);
      SendMessage(session.roomid, {data: session.displayName + " disconnected from room."});
      delete rooms[session.roomid][user.sid];
      if(Object.keys(rooms[session.roomid]).length == 0){
        delete rooms[session.roomid];
        redsub.unsubscribe('room'+session.roomid);
      }
    }
  });
  delete module.exports.connections[user.sid];
}

function onCreateRequest(data, user){
  var uid = data.uid;
  if(!uid){uid = nanoid(4);}
  SyncObjectFactory.CreateObject(user.roomid, uid, data.objType, data.objData, function(newObj){
    ObjectStore.AddObject(user.roomid, newObj);
    BroadcastToRoom(user.roomid, JSON.stringify({type: "createObject", uid: uid, objType: data.objType, objData: newObj.objData, noSave: SyncObjectFactory.NoSave[data.objType]}));
  });
}

function onPushUpdateRequest(data, user){}
function onMoveRequest(data, user){}
function onPullUpdateRequest(data, user){}
function onDeleteRequest(data, user){}
const onRequest = {
  "moveRequest": onMoveRequest,
  "pushUpdateRequest": onPushUpdateRequest,
  "createRequest": onCreateRequest,
  "deleteRequest": onDeleteRequest,
  "pullUpdateRequest": onPullUpdateRequest
}
