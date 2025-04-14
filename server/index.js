const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://pomo-duo-ro.vercel.app", "https://pomo-duo-ro-git-main-sujithr07.vercel.app"]
      : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ["https://pomo-duo-ro.vercel.app", "https://pomo-duo-ro-git-main-sujithr07.vercel.app"]
    : "http://localhost:3000",
  credentials: true
}));

// Middleware
app.use(express.json());

// Socket.IO connection handling
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('joinRoom', ({ roomId, userId }) => {
    socket.join(roomId);
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(userId);
    
    // Send current room state to the new user
    const roomUsers = Array.from(rooms.get(roomId));
    io.to(roomId).emit('roomUsers', roomUsers);
    console.log(`User ${userId} joined room ${roomId}`);
  });

  socket.on('timerUpdate', ({ roomId, userId, timerState }) => {
    socket.to(roomId).emit('timerUpdated', { userId, timerState });
  });

  socket.on('statsUpdate', ({ roomId, userId, stats }) => {
    socket.to(roomId).emit('statsUpdated', { userId, stats });
  });

  socket.on('disconnect', () => {
    rooms.forEach((users, roomId) => {
      users.forEach(userId => {
        if (socket.rooms.has(roomId)) {
          users.delete(userId);
          io.to(roomId).emit('userLeft', userId);
        }
      });
      if (users.size === 0) {
        rooms.delete(roomId);
      }
    });
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server is accessible at http://localhost:${PORT}`);
  console.log(`For duo sessions, share your IP address with your partner`);
}); 