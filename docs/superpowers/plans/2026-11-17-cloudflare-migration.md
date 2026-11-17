# KALIMA → Cloudflare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run KALIMA entirely on Cloudflare (one Worker serving the SPA + `/api`, data in D1, own email/password login) with all Firestore data carried over unchanged.

**Architecture:** The six Firestore documents become six JSON rows in a D1 table `workspace_docs`; a Worker exposes read/save/version endpoints behind cookie sessions. In the React app only the persistence layer of `AppContext.tsx` changes: Firestore listeners become 5‑second version polling that feeds the *same* merge code. Firebase is removed.

**Tech Stack:** Cloudflare Workers (static assets + fetch handler, no router library), D1, Wrangler 4, Vitest 4 + `@cloudflare/vitest-pool-workers` 0.23, React 19 + Vite 8 (existing).

**Spec:** `docs/superpowers/specs/2026-11-17-cloudflare-migration-design.md`

## Global Constraints

- Repo: `~/Projects/KALIMA`. Commit locally after each task; **never push** without the owner's explicit OK.
- All user-facing text in Bahasa Indonesia.
- Allowed workspace doc ids, exactly: `orders`, `stock_movements`, `master`, `finance`, `operations`, `audit_logs`.
- Max saved JSON size: **1,800,000 bytes** (UTF‑8) → HTTP 413 with Indonesian message.
- Passwords: PBKDF2‑SHA256, **100,000** iterations, 16‑byte random salt (hex), 256‑bit hash (hex); minimum **8** chars; reject common passwords (reuse the keuangan‑keluarga list: `12345678 123456789 1234567890 87654321 11111111 00000000 12341234 11223344 password password1 password123 passw0rd qwertyui qwerty123 qwertyuiop` plus `kalima123 kalima2026`).
- Session cookie: `sid=<token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` (30 days); store only `SHA-256(token)` hex.
- Login throttle: **5** failures per email within **15** minutes → HTTP 429.
- First owner email locked to `ahmadfadlitaufik@gmail.com`; setup needs secret `SETUP_TOKEN`; setup only while `users` is empty.
- Emails are trimmed + lower‑cased everywhere (API input, DB, comparisons).
- Roles: `owner` | `admin`. Server enforces owner only on `/api/users*`.
- Poll interval: **5000 ms**, only while `document.visibilityState === 'visible'`; poll immediately on becoming visible.
- No new runtime dependencies. New devDependencies allowed: `wrangler@^4.164.0`, `vitest@^4.1.0`, `@cloudflare/vitest-pool-workers@^0.23.0`. Remove `firebase`, `@google/genai`, `express`, `@types/express`, `dotenv`.

## Review Focus

1. **Fresh browser on the new domain** (empty `localStorage`) must show exactly the server data — no demo seed records merged in. → pure function test in Task 5.
2. **Own save then poll**: after `PUT` returns version N, the next poll must not re‑fetch that doc because of the user's own save, and a save failure (network, 401, 413) must keep local data and show sync status `error`; 401 must return to the login page. → tests in Task 5 + manual check in Task 8.
3. **Deactivated user with a live session** gets 401 on the very next request. → test in Task 1.
4. **Email case / whitespace** (`" Ahmad@Gmail.com "`) logs in to the same account and cannot create a duplicate user. → tests in Tasks 1 and 3.
5. **Setup replay**: `POST /api/setup` after an owner exists, or with a wrong token, returns 403 and creates nothing. → test in Task 1.

---

## File Structure

| Path | Responsibility |
|---|---|
| `wrangler.jsonc` | Worker `kalima`, `main: worker/index.ts`, assets `./dist` with `not_found_handling: "single-page-application"` and `run_worker_first: ["/api/*"]`, D1 binding `DB` → `kalima-db`, `migrations_dir: "migrations"` |
| `migrations/0001_init.sql` | `users`, `sessions`, `login_failures`, `workspace_docs` |
| `worker/index.ts` | fetch handler: route `/api/*`, JSON errors, else `env.ASSETS.fetch` |
| `worker/http.ts` | `json()`, `error()`, `readJson()`, cookie helpers |
| `worker/crypto.ts` | `sha256Hex`, `randomHex`, `hashPassword`, `verifyPassword`, `isAcceptablePassword` |
| `worker/auth.ts` | login, logout, me, change password, setup, `requireUser`, throttle |
| `worker/users.ts` | owner‑only user management |
| `worker/workspace.ts` | read all / versions / save doc |
| `worker/test/*.test.ts` | Worker tests (pool‑workers) |
| `worker/tsconfig.json` | Worker TS config (types from `wrangler types`) |
| `vitest.workers.config.ts` | pool‑workers config, applies D1 migrations |
| `vitest.config.ts` | node tests for `src/**/*.test.ts` and `scripts/**/*.test.mjs` |
| `src/services/api.ts` | typed fetch wrappers; throws `ApiError` |
| `src/services/workspaceSync.ts` | pure helpers for first load + polling |
| `src/context/AuthContext.tsx` | rewritten on top of `api.ts` |
| `src/components/LoginPage.tsx`, `SetupPage.tsx`, `ChangePasswordModal.tsx` | auth UI |
| `src/views/UsersView.tsx` | owner user management via API |
| `src/context/AppContext.tsx` | persistence layer swap only |
| `scripts/firestore-backup.mjs`, `scripts/firestore-values.mjs`, `scripts/summarize-backup.mjs`, `scripts/import-backup.mjs` | migration |

---

### Task 1: Worker skeleton, schema, auth & setup

**Files:**
- Create: `wrangler.jsonc`, `migrations/0001_init.sql`, `worker/index.ts`, `worker/http.ts`, `worker/crypto.ts`, `worker/auth.ts`, `worker/tsconfig.json`, `vitest.workers.config.ts`, `worker/test/auth.test.ts`
- Modify: `package.json` (devDeps + scripts), `tsconfig.json` (exclude `worker`, `scripts`), `.gitignore` (`.wrangler/`, `backup/`, `.dev.vars`)

**Interfaces:**
- Produces:
  - `interface Env { DB: D1Database; ASSETS: Fetcher; SETUP_TOKEN: string }`
  - `interface SessionUser { id: number; email: string; name: string; role: 'owner' | 'admin' }`
  - `requireUser(req: Request, env: Env): Promise<SessionUser>` — throws `HttpError(401)` when no/expired session or user inactive
  - `class HttpError extends Error { status: number }`; `json(body, status?, headers?)`; `error(message, status)` → `{ error: message }`
  - `hashPassword(password: string, saltHex: string): Promise<string>`, `randomHex(bytes: number): string`, `isAcceptablePassword(pw: string): string | null` (Indonesian reason or null)
  - Routes: `POST /api/auth/login {email,password}` → 200 `{user}` + Set‑Cookie; `POST /api/auth/logout` → 204 + clearing cookie; `GET /api/auth/me` → `{user}` | 401; `POST /api/auth/password {currentPassword,newPassword}` → 204; `GET /api/setup` → `{needed: boolean}`; `POST /api/setup {token,name,password}` → 201 `{user}` + Set‑Cookie
- Schema (`migrations/0001_init.sql`):
  - `users(id INTEGER PK AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','admin')), active INTEGER NOT NULL DEFAULT 1, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT)`
  - `sessions(token_hash TEXT PK, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`
  - `login_failures(email TEXT NOT NULL, failed_at TEXT NOT NULL)` + index on `(email, failed_at)`
  - `workspace_docs(id TEXT PK, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, updated_by TEXT)`

- [ ] **Step 1: Install dev tools and scaffold**

Run: `npm i -D wrangler@^4.164.0 vitest@^4.1.0 @cloudflare/vitest-pool-workers@^0.23.0`, write `wrangler.jsonc` (D1 `database_id` placeholder `"TO_BE_FILLED_IN_TASK_8"`), run `npx wrangler types worker/worker-configuration.d.ts`. Configure `vitest.workers.config.ts` per the installed pool‑workers docs, reading `migrations/` with `readD1Migrations` and applying them in a setup file with `applyD1Migrations`; provide binding `SETUP_TOKEN: "test-setup-token"`. Add scripts: `"test:worker": "vitest run --config vitest.workers.config.ts"`, `"test": "vitest run && npm run test:worker"`, `"dev:api": "wrangler dev --port 8787"`, `"deploy": "npm run build && wrangler deploy"`.

- [ ] **Step 2: Write failing tests `worker/test/auth.test.ts`**

```ts
it('setup creates the locked owner once, with valid token', async () => {
  expect(await (await call('GET', '/api/setup')).json()).toEqual({ needed: true });
  const res = await call('POST', '/api/setup', { token: 'test-setup-token', name: 'Fadli', password: 'Rahasia#2026' });
  expect(res.status).toBe(201);
  expect((await res.json()).user).toMatchObject({ email: 'ahmadfadlitaufik@gmail.com', role: 'owner' });
  expect(res.headers.get('set-cookie')).toMatch(/^sid=[0-9a-f]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$/);
});
it('setup with wrong token returns 403', …status 403, users count 0);
it('setup after owner exists returns 403 and needed=false', …);
it('login normalizes email case and whitespace', … login with ' AhmadFadliTaufik@Gmail.com ' → 200);
it('wrong password returns 401 with message "Email atau kata sandi salah."');
it('6th attempt after 5 failures within 15 minutes returns 429');
it('GET /api/auth/me without cookie returns 401');
it('deactivated user with live session gets 401 on next request', … UPDATE users SET active=0 → me → 401);
it('expired session returns 401', … UPDATE sessions SET expires_at = past);
it('change password requires correct current password and rejects "12345678"', … 400 with reason);
it('logout deletes the session; me returns 401 afterwards');
it('non-api paths are served by ASSETS', …);
```

`call(method, path, body?, cookie?)` is a local helper using `SELF.fetch('https://kalima.test' + path, …)`.

- [ ] **Step 3: Run to verify failure** — `npm run test:worker` → FAIL (routes missing).
- [ ] **Step 4: Implement `worker/http.ts`, `worker/crypto.ts`, `worker/auth.ts`, `worker/index.ts`** — successful login clears that email's `login_failures`; failures older than 15 min are ignored (and may be deleted). `requireUser` joins `sessions`→`users` where `active = 1` and `expires_at > now`. Unknown `/api/*` → 404 JSON; uncaught errors → 500 `{error:"Terjadi kesalahan di server."}`.
- [ ] **Step 5: Run** `npm run test:worker` → PASS.
- [ ] **Step 6: Commit** — `git commit -m "Add Cloudflare Worker with D1 schema, login, sessions and owner setup"`

### Task 2: Workspace API

**Files:**
- Create: `worker/workspace.ts`, `worker/test/workspace.test.ts`
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: `requireUser`, `json`, `error`, `HttpError` (Task 1)
- Produces:
  - `type WorkspaceDocId = 'orders' | 'stock_movements' | 'master' | 'finance' | 'operations' | 'audit_logs'`
  - `GET /api/workspace` → `{ docs: Partial<Record<WorkspaceDocId, { data: unknown; version: number; updatedAt: string }>> }` (missing rows omitted)
  - `GET /api/workspace/versions` → `{ versions: Partial<Record<WorkspaceDocId, number>> }`
  - `PUT /api/workspace/:id` body `{ data: object }` → `{ version: number; updatedAt: string }`; upsert, `version = version + 1` (first insert = 1), `updated_by` = user email

- [ ] **Step 1: Write failing tests**

```ts
it('requires a session for all three endpoints', … 401 ×3);
it('PUT then GET round-trips data and bumps version', async () => {
  expect((await put('orders', { orders: [{ id: 'o1' }] })).version).toBe(1);
  expect((await put('orders', { orders: [] })).version).toBe(2);
  const body = await (await get('/api/workspace')).json();
  expect(body.docs.orders).toMatchObject({ data: { orders: [] }, version: 2 });
  expect((await (await get('/api/workspace/versions')).json()).versions).toEqual({ orders: 2 });
});
it('rejects unknown doc id with 404', … PUT /api/workspace/main → 404);
it('rejects body over 1,800,000 bytes with 413 "Data terlalu besar …"');
it('rejects non-object data with 400');
it('admin role can save (owner-only is not enforced here)');
```

- [ ] **Step 2: Run** `npm run test:worker` → FAIL.
- [ ] **Step 3: Implement `worker/workspace.ts`** — size check on the raw request text before `JSON.parse`; store `JSON.stringify(data)`; upsert with `INSERT … ON CONFLICT(id) DO UPDATE SET data=excluded.data, version=workspace_docs.version+1, …`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add workspace document API backed by D1"`

### Task 3: Owner-only user management API

**Files:**
- Create: `worker/users.ts`, `worker/test/users.test.ts`
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: Task 1 helpers, `hashPassword`, `isAcceptablePassword`
- Produces (all require `role === 'owner'`, else 403):
  - `GET /api/users` → `{ users: StaffUser[] }` where `StaffUser = { id: number; email: string; name: string; role: 'owner'|'admin'; active: boolean; createdAt: string }` (never returns hash/salt)
  - `POST /api/users {email,name,role,password}` → 201 `{ user: StaffUser }`; 409 `"Email ini sudah terdaftar."` on duplicate (after normalization)
  - `PATCH /api/users/:id {name?,role?,active?}` → `{ user }`
  - `POST /api/users/:id/password {password}` → 204 and deletes that user's sessions
  - `DELETE /api/users/:id` → 204
  - Owner cannot PATCH own `role`/`active`, nor DELETE self → 400 `"Tidak bisa mengubah akun Anda sendiri."`
  - Setting `active=false` deletes that user's sessions.

- [ ] **Step 1: Write failing tests** — admin gets 403 on each route; create with `' Siti@Kalima.ID '` stores `siti@kalima.id` and second create with `'SITI@kalima.id'` → 409; weak password → 400; response never contains `password_hash`/`salt`; deactivate → that user's `me` → 401; owner self‑demote/delete → 400; reset password → old password fails, new succeeds.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add owner-only user management API"`

### Task 4: Frontend auth on the new API

**Files:**
- Create: `src/services/api.ts`, `src/components/SetupPage.tsx`, `src/components/ChangePasswordModal.tsx`
- Modify (rewrite): `src/context/AuthContext.tsx`, `src/components/LoginPage.tsx`, `src/views/UsersView.tsx`
- Modify: `src/App.tsx` (AuthGate shows `SetupPage` when `status === 'setup'`), `src/components/Header.tsx` (account pill opens `ChangePasswordModal`), `vite.config.ts` (`server.proxy: { '/api': 'http://localhost:8787' }`)

**Interfaces:**
- Consumes: Task 1–3 routes.
- Produces:
  - `class ApiError extends Error { status: number }`; `onUnauthorized(handler: () => void): void` — every wrapper calls the registered handler on 401 (except `login`/`me`)
  - `api.login(email, password): Promise<SessionUser>`, `api.logout()`, `api.me(): Promise<SessionUser | null>`, `api.changePassword(current, next)`, `api.setupStatus(): Promise<boolean>`, `api.setup(token, name, password): Promise<SessionUser>`
  - `api.listUsers()`, `api.createUser({email,name,role,password})`, `api.updateUser(id, patch)`, `api.resetPassword(id, password)`, `api.deleteUser(id)`
  - `api.fetchWorkspace(): Promise<Record<string, {data, version, updatedAt}>>`, `api.fetchVersions(): Promise<Record<string, number>>`, `api.saveDoc(id, data): Promise<{version, updatedAt}>`
  - `useAuth()` → `{ status: 'loading'|'setup'|'signedOut'|'authorized'|'error'; appUser: User|null; errorMessage; signIn(email,password): Promise<string|null>; signOut(): Promise<void> }`. `appUser.id` = `String(user.id)`.
- `LoginPage`: email + password only; footer text "Lupa kata sandi? Minta Owner me-reset dari menu Pengguna." Keep the existing left column.
- `UsersView`: same table as now (bootstrap row removed), add‑form gets "Kata sandi awal"; row action "Reset kata sandi" (prompt for new password). Explain in header: "Berikan kata sandi awal ke staf; staf bisa menggantinya lewat menu akun."

- [ ] **Step 1: Implement `api.ts`, AuthContext, pages, modal, UsersView, App/Header wiring, Vite proxy.**
- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean. With `npm run dev:api` (local D1: `npx wrangler d1 migrations apply kalima-db --local`, `.dev.vars` with `SETUP_TOKEN=local-dev-token`) and `npm run dev`: setup page appears → create owner → app opens; wrong password shows "Email atau kata sandi salah."; create admin user in Pengguna; log in as admin in a private window → no Pengguna menu; deactivate admin → admin's next action returns to login.
- [ ] **Step 3: Commit** — `git commit -m "Switch login and user management to the Cloudflare API"`

### Task 5: Swap AppContext persistence to the API

**Files:**
- Create: `src/services/workspaceSync.ts`, `src/services/workspaceSync.test.ts`, `vitest.config.ts`
- Modify: `src/context/AppContext.tsx` (persistence only), `src/components/BalanceSheetSection.tsx`, `src/views/FinanceView.tsx`, `src/components/Header.tsx` (remove "Uji Cloud")

**Interfaces:**
- Consumes: `api.fetchWorkspace`, `api.fetchVersions`, `api.saveDoc` (Task 4)
- Produces:
  - `isFreshBrowser(storage: Pick<Storage,'getItem'>, prefix: string): boolean` — true when none of the `${prefix}` data keys (`orders`, `movements`, `series`, `skus`, `customers`, `cash_accounts`) exist
  - `docsToRefetch(known: Record<string, number>, server: Record<string, number>): WorkspaceDocId[]` — ids whose server version > known (missing known = 0)
  - `pickInitial<T>(fresh: boolean, local: T, server: T | undefined, merge: (l: T, s: T) => T): T` — fresh && server !== undefined → server; server undefined → local; else merge(local, server)
  - AppContext context value: `fixedAssets`, `setFixedAssets`, `balanceSheetConfig`, `setBalanceSheetConfig`, `customOpexCategories`, `setCustomOpexCategories` (stored in the `finance` doc as `fixedAssets`, `balanceSheetConfig`, `customOpexCategories`; defaults `INITIAL_FIXED_ASSETS`, `DEFAULT_CONFIG`, `[]` — move those two constants out of `BalanceSheetSection.tsx` into `src/data/initialData.ts`)

- [ ] **Step 1: Write failing tests `src/services/workspaceSync.test.ts`**

```ts
it('isFreshBrowser is true with no cached data keys', () => expect(isFreshBrowser(mem({ kalima_app_v1_theme: 'light' }), 'kalima_app_v1_')).toBe(true));
it('isFreshBrowser is false when orders are cached', …);
it('fresh browser takes server data, ignoring seeds', () =>
  expect(pickInitial(true, [{ id: 'seed' }], [{ id: 'real' }], mergeSpy)).toEqual([{ id: 'real' }]) && expect(mergeSpy).not.toHaveBeenCalled());
it('non-fresh browser merges', …);
it('server missing keeps local', …);
it('docsToRefetch skips docs whose version equals the version our own save returned', () =>
  expect(docsToRefetch({ orders: 4, master: 2 }, { orders: 4, master: 3, finance: 1 })).toEqual(['master', 'finance']));
```

- [ ] **Step 2: Run** `npx vitest run src` → FAIL. **Step 3: Implement `workspaceSync.ts`.** **Step 4: Run** → PASS.
- [ ] **Step 5: Rewire `AppContext.tsx`**
  - Remove Firebase imports; keep a `knownVersionsRef = useRef<Record<string, number>>({})` and `freshBrowserRef = useRef(isFreshBrowser(localStorage, STORAGE_PREFIX))`.
  - `save*ToCloud` and `syncToCloudNow`: replace `setDoc`/`getDocFromServer` with `api.saveDoc` / `api.fetchWorkspace`, payload shape unchanged (drop `updatedAt`); after each save set `knownVersionsRef.current[id] = version`. On error set `cloudSyncStatus = 'error'` and keep state; on `ApiError` 413 also show its message to the user (existing toast/alert pattern) so they know the data has grown too large.
  - `saveFinanceToCloud` also writes `fixedAssets`, `balanceSheetConfig`, `customOpexCategories`; include them in the finance debounce effect deps.
  - Add an `audit_logs` debounced save (1500 ms, same guard pattern as the other three effects).
  - Replace the listener `useEffect` with: initial `api.fetchWorkspace()` → for each doc apply the **existing** per-doc merge code, but through `pickInitial(freshBrowserRef.current, …)`; then set `isCloudInitializedRef.current = true`, `freshBrowserRef.current = false`. Then an interval (5000 ms, visible tab only, plus on `visibilitychange`) calling `api.fetchVersions()` → `docsToRefetch` → fetch workspace and apply the existing merge for those docs only.
  - Register `onUnauthorized(() => onSignOut())`.
  - `BalanceSheetSection` / `FinanceView`: read/write the three values via `useApp()`; delete their `localStorage` reads/writes.
  - Remove the "Uji Cloud" button and `FirestoreDiagnosticModal` usage from Header.
- [ ] **Step 6: Verify** — `npx tsc --noEmit` clean; manual with local API: create an order in window A → appears in window B within ~5 s; in a fresh private window the dashboard shows the same totals as window A (no demo orders/accounts appear); stop `dev:api` → creating an order shows sync error and the order stays visible; restart → "Sync Cloud" saves it.
- [ ] **Step 7: Commit** — `git commit -m "Store workspace data through the Cloudflare API with version polling"`

### Task 6: Remove Firebase and AI Studio leftovers

**Files:**
- Delete: `src/services/firebase.ts`, `src/services/firestoreDiagnostics.ts`, `src/components/FirestoreDiagnosticModal.tsx`, `firestore.rules`, `firebase.json`, `.firebaserc`, `firebase-applet-config.json`, `firebase-blueprint.json`, `metadata.json`, `server.js`, `.env.example`
- Modify: `package.json` (uninstall `firebase @google/genai express @types/express dotenv`; remove `start` script), `vite.config.ts` (drop AI Studio HMR comments/`DISABLE_HMR`, drop `vendor-firebase` chunk), `src/context/AppContext.tsx` (remove `window.runFirestoreDiagnostic` and `isFirebaseConnected`), `src/data/initialData.ts` (remove `INITIAL_USERS` if unused)

- [ ] **Step 1: Delete/uninstall as listed.**
- [ ] **Step 2: Verify** — `grep -rniE "firebase|firestore|genai" src vite.config.ts package.json` → no matches; `npx tsc --noEmit`, `npm run build`, `npm test` all pass.
- [ ] **Step 3: Commit** — `git commit -m "Remove Firebase, Gemini and AI Studio hosting leftovers"`

### Task 7: Migration scripts

**Files:**
- Create: `scripts/firestore-values.mjs`, `scripts/firestore-values.test.mjs`, `scripts/firestore-backup.mjs`, `scripts/summarize-backup.mjs`, `scripts/import-backup.mjs`

**Interfaces:**
- Produces:
  - `fromFirestoreFields(fields: object): object` — converts Firestore REST typed values (`stringValue`, `integerValue`→number, `doubleValue`, `booleanValue`, `nullValue`→null, `timestampValue`→string, `arrayValue.values` (missing → `[]`), `mapValue.fields` (missing → `{}`))
  - `node scripts/firestore-backup.mjs` → writes `backup/firestore-<YYYY-MM-DDTHH-mm>.json` = `{ exportedAt, docs: { [docId]: object } }` for **every** doc in `kalima_workspace` (paged, `pageSize=50`), from `https://firestore.googleapis.com/v1/projects/windy-summer-d83d0/databases/ai-studio-kalimawebapp-0da35a25-fc24-4f91-9980-01ff3e98c824/documents/kalima_workspace?key=<apiKey>`. Read project/db/apiKey from `firebase-applet-config.json` **before Task 6 deletes it** — copy those three values as constants into the script.
  - `node scripts/summarize-backup.mjs <file>` → table per allowed doc id: array field → item count, and JSON byte size; warns if any > 1,800,000 bytes.
  - `node scripts/import-backup.mjs <file> <baseUrl>` → prompts email + password in the terminal (password input hidden), logs in, `PUT`s the 6 allowed docs (strip `updatedAt`), prints returned versions. Never logs the password or cookie.

- [ ] **Step 1: Write failing test `scripts/firestore-values.test.mjs`** — nested map/array, `integerValue: "2103"` → `2103`, empty `arrayValue: {}` → `[]`, `nullValue` → `null`.
- [ ] **Step 2: Run** `npx vitest run scripts` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Dry run** — `node scripts/firestore-backup.mjs` then `node scripts/summarize-backup.mjs backup/<file>`; record counts/sizes in the task report. Import into the **local** API (`http://localhost:8787`) and confirm the local app shows the same dashboard totals as the AI Studio app (stok 2.103 pcs, kas Rp 110.000.000, piutang Rp 13.701.500 / 16 tagihan, or whatever the live app shows that day).
- [ ] **Step 6: Commit** — `git commit -m "Add Firestore backup, summary and import scripts"`

> Order note: Task 7's script constants must be captured before Task 6 runs. Executors may run Task 7 before Task 6.

### Task 8: Deploy, verify, cut over (needs the owner)

- [ ] **Step 1: Owner runs** `npx wrangler login` in Terminal (browser approval). Wait for confirmation.
- [ ] **Step 2: Create D1** — `npx wrangler d1 create kalima-db`; put the returned id into `wrangler.jsonc`; `npx wrangler d1 migrations apply kalima-db --remote`.
- [ ] **Step 3: Secret** — generate a 32‑byte hex token locally, `npx wrangler secret put SETUP_TOKEN` (pipe it in); give the token to the owner privately in the chat reply.
- [ ] **Step 4: Deploy** — `npm run deploy`; note the `*.workers.dev` URL.
- [ ] **Step 5: Owner** opens `<url>/` → setup page → enters token, name, password (owner types it; the assistant never sees it).
- [ ] **Step 6: Rehearsal import** — `node scripts/firestore-backup.mjs` → `import-backup.mjs <file> <url>` (owner types credentials). Owner compares dashboard numbers old vs new; also Review Focus #1 (open in a fresh browser profile) and #2 (two windows, ~5 s sync).
- [ ] **Step 7: Cutover (owner picks the time)** — staff stop using the AI Studio app; run backup + import again; owner re‑checks numbers; owner creates staff accounts in Pengguna.
- [ ] **Step 8: Close Firestore** — with owner's OK: deploy deny‑all rules to the KALIMA database only (`firebase-tools`, owner already started login) or the owner deletes that database in the console. Keep `backup/` locally.
- [ ] **Step 9: Commit** `wrangler.jsonc` with the real D1 id — `git commit -m "Point Worker at production D1 database"`; ask the owner before pushing to GitHub.
