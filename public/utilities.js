function assignInputStartEvent(elem, behavior, buttons=[1]){
  $(elem).on('touchstart', function(event){//addEventListener("touchstart", function(event){
    event.clientX = event.touches[0].clientX;
    event.clientY = event.touches[0].clientY;
    event.which = 1;
    elem.dispatchEvent(new MouseEvent("mousedown", event));
    event.preventDefault();
  });
  $(elem).mousedown(function(event){
      if(buttons.includes(event.which)){behavior(event)};
    });//.addEventListener("mousedown", behavior, false);
}
function assignInputEndEvent(elem, behavior){
    $(elem).on('touchend', function(event){//elem.addEventListener("touchend", function(event){
    elem.dispatchEvent(new MouseEvent("mouseup", event));
    event.which = 1;
    event.preventDefault();
  });//, false);
  $(elem).mouseup(function(event){
    if(event.which === 1){behavior(event)};
  });//elem.addEventListener("mouseup", behavior, false);
}
function assignInputMoveEvent(elem, behavior){
    $(elem).on('touchmove', function(event){//elem.addEventListener("touchmove", function(event){
    event.clientX = event.touches[0].clientX;
    event.clientY = event.touches[0].clientY;
    event.which = 1;
    elem.dispatchEvent(new MouseEvent("mousemove", event));
    event.preventDefault();
  });//, false);
  $(elem).mousemove(function(event){
    behavior(event);
    //if(event.which === 1){behavior(event)};
  });//elem.addEventListener("mousemove", behavior, false);
}
function assignInputClickEvent(elem, behavior){
  /*elem.addEventListener("touchstart", function(event){
    event.clientX = event.touches[0].clientX;
    event.clientY = event.touches[0].clientY;
    elem.dispatchEvent(new MouseEvent("click", event));
    event.preventDefault();
  }, false);*/
  $(elem).on('click', function(event){
    if(event.which === 1){behavior(event)};
  });//elem.addEventListener("click", behavior, false);
}

/*
-- To shuffle an array a of n elements (indices 0..n-1):
for i from n−1 downto 1 do
     j ← random integer such that 0 ≤ j ≤ i
     exchange a[j] and a[i]
*/
function shuffleArray(arr){
  for(var i = arr.length - 1; i > 1; i--){
    var j = Math.floor(Math.random() * (i+1)); 
    var tmp = arr[j];
    arr[j] = arr[i];
    arr[i] = tmp;
  }
  return arr;
}