const { nanoid } = require('nanoid'),
  fs = require('fs'),
  ObjectStore = require('./ObjectStore');
const ObjectCollection = {};
const ProcessingObjects = {};

exports.ObjectCollection = ObjectCollection;
exports.ProcessingObjects = ProcessingObjects;

exports.CreateObject = CreateObject;

const hostname = process.env.HOSTNAME || 'virtualgamenight.io';
const port = process.env.PORT || 8080;

const StandardDeckBuild = {'Spades_2': 1, 'Spades_3': 1, 'Spades_4': 1, 'Spades_5': 1, 'Spades_6': 1, 'Spades_7': 1, 'Spades_8': 1, 'Spades_9': 1, 'Spades_10': 1, 'Spades_J': 1, 'Spades_Q': 1, 'Spades_K': 1, 'Spades_A': 1,
'Hearts_2': 1, 'Hearts_3': 1, 'Hearts_4': 1, 'Hearts_5': 1, 'Hearts_6': 1, 'Hearts_7': 1, 'Hearts_8': 1, 'Hearts_9': 1, 'Hearts_10': 1, 'Hearts_J': 1, 'Hearts_Q': 1, 'Hearts_K': 1, 'Hearts_A': 1, 
'Diamonds_2': 1, 'Diamonds_3': 1, 'Diamonds_4': 1, 'Diamonds_5': 1, 'Diamonds_6': 1, 'Diamonds_7': 1, 'Diamonds_8': 1, 'Diamonds_9': 1, 'Diamonds_10': 1, 'Diamonds_J': 1, 'Diamonds_Q': 1, 'Diamonds_K': 1, 'Diamonds_A': 1, 
'Clubs_2': 1, 'Clubs_3': 1, 'Clubs_4': 1, 'Clubs_5': 1, 'Clubs_6': 1, 'Clubs_7': 1, 'Clubs_8': 1, 'Clubs_9': 1, 'Clubs_10': 1, 'Clubs_J': 1, 'Clubs_Q': 1, 'Clubs_K': 1, 'Clubs_A': 1, 'joker_red': 0, 'joker_black': 0};

module.exports.ClientTrust = {
  movable: false,
  pos : true,
  locked : true,
  owner : false,
  user : false,
  lastUser : false,
  moving : true,
  releaseUser: false,
  cardLabel: false,
  faceUp: true,
  parentManager: true,
  parentObj: true,
  managedCards: false,
  managedDecks: false,
  styleName: false,
  cards: true,
  arrangement: true,
  cardStack: true,
  deckBuild: true
};

module.exports.NoSave = {
  Card: {lastUser: true, cardLabel: true},
  CardStack: {lastUser: true},
  Deck: {lastUser: true}
}

const ObjectTypes = {
  Card: function(roomid, uid, objectData, completedAction){
    var obj = {roomid: roomid, uid: uid, objType: 'Card', objData: {}};
    Object.assign(obj.objData, MovableInterface());
    Object.assign(obj.objData, {
      cardLabel:  '',
      styleName: 'Default',
      faceUp:  false,
      parentManager:  null,
      parentObj:  null
    });
    AssignObjData(obj.objData, objectData);
    completedAction(obj);
  },
  CardStack: function(roomid, uid, objectData, completedAction){
    var obj = {roomid: roomid, uid: uid, objType: 'CardStack', objData: {}};
    Object.assign(obj.objData, MovableInterface());
    Object.assign(obj.objData, {
      cards: [],
      parentObj: null,
      arrangement: 'standard'
    });
    AssignObjData(obj.objData, objectData);
    completedAction(obj);
  },
  Deck: function(roomid, uid, objectData, completedAction){
    var obj = {roomid: roomid, uid: uid, objType: 'Deck', objData: {}};
    Object.assign(obj.objData, MovableInterface());
    Object.assign(obj.objData, {
      //Actual cards owned by the deck
      cards: [],
      //Stack of cards used by the deck (other cards can be placed here, and this can be null if no cards are on the deck spot)
      cardStack: null,
      //Card labels that are in the deck and the amount of each card that is in the deck
      deckBuild: StandardDeckBuild,
      parentManager: null
    });
    //console.log(obj.objData, obj.cards, obj.deckBuild);
    AssignObjData(obj.objData, objectData);
    completedAction(obj);
  }
}
const InitializeObject = {
  Card: function(obj, completedAction){completedAction([obj]);},
  CardStack: function(obj, completedAction){
    var cards = obj.objData.cards;
    for(card of cards){
      ObjectStore.SetObjectProperties(obj.roomid, card, {'objData.pos.x': 0, 'objData.pos.y': 0, 'objData.parentObj': obj.uid});
    }
    completedAction([obj]);
  },
  Deck: function(obj, completedAction){
    var objects = [];
    var deckBuild = obj.objData.deckBuild;
    var cards = obj.objData.cards;
    var labels = [];
    for(label in deckBuild){
      for(var i = 0; i < deckBuild[label]; i++){
        cards.push(nanoid(4));
        labels.push(label);
      }
    }
    var createdCards = 0;
    function onCreateCard(newObjArr){
      /*if(newObj.uid in ProcessingObjects){
        delete ProcessingObjects[newObj.uid];
      }*/
      //ObjectStore.AddObject(obj.roomid, newObj);
      objects = objects.concat(newObjArr);
      createdCards++;
      if(createdCards < cards.length){
        CreateObject(obj.roomid, cards[createdCards], 'Card', {pos: obj.objData.pos, cardLabel: labels[createdCards], parentObj: obj.objData.cardStack}, onCreateCard);
      }
      else{
        CreateObject(obj.roomid, obj.objData.cardStack, 'CardStack', {pos: obj.objData.pos, cards: cards, parentObj: obj.uid}, function(cardStackObjArr){
          /*if(cardStackObj.uid in ProcessingObjects){
            delete ProcessingObjects[cardStackObj.uid];
          }*/
          //ObjectStore.AddObject(obj.roomid, cardStackObj);
          objects = objects.concat(cardStackObjArr);
          objects.push(obj);
          //console.log('objs: ', objects);
          completedAction(objects);
        });
      }
    };
    obj.objData.cardStack = nanoid(4);
    console.log(cards, labels);
    CreateObject(obj.roomid, cards[0], 'Card', {pos: obj.objData.pos, cardLabel: labels[0], parentObj: obj.objData.cardStack}, onCreateCard);
  }
}

function AssignObjData(target, source){
  for(attribute in source){
    if(source[attribute] && typeof source[attribute] == 'object'){
      //console.log(attribute);
      Object.assign(target[attribute], source[attribute]);
    }
    else{
      target[attribute] = source[attribute];
    }
  }
}

function MovableInterface(){
  return {
    movable: true,
    pos: {x: 0, y: 0},
    locked: false,
    owner: null,
    user: null,
    lastUser: null,
    moving: false
  }
}


function CreateObject(roomid, uid, objectType, objectData, completedAction){
  try{
    ObjectTypes[objectType](roomid, uid, objectData, function(newObj){
      ObjectStore.AddObject(roomid, newObj, function(){
        InitializeObject[objectType](newObj, completedAction);
      });
    });
  }
  catch(err){
    console.log('Failed to create object: ' + objectType, err);
  }
}
