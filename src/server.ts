import express from 'express';
import http from 'http';
import socketIO, { Socket } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const httpServer = (<any>http).Server(app);
const io = socketIO(httpServer, { path: '/analytics', origins: '*:*', cookie: false });

let counter = 0;
io.on('connection', function(socket) {
  socket.disconnect(true);
});

httpServer.listen(3000, function() {
  console.log('listening on *:3000');
});
