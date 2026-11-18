import React, { useMemo, useState } from 'react';
import {
  Store,
  Send,
  FileCheck,
  RotateCcw,
  DollarSign,
  Plus,
  Search,
  AlertCircle,
  Printer,
  X,
  CheckCircle2,
  MapPin,
  Phone,
  Trash2,
  Edit2,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PaymentStatus, Reseller, SuratTitip } from '../types';
import { displayCity, formatCompactRupiah } from '../services/customerSegments';
import { consignmentPeriodLabel, consignmentPrice, resellerReceivable, resellerStockSummary } from '../services/resellerConsignment';

type Level = 'Platinum' | 'Gold' | 'Silver';
type TabId = 'mitra' | 'stok' | 'surat' | 'laku' | 'riwayat';
type ItemRow = { sku: string; qty: number; hargaTitip: number };
type ReturKondisi = 'baik_ke_gudang' | 'rusak_ke_reject';

const LEVEL_PRESET: Record<Level, { diskon: number; plafon: number }> = {
  Platinum: { diskon: 25, plafon: 15_000_000 },
  Gold: { diskon: 20, plafon: 10_000_000 },
  Silver: { diskon: 15, plafon: 5_000_000 },
};

const CARD = 'bg-white rounded-2xl border border-slate-200';
const INPUT = 'w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-slate-500';
const OUTLINE_BUTTON =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const PRIMARY_BUTTON = 'segmented-pill-active inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer';
const ICON_BUTTON = 'w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer';
const DANGER_BUTTON = 'inline-flex items-center gap-1.5 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs cursor-pointer';

const formatRupiah = (val: number) => `Rp ${Math.round(val).toLocaleString('id-ID')}`;
const emptyRow = (): ItemRow => ({ sku: '', qty: 0, hargaTitip: 0 });

const whatsappNumber = (phone: string): string => {
  const clean = (phone || '').replace(/[^0-9]/g, '');
  return clean.startsWith('0') ? `62${clean.substring(1)}` : clean;
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = { lunas: 'Lunas', piutang: 'Belum dibayar', sebagian: 'Bayar sebagian' };

const Field: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-slate-600 font-semibold mb-1">{label}</span>
    {children}
    {hint && <span className="text-[11px] text-slate-500 mt-1 block">{hint}</span>}
  </label>
);

const Modal: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}> = ({ title, subtitle, icon, onClose, size = 'md', children }) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div
      className={`bg-white border border-slate-200 rounded-2xl w-full ${
        size === 'xl' ? 'max-w-3xl' : size === 'lg' ? 'max-w-xl' : 'max-w-md'
      } max-h-[90vh] flex flex-col shadow-2xl`}
    >
      <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {icon}
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <button type="button" aria-label="Tutup" data-modal-close onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto">{children}</div>
    </div>
  </div>
);

const FormError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl flex items-start gap-2">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </div>
  ) : null;

const FormActions: React.FC<{ onCancel: () => void; submitLabel: string }> = ({ onCancel, submitLabel }) => (
  <div className="flex justify-end gap-2 pt-2">
    <button type="button" onClick={onCancel} className={OUTLINE_BUTTON}>
      Batal
    </button>
    <button type="submit" className={PRIMARY_BUTTON}>
      {submitLabel}
    </button>
  </div>
);

export const ResellerView: React.FC = () => {
  const {
    resellers,
    customers,
    skus,
    suratTitip,
    laporanTitipLaku,
    orders,
    stockMovements,
    calculateStock,
    createSuratTitip,
    createLaporanTitipLaku,
    recordReturTitip,
    recordSetoranReseller,
    addReseller,
    updateReseller,
    deleteReseller,
    cashAccounts,
    cashMutations,
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabId>('mitra');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | Level>('ALL');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [openForm, setOpenForm] = useState<'kirim' | 'laku' | 'retur' | 'setoran' | null>(null);
  const [formResellerId, setFormResellerId] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [catatan, setCatatan] = useState('');
  const [lakuPeriode, setLakuPeriode] = useState('');
  const [lakuStatusBayar, setLakuStatusBayar] = useState<PaymentStatus>('piutang');
  const [lakuTerbayar, setLakuTerbayar] = useState(0);
  const [returKondisi, setReturKondisi] = useState<ReturKondisi>('baik_ke_gudang');
  const [setoranAmount, setSetoranAmount] = useState(0);
  const [setoranMethod, setSetoranMethod] = useState('Transfer BCA');
  const [setoranAccountId, setSetoranAccountId] = useState('');

  const [isResellerModalOpen, setIsResellerModalOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [resNama, setResNama] = useState('');
  const [resPic, setResPic] = useState('');
  const [resHp, setResHp] = useState('');
  const [resKota, setResKota] = useState('');
  const [resAlamat, setResAlamat] = useState('');
  const [resLevel, setResLevel] = useState<Level>('Gold');
  const [resDiskon, setResDiskon] = useState(LEVEL_PRESET.Gold.diskon);
  const [resPlafon, setResPlafon] = useState(LEVEL_PRESET.Gold.plafon);
  const [resJadwal, setResJadwal] = useState('Setiap hari Senin');

  const [deleteModalReseller, setDeleteModalReseller] = useState<Reseller | null>(null);
  const [deleteReturnStock, setDeleteReturnStock] = useState(true);
  const [printSurat, setPrintSurat] = useState<SuratTitip | null>(null);

  const flash = (message: string, type: 'success' | 'error' = 'success', ms = 5000) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), ms);
  };

  // Stok, nilai, dan piutang per mitra
  const partnerInfo = useMemo(() => {
    const info: Record<string, { stock: Record<string, number>; pcs: number; hppValue: number; consignmentValue: number; piutang: number }> = {};
    resellers.forEach((res) => {
      const loc = `Reseller: ${res.nama}`;
      const stock: Record<string, number> = {};
      stockMovements.forEach((m) => {
        if (m.lokasi === loc) {
          stock[m.sku] = (stock[m.sku] || 0) + m.qty;
        }
      });
      info[res.id] = { stock, ...resellerStockSummary(stock, skus, res.diskonPersen), piutang: resellerReceivable(res.id, orders, customers) };
    });
    return info;
  }, [resellers, stockMovements, skus, orders, customers]);

  const warehouseStock = useMemo(() => {
    const map: Record<string, number> = {};
    skus.forEach((s) => (map[s.sku] = calculateStock(s.sku, 'Gudang Utama')));
    return map;
  }, [skus, calculateStock]);

  const totals = useMemo(() => {
    const values = Object.values(partnerInfo);
    return {
      pcs: values.reduce((sum, v) => sum + v.pcs, 0),
      hppValue: values.reduce((sum, v) => sum + v.hppValue, 0),
      piutang: values.reduce((sum, v) => sum + v.piutang, 0),
      withPiutang: values.filter((v) => v.piutang > 0).length,
      lakuValue: laporanTitipLaku.reduce((sum, lt) => sum + lt.totalTagihan, 0),
      lakuQty: laporanTitipLaku.reduce((sum, lt) => sum + lt.items.reduce((acc, it) => acc + it.qty, 0), 0),
      levels: (['Platinum', 'Gold', 'Silver'] as Level[]).map((lvl) => [lvl, resellers.filter((r) => (r.level || 'Silver') === lvl).length] as const),
    };
  }, [partnerInfo, laporanTitipLaku, resellers]);

  const filteredResellers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return resellers.filter((res) => {
      if (levelFilter !== 'ALL' && (res.level || 'Silver') !== levelFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return [res.nama, res.kota, res.kontakPerson, res.noHp, res.alamat].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [resellers, searchQuery, levelFilter]);

  /** Retur tercatat dua kali (keluar dari mitra, masuk gudang); tampilkan sisi mitra saja. */
  const returHistory = useMemo(() => stockMovements.filter((m) => m.tipe === 'retur_titip' && m.lokasi.startsWith('Reseller: ')), [stockMovements]);
  const setoranHistory = useMemo(() => cashMutations.filter((c) => c.kategori === 'Setoran Reseller'), [cashMutations]);

  const skuOf = (code: string) => skus.find((s) => s.sku === code);
  const resellerOf = (id: string) => resellers.find((r) => r.id === id);
  const formReseller = resellerOf(formResellerId);
  const formPartner = formReseller ? partnerInfo[formReseller.id] : undefined;

  /** SKU yang bisa dipilih: stok gudang untuk kirim, stok di mitra untuk laku & retur. */
  const availableFor = (code: string): number => (openForm === 'kirim' ? warehouseStock[code] || 0 : formPartner?.stock[code] || 0);
  const skuChoices = useMemo(() => {
    const source = openForm === 'kirim' ? warehouseStock : formPartner?.stock || {};
    return skus.filter((s) => (source[s.sku] || 0) > 0).sort((a, b) => a.name.localeCompare(b.name));
  }, [openForm, warehouseStock, formPartner, skus]);

  const openPartnerForm = (form: 'kirim' | 'laku' | 'retur' | 'setoran', resellerId = '') => {
    setFormError(null);
    setFormResellerId(resellerId);
    setRows([emptyRow()]);
    setCatatan('');
    setLakuPeriode(consignmentPeriodLabel(new Date()));
    setLakuStatusBayar('piutang');
    setLakuTerbayar(0);
    setReturKondisi('baik_ke_gudang');
    setSetoranAmount(resellerId ? partnerInfo[resellerId]?.piutang || 0 : 0);
    setSetoranMethod('Transfer BCA');
    setSetoranAccountId('');
    setOpenForm(form);
  };

  const closeForm = () => {
    setOpenForm(null);
    setFormError(null);
  };

  const handleChooseReseller = (id: string) => {
    setFormResellerId(id);
    setFormError(null);
    if (openForm === 'setoran') {
      setSetoranAmount(partnerInfo[id]?.piutang || 0);
      return;
    }
    // Ganti mitra: daftar SKU ikut berubah dan harga titip ikut diskon mitra baru.
    setRows([emptyRow()]);
  };

  const updateRow = (idx: number, patch: Partial<ItemRow>) => setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const handleChooseSku = (idx: number, code: string) => {
    const sku = skuOf(code);
    updateRow(idx, { sku: code, hargaTitip: sku ? consignmentPrice(sku.price, formReseller?.diskonPersen) : 0 });
  };

  /** Baris terisi, atau pesan galat bila ada yang kosong / melebihi stok. */
  const validRows = (): ItemRow[] | string => {
    if (!formReseller) {
      return 'Pilih mitra terlebih dahulu.';
    }
    const filled = rows.filter((row) => row.sku);
    if (filled.length === 0 || filled.some((row) => row.qty <= 0)) {
      return 'Pilih SKU dan isi jumlah lebih dari 0 di setiap baris.';
    }
    const perSku: Record<string, number> = {};
    filled.forEach((row) => (perSku[row.sku] = (perSku[row.sku] || 0) + row.qty));
    const over = Object.entries(perSku).find(([code, qty]) => qty > availableFor(code));
    if (over) {
      const where = openForm === 'kirim' ? 'gudang' : `di ${formReseller.nama}`;
      return `Jumlah ${over[0]} (${over[1]} pcs) melebihi stok ${where} (${availableFor(over[0])} pcs).`;
    }
    return filled;
  };

  const rowsTotal = rows.reduce((sum, row) => sum + (row.qty || 0) * (row.hargaTitip || 0), 0);
  const rowsQty = rows.reduce((sum, row) => sum + (row.qty || 0), 0);

  const handleSaveKirim = (e: React.FormEvent) => {
    e.preventDefault();
    const items = validRows();
    if (typeof items === 'string') {
      setFormError(items);
      return;
    }
    const res = createSuratTitip(formResellerId, items, catatan.trim() || 'Pengiriman titipan');
    if (!res.success) {
      setFormError(res.error || 'Surat jalan gagal dibuat.');
      return;
    }
    closeForm();
    flash(`Surat jalan untuk ${formReseller?.nama} dibuat; ${rowsQty} pcs dipindah dari gudang.`);
  };

  const handleSaveLaku = (e: React.FormEvent) => {
    e.preventDefault();
    const items = validRows();
    if (typeof items === 'string') {
      setFormError(items);
      return;
    }
    if (lakuStatusBayar === 'sebagian' && (lakuTerbayar <= 0 || lakuTerbayar >= rowsTotal)) {
      setFormError('Jumlah yang sudah dibayar harus lebih dari 0 dan kurang dari total tagihan.');
      return;
    }
    const paid = lakuStatusBayar === 'lunas' ? rowsTotal : lakuStatusBayar === 'sebagian' ? lakuTerbayar : 0;
    createLaporanTitipLaku(formResellerId, lakuPeriode.trim() || consignmentPeriodLabel(new Date()), items, lakuStatusBayar, paid);
    closeForm();
    flash(`Laporan laku ${formReseller?.nama} dicatat sebagai order penjualan (${formatRupiah(rowsTotal)}).`);
  };

  const handleSaveRetur = (e: React.FormEvent) => {
    e.preventDefault();
    const items = validRows();
    if (typeof items === 'string') {
      setFormError(items);
      return;
    }
    recordReturTitip(
      formResellerId,
      items.map((row) => ({ sku: row.sku, qty: row.qty, kondisi: returKondisi })),
      catatan.trim() || 'Retur titipan',
    );
    closeForm();
    flash(`Retur ${rowsQty} pcs dari ${formReseller?.nama} dicatat ${returKondisi === 'baik_ke_gudang' ? 'masuk gudang' : 'sebagai barang reject'}.`);
  };

  const handleSaveSetoran = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReseller) {
      setFormError('Pilih mitra terlebih dahulu.');
      return;
    }
    if (setoranAmount <= 0) {
      setFormError('Isi nominal setoran.');
      return;
    }
    recordSetoranReseller(formResellerId, setoranAmount, setoranMethod, catatan.trim() || undefined, setoranAccountId || undefined);
    closeForm();
    flash(`Setoran ${formatRupiah(setoranAmount)} dari ${formReseller.nama} dicatat ke kas.`);
  };

  const openResellerModal = (res: Reseller | null) => {
    setEditingReseller(res);
    const level = res?.level || 'Gold';
    setResNama(res?.nama || '');
    setResPic(res?.kontakPerson || '');
    setResHp(res?.noHp || '');
    setResKota(displayCity(res?.kota));
    setResAlamat(res?.alamat || '');
    setResLevel(level);
    setResDiskon(res?.diskonPersen ?? LEVEL_PRESET[level].diskon);
    setResPlafon(res?.batasPlafonTitipan ?? LEVEL_PRESET[level].plafon);
    setResJadwal(res?.jadwalSetoran || 'Setiap hari Senin');
    setFormError(null);
    setIsResellerModalOpen(true);
  };

  const handleSaveResellerForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resNama.trim() || !resHp.trim()) {
      setFormError('Nama toko dan nomor WhatsApp wajib diisi.');
      return;
    }
    const data = {
      nama: resNama.trim(),
      kontakPerson: resPic.trim() || undefined,
      noHp: resHp.trim(),
      kota: resKota.trim(),
      alamat: resAlamat.trim(),
      level: resLevel,
      diskonPersen: resDiskon,
      komisiPercent: resDiskon,
      batasPlafonTitipan: resPlafon,
      jadwalSetoran: resJadwal.trim(),
    };
    if (editingReseller) {
      updateReseller(editingReseller.id, data);
      flash(`Data mitra "${data.nama}" diperbarui.`);
    } else {
      addReseller(data);
      flash(`Mitra "${data.nama}" ditambahkan.`);
    }
    setIsResellerModalOpen(false);
  };

  const handleConfirmDeleteReseller = () => {
    if (!deleteModalReseller) {
      return;
    }
    const name = deleteModalReseller.nama;
    const result = deleteReseller(deleteModalReseller.id, { returnStockToWarehouse: deleteReturnStock, force: false });
    if (result.success) {
      setDeleteModalReseller(null);
      flash(`Mitra "${name}" dihapus.${result.returnedQty ? ` ${result.returnedQty} pcs titipan ditarik ke gudang.` : ''}`);
    } else {
      setFormError(result.error || 'Mitra gagal dihapus.');
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'mitra', label: `Mitra (${resellers.length})` },
    { id: 'stok', label: `Stok di Mitra (${totals.pcs} pcs)` },
    { id: 'surat', label: `Surat Jalan (${suratTitip.length})` },
    { id: 'laku', label: `Laporan Laku (${laporanTitipLaku.length})` },
    { id: 'riwayat', label: `Retur & Setoran (${returHistory.length + setoranHistory.length})` },
  ];

  const resellerSelect = (label: string, showPiutang = false) => (
    <Field label={label}>
      <select required value={formResellerId} onChange={(e) => handleChooseReseller(e.target.value)} className={INPUT}>
        <option value="">Pilih mitra…</option>
        {resellers.map((r) => {
          const info = partnerInfo[r.id];
          const extra = showPiutang ? `tagihan ${formatRupiah(info?.piutang || 0)}` : `${info?.pcs || 0} pcs dititip`;
          return (
            <option key={r.id} value={r.id}>
              {r.nama} · {extra}
            </option>
          );
        })}
      </select>
    </Field>
  );

  const itemRows = (priceLabel: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-slate-600 font-semibold">Barang</span>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
          disabled={!formReseller}
          className="inline-flex items-center gap-1 text-slate-700 font-semibold hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah baris
        </button>
      </div>
      {!formReseller ? (
        <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500">Pilih mitra dulu untuk melihat barang yang bisa dipilih.</p>
      ) : skuChoices.length === 0 ? (
        <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500">
          {openForm === 'kirim' ? 'Tidak ada SKU dengan stok gudang.' : `Tidak ada barang titipan di ${formReseller.nama}.`}
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div key={idx} className="p-2.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2">
                <select aria-label={`SKU baris ${idx + 1}`} value={row.sku} onChange={(e) => handleChooseSku(idx, e.target.value)} className={`${INPUT} p-2`}>
                  <option value="">Pilih SKU…</option>
                  {skuChoices.map((s) => (
                    <option key={s.sku} value={s.sku}>
                      {s.name} · {availableFor(s.sku)} pcs
                    </option>
                  ))}
                </select>
                {rows.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Hapus baris ${idx + 1}`}
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                    className={`${ICON_BUTTON} shrink-0 text-rose-700`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Jumlah (pcs)" hint={row.sku ? `Tersedia ${availableFor(row.sku)} pcs` : undefined}>
                  <input
                    type="number"
                    min="1"
                    max={row.sku ? availableFor(row.sku) : undefined}
                    value={row.qty || ''}
                    onChange={(e) => updateRow(idx, { qty: Number(e.target.value) || 0 })}
                    className={`${INPUT} p-2 font-mono`}
                  />
                </Field>
                {openForm !== 'retur' && (
                  <Field label={priceLabel}>
                    <input
                      type="number"
                      min="0"
                      value={row.hargaTitip || ''}
                      onChange={(e) => updateRow(idx, { hargaTitip: Number(e.target.value) || 0 })}
                      className={`${INPUT} p-2 font-mono text-right`}
                    />
                  </Field>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {formReseller && openForm !== 'retur' && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-slate-600">
            {rowsQty} pcs · harga titip = harga jual − diskon {formReseller.diskonPersen ?? 20}%
          </span>
          <span className="font-mono font-bold text-slate-900">{formatRupiah(rowsTotal)}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5 pb-16">
      {notice && (
        <div role="status" className="bg-white border border-slate-200 text-slate-900 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xl">
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />}
            <span className="font-semibold">{notice.message}</span>
          </div>
          <button type="button" aria-label="Tutup pesan" onClick={() => setNotice(null)} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className={`${CARD} p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Mitra Konsinyasi</h1>
          <p className="text-xs text-slate-500 mt-0.5">Barang dititip ke toko mitra, dilaporkan laku, lalu ditagih.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <button type="button" onClick={() => openPartnerForm('kirim')} className={`${PRIMARY_BUTTON} col-span-2`}>
            <Send className="w-3.5 h-3.5" /> Kirim Titipan
          </button>
          <button type="button" onClick={() => openPartnerForm('laku')} className={OUTLINE_BUTTON}>
            <FileCheck className="w-3.5 h-3.5" /> Lapor Laku
          </button>
          <button type="button" onClick={() => openPartnerForm('retur')} className={OUTLINE_BUTTON}>
            <RotateCcw className="w-3.5 h-3.5" /> Retur
          </button>
          <button type="button" onClick={() => openPartnerForm('setoran', resellers.find((r) => partnerInfo[r.id]?.piutang > 0)?.id)} className={OUTLINE_BUTTON}>
            <DollarSign className="w-3.5 h-3.5" /> Catat Setoran
          </button>
          <button type="button" onClick={() => openResellerModal(null)} className={OUTLINE_BUTTON}>
            <Plus className="w-3.5 h-3.5" /> Mitra Baru
          </button>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: 'Mitra', value: String(resellers.length), note: totals.levels.map(([lvl, n]) => `${n} ${lvl}`).join(' · ') },
          { label: 'Stok di mitra', value: `${totals.pcs} pcs`, note: `Nilai HPP Rp ${formatCompactRupiah(totals.hppValue)}`, title: formatRupiah(totals.hppValue) },
          {
            label: 'Tagihan ke mitra',
            value: `Rp ${formatCompactRupiah(totals.piutang)}`,
            title: formatRupiah(totals.piutang),
            note: totals.withPiutang > 0 ? `${totals.withPiutang} mitra belum setor` : 'Tidak ada tagihan',
          },
          { label: 'Laku titipan', value: `Rp ${formatCompactRupiah(totals.lakuValue)}`, title: formatRupiah(totals.lakuValue), note: `${totals.lakuQty} pcs terjual` },
        ].map((card) => (
          <div key={card.label} className={`${CARD} p-3`} title={card.title}>
            <div className="text-xs font-semibold text-slate-600">{card.label}</div>
            <div className="text-xl font-bold text-slate-900 font-mono mt-1">{card.value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{card.note}</div>
          </div>
        ))}
      </div>

      {/* Tab */}
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
              activeTab === tab.id ? 'segmented-pill-active' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(activeTab === 'mitra' || activeTab === 'stok') && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Cari mitra"
              placeholder="Cari nama toko, PIC, kota, atau no. WhatsApp…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 pl-9 pr-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-500"
            />
          </div>
          <select
            aria-label="Level mitra"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as 'ALL' | Level)}
            className="bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua level</option>
            <option value="Platinum">Platinum</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
          </select>
        </div>
      )}

      {/* TAB: Mitra */}
      {activeTab === 'mitra' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredResellers.length === 0 && <p className={`${CARD} p-8 text-center text-xs text-slate-500 md:col-span-2 xl:col-span-3`}>Tidak ada mitra yang cocok.</p>}
          {filteredResellers.map((res) => {
            const info = partnerInfo[res.id];
            const plafon = res.batasPlafonTitipan || LEVEL_PRESET[res.level || 'Silver'].plafon;
            const usage = Math.min(100, Math.round((info.consignmentValue / plafon) * 100));
            const city = displayCity(res.kota);
            return (
              <div key={res.id} className={`${CARD} p-4 flex flex-col gap-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug break-words">{res.nama}</h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                      <span className="font-semibold text-slate-700">
                        {res.level || 'Silver'} · diskon {res.diskonPersen ?? 20}%
                      </span>
                      {city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" aria-hidden="true" />
                          {city}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => openResellerModal(res)} className={ICON_BUTTON} title="Edit mitra" aria-label={`Edit ${res.nama}`}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setDeleteReturnStock(true);
                        setDeleteModalReseller(res);
                      }}
                      className={`${ICON_BUTTON} text-rose-700 hover:bg-rose-50`}
                      title="Hapus mitra"
                      aria-label={`Hapus ${res.nama}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-0.5">
                  {res.noHp && res.noHp.trim() !== '-' ? (
                    <a href={`https://wa.me/${whatsappNumber(res.noHp)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono hover:text-slate-900">
                      <Phone className="w-3 h-3" aria-hidden="true" />
                      {res.noHp}
                      {res.kontakPerson && <span className="font-sans text-slate-500">· {res.kontakPerson}</span>}
                      <ArrowUpRight className="w-2.5 h-2.5 opacity-60" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-slate-500">Belum ada no. WhatsApp</span>
                  )}
                  {res.alamat && <p className="text-slate-500 truncate" title={res.alamat}>{res.alamat}</p>}
                  {res.jadwalSetoran && <p className="text-slate-500">Setoran: {res.jadwalSetoran}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-slate-500">Titipan</div>
                    <div className="font-bold font-mono text-slate-900 mt-0.5">{info.pcs} pcs</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-slate-500">Tagihan</div>
                    <div className={`font-bold font-mono mt-0.5 ${info.piutang > 0 ? 'text-rose-700' : 'text-slate-900'}`} title={formatRupiah(info.piutang)}>
                      {info.piutang > 0 ? `Rp ${formatCompactRupiah(info.piutang)}` : 'Tidak ada'}
                    </div>
                  </div>
                </div>

                {info.pcs > 0 && (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Plafon terpakai {usage}%</span>
                      <span className="font-mono" title={`${formatRupiah(info.consignmentValue)} dari ${formatRupiah(plafon)} (harga titip)`}>
                        Rp {formatCompactRupiah(info.consignmentValue)} / {formatCompactRupiah(plafon)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full ${usage >= 90 ? 'bg-rose-700' : 'bg-slate-800'}`} style={{ width: `${usage}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1 mt-auto">
                  <button type="button" onClick={() => openPartnerForm('kirim', res.id)} className={`${OUTLINE_BUTTON} py-1.5`}>
                    <Send className="w-3.5 h-3.5" /> Kirim
                  </button>
                  <button type="button" disabled={info.pcs === 0} onClick={() => openPartnerForm('laku', res.id)} className={`${OUTLINE_BUTTON} py-1.5`}>
                    <FileCheck className="w-3.5 h-3.5" /> Laku
                  </button>
                  <button type="button" disabled={info.pcs === 0} onClick={() => openPartnerForm('retur', res.id)} className={`${OUTLINE_BUTTON} py-1.5`}>
                    <RotateCcw className="w-3.5 h-3.5" /> Retur
                  </button>
                  {info.piutang > 0 && (
                    <button type="button" onClick={() => openPartnerForm('setoran', res.id)} className={`${OUTLINE_BUTTON} py-1.5`}>
                      <DollarSign className="w-3.5 h-3.5" /> Setoran
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: Stok di mitra */}
      {activeTab === 'stok' && (
        <div className="space-y-3">
          {filteredResellers.filter((r) => partnerInfo[r.id].pcs > 0).length === 0 && (
            <p className={`${CARD} p-8 text-center text-xs text-slate-500`}>Tidak ada barang titipan pada mitra yang dipilih.</p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredResellers
              .filter((r) => partnerInfo[r.id].pcs > 0)
              .map((res) => {
                const info = partnerInfo[res.id];
                return (
                  <div key={res.id} className={`${CARD} overflow-hidden`}>
                    <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{res.nama}</h3>
                        <p className="text-xs text-slate-500">
                          {info.pcs} pcs · nilai HPP {formatRupiah(info.hppValue)}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => openPartnerForm('kirim', res.id)} className={`${OUTLINE_BUTTON} py-1.5`}>
                          <Send className="w-3.5 h-3.5" /> Kirim
                        </button>
                        <button type="button" onClick={() => openPartnerForm('retur', res.id)} className={`${OUTLINE_BUTTON} py-1.5`}>
                          <RotateCcw className="w-3.5 h-3.5" /> Retur
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                      {Object.entries(info.stock)
                        .filter(([, qty]) => qty > 0)
                        .sort((a, b) => b[1] - a[1])
                        .map(([code, qty]) => (
                          <div key={code} className="px-4 py-2 flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{skuOf(code)?.name || code}</div>
                              <div className="font-mono text-[11px] text-slate-500">{code}</div>
                            </div>
                            <span className="font-mono font-bold text-slate-900 shrink-0">{qty} pcs</span>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB: Surat jalan */}
      {activeTab === 'surat' && (
        <div className={`${CARD} overflow-hidden`}>
          {suratTitip.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-500">Belum ada surat jalan titipan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">No. Surat</th>
                    <th className="px-3 py-3">Mitra</th>
                    <th className="px-3 py-3">Barang</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Nilai titip</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suratTitip.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900">{st.noSurat}</div>
                        <div className="text-slate-500">{st.tanggal}</div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{st.resellerNama}</td>
                      <td className="px-3 py-3 min-w-[220px]">
                        {st.items.map((it) => `${it.qty}× ${it.namaProduk || it.sku}`).join(', ')}
                        {st.catatan && <div className="text-slate-500 italic mt-0.5">{st.catatan}</div>}
                      </td>
                      <td className="px-3 py-3 text-right font-mono whitespace-nowrap">{st.totalQty} pcs</td>
                      <td className="px-3 py-3 text-right font-mono whitespace-nowrap">{formatRupiah(st.totalNilai)}</td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => setPrintSurat(st)} className={`${OUTLINE_BUTTON} py-1.5`}>
                          <Printer className="w-3.5 h-3.5" /> Cetak
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: Laporan laku */}
      {activeTab === 'laku' && (
        <div className={`${CARD} overflow-hidden`}>
          <p className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500">Setiap laporan laku memotong stok di mitra dan otomatis menjadi order penjualan channel Reseller.</p>
          {laporanTitipLaku.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-500">Belum ada laporan laku.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">No. Laporan</th>
                    <th className="px-3 py-3">Mitra & periode</th>
                    <th className="px-3 py-3">Barang laku</th>
                    <th className="px-3 py-3 text-right">Tagihan</th>
                    <th className="px-3 py-3 text-right">Sisa</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {laporanTitipLaku.map((lt) => {
                    const sisa = Math.max(0, lt.totalTagihan - lt.terbayar);
                    return (
                      <tr key={lt.id} className="hover:bg-slate-50 align-top">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono font-semibold text-slate-900">{lt.noLaporan}</div>
                          <div className="text-slate-500">{lt.tanggal}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">{lt.resellerNama}</div>
                          <div className="text-slate-500">{lt.periode}</div>
                        </td>
                        <td className="px-3 py-3 min-w-[220px]">{lt.items.map((it) => `${it.qty}× ${it.namaProduk}`).join(', ')}</td>
                        <td className="px-3 py-3 text-right font-mono whitespace-nowrap">{formatRupiah(lt.totalTagihan)}</td>
                        <td className={`px-3 py-3 text-right font-mono whitespace-nowrap ${sisa > 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'}`}>{formatRupiah(sisa)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${lt.statusBayar === 'lunas' ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-700'}`}>
                            {PAYMENT_LABEL[lt.statusBayar]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: Retur & setoran */}
      {activeTab === 'riwayat' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className={`${CARD} overflow-hidden`}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm">Retur dari mitra</h3>
              <button type="button" onClick={() => openPartnerForm('retur')} className={`${OUTLINE_BUTTON} py-1.5`}>
                <RotateCcw className="w-3.5 h-3.5" /> Catat retur
              </button>
            </div>
            {returHistory.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">Belum ada retur.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
                {returHistory.map((rh) => (
                  <div key={rh.id} className="px-4 py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{rh.lokasi.replace('Reseller: ', '')}</span>
                      <span className="font-mono text-slate-500">{rh.tanggal}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-slate-600 mt-0.5">
                      <span className="truncate">{skuOf(rh.sku)?.name || rh.sku}</span>
                      <span className="font-mono font-semibold text-slate-900 shrink-0">{Math.abs(rh.qty)} pcs</span>
                    </div>
                    {rh.catatan && <p className="text-slate-500 italic mt-0.5">{rh.catatan}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`${CARD} overflow-hidden`}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm">Setoran uang dari mitra</h3>
              <button type="button" onClick={() => openPartnerForm('setoran')} className={`${OUTLINE_BUTTON} py-1.5`}>
                <DollarSign className="w-3.5 h-3.5" /> Catat setoran
              </button>
            </div>
            {setoranHistory.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">Belum ada setoran.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
                {setoranHistory.map((sh) => (
                  <div key={sh.id} className="px-4 py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{sh.deskripsi || 'Setoran reseller'}</span>
                      <span className="font-mono text-slate-500 shrink-0">{sh.tanggal}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-slate-600 mt-0.5">
                      <span>Masuk ke {sh.accountNama}</span>
                      <span className="font-mono font-semibold text-slate-900">+{formatRupiah(sh.jumlah)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Kirim titipan */}
      {openForm === 'kirim' && (
        <Modal title="Kirim Titipan" subtitle="Barang keluar dari Gudang Utama ke toko mitra; surat jalan dibuat otomatis." onClose={closeForm} size="lg">
          <form onSubmit={handleSaveKirim} className="space-y-3.5 text-xs">
            <FormError message={formError} />
            {resellerSelect('Mitra tujuan *')}
            {itemRows('Harga titip (Rp)')}
            <Field label="Catatan / ekspedisi">
              <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Contoh: kirim via Lalamove" className={INPUT} />
            </Field>
            <FormActions onCancel={closeForm} submitLabel="Kirim & buat surat jalan" />
          </form>
        </Modal>
      )}

      {/* MODAL: Lapor laku */}
      {openForm === 'laku' && (
        <Modal title="Lapor Barang Laku" subtitle="Memotong stok di mitra dan membuat order penjualan." onClose={closeForm} size="lg">
          <form onSubmit={handleSaveLaku} className="space-y-3.5 text-xs">
            <FormError message={formError} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resellerSelect('Mitra *')}
              <Field label="Periode">
                <input type="text" value={lakuPeriode} onChange={(e) => setLakuPeriode(e.target.value)} className={INPUT} />
              </Field>
            </div>
            {itemRows('Harga titip (Rp)')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Pembayaran" hint={lakuStatusBayar === 'lunas' ? 'Uang langsung dicatat masuk kas.' : 'Sisa tagihan ditagih lewat Catat Setoran.'}>
                <select value={lakuStatusBayar} onChange={(e) => setLakuStatusBayar(e.target.value as PaymentStatus)} className={INPUT}>
                  <option value="piutang">Belum dibayar (jadi tagihan)</option>
                  <option value="sebagian">Dibayar sebagian</option>
                  <option value="lunas">Sudah lunas</option>
                </select>
              </Field>
              {lakuStatusBayar === 'sebagian' && (
                <Field label="Sudah dibayar (Rp)">
                  <input type="number" min="1" value={lakuTerbayar || ''} onChange={(e) => setLakuTerbayar(Number(e.target.value) || 0)} className={`${INPUT} font-mono`} />
                </Field>
              )}
            </div>
            <FormActions onCancel={closeForm} submitLabel="Simpan laporan" />
          </form>
        </Modal>
      )}

      {/* MODAL: Retur */}
      {openForm === 'retur' && (
        <Modal title="Retur dari Mitra" subtitle="Tarik barang titipan kembali ke gudang atau ke barang reject." onClose={closeForm} size="lg">
          <form onSubmit={handleSaveRetur} className="space-y-3.5 text-xs">
            <FormError message={formError} />
            {resellerSelect('Mitra *')}
            {itemRows('')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Kondisi barang">
                <select value={returKondisi} onChange={(e) => setReturKondisi(e.target.value as ReturKondisi)} className={INPUT}>
                  <option value="baik_ke_gudang">Baik, masuk gudang</option>
                  <option value="rusak_ke_reject">Rusak, masuk reject</option>
                </select>
              </Field>
              <Field label="Alasan">
                <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Contoh: warna kurang laku" className={INPUT} />
              </Field>
            </div>
            <FormActions onCancel={closeForm} submitLabel="Simpan retur" />
          </form>
        </Modal>
      )}

      {/* MODAL: Setoran */}
      {openForm === 'setoran' && (
        <Modal title="Catat Setoran Mitra" subtitle="Uang masuk ke kas dan memotong tagihan mitra, mulai dari order terlama." onClose={closeForm}>
          <form onSubmit={handleSaveSetoran} className="space-y-3.5 text-xs">
            <FormError message={formError} />
            {resellerSelect('Mitra *', true)}
            <Field
              label="Nominal (Rp) *"
              hint={
                formPartner && setoranAmount > formPartner.piutang ? (
                  <span className="text-rose-700">
                    Melebihi tagihan {formatRupiah(formPartner.piutang)}. Kelebihan {formatRupiah(setoranAmount - formPartner.piutang)} tetap masuk kas tetapi tidak memotong tagihan.
                  </span>
                ) : formPartner ? (
                  `Tagihan saat ini ${formatRupiah(formPartner.piutang)}`
                ) : undefined
              }
            >
              <input type="number" min="1" required value={setoranAmount || ''} onChange={(e) => setSetoranAmount(Number(e.target.value) || 0)} className={`${INPUT} font-mono`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Metode">
                <select value={setoranMethod} onChange={(e) => setSetoranMethod(e.target.value)} className={INPUT}>
                  <option value="Transfer BCA">Transfer BCA</option>
                  <option value="Transfer Mandiri">Transfer Mandiri</option>
                  <option value="Cash / Tunai">Tunai</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </Field>
              <Field label="Masuk ke akun">
                <select value={setoranAccountId} onChange={(e) => setSetoranAccountId(e.target.value)} className={INPUT}>
                  <option value="">Otomatis sesuai metode</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Catatan">
              <input type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Contoh: setoran penjualan November" className={INPUT} />
            </Field>
            <FormActions onCancel={closeForm} submitLabel="Simpan setoran" />
          </form>
        </Modal>
      )}

      {/* MODAL: Tambah / edit mitra */}
      {isResellerModalOpen && (
        <Modal title={editingReseller ? 'Edit Mitra' : 'Mitra Baru'} onClose={() => setIsResellerModalOpen(false)} size="lg">
          <form onSubmit={handleSaveResellerForm} className="space-y-3.5 text-xs">
            <FormError message={formError} />
            <Field label="Nama toko / mitra *">
              <input type="text" required value={resNama} onChange={(e) => setResNama(e.target.value)} placeholder="Contoh: Distro Kalima Makassar" className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama PIC">
                <input type="text" value={resPic} onChange={(e) => setResPic(e.target.value)} className={INPUT} />
              </Field>
              <Field label="No. WhatsApp *">
                <input type="tel" required value={resHp} onChange={(e) => setResHp(e.target.value)} placeholder="0812…" className={`${INPUT} font-mono`} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Level">
                <select
                  value={resLevel}
                  onChange={(e) => {
                    const lvl = e.target.value as Level;
                    setResLevel(lvl);
                    setResDiskon(LEVEL_PRESET[lvl].diskon);
                    setResPlafon(LEVEL_PRESET[lvl].plafon);
                  }}
                  className={INPUT}
                >
                  <option value="Platinum">Platinum</option>
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                </select>
              </Field>
              <Field label="Diskon (%)">
                <input type="number" min="0" max="50" value={resDiskon} onChange={(e) => setResDiskon(Number(e.target.value) || 0)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Kota">
                <input type="text" value={resKota} onChange={(e) => setResKota(e.target.value)} placeholder="Contoh: Makassar" className={INPUT} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plafon titipan (Rp)" hint={`${formatRupiah(resPlafon)}, dihitung dengan harga titip`}>
                <input type="number" min="0" step="500000" value={resPlafon} onChange={(e) => setResPlafon(Number(e.target.value) || 0)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Jadwal setoran">
                <input type="text" value={resJadwal} onChange={(e) => setResJadwal(e.target.value)} placeholder="Contoh: setiap hari Senin" className={INPUT} />
              </Field>
            </div>
            <Field label="Alamat toko">
              <textarea rows={2} value={resAlamat} onChange={(e) => setResAlamat(e.target.value)} placeholder="Jalan, nomor, kecamatan" className={INPUT} />
            </Field>
            <FormActions onCancel={() => setIsResellerModalOpen(false)} submitLabel={editingReseller ? 'Simpan' : 'Tambah mitra'} />
          </form>
        </Modal>
      )}

      {/* MODAL: Hapus mitra */}
      {deleteModalReseller &&
        (() => {
          const info = partnerInfo[deleteModalReseller.id];
          return (
            <Modal title="Hapus mitra?" icon={<AlertCircle className="w-5 h-5 text-rose-700 mt-0.5" />} onClose={() => setDeleteModalReseller(null)}>
              <div className="space-y-3 text-xs text-slate-700">
                <FormError message={formError} />
                <div className="p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-sm font-bold text-slate-900">{deleteModalReseller.nama}</div>
                  <div className="text-slate-500">
                    {[deleteModalReseller.level || 'Silver', deleteModalReseller.noHp, displayCity(deleteModalReseller.kota)].filter(Boolean).join(' · ')}
                  </div>
                  <div>
                    {info?.pcs || 0} pcs dititip · tagihan {formatRupiah(info?.piutang || 0)}
                  </div>
                </div>
                {info && info.pcs > 0 && (
                  <label className="flex items-start gap-2 p-3 rounded-xl border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={deleteReturnStock} onChange={(e) => setDeleteReturnStock(e.target.checked)} className="mt-0.5 w-4 h-4" />
                    <span>
                      <span className="font-semibold text-slate-900 block">Tarik {info.pcs} pcs titipan ke Gudang Utama</span>
                      <span className="text-slate-500">Dicatat sebagai retur titipan agar stok gudang sesuai fisik.</span>
                    </span>
                  </label>
                )}
                {info && info.piutang > 0 && <p>Tagihan {formatRupiah(info.piutang)} tetap tercatat di order dan buku kas.</p>}
                <p>Customer yang tertaut di CRM kembali menjadi customer biasa.</p>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setDeleteModalReseller(null)} className={OUTLINE_BUTTON}>
                    Batal
                  </button>
                  <button type="button" onClick={handleConfirmDeleteReseller} className={DANGER_BUTTON}>
                    <Trash2 className="w-3.5 h-3.5" /> Hapus mitra
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()}

      {/* MODAL: Cetak surat jalan */}
      {printSurat &&
        (() => {
          const partner = resellerOf(printSurat.resellerId);
          return (
            <Modal title="Surat Jalan Titipan" subtitle={printSurat.noSurat} onClose={() => setPrintSurat(null)} size="xl">
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button type="button" onClick={() => window.print()} className={PRIMARY_BUTTON}>
                    <Printer className="w-3.5 h-3.5" /> Cetak / simpan PDF
                  </button>
                </div>
                <div className="p-6 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs">
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                    <div>
                      <div className="text-xl font-black tracking-wider">KALIMA</div>
                      <div className="text-slate-600">Surat jalan barang titipan (konsinyasi)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm">{printSurat.noSurat}</div>
                      <div className="text-slate-600">Tanggal {printSurat.tanggal}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 my-4">
                    <div>
                      <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">Penerima</div>
                      <div className="font-bold text-sm">{printSurat.resellerNama}</div>
                      {partner && (
                        <div className="text-slate-600">
                          {[partner.alamat, displayCity(partner.kota)].filter(Boolean).join(', ')}
                          <br />
                          {[partner.kontakPerson, partner.noHp].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">Keterangan</div>
                      <div className="text-slate-700">{printSurat.catatan || 'Pengiriman titipan'}</div>
                    </div>
                  </div>
                  <table className="w-full text-left border border-slate-300">
                    <thead className="bg-slate-100 font-bold border-b border-slate-300">
                      <tr>
                        <th className="px-2 py-2">No.</th>
                        <th className="px-2 py-2">SKU</th>
                        <th className="px-2 py-2">Produk</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="px-2 py-2 text-right">Harga titip</th>
                        <th className="px-2 py-2 text-right">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {printSurat.items.map((it, idx) => (
                        <tr key={`${it.sku}-${idx}`}>
                          <td className="px-2 py-1.5 font-mono">{idx + 1}</td>
                          <td className="px-2 py-1.5 font-mono">{it.sku}</td>
                          <td className="px-2 py-1.5">{it.namaProduk}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{it.qty}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{formatRupiah(it.hargaTitip)}</td>
                          <td className="px-2 py-1.5 text-right font-mono font-bold">{formatRupiah(it.qty * it.hargaTitip)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-300">
                      <tr>
                        <td colSpan={3} className="px-2 py-2 text-right">
                          Total
                        </td>
                        <td className="px-2 py-2 text-right font-mono">{printSurat.totalQty} pcs</td>
                        <td />
                        <td className="px-2 py-2 text-right font-mono">{formatRupiah(printSurat.totalNilai)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <div className="grid grid-cols-2 gap-10 mt-10 text-center text-slate-700">
                    <div>
                      <p className="mb-12">Diserahkan oleh</p>
                      <p className="font-bold text-slate-900">Gudang Kalima</p>
                    </div>
                    <div>
                      <p className="mb-12">Diterima oleh</p>
                      <p className="font-bold text-slate-900">{printSurat.resellerNama}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Modal>
          );
        })()}

      {resellers.length === 0 && (
        <div className={`${CARD} p-10 text-center text-xs text-slate-500`}>
          <Store className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Belum ada mitra.</p>
          <p className="mt-1">Tambahkan lewat tombol Mitra Baru atau jadikan customer sebagai mitra dari halaman Customer CRM.</p>
        </div>
      )}
    </div>
  );
};
