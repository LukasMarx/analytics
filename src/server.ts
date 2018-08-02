import express from 'express';
import http from 'http';
import socketIO, { Socket } from 'socket.io';
import cors from 'cors';
import * as mongo from 'mongodb';
import { Subject } from 'rxjs';

const uri = process.env.MONGODB;

let cachedDb: mongo.Db = undefined;

mongo.MongoClient.connect(
  uri,
  { poolSize: 10 }
)
  .then(async client => {
    cachedDb = client.db('analytics');
    const result = await cachedDb.command({ listCollections: 1 });
    try {
      cachedDb.createCollection('logs', { capped: true, size: 1073741824 });
    } catch (error) {}
    cachedDb.collection('logs').createIndex({ projectId: 1 }, { background: true, unique: false });
  })
  .catch();

const app = express();
app.use(cors());
const httpServer = (<any>http).Server(app);
const io = socketIO(httpServer, { path: '/analytics', origins: '*:*', cookie: false });

const userCount = new Subject<number>();
const currentlyReading = new Subject<{ path: string; socketId: string }>();
const whoSeesWhat: { [key: string]: string } = {};

let counter = 0;
io.on('connection', function(socket) {
  socket.on('navigation', msg => {
    const dataset = { projectId: msg.projectId, path: msg.path, timestamp: new Date().getTime() };
    whoSeesWhat[socket.id] = msg.path;
    currentlyReading.next({ path: (<any>msg).path, socketId: socket.id });
    cachedDb.collection('logs').insert(dataset);
  });

  console.log('connected ' + socket.id);
  counter++;
  console.log(counter + ' active connections');

  socket.once('disconnect', () => {
    console.log('disconnected ' + socket.id);
    counter--;
    console.log(counter + ' active connections');
    delete whoSeesWhat[socket.id];
    currentlyReading.next();
    socket.disconnect(true);
  });
  socket.on('error', function(err) {
    console.log('socket error: ' + err);
    socket.disconnect(true);
  });
});

io.of('/admin').on('connection', function(socket) {
  const sub1 = currentlyReading.subscribe(reader => {
    socket.emit('usercount', Object.keys(whoSeesWhat).length);
    socket.emit('reading', whoSeesWhat);
  });
  socket.on('disconnect', () => {
    sub1.unsubscribe();
  });
});

httpServer.listen(3000, function() {
  console.log('listening on *:3000');
});
