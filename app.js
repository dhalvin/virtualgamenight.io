var cluster = require('cluster'),
  app = require('./express-app'),
  ws = require('./ws-app');

var workers = {},
  websockets = {},
  count = process.env.CORES || require('os').cpus().length;

function spawn(){
  var worker = cluster.fork();
  //console.log('Worker Pid: ' + worker.process.pid);
  workers[worker.process.pid] = worker;
  console.log('Spawning worker with id ' + worker.id);
  return worker;
}

if (cluster.isMaster) {
  for (var i = 0; i < count; i++) {
  spawn();
  }
  cluster.on('death', function(worker) {
  console.log('worker ' + worker.process.pid + ' died. spawning a new process...');
  delete workers[worker.process.pid];
  spawn();
  });
} else {
  server = app.listen(process.env.PORT || 5000)
  cluster.worker.wsServer = ws.start(server);
  listWSConnections();
}

function listWSConnections(){
  if(cluster.isWorker){
    console.log('Worker #' + cluster.worker.process.pid + ' has WS connections:');
    for(room in ws.rooms){
      console.log('ROOM:\t'+room);
    for(user in ws.rooms[room]){
        console.log('\t'+user);
      }
    }
  }
  setTimeout(listWSConnections, 5000);
};