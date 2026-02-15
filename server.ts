import express from 'express';
import http from 'http';
import path from 'path';
import { mkdir } from 'node:fs/promises';

import socketHandler from './server/socket/SocketHandler.ts';
import apiRoutes from './server/routes/api.ts';
import { Server } from 'socket.io';
import config from './server/config.ts';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Increase timeout for large uploads
server.setTimeout(config.timeout);
server.keepAliveTimeout = config.timeout;
server.headersTimeout = config.timeout + 1000;

// Initialize Socket Handler
socketHandler.init(io);

// Ensure directories exist
await mkdir(config.dirs.output, { recursive: true });
await mkdir(config.dirs.uploads, { recursive: true });

// Middleware
app.use(express.static(config.dirs.dist));
app.use('/output', express.static(path.resolve(config.dirs.output)));

// Routes
app.use('/', apiRoutes);

// SPA Fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.resolve(config.dirs.dist, 'index.html'));
});

// Graceful shutdown
const shutdown = () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(config.port, () => console.log(`http://localhost:${config.port}`));