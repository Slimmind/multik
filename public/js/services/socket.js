export class SocketService {
  constructor(clientId) {
    this.socket = io({
      query: { clientId }
    });
  }

  on(event, callback) {
    this.socket.on(event, callback);
  }

  connect() {
    this.socket.on('connect', () => {
      console.log('Connected to socket');
    });
  }
}
