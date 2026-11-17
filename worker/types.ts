export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SETUP_TOKEN: string;
}

export type UserRole = 'owner' | 'admin';

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}
