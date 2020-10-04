const SyncObjectFactory = require('./SyncableObjects'),
ObjectStore = require('./ObjectStore'),
RoomManager = require('./RoomManager'),
WSServer = require('./ws-app'),
{ nanoid } = require('nanoid');

module.exports.onCreateRequest = function(data, user, responses, callback){
  var uid = data.uid;
  if(!uid){uid = nanoid(4);}
  SyncObjectFactory.CreateObject(user.roomid, uid, data.objType, data.objData, function(newObjArr){
    var newObjMsg = {type: "createObject", objects: []};
    for(newObj of newObjArr){
      newObjMsg.objects.push({uid: newObj.uid, objType: newObj.objType, objData: newObj.objData, noSave: SyncObjectFactory.NoSave[newObj.objType]});
    }
    responses.push(newObjMsg);
    callback();
    //WSServer.SendMessage(user.roomid, newObjMsg);
  });
}
  
module.exports.onPushUpdateRequest = function(data, user, responses, callback){
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
          data.objData[attr] = ObjProps['objData.'+attr];
          //delete data.objData[attr];
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
      responses.push(data);
      callback();
      //WSServer.SendMessage(user.roomid, data);
    }
  }
}
  
module.exports.onMoveRequest = function(data, user, responses, callback){
  ObjectStore.GetObjectProperties(user.roomid, data.uid, ['objData.user'], function(ObjProps){
    if(!ObjProps['objData.user'] || ObjProps['objData.user'] == user.userid){
      ObjectStore.SetObjectProperty(user.roomid, data.uid, 'objData.pos', data.moveData);
      data.type = 'moveObject';
      data.user = user.userid;
      responses.push(data);
      callback();
      //WSServer.SendMessage(user.roomid, data);
    }
  });
}
  
module.exports.onPullUpdateRequest = function(data, user, responses, callback){
  ObjectStore.GetObject(user.roomid, data.uid, function(obj){
    user.socket.send(JSON.stringify([{type: 'updateObject', uid: data.uid, objData: obj.objData}]));
  });
}
  
module.exports.onDeleteRequest = function(data, user, responses, callback){
  ObjectStore.GetObjectProperties(user.roomid, data.uid, ['objData.user'], function(ObjProps){
    if(!ObjProps['objData.user'] || ObjProps['objData.user'] == user.userid){
      SyncObjectFactory.DeleteObject(user.roomid, data.uid, function(){
        ObjectStore.DeleteObject(user.roomid, data.uid);
        data.type = 'deleteObject';
        data.user = null;
        responses.push(data);
        callback();
        //WSServer.SendMessage(user.roomid, data);
      });
    }
  });
}

module.exports.onMessageRequest = function(data, user, responses, callback){
  data.time  = new Date().getTime();
  data.user = user.userid;
  RoomManager.AppendChat(user.roomid, {'user': user.userid, 'time': data.time, 'msg': data.msg});
  responses.push(data);
  callback();
  //WSServer.SendMessage(user.roomid, data);
}

module.exports.PushUpdate = function(roomid, data){
  data.type = 'updateObject';
  WSServer.SendMessage(roomid, [data]);
}

module.exports.onRequest = {
  "moveRequest": module.exports.onMoveRequest,
  "pushUpdateRequest": module.exports.onPushUpdateRequest,
  "createRequest": module.exports.onCreateRequest,
  "deleteRequest": module.exports.onDeleteRequest,
  "pullUpdateRequest": module.exports.onPullUpdateRequest,
  "msgRequest": module.exports.onMessageRequest
}

module.exports.handleRequests = function(data, user){
  var r = 0;
  var responses = [];
  module.exports.onRequest[data.requests[r].type](data.requests[r], user, responses, function(){
    function nextResponse(){
      r++;
      if(r < data.requests.length){
        module.exports.onRequest[data.requests[r].type](data.requests[r], user, responses, nextResponse);
      }
      else {
        WSServer.SendMessage(user.roomid, responses);
      }
    }
    nextResponse();
  });
}