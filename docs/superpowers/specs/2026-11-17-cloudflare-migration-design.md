# Desain: Memindahkan KALIMA dari Firebase ke Cloudflare

Tanggal: 2026-11-17 · Status: draf, menunggu persetujuan

## 1. Maksud dan alasan

Pemilik (ahmadfadlitaufik@gmail.com) ingin **semua aplikasinya berada di satu akun Cloudflare**. Akun itu sudah menjalankan 4 aplikasi dengan pola Worker + D1 (nexus-client-hub, marketing-task-manager, keuangan-keluarga, team-monitor). KALIMA saat ini dibuat di Google AI Studio dan memakai Firebase (Firestore + Firebase Auth) di proyek "Starter Tier" milik AI Studio. Proyek itu membatasi akses ke pengaturan, sehingga aturan keamanan Firestore pun sulit dipasang.

Tujuannya **pindah tempat**, bukan merombak aplikasi. KALIMA harus bekerja persis seperti sekarang bagi pengguna, hanya saja data, hosting, dan login berada di Cloudflare.

## 2. Tujuan, bukan-tujuan, anti-tujuan

**Tujuan**
- Data KALIMA tersimpan di D1, di akun Cloudflare pemilik.
- Aplikasi dan API berjalan di satu Worker (aset statis + API), seperti aplikasi lain milik pemilik.
- Login email + kata sandi buatan sendiri (sesi cookie), Owner mengelola akun staf.
- Seluruh data lama dari Firestore terbawa utuh, dibuktikan dengan angka yang sama sebelum dan sesudah.
- Ketergantungan pada Firebase dihapus dari kode.

**Bukan tujuan (sengaja tidak dikerjakan sekarang)**
- Memecah data menjadi tabel per jenis (opsi B/C). Bisa jadi langkah lanjutan.
- Memperbaiki risiko data saling timpa antar-pengguna (perilaku "terakhir menyimpan menang" yang ada sekarang tetap).
- Menerapkan pembatasan Owner/Admin di server. Pembatasan tetap di tampilan seperti sekarang; server hanya memastikan pengguna sudah login dan aktif. Pengecualian: kelola pengguna wajib Owner di server.
- Login Google (bisa ditambah belakangan langsung lewat Google OAuth, pola yang sama sudah ada di keuangan-keluarga).
- Domain khusus (pakai `*.workers.dev` dulu).

**Anti-tujuan (gagal walaupun "jalan")**
- Ada data yang hilang atau berubah angkanya saat pindah (stok, saldo kas, piutang, jurnal).
- Logika bisnis (69 fungsi di `AppContext.tsx`) ikut berubah perilakunya.
- Ada jalan masuk ke data tanpa login.
- Data ditulis ke Firestore setelah ekspor terakhir lalu hilang tanpa disadari.

## 3. Kondisi sekarang

- React 19 + Vite 8 + Tailwind 4, SPA. ~36 ribu baris TSX.
- Semua data ada di koleksi `kalima_workspace`, 6 dokumen yang dipakai: `orders`, `stock_movements`, `master`, `finance`, `operations`, `audit_logs`. Dokumen lain di koleksi itu (`main`, `persistence_probe`, `test_split`) tidak dibaca kode; ikut dibackup, tidak dimigrasikan.
- `src/context/AppContext.tsx` (~4.000 baris) memegang semua state. Sentuhan ke Firestore hanya di:
  - `saveOrdersToCloud`, `saveMasterToCloud`, `saveFinanceToCloud`, `saveOperationsToCloud` (tulis satu dokumen utuh),
  - satu `useEffect` berisi 6 listener `onSnapshot` yang menggabungkan data remote ke state lokal lewat `mergeById`/`mergeByKey`,
  - `syncToCloudNow` (ambil 6 dokumen, gabung, tulis balik; dipanggil saat fokus jendela/online dan tombol "Sync Cloud"),
  - `src/services/firestoreDiagnostics.ts` + `FirestoreDiagnosticModal` (tombol "Uji Cloud").
- Data juga di-cache di `localStorage` (prefix `kalima_app_v1_`).
- Login: Firebase Auth (Google + email/sandi) dan daftar pengguna `kalima_users`, baru dibuat hari ini (commit `2e2980f`, belum di-push). Akan diganti.
- Aturan Firestore di server **masih terbuka** (`allow read, write: if true`). Migrasi ini juga menutup masalah itu, karena Firestore tidak dipakai lagi.

## 4. Pendekatan yang dipertimbangkan

| | Pendekatan | Untung | Rugi |
|---|---|---|---|
| **A (dipilih)** | Pindah apa adanya: 6 dokumen JSON disimpan sebagai 6 baris di D1; hanya lapisan penyimpanan di `AppContext` yang diganti | Cepat (±1–2 hari), logika bisnis tidak disentuh, risiko kecil | Risiko saling timpa tetap; batas ukuran per baris (±2 MB di D1) |
| B | Tabel per jenis data | Data rapi, aman dari saling timpa, hak akses di server | Tulis ulang 69 fungsi, berminggu-minggu, risiko bug hitungan |
| C | Campuran: pesanan & pergerakan stok jadi tabel, sisanya blob | Mengatasi bagian data yang paling cepat membesar | Lebih lama dari A, melebihi tujuan |

Pemilik memilih **A**, dan **tanpa login Google dulu**.

## 5. Desain yang diputuskan

### 5.1 Hosting
- Satu Worker bernama `kalima`, dengan **static assets** (hasil `vite build` di `dist/`) dan API di bawah `/api/*`. Rute lain jatuh ke `env.ASSETS` (SPA fallback ke `index.html`). Pola sama dengan keuangan-keluarga.
- Binding D1 bernama `DB`, database baru `kalima-db`.
- Alamat awal: `kalima.<subdomain-akun>.workers.dev`.
- `server.js` (Express untuk Cloud Run) dihapus.

### 5.2 Penyimpanan data (D1)

```sql
CREATE TABLE workspace_docs (
  id          TEXT PRIMARY KEY,          -- orders | stock_movements | master | finance | operations | audit_logs
  data        TEXT NOT NULL,             -- JSON, isi sama dengan dokumen Firestore (tanpa updatedAt)
  version     INTEGER NOT NULL DEFAULT 1,-- naik 1 setiap simpan
  updated_at  TEXT NOT NULL,
  updated_by  TEXT                       -- email pengguna yang terakhir menyimpan
);
```

- Hanya 6 `id` di atas yang diterima API; selain itu ditolak.
- Ukuran: Worker menolak simpan bila JSON > 1,8 MB dan mengembalikan pesan jelas; klien menampilkan peringatan. Saat migrasi, ukuran tiap dokumen dicatat.

### 5.3 API (semua butuh sesi, kecuali login & setup)

| Metode & jalur | Fungsi |
|---|---|
| `GET /api/workspace` | Semua 6 dokumen: `{ [id]: { data, version, updatedAt } }` |
| `GET /api/workspace/versions` | Hanya `{ [id]: version }` (murah, untuk cek berkala) |
| `PUT /api/workspace/:id` | Body `{ data }`, simpan utuh, `version + 1`, balas versi baru |
| `POST /api/auth/login` | `{ email, password }` → set cookie sesi |
| `POST /api/auth/logout` | Hapus sesi |
| `GET /api/auth/me` | Pengguna yang sedang login, atau 401 |
| `POST /api/auth/password` | Ganti kata sandi sendiri (wajib kata sandi lama) |
| `GET/POST/PATCH/DELETE /api/users…` | **Hanya Owner**: daftar, tambah (dengan kata sandi awal), ubah peran/aktif, reset kata sandi, hapus. Owner tidak bisa menonaktifkan/menghapus dirinya sendiri |
| `GET/POST /api/setup` | Pembuatan Owner pertama (lihat 5.4) |

### 5.4 Login dan pengguna
- Tabel `users` (id, email unik huruf kecil, name, role `owner|admin`, active, password_hash, salt, created_at) dan `sessions` (token_hash, user_id, expires_at, created_at).
- Kata sandi: PBKDF2-SHA256 100.000 iterasi + salt acak; minimal 8 karakter, tolak kata sandi umum. Sama dengan keuangan-keluarga.
- Sesi: token acak, disimpan sebagai hash SHA-256; cookie `sid` `HttpOnly; Secure; SameSite=Lax`, berlaku 30 hari. Pengguna yang dinonaktifkan langsung kehilangan akses (sesi dicek ke `users.active` setiap permintaan).
- Pembatasan percobaan login: setelah 5 kali gagal untuk satu email dalam 15 menit, tolak sementara.
- **Owner pertama**: halaman `/setup` hanya aktif selama tabel `users` kosong, dan butuh `SETUP_TOKEN` (secret Worker yang dibuat saat deploy dan diberikan ke pemilik). Email Owner pertama dikunci ke `ahmadfadlitaufik@gmail.com`. Setelah Owner terbuat, `/setup` mati permanen.
- Staf: Owner membuat akun dengan kata sandi awal dari menu **Pengguna**, memberikannya ke staf, dan staf menggantinya lewat menu akun. Lupa kata sandi staf: Owner me-reset dari menu Pengguna. Lupa kata sandi Owner: reset manual lewat perintah D1 (dibantu).

### 5.5 Perubahan di aplikasi (frontend)
- `src/services/firebase.ts`, `AuthContext.tsx` versi Firebase, `firestoreDiagnostics.ts`, `FirestoreDiagnosticModal`, `firestore.rules`, `firebase.json`, `.firebaserc`, `firebase-applet-config.json`, `firebase-blueprint.json` dihapus; paket `firebase` dan `@google/genai` (tidak terpakai) dicopot. `metadata.json` (milik AI Studio) dihapus.
- `src/services/api.ts` baru: `fetchWorkspace()`, `fetchVersions()`, `saveDoc(id, data)`, plus fungsi auth & users.
- `AuthContext` ditulis ulang di atas API (`/api/auth/me` saat aplikasi dibuka). `AuthGate` di `App.tsx` tetap: `AppProvider` hanya dirender setelah login.
- `LoginPage`: email + kata sandi saja (hilangkan Google, "Buat kata sandi", "Lupa kata sandi" → diganti teks "minta Owner me-reset").
- `UsersView`: pakai API; tambah kolom kata sandi awal dan tombol reset kata sandi.
- Menu akun di header: tambah "Ganti kata sandi".
- `AppContext.tsx`, hanya lapisan penyimpanan:
  - 4 fungsi `save*ToCloud` → `saveDoc(...)` dengan isi yang sama.
  - Simpan `audit_logs` juga dilakukan saat log baru ditambahkan (debounce seperti data lain), bukan hanya saat sinkron fokus.
  - `useEffect` listener → **cek berkala**: tiap 5 detik saat tab terlihat (berhenti saat tab tersembunyi, langsung cek saat tab kembali), panggil `/versions`; untuk dokumen yang versinya naik, ambil datanya lalu jalankan **kode penggabungan yang sama persis** dengan callback `onSnapshot` sekarang.
  - `syncToCloudNow` tetap dengan logika gabung yang sama, hanya sumber/tujuannya API.
  - Tombol "Uji Cloud" dihapus; "Sync Cloud" tetap.
  - Respons 401 dari API → kembali ke halaman login.
- Cache `localStorage` tetap seperti sekarang, **dengan satu pengecualian** (keputusan builder/asisten, dari builder check): bila cache lokal kosong (browser baru, termasuk semua pengguna saat pindah ke domain Cloudflare) dan server sudah berisi data, state diisi **langsung dari data server tanpa digabung dengan data contoh** di `src/data/initialData.ts`. Tanpa ini, data contoh (rekening kas, pesanan, jurnal, dll.) bisa tercampur ke data asli dan menimpa angka yang id-nya sama.

- **Data yang selama ini hanya di browser** (`kalima_fixed_assets`, `kalima_balance_sheet_config` di `BalanceSheetSection.tsx`; `kalima_custom_opex_categories` di `FinanceView.tsx`) mulai sekarang disimpan di dokumen `finance` (field `fixedAssets`, `balanceSheetConfig`, `customOpexCategories`), lewat state di `AppContext` seperti data keuangan lain, sehingga sama di semua perangkat. Pemilik memastikan ketiganya **belum pernah diisi**, jadi tidak perlu dipindahkan dari browser lama; bila kosong, pakai nilai bawaan yang ada sekarang. (Keputusan asisten.)

### 5.6 Migrasi data
1. **Backup**: skrip lokal mengambil semua dokumen `kalima_workspace` dari Firestore lewat REST API (aturan masih terbuka, jadi tidak perlu login) dan menyimpannya ke `backup/firestore-<tanggal>.json` (di-`.gitignore`, tidak di-commit).
2. **Ringkasan angka** dari backup: jumlah pesanan, total omzet, total stok, saldo per rekening kas, jumlah jurnal, piutang aktif.
3. **Impor** 6 dokumen ke `workspace_docs` di D1.
4. **Cocokkan**: buka KALIMA di Cloudflare, bandingkan angka dashboard dengan ringkasan (contoh saat ini: total stok 2.103 pcs, saldo kas Rp 110.000.000, piutang Rp 13.701.500 / 16 tagihan).
5. **Pindah resmi**: tentukan jam pindah; staf berhenti memakai versi AI Studio; ekspor ulang (langkah 1–4) tepat sebelum dibuka untuk staf agar tidak ada data tertinggal.
6. **Matikan Firestore lama**: pasang aturan "tolak semua" (lewat `firebase-tools`, sudah setengah jalan) atau hapus database KALIMA di proyek AI Studio; backup lokal disimpan.

### 5.7 Pengujian
- Worker: tes otomatis untuk login (berhasil, gagal, pembatasan percobaan), akses tanpa sesi ditolak, pengguna nonaktif ditolak, kelola pengguna hanya Owner, simpan/ambil dokumen & versi, penolakan ukuran > 1,8 MB, `/setup` mati setelah Owner ada. Memakai Vitest + `@cloudflare/vitest-pool-workers` (paket baru, dev-only).
- Frontend: `tsc --noEmit` dan `vite build` bersih; uji manual di browser: login, tambah pesanan, data muncul di tab kedua dalam ±5 detik, kelola pengguna.
- Migrasi: angka langkah 5.6-4 cocok.

### 5.8 Deploy
- Memakai `wrangler` (paket dev baru). Pemilik menjalankan `npx wrangler login` sekali di Terminal (seperti `firebase login` tadi); setelah itu builder bisa membuat D1, memasang secret, dan deploy.
- Kode tetap di repo `ahmadfadlitaufik-sudo/KALIMA`; push ke GitHub hanya dengan izin pemilik.

## 6. Diserahkan ke builder
- Struktur folder Worker (`worker/` + `wrangler.jsonc` di root disarankan), pustaka routing (atau tanpa pustaka, seperti keuangan-keluarga).
- Bentuk pesan error berbahasa Indonesia, detail tampilan UsersView & dialog ganti kata sandi, mengikuti gaya yang ada.
- Cara skrip migrasi dijalankan (Node script di `scripts/`).
- Urutan commit; semua commit lokal, push menunggu izin.
