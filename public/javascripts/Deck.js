var VGNIO = VGNIO || {};
//VGNIO.ClientObjects = VGNIO.ClientObjects || new function(){};
VGNIO.Deck = new function(){
  this.create = function(obj){
    obj = VGNIO.Movable.create(obj);
    obj.cardSlot = document.createElement('div');
    obj.cardSlot.classList.add('cardSlot');
    obj.appendChild(obj.cardSlot);

    obj.backPlate = document.createElement('div');
    obj.backPlate.classList.add('backplate');
    obj.appendChild(obj.backPlate);

    obj.deckHandle = document.createElement('div');
    obj.deckHandle.classList.add('deckHandle')
    obj.deckHandle.classList.add('badge')
    obj.deckHandle.classList.add('badge-secondary')
    obj.deckHandle.appendChild(document.createTextNode('Deck'));
    obj.appendChild(obj.deckHandle);

    VGNIO.Movable.InitDraggable(obj, {trigger: obj.deckHandle});
    obj.resize = function(){
      //var sizeM = VGNIO.Room.Bounds.w/VGNIO.Room.TargetRoomSize.w;
      obj.style.width = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.w + 'px';
      obj.style.height = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.h + 'px';
      obj.backPlate.style.width = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.w + 2 + 'px';
      obj.backPlate.style.height = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.h + 2 + 'px';
      //obj.deckHandle.style.marginBottom = obj.backPlate.style.height-25+'px';
    };
    obj.updateFunctions.push(function(updateData){
      if('cardStack' in updateData){
        if(updateData.cardStack){
          var cardStack = ClientObjectCollection[updateData.cardStack];
          obj.appendChild(cardStack);
          SnapObject(cardStack, obj);
        }
        else{
          var cardStack = ClientObjectCollection[VGNIO.GetObjAttr(obj.uid, 'cardStack')];
          VGNIO.UnparentClientObject(cardStack);
        }
      }
    });
    obj.removeCardStack = function(sendUpdate=false){
      var updates = [];
      var cardStack = ClientObjectCollection[VGNIO.GetObjAttr(obj.uid, 'cardStack')];
      var cardStackNode = document.getElementById(cardStack.uid);
      VGNIO.UnparentClientObject(cardStackNode);
      VGNIO.SetObjAttr(obj.uid, 'cardStack', null);
      VGNIO.SetObjAttr(cardStack.uid, 'parentObj', null);
      updates.push(pushUpdateObjectRequest(obj.uid, {cardStack: null}));
      updates.push(pushUpdateObjectRequest(cardStack.uid, {pos: VGNIO.GetObjAttr(cardStack.uid, 'pos'), parentObj: null}));
      if(sendUpdate){
        SendRequests(updates);
      }
      return updates;
    };
    obj.attachCardStack = function(cardStackUID){
      cardStack = ClientObjectCollection[cardStackUID];
      obj.appendChild(document.getElementById(cardStackUID));
      MoveObject(cardStack, {x: 0, y: 0});
      //SnapObject(cardStack, obj);
      VGNIO.SetObjAttr(obj.uid, 'cardStack', cardStackUID);
      VGNIO.SetObjAttr(cardStackUID, 'parentObj', obj.uid);
      SendRequests([
        pushUpdateObjectRequest(obj.uid, {cardStack: cardStackUID}), 
        pushUpdateObjectRequest(cardStackUID, {pos: VGNIO.GetObjAttr(cardStackUID, 'pos'), parentObj: obj.uid})
      ]);
    };
    //obj.addEventListener('contextmenu', function(event){
    if(ClientObjectCollection[VGNIO.GetObjAttr(obj.uid, 'cardStack')]){
      var cardStack = ClientObjectCollection[VGNIO.GetObjAttr(obj.uid, 'cardStack')];
      obj.appendChild(document.getElementById(cardStack.uid));
      SnapObject(cardStack, obj);
    }
    return obj;
  };
  this.OnClick = function(event){}
  
  this.OnRightClick = function(event){
    VGNIO.ShowContextMenu('Deck', event);
  }

  this.isSnappableTarget = function(uid){
    return false;
  }

  this.OnDragStart = function(event){}

  this.OnDrag = function(event){}

  this.OnDragEnd = function(event){}

  this.ContextMenuSpecs = {
    default: {
      deck_section: function(){
        return {
          attribute: null,
          condition: null,
          name: "Deck",
          getTarget: function(event){
            return event.target;
          },
          items: function(){
            return [
              {text: "Recall Cards", type: 'default', action: function(event){
                RecallCards(event.target.id);
              }},
              {text: "Delete Deck", type: 'default', action: function(event){
                DeleteDeck(event.target.id);
              }}
            ]
          }
        }
      }
    }
  }
};

function FindCards(deck, includeSelf=false){
  var cardStacks = {loose: []};
  var cardsInDeck = VGNIO.GetObjAttr(deck, 'cards');
  var deckStack = VGNIO.GetObjAttr(deck, 'cardStack');
  var deckStackArr = VGNIO.GetObjAttr(deckStack, 'cards');
  for(card of cardsInDeck){
    if(!deckStack || !deckStackArr.includes(card) || includeSelf){
      var cardParent = VGNIO.GetObjAttr(card, 'parentObj');
      if(cardParent && cardParent != deckStack){
        if(cardParent in cardStacks){
          cardStacks[cardParent].push(card);
        }
        else{
          cardStacks[cardParent] = [card];
        }
      }
      else{
        cardStacks.loose.push(card);
      }
    }
  }
  return cardStacks;
}

function RecallCards(deck){
  var cardsInDeck = VGNIO.GetObjAttr(deck, 'cards');
  var deckObj = document.getElementById(deck);
  var deckBounds = deckObj.getBoundingClientRect();
  var deckStack = VGNIO.GetObjAttr(deck, 'cardStack');
  var tl = gsap.timeline({delay: 0.25, onComplete: function(){
    var requests = [];
    if(deckStack && deckStack in ObjectCollection){
      for(card of cardsInDeck){
        if(!VGNIO.GetObjAttr(deckStack, 'cards').includes(card)){
          requests = requests.concat(AddCard(deckStack, card, VGNIO.GetObjAttr(deckStack, 'cards').length));
        }
      }
      SendRequests(requests);
    }
    else{
      SendRequests([createObjectRequest('CardStack', {
        pos: VGNIO.GetObjAttr(deck, 'pos'),
        cards: cardsInDeck,
        parentObj: deck
      })]);
    }
  }});
  tl.pause();
  var otherStacks = FindCards(deck);
  var requests = [];
  for(otherStack in otherStacks){
    if(otherStack != 'loose'){
      requests = requests.concat(RemoveCards(otherStack, otherStacks[otherStack]));
    }
  }
  if(Object.keys(otherStacks).length > 1 || otherStacks.loose.length > 0){
    var serverLoc = clientToRoomPosition(deckBounds);
    for(stack in otherStacks){
      for(card of otherStacks[stack]){
        requests.push(moveObjectRequest(card, {duration: 1, x: serverLoc.x, y: serverLoc.y, rotation: 0, ease: 'power3'}));
        tl.to(ClientObjectCollection[card], {duration: 1, ease: 'power3', rotation: 0, x: deckBounds.x - VGNIO.Room.Bounds.x, y: deckBounds.y - VGNIO.Room.Bounds.y}, '<');
      }
    }
    tl.set({}, {}, '>0.5');
    tl.resume();
    SendRequests(requests);
  }
  else{
    tl.kill();
  }
}

function DeleteDeck(deck){
  var cardStacks = FindCards(deck, true);
  var cardsInDeck = VGNIO.GetObjAttr(deck, 'cards');
  var deckStack = VGNIO.GetObjAttr(deck, 'cardStack');
  var requests = [];
  for(stack in cardStacks){
    if(stack != 'loose'){
      requests = requests.concat(RemoveCards(stack, cardStacks[stack]));
    }
  }
  for(card of cardsInDeck){
    requests.push(deleteObjectRequest(card));
  }
  if(deckStack){
    requests.push(deleteObjectRequest(deckStack));
  }
  requests.push(deleteObjectRequest(deck));
  SendRequests(requests);
}