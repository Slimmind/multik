class SocketHandler {
  constructor() {
    this.io = null;
    this.clients = new Map();
  }

  init(io) {
    this.io = io;
    this.io.on('connection', (socket) => {
      const clientId = socket.handshake.query.clientId;
      if (clientId) {
        this.clients.set(clientId, socket.id);
        console.log(`Client connected: ${clientId} -> ${socket.id}`);
      }

      socket.on('disconnect', () => {
        if (clientId && this.clients.get(clientId) === socket.id) {
          this.clients.delete(clientId);
        }
      });
    });
  }

  emitToClient(clientId, event, data) {
    const socketId = this.clients.get(clientId);
    if (socketId && this.io) {
      this.io.to(socketId).emit(event, data);
    }
  }
}

module.exports = new SocketHandler();
