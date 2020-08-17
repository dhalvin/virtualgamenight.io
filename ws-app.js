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
  ObjectStore = require('./ObjectStore'),
  RoomManager = require('./RoomManager');

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
        onRequest[data.type](data, user);
      }
      catch(err){
        console.log('Error processing request: ', message);
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
      RoomManager.UserJoin(user.roomid, user.userid);
      RoomManager.GetObjects(user.roomid, function(roomObjs){
        var newObjMsg = {type: "createObject", objects: []};
        for(newObj of roomObjs){
          newObjMsg.objects.push({uid: newObj.uid, objType: newObj.objType, objData: newObj.objData, noSave: SyncObjectFactory.NoSave[newObj.objType]});
        }
        user.socket.send(JSON.stringify(newObjMsg));
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
      SendMessage(session.roomid, {data: session.displayName + " disconnected from room."});
      delete rooms[session.roomid][user.sid];
      if(Object.keys(rooms[session.roomid]).length == 0){
        delete rooms[session.roomid];
        redsub.unsubscribe('room'+session.roomid);
      }
      RoomManager.UserLeave(user.roomid, userid);
    }
  });
  delete module.exports.connections[user.sid];
}

function onCreateRequest(data, user){
  var uid = data.uid;
  if(!uid){uid = nanoid(4);}
  SyncObjectFactory.CreateObject(user.roomid, uid, data.objType, data.objData, function(newObjArr){
    var newObjMsg = {type: "createObject", objects: []};
    for(newObj of newObjArr){
      newObjMsg.objects.push({uid: newObj.uid, objType: newObj.objType, objData: newObj.objData, noSave: SyncObjectFactory.NoSave[newObj.objType]});
    }
    SendMessage(user.roomid, newObjMsg);
  });
}

function onPushUpdateRequest(data, user){
  ObjectStore.GetObjectProperties(user.roomid, data.uid, ['objType', 'objData.user', 'objData.moving', 'objData.locked'], function(ObjProps){
    //Handles requests for data on the server where the clients do not save it (eg card labels)
    var propsToGet = [];
    for(attr in data.objData){
      if(attr in SyncObjectFactory.NoSave[ObjProps.objType]){
        propsToGet.push('objData.'+attr)
      }
    }
    if(propsToGet.length > 0){
      ObjectStore.GetObjectProperties(user.roomid, data.uid, propsToGet, function(ObjProps2){
        Object.assign(ObjProps, ObjProps2);
        CompleteUpdateRequest(ObjProps);
      });
    }
    else{
      CompleteUpdateRequest(ObjProps);
    }
  });
  function CompleteUpdateRequest(ObjProps){
    //If object doesn't have user, set user
    if(!ObjProps['objData.user']){
      ObjProps['objData.user'] = user.userid;
      ObjectStore.SetObjectProperty(user.roomid, data.uid, 'objData.user', user.userid);
    }
    //Check that the user sending the request is owner
    if(ObjProps['objData.user'] == user.userid){
      updateProps = {};
      //Update trusted fields, discard untrusted fields in send back data
      for(attr in data.objData){
        if(SyncObjectFactory.ClientTrust[attr]){
          if(!SyncObjectFactory.NoSave[ObjProps.objType][attr]){
            updateProps['objData.'+attr] = data.objData[attr];
            if('objData.'+attr in ObjProps){
              ObjProps['objData.'+attr] = data.objData[attr];
            }
          }
        }
        else{
          delete data.objData[attr];
        }
      }
      //Add in requested nosave fields
      for(attr in SyncObjectFactory.NoSave[ObjProps.objType]){
        if('objData.'+attr in ObjProps){
          data.objData[attr] = ObjProps['objData.'+attr];
        }
      }
      //Check release requested
      //If not moving or locked, do not assign user
      if(('releaseUser' in data.objData && data.objData.releaseUser) || 'objData.moving' in ObjProps && !ObjProps['objData.moving'] && 'objData.locked' in ObjProps && !ObjProps['objData.locked']){
        updateProps['objData.lastUser'] = user.userid;
        updateProps['objData.user'] = null;
        data.objData['lastUser'] = user.userid;
        data.objData['user'] = null;
      }
      ObjectStore.SetObjectProperties(user.roomid, data.uid, updateProps);
      data.type = 'updateObject';
      data.user = user.userid;
      data.noSave = SyncObjectFactory.NoSave[ObjProps.objType];
      SendMessage(user.roomid, data);
    }
  }
}

function onMoveRequest(data, user){
  ObjectStore.GetObjectProperties(user.roomid, data.uid, ['objData.user'], function(ObjProps){
    if(!ObjProps['objData.user'] || ObjProps['objData.user'] == user.userid){
      ObjectStore.SetObjectProperty(user.roomid, data.uid, 'objData.pos', data.moveData);
      data.type = 'moveObject';
      data.user = user.userid;
      SendMessage(user.roomid, data);
    }
  });
}

function onPullUpdateRequest(data, user){
  ObjectStore.GetObject(user.roomid, data.uid, function(obj){
    user.socket.send(JSON.stringify({type: 'updateObject', uid: data.uid, objData: obj.objData}));
  });
}

function onDeleteRequest(data, user){
  ObjectStore.GetObjectProperties(user.roomid, data.uid, ['objData.user'], function(ObjProps){
    if(!ObjProps['objData.user'] || ObjProps['objData.user'] == user.userid){
      ObjectStore.DeleteObject(user.roomid, data.uid);
      data.type = 'deleteObject';
      data.user = user.userid;
      SendMessage(user.roomid, data);
    }
  });
}

const onRequest = {
  "moveRequest": onMoveRequest,
  "pushUpdateRequest": onPushUpdateRequest,
  "createRequest": onCreateRequest,
  "deleteRequest": onDeleteRequest,
  "pullUpdateRequest": onPullUpdateRequest
}
