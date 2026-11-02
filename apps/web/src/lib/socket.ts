import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function joinSessionRoom(sessionId: string, audienceToken?: string) {
  getSocket().emit('joinSession', { sessionId, audienceToken });
}

export function joinTeamRoom(teamId: string) {
  getSocket().emit('joinTeam', { teamId });
}
