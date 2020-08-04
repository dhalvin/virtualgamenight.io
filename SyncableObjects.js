const fs = require('fs');
const ObjectCollection = {};
const ProcessingObjects = {};
exports.ObjectCollection = ObjectCollection;
exports.ProcessingObjects = ProcessingObjects;
exports.getUniqueObjID = getUniqueObjID;
exports.CreateObject = CreateObject;
const hostname = '192.168.33.202';
const port = 8080;
const StandardDeckBuild = {'Spades_2': 1, 'Spades_3': 1, 'Spades_4': 1, 'Spades_5': 1, 'Spades_6': 1, 'Spades_7': 1, 'Spades_8': 1, 'Spades_9': 1, 'Spades_10': 1, 'Spades_J': 1, 'Spades_Q': 1, 'Spades_K': 1, 'Spades_A': 1,
'Hearts_2': 1, 'Hearts_3': 1, 'Hearts_4': 1, 'Hearts_5': 1, 'Hearts_6': 1, 'Hearts_7': 1, 'Hearts_8': 1, 'Hearts_9': 1, 'Hearts_10': 1, 'Hearts_J': 1, 'Hearts_Q': 1, 'Hearts_K': 1, 'Hearts_A': 1, 
'Diamonds_2': 1, 'Diamonds_3': 1, 'Diamonds_4': 1, 'Diamonds_5': 1, 'Diamonds_6': 1, 'Diamonds_7': 1, 'Diamonds_8': 1, 'Diamonds_9': 1, 'Diamonds_10': 1, 'Diamonds_J': 1, 'Diamonds_Q': 1, 'Diamonds_K': 1, 'Diamonds_A': 1, 
'Clubs_2': 1, 'Clubs_3': 1, 'Clubs_4': 1, 'Clubs_5': 1, 'Clubs_6': 1, 'Clubs_7': 1, 'Clubs_8': 1, 'Clubs_9': 1, 'Clubs_10': 1, 'Clubs_J': 1, 'Clubs_Q': 1, 'Clubs_K': 1, 'Clubs_A': 1, 'joker_red': 0, 'joker_black': 0};
const ObjectTypes = {
  Card: function(uid, objectData, completedAction){
    var obj = {uid: uid, objType: 'Card', objData: {}};
    obj.get = function(attribute){return obj.objData[attribute].value};
    obj.set = function(attribute, value){obj.objData[attribute].value = value};
    Object.assign(obj.objData, MovableInterface());
    Object.assign(obj.objData, {
      cardLabel: {value: '', clientSave: false, clientTrust: false},
      faceUp: {value: false, clientSave: true, clientTrust: true},
      parentManager: {value: null, clientSave: true, clientTrust: true},
      parentObj: {value: null, clientSave: true, clientTrust: true}
    });
    AssignObjData(obj.objData, objectData);
    ObjectCollection[obj.get('parentManager')].get('cards').push(uid);
    return InitializeObject['Card'](obj, completedAction);
  },
  CardManager: function(uid, objectData, completedAction){
    var obj = {uid: uid, objType: 'CardManager', objData: {}};
    obj.get = function(attribute){return obj.objData[attribute].value};
    obj.set = function(attribute, value){obj.objData[attribute].value = value};
    Object.assign(obj.objData, {
      cards: {value: [], clientSave: true, clientTrust: false},
      decks: {value: [], clientSave: true, clientTrust: false},
      styleName: {value: "Default", clientSave: true, clientTrust: false},
      cardPaths: {value: {destination: '', labels: [], fileType: ''}, clientSave: true, clientTrust: false}
    });
    AssignObjData(obj.objData, objectData);
    return InitializeObject['CardManager'](obj, completedAction);
  },
  CardStack: function(uid, objectData, completedAction){
    var obj = {uid: uid, objType: 'CardStack', objData: {}};
    obj.get = function(attribute){return obj.objData[attribute].value};
    obj.set = function(attribute, value){obj.objData[attribute].value = value};
    Object.assign(obj.objData, MovableInterface());
    Object.assign(obj.objData, {
      cards: {value: [], clientSave: true, clientTrust: true},
      parentObj: {value: null, clientSave: true, clientTrust: true},
      arrangement: {value: 'standard', clientSave: true, clientTrust: true}
    });
    AssignObjData(obj.objData, objectData);
    return InitializeObject['CardStack'](obj, completedAction);
  },
  Deck: function(uid, objectData, completedAction){
    var obj = {uid: uid, objType: 'Deck', objData: {}};
    obj.get = function(attribute){return obj.objData[attribute].value};
    obj.set = function(attribute, value){obj.objData[attribute].value = value};
    Object.assign(obj.objData, MovableInterface());
    Object.assign(obj.objData, {
      //Actual cards owned by the deck
      cards: {value: [], clientSave: true, clientTrust: true},
      //Stack of cards used by the deck (other cards can be placed here, and this can be null if no cards are on the deck spot)
      cardStack: {value: null, clientSave: true, clientTrust: true},
      //Card labels that are in the deck and the amount of each card that is in the deck
      deckBuild: {value: StandardDeckBuild, clientSave: true, clientTrust: true},
      parentManager: {value: null, clientSave: true, clientTrust: true}
    });
    AssignObjData(obj.objData, objectData);
    //obj.set('locked', true);
    ObjectCollection[obj.get('parentManager')].get('decks').push(uid);
    return InitializeObject['Deck'](obj, completedAction);
  }
}
const InitializeObject = {
  Card: function(obj, completedAction){return completedAction(obj);},
  CardManager: function(obj, completedAction){
    var styleName = obj.get('styleName');
    fs.readdir(__dirname + '/public/PlayingCards/'+styleName +'/', function(err, items){
      obj.get('cardPaths').destination = 'http://' + hostname + ':' + port +'/PlayingCards/' + styleName + '/';
      obj.get('cardPaths').fileType = '.svg';
      for (var i=0; i<items.length; i++){
        obj.get('cardPaths').labels.push(items[i].substring(0,items[i].indexOf('.')));
      }
      //obj.get('cardPaths').labels.unshift('card_back');
      completedAction(obj);
    });
  },
  CardStack: function(obj, completedAction){
    var cards = obj.get('cards');
    for(card of cards){
      if(card in ObjectCollection){
        ObjectCollection[card].get('pos').x = 0;
        ObjectCollection[card].get('pos').y = 0;
        ObjectCollection[card].set('parentObj', obj.uid);
        //ObjectCollection[card].set('locked', true);
      }
    }
    completedAction(obj);
  },
  Deck: function(obj, completedAction){
    var deckBuild = obj.get('deckBuild');
    var cards = obj.get('cards');
    var labels = [];
    for(label in deckBuild){
      for(var i = 0; i < deckBuild[label]; i++){
        cards.push(getUniqueObjID());
        labels.push(label);
      }
    }
    var createdCards = 0;
    function onCreateCard(newObj){
      if(newObj.uid in ProcessingObjects){
        delete ProcessingObjects[newObj.uid];
      }
      ObjectCollection[newObj.uid] = newObj;
      createdCards++;
      if(createdCards < cards.length){
        CreateObject(cards[createdCards], 'Card', {pos: {value: obj.get('pos')}, cardLabel: {value: labels[createdCards]}, parentManager: {value: obj.get('parentManager')}, parentObj: {value: obj.get('cardStack')}}, onCreateCard);
      }
      else{
        CreateObject(obj.get('cardStack'), 'CardStack', {pos: {value: obj.get('pos')}, cards: {value: cards}, parentObj: {value: obj.uid}}, function(cardStackObj){
          if(cardStackObj.uid in ProcessingObjects){
            delete ProcessingObjects[cardStackObj.uid];
          }
          ObjectCollection[cardStackObj.uid] = cardStackObj;
          completedAction(obj);
        });
      }
    };
    obj.set('cardStack', getUniqueObjID());
    CreateObject(cards[0], 'Card', {pos: {value: obj.get('pos')}, cardLabel: {value: labels[0]}, parentManager: {value: obj.get('parentManager')}, parentObj: {value: obj.get('cardStack')}}, onCreateCard);
  }
}

function AssignObjData(target, source){
  for(attribute in source){
    if(typeof source[attribute].value == 'object'){
      Object.assign(target[attribute].value, source[attribute].value);
    }
    else{
      target[attribute].value = source[attribute].value;
    }
  }
}

function MovableInterface(){
  return {
    movable: {value: true, clientSave: true, clientTrust: false},
    pos : {value: {x: 0, y: 0}, clientSave: true, clientTrust: true},
    locked : {value: false, clientSave: true, clientTrust: true},
    owner : {value: null, clientSave: true, clientTrust: false},
    user : {value: null, clientSave: true, clientTrust: false},
    lastUser : {value: null, clientSave: true, clientTrust: false},
    moving : {value: false, clientSave: true, clientTrust: true}
  }
}

function getUniqueObjID() {
  var uid = Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  while(uid in ObjectCollection){
    uid = Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  ProcessingObjects[uid] = true;
  return uid;
}

function CreateObject(uid, objectType, objectData, completedAction){
  try{
    ObjectTypes[objectType](uid, objectData, completedAction);
  }
  catch(err){
    console.log('Failed to create object: ' + objectType, err);
  }
}

