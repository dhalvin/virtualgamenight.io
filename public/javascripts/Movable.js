var VGNIO = VGNIO || {};
VGNIO.Movable = new function(){
  this.create = function(obj){
    var movableObj = document.createElement('div');
    Object.assign(movableObj, obj);
    movableObj.classList.add("draggable");
    movableObj.setAttribute('data-toggle', 'popover');
    movableObj.setAttribute('data-placement', 'top');
    movableObj.setAttribute('data-trigger', 'manual');
    $(movableObj).popover();
    VGNIO.AttachToRoom(movableObj);
    VGNIO.Movable.InitDraggable(movableObj, {});
    movableObj.updateFunctions.push(function(updateData){
      if('pos' in updateData){
        MoveObject(movableObj, updateData.pos);
        //Update popover position
        $(movableObj).popover('update');
        if('z' in updateData.pos){
          movableObj.style.zIndex = updateData.pos.z;
          if(movableObj.parentNode === document.getElementById('room') && updateData.pos.z >= document.getElementById('room').children.length){
            VGNIO.AttachToRoom(movableObj);
          }
        }
      }
      if('moving' in updateData){
        //If start moving
        if(!VGNIO.GetObjAttr(movableObj.uid, 'moving') && updateData.moving){
          movableObj.setAttribute('data-content', RoomInfo.users[updateData.user]);
          $(movableObj).popover('show');
          $(movableObj).css( 'filter', 'drop-shadow('+Math.round(VGNIO.Room.ClientSizeMult*15)+'px '+Math.round(VGNIO.Room.ClientSizeMult*15)+'px '+Math.round(VGNIO.Room.ClientSizeMult*10)+'px #000)');
          gsap.to(movableObj, {duration: 0.1, rotation: 5});
        }
        //If end moving
        else if(VGNIO.GetObjAttr(movableObj.uid, 'moving') && !updateData.moving){
          $(movableObj).popover('hide');
          $(movableObj).css( 'filter', '');
          gsap.to(movableObj, {duration: 0.1, rotation: 0});
        }
      }
    });
    movableObj.deleteFunctions.push(function(){
      $(movableObj).popover('dispose');
    });
  
    if('pos' in ObjectCollection[movableObj.uid].objData){
      MoveObject(movableObj, VGNIO.GetObjAttr(movableObj.uid, 'pos'));
    }
    return movableObj;
  }
  this.InitDraggable = function(obj, attr){
    Draggable.create(obj, Object.assign({
      onClick: VGNIO.Movable.DraggableOnClick,
      onPress: VGNIO.Movable.DraggableOnPress,
      onRelease: VGNIO.Movable.DraggableOnRelease,
      onDragStart: VGNIO.Movable.OnDragStart,
      onDrag: VGNIO.Movable.OnDrag,
      onDragEnd: VGNIO.Movable.OnDragEnd,
      bounds: '#room',
      minimumMovement: 10,
      zIndexBoost: false,
      liveSnap: {
        points: function(point){
          var closest = null;
          var closest_d = null;
          for(pt of this.SnapLocations){
            var dx = point.x - pt.x;
            var dy = point.y - pt.y;
            var ds = dx*dx + dy*dy;
            if(!closest || ds < closest_d){
              closest = pt;
              closest_d = ds;
            }
          }
          if(closest_d && closest_d < 1000){
            this.snappedObj = closest;
            return closest;
          }
          else{
            this.snappedObj = null;
            return point;
          }
        }
      }}, attr));
      Draggable.get(obj).SnapLocations = [];
  }
  this.DraggableOnClick = function(e){
    if(this.contextTimer){
      clearTimeout(this.contextTimer);
      this.contextTimer = null;
    }
    if(this.contextJustUp){
      this.contextJustUp = false;
    }
    else{
      $('#context-menu').removeClass("show");
      if(e.which == 1){
        VGNIO[VGNIO.GetObjType(this.target.getAttribute('id'))].OnClick(this);
      }
      else if(e.which == 3){
        VGNIO[VGNIO.GetObjType(this.target.getAttribute('id'))].OnRightClick(this);
      }
    }
  }
  this.DraggableOnPress = function(e){
    if(e.pointerType == "touch"){
      let draggable = this;
      this.contextTimer = setTimeout(function(){
        VGNIO[VGNIO.GetObjType(draggable.target.getAttribute('id'))].OnRightClick(draggable);
        draggable.contextJustUp = true;
      }, 1000);
    }
    e.stopPropagation();
  }
  this.DraggableOnRelease = function(e){
    if(this.contextTimer){
      clearTimeout(this.contextTimer);
      this.contextTimer = null;
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }
  this.OnDragStart = function(e){
    if(this.contextTimer){
      clearTimeout(this.contextTimer);
      this.contextTimer = null;
    }
    $('#context-menu').removeClass("show");
    this.contextJustUp = false;
    VGNIO.SetObjAttr(this.target.id, 'moving', true);
    SendRequests([pushUpdateObjectRequest(this.target.id, {'moving': true, 'user': {}})]);
    $(this.target).css( 'filter', 'drop-shadow('+Math.round(VGNIO.Room.ClientSizeMult*15)+'px '+Math.round(VGNIO.Room.ClientSizeMult*15)+'px '+Math.round(VGNIO.Room.ClientSizeMult*10)+'px #000)');
    this.dragTween = gsap.to(this.target, {duration: 0.1, rotation: 5});
    //Get all snappable locations
    this.SnapLocations = [];
    for(objUid in ObjectCollection){
      if(objUid != this.target.id && VGNIO[VGNIO.GetObjType(this.target.id)].isSnappableTarget(objUid ,this.target.id)){
        var objBounds = document.getElementById(objUid).getBoundingClientRect();
        this.SnapLocations.push({x: objBounds.x - VGNIO.Room.Bounds.x, y: objBounds.y - VGNIO.Room.Bounds.y, z: document.getElementById(objUid).style.zIndex, id: objUid});
      }
    }
    VGNIO[VGNIO.GetObjType(this.target.getAttribute('id'))].OnDragStart(this);
  }
  this.OnDrag = function(e){
    var rect = this.target.getBoundingClientRect();
    rect = clientToRoomPosition(rect);
    VGNIO.GetObjAttr(this.target.id, 'pos').x = rect.x;
    VGNIO.GetObjAttr(this.target.id, 'pos').y = rect.y;
    this.target.style.zIndex = 500;
    SendRequests([pushUpdateObjectRequest(this.target.id, {pos: VGNIO.GetObjAttr(this.target.id, 'pos')})]); //moving: VGNIO.GetObjAttr(obj.uid, 'moving')}))]);
    VGNIO[VGNIO.GetObjType(this.target.getAttribute('id'))].OnDrag(this);
  }
  this.OnDragEnd = function(e){
    VGNIO.SetObjAttr(this.target.id, 'moving', false);
    SendRequests([pushUpdateObjectRequest(this.target.id, {'moving': false, 'releaseUser': true})]);
    $(this.target).css( 'filter', '');
    this.dragTween.reverse();
    VGNIO[VGNIO.GetObjType(this.target.getAttribute('id'))].OnDragEnd(this);
    for(var i = 0; i < document.getElementById('room').children.length; i++){
      document.getElementById('room').children[i].style.zIndex = i+1;
    }
  }
};
function MoveObject(obj, pos, duration=0){
  VGNIO.GetObjAttr(obj.uid, 'pos').x = pos.x;
  VGNIO.GetObjAttr(obj.uid, 'pos').y = pos.y;
  var room = document.getElementById('room').getBoundingClientRect();
  Draggable.get(obj).update();
  gsap.to(obj, {duration: duration, x: pos.x * room.width, y: pos.y * room.height, onCompleteParams: [obj], onComplete: function(obj){
    Draggable.get(obj).update();
  }});
}
function SnapObject(obj, target, duration=0){
  var targetBounds = target.getBoundingClientRect();
  var parBounds = obj.parentNode.getBoundingClientRect();
  targetBounds.x -= parBounds.x;
  targetBounds.y -= parBounds.y;
  MoveObject(obj, normalizePosition(targetBounds));
}