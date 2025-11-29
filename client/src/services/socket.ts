import { io, Socket } from 'socket.io-client';
import type { SocketEvents } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  connect(): void {
    this.socket = io({
      query: { clientId: this.clientId }
    });
  }

  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): void {
    if (this.socket) {
      this.socket.on(event as string, callback as any);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

export default SocketService;
