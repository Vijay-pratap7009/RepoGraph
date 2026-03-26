const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Serve static files from the current directory
app.use(express.static(__dirname));

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Socket connection logic
let connectedUsers = 0;

io.on('connection', (socket) => {
    connectedUsers++;
    console.log(`User connected. Total users: ${connectedUsers}`);
    
    // Broadcast when a new user joins
    socket.broadcast.emit('system-message', {
        text: 'A new user joined the graph room',
        timestamp: new Date().toISOString()
    });

    // Handle incoming chat messages
    socket.on('chat-message', (data) => {
        console.log(`Message from ${data.username}: ${data.text}`);
        
        // Broadcast the message to EVERYONE (including the sender, or we can use broadcast.emit if sender appends locally)
        // Here we broadcast to everyone so the server is the single source of truth for message ordering
        io.emit('chat-message', {
            username: data.username || 'Anonymous',
            text: data.text,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('disconnect', () => {
        connectedUsers--;
        console.log(`User disconnected. Total users: ${connectedUsers}`);
        io.emit('system-message', {
            text: 'A user left the graph room',
            timestamp: new Date().toISOString()
        });
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`=====================================`);
    console.log(`RepoGraph Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} in your browser`);
    console.log(`=====================================`);
});
