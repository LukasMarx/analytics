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
const io = socketIO(httpServer, { path: '/analytics', origins: '*:*' });

const userCount = new Subject<number>();

const sockets: { [key: string]: Socket } = {};
io.on('connection', function(socket) {
  sockets[socket.id] = socket;
  userCount.next(Object.keys(sockets).length);
  socket.on('navigation', msg => {
    const dataset = { projectId: msg.projectId, path: msg.path, timestamp: new Date().getTime() };
    cachedDb.collection('logs').insert(dataset);
  });
  socket.on('disconnect', () => {
    delete sockets[socket.id];
    userCount.next(Object.keys(sockets).length);
  });
});

io.of('/admin').on('connection', function(socket) {
  const sub = userCount.subscribe(count => {
    socket.emit('usercount', count);
  });
  socket.on('disconnect', () => {
    sub.unsubscribe();
  });
});

httpServer.listen(3000, function() {
  console.log('listening on *:4222');
});
