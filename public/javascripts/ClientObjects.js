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

VGNIO.ShowContextMenu = function(type, event, submenu="default"){
  var cm = VGNIO.ResetContextMenu();
  $("#context-menu").addClass("show");
  for(section in VGNIO[type].ContextMenuSpecs[submenu]){
    var sect = VGNIO[type].ContextMenuSpecs[submenu][section]();
    if(!sect.attribute || sect.attribute && VGNIO.GetObjAttr(event.target.id, sect.attribute)){
      var sectHeader = document.createElement("h6");
      sectHeader.classList.add('dropdown-header');
      sectHeader.appendChild(document.createTextNode(sect.name));
      cm.appendChild(sectHeader);
      var begdivider = document.createElement('div');
      begdivider.classList.add('dropdown-divider');
      cm.appendChild(begdivider);
      for(item of sect.items()){
        let itm = item;
        var dropItem = null;
        if(itm.type == "default"){
          let btnEvent = {target: sect.getTarget(event), pointerX: event.pointerX, pointerY: event.pointerY};
          dropItem = document.createElement("button");
          dropItem.classList.add("dropdown-item");
          dropItem.setAttribute("type", "button");
          dropItem.addEventListener("click", function(e){
            itm.action(btnEvent);
            if(!itm.submenu){
              $('#context-menu').removeClass('show');
            }
          });
          dropItem.appendChild(document.createTextNode(item.text));
          if(itm.submenu){
            dropItem.innerHTML = itm.text+'<svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-caret-right" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M6 12.796L11.481 8 6 3.204v9.592zm.659.753l5.48-4.796a1 1 0 0 0 0-1.506L6.66 2.451C6.011 1.885 5 2.345 5 3.204v9.592a1 1 0 0 0 1.659.753z"/></svg>'
          }
          cm.appendChild(dropItem);
        }
        else if(itm.type == "form"){
          for(input of itm.inputs){
            dropItem = document.createElement('form');
            dropItem.className = 'px-4 py-3';
            dropItem.appendChild(VGNIO.ContextMenuFormItems[input.type](input, event));
            cm.appendChild(dropItem);
          }
        }
        else if(itm.type == "divider"){
          var divider = document.createElement('div');
          divider.classList.add('dropdown-divider');
          cm.appendChild(divider);
        }
      }
      var enddivider = document.createElement('div');
      enddivider.classList.add('dropdown-divider');
      cm.appendChild(enddivider);
    }
  }
  $("#context-menu").css({
    top: event.pointerY + 'px',
    left: Math.min(event.pointerX, VGNIO.Room.Bounds.x + VGNIO.Room.Bounds.w - $("#context-menu").width()) + 'px'
  })
  Draggable.create(cm, {type: 'y'});
}

VGNIO.ContextMenuFormItems = {
  'slider': function(input, event){
    var inputItem = document.createElement('div');
    var sliderLabel = document.createElement('label');
    sliderLabel.innerText = input.text;
    var labelValue = document.createElement('span');
    labelValue.id = input.id+'_value';
    labelValue.innerText = input.default(event);
    sliderLabel.appendChild(labelValue);
    inputItem.appendChild(sliderLabel);
    var slider = document.createElement('input');
    inputItem.appendChild(slider);
    slider.className = 'custom-range';
    slider.setAttribute('type', 'range');
    slider.setAttribute('min', input.min(event));
    slider.setAttribute('max', input.max(event));
    slider.setAttribute('step', input.step(event));
    slider.id = input.id;
    slider.value = input.default(event);
    $(slider).on("input change", function(e){
      document.getElementById(e.currentTarget.id+'_value').innerText = e.currentTarget.value;
    });
    if(input.onchange){
      $(slider).on("input change", function(e){
        input.onchange(event);
      });
    }
    return inputItem;
  },
  'radio': function(input, event){
    var inputItem = document.createElement('div');
    var label = document.createElement('label');
    label.innerText = input.text;
    inputItem.appendChild(label);
    
    for(let [i, option] of input.options.entries()){
      var radio = document.createElement('input');
      inputItem.appendChild(radio);
      radio.className = 'form-check';
      radio.setAttribute('type', 'radio');
      radio.setAttribute('name', input.id);
      radio.setAttribute('value', option);
      if(i == 0){
        radio.setAttribute('checked', 'checked');
      }
      var radioLabel = document.createElement('label');
      radioLabel.innerText = option;
      inputItem.appendChild(radioLabel);
      if(input.onchange){
        $(radio).on("change", function(e){
          input.onchange(event);
        });
      } 
    }
    inputItem.id = input.id;
    return inputItem;
  }
}