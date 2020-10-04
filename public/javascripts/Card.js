var VGNIO = VGNIO || {};
//VGNIO.ClientObjects = VGNIO.ClientObjects || new function(){};
VGNIO.Card = new function(){
  this.CardSize = {w: 120, h: 180};
  this.create = function(obj, startData){
    obj = VGNIO.Movable.create(obj);
    obj.hoverTween = null;
    obj.cardImg = document.createElement('img');
    obj.cardImg.setAttribute('width', VGNIO.Card.CardSize.w);
    obj.cardImg.setAttribute('height', VGNIO.Card.CardSize.h);
    obj.appendChild(obj.cardImg);
    obj.style.visibility = 'visible';
    obj.cardImg.style.visibility = 'visible';
    obj.resize = function(){
      //var sizeM = VGNIO.Room.Bounds.w/VGNIO.Room.TargetRoomSize.w;
      obj.cardImg.style.width = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.w + 'px';
      obj.cardImg.style.height = VGNIO.Room.ClientSizeMult * VGNIO.Card.CardSize.h + 'px';
    };
    obj.updateFunctions.push(function(updateData){
      if('faceUp' in updateData){
        var tl = gsap.timeline();
        tl.pause();
        var duration = 0.1;
        tl.to(obj, {duration: duration, scale: 1.1,  repeat: 1, yoyo: true, ease: 'none', yoyoEase: 'power3'});
        tl.add(function(){
          if(updateData.faceUp){
            obj.cardImg.src = '/card/'+VGNIO.GetObjAttr(obj.uid, 'styleName') + '/' + updateData.cardLabel;
          }
          else{
            obj.cardImg.src = '/card/'+VGNIO.GetObjAttr(obj.uid, 'styleName') + '/card_back';
          }
        }, '<'+duration);
        tl.resume();
      }
    });
    obj.addEventListener('mouseenter', function(event){
      if(event.buttons === 0){
        var parentStack = ClientObjectCollection[VGNIO.GetObjAttr(obj.uid, 'parentObj')];
        if(parentStack){
          var arrangement = VGNIO.GetObjAttr(parentStack.uid, 'arrangement');
          if(arrangement === 'fanright' || arrangement === 'fandown' || arrangement === 'fanout' || arrangement === "standard"){
            if(!event.currentTarget.hoverTween){
              event.currentTarget.hoverTween = gsap.to(event.currentTarget, {duration: 0.1, y: '-='+VGNIO.Room.ClientSizeMult*AnimationUnit, onReverseComplete: function(){
                this.kill();
                this._targets[0].hoverTween = null;
              }});
            }
          }
        }
      }
    });
    obj.addEventListener('mouseleave', function(event){
      if(event.currentTarget.hoverTween){
        if(event.currentTarget.hoverTween.progress() === 0){
          event.currentTarget.hoverTween.kill();
          event.currentTarget.hoverTween = null;
        }else{
          event.currentTarget.hoverTween.reverse();
        }
      }
    });
    try{
      if(startData.faceUp){
        obj.cardImg.src = '/card/'+VGNIO.GetObjAttr(obj.uid, 'styleName') + '/' + startData.cardLabel;
      }
      else{
        obj.cardImg.src = '/card/'+VGNIO.GetObjAttr(obj.uid, 'styleName') + '/card_back';
      }
    }
    catch(err){console.log(err);}
    return obj;
  };

  this.OnClick = function(event){
    pushUpdateObjectRequest(event.target.id, {faceUp : !VGNIO.GetObjAttr(event.target.id, 'faceUp'), cardLabel: {}}, true);
  }
  
  this.OnRightClick = function(event){
    VGNIO.ShowContextMenu('Card', event);
  }

  this.isSnappableTarget = function(uid, sourceUid){
    if(VGNIO.GetObjType(uid) == 'Card'){
      return $("#"+uid).is(":visible");
    }
    else if(VGNIO.GetObjType(uid) == 'Deck'){
      return VGNIO.GetObjAttr(uid, 'cardStack') === null;
    }
    return false;
  }
  this.OnDragStart = function(event){
    //Remove from parent stack
    var parentStack = ClientObjectCollection[VGNIO.GetObjAttr(event.target.id, 'parentObj')];
    if(parentStack){// && !VGNIO.GetObjAttr(parentStack.uid, 'moving')){
      if(event.target.hoverTween){
        event.target.hoverTween.kill();
        event.target.hoverTween = null;
      }
      parentStack.removeCard(event.target.id);
      //event.update();
    }
  }

  this.OnDrag = function(event){}

  this.OnDragEnd = function(event){
    if(event.snappedObj !== null){
      var snappedType = VGNIO.GetObjType(event.snappedObj.id);
      if(snappedType == 'Card'){
        var parentStack = VGNIO.GetObjAttr(event.snappedObj.id, 'parentObj');
        if(parentStack){
          document.getElementById(parentStack).addCard(event.target.id, event.snappedObj.z);
        }
        else{
          SnapObject(event.target, document.getElementById(event.snappedObj.id));
          var newStackData = {
            pos: ObjectCollection[event.target.id].objData.pos,
            cards: [event.snappedObj.id, event.target.id]
          };
          createObjectRequest('CardStack', newStackData);
        }
      }
      //The snapped deck should always be empty, otherwise it would snap to a card
      else if(snappedType == 'Deck'){
        SnapObject(event.target, document.getElementById(event.snappedObj.id));
        var newStackData = {
          pos: VGNIO.GetObjAttr(event.target.id, 'pos'),
          cards: [event.target.id],
          parentObj: event.snappedObj.id
        };
        createObjectRequest('CardStack', newStackData);
      }

    }
    event.snappedObj = null;
    event.SnapLocations = [];
  }

  this.ContextMenuSpecs = {
    card_section: function(){
      return {
        attribute: null,
        condition: null,
        name: "Card",
        getTarget: function(event){
          return event.target;
        },
        items: function(){
          return [
            {text: "Flip Card", action: function(event){
              pushUpdateObjectRequest(event.target.id, {faceUp : !VGNIO.GetObjAttr(event.target.id, 'faceUp'), cardLabel: {}}, true);
            }}
          ]
        }
      }
    },
    cardstack_section: function(){
      return {
        attribute: 'parentObj',
        condition: true,
        name: "Cardstack",
        getTarget: function(event){
          return document.getElementById(VGNIO.GetObjAttr(event.target.id, 'parentObj'));
        },
        items: function(){
          return VGNIO.CardStack.ContextMenuSpecs.cardstack_section().items();
        }
      }

    }
  }
};