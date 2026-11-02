import { prisma } from '../db';
import { ApiError } from '../lib/http';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export async function uniqueSessionCode(): Promise<string> {
  for (let i = 0; i < 12; i += 1) {
    const code = randomCode(6);
    const exists = await prisma.workshopSession.findUnique({ where: { joinCode: code } });
    if (!exists) return code;
  }
  throw new ApiError(500, 'CODE_GEN', 'Could not generate a unique session code');
}

export async function uniqueTeamCode(): Promise<string> {
  for (let i = 0; i < 12; i += 1) {
    const code = randomCode(5);
    const exists = await prisma.team.findUnique({ where: { joinCode: code } });
    if (!exists) return code;
  }
  throw new ApiError(500, 'CODE_GEN', 'Could not generate a unique team code');
}
