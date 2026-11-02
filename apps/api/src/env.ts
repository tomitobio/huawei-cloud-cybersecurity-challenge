import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
};

/**
 * Whether a browser Origin may call the API / open a socket.
 * - No Origin (same-origin, server-side, curl) is always allowed.
 * - An explicit "*" allow-list entry allows everything.
 * - Outside production (e.g. this test VM) any origin is allowed so the app can
 *   be reached via a public IP / hostname without reconfiguring CORS.
 */
export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true;
  if (env.clientOrigins.includes('*')) return true;
  if (env.clientOrigins.includes(origin)) return true;
  return !env.isProd;
}
