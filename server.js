import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import socketHandler from './server/socket/SocketHandler.js';
import apiRoutes from './server/routes/api.js';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// Increase timeout to 120 minutes (in milliseconds) for large uploads
const TIMEOUT = 120 * 60 * 1000;
server.setTimeout(TIMEOUT);
server.keepAliveTimeout = TIMEOUT;
server.headersTimeout = TIMEOUT + 1000;

// Initialize Socket Handler
socketHandler.init(io);

// Ensure directories exist
if (!fs.existsSync('output')) fs.mkdirSync('output');
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Middleware
app.use(express.static('dist'));
app.use('/output', express.static(path.join(__dirname, 'output')));

// Routes
app.use('/', apiRoutes);

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));