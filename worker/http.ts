/** Error yang diubah menjadi respons JSON `{ error }` dengan status tertentu. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const error = (message: string, status: number): Response => json({ error: message }, status);

export const noContent = (headers: Record<string, string> = {}): Response =>
  new Response(null, { status: 204, headers: { 'cache-control': 'no-store', ...headers } });

/** Baca body JSON objek; lempar 400 bila bukan objek JSON yang valid. */
export const readJson = async <T extends object>(req: Request): Promise<Partial<T>> => {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    throw new HttpError(400, 'Data yang dikirim tidak valid.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'Data yang dikirim tidak valid.');
  }
  return parsed as Partial<T>;
};

export const getCookie = (req: Request, name: string): string | null => {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return rest.join('=') || null;
    }
  }
  return null;
};

export const normalizeEmail = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';
