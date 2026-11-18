# Saran Restok + Draf PO dari Daftar — Desain

## Tujuan
Menunjukkan SKU mana yang perlu dipesan, berapa jumlahnya, lalu membuka form PO di Pengadaan yang sudah terisi. Dengan begitu pemesanan tidak lagi bergantung pada ingatan, dan utang vendor tercatat lewat alur PO yang sudah ada.

## Bukan tujuan
- Tidak membuat PO otomatis tanpa dilihat pengguna.
- Tidak ada pemetaan SKU ke vendor; vendor dipilih manual di form PO.
- Tidak menghitung lead time per vendor atau pola musiman.
- Tidak mengubah alur PO, penerimaan barang, atau pembayaran yang sudah ada.

## Pendekatan yang dipilih
Tab baru "Saran restok" di Pengadaan, ditambah form PO yang bisa dibuka dengan isian awal. Pendekatan lain dipertimbangkan dan ditolak: PO otomatis per vendor (butuh pemetaan SKU-vendor yang belum ada dan salah usulan langsung jadi utang), dan hanya tombol di Dashboard (terbatas 5 SKU, tanpa tempat menimbang jumlah).

## Aturan hitung (keputusan pengguna: target 45 hari; lainnya pilihan saya)
- Laku per hari = total pcs terjual dalam 60 hari terakhir ÷ 60, tidak termasuk order batal.
- Stok pakai stok Gudang Utama; stok minus dihitung 0. Stok yang dititip di reseller tidak dihitung.
- Sudah dipesan = jumlah pesan dikurangi jumlah diterima pada PO berstatus dipesan, dikirim, atau diterima sebagian.
- Usulan = pembulatan ke atas dari (laku per hari × 45) − stok − sudah dipesan.
- SKU tampil bila usulan > 0. SKU nonaktif dan SKU tanpa penjualan dalam 60 hari tidak tampil.
- Sisa hari = stok ÷ laku per hari, dibulatkan ke bawah; 0 bila stok nol atau minus. Daftar urut dari sisa hari terkecil.

## Tampilan
- Tab "Saran restok" di Pengadaan dengan kartu ringkas (jumlah SKU perlu dipesan, total pcs usulan) dan satu tabel: centang, SKU, stok, sudah dipesan, laku per hari, sisa hari, usulan (kolom angka yang bisa diubah).
- Di HP tabel menjadi daftar kartu. Pencarian dan filter lini mengikuti halaman lain.
- Tombol "Buat PO (n SKU)" membuka form PO dengan SKU, jumlah, dan harga beli (HPP SKU) terisi; vendor tetap dipilih pengguna.
- Bila belum ada penjualan 60 hari terakhir, tampil pesan kosong yang menjelaskan itu.

## Teknis
- Fungsi murni baru `src/services/restockPlanning.ts` dengan tes; memakai jendela penjualan yang sama seperti `stockCover` di `dashboardMetrics.ts`.
- `CreatePOModal` di `PurchasesView.tsx` menerima isian awal opsional (daftar SKU, jumlah, harga) tanpa mengubah perilaku saat dibuka biasa.
- Tidak ada perubahan data tersimpan, API, atau migrasi.

## Risiko yang diketahui
- Penjualan Oktober di live baru 13 pcs; bila ordernya belum lengkap, usulan terlalu kecil. Jendela 60 hari mengurangi pengaruhnya, dan halaman menampilkan jendela yang dipakai.
- Vendor di live sepertinya data contoh; fitur tidak bergantung pada isinya.
