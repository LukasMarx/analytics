import * as mongo from 'mongodb';
import { Subject } from 'rxjs';
import { Server } from 'ws';
import { v4 } from 'uuid';

// const uri = process.env.MONGODB;

// let cachedDb: mongo.Db = undefined;

// mongo.MongoClient.connect(
//   uri,
//   { poolSize: 10 }
// )
//   .then(async client => {
//     cachedDb = client.db('analytics');
//     const result = await cachedDb.command({ listCollections: 1 });
//     try {
//       cachedDb.createCollection('logs', { capped: true, size: 1073741824 });
//     } catch (error) {}
//     cachedDb.collection('logs').createIndex({ projectId: 1 }, { background: true, unique: false });
//   })
//   .catch();

const server = new Server({ port: 3000, path: '/analytics' });

const userCount = new Subject<number>();
const currentlyReading = new Subject<{ path: string; socketId: string }>();
const whoSeesWhat: { [key: string]: string } = {};

const adminRoom: { [key: string]: any } = {};
const userRoom: { [key: string]: any } = {};

server.on('connection', connection => {
  (<any>connection).isAlive = true;
  (<any>connection).id = v4();
  connection.on('message', message => {
    handleMessage(connection, message);
  });
  connection.on('close', () => {
    delete adminRoom[(<any>connection).id];
    delete userRoom[(<any>connection).id];
    for (const key in adminRoom) {
      adminRoom[key].send(JSON.stringify({ messageType: 'usercount', payload: Object.keys(userRoom).length }));
    }
  });
  connection.on('pong', () => ((<any>connection).isAlive = true));
});

function handleMessage(connection: any, msg: any) {
  const message = JSON.parse(msg);

  switch (message.messageType) {
    case 'joinAdmin': {
      adminRoom[connection.id] = connection;
      break;
    }
    case 'joinUser': {
      userRoom[connection.id] = connection;
      for (const key in adminRoom) {
        adminRoom[key].send(JSON.stringify({ messageType: 'usercount', payload: Object.keys(userRoom).length }));
      }
      break;
    }
    case 'navigation': {
      break;
    }
  }
}

const interval = setInterval(() => {
  server.clients.forEach(client => {
    const c: any = client;
    if (c.isAlive === false) {
      delete adminRoom[c.id];
      delete userRoom[c.id];
      client.terminate();
      return;
    }

    c.isAlive = false;
    client.ping(() => {});
  });
}, 10000);
