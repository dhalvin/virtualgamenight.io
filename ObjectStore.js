const redis = require('redis'),
redcli = redis.createClient(process.env.REDIS_URI || 'redis://localhost:6379'),
flatten = require('flat'),
unflatten = require('flat').unflatten;

module.exports.GetObject = function(roomid, objectid, callback){
  redcli.hgetall(roomid+objectid, function(err, value){
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
  args = [roomid+object.uid];
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
    args.push(attr);
    args.push(flatObj[attr]);
  }
  redcli.hmset(args);
}

module.exports.DeleteObject = function(roomid, objectid){
  redcli.del(roomid+objectid);
}