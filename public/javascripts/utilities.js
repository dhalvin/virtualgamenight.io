function assignInputStartEvent(elem, behavior, buttons=[1]){
    $(elem).on('touchstart', function(event){
      event.clientX = event.touches[0].clientX;
      event.clientY = event.touches[0].clientY;
      event.which = 1;
      event.stopPropagation();
      elem.dispatchEvent(new MouseEvent("mousedown", event));
    });
    $(elem).mousedown(function(event){
        if(buttons.includes(event.which)){behavior(event)};
      });
  }
  function assignInputEndEvent(elem, behavior){
      $(elem).on('touchend', function(event){
      elem.dispatchEvent(new MouseEvent("mouseup", event));
      event.which = 1;
    });
    $(elem).mouseup(function(event){
      if(event.which === 1){behavior(event)};
    });
  }
  function assignInputMoveEvent(elem, behavior){
      $(elem).on('touchmove', function(event){
      event.clientX = event.touches[0].clientX;
      event.clientY = event.touches[0].clientY;
      event.which = 1;
      elem.dispatchEvent(new MouseEvent("mousemove", event));
      event.preventDefault();
    });
    $(elem).mousemove(function(event){
      behavior(event);
    });
  }
  function assignInputClickEvent(elem, behavior){
    $(elem).on('click', function(event){
      if(event.which === 1){behavior(event)};
    });
  }

  function assignContextMenuEvent(elem, behavior){

  }
  
  function shuffleArray(arr){
    for(var i = arr.length - 1; i > 1; i--){
      var j = Math.floor(Math.random() * (i+1)); 
      var tmp = arr[j];
      arr[j] = arr[i];
      arr[i] = tmp;
    }
    return arr;
  }

  //Pos should be relative to room
  function normalizePosition(pos){
    return {x: pos.x/VGNIO.Room.Bounds.w, y: pos.y/VGNIO.Room.Bounds.h, z: pos.z};
  }

  function clientToRoomPosition(pos){
    return normalizePosition({x: pos.x - VGNIO.Room.Bounds.x, y: pos.y - VGNIO.Room.Bounds.y});
  }