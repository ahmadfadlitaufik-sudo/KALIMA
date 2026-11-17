import { handleAuth } from './auth';
import { handleWorkspace } from './workspace';
import { HttpError, error } from './http';
import { Env } from './types';

type ApiHandler = (req: Request, env: Env, path: string) => Promise<Response | null>;

const apiHandlers: ApiHandler[] = [handleAuth, handleWorkspace];

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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path === '/api' || path.startsWith('/api/')) {
      return handleApi(req, env, path);
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
