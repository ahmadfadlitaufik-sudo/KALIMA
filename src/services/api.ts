import { UserRole } from '../types';

/** Pengguna yang sedang login, seperti dikembalikan Worker. */
export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

/** Pengguna di menu Pengguna (khusus Owner). */
export interface StaffUser extends SessionUser {
  active: boolean;
  createdAt: string;
}

export type WorkspaceDocId = 'orders' | 'stock_movements' | 'master' | 'finance' | 'operations' | 'audit_logs';

export interface WorkspaceDoc {
  data: Record<string, unknown>;
  version: number;
  updatedAt: string;
}

/** Error dari API, membawa status HTTP dan pesan Bahasa Indonesia dari server. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Daftarkan fungsi yang dipanggil saat API membalas 401 (sesi habis). */
export const onUnauthorized = (handler: (() => void) | null): void => {
  unauthorizedHandler = handler;
};

const request = async <T>(method: string, path: string, body?: unknown, notifyUnauthorized = true): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Tidak bisa terhubung ke server. Periksa koneksi internet.');
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && notifyUnauthorized) {
      unauthorizedHandler?.();
    }
    throw new ApiError(response.status, (payload as { error?: string }).error ?? 'Terjadi kesalahan di server.');
  }
  return payload as T;
};

export const api = {
  login: async (email: string, password: string): Promise<SessionUser> =>
    (await request<{ user: SessionUser }>('POST', '/api/auth/login', { email, password }, false)).user,

  logout: (): Promise<void> => request('POST', '/api/auth/logout', undefined, false),

  /** Pengguna yang sedang login, atau null bila belum login. */
  me: async (): Promise<SessionUser | null> => {
    try {
      return (await request<{ user: SessionUser }>('GET', '/api/auth/me', undefined, false)).user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null;
      }
      throw error;
    }
  },

  /** Ubah nama tampilan sendiri; mengembalikan data pengguna terbaru. */
  updateProfile: async (name: string): Promise<SessionUser> =>
    (await request<{ user: SessionUser }>('PATCH', '/api/auth/profile', { name })).user,

  changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
    request('POST', '/api/auth/password', { currentPassword, newPassword }),

  /** needed = Owner pertama belum dibuat; email Owner hanya ikut dikirim saat needed. */
  setupStatus: async (): Promise<{ needed: boolean; email?: string }> =>
    request<{ needed: boolean; email?: string }>('GET', '/api/setup', undefined, false),

  setup: async (token: string, name: string, password: string): Promise<SessionUser> =>
    (await request<{ user: SessionUser }>('POST', '/api/setup', { token, name, password }, false)).user,

  listUsers: async (): Promise<StaffUser[]> => (await request<{ users: StaffUser[] }>('GET', '/api/users')).users,

  createUser: async (input: { email: string; name: string; role: UserRole; password: string }): Promise<StaffUser> =>
    (await request<{ user: StaffUser }>('POST', '/api/users', input)).user,

  updateUser: async (id: number, patch: Partial<Pick<StaffUser, 'name' | 'role' | 'active'>>): Promise<StaffUser> =>
    (await request<{ user: StaffUser }>('PATCH', `/api/users/${id}`, patch)).user,

  resetPassword: (id: number, password: string): Promise<void> =>
    request('POST', `/api/users/${id}/password`, { password }),

  deleteUser: (id: number): Promise<void> => request('DELETE', `/api/users/${id}`),

  fetchWorkspace: async (): Promise<Partial<Record<WorkspaceDocId, WorkspaceDoc>>> =>
    (await request<{ docs: Partial<Record<WorkspaceDocId, WorkspaceDoc>> }>('GET', '/api/workspace')).docs,

  fetchVersions: async (): Promise<Partial<Record<WorkspaceDocId, number>>> =>
    (await request<{ versions: Partial<Record<WorkspaceDocId, number>> }>('GET', '/api/workspace/versions')).versions,

  /** Simpan dokumen; `baseVersion` = versi yang terakhir diketahui (409 bila server sudah lebih baru). */
  saveDoc: (id: WorkspaceDocId, data: object, baseVersion: number): Promise<{ version: number; updatedAt: string }> =>
    request('PUT', `/api/workspace/${id}`, { data, baseVersion }),
};
