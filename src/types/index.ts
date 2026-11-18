export type UserRole = 'owner' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export type ApparelFit = 'Oversize' | 'Regular';

export interface ProductSeries {
  id: string;
  code: string; // e.g. "210OV", "290OV", "185RG"
  name: string; // e.g. "210 GSM Oversize"
  gsm: number; // 210, 290, 185
  fit: ApparelFit;
  description: string;
  baseCost: number; // Biaya kaos polos
  defaultPrice: number;
  image?: string;
}

export interface ProductColor {
  code: string; // e.g. "HT", "PT", "SG", "CH"
  name: string; // e.g. "Hitam", "Putih", "Sage Green"
  hex: string;
}

export type ApparelSize = 'S' | 'M' | 'L' | 'XL' | '2XL';

export interface SKUItem {
  sku: string; // format: KL-[SERI]-[WARNA]-[SIZE], e.g. KL-210OV-HT-XL
  seriesId: string;
  seriesCode: string;
  colorCode: string;
  colorName: string;
  size: ApparelSize;
  name: string; // e.g. "Kalima 210 GSM Oversize - Hitam - XL"
  price: number;
  hpp: number; // calculated from baseCost + BOM aksesoris
  minStock: number; // buffer minimum
  active: boolean;
}

export interface BOMItem {
  id: string;
  komponen: string;
  biayaPerUnit: number;
  keterangan: string;
}

export type SalesChannelName = 
  | 'TAPADA'
  | 'Shopee'
  | 'TikTok'
  | 'Umum'
  | 'Internal'
  | 'Marketing'
  | 'Reseller';

export interface SalesChannel {
  id: string;
  name: SalesChannelName;
  adminFeePercent: number; // e.g. 7.5 for Shopee
  deskripsi?: string;
  warnaBadge: string;
}

export type CustomerCategory = 'Umum' | 'Reseller' | 'Marketplace' | 'VIP' | 'Internal';

export interface Customer {
  id: string;
  nama: string;
  noHp: string;
  kota: string;
  tipe: CustomerCategory | 'Retail';
  kategoriManual?: 'Umum' | 'Reseller' | 'Marketplace' | 'VIP' | 'Internal';
  alamat?: string;
  email?: string;
  catatan?: string;
  diskonKhusus?: number;
  resellerIdRef?: string;
}

export type PaymentStatus = 'lunas' | 'piutang' | 'sebagian';
export type OrderStatus = 'selesai' | 'diproses' | 'batal' | 'menunggu_approval_batal';

export interface OrderItem {
  sku: string;
  namaProduk: string;
  size: ApparelSize;
  colorName: string;
  qty: number;
  hargaSatuan: number;
  hppSatuan: number; // Frozen at transaction time
  subtotal: number;
}

export interface OrderPayment {
  id: string;
  orderId: string;
  tanggal: string;
  jumlah: number;
  metode: 'Transfer BCA' | 'Transfer Mandiri' | 'QRIS' | 'COD' | 'Marketplace Saldo' | 'Cash';
  catatan?: string;
}

export interface Order {
  id: string;
  noOrder: string; // e.g. KLM-202609-001
  tanggal: string; // YYYY-MM-DD
  channel: SalesChannelName;
  customerId: string;
  customerNama: string;
  customerHp: string;
  customerKota: string;
  noResi?: string;
  items: OrderItem[];
  subtotal: number;
  diskon: number;
  ongkir: number;
  adminFeeAmount: number; // Potongan admin marketplace
  totalTagihan: number; // subtotal - diskon + ongkir
  totalHpp: number; // sum(item.qty * item.hppSatuan)
  labaKotor: number; // (subtotal - diskon) - totalHpp - adminFeeAmount
  statusOrder: OrderStatus;
  statusBayar: PaymentStatus;
  totalTerbayar: number;
  sisaPiutang: number;
  jatuhTempo?: string; // YYYY-MM-DD
  catatan?: string;
  createdBy: string;
  cancellationReason?: string;
  cancellationRequestedBy?: string;
}

export type StockMovementType = 
  | 'masuk' // barang masuk dari konveksi
  | 'jual' // transaksi penjualan
  | 'retur_jual' // customer retur barang
  | 'reject' // barang cacat/rusak
  | 'opname' // penyesuaian stok opname fisik
  | 'titip' // kirim titipan ke reseller (out dari gudang utama, in ke lokasi reseller)
  | 'laku_titip' // laporan laku titipan (terjual dari stok reseller)
  | 'retur_titip'; // titipan kembali dari reseller ke gudang

export interface StockMovement {
  id: string;
  tanggal: string;
  sku: string;
  tipe: StockMovementType;
  qty: number; // positive = stock in, negative = stock out
  lokasi: string; // 'Gudang Utama' or 'Reseller: [Nama Reseller]'
  referensi: string; // e.g. "Order #KLM-202609-001" or "Surat Titip #ST-01"
  catatan?: string;
  recordedBy: string;
}

export interface Reseller {
  id: string;
  nama: string;
  kontakPerson?: string;
  noHp: string;
  kota: string;
  level?: 'Platinum' | 'Gold' | 'Silver';
  diskonPersen?: number; // % potongan dari harga retail
  komisiPercent?: number;
  jadwalSetoran?: string; // e.g. "Setiap Senin", "Tiap Akhir Bulan"
  batasPlafonTitipan?: number; // Max value dalam rupiah
  alamat: string;
}

export interface SuratTitipItem {
  sku: string;
  namaProduk: string;
  qty: number;
  hargaTitip: number;
}

export interface SuratTitip {
  id: string;
  noSurat: string; // e.g. SJ-TITIP-202609-001
  tanggal: string;
  resellerId: string;
  resellerNama: string;
  items: SuratTitipItem[];
  totalQty: number;
  totalNilai: number;
  catatan?: string;
  status: 'dikirim' | 'diterima' | 'selesai';
}

export interface LaporanTitipLaku {
  id: string;
  noLaporan: string;
  tanggal: string;
  periode: string;
  resellerId: string;
  resellerNama: string;
  items: { sku: string; namaProduk: string; qty: number; hargaTitip: number; subtotal: number }[];
  totalTagihan: number;
  statusBayar: PaymentStatus;
  terbayar: number;
  orderIdRef?: string;
}

export interface ReturTitip {
  id: string;
  tanggal: string;
  resellerId: string;
  resellerNama: string;
  items: { sku: string; namaProduk: string; qty: number; kondisi: 'baik_ke_gudang' | 'rusak_ke_reject' }[];
  alasan: string;
}

export interface SetoranReseller {
  id: string;
  tanggal: string;
  resellerId: string;
  resellerNama: string;
  jumlah: number;
  metode: string;
  laporanIdRef?: string;
  catatan?: string;
}

export type OpexCategory =
  | 'Marketing & Ads'
  | 'Gaji, Upah & Training'
  | 'Entertainment & Jamuan'
  | 'Packaging & Logistik'
  | 'Sewa & Utilitas'
  | 'Operasional, Software & Tools'
  | 'Pajak & Legalitas'
  | 'Lain-lain / Pengeluaran Umum'
  | string;

export interface BiayaOperasional {
  id: string;
  tanggal: string;
  kategori: OpexCategory;
  deskripsi: string;
  jumlah: number;
  dicatatOleh: string;
  accountId?: string;
  accountNama?: string;
}

export type CashAccountType = 'tunai' | 'bank' | 'e-wallet';

export interface CashAccount {
  id: string;
  nama: string; // e.g. "Kas Tunai Toko & Kasir", "Bank BCA Bisnis"
  tipe: CashAccountType;
  nomorRekening?: string;
  atasNama?: string;
  saldoAwal: number;
  saldo: number;
  warna?: string; // 'emerald' | 'blue' | 'amber' | 'teal' | 'purple' | 'rose'
  isDefault?: boolean;
  keterangan?: string;
}

export type CashMutationType = 'masuk' | 'keluar' | 'transfer';

export interface CashMutation {
  id: string;
  tanggal: string; // YYYY-MM-DD
  waktu?: string; // HH:mm
  accountId: string;
  accountNama: string;
  tipe: CashMutationType;
  jumlah: number;
  kategori: string;
  deskripsi: string;
  referensi?: string;
  targetAccountId?: string;
  targetAccountNama?: string;
  saldoSetelah: number;
  dicatatOleh: string;
  isReconciled?: boolean;
  reconciledSessionId?: string;
  reconciledAt?: string;
}

export interface BankReconciliationSession {
  id: string;
  noRekonsiliasi: string; // e.g. "REK-BCA-202609-001"
  accountId: string;
  accountNama: string;
  periodeAwal: string;
  periodeAkhir: string;
  tanggalRekonsiliasi: string;
  saldoAwalBuku: number;
  saldoAkhirBuku: number;
  saldoRekeningKoranBank: number;
  selisih: number; // saldoAkhirBuku - saldoRekeningKoranBank
  status: 'seimbang' | 'ada_selisih';
  totalMasukTerekonsiliasi: number;
  totalKeluarTerekonsiliasi: number;
  totalItemTerekonsiliasi: number;
  matchedMutationIds: string[];
  catatan?: string;
  dicatatOleh: string;
  createdAt: string;
}

export interface StockOpnameItem {
  sku: string;
  namaProduk: string;
  systemQty: number;
  physicalQty: number;
  selisihQty: number; // physicalQty - systemQty
  hppSatuan: number;
  selisihNominal: number; // selisihQty * hppSatuan
  alasan?: string;
}

export interface StockOpnameSession {
  id: string;
  nomorSesi: string; // e.g. "SO-202609-001"
  tanggal: string; // YYYY-MM-DD
  judul: string; // e.g. "Stok Opname Rutin Akhir Bulan September 2026"
  kategoriFilter?: string; // e.g. "Semua Lini", "210OV", etc.
  lokasi: string; // e.g. "Gudang Utama"
  items: StockOpnameItem[];
  totalItemChecked: number;
  totalMatch: number;
  totalSurplus: number;
  totalDeficit: number;
  netSelisihQty: number;
  netSelisihNominal: number;
  alasanGlobal: string;
  petugas: string;
  userRole: UserRole;
  status: 'selesai';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  action: string;
  module: 'Penjualan' | 'Inventori' | 'Reseller' | 'Master Data' | 'Keuangan' | 'Auth' | 'Pengadaan';
  detail: string;
}

export type VendorCategory =
  | 'Bahan Kaos Polos'
  | 'Konveksi & CMT'
  | 'Aksesoris & Packaging'
  | 'Sablon & Bordir'
  | 'Lainnya';

export interface Vendor {
  id: string;
  nama: string;
  kontakPerson?: string;
  noHp: string;
  email?: string;
  kota: string;
  alamat: string;
  kategori: VendorCategory;
  rekeningBank?: string; // e.g. "BCA 1234567890 a.n. PT Sinar Tekstil"
  catatan?: string;
  rating?: number; // 1-5
  totalPO?: number;
  totalBelanja?: number;
}

export type PurchaseOrderStatus =
  | 'draft' // Draft Purchase Order
  | 'dipesan' // PO telah dikirim & diproses vendor / produksi
  | 'dikirim' // In-Transit / Dikirim oleh vendor via kargo
  | 'diterima_sebagian' // Barang tiba sebagian di gudang
  | 'diterima' // Selesai diterima & stok masuk ke gudang
  | 'batal'; // Dibatalkan

export type PurchasePaymentStatus = 'belum_bayar' | 'dp' | 'lunas';

export interface PurchaseOrderItem {
  sku: string;
  namaProduk: string;
  size: ApparelSize;
  colorName: string;
  qtyPesan: number;
  qtyDiterima: number;
  hargaBeliSatuan: number;
  subtotal: number;
  catatan?: string;
}

export interface PurchaseOrder {
  id: string;
  noPO: string; // e.g. "PO-KLM-202609-001"
  tanggalPO: string; // YYYY-MM-DD
  vendorId: string;
  vendorNama: string;
  vendorHp: string;
  vendorKota: string;
  vendorAlamat?: string;
  items: PurchaseOrderItem[];
  totalQtyPesan: number;
  totalQtyDiterima: number;
  totalBiayaBahan: number;
  biayaEkspedisi: number;
  biayaTambahan: number;
  totalTagihan: number; // totalBiayaBahan + biayaEkspedisi + biayaTambahan
  statusPO: PurchaseOrderStatus;
  statusBayar: PurchasePaymentStatus;
  jumlahTerbayar: number;
  sisaHutang: number;
  jatuhTempoBayar?: string;
  accountId?: string;
  accountNama?: string;
  
  // Shipping & In-Transit Tracking
  ekspedisi?: string; // e.g. "Dakota Cargo", "Indah Kargo", "JNE Trucking", "Baraka", "Kurir Pabrik"
  noResi?: string;
  tanggalKirim?: string;
  estimasiTiba?: string;
  alamatTujuanGudang?: string;
  catatanPengiriman?: string;

  // Receiving & Inbound Stock In
  tanggalDiterima?: string;
  penerimaGudang?: string;
  kondisiPenerimaan?: 'lengkap_sempurna' | 'ada_reject' | 'selisih_kurang' | 'kelebihan_qc';
  catatanPenerimaan?: string;
  gudangTujuan: string; // Default: "Gudang Utama"
  
  catatanPO?: string;
  createdBy: string;
  createdAt: string;
}

// ==========================================
// NERACA KEUANGAN (BALANCE SHEET)
// ==========================================
export type FixedAssetCategory =
  | 'Peralatan & Mesin Produksi'
  | 'Rak Pergudangan & Display'
  | 'Inventaris & Elektronik Kantor'
  | 'Kendaraan Operasional'
  | 'Lainnya';

export interface FixedAssetItem {
  id: string;
  nama: string;
  kategori: FixedAssetCategory;
  tanggalPerolehan: string;
  hargaPerolehan: number;
  umurEkonomisTahun: number;
  akumulasiPenyusutan: number;
  nilaiBuku: number;
  lokasi?: string;
  catatan?: string;
}

export interface BalanceSheetConfig {
  modalDisetorAwal: number;
  labaDitahanTahunLalu: number;
  privePemilik: number;
  uangMukaLainnya: number;
  hutangBiayaLainnya: number;
  lastUpdated?: string;
}

// ==========================================
// PENJURNALAN AKUNTANSI (DOUBLE-ENTRY JOURNAL)
// ==========================================
export type AccountCategory = 'Aset' | 'Kewajiban' | 'Ekuitas' | 'Pendapatan' | 'Beban';

export interface JournalLineItem {
  accountId?: string;
  accountCode: string; // e.g. '1-10100' (Kas/Bank), '2-10100' (Utang Dagang), etc.
  accountName: string; // e.g. 'Utang Dagang (Vendor)', 'Kas & Bank (BCA Bisnis)'
  category: AccountCategory;
  debit: number;
  kredit: number;
  memo?: string;
}

export type JournalEntryType =
  | 'pembayaran_utang_vendor'
  | 'pembelian_po_kredit'
  | 'penerimaan_piutang'
  | 'beban_operasional'
  | 'penjualan'
  | 'penyesuaian';

export interface JournalEntry {
  id: string;
  noJurnal: string; // e.g. "JU-202609-001"
  tanggal: string; // YYYY-MM-DD
  waktu?: string; // HH:mm
  tipe: JournalEntryType;
  referensi: string; // e.g. "PO-KLM-202609-001"
  keterangan: string;
  items: JournalLineItem[];
  totalDebit: number;
  totalKredit: number;
  isBalanced: boolean;
  dicatatOleh: string;
  createdAt: string;
}

export const getLocalDateString = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const orderSortComparator = (a: Order, b: Order): number => {
  // 1. Primary sort: tanggal descending (newest date first)
  const dateA = a.tanggal || '';
  const dateB = b.tanggal || '';
  const dateDiff = dateB.localeCompare(dateA);
  if (dateDiff !== 0) return dateDiff;

  // 2. Secondary sort: timestamp from id (e.g. ord-1791193653254)
  const extractTs = (id: string = ''): number => {
    const match = id.match(/\d{10,}/);
    return match ? Number(match[0]) : 0;
  };
  const tsA = extractTs(a.id);
  const tsB = extractTs(b.id);
  if (tsB !== tsA) return tsB - tsA;

  // 3. Tertiary sort: order number descending
  const numA = a.noOrder || '';
  const numB = b.noOrder || '';
  const numDiff = numB.localeCompare(numA);
  if (numDiff !== 0) return numDiff;

  return (b.id || '').localeCompare(a.id || '');
};



