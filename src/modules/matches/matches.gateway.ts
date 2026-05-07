import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MatchesGateway {
  @WebSocketServer()
  server!: Server;

  broadcastNewMatches(payload: unknown) {
    if (!this.server) {
      return;
    }

    this.server.emit('matches.created', payload);
  }
}
