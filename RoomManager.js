const redis = require('redis'),
redcli = redis.createClient(process.env.REDIS_URI || 'redis://localhost:6379');

module.exports.LoadRoom = function(){};
module.exports.SaveRoom = function(){};
module.exports.CreateRoom = function(roomid, callback){
  redcli.send_command('JSON.SET', ['room:'+roomid, '.', JSON.stringify({'users': {}, 'objects': {}, 'chatlog': []}), 'NX'], function(err, reply){
    if(err){
      console.log(err);
    }
    else if(reply){
      callback(reply);
    }
  });
};
module.exports.RoomExists = function(roomid, callback){
  redcli.send_command('JSON.TYPE',['room:'+roomid],function(err, reply){
    if(reply === 'null'){
      callback(false);
    }
    else{
      callback(true);
    }
  });
}
module.exports.RegisterObject = function(roomid, objectid){
  redcli.send_command('JSON.SET', ['room:'+roomid, 'objects["'+objectid+'"]', JSON.stringify(1)]);
};
module.exports.UnregisterObject = function(roomid, objectid){
  redcli.send_command('JSON.DEL', ['room:'+roomid, 'objects["'+objectid+'"]']);
};
module.exports.UserJoin = function(roomid, userid, displayName, callback){
  redcli.send_command('JSON.SET', ['room:'+roomid, 'users["'+userid+'"]', JSON.stringify(displayName)], callback);
};
module.exports.UserLeave = function(roomid, userid){
  redcli.send_command('JSON.DEL', ['room:'+roomid, 'users["'+userid+'"]']);
};

module.exports.GetUsers = function(roomid, callback){
  redcli.send_command('JSON.GET', ['room:'+roomid, 'users'], function(err, reply){
    if(err){
      console.log(err);
    }
    else if(reply){
      callback(JSON.parse(reply));
    }
  });
}

module.exports.AppendChat = function(roomid, message){
  redcli.send_command('JSON.ARRAPPEND', ['room:'+roomid, 'chatlog', JSON.stringify(message)]);
}

module.exports.RetrieveRoomDetails = function(roomid, callback){

  redcli.send_command('JSON.GET', ['room:'+roomid, 'chatlog'], function(err, reply){
    if(err){
      console.log(err);
      callback(0);
    }
    module.exports.GetUsers(roomid, function(users){
      callback({users: users, chatlog: JSON.parse(reply)})
    });
  });
}
//EXPENSIVE
module.exports.GetObjects = function(roomid, callback){
  redcli.send_command('JSON.OBJKEYS', ['room:'+roomid, 'objects'], function(err, reply){
    if(err){
      console.log(err);
    }
    else if(reply){
      if(reply.length > 0){
        for(var i = 0; i < reply.length; i++){
          reply[i] = roomid+reply[i];
        }
        redcli.send_command('JSON.MGET', reply.concat(['.']), function(err1, reply1){
          for(var i = 0; i < reply1.length; i++){
            reply1[i] = JSON.parse(reply1[i]);
          }
          callback(reply1);
        });
      }
      else{
        callback([]);
      }
    }
  });
}