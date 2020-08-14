const redis = require('redis'),
redcli = redis.createClient(process.env.REDIS_URI || 'redis://localhost:6379'),
flatten = require('flat'),
unflatten = require('flat').unflatten;

module.exports.GetObject = function(roomid, objectid, callback){
  redcli.hgetall(roomid+objectid, function(err, value){
    for(attr in value){
      if(value[attr] === '~true'){
        value[attr] = true;
      }
      else if(value[attr] === '~false'){
        value[attr] = false;
      }
    }
    callback(unflatten(value));
  });
}

//Properties is array of keys
module.exports.GetObjectProperties = function(roomid, objectid, properties, callback){
  redcli.hmget(roomid+objectid, properties, function(err, reply){
    if(err){callback(0)}
    else if(reply){callback(reply)}
  });
}

//Properties is object of key/value pairs
module.exports.SetObjectProperties = function(roomid, objectid, properties){
  args = [roomid+objectid];
  for(attr in properties){
    args.push(attr);
    args.push(properties[attr]);
  }
  redcli.hmset(args);
}

module.exports.AddObject = function(roomid, object, callback){
  flatObj = flatten(object);
  args = [roomid+object.uid];
  for(attr in flatObj){
    if(flatObj[attr] != null && !(Array.isArray(flatObj[attr]) && flatObj[attr].length == 0)){
      args.push(attr);
      if(flatObj[attr] === false){
        args.push('~false');
      }
      else if(flatObj[attr] === true){
        args.push('~true');
      }
      else{
        args.push(flatObj[attr]);
      }
      
      
    }
  }
  redcli.hmset(args);
}

module.exports.DeleteObject = function(roomid, objectid){
  redcli.del(roomid+objectid);
}