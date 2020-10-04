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
    obj.removeCardStack = function(){
      var cardStack = ClientObjectCollection[VGNIO.GetObjAttr(obj.uid, 'cardStack')];
      var cardStackNode = document.getElementById(cardStack.uid);
      VGNIO.UnparentClientObject(cardStackNode);
      VGNIO.SetObjAttr(obj.uid, 'cardStack', null);
      pushUpdateObjectRequest(obj.uid, {cardStack: null});
      VGNIO.SetObjAttr(cardStack.uid, 'parentObj', null);
      pushUpdateObjectRequest(cardStack.uid, {pos: VGNIO.GetObjAttr(cardStack.uid, 'pos'), parentObj: null});
    };
    obj.attachCardStack = function(cardStackUID){
      cardStack = ClientObjectCollection[cardStackUID];
      obj.appendChild(document.getElementById(cardStackUID));
      MoveObject(cardStack, {x: 0, y: 0});
      //SnapObject(cardStack, obj);
      VGNIO.SetObjAttr(obj.uid, 'cardStack', cardStackUID);
      pushUpdateObjectRequest(obj.uid, {cardStack: cardStackUID});
      VGNIO.SetObjAttr(cardStackUID, 'parentObj', obj.uid);
      pushUpdateObjectRequest(cardStackUID, {pos: VGNIO.GetObjAttr(cardStackUID, 'pos'), parentObj: obj.uid});
    };
    //obj.addEventListener('contextmenu', function(event){
    if(ClientObjectCollection[VGNIO.GetObjAttr(obj.uid, 'cardStack')]){
      var cardStack = ClientObjectCollection[VGNIO.GetObjAttr(obj.uid, 'cardStack')];
      obj.appendChild(document.getElementById(cardStack.uid));
      SnapObject(cardStack, obj);
    }
    return obj;
  };
  this.OnClick = function(event){
    alert('click for deck');
  }
  
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
            {text: "Recall Cards", action: function(event){
              var cardsInDeck = VGNIO.GetObjAttr(event.target.id, 'cards');
              var deckBounds = event.target.getBoundingClientRect();

              var tl = gsap.timeline({delay: 0.25, onComplete: function(){
                var deckStack = VGNIO.GetObjAttr(event.target.id, 'cardStack');
                if(deckStack && deckStack in ObjectCollection){
                  for(card of cardsInDeck){
                    if(!VGNIO.GetObjAttr(deckStack, 'cards').includes(card)){
                      ClientObjectCollection[deckStack].addCard(card);
                    }
                  }
                }
                else{
                  createObjectRequest('CardStack', {
                    pos: ObjectCollection[event.target.id].objData.pos,
                    cards: cardsInDeck,
                    parentObj: event.target.id
                  });
                }
              }});
              tl.pause();
              var otherStacks = {};
              var deckStack = VGNIO.GetObjAttr(event.target.id, 'cardStack');
              for(card of cardsInDeck){
                //ClientObjectCollection[card].zIndex += event.target.zIndex;
                //let cardUID = card;
                if(!deckStack || !VGNIO.GetObjAttr(deckStack, 'cards').includes(card)){
                  var cardParent = VGNIO.GetObjAttr(card, 'parentObj');
                  if(cardParent && cardParent != deckStack){
                    if(cardParent in otherStacks){
                      otherStacks[cardParent].push(card);
                    }
                    else{
                      otherStacks[cardParent] = [card];
                    }
                  }
                  tl.to(ClientObjectCollection[card], {duration: 1, ease: 'power3', x: deckBounds.x - VGNIO.Room.Bounds.x, y: deckBounds.y - VGNIO.Room.Bounds.y, onStart: function(cardUID){
                    var serverLoc = clientToRoomPosition(deckBounds);
                    moveObjectRequest(cardUID, {duration: 1, xPre: '', x: serverLoc.x, yPre: '', y: serverLoc.y, rotation: 0, ease: 'power3'});
                  }, onStartParams: [card]}, '<');
                }
              }
              for(otherStack in otherStacks){
                ClientObjectCollection[otherStack].removeCards(otherStacks[otherStack]);
              }
              tl.set({}, {}, '>0.5');
              tl.resume();
            }}
          ]
        }
      }
    }
  }
};