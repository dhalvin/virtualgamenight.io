const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const handlebars = require('express-handlebars');
const session = require('express-session');
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const WebSocket = require('ws');
const fs = require('fs');
const url = require('url');

const hostname = '192.168.33.202';
const port = 8080;
const SECRET = 'boyoyoubetterchangethislater';
const app = new express();
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
 
// parse application/json
app.use(bodyParser.json())

app.use(session({
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: true
  }
}));
app.engine('hbs', handlebars({extname: '.hbs', defaultLayout: 'layout', layoutsDir: __dirname + '/views/layouts'}));
app.set('view engine', 'hbs');
app.set('views', __dirname + "/views");
app.use(express.static('public'));

app.get('/', function(req, res){
  //If we are already in the room, don't join again
  if('userID' in req.session){
    res.redirect('/app');
  }
  //Render the page with any errors that exist
  else{
    if('error' in req.session){
      res.render('index', {title: 'Hangout Online', error: req.session.error});
      delete req.session.error;
    }
    else{
      res.render('index', {title: 'Hangout Online'});
    }
  }
});

app.get('/app', function(req, res){
  //If there is a userID in session, let WS connect
  if('userID' in req.session){
    res.render('app', {title: 'Hangout Room'});
  }
  //Else need to create name
  else{
    res.redirect('/');
  }
});
app.post('/app', function(req, res){
  //TODO Sanitize data...
  //Person is in room with name
  if(UserList.includes(req.body.displayName)){
    req.session.error = 'Someone is already using that name in this room!';
    res.redirect('/');
  }
  //Person is returning to room by name
  else if(req.body.displayName in usersByName){
    var oldSID = usersByName[req.body.displayName].sid;
    users[req.session.id] = users[oldSID];
    delete users[oldSID];
    req.session.userID = users[req.session.id].id;
    res.redirect('/app');
  }
  //New name provided
  else{
    var id = wsServer.getUniqueID();
    req.session.userID = id;
    users[req.session.id] = {id: id, sid: req.session.id, displayName: req.body.displayName, playerColor: req.body.playerColor};
    usersByName[req.body.displayName] = users[req.session.id];
    res.redirect('/app');
  }
});

const server = app.listen(port, () => LogMessage('Server Started'));
const wsServer = new WebSocket.Server({
  server: server
});
var shouldLog = false;
function LogMessage(message){
  if(shouldLog){
    for(arg of arguments){
      console.log(arg);
    }
  }
}
/****************************************************************************/
/*  Room Logic Starts Here *************************************************/
/**************************************************************************/

var UserList = [];
const users = {};
const usersByName = {};
const clients = {};
const SyncObjectFactory = require('./SyncableObjects.js');
SyncObjectFactory.hostname = hostname;
SyncObjectFactory.port = port;

function GetObject(uid){
  return SyncObjectFactory.ObjectCollection[uid];
}

wsServer.getUniqueID = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};

wsServer.broadcastFromClient = function(sender, message) {
  for(client in clients){
    if(client != sender){
      //LogMessage("Sending " + message + " to " + client);
      clients[client].socket.send(message);
    }
  }
}
wsServer.broadcast = function(message) {
  for(client in clients){
    clients[client].socket.send(message);
  }
}

wsServer.on("connection", function(socket, req){
  
  var sid = cookieParser.signedCookie(cookie.parse(req.headers.cookie)['connect.sid'], SECRET);
  var id = users[sid].id;
  LogMessage('sid: ' + sid);
  LogMessage('id: ' + id);
  clients[id] = {socket: socket, user: users[sid], sessionID : sid};
  for(objID in SyncObjectFactory.ObjectCollection){
    socket.send(JSON.stringify({type: "createObject", uid: objID, objType: GetObject(objID).objType, objData: GetObject(objID).objData}));
  }
  LogMessage('New client ' + id + ' connected');
  LogMessage('Hello ' + users[sid].displayName);
  UserList.push(users[sid].displayName);
  wsServer.broadcast(JSON.stringify({type: 'userUpdate', users: UserList}));
  socket.on("message", function(message){
    //LogMessage(message);
    var data = JSON.parse(message);
    if(data.type == "toggleLog")
    {
      shouldLog = !shouldLog;
    }
    else if(data.type == "moveRequest"){
      //Check that user who sent request is allowed
      if(!GetObject(data.uid).get('user') || GetObject(data.uid).get('user') == users[sid].displayName){
          LogMessage('Update user validated');
          //Update position
          GetObject(data.uid).get('pos').x = data.moveData.left;
          GetObject(data.uid).get('pos').y = data.moveData.top;
          //Send back move update
          data.type = 'moveObject';
          wsServer.broadcastFromClient(id, JSON.stringify(data));
      }
      else{
          console.log('Incorrect User. Disregarding update...');
      }
    }
    else if(data.type == "pushUpdateRequest")
    {
      if(SyncObjectFactory.ObjectCollection[data.uid]){
        LogMessage("Received Push Update Request: " + data.uid);
        for(key in data.objData){LogMessage('-->'+key+',',data.objData[key]);}
        
        var updateData = {};
        //If no current user, then set user
        if(!GetObject(data.uid).get('user')){
          GetObject(data.uid).set('user', users[sid].displayName);
          
          updateData.user = {};
          Object.assign(updateData.user, GetObject(data.uid).objData.user);
          updateData.user.value = users[sid].displayName;
        }
        //Check that user who sent request is current user
        if(GetObject(data.uid).get('user') == users[sid].displayName){
          LogMessage('Update user validated');
          //Check for object release
          if('releaseUser' in data.objData && data.objData['releaseUser'].value){
            GetObject(data.uid).set('lastUser', users[sid].displayName);
            updateData.lastUser = GetObject(data.uid).objData['lastUser'];
            GetObject(data.uid).set('user', null);
            updateData.user = GetObject(data.uid).objData['user'];
          }
          //Update trusted fields
          for(attr in data.objData){
            if(attr in GetObject(data.uid).objData){
              if(GetObject(data.uid).objData[attr].clientTrust){
                GetObject(data.uid).set(attr, data.objData[attr].value);
              }
              //if(data.objData[attr]){
              //  GetObject(data.uid).set(attr, data.objData[attr].value);
              //}
              updateData[attr] = GetObject(data.uid).objData[attr];
            }
          }
          //If user add user
          if('user' in GetObject(data.uid).objData){
            updateData.user = GetObject(data.uid).objData.user;
          }
          
          //If not moving or locked no need to keep user
          if('moving' in GetObject(data.uid).objData && !GetObject(data.uid).get('moving') && 'locked' in GetObject(data.uid).objData && !GetObject(data.uid).get('locked')){
            GetObject(data.uid).set('lastUser', users[sid].displayName);
            updateData.lastUser = GetObject(data.uid).objData['lastUser'];
            GetObject(data.uid).set('user', null);
            updateData.user = GetObject(data.uid).objData['user'];
          }
          //Send to appropriate clients
          data.type = "updateObject";
          data.objData = updateData;
          if(data.updateSelf){
            LogMessage('Sending update to all of', data.objData);
            wsServer.broadcast(JSON.stringify(data));
          }
          else{
            LogMessage('Sending update to (nearly) all of', data.objData);
            wsServer.broadcastFromClient(id, JSON.stringify(data));
          }
        }
        else{
          LogMessage('Incorrect User. Disregarding update...');
        }
      }
    }
    else if(data.type =="canvasStroke"){
      wsServer.broadcastFromClient(id, message);
    }
    else if(data.type == "createRequest"){
      LogMessage("Received Create Request: " + data.objType);
      for(key in data.objData){LogMessage('-->'+key+',',data.objData[key]);}
      var uid = 0;
      if('uid' in data){
        uid = data.uid;
      }
      else{
        uid = SyncObjectFactory.getUniqueObjID();
      }
      SyncObjectFactory.CreateObject(uid, data.objType, data.objData, function(newObj){
        if(uid in SyncObjectFactory.ProcessingObjects){
          //LogMessage("finished processing " +uid);
          delete SyncObjectFactory.ProcessingObjects[uid];
        }
        SyncObjectFactory.ObjectCollection[uid] = newObj;
        LogMessage('1. Adding to collection: ', newObj.objData);
        LogMessage('2. Adding to collection: ', SyncObjectFactory.ObjectCollection[uid].objData);
        wsServer.broadcast(JSON.stringify({type: "createObject", uid: uid, objType: data.objType, objData: newObj.objData}));
      });
    }
    else if(data.type == "deleteRequest"){
      //LogMessage("Received Delete Request: " + data.uid);
      delete SyncObjectFactory.ObjectCollection[data.uid];
      wsServer.broadcast(JSON.stringify({type: "deleteObject", uid: data.uid}));
    }
    else if(data.type == "pullUpdateRequest"){
      LogMessage("Received Pull Update Request: " + data.uid);
      //LogMessage("Pull request... here is all the objects right now: ");
      //for(uid in SyncObjectFactory.ObjectCollection){LogMessage(uid);}
      tryGetUpdate(data.uid, socket);
    }

  });

  socket.on("error", function(error){
  });

  socket.on("close", function(){
    LogMessage('Client ' + id + ' has disconnected');
    UserList.splice(UserList.indexOf(users[sid].displayName), 1);
    wsServer.broadcast(JSON.stringify({type: 'userUpdate', users: UserList}));
  });
  
});

function tryGetUpdate(uid, socket)
{
  LogMessage("Trying to get update for " + uid);
  if(uid in SyncObjectFactory.ProcessingObjects){
    LogMessage("gotta wait");
    setTimeout(tryGetUpdate, 100, uid, socket);
  }
  else{
    socket.send(JSON.stringify({type: "updateObject", uid: uid, objData: GetObject(uid).objData}));
  }
}

var cardmanUid = SyncObjectFactory.getUniqueObjID();
SyncObjectFactory.CreateObject(cardmanUid, 'CardManager', {styleName: {value: "Default"}}, function(newObj){
  if(cardmanUid in SyncObjectFactory.ProcessingObjects){
    //LogMessage("finished processing " +uid);
    delete SyncObjectFactory.ProcessingObjects[cardmanUid];
  }
  SyncObjectFactory.ObjectCollection[cardmanUid] = newObj;
  var deckUid = SyncObjectFactory.getUniqueObjID();
  SyncObjectFactory.CreateObject(deckUid, 'Deck', {parentManager: {value: cardmanUid}, pos: {value: {x: 300, y: 300}}}, function(newDeck){
    //console.log("ObjectCollection Right after completed ", newDeck.objData);
    console.log("New Deck Right after completed ", newDeck.objData);
    if(deckUid in SyncObjectFactory.ProcessingObjects){
      //LogMessage("finished processing " +uid);
      delete SyncObjectFactory.ProcessingObjects[deckUid];
    }
    SyncObjectFactory.ObjectCollection[deckUid] = newDeck;
  }); 
});