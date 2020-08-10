const WebSocket = require('ws'),
  redis = require('redis'),
  redcli = redis.createClient(process.env.REDIS_URI || 'redis://localhost:6379'),
  redsub = redcli.duplicate(),
  redpub = redcli.duplicate(),
  cookie = require('cookie'),
  cookieParser = require('cookie-parser'),
  common = require('./common');

var wsServer = null;
const rooms = {};
module.exports.start = function(server){
  console.log("Starting WS Server on port " + server.port);
  wsServer =  new WebSocket.Server({server: server});
  setup(wsServer);
  return wsServer;
}

function setup(wss){
  module.exports.connections = {};
  module.exports.connectionCount = 0;
  module.exports.rooms = rooms;
  redsub.on("message", function(channel, message){
    BroadcastToRoom(channel.substring('room'.length), message);
  });
  wss.on("connection", function(socket, req){
    var sid = cookieParser.signedCookie(cookie.parse(req.headers.cookie)['connect.sid'], common.SECRET);
    //var connID = module.exports.connectionCount;
    module.exports.connections[sid] = socket;
    module.exports.connectionCount++;
    redcli.get('sess:'+sid, function(err, reply){
      console.log('test: '+sid);
      if(reply){
        var session = JSON.parse(reply);
        console.log("Client: " + session.displayName + " connected to room " + session.roomid);
        SendMessage(session.roomid, {data: session.displayName + " connected to room."});
        redsub.subscribe('room'+session.roomid);
        if(session.roomid in rooms){
          rooms[session.roomid][sid] = socket;
        }
        else{
          rooms[session.roomid] = {};
          rooms[session.roomid][sid] = socket;
        }
      }
      if(err){
        console.log('Error retrieving session for sid: ' + sid);
        console.log(err);
      }
    });
    socket.on("error", function(error){
      console.log("Client Error: " + error);
    });
    socket.on("close", function(){
      redcli.get('sess:'+sid, function(err, reply){
        if(reply){
          var session = JSON.parse(reply);
          console.log("Client: " + session.displayName + " disconnected from room " + session.roomid);
          SendMessage(session.roomid, {data: session.displayName + " disconnected from room."});
          delete rooms[session.roomid][sid];
          if(Object.keys(rooms[session.roomid]).length == 0){
            delete rooms[session.roomid];
            redsub.unsubscribe('room'+session.roomid);
          }
        }
      });
      delete module.exports.connections[sid];
    });
  });
}

//This broadcasts message even to sender. Sender is responsible for ignoring own messages.
function BroadcastToRoom(roomid, message){
  for(sess in rooms[roomid]){
    rooms[roomid][sess].send(message);
  }
}

function SendMessage(roomid, message){
  redpub.publish('room'+roomid, JSON.stringify(message));
}

function onConnectionClosed(socket){};