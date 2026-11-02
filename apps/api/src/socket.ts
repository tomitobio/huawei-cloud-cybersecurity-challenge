import { Server as HttpServer } from 'node:http';
import { Server as IoServer, type Socket } from 'socket.io';
import { env, isOriginAllowed } from './env';
import { AUTH_COOKIE, verifyToken } from './lib/tokens';
import { prisma } from './db';

let io: IoServer | null = null;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function initSocket(server: HttpServer): IoServer {
  io = new IoServer(server, {
    cors: { origin: (origin, cb) => cb(null, isOriginAllowed(origin)), credentials: true },
  });

  io.on('connection', (socket: Socket) => {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = (socket.handshake.auth?.token as string) || cookies[AUTH_COOKIE];
    const payload = token ? verifyToken(token) : null;

    socket.on('joinSession', async (input: { sessionId: string; audienceToken?: string; token?: string }) => {
      try {
        const session = await prisma.workshopSession.findUnique({ where: { id: input.sessionId } });
        if (!session) return;
        const isAudience = input.audienceToken && input.audienceToken === session.audienceToken;
        if (isAudience) {
          socket.join(`session:${session.id}`);
          return;
        }
        if (!payload) return;
        const allowed = await userCanAccessSession(payload.sub, payload.role, session.id);
        if (!allowed) return;
        socket.join(`session:${session.id}`);
        if (payload.role === 'CAPTAIN' || payload.role === 'PARTICIPANT') {
          const membership = await prisma.teamMembership.findFirst({
            where: { userId: payload.sub, team: { sessionId: session.id } },
          });
          if (membership) socket.join(`team:${membership.teamId}`);
        }
      } catch {
        // ignore join errors
      }
    });

    socket.on('joinTeam', async (input: { teamId: string }) => {
      if (!payload) return;
      const membership = await prisma.teamMembership.findFirst({
        where: { userId: payload.sub, teamId: input.teamId },
      });
      const team = await prisma.team.findUnique({ where: { id: input.teamId } });
      const isInstructor = team && payload.role !== 'AUDIENCE' && (await userCanAccessSession(payload.sub, payload.role, team.sessionId));
      if (membership || isInstructor) socket.join(`team:${input.teamId}`);
    });
  });

  return io;
}

async function userCanAccessSession(userId: string, role: string, sessionId: string): Promise<boolean> {
  if (role === 'ADMIN') return true;
  const session = await prisma.workshopSession.findUnique({ where: { id: sessionId } });
  if (!session) return false;
  if (session.instructorId === userId) return true;
  const membership = await prisma.teamMembership.findFirst({
    where: { userId, team: { sessionId } },
  });
  return Boolean(membership);
}

export function emitToSession(sessionId: string, event: string, payload: unknown) {
  io?.to(`session:${sessionId}`).emit(event, payload);
}

export function emitToTeam(teamId: string, event: string, payload: unknown) {
  io?.to(`team:${teamId}`).emit(event, payload);
}
