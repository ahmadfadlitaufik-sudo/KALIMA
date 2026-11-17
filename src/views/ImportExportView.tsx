import React, { useState, useRef } from 'react';
import { askConfirm, showNotice } from '../services/dialogStore';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowDownToLine,
  FileCode,
  FileUp,
  ClipboardCheck,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PaymentStatus } from '../types';

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
    let sampleRow = '';

    if (type === 'sku') {
      filename = 'template-master-sku-kalima.csv';
      header = 'sku,name,seriesCode,colorCode,colorName,size,price,hpp,minStock';
      sampleRow = 'KL-210OV-HT-M,Kalima 210 GSM Oversize - Hitam (M),210OV,HT,Hitam,M,129000,50000,10\nKL-210OV-HT-L,Kalima 210 GSM Oversize - Hitam (L),210OV,HT,Hitam,L,129000,50000,15\nKL-235CL-PT-XL,Kalima 235 GSM Classic - Putih (XL),235CL,PT,Putih,XL,139000,53000,10\nGB-CANVAS-01,Goodie Bag Kalima Canvas Hitam,ACC,HT,Hitam,ALL,25000,12000,20';
    } else if (type === 'stock') {
      filename = 'template-saldo-awal-stok-kalima.csv';
      header = 'sku,qty,lokasi,catatan';
      sampleRow = 'KL-210OV-HT-M,40,Gudang Utama,Saldo Awal Migrasi Excel\nKL-210OV-HT-L,35,Gudang Utama,Saldo Awal Migrasi Excel\nKL-235CL-PT-XL,25,Gudang Utama,Saldo Awal Migrasi Excel';
    } else if (type === 'orders') {
      filename = 'template-riwayat-order-kalima.csv';
      header = 'noOrder,tanggal,channel,customerNama,customerHp,customerKota,sku,qty,hargaSatuan,diskon,statusBayar,noResi';
      sampleRow = 'ORD-20260901-001,2026-09-01,Shopee,Budi Santoso,08123456789,Bandung,KL-210OV-HT-L,2,129000,0,lunas,SPXID029481920\nORD-20260902-002,2026-09-02,TAPADA,Aditya Pratama,08198765432,Jakarta,KL-235CL-PT-XL,1,139000,5000,lunas,';
    } else if (type === 'reseller') {
      filename = 'template-mitra-reseller-kalima.csv';
      header = 'nama,kontakPerson,noHp,kota,alamat,diskonPersen';
      sampleRow = 'Distro Brotherhood,Rian,081234567890,Bandung,Jl. Trunojoyo No. 12,20\nUrban Streetwear,Dimas,082133445566,Surabaya,Jl. Tunjungan No. 45,20';
    } else if (type === 'expenses') {
      filename = 'template-biaya-pengeluaran-kalima.csv';
      header = 'tanggal,kategori,deskripsi,jumlah';
      sampleRow = '2026-09-05,Marketing & Ads,Iklan Meta Ads & TikTok Campaign,1500000\n2026-09-10,Packaging,Plastik Polymailer & Hangtag 1000 pcs,450000\n2026-09-25,Gaji Tim,Gaji Staff Packing & Admin CS,3200000';
    }

    const content = `${header}\n${sampleRow}`;
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

  const handleProcessImport = (e: React.FormEvent) => {
    e.preventDefault();
    setImportStatus(null);
    if (!importText.trim()) return;

    try {
      if (importMode === 'full_json') {
        const parsed = JSON.parse(importText);
        importInitialData(parsed);
        setImportStatus({
          success: true,
          message: 'Berhasil mengimpor seluruh snapshot database Kalima!',
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
        const newSkus = rows.map((r, i) => {
          const skuCode = getCol(r, ['sku', 'kode_sku', 'kodesku', 'kode', 'item_code', 'itemcode', 'barcode']) || `KL-SKU-${i + 1}`;
          const customName = getCol(r, ['name', 'nama', 'namaproduk', 'nama_produk', 'produk', 'artikel', 'article', 'deskripsi', 'description', 'title', 'nama_barang']);
          const seriesCode = getCol(r, ['seriesCode', 'seri', 'series', 'kategori', 'category']) || (skuCode.includes('210') ? '210OV' : skuCode.includes('290') ? '290OV' : skuCode.includes('185') ? '185RG' : 'ACC');
          const colorCode = getCol(r, ['colorCode', 'kode_warna', 'warnaCode']) || 'STD';
          const colorName = getCol(r, ['colorName', 'warna', 'color']) || (customName ? '' : 'Hitam');
          const size = (getCol(r, ['size', 'ukuran']) || 'L') as any;
          const price = Number(String(getCol(r, ['price', 'harga', 'hargajual', 'harga_jual', 'hargasatuan'])).replace(/[^0-9.-]+/g, '')) || 129000;
          const hpp = Number(String(getCol(r, ['hpp', 'harga_pokok', 'hargapokok', 'biaya', 'modal'])).replace(/[^0-9.-]+/g, '')) || 50000;
          const minStock = Number(String(getCol(r, ['minStock', 'min_stock', 'stokmin', 'minimum_stok'])).replace(/[^0-9.-]+/g, '')) || 10;

          const resolvedName = customName || `Kalima ${seriesCode} ${colorName ? `- ${colorName}` : ''} (${size})`;

          return {
            sku: skuCode,
            seriesId: `ser-${seriesCode}`,
            seriesCode,
            colorCode,
            colorName: colorName || 'Standard',
            size,
            name: resolvedName,
            price,
            hpp,
            minStock,
            active: true,
          };
        });

        // Gabungkan SKU baru dengan SKU lama tanpa duplikat
        const existingMap = new Map(skus.map((s) => [s.sku, s]));
        newSkus.forEach((item) => {
          existingMap.set(item.sku, item);
        });
        const mergedSkus = Array.from(existingMap.values());

        importInitialData({ skus: mergedSkus });
        setImportStatus({
          success: true,
          message: `Berhasil mengimpor & memperbarui ${newSkus.length} master SKU ke sistem! (Total terdaftar: ${mergedSkus.length} SKU)`,
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
          const customerKota = getCol(firstRow, ['customerKota', 'kota', 'city']) || 'Kota Asal';
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

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      <div className="bg-[#121620] p-6 rounded-2xl border border-slate-800/80 space-y-2">
        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-amber-400" />
          Pusat Integrasi & Migrasi Data Excel (Kalima Apparel)
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Gunakan halaman ini untuk mencocokkan format kolom Excel lama Anda, mengunduh template CSV siap isi, mengimpor master SKU / saldo stok awal, atau mengekspor laporan transaksi.
        </p>

        {/* Sub Navigation */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
          <button
            onClick={() => setActiveSubTab('templates')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'templates'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            1. Format & Template Excel (CSV)
          </button>
          <button
            onClick={() => setActiveSubTab('import_tool')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'import_tool'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            2. Impor Data ke Sistem
          </button>
          <button
            onClick={() => setActiveSubTab('csv_export')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'csv_export'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            3. Ekspor Data (.CSV / JSON)
          </button>
        </div>
      </div>

      {/* SUBTAB 1: FORMAT & TEMPLATE EXCEL */}
      {activeSubTab === 'templates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Template Master SKU */}
            <div className="bg-[#121620] p-5 rounded-2xl border border-slate-800/80 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">1. Master SKU & Harga</h4>
                  <p className="text-xs text-slate-400">Untuk katalog varian kaos, harga jual & HPP</p>
                </div>
                <button
                  onClick={() => downloadTemplate('sku')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh .CSV</span>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs font-mono text-slate-300 overflow-x-auto">
                <div className="text-amber-400 font-bold mb-1">Header Kolom Excel:</div>
                <div className="text-slate-200">sku, name, seriesCode, colorCode, colorName, size, price, hpp, minStock</div>
                <div className="text-slate-500 mt-1">Contoh data:</div>
                <div className="text-slate-400">KL-210OV-HT-M, Kalima 210 GSM - Hitam (M), 210OV, HT, Hitam, M, 129000, 50000, 10</div>
                <div className="text-slate-400">GB-CANVAS-01, Goodie Bag Kalima Canvas Hitam, ACC, HT, Hitam, ALL, 25000, 12000, 20</div>
              </div>
            </div>

            {/* Template Saldo Awal Stok */}
            <div className="bg-[#121620] p-5 rounded-2xl border border-slate-800/80 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">2. Saldo Awal Stok Gudang</h4>
                  <p className="text-xs text-slate-400">Untuk memasukkan stok fisik saat cut-off Excel</p>
                </div>
                <button
                  onClick={() => downloadTemplate('stock')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh .CSV</span>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs font-mono text-slate-300 overflow-x-auto">
                <div className="text-amber-400 font-bold mb-1">Header Kolom Excel:</div>
                <div className="text-slate-200">sku, qty, lokasi, catatan</div>
                <div className="text-slate-500 mt-1">Contoh data:</div>
                <div className="text-slate-400">KL-210OV-HT-M, 40, Gudang Utama, Saldo Awal Migrasi</div>
                <div className="text-slate-400">KL-235CL-PT-XL, 25, Gudang Utama, Saldo Awal Migrasi</div>
              </div>
            </div>

            {/* Template Order Riwayat */}
            <div className="bg-[#121620] p-5 rounded-2xl border border-slate-800/80 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">3. Riwayat Transaksi Order</h4>
                  <p className="text-xs text-slate-400">Untuk rekap penjualan harian / bulanan</p>
                </div>
                <button
                  onClick={() => downloadTemplate('orders')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh .CSV</span>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs font-mono text-slate-300 overflow-x-auto">
                <div className="text-amber-400 font-bold mb-1">Header Kolom Excel:</div>
                <div className="text-slate-200">noOrder, tanggal, channel, customerNama, customerHp, customerKota, sku, qty, hargaSatuan, diskon, statusBayar, noResi</div>
                <div className="text-slate-500 mt-1">Contoh data:</div>
                <div className="text-slate-400">ORD-001, 2026-09-01, Shopee, Budi, 08123456, Bandung, KL-210OV-HT-L, 2, 129000, 0, lunas, SPX99201</div>
              </div>
            </div>

            {/* Template Mitra Reseller */}
            <div className="bg-[#121620] p-5 rounded-2xl border border-slate-800/80 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">4. Daftar Toko Mitra / Reseller</h4>
                  <p className="text-xs text-slate-400">Untuk data toko konsinyasi titip jual</p>
                </div>
                <button
                  onClick={() => downloadTemplate('reseller')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh .CSV</span>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs font-mono text-slate-300 overflow-x-auto">
                <div className="text-amber-400 font-bold mb-1">Header Kolom Excel:</div>
                <div className="text-slate-200">nama, kontakPerson, noHp, kota, alamat, diskonPersen</div>
                <div className="text-slate-500 mt-1">Contoh data:</div>
                <div className="text-slate-400">Distro Brotherhood, Rian, 081234567890, Bandung, Jl. Trunojoyo No. 12, 20</div>
              </div>
            </div>

            {/* Template Biaya Operasional / Pengeluaran */}
            <div className="bg-[#121620] p-5 rounded-2xl border border-slate-800/80 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">5. Biaya Pengeluaran (Beban Operasional & Iklan)</h4>
                  <p className="text-xs text-slate-400">Untuk pencatatan kas keluar & laporan laba-rugi bersih</p>
                </div>
                <button
                  onClick={() => downloadTemplate('expenses')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh .CSV</span>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs font-mono text-slate-300 overflow-x-auto">
                <div className="text-amber-400 font-bold mb-1">Header Kolom Excel:</div>
                <div className="text-slate-200">tanggal, kategori, deskripsi, jumlah</div>
                <div className="text-slate-500 mt-1">Contoh data:</div>
                <div className="text-slate-400">2026-09-05, Marketing & Ads, Iklan Meta Ads & TikTok Campaign, 1500000</div>
                <div className="text-slate-400">2026-09-10, Packaging, Plastik Polymailer & Hangtag 1000 pcs, 450000</div>
                <div className="text-slate-400">2026-09-25, Gaji Tim, Gaji Staff Packing & Admin CS, 3200000</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-2">
              Cara Penggunaan di Microsoft Excel atau Google Sheets:
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-300 text-xs pl-1">
              <li>Klik tombol <strong>"Unduh .CSV"</strong> di atas.</li>
              <li>Buka file tersebut di Excel, lalu copy-paste atau isi data riil Kalima Apparel milik Anda.</li>
              <li>Simpan (Save As) dengan format <strong>CSV (Comma Delimited) (*.csv)</strong>.</li>
              <li>Buka tab <strong>"2. Impor Data ke Sistem"</strong> di sebelah, lalu paste isi CSV ke kolom teks untuk dimuat langsung!</li>
            </ol>
          </div>
        </div>
      )}

      {/* SUBTAB 2: IMPOR TOOL */}
      {activeSubTab === 'import_tool' && (
        <div className="bg-[#121620] p-6 rounded-2xl border border-slate-800/80 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                Impor Data Excel (.CSV atau Paste Sel Spreadsheet)
              </h3>
              <p className="text-xs text-slate-400">
                Pilih jenis data, lalu Anda bisa <strong>Upload File .CSV</strong> atau <strong>langsung Copy-Paste baris tabel Excel / Google Sheets</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Pilih Data:</span>
              <select
                value={importMode}
                onChange={(e) => {
                  setImportMode(e.target.value as any);
                  setUploadedFileName(null);
                  setImportText('');
                }}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              >
                <option value="csv_sku">Master SKU (Katalog Kaos)</option>
                <option value="csv_stock">Saldo Awal Stok Fisik</option>
                <option value="csv_orders">Riwayat Order (Arsip)</option>
                <option value="csv_expenses">Biaya Pengeluaran (Beban Operasional)</option>
                <option value="full_json">Backup Sistem Lengkap (JSON)</option>
              </select>
            </div>
          </div>

          {/* OPSI 1: FILE PICKER / UPLOAD FILE CSV */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-5 border-2 border-dashed border-slate-700 hover:border-amber-400/80 bg-slate-950/60 hover:bg-slate-900/80 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform mb-2">
                <FileUp className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                {uploadedFileName ? `File Terpilih: ${uploadedFileName}` : 'Klik untuk Pilih File Excel (.xlsx, .xls) atau .CSV'}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Mendukung file Excel langsung (.xlsx, .xls) maupun file .csv dari Excel/Google Sheets/Marketplace
              </p>
              {uploadedFileName && (
                <span className="mt-2 text-[11px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30">
                  Siap diproses
                </span>
              )}
            </div>

            {/* PANDUAN CARA COPY SEL LANGSUNG */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                <ClipboardCheck className="w-4 h-4" />
                Cara Copy Teks Langsung dari Excel / Google Sheets:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs text-slate-400">
                <li>Buka file Excel atau Google Sheets Anda.</li>
                <li>
                  Blok / seleksi baris judul dan isi data (misal: sel <code className="text-amber-300 bg-slate-900 px-1 rounded">A1</code> sampai <code className="text-amber-300 bg-slate-900 px-1 rounded">H10</code>).
                </li>
                <li>Tekan tombol <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200">Ctrl + C</kbd> (atau <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200">Cmd + C</kbd> di Mac).</li>
                <li>Klik di kotak teks di bawah lalu tekan <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200">Ctrl + V</kbd>. Aplikasi otomatis mendeteksi kolom!</li>
              </ol>
            </div>
          </div>

          {/* OPSI KHUSUS OPEX: TIMPA / BERSIHKAN DATA SEBELUMNYA */}
          {importMode === 'csv_expenses' && (
            <div className="p-4 bg-slate-950 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={replaceExistingExpenses}
                    onChange={(e) => setReplaceExistingExpenses(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-400"
                  />
                  <span>Timpa / Kosongkan data OPEX lama sebelum mengimpor data ini</span>
                </label>
                <p className="text-xs text-slate-400 pl-6">
                  Centang opsi ini agar data pengeluaran lama tidak terduplikasi (misal jika terbaca 83 juta padahal seharusnya 30 jutaan).
                </p>
              </div>

              {biayaOperasional.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (await askConfirm(`Yakin ingin mengosongkan ${biayaOperasional.length} catatan pengeluaran lama?`, { danger: true })) {
                      clearBiayaOperasional();
                      setImportStatus({
                        success: true,
                        message: 'Semua data pengeluaran lama berhasil dikosongkan. Sekarang Anda siap mengimpor data baru yang bersih.',
                      });
                    }
                  }}
                  className="px-3 py-1.5 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan OPEX Lama ({biayaOperasional.length} Data)</span>
                </button>
              )}
            </div>
          )}

          {importStatus && (
            <div
              className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                importStatus.success
                  ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950 border-rose-800 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {importStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{importStatus.message}</span>
              </div>
              {importStatus.success && importMode === 'csv_orders' && (
                <button
                  type="button"
                  onClick={() => setCurrentView('sales')}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer flex items-center gap-1 self-start sm:self-auto"
                >
                  <span>Buka Menu Order & Penjualan →</span>
                </button>
              )}
              {importStatus.success && importMode === 'csv_expenses' && (
                <button
                  type="button"
                  onClick={() => setCurrentView('finance')}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer flex items-center gap-1 self-start sm:self-auto"
                >
                  <span>Buka Buku Kas & Laba Rugi →</span>
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleProcessImport} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Pratinjau Isi Data (CSV atau Tab-Separated):
              </label>
              {importText && (
                <button
                  type="button"
                  onClick={() => {
                    setImportText('');
                    setUploadedFileName(null);
                  }}
                  className="text-xs text-rose-400 hover:underline cursor-pointer"
                >
                  Bersihkan Teks
                </button>
              )}
            </div>

            <textarea
              rows={7}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={
                importMode === 'csv_sku'
                  ? 'Paste isi CSV atau paste langsung sel SKU dari Excel/Google Sheets di sini...\nContoh:\nsku\tseriesCode\tcolorCode\tcolorName\tsize\tprice\thpp\tminStock\nKL-210OV-HT-M\t210OV\tHT\tHitam\tM\t129000\t50000\t10'
                  : importMode === 'csv_stock'
                  ? 'Paste isi CSV atau paste langsung sel stok dari Excel di sini...\nContoh:\nsku\tqty\tlokasi\tcatatan\nKL-210OV-HT-M\t40\tGudang Utama\tSaldo Awal Migrasi Excel'
                  : importMode === 'csv_orders'
                  ? 'Paste isi CSV atau paste langsung baris order dari Excel di sini...\nContoh kolom:\nnoOrder\ttanggal\tchannel\tcustomerNama\tcustomerHp\tcustomerKota\tsku\tqty\thargaSatuan\tdiskon\tstatusBayar\tnoResi\nORD-20260901-001\t2026-09-01\tShopee\tBudi Santoso\t08123456789\tBandung\tKL-210OV-HT-L\t2\t129000\t0\tlunas\tSPXID029481920'
                  : 'Paste teks CSV atau JSON cadangan di sini...'
              }
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl p-3 text-xs text-slate-200 font-mono transition-colors"
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Data akan langsung disimpan ke browser Anda (`localStorage`) secara otomatis.
              </span>
              <button
                type="submit"
                disabled={!importText.trim()}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-amber-500/10 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Proses & Simpan Data</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUBTAB 3: EKSPOR KE CSV / BACKUP */}
      {activeSubTab === 'csv_export' && (
        <div className="bg-[#121620] p-6 rounded-2xl border border-slate-800/80 space-y-4">
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            Ekspor Data Aktif ke Format Excel (.CSV)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <button
              onClick={() =>
                exportToCSV(
                  `kalima-penjualan-${Date.now()}.csv`,
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
                  }))
                )
              }
              className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-left transition-colors flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="font-bold text-white text-xs">Laporan Penjualan</div>
                <div className="text-xs text-slate-400">{orders.length} order tercatat</div>
              </div>
              <ArrowDownToLine className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() =>
                exportToCSV(
                  `kalima-stok-mutasi-${Date.now()}.csv`,
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
                  }))
                )
              }
              className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-left transition-colors flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="font-bold text-white text-xs">Kartu Stok & Mutasi</div>
                <div className="text-xs text-slate-400">
                  {stockMovements.length} transaksi stok
                </div>
              </div>
              <ArrowDownToLine className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() =>
                exportToCSV(
                  `kalima-master-sku-${Date.now()}.csv`,
                  skus.map((s) => ({
                    sku: s.sku,
                    seri: s.seriesCode,
                    nama: s.name,
                    warna: s.colorName,
                    ukuran: s.size,
                    hargaJual: s.price,
                    hpp: s.hpp,
                    minStock: s.minStock,
                  }))
                )
              }
              className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-left transition-colors flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="font-bold text-white text-xs">Katalog Master SKU</div>
                <div className="text-xs text-slate-400">{skus.length} SKU terdaftar</div>
              </div>
              <ArrowDownToLine className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() =>
                exportToCSV(
                  `kalima-kas-bank-mutasi-${Date.now()}.csv`,
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
                  }))
                )
              }
              className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-left transition-colors flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="font-bold text-white text-xs">Buku Kas & Mutasi Bank</div>
                <div className="text-xs text-slate-400">
                  {cashMutations.length} catatan mutasi kas
                </div>
              </div>
              <ArrowDownToLine className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => {
                const backupData = {
                  version: '1.0.0',
                  exportedAt: new Date().toISOString(),
                  skus,
                  orders,
                  stockMovements,
                  customers,
                  resellers,
                  biayaOperasional,
                  suratTitip,
                  cashAccounts,
                  cashMutations,
                };
                const blob = new Blob([JSON.stringify(backupData, null, 2)], {
                  type: 'application/json',
                });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `kalima-full-backup-${Date.now()}.json`;
                link.click();
              }}
              className="p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-left transition-colors flex items-center justify-between col-span-full sm:col-span-2 md:col-span-3 cursor-pointer"
            >
              <div>
                <div className="font-bold text-amber-400 text-xs">
                  Backup Seluruh Database Sistem (JSON)
                </div>
                <div className="text-xs text-slate-300">
                  Menyimpan seluruh master SKU, order, kartu stok, kas & bank, reseller, dan OPEX dalam 1 file cadangan
                </div>
              </div>
              <Download className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
