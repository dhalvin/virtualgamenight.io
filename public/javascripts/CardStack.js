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

    obj.updateFunctions.push(function(updateData){
      if('cards' in updateData){
        var oldCards = VGNIO.GetObjAttr(obj.uid, 'cards');
        var removedCards = oldCards.filter(function(card){return !updateData.cards.includes(card)});
        for(card of removedCards){
          $('#'+card).show();
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
          VGNIO.UnparentClientObject(cardObj);
        }
      }
      var parentObj = VGNIO.GetObjAttr(obj.uid, 'parentObj');
      if(parentObj){
        VGNIO.SetObjAttr(parentObj, 'cardStack', null);
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

  this.OnClick = function(event){}
  
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
      ClientObjectCollection[VGNIO.GetObjAttr(event.target.id, 'parentObj')].removeCardStack(true);
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
          AddCard(event.target.id, event.snappedObj.id, 0, true);
        }
      }
      else if(snappedType == 'Deck'){
        document.getElementById(event.snappedObj.id).attachCardStack(event.target.id);
      }
    }
  }

  this.ContextMenuSpecs = {
    default: {
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
              {text: "Toggle Private", type: 'default', action: function(event){
                MakePrivate(event.target.id, !VGNIO.GetObjAttr(event.target.id, 'private'));
              }},
              {text: "Arrange Stack", type: 'default', submenu: true, action: function(event){
                VGNIO.ShowContextMenu('CardStack', event, 'arrangement');
              }},
              {text: "Flip Stack", type: 'default', action: function(event){
                FlipStack(event.target.id);
              }},
              {text: "Shuffle", type: 'default', action: function(event){
                var shuffledCards = shuffleArray(VGNIO.GetObjAttr(event.target.id, 'cards'));
                SendRequests([pushUpdateObjectRequest(event.target.id, {arrangement: 'shuffle', cards: shuffledCards})]);
                ArrangeStack(event.target, 'shuffle', shuffledCards, function(){
                  var arrangement = VGNIO.GetObjAttr(event.target.id, 'arrangement');
                  SendRequests([pushUpdateObjectRequest(event.target.id, {arrangement: arrangement})]);
                  ArrangeStack(event.target, arrangement);
                });
              }},
              {text: "Split Stack", type: 'default', action: function(event){
                var stackPos = clientToRoomPosition(event.target.getBoundingClientRect());
                SplitStack(event.target.id, {x: Math.max(0.03, stackPos.x - normalizePosition({x: VGNIO.Card.CardSize.w, y: VGNIO.Card.CardSize.h}).x), y: Math.max(0.03, stackPos.y)});            
              }},
              {text: "Explode!", type: 'default', submenu: true, action: function(event){
                VGNIO.ShowContextMenu('CardStack', event, 'explode');
              }},
              {text: "Deal", type: 'default', submenu: true, action: function(event){
                VGNIO.ShowContextMenu('CardStack', event, 'deal');
                var stackBounds = event.target.getBoundingClientRect();
                ShowGhostCards(stackBounds, 'line', 4);
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
            return VGNIO.Deck.ContextMenuSpecs['default'].deck_section().items();
          }
        }
      }
    },
    arrangement: {
      arrangement_section: function(){
        return {
          attribute: null,
          condition: null,
          name: "Arrange Stack",
          getTarget: function(event){
            return event.target;
          },
          items: function(){
            return [
              {text: "Fan Right", type: 'default', action: function(event){
                VGNIO.SetObjAttr(event.target.id, 'arrangement', 'fanright');
                SendRequests([pushUpdateObjectRequest(event.target.id, {arrangement: 'fanright'})]);
                ArrangeStack(event.target, 'fanright');
              }},
              {text: "Fan Down", type: 'default', action: function(event){
                VGNIO.SetObjAttr(event.target.id, 'arrangement', 'fandown');
                SendRequests([pushUpdateObjectRequest(event.target.id, {arrangement: 'fandown'})]);
                ArrangeStack(event.target, 'fandown');
              }},
              {text: "Fan Out", type: 'default', action: function(event){
                VGNIO.SetObjAttr(event.target.id, 'arrangement', 'fanout');
                SendRequests([pushUpdateObjectRequest(event.target.id, {arrangement: 'fanout'})]);
                ArrangeStack(event.target, 'fanout');
              }},
              {text: "Neatly Stack", type: 'default', action: function(event){
                VGNIO.SetObjAttr(event.target.id, 'arrangement', 'standard');
                SendRequests([pushUpdateObjectRequest(event.target.id, {arrangement: 'standard'})]);
                ArrangeStack(event.target, 'standard');
              }}
            ]
          }
        }
      }
    },
    explode: {
      explode_section: function(){
        return {
          attribute: null,
          condition: null,
          name: "Explode Stack",
          getTarget: function(event){
            return event.target;
          },
          items: function(){
            return [
              {text: null, type: 'form', inputs: [
                {text: "Power: ", type: 'slider', id: 'explode_power', 
                  min: function(){return 10}, 
                  max: function(){return 120}, 
                  step: function(){return 10}, 
                  default: function(){return 50}}]},
              {text: null, type: 'divider'},
              {text: "Explode!", type: 'default', action: function(event){
                ExplodeStack(event.target.id, document.getElementById('explode_power').value/100);
              }}
            ]
          }
        }
      }
    },
    deal: {
      deal_section: function(){
        return {
          attribute: null,
          condition: null,
          name: "Deal Cards",
          getTarget: function(event){
            return event.target;
          },
          items: function(){
            return [
              {text: null, type: 'form', inputs: [
                {text: "# of Cards: ", type: 'slider', id: 'deal_cards',
                  min: function(){return 1}, 
                  max: function(event){return VGNIO.GetObjAttr(event.target.id, 'cards').length}, 
                  step: function(){return 1}, 
                  default: function(event){return Math.min(5, VGNIO.GetObjAttr(event.target.id, 'cards').length)},
                  onchange: function(event){
                    var playerSlider = document.getElementById('deal_players');
                    var newMax = Math.floor(document.getElementById('deal_cards').max/document.getElementById('deal_cards').value);
                    playerSlider.setAttribute('max', newMax);
                    playerSlider.value = Math.min(playerSlider.value, newMax);
                    document.getElementById('deal_players_value').innerText = playerSlider.value;
                    var stackBounds = event.target.getBoundingClientRect();
                    ShowGhostCards(stackBounds, document.querySelector('input[name="'+input.id+'"]:checked').value, document.getElementById('deal_players').value);
                  }},
                {text: "# of Players: ", type: 'slider', id: 'deal_players',
                  min: function(){return 1}, 
                  max: function(){return Math.floor(document.getElementById('deal_cards').max/document.getElementById('deal_cards').value) || 1}, 
                  step: function(){return 1}, 
                  default: function(){return Math.min(4, Math.floor(document.getElementById('deal_cards').max/document.getElementById('deal_cards').value) || 4)},
                  onchange: function(event){
                    var stackBounds = event.target.getBoundingClientRect();
                    ShowGhostCards(stackBounds, document.querySelector('input[name="'+input.id+'"]:checked').value, document.getElementById('deal_players').value);
                  }
                },
                {text: 'Pattern: ', type: 'radio', options: ['line', 'around'], id: 'deal_pattern', onchange: function(event){
                  var stackBounds = event.target.getBoundingClientRect();
                  ShowGhostCards(stackBounds, document.querySelector('input[name="'+input.id+'"]:checked').value, document.getElementById('deal_players').value);
                }}
              ]},
              {text: null, type: 'divider'},
              {text: "Deal Cards", type: 'default', action: function(event){
                ClearDealGhosts();
                var positions = CalculateDealPositions(document.querySelector('input[name="'+input.id+'"]:checked').value, event.target.getBoundingClientRect(), document.getElementById('deal_players').value);
                DealCards(event.target.id, document.getElementById('deal_cards').value, document.getElementById('deal_players').value, positions);
              }}
            ]
          }
        }
      }
    }
  }
};
function SplitStack(stack, pos, index=Math.floor(VGNIO.GetObjAttr(stack, 'cards').length/2)){
  var requests = [];
  var stackObj = document.getElementById(stack);
  var cards = VGNIO.GetObjAttr(stack, 'cards');
  var newCards = cards.slice(index);
  requests = requests.concat(RemoveCards(stack, newCards));

  if(newCards.length >= 2){
    var newStackData = {
      pos: pos,
      cards: newCards,
      arrangement: 'standard'
    };
    requests.push(createObjectRequest('CardStack', newStackData));
  }
  else{
    for(card of newCards){
      MoveObject(document.getElementById(card), pos);
      requests.push(pushUpdateObjectRequest(card, {pos: pos}));
    }
  }
  
  var parentDeck = VGNIO.GetObjAttr(stack, 'parentObj');
  if(cards.length >= 2 && !parentDeck || cards.length >= 1 && parentDeck){
    VGNIO.SetObjAttr(stack, 'cards', cards);
    requests.push(pushUpdateObjectRequest(stack, {cards: cards}));
    ArrangeStack(stackObj, VGNIO.GetObjAttr(stack, 'arrangement'));
  }
  SendRequests(requests);
}

function MergeStacks(target, source, index=VGNIO.GetObjAttr(target, 'cards').length){
  var updates = [];
  var targetObj = document.getElementById(target);
  var targetCards = VGNIO.GetObjAttr(target, 'cards');
  var sourceCards = VGNIO.GetObjAttr(source, 'cards').slice(0);
  updates = updates.concat(RemoveCards(source, sourceCards, false));
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
    updates.push(pushUpdateObjectRequest(targetCards[i], {pos: VGNIO.GetObjAttr(targetCards[i], 'pos'), parentObj: target}));
  }
  VGNIO.SetObjAttr(target, 'cards', targetCards);
  updates.push(pushUpdateObjectRequest(target, {cards: targetCards}));
  SendRequests(updates);
  ArrangeStack(targetObj, VGNIO.GetObjAttr(target, 'arrangement'));
}

function ExplodeStack(stack, magnitude=0.5){
  var requests = [];
  var cards = VGNIO.GetObjAttr(stack, 'cards').slice(0);
  requests = requests.concat(RemoveCards(stack, cards));
  var tl = gsap.timeline();
  tl.pause();
  tl.set({}, {}, '>0.2');
  var normalCardSize = normalizePosition({x: VGNIO.Room.ClientSizeMult*VGNIO.Card.CardSize.w, y: VGNIO.Room.ClientSizeMult*VGNIO.Card.CardSize.h});
  for(card of cards){
    let cardPos = clientToRoomPosition(document.getElementById(card).getBoundingClientRect());
    let randX = Math.min(Math.max(0, cardPos.x + (Math.random()-0.5)*(magnitude)), 1.0 - normalCardSize.x);
    let randY = Math.min(Math.max(0, cardPos.y + (Math.random()-0.5)*(magnitude)), 1.0 - normalCardSize.y);
    VGNIO.GetObjAttr(card, 'pos').x = randX;
    VGNIO.GetObjAttr(card, 'pos').y = randY;
    tl.to(document.getElementById(card), {duration: 1, x: randX * VGNIO.Room.Bounds.w, y: randY * VGNIO.Room.Bounds.h, rotation: 0, ease: 'power4'}, '<');
    requests.push(moveObjectRequest(card, {duration: 1, x: randX, y: randY, rotation: 0, ease: 'power4'}));
  }
  tl.resume();
  SendRequests(requests);
}

function DealCards(stack, numCards, numPlayers, positions){
  var cards = VGNIO.GetObjAttr(stack, 'cards').slice(0);
  var newStacks = [];
  var tl = gsap.timeline({onCompleteParams: [newStacks], onComplete: function(newStacks){
    var requests = [];
    for(newStack of newStacks){
      requests.push(createObjectRequest('CardStack', {
        pos: newStack.pos,
        cards: newStack.cards,
        arrangement: 'standard'
      }));
    }
    SendRequests(requests);
  }});
  tl.pause();
  if(numCards > cards.length || numCards * numPlayers > cards.length){return;}
  for(var card = 0; card < numCards; card++){
    for(var player = 0; player < numPlayers; player++){
      var cardID = cards.pop();
      var cardPos = {x: positions[player].x, y: positions[player].y};
      var normalPos = normalizePosition(cardPos);
      if(numCards > 1){
        if(!newStacks[player]){
          newStacks.push({pos: normalPos, cards: [cardID]});
        }
        else{
          newStacks[player].cards.push(cardID);
        }
      }
      tl.call(RemoveCard, [stack, cardID, true], '<0.1');
      tl.to(document.getElementById(cardID), 
      {overwrite: true, duration: 2, x: cardPos.x, y: cardPos.y, rotation: 360,  ease: 'power4', onStartParams: [stack, cardID, {x: normalPos.x, y: normalPos.y}], onStart: function(stack, card, pos){
        var requests = [];
        requests.push(moveObjectRequest(card, {duration: 2, x: pos.x, y: pos.y, rotation: 360, ease: 'power4'}));
        SendRequests(requests);
      }, onCompleteParams: [cardID], onComplete: function(card){
        gsap.to(document.getElementById(card), {delay: 0.2, duration: 0, rotation: 0});
        SendRequests([moveObjectRequest(card, {delay: 0.2, duration: 0, rotation: 0})]);
      }}, '>0.4');
    }
  }
  tl.set({}, {}, '>0.2');
  tl.resume();

}
function FlipStack(stack){
  var cards = VGNIO.GetObjAttr(stack, 'cards');
  var tl = gsap.timeline();
  tl.pause();
  var duration = .1;
  for(var i = 0; i < cards.length; i++){
      tl.call(SendRequests, [[pushUpdateObjectRequest(cards[i], {faceUp : !VGNIO.GetObjAttr(cards[i], 'faceUp'), cardLabel: {}}, true)]], '<'+duration*0.25);
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

function AddCard(stack, card, index, sendUpdate=false){
  var updates = [];
  var stackObj = document.getElementById(stack);
  var cardObj = document.getElementById(card);
  var cards = VGNIO.GetObjAttr(stack, 'cards');
  cards.splice(index, 0, card);
  stackObj.appendChild(cardObj);
  SnapObject(cardObj, stackObj.cardSlot);
  VGNIO.SetObjAttr(card, 'parentObj', stack);
  VGNIO.SetObjAttr(card, 'private', VGNIO.GetObjAttr(stack, 'private'));
  stackObj.countText.nodeValue = cards.length;
  for(var i = index; i < cards.length; i++){
    ClientObjectCollection[cards[i]].style.zIndex = i;
    VGNIO.GetObjAttr(cards[i], 'pos').z = i;
  }
  updates.push(pushUpdateObjectRequest(card, {parentObj: stack, private: VGNIO.GetObjAttr(stack, 'private')}, true));
  updates.push(pushUpdateObjectRequest(stack, {cards: cards}));
  ArrangeStack(stackObj, VGNIO.GetObjAttr(stack, 'arrangement'));
  if(sendUpdate){
    SendRequests(updates);
  }
  return updates;
};

function RemoveCards(stack, removed, sendUpdate=false){
  var updates = [];
  var stackObj = document.getElementById(stack);
  var cards = VGNIO.GetObjAttr(stack, 'cards');
  for(card of removed){
    var index = cards.indexOf(card);
    if (index !== -1){
      cards.splice(index, 1);
      var cardObj =  document.getElementById(card);
      $('#'+card).show();
      VGNIO.UnparentClientObject(cardObj);
      VGNIO.SetObjAttr(card, 'parentObj', null);
      updates.push(pushUpdateObjectRequest(card, {parentObj: null, private: false}, true));
    }
    else{
      console.log("Tried to remove card from stack that was not in stack");
    } 
  }
  stackObj.countText.nodeValue = cards.length;
  var parentDeck = VGNIO.GetObjAttr(stack, 'parentObj');
  if(cards.length < 2 && !parentDeck || cards.length < 1 && parentDeck){
    for(card of cards){
      $('#'+card).show();
      var cardObj =  document.getElementById(card);
      if(stackObj.contains(cardObj)){
        VGNIO.UnparentClientObject(cardObj);
        VGNIO.SetObjAttr(card, 'parentObj', null);
        updates.push(pushUpdateObjectRequest(card, {parentObj: null}));
      }
    }
    if(parentDeck){
      updates = updates.concat(document.getElementById(parentDeck).removeCardStack());
    }
    updates.push(pushUpdateObjectRequest(stack, {cards: []}));
    updates.push(deleteObjectRequest(stack));
  }
  else{
    updates.push(pushUpdateObjectRequest(stack, {cards: cards}));
    ArrangeStack(stackObj, VGNIO.GetObjAttr(stack, 'arrangement'));
  }
  if(sendUpdate){
    SendRequests(updates);
  }
  return updates;
}

function RemoveCard(stack, card, sendUpdate=false){
  return RemoveCards(stack, [card], sendUpdate);
}

function ShowGhostCards(origin, pattern, count){
  ClearDealGhosts();
  var positions = CalculateDealPositions(pattern, origin, count);
  for(var i = 0; i < count; i++){
    var newGhost = document.createElement('img');
    document.getElementById('room').appendChild(newGhost);
    newGhost.className = 'ghost';
    newGhost.src = '/card/Default/card_back';
    newGhost.style.width = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.w + 'px';
    newGhost.style.height = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.h + 'px';
    gsap.to(newGhost, {duration: 0, x: positions[i].x, y: positions[i].y});
  }
}

function CalculateDealPositions(pattern, origin, count){
  var positions = [];
  for(var i = 0; i < count; i++){
    if(pattern == 'line'){
      var d_center = i - Math.floor(count/2);
      positions.push({x: origin.x + d_center*VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.w - VGNIO.Room.Bounds.x, y: origin.y - 1.5*VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.h - VGNIO.Room.Bounds.y});
    }
    else if (pattern == 'around'){
      var r = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.h * 2;
      var dx = Math.sin(i*2*Math.PI/count);
      var dy = Math.cos(i*2*Math.PI/count);
      positions.push({x: origin.x + r*dx - VGNIO.Room.Bounds.x, y: origin.y - r*dy - VGNIO.Room.Bounds.y});
    }
  }
  return positions;
}

function ClearDealGhosts(){
  var ghosts = document.getElementsByClassName('ghost');
  for(var i = ghosts.length; i > 0; i--){
    ghosts[i-1].remove();
  }
}
function MakePrivate(stack, private){
  var requests = [];
  for(card of VGNIO.GetObjAttr(stack, 'cards')){
    requests.push(pushUpdateObjectRequest(card, {private : private}, true));
  }
  requests.push(pushUpdateObjectRequest(stack, {private : private}, true));
  SendRequests(requests);
}