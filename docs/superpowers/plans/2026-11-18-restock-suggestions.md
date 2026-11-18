# Saran Restok Implementation Plan

> Eksekusi inline (superpowers:executing-plans). Langkah memakai checkbox.

**Goal:** Tab "Saran restok" di Pengadaan yang menghitung usulan pesan per SKU dan membuka form PO terisi.
**Architecture:** Fungsi murni `restockSuggestions` di `src/services/restockPlanning.ts`; `PurchasesView` menampilkan tabelnya; `CreatePOModal` menerima `initialItems`.
**Tech Stack:** React 19, TypeScript, vitest.
**Spec:** docs/superpowers/specs/2026-11-18-restock-suggestions-design.md

## Global Constraints
- Laku per hari = pcs terjual 60 hari terakhir ÷ 60 (tanpa order batal); target 45 hari.
- Stok Gudang Utama, minus = 0. Sudah dipesan = qtyPesan − qtyDiterima pada PO berstatus dipesan, dikirim, diterima_sebagian.
- Usulan = ceil(perHari × 45) − stok − sudahDipesan; tampil bila > 0; SKU nonaktif dan tanpa penjualan 60 hari tidak tampil; urut sisa hari naik.
- UI Indonesia, gaya terang (CARD/INPUT/pill tabs), tanpa perubahan data tersimpan.

## Review Focus
- Order batal dan di luar jendela tidak dihitung → tes Task 1.
- PO berjalan mengurangi usulan, PO batal/diterima penuh tidak → tes Task 1.
- SKU nonaktif dan stok minus → tes Task 1.
- Modal PO dibuka biasa tetap seperti semula → cek preview Task 2.

### Task 1: Hitungan saran restok
**Files:** Create `src/services/restockPlanning.ts`, `src/services/restockPlanning.test.ts`
**Produces:** `restockSuggestions(input: { orders; skus: {sku,name,hpp,active?}[]; stockBySku: Record<string,number>; purchaseOrders: {statusPO; items:{sku,qtyPesan,qtyDiterima}[]}[]; today: string; windowDays?: number; targetDays?: number }): RestockSuggestion[]` dengan `RestockSuggestion = { sku; name; hpp; stock; onOrder; perDay; daysLeft; suggested }`.
- [ ] Tes gagal: ukuran jendela, order batal, PO berjalan, nonaktif, minus, urutan.
- [ ] Implementasi, tes lulus, commit.

### Task 2: Tab dan form PO terisi
**Files:** Modify `src/views/PurchasesView.tsx`
- [ ] `CreatePOModal` menerima `initialItems?: {sku,qtyPesan,hargaBeliSatuan}[]` (dipakai sebagai nilai awal `poItems`).
- [ ] Tab `restock` ("Saran restok") dengan kartu ringkas, tabel centang + usulan bisa diubah, kartu di HP, pesan kosong, tombol "Buat PO (n SKU)".
- [ ] tsc, tes, build, cek preview desktop + HP, commit.
