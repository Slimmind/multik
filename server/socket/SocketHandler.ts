import type { Server } from 'socket.io';

class SocketHandler {
  private io: Server | null;
  private clients: Map<string, string>;

  constructor() {
    this.io = null;
    this.clients = new Map();
  }

  init(io: Server): void {
    this.io = io;
    this.io.on('connection', (socket) => {
      const clientId = socket.handshake.query.clientId as string | undefined;
      if (clientId) {
        this.clients.set(clientId, socket.id);
        console.log(`Client connected: ${clientId} -> ${socket.id}`);
      }

      socket.on('disconnect', (reason) => {
        if (clientId && this.clients.get(clientId) === socket.id) {
          this.clients.delete(clientId);
          console.log(`Client disconnected: ${clientId} (${reason})`);
        }
      });
    });
  }

  emitToClient(clientId: string, event: string, data: any): void {
    const socketId = this.clients.get(clientId);
    if (socketId && this.io) {
      this.io.to(socketId).emit(event, data);
    }
  }
}

export default new SocketHandler();
