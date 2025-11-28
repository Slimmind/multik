const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketHandler = require('./server/socket/SocketHandler');
const apiRoutes = require('./server/routes/api');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);
const PORT = 3000;

// Initialize Socket Handler
socketHandler.init(io);

// Ensure directories exist
if (!fs.existsSync('output')) fs.mkdirSync('output');
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Middleware
app.use(express.static('public'));
app.use('/output', express.static(path.join(__dirname, 'output')));

// Routes
app.use('/', apiRoutes);

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));