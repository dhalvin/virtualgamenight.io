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
  return {type: 'createRequest', uid: uid, objType: objType, objData: objData};
}
function deleteObjectRequest(uid){
  if(ClientObjectCollection[uid]){
    ClientObjectCollection[uid].style.visibility = 'hidden';
  }
  return {type: 'deleteRequest', uid: uid};
}

function pullUpdateObjectRequest(uid){
  return {type: 'pullUpdateRequest', uid: uid};
}
function pushUpdateObjectRequest(uid, objData, updateSelf=false){
  return {type: 'pushUpdateRequest', uid: uid, objData: objData, updateSelf: updateSelf};
}
function moveObjectRequest(uid, moveData){
  return {type: 'moveRequest', uid: uid, moveData: moveData};
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

function SendRequests(requests){
  if(requests.length > 0){
    console.log("Sending Requests: ", requests);
    ws.send(JSON.stringify({requests: requests}));
  }
}
//A Click anywhere except the context menu closes the context menu
window.addEventListener("mousedown", function(event){
  var cm = document.getElementById('context-menu');
  if(event.target !== cm && !cm.contains(event.target)){
    ClearDealGhosts();
    $('#context-menu').removeClass("show");
  }
});

VGNIO.Room.ContextMenuSpecs = {
  default: {
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
            {text: "Add New Deck", type: 'default', action: function(event){
              SendRequests([createObjectRequest('Deck', {pos: clientToRoomPosition({x: event.target.clientX, y: event.target.clientY})})]);
            }},
            {text: "Reset Room", type: 'default', action: function(event){
              alert("Reset Room");
            }}
          ]
        }
      }
    }
  }
}
$('#room').contextmenu(function(event){
  if(event.pointerType != "touch"){
    VGNIO.ShowContextMenu('Room', Object.assign(event, {pointerX: (event.pointerX ? event.pointerX : event.clientX), pointerY: (event.pointerY ? event.pointerY : event.clientY)}));
    event.stopPropagation();
  }
  event.preventDefault();
});

var contextTimer = null;
document.getElementById('room').addEventListener('touchstart', function(event) {
  contextTimer = setTimeout(function(event) {
    VGNIO.ShowContextMenu('Room', Object.assign(event, {pointerX: event.touches[0].clientX, pointerY: event.touches[0].clientY}));
  }, 1000, event)
}, false);

document.getElementById('room').addEventListener('touchend', function() {
  if(contextTimer){
    clearTimeout(contextTimer);
    contextTimer = null;
  }
}, false);

document.getElementById('room').addEventListener('touchmove', function() {
  if(contextTimer){
    clearTimeout(contextTimer);
    contextTimer = null;
  }
}, false);

ws.onclose = function(e) {
  $('#room-spinner').show();
  if (e.code != 1000) {
    if (!navigator.onLine) {
      document.getElementById('notifModalText').innerText = "Please check your Internet connection and try again.";
      $('#notifModal').modal('show');
    }
    else{
      document.getElementById('notifModalText').innerText = "Lost connection to server... Try refreshing the page.";
      $('#notifModal').modal('show');
    }
 }
}

ws.onopen = function(e) {
  $('#room-spinner').hide();
}
ws.onmessage = function(e) {
  //console.log(e.data);
  var dataArr = JSON.parse(e.data);
  console.log(dataArr);
  if(Array.isArray(dataArr)){
    for(data of dataArr){
      if(data.user && data.user == MYUSERID && !data.updateSelf){}
      else{
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
          if('xPre' in data.moveData){
            data.moveData.x = data.moveData.xPre + data.moveData.x*VGNIO.Room.Bounds.w;
            delete data.moveData['xPre'];
          }
          else if('x' in data.moveData){
            data.moveData.x = data.moveData.x*VGNIO.Room.Bounds.w;
          }
          if('yPre' in data.moveData){
            data.moveData.y = data.moveData.yPre + data.moveData.y*VGNIO.Room.Bounds.h;
            delete data.moveData['yPre'];
          }
          else if('y' in data.moveData){
            data.moveData.y = data.moveData.y*VGNIO.Room.Bounds.h;
          }
          gsap.to(ClientObjectCollection[data.uid], Object.assign({}, data.moveData));
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
          }
          var $chatBox = $('#chatBox');
          for(msg of RoomInfo.chatlog){
            $chatBox.append(RoomInfo.users[msg.user] + ': ' + msg.msg + '\n');
          }
          $chatBox.scrollTop($chatBox[0].scrollHeight);
          $('#room-spinner').hide();
        }
      }
    }
  }
};

function SendChatMessage(message){
  SendRequests([{type: 'msgRequest', msg: message, updateSelf: true}]);
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