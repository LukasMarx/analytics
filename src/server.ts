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
const io = socketIO(httpServer, { path: '/analytics', origins: '*:*', cookie: false, transports: ['websocket'] });

const userCount = new Subject<number>();

let counter = 0;
io.on('connection', function(socket) {
  socket.on('navigation', msg => {
    const dataset = { projectId: msg.projectId, path: msg.path, timestamp: new Date().getTime() };
    cachedDb.collection('logs').insert(dataset);
  });

  console.log('connected ' + socket.id);
  counter++;
  io.clients((error: Error, clients: any[]) => {
    userCount.next(clients.filter(n => n).length);

    const c = [];
    const s = io.of('/').sockets;
    for (const key in s) {
      if (s[key] && s[key].connected) {
        c.push(s[key]);
      }
    }
    console.log(clients.filter(n => n).length, c.length, counter);
    socket.disconnect(true);
  });
  socket.on('disconnect', () => {
    console.log('disconnected ' + socket.id);
    counter--;
    io.clients((error: Error, clients: any[]) => {
      userCount.next(clients.filter(n => n).length);

      const c = [];
      const s = io.of('/').sockets;
      for (const key in s) {
        if (s[key]) {
          c.push(s[key]);
        }
      }
      console.log(clients.filter(n => n != null).length, c.length, counter);
      socket.disconnect(true);
    });
  });
  socket.on('error', function(err) {
    console.log('socket error: ' + err);
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
