/**
 * Module dependencies.
 */

const express = require('express'),
  handlebars = require('express-handlebars'),
  session = require('express-session'),
  bodyParser = require('body-parser'),
  methodOverride = require('method-override'),
  fs = require('fs'),
  redis = require('redis'),
  redcli = redis.createClient(process.env.REDIS_URI || 'redis://localhost:6379'),
  redisStore = require('connect-redis')(session),
  { nanoid } = require('nanoid'),
  validator = require('express-validator'),
  common = require('./common'),
  app = module.exports = express();
setup();

function setup() {
  app.use(bodyParser.raw());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json())
  app.use(methodOverride());
  app.use(session({
    secret: common.SECRET,
    resave: false,
    saveUninitialized: false,
    store: new redisStore({'client': redcli}),
    cookie: {sameSite: true}
  }));

  app.engine('hbs', handlebars({extname: '.hbs', defaultLayout: 'layout', layoutsDir: __dirname + '/views/layouts'}));
  app.set('view engine', 'hbs');
  app.set('views', __dirname + "/views");
  app.use(express.static('public'));

  app.get('/', function(req, res){
    if('errors' in req.session){
      res.render('index', {title: 'Virtual Game Night', errors: JSON.parse(req.session.errors)});
      delete req.session.errors;
    }
    else{
      res.render('index', {title: 'Virtual Game Night', quip: 'Together but not!'});
    }
  });

  app.get('/join', function(req, res){
    //If we are already in the room, don't join again
    if('roomid' in req.session){
      res.redirect('/app');
    }
    //Without a room in session, this should only be a post request
    else{
      res.redirect('/');
    }
  });

  app.post('/join', [
    validator.check('roomid').trim().isLength({min:1}).withMessage('Cannot be empty...').bail().matches('[A-Za-z0-9_-]{5}').withMessage('Invalid Room Code')
  ], function(req, res){
    //Render the page with any errors that exist
    if('errors' in req.session){
      res.render('join', {title: 'Virtual Game Night: Joining...', errors: JSON.parse(req.session.errors)});
      delete req.session.errors;
    }
    else {
      if(req.body.action == 'Create'){
          var newRoomID = nanoid(5);
          //If our new room id collides with an existing one, try again
          redcli.get('room'+newRoomID, function(err, reply){
            if(!reply){
              redcli.set('room'+newRoomID, new Date().getTime());
              res.render('join', {title: 'Virtual Game Night: Creating...', roomid: newRoomID});
            }
            else{
              res.redirect(307, '/join')
            }
          });
      }
      else if(req.body.action == 'Join'){
        const errors = validator.validationResult(req);
        if(!errors.isEmpty()){
          req.session.errors = JSON.stringify(errors.array());
          res.redirect('/');
        }
        //If room code does not exist, redirect back to index storing error in session
        redcli.get('room'+newRoomID, function(err, reply){
          if(!reply){
            req.session.errors = '[{"msg": "Room code not found..."}]';
            res.redirect('/');
          }
          else{
            res.render('join', {title: 'Virtual Game Night: Joining...', roomid: req.body.roomid});
          }
        });
      }
    }
  });
  
  app.get('/:id([A-Za-z0-9_-]{5})', function(req,res){
    if(req.session.roomid && req.session.roomid === req.params.id){
      res.render('app_temp', {title: 'Virtual Game Night', displayName: req.body.displayName, roomid: req.body.roomid, serverAddress: req.get('host')});
    }
    else{
      res.render('join', {title: 'Virtual Game Night: Joining...', roomid: req.params.id});
    }
  });

  app.get('/app', function(req, res){
    //If there is a roomID in session, let WS connect
    if('roomid' in req.session){
      res.redirect('/'+req.session.roomid);
    }
    //Else need to select room
    else{
      res.redirect('/');
    }
  });

  app.post('/app', [
    validator.check('roomid').trim().isLength({min:1}).withMessage('Room Code Cannot be empty...').bail().matches('[A-Za-z0-9_-]{5}').withMessage('Invalid Room Code'),
    validator.check('displayName').trim().escape().isLength({min:1}).withMessage('Display Name Cannot be empty...')
  ], function(req, res){
    const errors = validator.validationResult(req);
    if(!errors.isEmpty()){
      req.session.errors = JSON.stringify(errors.array());
      res.redirect('/join');
    }
    else {
      redcli.get('room'+req.body.roomid, function(err, reply){
        if(reply){
          var roomid = req.body.roomid;
          req.session.roomid = roomid;
          req.session.displayName = req.body.displayName;
          res.redirect('/'+roomid);
        }
        else{
          req.session.errors = '[{"msg": "Room code not found..."}]';
          res.redirect('/');
        }
      });
    }
    //TODO Sanitize data...
    //Person is in room with name
    /*if(UserList.includes(req.body.displayName)){
      req.session.error = 'Someone is already using that name in this room!';
      res.redirect('/');
    }
    //Person is returning to room by name
    else if(req.body.displayName in usersByName){
      var oldSID = usersByName[req.body.displayName].sid;
      users[req.session.id] = users[oldSID];
      delete users[oldSID];
      req.session.userID = users[req.session.id].id;
      res.redirect('/app');
    }
    //New name provided
    else{
      var id = wsServer.getUniqueID();
      req.session.userID = id;
      users[req.session.id] = {id: id, sid: req.session.id, displayName: req.body.displayName, playerColor: req.body.playerColor};
      usersByName[req.body.displayName] = users[req.session.id];
      res.redirect('/app');
    }*/
  });

  if (!module.parent) {
    console.log('Running express without cluster.');
    app.listen(process.env.PORT || 5000);
  }
}