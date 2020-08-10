const WebSocket = require('ws');
var wsServer = null;
module.exports.start = function(server){
  console.log("Starting WS Server on port " + server.port);
  wsServer =  new WebSocket.Server({server: server});
  setup(wsServer);
  return wsServer;
}

function setup(wss){
  module.exports.connections = {};
  module.exports.connectionCount = 0;
  wss.on("connection", function(socket, req){
    var connID = module.exports.connectionCount;
    module.exports.connections[connID] = socket;
    module.exports.connectionCount++;
    console.log("Client Connected...")
    socket.on("error", function(error){
      console.log("Client Error: " + error);
    });
    socket.on("close", function(){
      delete module.exports.connections[connID];
      console.log("Client Disconnected...");
    });
  });
}

function onConnectionClosed(socket){};