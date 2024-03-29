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
  RoomManager = require('./RoomManager'),
  logger = require('./logger'),
  app = module.exports = express();

redcli.on("error", function(error){
  logger.error(error);
});
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
    store: new redisStore({client: redcli, ttl: 2592000}),
    cookie: {sameSite: true}
  }));

  app.engine('hbs', handlebars({extname: '.hbs', defaultLayout: 'layout', layoutsDir: __dirname + '/views/layouts'}));
  app.set('view engine', 'hbs');
  app.set('views', __dirname + "/views");
  app.use(express.static('public'));

  app.get('/', function(req, res){
    if('errors' in req.session){
      res.render('index', {title: 'Virtual Game Night', styles: ['stylesheets/index.css'], errors: JSON.parse(req.session.errors)});
      delete req.session.errors;
    }
    else{
      res.render('index', {title: 'Virtual Game Night', styles: ['stylesheets/index.css'], quip: 'Together but not!'});
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
    validator.check('roomid').trim().isLength({min:1}).withMessage('Cannot be empty...').matches('^[A-Za-z0-9_-]{5}$').withMessage('Invalid Room Code')
  ], function(req, res){
    //Render the page with any errors that exist
    if('errors' in req.session){
      res.render('join', {title: 'Virtual Game Night: Joining...', styles: ['stylesheets/index.css'], errors: JSON.parse(req.session.errors)});
      delete req.session.errors;
    }
    else {
      if(req.body.action == 'Create'){
          var newRoomID = nanoid(5);
          //If our new room id collides with an existing one, try again
          RoomManager.CreateRoom(newRoomID, function(result){
            if(result && result === 'OK'){
              res.render('join', {title: 'Virtual Game Night: Creating...', styles: ['stylesheets/index.css'], roomid: newRoomID});
            }
            else{
              res.redirect(307, '/join');
            }
          });
      }
      else if(req.body.action == 'Join'){
        const errors = validator.validationResult(req);
        if(!errors.isEmpty()){
          req.session.errors = JSON.stringify(errors.array());
          res.redirect('/');
        }
        else{
          //If room code does not exist, redirect back to index storing error in session
          RoomManager.RoomExists(req.body.roomid, function(exists){
            if(!exists){
              req.session.errors = '[{"msg": "Room code not found..."}]';
              res.redirect('/');
            }
            else{
              res.render('join', {title: 'Virtual Game Night: Joining...', styles: ['stylesheets/index.css'], roomid: req.body.roomid});
            }
          });
        }
      }
    }
  });
  app.get('/about', function(req, res){
    res.render('about', {title: 'About Virtual Game Night', styles: ['stylesheets/index.css']});
  });
  app.get('/:id([A-Za-z0-9_-]{5})', function(req,res){
    if(req.session.roomid && req.session.roomid === req.params.id){
      res.render('app', {title: 'Virtual Game Night: '+req.session.roomid, styles: ['stylesheets/app.css', 'stylesheets/noselect.css'], displayName: req.body.displayName, roomid: req.body.roomid, serverAddress: req.get('host'), userid: req.session.userid, sidebar: true});
    }
    else{
      res.render('join', {title: 'Virtual Game Night: Joining...', styles: ['stylesheets/index.css'], roomid: req.params.id});
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
    validator.check('roomid').trim().isLength({min:1}).withMessage('Room Code Cannot be empty...').matches('^[A-Za-z0-9_-]{5}$').withMessage('Invalid Room Code'),
    validator.check('displayName').trim().escape().isLength({min:1}).withMessage('Display Name Cannot be empty...')
  ], function(req, res){
    const errors = validator.validationResult(req);
    if(!errors.isEmpty()){
      req.session.errors = JSON.stringify(errors.array());
      res.redirect('/join');
    }
    else {
      RoomManager.RoomExists(req.body.roomid, function(exists){
        if(!exists){
          req.session.errors = '[{"msg": "Room code not found..."}]';
          res.redirect('/');
        }
        else{
          var roomid = req.body.roomid;
          req.session.roomid = roomid;
          req.session.displayName = req.body.displayName;
          if(!req.session.registered && !req.session.userid){
            req.session.userid = nanoid(6);
          }
          res.redirect('/'+roomid);
        }
      });
    }
  });

  app.get('/card/:style([A-Za-z0-9_-]+)/:label([A-Za-z0-9_-]+)' ,function(req, res){
      res.type('svg');
      res.sendFile( __dirname + '/public/PlayingCards/'+req.params.style+'/'+req.params.label+'.svg');
  });

  if (!module.parent) {
    logger.info('Running express without cluster.');
    app.listen(process.env.PORT || 5000);
  }
}