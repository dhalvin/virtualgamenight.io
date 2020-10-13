var cluster = require('cluster'),
  app = require('./express-app'),
  ws = require('./ws-app'),
  logger = require('./logger');

var workers = {},
  websockets = {},
  count = process.env.CORES || require('os').cpus().length;

function spawn(){
  var worker = cluster.fork();
  workers[worker.process.pid] = worker;
  logger.info('Spawning worker with id ' + worker.process.pid);
  return worker;
}

if (cluster.isMaster) {
  for (var i = 0; i < count; i++) {
  spawn();
  }
  cluster.on('death', function(worker) {
  logger.info('worker ' + worker.process.pid + ' died. spawning a new process...');
  delete workers[worker.process.pid];
  spawn();
  });
} else {
  server = app.listen(process.env.PORT || 5000)
  cluster.worker.wsServer = ws.start(server);
  //listWSConnections();
}

function listWSConnections(){
  if(cluster.isWorker){
    logger.debug('Worker #' + cluster.worker.process.pid + ' has WS connections:');
    for(room in ws.rooms){
      logger.debug('ROOM:\t'+room);
    for(user in ws.rooms[room]){
        logger.debug('\t'+user);
      }
    }
  }
  setTimeout(listWSConnections, 5000);
};