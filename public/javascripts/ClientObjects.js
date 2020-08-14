const InitializeObject = {
  Card: function(obj, startData){
    obj.cardImg = document.createElement('img');
    obj.cardImg.setAttribute('width', CardSize.w);
    obj.cardImg.setAttribute('height', CardSize.h);
    obj.appendChild(obj.cardImg);
    obj.style.visibility = 'visible';
    obj.cardImg.style.visibility = 'visible';
    obj.resize = function(){
      var sizeM = RoomSize.w/FixedRoomSize.w;
      obj.cardImg.style.width = sizeM * CardSize.w + 'px';
      obj.cardImg.style.height = sizeM * CardSize.h + 'px';
    };
    obj.updateFunctions.push(function(updateData){
      if('faceUp' in updateData){
        var tl = gsap.timeline();
        tl.pause();
        var duration = .1;
        tl.to(obj, {duration: duration, scale: 1.1,  repeat: 1, yoyo: true, ease: 'none', yoyoEase: 'power3'});
        tl.add(function(){
          if(updateData.faceUp){
            obj.cardImg.src = '/card/'+ObjectCollection[obj.uid].get('styleName') + '/' + updateData.cardLabel;
          }
          else{
            obj.cardImg.src = '/card/'+ObjectCollection[obj.uid].get('styleName') + '/card_back';
          }
        }, '<'+duration);
        tl.resume();
      }
    });
    assignInputStartEvent(obj.cardImg, function(event){
      var parentStack = ObjectCollection[ObjectCollection[obj.uid].get('parentObj')];
      if(parentStack && !ObjectCollection[parentStack.uid].get('moving') && !ObjectCollection[parentStack.uid].get('locked')){
        if(hoverTween){
          hoverTween.pause();
        }
        GrabObject(obj);
        var objBounds = obj.getBoundingClientRect();
        var targetBounds = event.target.getBoundingClientRect();
        dragOffset = {x: 0, y: 0};
        //dragOffset = {x: targetBounds.left - objBounds.left + event.offsetX, y: targetBounds.top - objBounds.top + event.offsetY};
        event.stopPropagation();
      }
    });
    //assignInputEndEvent(obj.cardImg, function(event){
    obj.addEventListener("onReleased", function(event){
      if(SelectedObject === obj && !ObjectCollection[obj.uid].get('moving')){
        pushUpdateObjectRequest(obj.uid, {faceUp : !ObjectCollection[obj.uid].get('faceUp'), cardLabel: {}}, true);
        if(hoverTween){
          hoverTween.resume();
        }
      }
      else if(SelectedObject === obj){
        if(obj.parentNode.uid && ObjectCollection[obj.parentNode.uid].objType === 'CardStack'){
          ClientObjectCollection[obj.parentNode.uid].addCard(obj.uid, obj.style.zIndex);
        }
        else{
          var deck = getClosestOf(obj, getCollidingObjectsOfType(obj, 'Deck'));
          if(deck){
            var deckStack = ObjectCollection[deck.uid].get('cardStack');
            if(deckStack){
              ClientObjectCollection[deckStack].addCard(obj.uid, -1);
            }
            else{
              obj.snapTo(deck);
              var newStackData = {
                pos: ObjectCollection[obj.uid].objData.pos,
                cards: [obj.uid],
                parentObj: deck.uid
              };
              createObjectRequest('CardStack', newStackData);
            }
          }
          else{
            var stack = getClosestOf(obj, getCollidingObjectsOfType(obj, 'CardStack'));
            if(stack && getDistance(obj, stack) < 0.1*CardSize.w*RoomSize.w/FixedRoomSize.w){
              stack.addCard(obj.uid, ObjectCollection[stack.uid].get('cards').length);
            }
            else{
              var card = getClosestOf(obj, getCollidingObjectsOfType(obj, 'Card'));
              if(card && getDistance(obj, card) < 0.1*CardSize.w*RoomSize.w/FixedRoomSize.w){
                obj.snapTo(card);
                var newStackData = {
                  pos: ObjectCollection[obj.uid].objData.pos,
                  cards: [card.uid, obj.uid]
                };
                createObjectRequest('CardStack', newStackData);
              }
            }
          }
        }
      }
    });
    var hoverTween = null;
    obj.addEventListener('mouseenter', function(event){
      var parentStack = ObjectCollection[ObjectCollection[obj.uid].get('parentObj')];
      if(!SelectedObject && parentStack && (parentStack.get('arrangement') === 'fanright' || parentStack.get('arrangement') === 'fandown' || parentStack.get('arrangement') === 'fanout')){
        if(!hoverTween){
          hoverTween = gsap.to(event.currentTarget, {duration: 0.1, y: '-='+ClientSizeMult*AnimationUnit, onReverseComplete: function(){
            hoverTween.kill();
            hoverTween = null;
          }});
        }
      }
    });
    obj.addEventListener('mouseleave', function(event){
      if(hoverTween){
        if(hoverTween.progress() === 0){
          hoverTween.kill();
          hoverTween = null;
        }else{
          hoverTween.reverse();
        }
      }
    });
    try{
      obj.cardImg.src = '/cards?style='+ObjectCollection[obj.uid].get('styleName') + '&label=card_back';
    }
    catch(err){console.log(err);}
    return obj;
  },
  CardStack: function(obj){
    obj.style.cursor = 'default';
    obj.style.backgroundColor = '#ffffff';
    obj.labelHandle = document.createElement('div');
    obj.labelHandle.style.marginTop = '-25px';
    obj.labelHandle.height = '25px';
    obj.labelHandle.width = '15px';
    obj.labelHandle.style.backgroundColor = '#55ff55'
    obj.countText = document.createTextNode('2');
    obj.labelHandle.appendChild(obj.countText);
    obj.appendChild(obj.labelHandle);
    obj.cardSlot = document.createElement('div');
    obj.cardSlot.style.visibility = 'visible';
    obj.cardSlot.style.position = 'absolute';
    obj.appendChild(obj.cardSlot);
    obj.cardSlot.style.backgroundColor = '#0000ff55';

    obj.resize = function(){
      var sizeM = RoomSize.w/FixedRoomSize.w;
      obj.style.width = sizeM * CardSize.w + 'px';
      obj.style.height = sizeM * CardSize.h + 'px';
      obj.cardSlot.style.width = sizeM * CardSize.w + 'px';
      obj.cardSlot.style.height = sizeM * CardSize.h + 'px';
      ArrangeStack(obj, ObjectCollection[obj.uid].get('arrangement'));
    };
    obj.resize();
    obj.attachCards = function(){
      var cards = ObjectCollection[obj.uid].get('cards');
      for(card of cards){
        //Wait for cards to be created if they are not yet
        if(!(card in ClientObjectCollection)){
          console.log('WAITING FOR CARDS');
          setTimeout(obj.attachCards, 100);
          return;
        }
      }
      for(var i = 0; i < cards.length; i++){
        var cardObj =  ClientObjectCollection[cards[i]];    
        obj.appendChild(cardObj);
        cardObj.snapTo(obj.cardSlot);
        cardObj.style.zIndex = i;
        ObjectCollection[cards[i]].set('parentObj', obj.uid);
      }
      //obj.cardSlot.style.zIndex = cards.length;
      obj.countText.nodeValue = cards.length;
      ArrangeStack(obj, ObjectCollection[obj.uid].get('arrangement'));
    }
    obj.addCard = function(card, index){
      var cards = ObjectCollection[obj.uid].get('cards');
      //cards.push(card);
      cards.splice(index, 0, card);
      var cardObj =  ClientObjectCollection[card];    
      obj.appendChild(cardObj);
      cardObj.snapTo(obj.cardSlot);
      var cardsLen = cards.length;
      //ObjectCollection[cardObj.uid].get('pos').z = cardsLen - 1;
      ObjectCollection[cardObj.uid].set('parentObj', obj.uid);
      cardObj.style.zIndex = index;
      //obj.cardSlot.style.zIndex = cardsLen;
      obj.countText.nodeValue = cardsLen;
      for(var i = index; i < cardsLen; i++){
        ClientObjectCollection[cards[i]].style.zIndex = i;
        ObjectCollection[cards[i]].get('pos').z = i;
        //pushUpdateObjectRequest(card, {pos: ObjectCollection[card].objData['pos'], parentObj: {value: obj.uid}});
        pushUpdateObjectRequest(card, {parentObj: obj.uid});
      }
      //pushUpdateObjectRequest(card, {parentObj: {value: obj.uid}});
      pushUpdateObjectRequest(obj.uid, {cards: cards});
      ArrangeStack(obj, ObjectCollection[obj.uid].get('arrangement'));
    };
    obj.removeCard = function(card){
      var cards = ObjectCollection[obj.uid].get('cards');
      var index = cards.indexOf(card);
      if (index !== -1){
        cards.splice(index, 1);
        var cardObj =  ClientObjectCollection[card];
        obj.countText.nodeValue = cards.length;
        UnparentClientObject(cardObj);
        ObjectCollection[cardObj.uid].set('parentObj', null);
        //pushUpdateObjectRequest(card, {pos: ObjectCollection[card].objData['pos'], releaseUser: {value: true}});
        pushUpdateObjectRequest(card, {parentObj: null, moving: false, locked: false, releaseUser: true}, true);
        if(cards.length < 2){
          deleteObjectRequest(obj.uid);
        }
        else{
          pushUpdateObjectRequest(obj.uid, {cards: cards});
          ArrangeStack(obj, ObjectCollection[obj.uid].get('arrangement'));
        }
      }
      else{
        console.log("Tried to remove card from stack that was not in stack");
      } 
    };
    obj.removeCards = function(removedCards){
      var cards = ObjectCollection[obj.uid].get('cards');
      for(card of removedCards){
        var index = cards.indexOf(card);
        if (index !== -1){
          cards.splice(index, 1);
          var cardObj =  ClientObjectCollection[card];
          obj.countText.nodeValue = cards.length;
          UnparentClientObject(cardObj);
          ObjectCollection[cardObj.uid].set('parentObj', null);
          //pushUpdateObjectRequest(card, {pos: ObjectCollection[card].objData['pos'], releaseUser: {value: true}});
          pushUpdateObjectRequest(card, {parentObj: null, moving: false, locked: false, releaseUser: true}, true);
        }
        else{
          console.log("Tried to remove card from stack that was not in stack");
        } 
      }
      if(cards.length < 2){
        deleteObjectRequest(obj.uid);
      }
      else{
        pushUpdateObjectRequest(obj.uid, {cards: cards});
        ArrangeStack(obj, ObjectCollection[obj.uid].get('arrangement'));
      }
    };
    obj.mergeStack = function(stack){
      var stackObj = ClientObjectCollection[stack];
      stackObj.snapTo(obj);
      var cards = ObjectCollection[obj.uid].get('cards');
      for(card of ObjectCollection[stackObj.uid].get('cards'))
      {
        cards.push(card);
        var cardObj =  ClientObjectCollection[card];    
        obj.appendChild(cardObj);
        cardObj.snapTo(obj.cardSlot);
        var cardsLen = cards.length;
        ObjectCollection[cardObj.uid].get('pos').z = cardsLen - 1;
        ObjectCollection[cardObj.uid].set('parentObj', obj.uid);
        cardObj.style.zIndex = cardsLen - 1;
        pushUpdateObjectRequest(card, {pos: ObjectCollection[card].objData['pos'], parentObj: obj.uid});
      }
      //obj.cardSlot.style.zIndex = cardsLen;
      obj.countText.nodeValue = cardsLen;
      pushUpdateObjectRequest(obj.uid, {cards: cards});
      deleteObjectRequest(stack);
      ArrangeStack(obj, ObjectCollection[obj.uid].get('arrangement'));
    };
    obj.splitStack = function(){
      var parentDeck = ObjectCollection[obj.uid].get('parentObj');
      if(parentDeck){
        ClientObjectCollection[ObjectCollection[obj.uid].get('parentObj')].removeCardStack();
      }
      var cards = ObjectCollection[obj.uid].get('cards');
      var splitIndex = Math.floor(cards.length/2);
      var newCards = cards.splice(0, splitIndex);
      for(card of newCards){
        var cardObj =  ClientObjectCollection[card];
        UnparentClientObject(cardObj);
      }
      //obj.cardSlot.style.zIndex = cards.length;
      obj.countText.nodeValue = cards.length;
      if(newCards.length >= 2){
        var newStackData = {
          pos: ObjectCollection[obj.uid].objData.pos,
          cards: newCards,
          arrangement: ObjectCollection[obj.uid].get('arrangement')
        };
        if(parentDeck){
          newStackData.parentObj = parentDeck;
        }
        createObjectRequest('CardStack', newStackData);
      }
      pushUpdateObjectRequest(obj.uid, {cards: cards});
      ArrangeStack(obj, ObjectCollection[obj.uid].get('arrangement'));
    };
    obj.updateFunctions.push(function(updateData){
      if('cards' in updateData){
        var oldCards = ObjectCollection[obj.uid].get('cards');
        var removedCards = oldCards.filter(function(card){return !updateData.cards.includes(card)});
        for(card of removedCards){
          var cardObj =  ClientObjectCollection[card];
          if(obj.contains(cardObj)){
            UnparentClientObject(cardObj);
          }
        }
        var addedCards = updateData.cards.filter(function(card){return !oldCards.includes(card)});
        for(card of addedCards){
          var cardObj =  ClientObjectCollection[card];    
          obj.appendChild(cardObj);
          cardObj.snapTo(obj.cardSlot);
        }
        for(var i = 0; i < updateData.cards.length; i++){
          ClientObjectCollection[updateData.cards[i]].style.zIndex = i;
        }
        obj.countText.nodeValue = updateData.cards.length;
        if('arrangement' in updateData){
          ArrangeStack(obj, updateData.arrangement, updateData.cards);
        }
        else{
          ArrangeStack(obj, ObjectCollection[obj.uid].get('arrangement'), updateData.cards);
        }
      }
      else if('arrangement' in updateData){
        ArrangeStack(obj, updateData.arrangement);
      }
    });
    obj.deleteFunctions.push(function(){
      for(card of ObjectCollection[obj.uid].get('cards')){
        if(obj.contains(ClientObjectCollection[card])){
          var cardObj =  ClientObjectCollection[card];
          UnparentClientObject(cardObj);
          pushUpdateObjectRequest(card, {pos: ObjectCollection[card].objData['pos'], parentObj: null, moving: false, locked: false, releaseUser: true}, true);
        }
      }
      var parentObj = ObjectCollection[obj.uid].get('parentObj');
      if(parentObj){
        ObjectCollection[parentObj].set('cardStack', null);
      }
    });
    assignInputMoveEvent(obj, function(event){
      if(SelectedObject){
        var cards = ObjectCollection[obj.uid].get('cards');
        if(cards.includes(SelectedObject.uid)){
          obj.removeCard(SelectedObject.uid);
          dragOffset = {x: event.offsetX, y: event.offsetY};
          if(cards.length < 2 && !ObjectCollection[obj.uid].get('parentObj') || cards.length < 1 && ObjectCollection[obj.uid].get('parentObj')){
            deleteObjectRequest(obj.uid);
          }
        }
      }
    });
    assignInputStartEvent(obj.labelHandle, function(event){
      if(ObjectCollection[obj.uid].get('parentObj')){
        ClientObjectCollection[ObjectCollection[obj.uid].get('parentObj')].removeCardStack();
      }
    });
    assignInputEndEvent(obj.labelHandle, function(event){
      if(SelectedObject === obj){
        var deck = getClosestOf(obj, getCollidingObjectsOfType(obj, 'Deck'));
        if(deck){
          var deckStack = ClientObjectCollection[ObjectCollection[deck.uid].get('cardStack')];
          if(deckStack){
            deckStack.mergeStack(obj.uid);
          }
          else{
            deck.attachCardStack(obj.uid);
          }
        }
        else{
          var stack = getClosestOf(obj, getCollidingObjectsOfType(obj, 'CardStack'));
          if(stack && getDistance(obj, stack) < 0.1*CardSize.w*RoomSize.w/FixedRoomSize.w){
            stack.mergeStack(obj.uid);
          }
          else{
            var card = getClosestOf(obj, getCollidingObjectsOfType(obj, 'Card'));
            if(card && getDistance(obj, card) < 0.1*CardSize.w*RoomSize.w/FixedRoomSize.w){
              obj.addCardBottom(card.uid, 0);
            }
            else if(ObjectCollection[obj.uid].get('cards').length < 2){
              deleteObjectRequest(obj.uid);
            }
          }
        }
      }
    });
    obj.addEventListener('contextmenu', function(event){
      //MakeSelectedObject(event.currentTarget);
      $("#stack-menu").css({
        top: obj.getBoundingClientRect().top + 'px',
        left: obj.getBoundingClientRect().right + 'px'
      }).addClass("show");
      document.getElementById('stack-menu').currentContext = obj.uid;
      event.preventDefault();
      event.stopPropagation();
    });
    obj.attachCards();
    if(ClientObjectCollection[ObjectCollection[obj.uid].get('parentObj')]){
      var deck = ClientObjectCollection[ObjectCollection[obj.uid].get('parentObj')];
      deck.appendChild(document.getElementById(obj.uid));
      obj.snapTo(deck);
      ObjectCollection[deck.uid].set('cardStack', obj.uid);
    }
    return obj;
  },
  Deck: function(obj){
    obj.backPlate = document.createElement('div');
    obj.backPlate.style.backgroundColor = '#ffffff';
    obj.backPlate.style.border = 'solid #000000 1px';
    obj.backPlate.style.marginLeft = '-1px';
    obj.backPlate.style.marginTop = '-1px';
    obj.appendChild(obj.backPlate);
    obj.deckHandle = document.createElement('div');
    obj.deckHandle.height = '25px';
    obj.deckHandle.width = '15px';
    obj.deckHandle.style.backgroundColor = '#ff5555'
    obj.deckHandle.appendChild(document.createTextNode('Deck'));
    obj.appendChild(obj.deckHandle);
    obj.resize = function(){
      var sizeM = RoomSize.w/FixedRoomSize.w;
      obj.style.width = sizeM * CardSize.w + 'px';
      obj.style.height = sizeM * CardSize.h + 'px';
      obj.backPlate.style.width = sizeM * CardSize.w + 2 + 'px';
      obj.backPlate.style.height = sizeM * CardSize.h + 2 + 'px';
      obj.deckHandle.style.marginBottom = obj.backPlate.style.height-25+'px';
    };
    obj.updateFunctions.push(function(updateData){
      if('cardStack' in updateData){
        if(updateData.cardStack){
          var cardStack = ClientObjectCollection[updateData.cardStack];
          obj.appendChild(cardStack);
          cardStack.snapTo(obj);
        }
        else{
          var cardStack = ClientObjectCollection[ObjectCollection[obj.uid].get('cardStack')];
          UnparentClientObject(cardStack);
        }
      }
    });
    obj.removeCardStack = function(){
      var cardStack = ClientObjectCollection[ObjectCollection[obj.uid].get('cardStack')];
      var cardStackNode = document.getElementById(cardStack.uid);
      UnparentClientObject(cardStackNode);
      ObjectCollection[obj.uid].set('cardStack', null);
      pushUpdateObjectRequest(obj.uid, {cardStack: null});
      ObjectCollection[cardStack.uid].set('parentObj', null);
      pushUpdateObjectRequest(cardStack.uid, {pos: ObjectCollection[cardStack.uid].get('pos'), parentObj: null});
    };
    obj.attachCardStack = function(cardStackUID){
      cardStack = ClientObjectCollection[cardStackUID];
      obj.appendChild(document.getElementById(cardStackUID));
      cardStack.snapTo(obj);
      ObjectCollection[obj.uid].set('cardStack', cardStackUID);
      pushUpdateObjectRequest(obj.uid, {cardStack: cardStackUID});
      ObjectCollection[cardStackUID].set('parentObj', obj.uid);
      pushUpdateObjectRequest(cardStackUID, {pos: ObjectCollection[cardStackUID].get('pos'), parentObj: obj.uid});
    };
    obj.addEventListener('contextmenu', function(event){
      $("#deck-menu").css({
        top: obj.getBoundingClientRect().top + 'px',
        left: obj.getBoundingClientRect().right + 'px'
      }).addClass("show");
      document.getElementById('deck-menu').currentContext = obj.uid;
      event.preventDefault();
      event.stopPropagation();
    });
    if(ClientObjectCollection[ObjectCollection[obj.uid].get('cardStack')]){
      var cardStack = ClientObjectCollection[ObjectCollection[obj.uid].get('cardStack')];
      obj.appendChild(document.getElementById(cardStack.uid));
      cardStack.snapTo(obj);
    }
    return obj;
  }
}

function MakeMovable(obj){
  var movableObj = document.createElement('div');
  Object.assign(movableObj, obj);
  movableObj.className = "draggable";
  movableObj.setAttribute('data-toggle', 'popover');
  movableObj.setAttribute('data-placement', 'top');
  movableObj.setAttribute('data-trigger', 'manual');
  $(movableObj).popover();
  AttachToRoom(movableObj);
  movableObj.updateFunctions.push(function(updateData){
    if('pos' in updateData){// && movableObj.parentNode === document.getElementById('room')){
      movableObj.updateClientPosition(updateData.pos);
      if('z' in updateData.pos){
        movableObj.style.zIndex = updateData.pos.z;
        if(movableObj.parentNode === document.getElementById('room') && updateData.pos.z >= document.getElementById('room').children.length){
          AttachToRoom(movableObj);
        }
      }
    }
    if('moving' in updateData){
      //If start moving
      if(!ObjectCollection[movableObj.uid].get('moving') && updateData.moving){
        movableObj.setAttribute('data-content', updateData.user);
        $(movableObj).popover('show');
        $(movableObj).css( 'filter', 'drop-shadow('+Math.round(ClientSizeMult*15)+'px '+Math.round(ClientSizeMult*15)+'px '+Math.round(ClientSizeMult*10)+'px #000)');
        gsap.to(movableObj, {duration: 0.1, rotation: 5});
      }
      //If end moving
      else if(ObjectCollection[movableObj.uid].get('moving') && !updateData.moving){
        $(movableObj).popover('hide');
        $(movableObj).css( 'filter', '');
        gsap.to(movableObj, {duration: 0.1, rotation: 0});
      }
      //Update popover position
      $(movableObj).popover('update');
    }
  });
  movableObj.deleteFunctions.push(function(){
    $(movableObj).popover('dispose');
  });
  movableObj.updateClientPosition = function(pos){
    movableObj.setClientPosition(ServerToClientPos(pos));
  }
  movableObj.setClientPosition = function(clientPos){
    movableObj.style.left = clientPos.x + "px";
    movableObj.style.top = clientPos.y + "px";
  }
  movableObj.setPosition = function(pos){
    ObjectCollection[movableObj.uid].get('pos').x = pos.x;
    ObjectCollection[movableObj.uid].get('pos').y = pos.y;
  }
  movableObj.moveTo = function(clientPos){
    var ParentPos = movableObj.parentNode.getBoundingClientRect();
    clientPos.x = clientPos.x - ParentPos.left;
    clientPos.y = clientPos.y - ParentPos.top;
    movableObj.setClientPosition(clientPos);
    var serverPos = ClientToServerPos(clientPos);
    //var parentServerPos = ClientToServerPos({x: ParentPos.left, y: ParentPos.top});
    movableObj.setPosition({x: serverPos.x, y: serverPos.y});
  }
  movableObj.snapTo = function(target){
    targetBounds = target.getBoundingClientRect();
    movableObj.moveTo({x: targetBounds.left, y: targetBounds.top});
  }
  assignInputStartEvent(movableObj, function(event){
    if(!ObjectCollection[movableObj.uid].get('moving') && !ObjectCollection[movableObj.uid].get('locked')){
      GrabObject(event.currentTarget);
      var objBounds = event.currentTarget.getBoundingClientRect();
      var targetBounds = event.target.getBoundingClientRect();
      dragOffset = {x: targetBounds.left - objBounds.left + event.offsetX, y: targetBounds.top - objBounds.top + event.offsetY};
    }
    event.preventDefault();
    event.stopPropagation();
  });
  if('pos' in ObjectCollection[movableObj.uid].objData){
    movableObj.updateClientPosition(ObjectCollection[movableObj.uid].get('pos'));
  }
  return movableObj;
}
function CreateClientObject(uid, objType, objectData, noSave){
  try{
    //Create Object Data (Model)
    var obj = {uid: uid, objType: objType, objData: {}};
    obj.get = function(attribute){
      //console.log('Trying to get: '+attribute+' of', obj);
      return obj.objData[attribute];
    };
    obj.set = function(attribute, value){obj.objData[attribute] = value};
    for(attr in objectData){
      if(!noSave[attr]){
        //console.log('Saving ' + attr + ' to ' + uid, objectData[attr]);
        obj.objData[attr] = {};
        Object.assign(obj.objData[attr], objectData[attr]);
      }
    }
    //Object.assign(obj.objData, objectData);
    ObjectCollection[uid] = obj;
    //Create Client Object Base
    var clientObj = {uid: uid, id: uid, updateFunctions: [], deleteFunctions: [], resize: function(){}};
    //Create Common Movable Functionality if applicable
    if('movable' in objectData){clientObj = MakeMovable(clientObj);}
    //Finish with type specific functionality
    ClientObjectCollection[uid] = InitializeObject[objType](clientObj, objectData);
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
    if(objUid == obj.uid || ObjectCollection[obj.uid].objType == 'CardStack' && ObjectCollection[obj.uid].get('cards').includes(objUid)){
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

function AnimateMove(obj, location, duration=0.5){
  gsap.to(obj, {duration: duration, x: location.x, y: location.y});
}

function FlipStack(cardStackObj){
  var cards = ObjectCollection[cardStackObj.uid].get('cards');
  var tl = gsap.timeline();
  tl.pause();
  var duration = .1;
  for(var i = 0; i < cards.length; i++){
      tl.call(pushUpdateObjectRequest, [cards[i], {faceUp : !ObjectCollection[cards[i]].get('faceUp'), cardLabel: {}}, true], '<'+duration*0.25);
  }
  tl.resume();
}
function ArrangeStack(cardStackObj, arrangement, cards=ObjectCollection[cardStackObj.uid].get('cards'), callback=function(){}){
  if(arrangement == 'standard'){
    return FanReverseStack(cardStackObj, cards);
  }
  else if(arrangement == 'fandown'){
    return FanDownStack(cardStackObj, cards);
  }
  else if(arrangement == 'fanright'){
    return FanRightStack(cardStackObj, cards);
  }
  else if(arrangement == 'fanout'){
    return FanOutStack(cardStackObj, cards);
  }
  else if(arrangement == 'shuffle'){
    return ShuffleStack(cardStackObj, cards, callback);
  }
}
function FanRightStack(cardStackObj, cards){
  var tl = gsap.timeline();
  tl.pause();
  for(var i = 0; i < cards.length; i++){
      tl.to(ClientObjectCollection[cards[i]], {duration: 0.25, left: i*ClientSizeMult*AnimationUnit, top: 0, zIndex: i, rotation: 0, ease: 'power3', overwrite: 'all', transformOrigin: '0 0'}, '<');
  }
  tl.resume();
  return tl;
}
function FanDownStack(cardStackObj, cards){
  var tl = gsap.timeline();
  tl.pause();
  for(var i = 0; i < cards.length; i++){
    tl.to(ClientObjectCollection[cards[i]], {duration: 0.25, left: 0, top: i*+ClientSizeMult*AnimationUnit, zIndex: i, rotation: 0, ease: 'power3'}, '<');
  }
  tl.resume();
  return tl;
}
function FanOutStack(cardStackObj, cards){
  var tl = gsap.timeline();
  tl.pause();
  var angleSpread = 10;
  for(var i = 0; i < cards.length; i++){
      var centerDist = i-(cards.length-1)/2;
      tl.to(ClientObjectCollection[cards[i]], {duration: 0.25, left: 0, top: 0, zIndex: i, rotation: angleSpread * centerDist, transformOrigin: '20% 90%', ease: 'power3'}, '<');
  }
  tl.resume();
  return tl;
}
function FanReverseStack(cardStackObj, cards){
  var tl = gsap.timeline();
  tl.pause();
  for(var i = 0; i < cards.length; i++){
    tl.to(ClientObjectCollection[cards[i]], {duration: 0.25, left: 0, top: 0, zIndex: i, rotation: 0, ease: 'power3'}, '<');
  }
  tl.resume();
  return tl;
}

function ShuffleStack(cardStackObj, cards, callback=function(){}){
    var tl = gsap.timeline();
    tl.pause();
    for(var i = 0; i < cards.length; i++){
        tl.to(ClientObjectCollection[cards[i]], {duration: 0.25, left: 0, top: 0, rotation: 0, ease: 'power3'}, '<');
    }
    tl.set({}, {}, 0.5);
    for(var i = 0; i < cards.length; i++){
        tl.to(ClientObjectCollection[cards[i]], {duration: 0.2, left: 'random(-'+ClientSizeMult*AnimationUnit+','+ClientSizeMult*AnimationUnit+')', y: 'random(-'+ClientSizeMult*AnimationUnit+','+ClientSizeMult*AnimationUnit+')', repeat: 1, yoyo: true}, '<0.05');
        tl.to(ClientObjectCollection[cards[i]], {duration: 0.2, zIndex: i+1}, '<');
    }
    tl.call(callback);
    tl.resume();
}

function UnparentClientObject(clientObj){
  var temp = document.createElement('div');
  document.body.appendChild(temp);
  temp.style.position = 'absolute';
  var rect = clientObj.getBoundingClientRect();
  temp.style.left = rect.x + 'px';
  temp.style.top = rect.y + 'px';
  AttachToRoom(clientObj)
  clientObj.snapTo(temp);
  document.body.removeChild(temp);
}

function AppendChildInPlace(clientObj, newParent){
  var temp = document.createElement('div');
  document.body.appendChild(temp);
  temp.style.position = 'absolute';
  var rect = clientObj.getBoundingClientRect();
  temp.style.left = rect.x + 'px';
  temp.style.top = rect.y + 'px';
  newParent.appendChild(clientObj);
  var parBounds = newParent.getBoundingClientRect();
  var tempBounds = temp.getBoundingClientRect();
  gsap.to(clientObj, {left: tempBounds.x - parBounds.x, top: tempBounds.y - parBounds.y, transformOrigin: '0 0'}).progress(1);
  document.body.removeChild(temp);
}

function AttachToRoom(clientObj){
  document.getElementById('room').appendChild(clientObj);
  for(var i = 0; i < document.getElementById('room').children.length; i++){
    document.getElementById('room').children[i].style.zIndex = i+1;
  }
}