//var currentDraggable = null;
var dragOffset = null;
var currentColor = '#000000';
const CardSize = {w: 120, h: 180};
const ObjectCollection = {};
const ClientObjectCollection = {};
var SelectedObject = null;
const AspRat = 16/9;
const FixedRoomSize = {w: 1920, h: 1080};
const RoomSize = {w: 1920, h: 1080};
const ScreenSize = {w: window.innerWidth, h: window.innerHeight};
const AnimationUnit = 25;
var ClientSizeMult = 1;
var LastCursorX = 0;
var LastCursorY = 0;
var stackShiftCursorPos = {x: 0, y: 0};
//var highestZ = 10;
var dragThreshold = 20;
function ResizeRoom(){
  ScreenSize.w = window.innerWidth;
  ScreenSize.h = window.innerHeight;
  if(ScreenSize.w / AspRat > ScreenSize.h){
    RoomSize.w = ScreenSize.h * AspRat;
    RoomSize.h = ScreenSize.h;
  }
  else{
    RoomSize.w = ScreenSize.w;
    RoomSize.h = (ScreenSize.w / AspRat);
  }
  ClientSizeMult = RoomSize.w/FixedRoomSize.w;
  document.getElementById('room').style.width = RoomSize.w + 'px';
  document.getElementById('room').style.height = RoomSize.h + 'px';
  var RoomDivPos = document.getElementById('room').getBoundingClientRect();
  for(objID in ClientObjectCollection){
    var obj = ClientObjectCollection[objID];
    if('pos' in ObjectCollection[obj.uid].objData){
      obj.updateClientPosition(ObjectCollection[obj.uid].get('pos'));
    }
    if('resize' in obj){obj.resize();}
  }
}
window.addEventListener('resize', ResizeRoom);
ResizeRoom();
function ServerToClientPos(pos){
  return {x: RoomSize.w*(pos.x/FixedRoomSize.w) , y: RoomSize.h*(pos.y/FixedRoomSize.h)};
}
function ClientToServerPos(clientPos){
    return {x: FixedRoomSize.w*clientPos.x/RoomSize.w, y: FixedRoomSize.h*clientPos.y/RoomSize.h};
}

function GrabObject(elem){
  MakeSelectedObject(elem);
  elem.dispatchEvent(new CustomEvent('onGrabbed'));
}
function ReleaseObject(elem){
  elem.dispatchEvent(new CustomEvent('onReleased'));
  if(ObjectCollection[elem.uid].get('moving')){
    gsap.to(elem, {duration: 0.1, rotation: 0});
    $(elem).css( 'filter', '');
    ObjectCollection[elem.uid].set('moving', false);
    pushUpdateObjectRequest(SelectedObject.uid, {moving: false});
  }
  DeselectActiveObject();
}
function MakeSelectedObject(elem){
  if(SelectedObject){
    DeselectActiveObject();
  }
  SelectedObject = elem;
}
function DeselectActiveObject(){
  pushUpdateObjectRequest(SelectedObject.uid, {releaseUser: true}, true);
  SelectedObject = null;
}

function UpdateObject(uid, objData){
  var clientObj = ClientObjectCollection[uid];
  for(updateFunction of clientObj.updateFunctions){
    updateFunction(objData);
  }
  var obj = ObjectCollection[uid];
  for(attr in objData){
    if(objData[attr].clientSave){
      console.log('Saving ' + attr + ' to ' + uid, objData[attr]);
      console.log('Before: ', obj.objData[attr]);
      obj.objData[attr] = objData[attr];
      console.log('After: ', obj.objData[attr]);
    }
  }
}

/*function createNewCardManager(styleName){
  createObjectRequest('CardManager', {styleName: {value: styleName}});
}*/
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
function stackLeaveEvent(event){
  UnparentClientObject(SelectedObject);
  gsap.to(SelectedObject, {duration: 0.1, rotation: 5});
  ArrangeStack(event.currentTarget, ObjectCollection[event.currentTarget.uid].get('arrangement'));
  event.currentTarget.removeEventListener('mouseleave', stackLeaveEvent);
}

assignInputMoveEvent(window, function(event){
  var CursorShiftX = event.screenX - LastCursorX;
  var CursorShiftY = event.screenY - LastCursorY;
  LastCursorX = event.screenX;
  LastCursorY = event.screenY;
  var shouldMove = true;
  if(SelectedObject){
    var ElemBounds = SelectedObject.getBoundingClientRect();
    if(!ObjectCollection[SelectedObject.uid].get('moving')){
      $(SelectedObject).css( 'filter', 'drop-shadow('+Math.round(ClientSizeMult*15)+'px '+Math.round(ClientSizeMult*15)+'px '+Math.round(ClientSizeMult*10)+'px #000)');
      gsap.to(SelectedObject, {duration: 0.1, rotation: 5});
      AttachToRoom(SelectedObject);
    }
    if(ObjectCollection[SelectedObject.uid].objType === 'Card'){
      var colliding = getCollidingObjectsOfType(SelectedObject, 'Card');
      var overlappedCard = getClosestOf(SelectedObject, colliding);
      if(overlappedCard && ObjectCollection[overlappedCard.uid].get('parentObj')){
        var stack = ClientObjectCollection[ObjectCollection[overlappedCard.uid].get('parentObj')];
        if(ObjectCollection[stack.uid].get('arrangement') !== 'standard'){
          var hDist;
          var vDist;
          var z = 1;
          var inRange = false;
          var range = 15*ClientSizeMult;
          if(stack.contains(SelectedObject)){
            //hDist = event.clientX - SelectedObject.getBoundingClientRect().x - event.offsetX;
            hDist = event.clientX - stackShiftCursorPos.x;// - SelectedObject.getBoundingClientRect().x - event.offsetX;
            //vDist = event.clientY - SelectedObject.getBoundingClientRect().y - event.offsetY;
            vDist = event.clientY - stackShiftCursorPos.y;// - SelectedObject.getBoundingClientRect().y - event.offsetY;
            if(ObjectCollection[stack.uid].get('arrangement') === 'fanright'){
              if(Math.abs(hDist) >= range){inRange = true;}
              if(hDist < 0){
                z = -1;
              }
            }
            else if(ObjectCollection[stack.uid].get('arrangement') === 'fandown'){
              if(Math.abs(vDist) >= range){inRange = true;}
              if(vDist < 0){
                z = -1;
              }
            }
            else if(ObjectCollection[stack.uid].get('arrangement') === 'fanout'){
              if(Math.abs(hDist) >= range/2 && Math.abs(vDist) >= range/2){
                inRange = true;
                if(hDist < 0 && vDist < 0){
                  z = -1;
                }
              }
            }
            if(Math.abs(event.clientX - (ElemBounds.x+ElemBounds.width/2)) >= ElemBounds.width || Math.abs(event.clientY - (ElemBounds.y+ElemBounds.height/2)) >= ElemBounds.height){
              //stack.dispatchEvent(new MouseEvent('mouseleave'));
              UnparentClientObject(SelectedObject);
              gsap.to(SelectedObject, {duration: 0.1, rotation: 5});
              ArrangeStack(stack, ObjectCollection[stack.uid].get('arrangement'));
              //event.currentTarget.removeEventListener('mouseleave', stackLeaveEvent);
              inRange = false;
              //return;
            }
          }
          else{
            hDist = SelectedObject.getBoundingClientRect().x - overlappedCard.getBoundingClientRect().x;
            vDist = SelectedObject.getBoundingClientRect().y - overlappedCard.getBoundingClientRect().y;
            if(ObjectCollection[stack.uid].get('arrangement') === 'fanright'){
              if(Math.abs(hDist) <= range && Math.abs(vDist) <= ElemBounds.height/2){inRange = true;}
              if(hDist < 0){
                z = 0;
              }
            }
            else if(ObjectCollection[stack.uid].get('arrangement') === 'fandown'){
              if(Math.abs(vDist) <= range && Math.abs(hDist) <= ElemBounds.width/2){inRange = true;}
              if(vDist < 0){
                z = 0;
              }
            }
            else if(ObjectCollection[stack.uid].get('arrangement') === 'fanout'){
              if(Math.abs(hDist) <= range/2 && Math.abs(vDist) <= range/2){
                inRange = true;
                if(hDist < 0 && vDist < 0){
                  z = 0;
                }
              }
            }
          }
          if(inRange){
            shouldMove = false;
            var stackOrder =  ObjectCollection[stack.uid].get('cards').slice(0);
            if(!stack.contains(SelectedObject)){
              AppendChildInPlace(SelectedObject, stack);
              //stack.addEventListener('mouseleave', stackLeaveEvent);
              stackOrder.splice(Math.max(0, Number(overlappedCard.style.zIndex)+z), 0, SelectedObject.uid);
            }
            else{
              stackOrder.splice(Math.max(0, Number(SelectedObject.style.zIndex)+z), 0, SelectedObject.uid);
            }
            stackShiftCursorPos.x = event.clientX;
            stackShiftCursorPos.y = event.clientY;
            ArrangeStack(stack, ObjectCollection[stack.uid].get('arrangement'), stackOrder).progress(1);
          }
          else if(stack.contains(SelectedObject)){
            shouldMove = false;
          }
        }
      }
    }
    var RoomBounds = document.getElementById('room').getBoundingClientRect();
    var serverPos;
    if(shouldMove){
      var ParBounds = SelectedObject.parentNode.getBoundingClientRect();
      serverPos = ClientToServerPos({x: ElemBounds.x - ParBounds.x, y: ElemBounds.y - ParBounds.y});
      var locX = Math.min(Math.max(RoomBounds.left - ElemBounds.width/2, event.clientX - dragOffset.x + window.pageXOffset), RoomBounds.right - ElemBounds.width/2);
      var locY = Math.min(Math.max(RoomBounds.top - ElemBounds.height/2, event.clientY - dragOffset.y + window.pageYOffset), RoomBounds.bottom - ElemBounds.height/2);
      gsap.to(SelectedObject, {left: locX - RoomBounds.left, top: locY - RoomBounds.top, transformOrigin: '0 0'}).totalProgress(1);
      
      ObjectCollection[SelectedObject.uid].get('pos').z = SelectedObject.style.zIndex;
      ObjectCollection[SelectedObject.uid].set('moving', true);
    }
    else{
      serverPos = ClientToServerPos({x: ElemBounds.x - RoomBounds.x, y: ElemBounds.y - RoomBounds.y});
    }
      SelectedObject.setPosition({x: serverPos.x, y: serverPos.y});
      pushUpdateObjectRequest(SelectedObject.uid, {pos: ObjectCollection[SelectedObject.uid].objData['pos'], moving: ObjectCollection[SelectedObject.uid].objData['moving']});
  }
  event.preventDefault();
});
assignInputEndEvent(window, function(event){
  if(SelectedObject){
    ReleaseObject(SelectedObject);
  }
});
assignInputStartEvent(window, function(event){
    $('#stack-menu').removeClass("show");
    $('#deck-menu').removeClass("show");
    $('#back-menu').removeClass("show");
}, [1,2,3]);

assignInputStartEvent($('#stack-no-fan'), function(event){
  var currentContext = ClientObjectCollection[document.getElementById('stack-menu').currentContext];
  ObjectCollection[currentContext.uid].set('arrangement', 'standard');
  pushUpdateObjectRequest(currentContext.uid, {arrangement: 'standard'});
  ArrangeStack(currentContext, 'standard');
  document.getElementById('stack-menu').currentContext = null;
});

assignInputStartEvent($('#stack-fan-down'), function(event){
  var currentContext = ClientObjectCollection[document.getElementById('stack-menu').currentContext];
  ObjectCollection[currentContext.uid].set('arrangement', 'fandown');
  pushUpdateObjectRequest(currentContext.uid, {arrangement: 'fandown'});
  ArrangeStack(currentContext, 'fandown');
  document.getElementById('stack-menu').currentContext = null;
});

assignInputStartEvent($('#stack-fan-right'), function(event){
  var currentContext = ClientObjectCollection[document.getElementById('stack-menu').currentContext];
  ObjectCollection[currentContext.uid].set('arrangement', 'fanright');
  pushUpdateObjectRequest(currentContext.uid, {arrangement: 'fanright'});
  ArrangeStack(currentContext, 'fanright');
  document.getElementById('stack-menu').currentContext = null;
});

assignInputStartEvent($('#stack-fan-out'), function(event){
  var currentContext = ClientObjectCollection[document.getElementById('stack-menu').currentContext];
  ObjectCollection[currentContext.uid].set('arrangement', 'fanout');
  pushUpdateObjectRequest(currentContext.uid, {arrangement: 'fanout'});
  ArrangeStack(currentContext, 'fanout');
  document.getElementById('stack-menu').currentContext = null;
});

assignInputStartEvent($('#stack-flip'), function(event){
  FlipStack(ClientObjectCollection[document.getElementById('stack-menu').currentContext]);
  document.getElementById('stack-menu').currentContext = null;
});

assignInputStartEvent($('#stack-shuffle'), function(event){
  var currentContext = ClientObjectCollection[document.getElementById('stack-menu').currentContext];
  var shuffledCards = shuffleArray(ObjectCollection[currentContext.uid].get('cards'));

  pushUpdateObjectRequest(currentContext.uid, {arrangement: 'shuffle', cards: shuffledCards});
  ArrangeStack(currentContext, 'shuffle', shuffledCards, function(){
    var arrangement = ObjectCollection[currentContext.uid].get('arrangement');
    pushUpdateObjectRequest(currentContext.uid, {arrangement: arrangement});
    ArrangeStack(currentContext, arrangement);
  });
  document.getElementById('stack-menu').currentContext = null;
});

assignInputStartEvent($('#stack-split'), function(event){
  var currentContext = ClientObjectCollection[document.getElementById('stack-menu').currentContext];
  var cards = ObjectCollection[currentContext.uid].get('cards');
  currentContext.splitStack();
  var RoomBounds = document.getElementById('room').getBoundingClientRect();
  var ParBounds = SelectedObject.parentNode.getBoundingClientRect();
  var serverPos = ClientToServerPos({x: ElemBounds.x - ParBounds.x, y: ElemBounds.y - ParBounds.y});
  dragOffset = {x: targetBounds.left - objBounds.left + event.offsetX, y: targetBounds.top - objBounds.top + event.offsetY};
  var locX = Math.min(Math.max(RoomBounds.left - ElemBounds.width/2, event.clientX - dragOffset.x + window.pageXOffset), RoomBounds.right - ElemBounds.width/2);
  var locY = Math.min(Math.max(RoomBounds.top - ElemBounds.height/2, event.clientY - dragOffset.y + window.pageYOffset + 25), RoomBounds.bottom - ElemBounds.height/2);
  gsap.to(SelectedObject, {left: locX - RoomBounds.left, top: locY - RoomBounds.top, transformOrigin: '0 0'}).totalProgress(1);
  ObjectCollection[SelectedObject.uid].get('pos').z = SelectedObject.style.zIndex;
  ObjectCollection[SelectedObject.uid].set('moving', true);
  SelectedObject.setPosition({x: serverPos.x, y: serverPos.y});
  pushUpdateObjectRequest(SelectedObject.uid, {pos: ObjectCollection[currentContext.uid].objData['pos'], moving: ObjectCollection[SelectedObject.uid].objData['moving']});
});

assignInputStartEvent($('#stack-explode'), function(event){
  var currentContext = ClientObjectCollection[document.getElementById('stack-menu').currentContext];
  var cards = ObjectCollection[currentContext.uid].get('cards');
  var tl = gsap.timeline({onComplete: function(){
    deleteObjectRequest(currentContext.uid);
  }});
  tl.pause();
  var stackBounds = currentContext.getBoundingClientRect();
  var RoomBounds = document.getElementById('room').getBoundingClientRect();
  var xMin = Math.max(-500*ClientSizeMult, RoomBounds.left - stackBounds.left);
  var yMin = Math.max(-500*ClientSizeMult, RoomBounds.top - stackBounds.top);
  var xMax = Math.min(500*ClientSizeMult,  RoomBounds.right - stackBounds.right);
  var yMax = Math.min(500*ClientSizeMult,  RoomBounds.bottom - stackBounds.bottom);
  for(var i = 0; i < cards.length; i++){
    const card = cards[i];
    var cardObj = ClientObjectCollection[card];
    var randX = xMin + Math.random()*(xMax-xMin);
    var randY = yMin + Math.random()*(yMax-yMin);
    tl.to(cardObj, {duration: 1, left: '+='+randX, top: '+='+randY, rotation: 0, ease: 'power4', 
    onStart: function(x, y){
      var serverLoc = ClientToServerPos({x: x, y: y});
      moveObjectRequest(card, {duration: 1, leftPre: '+=', left: serverLoc.x, topPre: '+=', top: serverLoc.y, rotation: 0, ease: 'power4'});
    },onStartParams: [randX, randY]}, '<');
  }
  tl.set({}, {}, '>0.5');
  tl.resume();
  document.getElementById('stack-menu').currentContext = null;
});

assignInputStartEvent($('#deck-recall'), function(event){
  var currentContext = ClientObjectCollection[document.getElementById('deck-menu').currentContext];
  //var deckStack = ObjectCollection[currentContext.uid].get('cardStack');
  var cardsInDeck = ObjectCollection[currentContext.uid].get('cards');
  var deckBounds = currentContext.getBoundingClientRect();
  //if(!deckStack){

 // }
  var tl = gsap.timeline({delay: 0.25, onComplete: function(){
    var deckStack = ObjectCollection[currentContext.uid].get('cardStack');
    if(deckStack && deckStack in ObjectCollection){
      for(card of cardsInDeck){
        if(!ObjectCollection[deckStack].get('cards').includes(card)){
          ClientObjectCollection[deckStack].addCard(card);
        }
      }
    }
    else{
      createObjectRequest('CardStack', {
        pos: ObjectCollection[currentContext.uid].objData.pos,
        cards: cardsInDeck,
        parentObj: currentContext.uid
      });
    }
  }});
  tl.pause();
  var otherStacks = {};
  for(card of cardsInDeck){
    ClientObjectCollection[card].zIndex += currentContext.zIndex;
    var deckStack = ObjectCollection[currentContext.uid].get('cardStack');
    //let cardUID = card;
    if(!deckStack || !ObjectCollection[deckStack].get('cards').includes(card)){
      var cardParent = ObjectCollection[card].get('parentObj');
      if(cardParent && cardParent != deckStack){
        if(cardParent in otherStacks){
          otherStacks[cardParent].push(card);
        }
        else{
          otherStacks[cardParent] = [card];
        }
      }
      tl.to(ClientObjectCollection[card], {duration: 1, ease: 'power3', left: deckBounds.left, top: deckBounds.top, onStart: function(cardUID){
        var serverLoc = ClientToServerPos({x: deckBounds.left, y: deckBounds.top});
        moveObjectRequest(cardUID, {duration: 1, leftPre: '', left: serverLoc.x, topPre: '', top: serverLoc.y, rotation: 0, ease: 'power3'});
      }, onStartParams: [card]}, '<');
    }
  }
  for(otherStack in otherStacks){
    ClientObjectCollection[otherStack].removeCards(otherStacks[otherStack]);
  }
  tl.set({}, {}, '>0.5');
  tl.resume();
  document.getElementById('deck-menu').currentContext = null;
});

assignInputStartEvent($('#create-deck'), function(event){
  CardManagers["Default"].CreateDeck(ClientToServerPos({x: event.target.style.left, y: event.target.style.top}));
});
document.getElementById('room').addEventListener('contextmenu', function(event){
  //MakeSelectedObject(event.currentTarget);
  $("#back-menu").css({
    top: event.clientY + 'px',
    left: event.clientX + 'px'
  }).addClass("show");
  //document.getElementById('back-menu').currentContext = obj.uid;
  event.preventDefault();
  event.stopPropagation();
});

//const ws = new WebSocket('ws://192.168.33.202:8080/');

ws.onmessage = function(e) {
  //console.log(e.data);
  var data = JSON.parse(e.data);
  if(data.type == "canvasStroke"){
    strokeOnCanvas(data.uid, data.lineWidth, data.lineColor, data.start, data.end);
  }
  if(data.type == "createObject"){
    console.log("Received Create Object Request: " , data);
    for(obj of data.objects){
      if(!(obj.uid in ObjectCollection))
      {
        CreateClientObject(obj.uid, obj.objType, obj.objData, obj.noSave);
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
    clientObj.parentNode.removeChild(ClientObjectCollection[data.uid]);
    delete ClientObjectCollection[data.uid];
    delete ObjectCollection[data.uid];
  }
  if(data.type == "updateObject"){
    //console.log("Received Update Request: " + data.uid);
    //console.log(data);
    UpdateObject(data.uid, data.objData);
  }
  if(data.type == "moveObject"){
    console.log("Move reqeust rcvd", data);
    var clientLoc = ServerToClientPos({x: data.moveData.left, y: data.moveData.top});
    data.moveData.left = clientLoc.x;
    data.moveData.top = clientLoc.y;
    gsap.to(ClientObjectCollection[data.uid], {duration: data.moveData.duration, left: data.moveData.leftPre + clientLoc.x, top: data.moveData.topPre + clientLoc.y, rotation: data.moveData.rotation, ease: data.moveData.ease});
  }
  if(data.type == "userUpdate"){
    var userDiv = document.getElementById('connectedUsers');
    var newInner = '';
    for(user of data.users){
      newInner += '<p>'+user+'</p>';
    }
    userDiv.innerHTML = newInner;
  }

};