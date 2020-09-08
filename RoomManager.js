const redis = require('redis'),
redcli = redis.createClient(process.env.REDIS_URI || 'redis://localhost:6379'),
mysql = require('mysql'),
dbCon = mysql.createConnection({
  host: process.env.MYSQL_URI,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: 'vgnio',
  multipleStatements: true
});
redis.add_command('JSON.DEL');
module.exports.LoadRoom = function(roomid, callback){
  dbCon.query('SELECT * FROM RoomItems WHERE RoomItems.roomid = ?; SELECT * FROM UserRoom WHERE UserRoom.roomid = ?; SELECT * FROM Chat WHERE roomid = ? ORDER BY sentTime', [roomid, roomid, roomid], function(error, results, fields){
    if(!error){
      room = {users: {}, objects: {}, chatlog: []};
      for(item of results[0]){
        room.objects[item.itemid] = 1;
        redcli.send_command('JSON.SET', [roomid+item.itemid, '.', "{\"roomid\":\""+roomid+"\",\"uid\":\""+item.itemid+"\",\"objType\":\""+item.type+"\",\"objData\":"+item.data+"}"], function(){});
      }
      for(user of results[1]){
        room.users[user.userid] = user.displayName;
      }
      for(chat of results[2]){
        room.chatlog.push({'user': chat.userid, 'time': chat.sentTime, 'msg': chat.msg});
      }
      redcli.send_command('JSON.SET', ['room:'+roomid, '.', JSON.stringify(room), 'NX'], function(err, reply){
        if(err){
          console.log(err);
        }
        else if(reply){
          callback(reply);
        }
      });
    }
    else{
      console.log(error);
      callback(false);
    }
  });
};
module.exports.UnloadRoom = function(roomid, callback){
  dbCon.query('REPLACE INTO Room (id, expire) VALUES (?, ?)', [roomid, new Date().getTime() + 604800000], function(error, result, fields){
    module.exports.RetrieveRoomDetails(roomid, function(room){
      for(user in room.users){
        dbCon.query('REPLACE INTO UserRoom (roomid, userid, displayName) VALUES (?, ?, ?)', [roomid, user, room.users[user]]);
      }
      for(chat of room.chatlog){
        dbCon.query('INSERT IGNORE INTO Chat (roomid, userid, sentTime, msg) VALUES (?, ?, ?, ?)', [roomid, chat.user, chat.time, chat.msg]);
      }
      redcli.expire('room:'+roomid, 30);
      module.exports.GetObjects(roomid, function(objs){
        for(obj of objs){
          let objUid = obj.uid;
          dbCon.query('REPLACE INTO RoomItems (roomid, itemid, type, data) VALUES (?, ?, ?, ?)', [roomid, obj.uid, obj.objType, JSON.stringify(obj.objData)], function(error, result, fields){
            redcli.expire(roomid+objUid, 30);
          });
        }
      });
    })
  });
};
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
    //If not in redis, try db
    if(reply === null){
      //Returns 1 if room is in db, 0 otherwise
      dbCon.query('SELECT COUNT(1) FROM Room WHERE id = ?', [roomid], function(error, result, fields){
        callback(result[0]['COUNT(1)']);
      });
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
  redcli.send_command('JSON.TYPE',['room:'+roomid],function(err, reply){
    if(reply === null){
      module.exports.LoadRoom(roomid, function(){
        redcli.send_command('JSON.SET', ['room:'+roomid, 'users["'+userid+'"]', JSON.stringify(displayName)], callback);
      });
    }
    else{
      redcli.send_command('JSON.SET', ['room:'+roomid, 'users["'+userid+'"]', JSON.stringify(displayName)], callback);
    }
  });
};
module.exports.UserLeave = function(roomid, userid){
  redcli.send_command('JSON.DEL', ['room:'+roomid, 'users["'+userid+'"]'], function(){
    redcli.send_command('JSON.OBJLEN', ['room:'+roomid, 'users'], function(err, reply){
      if(reply === 0){
        module.exports.UnloadRoom(roomid);
      }
    });
  });
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