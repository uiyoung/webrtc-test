import express from 'express';
import { Server } from 'socket.io';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ../client 폴더를 static 경로로 지정
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../client')));

const MAX_CLIENTS_NUM = 2;

io.on('connection', (socket) => {
  console.log(`new client connected ${socket.id}`);

  // Join Room
  socket.on('join', (roomId) => {
    const clientCount = io.sockets.adapter.rooms.get(roomId)?.size;
    if (clientCount >= MAX_CLIENTS_NUM) {
      socket.emit('room-full', { roomId, clientCount });
      return;
    }

    socket.join(roomId);
    console.log(`${socket.id} joined room: ${roomId}`);

    // 방 참가가 정상 처리됨을 본인에게 전달
    socket.emit('joined', { roomId });

    // 기존 참가자에게 새 참가자를 알림 
    socket.to(roomId).emit('peer-joined', { userId: socket.id });
  });

  // WebRTC Offer/Answer/ICE Candidate 중계
  socket.on('offer', ({ roomId, offer }) => {
    console.log('offer received', roomId);
    socket.to(roomId).emit('offer', offer);
  });

  socket.on('answer', ({ roomId, answer }) => {
    console.log('answer received', roomId);
    socket.to(roomId).emit('answer', answer);
  });

  socket.on('candidate', ({ roomId, candidate }) => {
    console.log('ice candidate received', roomId);
    socket.to(roomId).emit('candidate', candidate);
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id);
  });
});

server.listen(3000, () => {
  console.log(`server running at http://localhost:${PORT}`);
});
