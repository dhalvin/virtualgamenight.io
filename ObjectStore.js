const redis = require('redis'),
redcli = redis.createClient(process.env.REDIS_URI || 'redis://localhost:6379'),
flatten = require('flat'),
unflatten = require('flat').unflatten;
redis.add_command('JSON.SET');
module.exports.GetObject = function(roomid, objectid, callback){
  redcli.send_command('JSON.GET', [roomid+objectid], function(err, reply){
    if(err){callback(0)}
    else if(reply){callback(JSON.parse(reply))}
  });
}

//Properties is array of keys
//Returns object of results
module.exports.GetObjectProperties = function(roomid, objectid, properties, callback){
  redcli.send_command('JSON.GET', [roomid+objectid, properties.join(' ')], function(err, reply){
    if(err){callback(0)}
    else if(reply){callback(JSON.parse(reply))}
  });
}

module.exports.SetObjectProperty = function(roomid, objectid, key, value){
  redcli.send_command('JSON.SET', [roomid+objectid, key, JSON.stringify(value)]);
}

//Properties is object of key/value pairs
module.exports.SetObjectProperties = function(roomid, objectid, properties){
  //console.log('Setting ' + objectid + ' ' + properties);
  commands = []
  for(prop in properties){
    commands.push(['JSON.SET', roomid+objectid, prop, JSON.stringify(properties[prop])]);
  }
  redcli.batch(commands).exec();
}

module.exports.AddObject = function(roomid, object, callback){
  //console.log('Adding ' + object.objType + ' ' + object.uid);
  redcli.send_command('JSON.SET', [roomid+object.uid, '.', JSON.stringify(object)], function(){
    callback();
  });
}

module.exports.DeleteObject = function(roomid, objectid){
  redcli.send_command('JSON.DEL', roomid+objectid);
}