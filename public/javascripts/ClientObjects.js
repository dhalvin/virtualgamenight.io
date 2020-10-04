var VGNIO = VGNIO || {};

VGNIO.GetObjType = function(uid){
  return ObjectCollection[uid].objType;
}
VGNIO.GetObjAttr = function(uid, attr){
  try{
    return ObjectCollection[uid].objData[attr];
  }
  catch(e){
    console.log(e);
  }
  
};
VGNIO.SetObjAttr = function(uid, attr, val){
  if(attr == 'parentObj' && val === null){
    console.log('0');
  }
  ObjectCollection[uid].objData[attr] = val;
};
VGNIO.CreateClientObject = function(uid, objType, objectData, noSave){
  try{
    //Create Object Data (Model)
    var obj = {uid: uid, objType: objType, objData: {}};
    //Save savable data to local obj
    for(attr in objectData){
      if(!noSave[attr]){
        obj.objData[attr] = objectData[attr];
      }
    }
    ObjectCollection[uid] = obj;

    //Create Client Object Base
    var clientObj = {uid: uid, id: uid, updateFunctions: [], deleteFunctions: [], resize: function(){}};
    //Finish with type specific functionality
    ClientObjectCollection[uid] = VGNIO[objType].create(clientObj, objectData);
    ClientObjectCollection[uid].resize();
    return ClientObjectCollection[uid];
  }
  catch(err){
    console.log('Failed to create object: ' + objType, err);
  }
}

//Gets all objects of type type colliding with obj
function getCollidingObjectsOfType(obj, type){
  var possibleObjs = [];
  for(objUid in ObjectCollection){
    var shouldConsider = true;
    if(objUid == obj.uid || ObjectCollection[obj.uid].objType == 'CardStack' && VGNIO.GetObjAttr(obj.uid, 'cards').includes(objUid)){
      shouldConsider = false;
    }
    if(ObjectCollection[objUid].objType == type && shouldConsider){
      possibleObjs.push(ClientObjectCollection[objUid]);
    }
  }
  var objBounds = obj.getBoundingClientRect();
  var overlappingObjs = [];
  for(possibleObj of possibleObjs){
    var testBounds = possibleObj.getBoundingClientRect();
    var overlapping = true;
    if(objBounds.top > testBounds.bottom || testBounds.top > objBounds.bottom){
      overlapping = false;
    }
    if(objBounds.left > testBounds.right || testBounds.left > objBounds.right){
      overlapping = false;
    }
    if(overlapping){
      overlappingObjs.push(possibleObj);
    }
  }
  return overlappingObjs;
}

//Returns the nearest of nearbyObjs to obj
function getClosestOf(obj, nearbyObjs){
  var objBounds = obj.getBoundingClientRect();
  if(nearbyObjs.length > 0){
    var nearbyBounds = nearbyObjs[0].getBoundingClientRect();
    var minObj = nearbyObjs[0];
    var minDist = Math.hypot(objBounds.x - nearbyBounds.x, objBounds.y - nearbyBounds.y);
    for(var i = 1; i < nearbyObjs.length; i++){
      nearbyBounds = nearbyObjs[i].getBoundingClientRect();
      var dist = Math.hypot(objBounds.x - nearbyBounds.x, objBounds.y - nearbyBounds.y);
      if(dist < minDist){
        minObj = nearbyObjs[i];
        minDist = dist;
      }
    }
    return minObj;
  }
  else{
    return null;
  }
}

function getDistance(obj1, obj2){
  return Math.hypot(obj1.getBoundingClientRect().x - obj2.getBoundingClientRect().x, obj1.getBoundingClientRect().y - obj2.getBoundingClientRect().y);
}

VGNIO.UnparentClientObject = function(clientObj){
  var rect = clientObj.getBoundingClientRect();
  VGNIO.AttachToRoom(clientObj)
  MoveObject(clientObj, clientToRoomPosition(rect));
}

VGNIO.AppendChildInPlace = function(clientObj, newParent){
  var temp = document.createElement('div');
  document.body.appendChild(temp);
  var rect = clientObj.getBoundingClientRect();
  gsap.to(temp, {x: rect.x, y: rect.y});
  newParent.appendChild(clientObj);
  var parBounds = newParent.getBoundingClientRect();
  var tempBounds = temp.getBoundingClientRect();
  gsap.to(clientObj, {x: tempBounds.x - parBounds.x, y: tempBounds.y - parBounds.y, transformOrigin: '0 0'}).progress(1);
  document.body.removeChild(temp);
}

VGNIO.AttachToRoom = function(clientObj){
  var room = document.getElementById('room');
  room.appendChild(clientObj);
  for(var i = 0; i < room.children.length; i++){
    room.children[i].style.zIndex = i+1;
  }
}

VGNIO.ResetContextMenu = function(){
  document.getElementById('context-menu').remove();
  var cm = document.createElement('div');
  cm.classList.add('dropdown-menu');
  cm.id = 'context-menu';
  cm.setAttribute('data-reference', 'parent');
  document.body.appendChild(cm);
  return cm;
}

VGNIO.ShowContextMenu = function(type, event){
  var cm = VGNIO.ResetContextMenu();
  for(section in VGNIO[type].ContextMenuSpecs){
    var sect = VGNIO[type].ContextMenuSpecs[section]();
    if(!sect.attribute || sect.attribute && VGNIO.GetObjAttr(event.target.id, sect.attribute)){
      var sectHeader = document.createElement("h6");
      sectHeader.classList.add('dropdown-header');
      sectHeader.appendChild(document.createTextNode(sect.name));
      cm.appendChild(sectHeader);
      for(item of sect.items()){
        let itm = item;
        let btnEvent = {target: sect.getTarget(event)};
        var dropItem = document.createElement("button");
        dropItem.classList.add("dropdown-item");
        dropItem.setAttribute("type", "button");
        dropItem.addEventListener("click", function(e){
          itm.action(btnEvent);
          $('#context-menu').removeClass('show');
        });
        dropItem.appendChild(document.createTextNode(item.text));
        cm.appendChild(dropItem);
      }
    }
  }
  $("#context-menu").css({
    top: event.pointerEvent.clientY + 'px',
    left: event.pointerEvent.clientX + 'px'
  }).addClass("show");
}