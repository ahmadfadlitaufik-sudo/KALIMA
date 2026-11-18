import React, { useState, useRef } from 'react';
import { askConfirm, showNotice } from '../services/dialogStore';
import * as XLSX from 'xlsx';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowDownToLine,
  FileUp,
  ClipboardCheck,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PaymentStatus } from '../types';
import { backupSummary, parseAmount, skuRowProblem } from '../services/importChecks';

// Helper to normalize any date input (DD/MM/YYYY, DD-MM-YYYY, Excel serial, etc.) to YYYY-MM-DD
function normalizeDateToISO(raw: any): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const str = String(raw).trim();
  if (!str) return new Date().toISOString().split('T')[0];

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Excel serial number (e.g. 46300)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    if (!isNaN(date_info.getTime())) {
      return date_info.toISOString().split('T')[0];
    }
  }

  // DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fallback Date parser
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

const CARD = 'bg-white rounded-2xl border border-slate-200';
const INPUT = 'w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-slate-500';
const OUTLINE_BUTTON =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const PRIMARY_BUTTON =
  'segmented-pill-active inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const DANGER_BUTTON =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const todayStamp = () => new Date().toISOString().split('T')[0];

export const ImportExportView: React.FC = () => {
  const {
    orders,
    skus,
    stockMovements,
    customers,
    resellers,
    biayaOperasional,
    suratTitip,
    cashAccounts,
    cashMutations,
    series,
    vendors,
    purchaseOrders,
    stockOpnameSessions,
    bankReconciliations,
    importInitialData,
    clearBiayaOperasional,
    setCurrentView,
  } = useApp();

  const [importText, setImportText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [replaceExistingExpenses, setReplaceExistingExpenses] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  // Export to CSV helper
  const exportToCSV = (filename: string, rows: object[]) => {
    if (!rows || rows.length === 0) {
      void showNotice('Tidak ada data untuk diekspor.');
      return;
    }

    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      '\n' +
      rows
        .map((row: any) =>
          keys
            .map((k) => {
              let cell = row[k] === null || row[k] === undefined ? '' : row[k];
              if (typeof cell === 'object') {
                cell = JSON.stringify(cell);
              }
              cell = cell.toString().replace(/"/g, '""');
              if (cell.search(/("|,|\n)/g) >= 0) {
                cell = `"${cell}"`;
              }
              return cell;
            })
            .join(separator)
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [activeSubTab, setActiveSubTab] = useState<'csv_export' | 'templates' | 'import_tool'>('templates');
  const [importMode, setImportMode] = useState<'csv_sku' | 'csv_orders' | 'csv_stock' | 'csv_expenses' | 'full_json'>('csv_sku');

  // Helper unduh template CSV kosong siap isi
  const downloadTemplate = (type: 'sku' | 'orders' | 'stock' | 'reseller' | 'expenses') => {
    let filename = '';
    let header = '';

    if (type === 'sku') {
      filename = 'template-master-sku-kalima.csv';
      header = 'sku,name,seriesCode,colorCode,colorName,size,price,hpp,minStock';
    } else if (type === 'stock') {
      filename = 'template-saldo-awal-stok-kalima.csv';
      header = 'sku,qty,lokasi,catatan';
    } else if (type === 'orders') {
      filename = 'template-riwayat-order-kalima.csv';
      header = 'noOrder,tanggal,channel,customerNama,customerHp,customerKota,sku,qty,hargaSatuan,diskon,statusBayar,noResi';
    } else if (type === 'reseller') {
      filename = 'template-mitra-reseller-kalima.csv';
      header = 'nama,kontakPerson,noHp,kota,alamat,diskonPersen';
    } else if (type === 'expenses') {
      filename = 'template-biaya-pengeluaran-kalima.csv';
      header = 'tanggal,kategori,deskripsi,jumlah';
    }

    const content = `${header}\n`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parser CSV & TSV pintar: mendukung koma, titik-koma, dan TAB (saat copy-paste langsung range sel spreadsheet)
  const parseCSVToJSON = (text: string) => {
    const lines = text.trim().split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Deteksi separator: apakah menggunakan tab (\t), titik-koma (;), atau koma (,)
    const firstLine = lines[0];
    let separator = ',';
    if (firstLine.includes('\t')) {
      separator = '\t';
    } else if (firstLine.includes(';') && !firstLine.includes(',')) {
      separator = ';';
    }

    const headers = firstLine
      .split(separator)
      .map((h) => h.trim().replace(/^["']|["']$/g, ''));

    return lines.slice(1).map((line) => {
      const values: string[] = [];
      if (separator === '\t') {
        // Tab-separated dari Excel / Google Sheets copy-paste
        line.split('\t').forEach((val) => {
          values.push(val.trim().replace(/^["']|["']$/g, ''));
        });
      } else {
        // CSV parsing standar dengan handling quotes
        let inQuotes = false;
        let token = '';
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') {
            inQuotes = !inQuotes;
          } else if (c === separator && !inQuotes) {
            values.push(token.trim().replace(/^["']|["']$/g, ''));
            token = '';
          } else {
            token += c;
          }
        }
        values.push(token.trim().replace(/^["']|["']$/g, ''));
      }

      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] !== undefined ? values[idx] : '';
      });
      return row;
    });
  };

  // Helper deteksi otomatis mode impor berdasarkan baris header
  const detectModeFromContent = (content: string) => {
    const lowerFirstLine = content.split(/\r\n|\n/)[0]?.toLowerCase() || '';
    if (
      lowerFirstLine.includes('noorder') ||
      lowerFirstLine.includes('no_order') ||
      lowerFirstLine.includes('order_id') ||
      lowerFirstLine.includes('invoice') ||
      lowerFirstLine.includes('channel') ||
      lowerFirstLine.includes('hargasatuan') ||
      lowerFirstLine.includes('harga_satuan') ||
      lowerFirstLine.includes('customer') ||
      lowerFirstLine.includes('pelanggan')
    ) {
      setImportMode('csv_orders');
    } else if (
      lowerFirstLine.includes('biaya') ||
      lowerFirstLine.includes('pengeluaran') ||
      lowerFirstLine.includes('kategori') ||
      lowerFirstLine.includes('opex') ||
      lowerFirstLine.includes('expense') ||
      lowerFirstLine.includes('kode perkiraan') ||
      lowerFirstLine.includes('nama perkiraan') ||
      (lowerFirstLine.includes('debit') && lowerFirstLine.includes('kredit'))
    ) {
      setImportMode('csv_expenses');
    } else if (lowerFirstLine.includes('seriescode') || lowerFirstLine.includes('colorname')) {
      setImportMode('csv_sku');
    } else if (lowerFirstLine.includes('lokasi') || lowerFirstLine.includes('gudang')) {
      setImportMode('csv_stock');
    }
  };

  // Handler Upload File Excel (.xlsx, .xls) & CSV dengan deteksi otomatis tipe data
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const fileNameLower = file.name.toLowerCase();

    if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvContent = XLSX.utils.sheet_to_csv(worksheet);
          setImportText(csvContent);
          detectModeFromContent(csvContent);
          setImportStatus({
            success: true,
            message: `File Excel "${file.name}" berhasil dibaca! Mode impor otomatis disesuaikan. Silakan klik tombol "Proses & Simpan Data" di bawah.`,
          });
        } catch (err: any) {
          setImportStatus({
            success: false,
            message: `Gagal membaca file Excel: ${err?.message || 'Format workbook tidak dapat diproses'}.`,
          });
        }
      };
      reader.onerror = () => {
        setImportStatus({
          success: false,
          message: 'Gagal membuka file Excel dari perangkat Anda.',
        });
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setImportText(content);
          detectModeFromContent(content);
          setImportStatus({
            success: true,
            message: `File "${file.name}" berhasil dimuat! Mode impor disesuaikan. Silakan klik tombol "Proses & Simpan Data" di bawah.`,
          });
        }
      };
      reader.onerror = () => {
        setImportStatus({
          success: false,
          message: 'Gagal membaca file CSV. Pastikan file berformat teks .csv valid.',
        });
      };
      reader.readAsText(file);
    }
  };

  // Helper ekstraksi kolom dengan pencocokan nama fleksibel (case-insensitive & spasi/underscore)
  const getCol = (row: Record<string, any>, possibleKeys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const key of possibleKeys) {
      // Direct match
      if (row[key] !== undefined && row[key] !== '') return row[key];
      // Normalized match (hilangkan spasi, underscore, strip, lower-case)
      const normKey = key.toLowerCase().replace(/[\s_\-]/g, '');
      const found = rowKeys.find(
        (rk) => rk.toLowerCase().replace(/[\s_\-]/g, '') === normKey
      );
      if (found && row[found] !== undefined && row[found] !== '') {
        return row[found];
      }
    }
    return '';
  };

  const handleProcessImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportStatus(null);
    if (!importText.trim()) return;

    try {
      if (importMode === 'full_json') {
        const parsed = JSON.parse(importText);
        const summary = backupSummary(parsed);
        if (summary.length === 0) {
          setImportStatus({ success: false, message: 'Teks ini bukan file backup Kalima (tidak ada data SKU, order, stok, dan sejenisnya).' });
          return;
        }
        const contents = summary.map((item) => `${item.label} ${item.count.toLocaleString('id-ID')}`).join(', ');
        const confirmed = await askConfirm(
          `Data berikut akan MENGGANTI data yang sekarang ada di aplikasi: ${contents}. Data yang tidak ada di backup tidak berubah. Langkah ini tidak bisa dibatalkan; unduh backup data saat ini lebih dulu bila ragu.`,
          { title: 'Pulihkan dari backup?', confirmLabel: 'Ya, ganti data', danger: true },
        );
        if (!confirmed) {
          return;
        }
        importInitialData(parsed);
        setImportStatus({
          success: true,
          message: `Data dipulihkan dari backup: ${contents}.`,
        });
        setImportText('');
        return;
      }

      const rows = parseCSVToJSON(importText);
      if (rows.length === 0) {
        setImportStatus({
          success: false,
          message: 'Gagal membaca data. Pastikan baris pertama adalah judul kolom (header) dan baris berikutnya data.',
        });
        return;
      }

      if (importMode === 'csv_sku') {
        const skipped: string[] = [];
        const newSkus = rows.flatMap((r, i) => {
          const skuCode = String(getCol(r, ['sku', 'kode_sku', 'kodesku', 'kode', 'item_code', 'itemcode', 'barcode']) || '').trim();
          const name = String(getCol(r, ['name', 'nama', 'namaproduk', 'nama_produk', 'produk', 'artikel', 'article', 'deskripsi', 'description', 'title', 'nama_barang']) || '').trim();
          const price = parseAmount(getCol(r, ['price', 'harga', 'hargajual', 'harga_jual', 'hargasatuan']));
          const hpp = parseAmount(getCol(r, ['hpp', 'harga_pokok', 'hargapokok', 'biaya', 'modal']));
          const problem = skuRowProblem({ sku: skuCode, name, price, hpp });
          if (problem) {
            skipped.push(`baris ${i + 2}: ${problem}`);
            return [];
          }
          const seriesCode = String(getCol(r, ['seriesCode', 'seri', 'series', 'kategori', 'category']) || '').trim() || 'ACC';
          const colorName = String(getCol(r, ['colorName', 'warna', 'color']) || '').trim();
          return [
            {
              sku: skuCode,
              seriesId: `ser-${seriesCode}`,
              seriesCode,
              colorCode: String(getCol(r, ['colorCode', 'kode_warna', 'warnaCode']) || '').trim(),
              colorName,
              size: (String(getCol(r, ['size', 'ukuran']) || '').trim() || 'ALL') as any,
              name,
              price: price as number,
              hpp: hpp as number,
              minStock: parseAmount(getCol(r, ['minStock', 'min_stock', 'stokmin', 'minimum_stok'])) ?? 0,
              active: true,
            },
          ];
        });
        if (newSkus.length === 0) {
          setImportStatus({ success: false, message: `Tidak ada baris SKU yang lengkap. ${skipped.slice(0, 5).join('; ')}` });
          return;
        }

        // Gabungkan SKU baru dengan SKU lama tanpa duplikat
        const existingMap = new Map(skus.map((s) => [s.sku, s]));
        newSkus.forEach((item) => {
          existingMap.set(item.sku, item);
        });
        const mergedSkus = Array.from(existingMap.values());

        importInitialData({ skus: mergedSkus });
        setImportStatus({
          success: true,
          message: `${newSkus.length} SKU disimpan (total ${mergedSkus.length} SKU).${
            skipped.length ? ` ${skipped.length} baris dilewati karena tidak lengkap: ${skipped.slice(0, 5).join('; ')}${skipped.length > 5 ? '; …' : ''}.` : ''
          }`,
        });
        setImportText('');
      } else if (importMode === 'csv_stock') {
        const movements = rows.map((r, i) => {
          const skuCode = getCol(r, ['sku', 'kode_sku', 'kodesku']);
          const qty = Number(getCol(r, ['qty', 'jumlah', 'stok', 'kuantiti'])) || 0;
          const lokasi = getCol(r, ['lokasi', 'gudang', 'warehouse']) || 'Gudang Utama';
          const catatan = getCol(r, ['catatan', 'keterangan', 'notes']) || 'Saldo awal dari migrasi spreadsheet';

          return {
            id: `mv-migrasi-${Date.now()}-${i}`,
            tanggal: new Date().toISOString().split('T')[0],
            sku: skuCode,
            tipe: 'masuk' as const,
            qty: qty,
            lokasi: lokasi,
            referensi: 'MIGRASI-EXCEL-AWAL',
            catatan: catatan,
            recordedBy: 'Owner (Migrasi)',
          };
        });

        // Filter hanya yang memiliki SKU valid
        const validMovements = movements.filter((m) => Boolean(m.sku));
        if (validMovements.length === 0) {
          setImportStatus({
            success: false,
            message: 'Kolom "sku" tidak ditemukan atau kosong. Pastikan kolom SKU ada di file Anda.',
          });
          return;
        }

        importInitialData({ stockMovements: [...stockMovements, ...validMovements] });
        setImportStatus({
          success: true,
          message: `Berhasil menambahkan ${validMovements.length} transaksi saldo awal ke kartu stok!`,
        });
        setImportText('');
      } else if (importMode === 'csv_orders') {
        // Kelompokkan baris berdasarkan noOrder agar 1 order dengan beberapa item SKU bisa digabung
        const orderGroups = new Map<string, any[]>();

        rows.forEach((r, idx) => {
          const noOrder = getCol(r, ['noOrder', 'no_order', 'order_id', 'nomororder', 'invoice']) || `ORD-MIG-${Date.now()}-${idx + 1}`;
          if (!orderGroups.has(noOrder)) {
            orderGroups.set(noOrder, []);
          }
          orderGroups.get(noOrder)!.push(r);
        });

        const newOrders: any[] = [];
        const additionalMovements: any[] = [];

        orderGroups.forEach((itemsInOrder, noOrder) => {
          const firstRow = itemsInOrder[0];
          const rawDate = getCol(firstRow, ['tanggal', 'date', 'tgl', 'waktu', 'order_date', 'created_at', 'invoice_date']);
          const normalizedDate = normalizeDateToISO(rawDate);
          const channel = (getCol(firstRow, ['channel', 'sales_channel', 'kanal', 'marketplace']) || 'WhatsApp') as any;
          const customerNama = getCol(firstRow, ['customerNama', 'customer', 'nama_pelanggan', 'nama']) || 'Pelanggan Umum';
          const customerHp = getCol(firstRow, ['customerHp', 'no_hp', 'telepon', 'hp', 'wa', 'phone']) || '-';
          const customerKota = getCol(firstRow, ['customerKota', 'kota', 'city']) || '';
          const noResi = getCol(firstRow, ['noResi', 'resi', 'no_resi']) || '';
          const statusBayarRaw = (getCol(firstRow, ['statusBayar', 'status_bayar', 'pembayaran']) || 'lunas').toLowerCase();
          const statusBayar: PaymentStatus =
            statusBayarRaw.includes('belum') || statusBayarRaw.includes('piutang') || statusBayarRaw.includes('unpaid')
              ? 'piutang'
              : statusBayarRaw.includes('sebagian') || statusBayarRaw.includes('dp')
              ? 'sebagian'
              : 'lunas';

          // Buat OrderItem untuk setiap baris SKU
          const parsedItems = itemsInOrder.map((row) => {
            const rawSku = getCol(row, ['sku', 'kode_sku', 'kodesku', 'produk', 'nama_produk']) || 'KL-210OV-HT-L';
            const cleanSku = rawSku.trim();
            const skuMeta = skus.find((s) => s.sku.toLowerCase() === cleanSku.toLowerCase());
            const qty = Number(getCol(row, ['qty', 'jumlah', 'pcs'])) || 1;
            const hargaSatuan = Number(getCol(row, ['hargaSatuan', 'harga_satuan', 'harga', 'price'])) || (skuMeta ? skuMeta.price : 100000);
            const hppSatuan = Number(getCol(row, ['hpp', 'hppSatuan', 'hpp_satuan'])) || (skuMeta ? skuMeta.hpp : 50000);

            // Deteksi ukuran dari SKU jika teks mengandung S/M/L/XL/XXL
            let detectedSize: any = skuMeta?.size || 'L';
            const upperSku = cleanSku.toUpperCase();
            if (upperSku.endsWith(' XXL') || upperSku.endsWith('-XXL') || upperSku.includes(' 2XL')) detectedSize = '2XL';
            else if (upperSku.endsWith(' XL') || upperSku.endsWith('-XL')) detectedSize = 'XL';
            else if (upperSku.endsWith(' L') || upperSku.endsWith('-L')) detectedSize = 'L';
            else if (upperSku.endsWith(' M') || upperSku.endsWith('-M')) detectedSize = 'M';
            else if (upperSku.endsWith(' S') || upperSku.endsWith('-S')) detectedSize = 'S';

            return {
              sku: cleanSku,
              namaProduk: skuMeta ? skuMeta.name : cleanSku,
              size: detectedSize,
              colorName: skuMeta ? skuMeta.colorName : 'Standar',
              qty,
              hargaSatuan,
              hppSatuan,
              subtotal: qty * hargaSatuan,
            };
          });

          const subtotal = parsedItems.reduce((acc, it) => acc + it.subtotal, 0);
          const diskon = Number(getCol(firstRow, ['diskon', 'discount', 'potongan'])) || 0;
          const ongkir = Number(getCol(firstRow, ['ongkir', 'ongkos_kirim'])) || 0;
          const adminFeeAmount = Number(getCol(firstRow, ['adminFee', 'admin_fee', 'biaya_admin'])) || 0;
          const totalTagihan = Math.max(0, subtotal - diskon + ongkir);
          const totalHpp = parsedItems.reduce((acc, it) => acc + (it.qty * it.hppSatuan), 0);
          const labaKotor = (subtotal - diskon) - totalHpp - adminFeeAmount;
          const totalTerbayar = statusBayar === 'lunas' ? totalTagihan : 0;
          const sisaPiutang = statusBayar === 'lunas' ? 0 : totalTagihan;

          const createdOrder = {
            id: `ord-mig-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            noOrder,
            tanggal: normalizedDate,
            channel,
            customerId: `cust-mig-${Date.now()}`,
            customerNama,
            customerHp,
            customerKota,
            noResi,
            items: parsedItems,
            subtotal,
            diskon,
            ongkir,
            adminFeeAmount,
            totalTagihan,
            totalHpp,
            labaKotor,
            statusOrder: 'selesai' as const,
            statusBayar,
            totalTerbayar,
            sisaPiutang,
            catatan: 'Riwayat order diimpor dari file spreadsheet',
            createdBy: 'Owner (Migrasi)',
          };

          newOrders.push(createdOrder);

          // Buat mutasi kartu stok keluar otomatis untuk setiap item
          parsedItems.forEach((it, itemIdx) => {
            additionalMovements.push({
              id: `mv-ord-${createdOrder.id}-${itemIdx}`,
              tanggal: normalizedDate,
              sku: it.sku,
              tipe: 'jual' as const,
              qty: -it.qty,
              lokasi: 'Gudang Utama',
              referensi: noOrder,
              catatan: `Penjualan ${channel} - ${customerNama}`,
              recordedBy: 'Owner (Migrasi)',
            });
          });
        });

        if (newOrders.length === 0) {
          setImportStatus({
            success: false,
            message: 'Tidak ada data order yang dapat diproses dari file.',
          });
          return;
        }

        // Simpan gabungan ke database orders dan stockMovements dengan urutan tanggal terbaru
        const updatedOrders = [...newOrders, ...orders].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
        const updatedMovements = [...additionalMovements, ...stockMovements].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

        importInitialData({
          orders: updatedOrders,
          stockMovements: updatedMovements,
        });

        setImportStatus({
          success: true,
          message: `Sukses! Berhasil mengimpor ${newOrders.length} transaksi order (${rows.length} baris produk) ke riwayat penjualan & memperbarui kartu stok!`,
        });
        setImportText('');
        setUploadedFileName(null);
      } else if (importMode === 'csv_expenses') {
        const rows = parseCSVToJSON(importText);
        if (rows.length === 0) {
          setImportStatus({
            success: false,
            message: 'Data kosong atau format CSV pengeluaran tidak terbaca.',
          });
          return;
        }

        const newExpenses: any[] = [];
        rows.forEach((r, idx) => {
          const rawDate = getCol(r, ['tanggal', 'date', 'tgl', 'waktu']) || new Date().toISOString().split('T')[0];
          const rawKode = String(getCol(r, ['kodeperkiraan', 'kode_perkiraan', 'kode', 'account_code', 'noakun'])).trim();
          const rawNamaPerkiraan = (getCol(r, ['namaperkiraan', 'nama_perkiraan', 'kategori', 'category', 'pos_biaya', 'jenis', 'tipe']) || '').trim();
          const rawDeskripsi = (getCol(r, ['deskripsi', 'keterangan', 'uraian', 'keperluan', 'catatan', 'nama', 'memo']) || '').trim();
          const tipeTransaksi = (getCol(r, ['tipetransaksi', 'tipe_transaksi', 'tipe']) || '').trim();

          // Jika format Jurnal Akuntansi (ada Debit / Kredit)
          const rawDebit = getCol(r, ['debit', 'debet']);
          const rawKredit = getCol(r, ['kredit', 'credit']);
          const rawJumlah = getCol(r, ['jumlah', 'nominal', 'biaya', 'pengeluaran', 'total', 'amount', 'harga']);

          let cleanJumlahStr = '';
          const isJournalFormat = rawDebit !== '' || rawKredit !== '' || rawKode !== '';

          if (isJournalFormat) {
            // Pada jurnal akuntansi, beban operasional tercatat di sisi DEBIT dengan kode akun kepala 6 atau nama mengandung "Beban"/"Biaya"
            const isExpenseAccount = rawKode.startsWith('6') || 
                                     rawKode.startsWith('510111') || // Biaya Ongkir Barang
                                     rawNamaPerkiraan.toLowerCase().includes('beban') || 
                                     rawNamaPerkiraan.toLowerCase().includes('biaya');
            
            // Lewati baris kredit jika ini akun beban atau akun kas lawan
            const debitNum = Number(String(rawDebit).replace(/,/g, '.').replace(/[^0-9.-]/g, '')) || 0;
            if (!isExpenseAccount || debitNum <= 0) {
              return; // Lewati baris non-beban atau kredit di jurnal
            }
            cleanJumlahStr = String(debitNum);
          } else {
            cleanJumlahStr = String(rawJumlah).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
          }

          const jumlah = Math.abs(Number(cleanJumlahStr)) || 0;
          if (jumlah <= 0) return;

          // Normalisasi kategori & deskripsi
          const combinedCategoryHint = `${rawNamaPerkiraan} ${rawKode} ${rawDeskripsi} ${tipeTransaksi}`.toLowerCase();
          let kategori: any = 'Lain-lain';

          if (
            combinedCategoryHint.includes('iklan') ||
            combinedCategoryHint.includes('marketing') ||
            combinedCategoryHint.includes('ads') ||
            combinedCategoryHint.includes('konten') ||
            combinedCategoryHint.includes('promosi') ||
            combinedCategoryHint.includes('endorse') ||
            combinedCategoryHint.includes('give away') ||
            combinedCategoryHint.includes('giveaway') ||
            combinedCategoryHint.includes('talent') ||
            combinedCategoryHint.includes('photoshoot') ||
            combinedCategoryHint.includes('merek')
          ) {
            kategori = 'Marketing & Ads';
          } else if (
            combinedCategoryHint.includes('gaji') ||
            combinedCategoryHint.includes('upah') ||
            combinedCategoryHint.includes('salary') ||
            combinedCategoryHint.includes('tunjangan') ||
            combinedCategoryHint.includes('tim')
          ) {
            kategori = 'Gaji Tim';
          } else if (
            combinedCategoryHint.includes('sewa') ||
            combinedCategoryHint.includes('studio') ||
            combinedCategoryHint.includes('gudang') ||
            combinedCategoryHint.includes('listrik') ||
            combinedCategoryHint.includes('wifi') ||
            combinedCategoryHint.includes('air') ||
            combinedCategoryHint.includes('utilitas')
          ) {
            kategori = 'Sewa & Utilitas';
          } else if (
            combinedCategoryHint.includes('packing') ||
            combinedCategoryHint.includes('packaging') ||
            combinedCategoryHint.includes('kardus') ||
            combinedCategoryHint.includes('plastik') ||
            combinedCategoryHint.includes('lakban') ||
            combinedCategoryHint.includes('polymailer') ||
            combinedCategoryHint.includes('hangtag') ||
            combinedCategoryHint.includes('label') ||
            combinedCategoryHint.includes('resi') ||
            combinedCategoryHint.includes('stiker')
          ) {
            kategori = 'Packaging';
          } else if (combinedCategoryHint.includes('operasional') || combinedCategoryHint.includes('ongkir') || combinedCategoryHint.includes('admin bank') || combinedCategoryHint.includes('accurate') || combinedCategoryHint.includes('pulsa') || combinedCategoryHint.includes('kuota')) {
            kategori = 'Operasional & Packing';
          }

          // Rangkai keterangan yang rapi & informatif
          let deskripsi = rawDeskripsi.replace(/^[✅🖊️❓\s]+/, '').trim();
          if (!deskripsi || deskripsi === 'DONE') {
            deskripsi = rawNamaPerkiraan || 'Beban Operasional';
          } else if (rawNamaPerkiraan && !deskripsi.toLowerCase().includes(rawNamaPerkiraan.toLowerCase())) {
            deskripsi = `${rawNamaPerkiraan}: ${deskripsi}`;
          }

          newExpenses.push({
            id: `bo-mig-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            tanggal: rawDate,
            kategori,
            deskripsi,
            jumlah: Math.round(jumlah),
            dicatatOleh: 'Owner (Jurnal Akuntansi)',
          });
        });

        if (newExpenses.length === 0) {
          setImportStatus({
            success: false,
            message: 'Tidak ada baris data pengeluaran valid yang dapat diproses.',
          });
          return;
        }

        // Simpan ke database biayaOperasional (timpa atau gabung)
        const finalExpenses = replaceExistingExpenses ? newExpenses : [...newExpenses, ...biayaOperasional];
        importInitialData({
          biayaOperasional: finalExpenses,
        });

        const totalNominal = newExpenses.reduce((acc, curr) => acc + curr.jumlah, 0);
        const importedMonths = Array.from(new Set(newExpenses.map((e) => e.tanggal.substring(0, 7)))).sort();

        setImportStatus({
          success: true,
          message: `Sukses! Berhasil mengimpor ${newExpenses.length} catatan pengeluaran (Total: Rp ${totalNominal.toLocaleString('id-ID')}) untuk periode ${importedMonths.join(', ')} ke Buku Kas & Laba Rugi! ${replaceExistingExpenses ? '(Data OPEX sebelumnya telah ditimpa/dibersihkan)' : ''}`,
        });
        setImportText('');
        setUploadedFileName(null);
      }
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `Error saat memproses data: ${err.message || 'Format tidak valid'}`,
      });
    }
  };

  const TEMPLATES: { type: 'sku' | 'stock' | 'orders' | 'reseller' | 'expenses'; title: string; purpose: string; columns: string }[] = [
    { type: 'sku', title: 'Master SKU & harga', purpose: 'Varian kaos, harga jual, dan HPP. Wajib: sku, name, price, hpp.', columns: 'sku, name, seriesCode, colorCode, colorName, size, price, hpp, minStock' },
    { type: 'stock', title: 'Saldo awal stok', purpose: 'Stok fisik saat pindah dari Excel.', columns: 'sku, qty, lokasi, catatan' },
    { type: 'orders', title: 'Riwayat order', purpose: 'Arsip penjualan lama.', columns: 'noOrder, tanggal, channel, customerNama, customerHp, customerKota, sku, qty, hargaSatuan, diskon, statusBayar, noResi' },
    { type: 'reseller', title: 'Mitra reseller', purpose: 'Toko titip jual.', columns: 'nama, kontakPerson, noHp, kota, alamat, diskonPersen' },
    { type: 'expenses', title: 'Biaya operasional', purpose: 'Kas keluar untuk laba rugi.', columns: 'tanggal, kategori, deskripsi, jumlah' },
  ];
  const EXPORTS: { title: string; count: string; run: () => void }[] = [
    {
      title: 'Penjualan',
      count: `${orders.length.toLocaleString('id-ID')} order`,
      run: () =>
        exportToCSV(
          `kalima-penjualan-${todayStamp()}.csv`,
          orders.map((o) => ({
            noOrder: o.noOrder,
            tanggal: o.tanggal,
            channel: o.channel,
            customerNama: o.customerNama,
            customerHp: o.customerHp,
            customerKota: o.customerKota,
            totalTagihan: o.totalTagihan,
            totalHpp: o.totalHpp,
            labaKotor: o.labaKotor,
            statusBayar: o.statusBayar,
            sisaPiutang: o.sisaPiutang,
            noResi: o.noResi || '',
          })),
        ),
    },
    {
      title: 'Kartu stok',
      count: `${stockMovements.length.toLocaleString('id-ID')} mutasi`,
      run: () =>
        exportToCSV(
          `kalima-mutasi-stok-${todayStamp()}.csv`,
          stockMovements.map((m) => ({
            id: m.id,
            tanggal: m.tanggal,
            sku: m.sku,
            tipe: m.tipe,
            qty: m.qty,
            lokasi: m.lokasi,
            referensi: m.referensi,
            catatan: m.catatan,
            operator: m.recordedBy,
          })),
        ),
    },
    {
      title: 'Master SKU',
      count: `${skus.length.toLocaleString('id-ID')} SKU`,
      run: () =>
        exportToCSV(
          `kalima-master-sku-${todayStamp()}.csv`,
          skus.map((s) => ({ sku: s.sku, seri: s.seriesCode, nama: s.name, warna: s.colorName, ukuran: s.size, hargaJual: s.price, hpp: s.hpp, minStock: s.minStock })),
        ),
    },
    {
      title: 'Buku kas',
      count: `${cashMutations.length.toLocaleString('id-ID')} mutasi`,
      run: () =>
        exportToCSV(
          `kalima-buku-kas-${todayStamp()}.csv`,
          cashMutations.map((m) => ({
            id: m.id,
            tanggal: m.tanggal,
            waktu: m.waktu || '',
            akun: m.accountNama,
            tipe: m.tipe.toUpperCase(),
            kategori: m.kategori,
            deskripsi: m.deskripsi,
            referensi: m.referensi || '',
            jumlah: m.jumlah,
            saldoSetelah: m.saldoSetelah,
            operator: m.dicatatOleh,
          })),
        ),
    },
  ];

  const handleFullBackup = () => {
    const backupData = {
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
      series,
      skus,
      orders,
      stockMovements,
      stockOpnameSessions,
      customers,
      resellers,
      suratTitip,
      vendors,
      purchaseOrders,
      biayaOperasional,
      cashAccounts,
      cashMutations,
      bankReconciliations,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kalima-backup-${todayStamp()}.json`;
    link.click();
  };

  const SUB_TABS: { id: typeof activeSubTab; label: string }[] = [
    { id: 'templates', label: 'Template' },
    { id: 'import_tool', label: 'Impor' },
    { id: 'csv_export', label: 'Ekspor & backup' },
  ];

  return (
    <div className="space-y-5 pb-12 max-w-5xl">
      <p className="text-xs text-slate-600">Pindahkan data dari Excel, unduh laporan ke CSV, atau simpan backup seluruh data.</p>

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeSubTab === tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
              activeSubTab === tab.id ? 'segmented-pill-active' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'templates' && (
        <div className="space-y-4">
          <div className={`${CARD} divide-y divide-slate-100`}>
            {TEMPLATES.map((t) => (
              <div key={t.type} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-bold text-slate-900">{t.title}</div>
                  <p className="text-slate-600">{t.purpose}</p>
                  <code className="block font-mono text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 break-words">{t.columns}</code>
                </div>
                <button type="button" onClick={() => downloadTemplate(t.type)} className={`${OUTLINE_BUTTON} shrink-0`}>
                  <Download className="w-3.5 h-3.5" /> Unduh template
                </button>
              </div>
            ))}
          </div>
          <div className={`${CARD} p-4 text-xs text-slate-600 space-y-1`}>
            <div className="font-semibold text-slate-900">Cara pakai</div>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Unduh template, buka di Excel atau Google Sheets, lalu isi mulai baris kedua.</li>
              <li>Simpan sebagai CSV, atau langsung salin selnya.</li>
              <li>Buka tab Impor, pilih jenis data, lalu unggah file atau tempel isinya.</li>
            </ol>
          </div>
        </div>
      )}

      {activeSubTab === 'import_tool' && (
        <div className={`${CARD} p-5 space-y-4 text-xs`}>
          <label className="block max-w-sm">
            <span className="block text-slate-600 font-semibold mb-1">Jenis data</span>
            <select
              value={importMode}
              onChange={(e) => {
                setImportMode(e.target.value as any);
                setUploadedFileName(null);
                setImportText('');
                setImportStatus(null);
              }}
              className={INPUT}
            >
              <option value="csv_sku">Master SKU</option>
              <option value="csv_stock">Saldo awal stok</option>
              <option value="csv_orders">Riwayat order</option>
              <option value="csv_expenses">Biaya operasional</option>
              <option value="full_json">Pulihkan dari backup (JSON)</option>
            </select>
          </label>

          {importMode === 'full_json' && (
            <div role="note" className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Memulihkan backup mengganti data yang sekarang. Sebelum disimpan, isi backup ditampilkan untuk dikonfirmasi.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-5 border-2 border-dashed border-slate-300 hover:border-slate-500 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer"
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.txt,.json" onChange={handleFileUpload} className="hidden" />
              <FileUp className="w-5 h-5 text-slate-600 mb-2" aria-hidden="true" />
              <span className="font-semibold text-slate-900">{uploadedFileName ? uploadedFileName : 'Pilih file Excel atau CSV'}</span>
              <span className="text-slate-500 mt-1">{uploadedFileName ? 'Isi file tampil di kotak di bawah' : '.xlsx, .xls, .csv'}</span>
            </button>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4" aria-hidden="true" /> Atau salin dari spreadsheet
              </div>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Blok baris judul beserta datanya.</li>
                <li>Salin (Ctrl/Cmd + C).</li>
                <li>Tempel di kotak di bawah (Ctrl/Cmd + V).</li>
              </ol>
            </div>
          </div>

          {importStatus && (
            <div
              role={importStatus.success ? 'status' : 'alert'}
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                importStatus.success ? 'bg-white border-slate-200 text-slate-900' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-start gap-2">
                {importStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{importStatus.message}</span>
              </div>
              {importStatus.success && importMode === 'csv_orders' && (
                <button type="button" onClick={() => setCurrentView('sales')} className={`${OUTLINE_BUTTON} shrink-0`}>
                  Buka Penjualan
                </button>
              )}
              {importStatus.success && importMode === 'csv_expenses' && (
                <button type="button" onClick={() => setCurrentView('finance')} className={`${OUTLINE_BUTTON} shrink-0`}>
                  Buka Keuangan
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleProcessImport} className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="import-text" className="font-semibold text-slate-600">
                Isi data
              </label>
              {importText && (
                <button
                  type="button"
                  onClick={() => {
                    setImportText('');
                    setUploadedFileName(null);
                  }}
                  className="text-slate-600 font-semibold hover:underline cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>
            <textarea
              id="import-text"
              rows={7}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={importMode === 'full_json' ? 'Tempel isi file backup JSON di sini…' : 'Tempel baris judul dan data dari spreadsheet di sini…'}
              className={`${INPUT} font-mono text-xs`}
            />

            {importMode === 'csv_expenses' && (
              <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                <input type="checkbox" checked={replaceExistingExpenses} onChange={(e) => setReplaceExistingExpenses(e.target.checked)} className="w-4 h-4 mt-0.5 rounded" />
                <span>
                  <span className="font-semibold">Ganti biaya operasional yang sudah ada</span>
                  <span className="block text-slate-500">
                    {biayaOperasional.length.toLocaleString('id-ID')} catatan lama dihapus lalu diganti isi impor ini. Biarkan kosong untuk menambahkan saja.
                  </span>
                </span>
              </label>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={!importText.trim()} className={importMode === 'full_json' ? DANGER_BUTTON : PRIMARY_BUTTON}>
                {importMode === 'full_json' ? 'Periksa & pulihkan' : 'Impor data'}
              </button>
            </div>
          </form>

          {importMode === 'csv_expenses' && biayaOperasional.length > 0 && (
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-slate-600">Hapus semua {biayaOperasional.length.toLocaleString('id-ID')} catatan biaya operasional tanpa mengimpor apa pun.</span>
              <button
                type="button"
                onClick={async () => {
                  if (
                    await askConfirm(`${biayaOperasional.length} catatan biaya operasional dihapus permanen dan laba rugi ikut berubah.`, {
                      title: 'Hapus semua biaya operasional?',
                      confirmLabel: 'Ya, hapus',
                      danger: true,
                    })
                  ) {
                    clearBiayaOperasional();
                    setImportStatus({ success: true, message: 'Semua biaya operasional dihapus.' });
                  }
                }}
                className={`${OUTLINE_BUTTON} text-rose-700 shrink-0`}
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus semua biaya
              </button>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'csv_export' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {EXPORTS.map((item) => (
              <button key={item.title} type="button" onClick={item.run} className={`${CARD} p-4 text-left flex items-center justify-between gap-2 hover:border-slate-400 cursor-pointer`}>
                <span>
                  <span className="block text-xs font-bold text-slate-900">{item.title}</span>
                  <span className="block text-xs text-slate-500">{item.count}</span>
                </span>
                <ArrowDownToLine className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className={`${CARD} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs`}>
            <div>
              <div className="text-sm font-bold text-slate-900">Backup seluruh data</div>
              <p className="text-slate-600 mt-0.5">Satu file JSON berisi SKU, order, stok, opname, pelanggan, reseller, vendor, PO, kas, dan biaya. Simpan di tempat aman.</p>
            </div>
            <button type="button" onClick={handleFullBackup} className={`${PRIMARY_BUTTON} shrink-0`}>
              <Download className="w-3.5 h-3.5" /> Unduh backup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
