var VGNIO = VGNIO || {};
//VGNIO.ClientObjects = VGNIO.ClientObjects || new function(){};
VGNIO.CardStack = new function(){
  this.create = function(obj){
    obj = VGNIO.Movable.create(obj);
    obj.classList.add('cardstack');
    obj.labelHandle = document.createElement('div');
    obj.labelHandle.classList.add('labelHandle');
    obj.countText = document.createTextNode('2');
    obj.labelHandle.appendChild(obj.countText);
    obj.labelHandle.classList.add('badge')
    obj.labelHandle.classList.add('badge-primary')
    obj.appendChild(obj.labelHandle);
    VGNIO.Movable.InitDraggable(obj, {trigger: obj.labelHandle});
    obj.cardSlot = document.createElement('div');
    obj.cardSlot.classList.add('cardSlot');
    obj.appendChild(obj.cardSlot);

    obj.resize = function(){
      //var sizeM = VGNIO.Room.Bounds.w/VGNIO.Room.TargetRoomSize.w;
      obj.style.width = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.w + 'px';
      obj.style.height = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.h + 'px';
      obj.cardSlot.style.width = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.w + 'px';
      obj.cardSlot.style.height = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.h + 'px';
      ArrangeStack(obj, VGNIO.GetObjAttr(obj.uid, 'arrangement'));
    };
    obj.resize();
    obj.attachCards = function(){
      var cards = VGNIO.GetObjAttr(obj.uid, 'cards');
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
        MoveObject(cardObj, {x: 0, y: 0});
        //SnapObject(cardObj, obj.cardSlot);
        cardObj.style.zIndex = i;
        VGNIO.SetObjAttr(cards[i], 'parentObj', obj.uid);
      }
      //obj.cardSlot.style.zIndex = cards.length;
      obj.countText.nodeValue = cards.length;
      ArrangeStack(obj, VGNIO.GetObjAttr(obj.uid, 'arrangement'));
    }
    obj.addCard = function(card, index){
      var cards = VGNIO.GetObjAttr(obj.uid, 'cards');
      //cards.push(card);
      cards.splice(index, 0, card);
      var cardObj =  ClientObjectCollection[card];    
      obj.appendChild(cardObj);
      SnapObject(cardObj, obj.cardSlot);
      var cardsLen = cards.length;
      //VGNIO.GetObjAttr(cardObj.uid, 'pos').z = cardsLen - 1;
      VGNIO.SetObjAttr(cardObj.uid, 'parentObj', obj.uid);
      cardObj.style.zIndex = index;
      //obj.cardSlot.style.zIndex = cardsLen;
      obj.countText.nodeValue = cardsLen;
      for(var i = index; i < cardsLen; i++){
        ClientObjectCollection[cards[i]].style.zIndex = i;
        VGNIO.GetObjAttr(cards[i], 'pos').z = i;
        //pushUpdateObjectRequest(card, {pos: ObjectCollection[card].objData['pos'], parentObj: {value: obj.uid}});
        pushUpdateObjectRequest(card, {parentObj: obj.uid});
      }
      //pushUpdateObjectRequest(card, {parentObj: {value: obj.uid}});
      pushUpdateObjectRequest(obj.uid, {cards: cards});
      ArrangeStack(obj, VGNIO.GetObjAttr(obj.uid, 'arrangement'));
    };
    obj.removeCards = function(removedCards, localOnly=false, newParent=null){
      var cards = VGNIO.GetObjAttr(obj.uid, 'cards');
      for(card of removedCards){
        var index = cards.indexOf(card);
        if (index !== -1){
          cards.splice(index, 1);
          var cardObj =  ClientObjectCollection[card];
          obj.countText.nodeValue = cards.length;
          VGNIO.UnparentClientObject(cardObj);
          VGNIO.SetObjAttr(cardObj.uid, 'parentObj', newParent);
          if(!localOnly){
            pushUpdateObjectRequest(card, {parentObj: newParent, releaseUser: true});
          }
        }
        else{
          console.log("Tried to remove card from stack that was not in stack");
        } 
      }
      if(cards.length < 2 && !VGNIO.GetObjAttr(obj.uid, 'parentObj') || cards.length < 1 && VGNIO.GetObjAttr(obj.uid, 'parentObj')){
        for(card of cards){
          $('#'+card).show();
          if(obj.contains(ClientObjectCollection[card])){
            var cardObj =  ClientObjectCollection[card];
            VGNIO.UnparentClientObject(cardObj);
            pushUpdateObjectRequest(card, {parentObj: newParent, releaseUser: true});
          }
        }
        var parentObj = VGNIO.GetObjAttr(obj.uid, 'parentObj');
        if(parentObj){
          VGNIO.SetObjAttr(parentObj, 'cardStack', null);
        }
        deleteObjectRequest(obj.uid);
      }
      else{
        pushUpdateObjectRequest(obj.uid, {cards: cards});
        ArrangeStack(obj, VGNIO.GetObjAttr(obj.uid, 'arrangement'));
      }
    };
    obj.removeCard = function(card, localOnly=false, newParent=null){
      obj.removeCards([card], localOnly, newParent);
    };

    obj.updateFunctions.push(function(updateData){
      if('cards' in updateData){
        var oldCards = VGNIO.GetObjAttr(obj.uid, 'cards');
        var removedCards = oldCards.filter(function(card){return !updateData.cards.includes(card)});
        for(card of removedCards){
          var cardObj =  ClientObjectCollection[card];
          if(obj.contains(cardObj)){
            VGNIO.UnparentClientObject(cardObj);
          }
        }
        var addedCards = updateData.cards.filter(function(card){return !oldCards.includes(card)});
        for(card of addedCards){
          var cardObj =  ClientObjectCollection[card];    
          obj.appendChild(cardObj);
          SnapObject(cardObj, obj.cardSlot);
        }
        for(var i = 0; i < updateData.cards.length; i++){
          ClientObjectCollection[updateData.cards[i]].style.zIndex = i;
        }
        obj.countText.nodeValue = updateData.cards.length;
        if('arrangement' in updateData){
          ArrangeStack(obj, updateData.arrangement, updateData.cards);
        }
        else{
          ArrangeStack(obj, VGNIO.GetObjAttr(obj.uid, 'arrangement'), updateData.cards);
        }
      }
      else if('arrangement' in updateData){
        ArrangeStack(obj, updateData.arrangement);
      }
    });
    obj.deleteFunctions.push(function(){
      for(card of VGNIO.GetObjAttr(obj.uid, 'cards')){
        if(obj.contains(ClientObjectCollection[card])){
          $('#'+card).show();
          var cardObj =  ClientObjectCollection[card];
          UnparentClientObject(cardObj);
          //pushUpdateObjectRequest(card, {pos: ObjectCollection[card].objData['pos'], parentObj: null, moving: false, locked: false, releaseUser: true}, true);
        }
      }
      var parentObj = ObjectCollection[obj.uid].get('parentObj');
      if(parentObj){
        ObjectCollection[parentObj].set('cardStack', null);
      }
    });
    obj.attachCards();
    if(ClientObjectCollection[VGNIO.GetObjAttr(obj.uid, 'parentObj')]){
      var deck = ClientObjectCollection[VGNIO.GetObjAttr(obj.uid, 'parentObj')];
      deck.appendChild(document.getElementById(obj.uid));
      SnapObject(obj, deck);
      VGNIO.SetObjAttr(deck.uid, 'cardStack', obj.uid);
    }
    return obj;
  };

  this.OnClick = function(event){
    alert('click for cardstack');
  }
  
  this.OnRightClick = function(event){
    VGNIO.ShowContextMenu('CardStack', event);
  }

  this.isSnappableTarget = function(uid, sourceUid){
    if(VGNIO.GetObjType(uid) == 'Card'){
      return $("#"+uid).is(":visible") && !VGNIO.GetObjAttr(sourceUid, 'cards').includes(uid);
    }
    else if(VGNIO.GetObjType(uid) == 'Deck'){
      return VGNIO.GetObjAttr(uid, 'cardStack') === null;
    }
    return false;
  }

  this.OnDragStart = function(event){
    if(VGNIO.GetObjAttr(event.target.id, 'parentObj')){
      ClientObjectCollection[VGNIO.GetObjAttr(event.target.id, 'parentObj')].removeCardStack();
      event.update();
    }
  }

  this.OnDrag = function(event){}

  this.OnDragEnd = function(event){
    if(event.snappedObj !== null){
      var snappedType = VGNIO.GetObjType(event.snappedObj.id);
      if(snappedType == 'Card'){
        var parentStack = VGNIO.GetObjAttr(event.snappedObj.id, 'parentObj');
        if(parentStack){
          if(VGNIO.GetObjAttr(parentStack, 'arrangement') == 'standard'){
            MergeStacks(parentStack, event.target.id);
          }
          else{
            MergeStacks(parentStack, event.target.id, event.snappedObj.z);
          }

        }
        else{
          event.target.addCard(event.snappedObj.id, 0);
        }
      }
      else if(snappedType == 'Deck'){
        document.getElementById(event.snappedObj.id).attachCardStack(event.target.id);
      }
    }
  }

  this.ContextMenuSpecs = {
    cardstack_section: function(){
      return {
        attribute: null,
        condition: null,
        name: "Card Stack",
        getTarget: function(event){
          return event.target;
        },
        items: function(){
          return [
            {text: "Flip Stack", action: function(event){
              FlipStack(ClientObjectCollection[event.target.id]);
            }},
            {text: "Shuffle", action: function(event){
              var shuffledCards = shuffleArray(VGNIO.GetObjAttr(event.target.id, 'cards'));
              pushUpdateObjectRequest(event.target.id, {arrangement: 'shuffle', cards: shuffledCards});
              ArrangeStack(event.target, 'shuffle', shuffledCards, function(){
                var arrangement = VGNIO.GetObjAttr(event.target.id, 'arrangement');
                pushUpdateObjectRequest(event.target.id, {arrangement: arrangement});
                ArrangeStack(event.target, arrangement);
              });
            }},
            {text: "Split Stack", action: function(event){
              var stackPos = clientToRoomPosition(event.target.getBoundingClientRect());
              SplitStack(event.target.id, {x: Math.max(0.03, stackPos.x - normalizePosition({x: VGNIO.Card.CardSize.w, y: VGNIO.Card.CardSize.h}).x), y: Math.max(0.03, stackPos.y)});            
            }},
            {text: "Fan Right", action: function(event){
              VGNIO.SetObjAttr(event.target.id, 'arrangement', 'fanright');
              pushUpdateObjectRequest(event.target.id, {arrangement: 'fanright'});
              ArrangeStack(event.target, 'fanright');
            }},
            {text: "Fan Down", action: function(event){
              VGNIO.SetObjAttr(event.target.id, 'arrangement', 'fandown');
              pushUpdateObjectRequest(event.target.id, {arrangement: 'fandown'});
              ArrangeStack(event.target, 'fandown');
            }},
            {text: "Fan Out", action: function(event){
              VGNIO.SetObjAttr(event.target.id, 'arrangement', 'fanout');
              pushUpdateObjectRequest(event.target.id, {arrangement: 'fanout'});
              ArrangeStack(event.target, 'fanout');
            }},
            {text: "Neatly Stack", action: function(event){
              VGNIO.SetObjAttr(event.target.id, 'arrangement', 'standard');
              pushUpdateObjectRequest(event.target.id, {arrangement: 'standard'});
              ArrangeStack(event.target, 'standard');
            }}
          ];
        }
      }

    },
    deck_section: function(){
      return {
        attribute: 'parentObj',
        condition: true,
        name: "Deck",
        getTarget: function(event){
          return document.getElementById(VGNIO.GetObjAttr(event.target.id, 'parentObj'));
        },
        items: function(){
          return VGNIO.Deck.ContextMenuSpecs.deck_section().items();
        }
      }
    }
  }
};
function SplitStack(stack, pos, index=Math.floor(VGNIO.GetObjAttr(stack, 'cards').length/2)){
  var stackObj = document.getElementById(stack);
  var cards = VGNIO.GetObjAttr(stack, 'cards');
  var newCards = cards.slice(index);
  stackObj.removeCards(newCards, true);

  if(newCards.length >= 2){
    var newStackData = {
      pos: pos,
      cards: newCards,
      arrangement: 'standard'
    };
    createObjectRequest('CardStack', newStackData);
  }
  else{
    for(card of newCards){
      MoveObject(document.getElementById(card), pos);
      pushUpdateObjectRequest(card, {parentObj: null, releaseUser: true});
    }
  }
  pushUpdateObjectRequest(stack, {cards: cards});
  ArrangeStack(stackObj, VGNIO.GetObjAttr(stack, 'arrangement'));
}

function MergeStacks(target, source, index=VGNIO.GetObjAttr(target, 'cards').length){
  var targetObj = document.getElementById(target);
  var targetCards = VGNIO.GetObjAttr(target, 'cards');
  var sourceCards = VGNIO.GetObjAttr(source, 'cards').slice(0);
  document.getElementById(source).removeCards(sourceCards, false, target);
  sourceCards = sourceCards.concat(targetCards.splice(index, targetCards.length - index));
  targetCards = targetCards.concat(sourceCards);
  targetObj.countText.nodeValue = targetCards.length;
  for(var i = 0; i < targetCards.length; i++){
    VGNIO.GetObjAttr(targetCards[i], 'pos').z = i;
    var cardObj = document.getElementById(targetCards[i]);
    targetObj.appendChild(cardObj);
    SnapObject(cardObj, targetObj.cardSlot);
    cardObj.style.zIndex = i;
    VGNIO.SetObjAttr(targetCards[i], 'parentObj', target);
    pushUpdateObjectRequest(targetCards[i], {pos: VGNIO.GetObjAttr(targetCards[i], 'pos'), parentObj: target});
  }
  VGNIO.SetObjAttr(target, 'cards', targetCards);
  pushUpdateObjectRequest(target, {cards: targetCards});
  ArrangeStack(targetObj, VGNIO.GetObjAttr(target, 'arrangement'));
}

function ExplodeStack(stack){

}

function FlipStack(cardStackObj){
  var cards = VGNIO.GetObjAttr(cardStackObj.uid, 'cards');
  var tl = gsap.timeline();
  tl.pause();
  var duration = .1;
  for(var i = 0; i < cards.length; i++){
      tl.call(pushUpdateObjectRequest, [cards[i], {faceUp : !VGNIO.GetObjAttr(cards[i], 'faceUp'), cardLabel: {}}, true], '<'+duration*0.25);
  }
  tl.resume();
}
function ArrangeStack(cardStackObj, arrangement, cards=VGNIO.GetObjAttr(cardStackObj.uid, 'cards'), callback=function(){}){
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
      $(ClientObjectCollection[cards[i]]).show();
      tl.to(ClientObjectCollection[cards[i]], {duration: 0.25, x: i*VGNIO.Room.ClientSizeMult*AnimationUnit, y: 0, zIndex: i, rotation: 0, ease: 'power3', overwrite: 'all', transformOrigin: '0 0'}, '<');
  }
  tl.resume();
  return tl;
}
function FanDownStack(cardStackObj, cards){
  var tl = gsap.timeline();
  tl.pause();
  for(var i = 0; i < cards.length; i++){
    $(ClientObjectCollection[cards[i]]).show();
    tl.to(ClientObjectCollection[cards[i]], {duration: 0.25, x: 0, y: i*+VGNIO.Room.ClientSizeMult*AnimationUnit, zIndex: i, rotation: 0, ease: 'power3'}, '<');
  }
  tl.resume();
  return tl;
}
function FanOutStack(cardStackObj, cards){
  var tl = gsap.timeline();
  tl.pause();
  var angleSpread = 10;
  for(var i = 0; i < cards.length; i++){
      $(ClientObjectCollection[cards[i]]).show();
      var centerDist = i-(cards.length-1)/2;
      tl.to(ClientObjectCollection[cards[i]], {duration: 0.25, x: 0, y: 0, zIndex: i, rotation: angleSpread * centerDist, transformOrigin: '20% 90%', ease: 'power3'}, '<');
  }
  tl.resume();
  return tl;
}
function FanReverseStack(cardStackObj, cards){
  var tl = gsap.timeline();
  tl.pause();
  for(var i = 0; i < cards.length; i++){  
    if(i == cards.length - 1){
      $(ClientObjectCollection[cards[i]]).show();
    }
    tl.to(ClientObjectCollection[cards[i]], {duration: 0.25, x: 0, y: 0, zIndex: i, rotation: 0, ease: 'power3', onCompleteParams: [cards[i], i >= cards.length - 2], onComplete: function(cardUID, shouldShow){
      if(shouldShow){
        $(ClientObjectCollection[cardUID]).show();
      }
      else{
        $(ClientObjectCollection[cardUID]).hide();
      }
    }}, '<');
  }
  tl.resume();
  return tl;
}
function ShuffleStack(cardStackObj, cards, callback=function(){}){
    var tl = gsap.timeline();
    tl.pause();
    for(var i = 0; i < cards.length; i++){
        $(ClientObjectCollection[cards[i]]).show();
        tl.to(ClientObjectCollection[cards[i]], {duration: 0.25, x: 0, y: 0, rotation: 0, ease: 'power3'}, '<');
    }
    tl.set({}, {}, 0.5);
    for(var i = 0; i < cards.length; i++){
        tl.to(ClientObjectCollection[cards[i]], {duration: 0.2, x: 'random(-'+VGNIO.Room.ClientSizeMult*AnimationUnit+','+VGNIO.Room.ClientSizeMult*AnimationUnit+')', y: 'random(-'+VGNIO.Room.ClientSizeMult*AnimationUnit+','+VGNIO.Room.ClientSizeMult*AnimationUnit+')', repeat: 1, yoyo: true}, '<0.05');
        tl.to(ClientObjectCollection[cards[i]], {duration: 0.2, zIndex: i+1}, '<');
    }
    tl.call(callback);
    tl.resume();
}