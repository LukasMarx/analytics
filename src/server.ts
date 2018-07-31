import express from 'express';
import http from 'http';
import socketIO from 'socket.io';
import cors from 'cors';
import * as mongo from 'mongodb';

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
    cachedDb.collection('logs').createIndex({ projectId: 1, path: 1 }, { background: true, unique: true });
  })
  .catch();

const app = express();
app.use(cors());
const httpServer = (<any>http).Server(app);
const io = socketIO(httpServer, { path: '/analytics' });

io.on('connection', function(socket) {
  socket.on('navigation', msg => {
    const dataset = { projectId: msg.projectId, path: msg.path, timestamp: new Date().getTime() };
    console.log(dataset);
    io.to('realtime').emit('pageview', dataset);
    cachedDb.collection('logs').insert(dataset);
  });
});

httpServer.listen(3000, function() {
  console.log('listening on *:4222');
});
