import { handleAuth } from './auth';
import { handleUsers } from './users';
import { handleWorkspace } from './workspace';
import { HttpError, error } from './http';
import { Env } from './types';

type ApiHandler = (req: Request, env: Env, path: string) => Promise<Response | null>;

const apiHandlers: ApiHandler[] = [handleAuth, handleWorkspace, handleUsers];

const handleApi = async (req: Request, env: Env, path: string): Promise<Response> => {
  try {
    for (const handler of apiHandlers) {
      const response = await handler(req, env, path);
      if (response) {
        return response;
      }
    }
    return error('Tidak ditemukan.', 404);
  } catch (caught) {
    if (caught instanceof HttpError) {
      return error(caught.message, caught.status);
    }
    console.error('Unhandled API error', caught);
    return error('Terjadi kesalahan di server.', 500);
  }
};

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

/** Tambahkan header keamanan standar browser ke setiap respons. */
const withSecurityHeaders = (res: Response): Response => {
  const secured = new Response(res.body, res);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }
  return secured;
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path === '/api' || path.startsWith('/api/')) {
      return withSecurityHeaders(await handleApi(req, env, path));
    }
    return withSecurityHeaders(await env.ASSETS.fetch(req));
  },
} satisfies ExportedHandler<Env>;
