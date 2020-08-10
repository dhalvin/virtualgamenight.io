/**
 * Module dependencies.
 */

const express = require('express'),
  handlebars = require('express-handlebars'),
  session = require('express-session'),
  bodyParser = require('body-parser'),
  methodOverride = require('method-override'),
  cookie = require('cookie'),
  fs = require('fs'),
  redis = require('redis'),
  redisClient = redis.createClient(process.env.REDIS_URI || 'redis://localhost:6379'),
  redisStore = require('connect-redis')(session);
  nanoid = require('nanoid'),
  filename = '/var/nodelist',
  app = module.exports = express(),
  SECRET = 'BOYOYOUBETTERCHANGETHISLATER';

function setup() {
  app.use(bodyParser.raw());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json())
  app.use(methodOverride());
  app.use(session({
    secret: SECRET,
    resave: false,
    saveUninitialized: false,
    store: new redisStore({'client': redisClient}),
    cookie: {sameSite: true}
  }));

  app.engine('hbs', handlebars({extname: '.hbs', defaultLayout: 'layout', layoutsDir: __dirname + '/views/layouts'}));
  app.set('view engine', 'hbs');
  app.set('views', __dirname + "/views");
  app.use(express.static('public'));

  app.get('/', function(req, res){
    res.render('index', {title: 'Hangout Online', quip: 'Together but not!'});
  });

  app.get('/join', function(req, res){
    //If we are already in the room, don't join again
    if('roomID' in req.session){
      res.redirect('/app');
    }
    //Without a room in session, this should only be a post request
    else{
      res.redirect('/');
    }
  });

  app.post('/join', function(req, res){
    //If room code does not exist, redirect back to index storing error in session
    //TODO
    //If we are already in the room, don't join again
    if('roomID' in req.session){
        res.redirect('/app');
      }
    //Render the page with any errors that exist
    else{
      if('error' in req.session){
        res.render('join', {title: 'Virtual Game Night: Joining...', error: req.session.error});
        delete req.session.error;
      }
      else{
        if(req.body.action == 'Create'){
            var newRoomID = '12345';
            res.render('join', {title: 'Virtual Game Night: Creating...', roomid: newRoomID});
        }
        else if(req.body.action == 'Join'){
            res.render('join', {title: 'Virtual Game Night: Joining...', roomid: req.body.roomid});
        }
      }
    }
  });
  
  app.get('/:id([A-Za-z0-9_-]{5})', function(req,res){
    res.render('join', {title: 'Virtual Game Night: Joining...', roomid: req.params.id});
  });

  app.get('/app', function(req, res){
    //If there is a roomID in session, let WS connect
    if('roomID' in req.session){
      res.render('app_temp', {title: 'Virtual Game Night', displayName: '???', roomid: req.session.roomID});
    }
    //Else need to select room
    else{
      res.redirect('/');
    }
  });

  app.post('/app', function(req, res){
    res.render('app_temp', {title: 'Virtual Game Night', displayName: req.body.displayName, roomid: req.body.roomid, serverAddress: req.get('host')});
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