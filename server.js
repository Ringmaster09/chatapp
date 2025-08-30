// server.js - Backend WebSocket Server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (replace with database in production)
let users = new Map();
let rooms = new Map();
let messages = new Map();

// Helper functions
const generateId = () => Math.random().toString(36).substr(2, 9);

const createMessage = (userId, username, content, roomId = 'general') => ({
  id: generateId(),
  userId,
  username,
  content,
  roomId,
  timestamp: new Date().toISOString(),
  type: 'message'
});

const createSystemMessage = (content, roomId = 'general') => ({
  id: generateId(),
  userId: 'system',
  username: 'System',
  content,
  roomId,
  timestamp: new Date().toISOString(),
  type: 'system'
});

// Initialize default room
if (!rooms.has('general')) {
  rooms.set('general', {
    id: 'general',
    name: 'General',
    users: new Set(),
    created: new Date().toISOString()
  });
  messages.set('general', []);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins chat
  socket.on('join', (userData) => {
    const { username, roomId = 'general' } = userData;
    
    // Create user
    const user = {
      id: socket.id,
      username,
      socketId: socket.id,
      currentRoom: roomId,
      joinedAt: new Date().toISOString()
    };
    
    users.set(socket.id, user);
    
    // Join room
    socket.join(roomId);
    
    // Add user to room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        name: roomId.charAt(0).toUpperCase() + roomId.slice(1),
        users: new Set(),
        created: new Date().toISOString()
      });
      messages.set(roomId, []);
    }
    
    rooms.get(roomId).users.add(socket.id);
    
    // Send welcome message
    const welcomeMsg = createSystemMessage(`${username} joined the chat`, roomId);
    messages.get(roomId).push(welcomeMsg);
    
    // Send initial data to user
    socket.emit('joined', {
      user,
      room: rooms.get(roomId),
      messages: messages.get(roomId).slice(-50) // Last 50 messages
    });
    
    // Broadcast to room
    socket.to(roomId).emit('userJoined', { user, message: welcomeMsg });
    
    // Send updated user list
    const roomUsers = Array.from(rooms.get(roomId).users).map(id => users.get(id));
    io.to(roomId).emit('usersUpdate', roomUsers);
    
    console.log(`${username} joined room ${roomId}`);
  });

  // Handle new message
  socket.on('message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const { content, roomId = user.currentRoom } = data;
    
    if (!content || content.trim().length === 0) return;
    
    const message = createMessage(user.id, user.username, content.trim(), roomId);
    
    // Store message
    if (!messages.has(roomId)) {
      messages.set(roomId, []);
    }
    messages.get(roomId).push(message);
    
    // Keep only last 1000 messages per room
    const roomMessages = messages.get(roomId);
    if (roomMessages.length > 1000) {
      messages.set(roomId, roomMessages.slice(-1000));
    }
    
    // Broadcast message to room
    io.to(roomId).emit('message', message);
    
    console.log(`Message from ${user.username} in ${roomId}: ${content}`);
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    socket.to(user.currentRoom).emit('userTyping', {
      userId: user.id,
      username: user.username,
      isTyping: data.isTyping
    });
  });

  // Handle room creation
  socket.on('createRoom', (data) => {
    const { roomName } = data;
    const roomId = roomName.toLowerCase().replace(/\s+/g, '-');
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        name: roomName,
        users: new Set(),
        created: new Date().toISOString()
      });
      messages.set(roomId, []);
      
      io.emit('roomCreated', rooms.get(roomId));
    }
    
    socket.emit('roomCreateResult', { 
      success: !rooms.has(roomId),
      room: rooms.get(roomId)
    });
  });

  // Handle room switching
  socket.on('switchRoom', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const { roomId } = data;
    const oldRoom = user.currentRoom;
    
    // Leave old room
    socket.leave(oldRoom);
    rooms.get(oldRoom)?.users.delete(socket.id);
    
    // Join new room
    socket.join(roomId);
    user.currentRoom = roomId;
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        name: roomId.charAt(0).toUpperCase() + roomId.slice(1),
        users: new Set(),
        created: new Date().toISOString()
      });
      messages.set(roomId, []);
    }
    
    rooms.get(roomId).users.add(socket.id);
    
    // Send room data
    socket.emit('roomSwitched', {
      room: rooms.get(roomId),
      messages: messages.get(roomId).slice(-50)
    });
    
    // Update user lists
    const oldRoomUsers = Array.from(rooms.get(oldRoom)?.users || []).map(id => users.get(id));
    const newRoomUsers = Array.from(rooms.get(roomId).users).map(id => users.get(id));
    
    io.to(oldRoom).emit('usersUpdate', oldRoomUsers);
    io.to(roomId).emit('usersUpdate', newRoomUsers);
    
    // System messages
    const leaveMsg = createSystemMessage(`${user.username} left the chat`, oldRoom);
    const joinMsg = createSystemMessage(`${user.username} joined the chat`, roomId);
    
    messages.get(oldRoom)?.push(leaveMsg);
    messages.get(roomId).push(joinMsg);
    
    io.to(oldRoom).emit('message', leaveMsg);
    io.to(roomId).emit('message', joinMsg);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const roomId = user.currentRoom;
    
    // Remove from room
    rooms.get(roomId)?.users.delete(socket.id);
    users.delete(socket.id);
    
    // Send leave message
    const leaveMsg = createSystemMessage(`${user.username} left the chat`, roomId);
    messages.get(roomId)?.push(leaveMsg);
    
    // Broadcast to room
    socket.to(roomId).emit('userLeft', { user, message: leaveMsg });
    
    // Send updated user list
    const roomUsers = Array.from(rooms.get(roomId)?.users || []).map(id => users.get(id));
    io.to(roomId).emit('usersUpdate', roomUsers);
    
    console.log(`${user.username} disconnected from ${roomId}`);
  });

  // Get available rooms
  socket.on('getRooms', () => {
    const roomList = Array.from(rooms.values()).map(room => ({
      ...room,
      userCount: room.users.size,
      users: undefined
    }));
    socket.emit('roomsList', roomList);
  });
});

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    ...room,
    userCount: room.users.size,
    users: undefined
  }));
  res.json(roomList);
});

app.get('/api/room/:id/messages', (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const roomMessages = messages.get(id) || [];
  res.json(roomMessages.slice(-limit));
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Chat server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to access the chat`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

module.exports = { app, server, io };