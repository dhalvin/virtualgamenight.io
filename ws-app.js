const WebSocket = require('ws'),
  redis = require('redis'),
  redcli = redis.createClient(process.env.REDIS_URI || 'redis://localhost:6379'),
  redsub = redcli.duplicate(),
  redpub = redcli.duplicate(),
  cookie = require('cookie'),
  cookieParser = require('cookie-parser'),
  common = require('./common')
  SyncObjectFactory = require('./SyncableObjects'),
  ObjectStore = require('./ObjectStore'),
  RoomManager = require('./RoomManager'),
  Requests = require('./RequestManager');

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
      try{
        Requests.onRequest[data.type](data, user);
      }
      catch(err){
        console.log('Error processing request: ', message, err);
      }
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
module.exports.SendMessage = SendMessage;

function onUserConnected(user){
  module.exports.connections[user.sid] = user.socket;
  redcli.get('sess:'+user.sid, function(err, reply){
    if(reply){
      var session = JSON.parse(reply);
      console.log("Client: " + session.displayName + " connected to room " + session.roomid);
      SendMessage(session.roomid, {type: 'userUpdate', action: 'join', user: session.userid, displayName: session.displayName});
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
      RoomManager.UserJoin(user.roomid, user.userid, user.displayName, function(){
        RoomManager.RetrieveRoomDetails(user.roomid, function(roomdetails){
          var data = {type: 'RoomInit', users: roomdetails.users, chatlog: roomdetails.chatlog};
          user.socket.send(JSON.stringify(data));
        });
        RoomManager.GetObjects(user.roomid, function(roomObjs){
          var newObjMsg = {type: "createObject", objects: []};
          for(newObj of roomObjs){
            newObjMsg.objects.push({uid: newObj.uid, objType: newObj.objType, objData: newObj.objData, noSave: SyncObjectFactory.NoSave[newObj.objType]});
          }
          user.socket.send(JSON.stringify(newObjMsg));
        });
      });
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
      SendMessage(session.roomid, {type: 'userUpdate', action: 'leave', user: session.userid, displayName: session.displayName});
      delete rooms[session.roomid][user.sid];
      if(Object.keys(rooms[session.roomid]).length == 0){
        delete rooms[session.roomid];
        redsub.unsubscribe('room'+session.roomid);
      }
      RoomManager.UserLeave(user.roomid, user.userid);
    }
  });
  delete module.exports.connections[user.sid];
}
