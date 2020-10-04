const RoomInfo = {users: {}, chatlog: []};
const ObjectCollection = {};
const ClientObjectCollection = {};
const AnimationUnit = 25;

VGNIO.Room = {
  AspectRatio: 16/9,
  TargetRoomSize: {w: 1920, h: 1080},
  Bounds: {w: 0, h: 0},
  ScreenSize: {w: window.innerWidth, h: window.innerHeight},
  ClientSizeMult: 1
};

function ResizeRoom(){
  VGNIO.Room.ScreenSize.w = window.innerWidth;
  VGNIO.Room.ScreenSize.h = window.innerHeight;
  if(VGNIO.Room.ScreenSize.w / VGNIO.Room.AspectRatio > VGNIO.Room.ScreenSize.h){
    VGNIO.Room.Bounds.w = VGNIO.Room.ScreenSize.h * VGNIO.Room.AspectRatio;
    VGNIO.Room.Bounds.h = VGNIO.Room.ScreenSize.h;
  }
  else{
    VGNIO.Room.Bounds.w = VGNIO.Room.ScreenSize.w;
    VGNIO.Room.Bounds.h = (VGNIO.Room.ScreenSize.w / VGNIO.Room.AspectRatio);
  }
  VGNIO.Room.ClientSizeMult = VGNIO.Room.Bounds.w/VGNIO.Room.TargetRoomSize.w;
  var room = document.getElementById('room');
  room.style.width = VGNIO.Room.Bounds.w + 'px';
  room.style.height = VGNIO.Room.Bounds.h + 'px';
  var roomBounds = room.getBoundingClientRect();
  VGNIO.Room.Bounds.x = roomBounds.x;
  VGNIO.Room.Bounds.y = roomBounds.y;

  for(objID in ClientObjectCollection){
    var obj = ClientObjectCollection[objID];
    if('pos' in ObjectCollection[obj.uid].objData){
      MoveObject(obj, VGNIO.GetObjAttr(obj.uid, 'pos'));
    }
    if('resize' in obj){obj.resize();}
  }
}
window.addEventListener('resize', ResizeRoom);
ResizeRoom();

function UpdateObject(uid, objData, noSave){
  var clientObj = ClientObjectCollection[uid];
  for(updateFunction of clientObj.updateFunctions){
    updateFunction(objData);
  }
  var obj = ObjectCollection[uid];
  for(attr in objData){
    if(!(attr in noSave)){
      console.log('Saving ' + attr + ' to ' + uid, objData[attr]);
      console.log('Before: ', obj.objData[attr]);
      obj.objData[attr] = objData[attr];
      console.log('After: ', obj.objData[attr]);
    }
  }
}

function createObjectRequest(objType, objData, uid=null){
  console.log("Sending create object request for: " + objType, objData);
  ws.send(JSON.stringify({type: 'createRequest', uid: uid, objType: objType, objData: objData}));
}
function deleteObjectRequest(uid){
  if(ClientObjectCollection[uid]){
    ClientObjectCollection[uid].style.visibility = 'hidden';
  }
  console.log("Sending delete object request for: " + uid);
  ws.send(JSON.stringify({type: 'deleteRequest', uid: uid}));
}
function pullUpdateObjectRequest(uid){
  console.log("Sending pull update object request for: " + uid);
  ws.send(JSON.stringify({type: 'pullUpdateRequest', uid: uid}));
}
function pushUpdateObjectRequest(uid, objData, updateSelf=false){
  console.log("Sending push update object request for: " + uid, objData);
  ws.send(JSON.stringify({type: 'pushUpdateRequest', uid: uid, objData: objData, updateSelf: updateSelf}));
}
function moveObjectRequest(uid, moveData){
  console.log('sending move obj req', uid, moveData);
  ws.send(JSON.stringify({type: 'moveRequest', uid: uid, moveData: moveData}));
}
function strokeOnCanvas(uid, lineWidth, lineColor, start, end){
    var context = ObjectCollection[uid].canvas.getContext("2d");
    context.beginPath();
    context.lineWidth = lineWidth;
    context.strokeStyle = lineColor;
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
}

//A Click anywhere except the context menu closes the context menu
window.addEventListener("mousedown", function(event){
  var cm = document.getElementById('context-menu');
  if(event.target !== cm && !cm.contains(event.target)){
    $('#context-menu').removeClass("show");
  }
});

assignInputClickEvent($('#stack-explode'), function(event){
  var currentContext = ClientObjectCollection[document.getElementById('stack-menu').currentContext];
  var cards = VGNIO.GetObjAttr(currentContext.uid, 'cards');
  var tl = gsap.timeline({onStart: function(){
    deleteObjectRequest(currentContext.uid);
  }});
  tl.pause();
  tl.set({}, {}, '>0.2');
  var stackBounds = currentContext.getBoundingClientRect();
  var RoomBounds = document.getElementById('room').getBoundingClientRect();
  var xMin = Math.max(-500*VGNIO.Room.ClientSizeMult, RoomBounds.x - stackBounds.x);
  var yMin = Math.max(-500*VGNIO.Room.ClientSizeMult, RoomBounds.top - stackBounds.top);
  var xMax = Math.min(500*VGNIO.Room.ClientSizeMult,  RoomBounds.right - stackBounds.right);
  var yMax = Math.min(500*VGNIO.Room.ClientSizeMult,  RoomBounds.bottom - stackBounds.bottom);
  for(var i = 0; i < cards.length; i++){
    const card = cards[i];
    var cardObj = ClientObjectCollection[card];
    var randX = xMin + Math.random()*(xMax-xMin);
    var randY = yMin + Math.random()*(yMax-yMin);
    tl.to(cardObj, {duration: 1, x: '+='+randX, top: '+='+randY, rotation: 0, ease: 'power4', 
    onStart: function(x, y){
      var serverLoc = ClientToServerPos({x: x, y: y});
      moveObjectRequest(card, {duration: 1, xPre: '+=', x: serverLoc.x, topPre: '+=', top: serverLoc.y, rotation: 0, ease: 'power4'});
    },onStartParams: [randX, randY]}, '<');
  }
  tl.resume();
  document.getElementById('stack-menu').currentContext = null;
});

VGNIO.Room.ContextMenuSpecs = {
  room_section: function(){
    return {
      attribute: null,
      condition: null,
      name: "Room",
      getTarget: function(event){
        return {clientX: event.clientX, clientY: event.clientY};
      },
      items: function(){
        return [
          {text: "Add New Deck", action: function(event){
            createObjectRequest('Deck', {pos: clientToRoomPosition({x: event.target.clientX, y: event.target.clientY})});
          }},
          {text: "Reset Room", action: function(event){
            alert("Reset Room");
          }}
        ]
      }
    }
  }
}
$('#room').contextmenu(function(event){
  VGNIO.ShowContextMenu('Room', Object.assign(event, {pointerEvent: {clientX: event.clientX, clientY: event.clientY}}));
  event.preventDefault();
  event.stopPropagation();
});

ws.onmessage = function(e) {
  //console.log(e.data);
  var data = JSON.parse(e.data);
  console.log(data);
  if(data.user && data.user == MYUSERID && !data.updateSelf){return;}
  if(data.type == "canvasStroke"){
    strokeOnCanvas(data.uid, data.lineWidth, data.lineColor, data.start, data.end);
  }
  if(data.type == "createObject"){
    console.log("Received Create Object Request: " , data);
    for(obj of data.objects){
      if(!(obj.uid in ObjectCollection))
      {
        VGNIO.CreateClientObject(obj.uid, obj.objType, obj.objData, obj.noSave);
        //pullUpdateObjectRequest(data.uid);
      }
      else
      {
        console.log("Object " + obj.uid + " already exists...");
      }
    }
  }
  if(data.type == "deleteObject"){
    //console.log("Received Delete Request: " + data);
    var clientObj = ClientObjectCollection[data.uid];
    for(deleteFunction of clientObj.deleteFunctions){
      deleteFunction();
    }
    //clientObj.parentNode.removeChild(ClientObjectCollection[data.uid]);
    clientObj.remove();
    delete ClientObjectCollection[data.uid];
    delete ObjectCollection[data.uid];
  }
  if(data.type == "updateObject"){
    //console.log("Received Update Request: " + data.uid);
    //console.log(data);
    UpdateObject(data.uid, data.objData, data.noSave);
  }
  if(data.type == "moveObject"){
    console.log("Move reqeust rcvd", data);
    gsap.to(ClientObjectCollection[data.uid], {duration: data.moveData.duration, x: data.moveData.xPre + data.moveData.x*VGNIO.Room.Bounds.w, y: data.moveData.yPre + data.moveData.y*VGNIO.Room.Bounds.h, rotation: data.moveData.rotation, ease: data.moveData.ease});
  }
  if(data.type == "userUpdate"){
    if(data.action == "join"){
      RoomInfo.users[data.user] = data.displayName;
      var userStatusElem = document.getElementById('userstatus'+data.user);
      if(userStatusElem){
        userStatusElem.classList.remove('text-muted');
      }
      else{
        $('#userList').append('<li id=userstatus'+data.user+' class="nav-item">'+RoomInfo.users[data.user]+'</li>');
      }
      var $chatBox = $('#chatBox');
      $chatBox.append(data.displayName  + ' has joined the room\n');
      $chatBox.scrollTop($chatBox[0].scrollHeight);
    }
    else if(data.action == "leave"){
      document.getElementById('userstatus'+data.user).classList.add('text-muted');
      var $chatBox = $('#chatBox');
      $chatBox.append(data.displayName  + ' has left the room\n');
      $chatBox.scrollTop($chatBox[0].scrollHeight);
    }
  }
  if(data.type == "msgRequest"){
    var $chatBox = $('#chatBox');
    $chatBox.append(RoomInfo.users[data.user]  + ': ' + data.msg + '\n');
    $chatBox.scrollTop($chatBox[0].scrollHeight);
  }
  if(data.type == "RoomInit"){
    RoomInfo.users = data.users;
    RoomInfo.chatlog = data.chatlog;
    var $userList = $('#userList');
    for(user in RoomInfo.users){
      $userList.append('<li id=userstatus'+user+' class="nav-item'+(data.activeUsers[user] ? '' : ' text-muted')+'">'+RoomInfo.users[user]+'</li>');
      //$('#collapseUser').height('auto');
    }
    var $chatBox = $('#chatBox');
    for(msg of RoomInfo.chatlog){
      $chatBox.append(RoomInfo.users[msg.user] + ': ' + msg.msg + '\n');
    }
    $chatBox.scrollTop($chatBox[0].scrollHeight);
  }
};

function SendChatMessage(message){
  ws.send(JSON.stringify({type: 'msgRequest', msg: message, updateSelf: true}));
}

$('#button-chatSend').on('click', function(){
  var msg = $('#chatInput').val();
  if(msg){
    SendChatMessage(msg);
    $('#chatInput').val('');
  }
});

//Press Enter to send message
$('#chatInput').bind('keypress', function(e){
  if(e.keyCode==13){
    var msg = $('#chatInput').val();
    if(msg){
      SendChatMessage(msg);
      $('#chatInput').val('');
    }
  }
});