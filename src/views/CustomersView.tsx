import React, { useState, useMemo } from 'react';
import { useSearchHandoff } from '../hooks/useSearchHandoff';
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  ShoppingBag,
  Store,
  Crown,
  ArrowUpRight,
  CheckCircle2,
  Receipt,
  Edit2,
  Trash2,
  Sparkles,
  Zap,
  ChevronDown,
  Upload,
  Download,
  CheckSquare,
  Square,
  AlertTriangle,
  RefreshCw,
  X,
  Building2,
  MoreHorizontal,
  ArrowRight,
} from 'lucide-react';
import { useApp, normalizePhone } from '../context/AppContext';
import { Customer, Order, SalesChannelName } from '../types';
import { askConfirm } from '../services/dialogStore';
import { CustomerSegment, FrequencyTier, displayCity, formatCompactRupiah, frequencyTier, resolveSegment } from '../services/customerSegments';

export type MainCategoryTab = 'ALL' | CustomerSegment;
export type FrequencyFilter = 'ALL' | FrequencyTier;
export type SortOption = 'ltv_desc' | 'orders_desc' | 'recent' | 'name_asc';

const PAGE_SIZE = 20;
const SEGMENTS: CustomerSegment[] = ['Umum', 'Reseller', 'Marketplace', 'VIP', 'Internal'];

const SEGMENT_INFO: Record<CustomerSegment, { label: string; hint: string; icon: React.ElementType }> = {
  Umum: { label: 'Umum', hint: 'Retail / langsung', icon: ShoppingBag },
  Reseller: { label: 'Reseller', hint: 'Mitra konsinyasi & grosir', icon: Store },
  Marketplace: { label: 'Marketplace', hint: 'Shopee / TikTok Shop', icon: Zap },
  VIP: { label: 'VIP', hint: 'Pelanggan prioritas', icon: Crown },
  Internal: { label: 'Internal', hint: 'Akun penampung / milik sendiri, tidak dihitung sebagai pelanggan', icon: Building2 },
};

const FREQUENCY_LABELS: Record<FrequencyFilter, string> = {
  ALL: 'Semua frekuensi',
  baru: 'Baru (1x order)',
  reguler: 'Reguler (2–4x)',
  loyal: 'Loyal (≥5x)',
  no_order: 'Belum pernah order',
};

const SORT_LABELS: Record<SortOption, string> = {
  ltv_desc: 'Urut: Belanja terbesar',
  orders_desc: 'Urut: Order terbanyak',
  recent: 'Urut: Order terbaru',
  name_asc: 'Urut: Nama A–Z',
};

const CARD = 'bg-white rounded-2xl border border-slate-200';
const INPUT = 'w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-slate-500';
const OUTLINE_BUTTON =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer';
const PRIMARY_BUTTON = 'segmented-pill-active inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer';
const ICON_BUTTON = 'w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer';
const DANGER_BUTTON = 'inline-flex items-center gap-1.5 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs cursor-pointer';

const formatRupiah = (val: number) => `Rp ${Math.round(val).toLocaleString('id-ID')}`;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || 'CU').toUpperCase();
};

const whatsappNumber = (phone: string): string => {
  const clean = (phone || '').replace(/[^0-9]/g, '');
  return clean.startsWith('0') ? `62${clean.substring(1)}` : clean;
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
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
        size === 'xl' ? 'max-w-3xl' : size === 'lg' ? 'max-w-lg' : 'max-w-md'
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

const SegmentBadge: React.FC<{ segment: CustomerSegment; onClick?: () => void }> = ({ segment, onClick }) => {
  const info = SEGMENT_INFO[segment];
  const Icon = info.icon;
  const className = `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
    segment === 'Internal' ? 'border border-dashed border-slate-400 text-slate-600' : 'bg-slate-100 text-slate-800'
  }`;
  if (!onClick) {
    return (
      <span className={className}>
        <Icon className="w-3 h-3" aria-hidden="true" />
        {info.label}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${className} cursor-pointer hover:brightness-95`} title="Ubah segmen" aria-label={`Segmen ${info.label}, klik untuk mengubah`}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {info.label}
      <ChevronDown className="w-3 h-3 opacity-60" aria-hidden="true" />
    </button>
  );
};

type CustomerStats = {
  totalOrders: number;
  totalPcs: number;
  totalSpent: number;
  lastOrderDate?: string;
  lastChannel?: SalesChannelName;
  channelsUsed: Set<SalesChannelName>;
  topItem?: string;
  ordersList: Order[];
  resolvedCategory: CustomerSegment;
  isManualTagged: boolean;
  frequencyTier: FrequencyTier;
};

export const CustomersView: React.FC = () => {
  const {
    customers,
    orders,
    resellers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    bulkDeleteCustomers,
    mergeDuplicateCustomers,
    promoteCustomerToReseller,
    syncCustomersFromOrders,
    setQuickOrderModalOpen,
    isOwner,
    setCurrentView,
  } = useApp();

  const [selectedCategoryTab, setSelectedCategoryTab] = useState<MainCategoryTab>('ALL');
  const [selectedFreqFilter, setSelectedFreqFilter] = useState<FrequencyFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('ltv_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerPage, setCustomerPage] = useState<number>(1);
  useSearchHandoff('customers', setSearchQuery);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<Customer | null>(null);
  const [activeTagDropdownId, setActiveTagDropdownId] = useState<string | null>(null);

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [editCustomerModal, setEditCustomerModal] = useState<Customer | null>(null);
  const [historyCustomerModal, setHistoryCustomerModal] = useState<Customer | null>(null);
  const [promoteCustomerModal, setPromoteCustomerModal] = useState<Customer | null>(null);

  const [newCustNama, setNewCustNama] = useState('');
  const [newCustHp, setNewCustHp] = useState('');
  const [newCustKota, setNewCustKota] = useState('');
  const [newCustCategory, setNewCustCategory] = useState<CustomerSegment>('Umum');
  const [newCustAlamat, setNewCustAlamat] = useState('');
  const [newCustCatatan, setNewCustCatatan] = useState('');

  const [mitraLevel, setMitraLevel] = useState<'Platinum' | 'Gold' | 'Silver'>('Gold');
  const [mitraDiskon, setMitraDiskon] = useState<number>(20);
  const [mitraPlafon, setMitraPlafon] = useState<number>(10000000);
  const [mitraJadwal, setMitraJadwal] = useState('Setiap Hari Senin');
  const [mitraAlamat, setMitraAlamat] = useState('');

  const flash = (message: string, ms = 4000) => {
    setSyncStatus(message);
    setTimeout(() => setSyncStatus(null), ms);
  };

  // 1. Statistik & segmen setiap customer
  const customerStatsMap = useMemo(() => {
    const stats: Record<string, CustomerStats & { marketplace: number; direct: number; reseller: number }> = {};
    const phoneMap = new Map<string, string>();
    const nameMap = new Map<string, string>();

    customers.forEach((c) => {
      const normPhone = normalizePhone(c.noHp);
      if (normPhone && normPhone.length >= 8) {
        phoneMap.set(normPhone, c.id);
      }
      if (c.nama) {
        nameMap.set(c.nama.trim().toLowerCase(), c.id);
      }
      stats[c.id] = {
        totalOrders: 0,
        totalPcs: 0,
        totalSpent: 0,
        channelsUsed: new Set<SalesChannelName>(),
        ordersList: [],
        resolvedCategory: 'Umum',
        isManualTagged: false,
        frequencyTier: 'no_order',
        marketplace: 0,
        direct: 0,
        reseller: 0,
      };
    });

    orders.forEach((ord) => {
      let targetCustId = ord.customerId;
      if (!stats[targetCustId]) {
        const ordNormPhone = normalizePhone(ord.customerHp);
        if (ordNormPhone && phoneMap.has(ordNormPhone)) {
          targetCustId = phoneMap.get(ordNormPhone)!;
        } else if (ord.customerNama && nameMap.has(ord.customerNama.trim().toLowerCase())) {
          targetCustId = nameMap.get(ord.customerNama.trim().toLowerCase())!;
        }
      }
      const s = stats[targetCustId];
      if (!s || ord.statusOrder === 'batal') {
        return;
      }
      s.totalOrders += 1;
      s.totalPcs += ord.items.reduce((acc, it) => acc + it.qty, 0);
      s.totalSpent += ord.totalTagihan;
      s.channelsUsed.add(ord.channel);
      s.ordersList.push(ord);
      if (ord.channel === 'Shopee' || ord.channel === 'TikTok') {
        s.marketplace += 1;
      } else if (ord.channel === 'Reseller') {
        s.reseller += 1;
      } else {
        s.direct += 1;
      }
      if (!s.lastOrderDate || ord.tanggal > s.lastOrderDate) {
        s.lastOrderDate = ord.tanggal;
        s.lastChannel = ord.channel;
      }
    });

    customers.forEach((cust) => {
      const s = stats[cust.id];
      s.frequencyTier = frequencyTier(s.totalOrders);
      s.ordersList.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      const itemFrequency: Record<string, number> = {};
      s.ordersList.forEach((ord) => ord.items.forEach((it) => (itemFrequency[it.namaProduk] = (itemFrequency[it.namaProduk] || 0) + it.qty)));
      const [top] = Object.entries(itemFrequency).sort((a, b) => b[1] - a[1]);
      if (top) {
        s.topItem = `${top[0]} (${top[1]} pcs)`;
      }
      const resolved = resolveSegment(cust, {
        totalOrders: s.totalOrders,
        totalSpent: s.totalSpent,
        marketplaceOrders: s.marketplace,
        directOrders: s.direct,
        resellerOrders: s.reseller,
      });
      s.resolvedCategory = resolved.segment;
      s.isManualTagged = resolved.isManual;
    });

    return stats as Record<string, CustomerStats>;
  }, [customers, orders]);

  // 2. Jumlah & total belanja per segmen
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(['ALL', ...SEGMENTS].map((key) => [key, { count: 0, totalSpent: 0 }])) as Record<
      MainCategoryTab,
      { count: number; totalSpent: number }
    >;
    customers.forEach((c) => {
      const s = customerStatsMap[c.id];
      const cat = s?.resolvedCategory || 'Umum';
      const spent = s?.totalSpent || 0;
      counts.ALL.count += 1;
      counts.ALL.totalSpent += spent;
      counts[cat].count += 1;
      counts[cat].totalSpent += spent;
    });
    return counts;
  }, [customers, customerStatsMap]);

  // 3. Filter & urutan
  const sortedCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = customers.filter((cust) => {
      const stats = customerStatsMap[cust.id];
      if (!stats) {
        return false;
      }
      if (selectedCategoryTab !== 'ALL' && stats.resolvedCategory !== selectedCategoryTab) {
        return false;
      }
      if (selectedFreqFilter !== 'ALL' && stats.frequencyTier !== selectedFreqFilter) {
        return false;
      }
      if (q) {
        const haystack = [cust.nama, cust.noHp, cust.kota, cust.alamat, cust.catatan, stats.resolvedCategory].map((v) => (v || '').toLowerCase());
        return haystack.some((value) => value.includes(q));
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const statsA = customerStatsMap[a.id];
      const statsB = customerStatsMap[b.id];
      if (sortBy === 'ltv_desc') {
        return statsB.totalSpent - statsA.totalSpent;
      }
      if (sortBy === 'orders_desc') {
        return statsB.totalOrders - statsA.totalOrders;
      }
      if (sortBy === 'recent') {
        return (statsB.lastOrderDate || '').localeCompare(statsA.lastOrderDate || '');
      }
      return a.nama.localeCompare(b.nama);
    });
  }, [customers, selectedCategoryTab, selectedFreqFilter, searchQuery, customerStatsMap, sortBy]);

  const totalCustomerPages = Math.max(1, Math.ceil(sortedCustomers.length / PAGE_SIZE));
  const currentPage = Math.min(customerPage, totalCustomerPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedCustomers = sortedCustomers.slice(pageStart, pageStart + PAGE_SIZE);
  const allOnPageSelected = paginatedCustomers.length > 0 && paginatedCustomers.every((c) => selectedCustomerIds.has(c.id));

  /** Ganti filter: kembali ke halaman 1 dan kosongkan pilihan agar aksi massal tidak mengenai baris yang tak terlihat. */
  const withReset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setCustomerPage(1);
    setSelectedCustomerIds(new Set());
  };

  // Handlers
  const handleSetQuickTag = (customerId: string, newCategory: CustomerSegment) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) {
      return;
    }
    updateCustomer(customerId, { tipe: newCategory === 'Umum' ? 'Retail' : newCategory, kategoriManual: newCategory });
    setActiveTagDropdownId(null);
    flash(`Segmen "${cust.nama}" diubah menjadi ${SEGMENT_INFO[newCategory].label}.`);
  };

  const handleResetToAutoTag = (customerId: string) => {
    updateCustomer(customerId, { kategoriManual: undefined });
    setActiveTagDropdownId(null);
    flash('Segmen dikembalikan ke deteksi otomatis.');
  };

  const handleSaveNewCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustNama.trim()) {
      return;
    }
    addCustomer({
      nama: newCustNama.trim(),
      noHp: newCustHp.trim(),
      kota: newCustKota.trim(),
      tipe: newCustCategory === 'Umum' ? 'Retail' : newCustCategory,
      kategoriManual: newCustCategory,
      alamat: newCustAlamat.trim(),
      catatan: newCustCatatan.trim(),
    });
    setIsAddCustomerOpen(false);
    setNewCustNama('');
    setNewCustHp('');
    setNewCustKota('');
    setNewCustCategory('Umum');
    setNewCustAlamat('');
    setNewCustCatatan('');
    flash('Customer baru disimpan.');
  };

  const handleSaveEditCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomerModal) {
      return;
    }
    updateCustomer(editCustomerModal.id, {
      nama: editCustomerModal.nama,
      noHp: editCustomerModal.noHp,
      kota: editCustomerModal.kota,
      tipe: editCustomerModal.tipe,
      kategoriManual: editCustomerModal.kategoriManual,
      alamat: editCustomerModal.alamat,
      catatan: editCustomerModal.catatan,
    });
    setEditCustomerModal(null);
    flash('Data customer diperbarui.');
  };

  const handleOpenPromote = (cust: Customer) => {
    setPromoteCustomerModal(cust);
    setMitraLevel('Gold');
    setMitraDiskon(20);
    setMitraPlafon(10000000);
    setMitraJadwal('Setiap Hari Senin');
    setMitraAlamat(cust.alamat || displayCity(cust.kota));
  };

  const handleConfirmPromote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteCustomerModal) {
      return;
    }
    promoteCustomerToReseller(promoteCustomerModal.id, {
      level: mitraLevel,
      diskonPersen: mitraDiskon,
      batasPlafonTitipan: mitraPlafon,
      jadwalSetoran: mitraJadwal,
      alamat: mitraAlamat,
    });
    setPromoteCustomerModal(null);
    flash(`"${promoteCustomerModal.nama}" sekarang tercatat sebagai mitra reseller.`);
  };

  const handleSyncOrders = async () => {
    const confirmed = await askConfirm(
      `Customer baru akan dibuat dari nama & nomor HP di ${orders.length} order, lalu kontak dengan nomor HP sama digabung menjadi satu profil. Penggabungan tidak bisa dibatalkan.`,
      { title: 'Tarik customer dari order?', confirmLabel: 'Tarik & gabungkan' },
    );
    if (!confirmed) {
      return;
    }
    const res = syncCustomersFromOrders();
    flash(
      res.count > 0 || res.mergedCount > 0
        ? `${res.count} customer baru ditambahkan, ${res.mergedCount} kontak dengan nomor HP sama digabung.`
        : 'Semua customer dari order sudah tercatat; tidak ada nomor HP ganda.',
      6000,
    );
  };

  const handleMergeDuplicates = async () => {
    const confirmed = await askConfirm(
      'Customer dengan nomor HP yang sama akan digabung menjadi satu profil (riwayat order ikut dipindah). Penggabungan tidak bisa dibatalkan.',
      { title: 'Gabungkan kontak duplikat?', confirmLabel: 'Gabungkan', danger: true },
    );
    if (!confirmed) {
      return;
    }
    const res = mergeDuplicateCustomers();
    flash(res.mergedCount > 0 ? `${res.mergedCount} kontak duplikat digabung.` : 'Tidak ada nomor HP ganda.', 6000);
  };

  const handleToggleSelectPage = () => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      paginatedCustomers.forEach((c) => (allOnPageSelected ? next.delete(c.id) : next.add(c.id)));
      return next;
    });
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmSingleDelete = () => {
    if (!deleteConfirmCustomer) {
      return;
    }
    deleteCustomer(deleteConfirmCustomer.id);
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteConfirmCustomer.id);
      return next;
    });
    flash(`Customer "${deleteConfirmCustomer.nama}" dihapus.`);
    setDeleteConfirmCustomer(null);
  };

  const handleConfirmBulkDelete = () => {
    if (selectedCustomerIds.size === 0) {
      return;
    }
    const count = selectedCustomerIds.size;
    bulkDeleteCustomers(Array.from(selectedCustomerIds));
    setSelectedCustomerIds(new Set());
    setIsBulkDeleteModalOpen(false);
    flash(`${count} customer dihapus.`);
  };

  const handleBulkSetCategory = async (newCat: CustomerSegment) => {
    if (selectedCustomerIds.size === 0) {
      return;
    }
    const count = selectedCustomerIds.size;
    const confirmed = await askConfirm(`Segmen ${count} customer terpilih akan diubah menjadi ${SEGMENT_INFO[newCat].label} (manual).`, {
      title: 'Ubah segmen?',
      confirmLabel: 'Ubah segmen',
    });
    if (!confirmed) {
      return;
    }
    selectedCustomerIds.forEach((id) => updateCustomer(id, { tipe: newCat === 'Umum' ? 'Retail' : newCat, kategoriManual: newCat }));
    setSelectedCustomerIds(new Set());
    flash(`Segmen ${count} customer diubah menjadi ${SEGMENT_INFO[newCat].label}.`);
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Nama Customer', 'Nomor WhatsApp/HP', 'Kota', 'Segmen', 'Tipe Customer', 'Total Order', 'Total Qty (Pcs)', 'Total Belanja', 'Order Terakhir', 'Channel Terakhir', 'Alamat', 'Catatan'];
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = customers.map((c) => {
      const s = customerStatsMap[c.id];
      return [
        quote(c.id),
        quote(c.nama),
        quote(c.noHp || ''),
        quote(displayCity(c.kota)),
        quote(s?.resolvedCategory || 'Umum'),
        quote(c.tipe),
        s?.totalOrders || 0,
        s?.totalPcs || 0,
        s?.totalSpent || 0,
        quote(s?.lastOrderDate || '-'),
        quote(s?.lastChannel || '-'),
        quote(c.alamat || ''),
        quote(c.catatan || ''),
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,﻿' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Kalima_Customers_Database_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    flash('File CSV customer diunduh.');
  };

  const handleProcessImportCsv = () => {
    setImportError(null);
    if (!importCsvText.trim()) {
      setImportError('Tempel data dari Excel atau CSV terlebih dahulu.');
      return;
    }
    try {
      const lines = importCsvText.trim().split(/\r?\n/);
      let successCount = 0;
      lines.forEach((line, idx) => {
        if (!line.trim()) {
          return;
        }
        const lower = line.toLowerCase();
        if (idx === 0 && (lower.includes('nama') || lower.includes('customer') || lower.includes('telepon'))) {
          return;
        }
        const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
        const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
        const [nama = '', noHp = '', kota = '', rawCat = 'Umum', alamat = '', catatan = ''] = parts;
        if (!nama.trim()) {
          return;
        }
        const cat = rawCat.toLowerCase();
        const categoryValid: CustomerSegment =
          cat.includes('reseller') || cat.includes('mitra')
            ? 'Reseller'
            : cat.includes('shopee') || cat.includes('tiktok') || cat.includes('market')
              ? 'Marketplace'
              : cat.includes('vip')
                ? 'VIP'
                : 'Umum';
        addCustomer({
          nama: nama.trim(),
          noHp: noHp.trim(),
          kota: kota.trim(),
          tipe: categoryValid === 'Umum' ? 'Retail' : categoryValid,
          kategoriManual: categoryValid,
          alamat: alamat.trim(),
          catatan: catatan.trim(),
        });
        successCount++;
      });
      setIsImportModalOpen(false);
      setImportCsvText('');
      flash(`${successCount} customer diimpor.`, 5000);
    } catch {
      setImportError('Gagal memproses data. Pastikan urutan kolom sesuai contoh.');
    }
  };

  const segmentMenu = (cust: Customer) => (
    <>
      <button type="button" aria-label="Tutup menu segmen" className="fixed inset-0 z-30 cursor-default" onClick={() => setActiveTagDropdownId(null)} />
      <div className="absolute left-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl p-1.5 z-40 shadow-2xl space-y-0.5" role="menu">
        <div className="text-[11px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider">Ubah segmen</div>
        {SEGMENTS.map((segment) => {
          const Icon = SEGMENT_INFO[segment].icon;
          return (
            <button
              key={segment}
              type="button"
              role="menuitem"
              onClick={() => handleSetQuickTag(cust.id, segment)}
              className="w-full flex items-start gap-2 px-2 py-1.5 rounded-xl text-xs text-slate-800 hover:bg-slate-100 text-left cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5 mt-0.5 text-slate-500 shrink-0" />
              <span>
                <span className="font-semibold block">{SEGMENT_INFO[segment].label}</span>
                <span className="text-[11px] text-slate-500">{SEGMENT_INFO[segment].hint}</span>
              </span>
            </button>
          );
        })}
        {cust.kategoriManual && (
          <button
            type="button"
            role="menuitem"
            onClick={() => handleResetToAutoTag(cust.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-100 text-left border-t border-slate-100 mt-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>Kembalikan ke deteksi otomatis</span>
          </button>
        )}
      </div>
    </>
  );

  const contactLine = (cust: Customer) => {
    const city = displayCity(cust.kota);
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
        {cust.noHp && cust.noHp.trim() !== '-' ? (
          <a
            href={`https://wa.me/${whatsappNumber(cust.noHp)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-slate-900 font-mono"
            title="Buka WhatsApp"
          >
            <Phone className="w-3 h-3" aria-hidden="true" />
            {cust.noHp}
            <ArrowUpRight className="w-2.5 h-2.5 opacity-60" aria-hidden="true" />
          </a>
        ) : (
          <span>Tanpa no. HP</span>
        )}
        {city && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" aria-hidden="true" />
            {city}
          </span>
        )}
      </div>
    );
  };

  const frequencyText = (stats: CustomerStats) =>
    stats.frequencyTier === 'no_order' ? 'Belum ada order' : stats.frequencyTier === 'baru' ? 'Pelanggan baru' : `${stats.frequencyTier === 'loyal' ? 'Loyal' : 'Reguler'} · ${stats.totalOrders}x order`;

  const rowActions = (cust: Customer, stats: CustomerStats) => (
    <div className="flex items-center justify-end gap-1.5">
      {stats.resolvedCategory !== 'Internal' &&
        (stats.resolvedCategory === 'Reseller' ? (
          <button type="button" onClick={() => setCurrentView('reseller')} className={ICON_BUTTON} title="Kelola mitra" aria-label={`Kelola mitra ${cust.nama}`}>
            <Store className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button type="button" onClick={() => handleOpenPromote(cust)} className={ICON_BUTTON} title="Jadikan mitra reseller" aria-label={`Jadikan ${cust.nama} mitra reseller`}>
            <Crown className="w-3.5 h-3.5" />
          </button>
        ))}
      <button type="button" onClick={() => setHistoryCustomerModal(cust)} className={ICON_BUTTON} title="Riwayat order" aria-label={`Riwayat order ${cust.nama}`}>
        <Receipt className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => setEditCustomerModal(cust)} className={ICON_BUTTON} title="Edit data" aria-label={`Edit ${cust.nama}`}>
        <Edit2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setDeleteConfirmCustomer(cust)}
        className={`${ICON_BUTTON} text-rose-700 hover:bg-rose-50`}
        title="Hapus customer"
        aria-label={`Hapus ${cust.nama}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const historyStats = historyCustomerModal ? customerStatsMap[historyCustomerModal.id] : null;
  const deleteStats = deleteConfirmCustomer ? customerStatsMap[deleteConfirmCustomer.id] : null;

  return (
    <div className="space-y-5 pb-16">
      {syncStatus && (
        <div role="status" className="bg-white border border-slate-200 text-slate-900 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{syncStatus}</span>
          </div>
          <button type="button" aria-label="Tutup pesan" onClick={() => setSyncStatus(null)} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className={`${CARD} p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Database Customer</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {customers.length} kontak · {categoryCounts.VIP.count} VIP · {categoryCounts.Internal.count} akun internal
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setCurrentView('reseller')} className={OUTLINE_BUTTON}>
            <Store className="w-3.5 h-3.5" />
            Mitra Reseller ({resellers.length})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <details className="relative">
            <summary className={`${OUTLINE_BUTTON} list-none`} aria-label="Alat lainnya">
              <MoreHorizontal className="w-4 h-4" />
              Alat
            </summary>
            <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl p-1.5 z-40 shadow-2xl">
              {[
                { label: 'Tarik customer dari order', icon: Sparkles, onClick: handleSyncOrders },
                { label: 'Gabungkan nomor HP ganda', icon: RefreshCw, onClick: handleMergeDuplicates },
                { label: 'Impor dari Excel / CSV', icon: Upload, onClick: () => setIsImportModalOpen(true) },
                { label: 'Ekspor ke CSV', icon: Download, onClick: handleExportCsv },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={(e) => {
                    (e.currentTarget.closest('details') as HTMLDetailsElement).open = false;
                    item.onClick();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-slate-800 hover:bg-slate-100 text-left cursor-pointer"
                >
                  <item.icon className="w-3.5 h-3.5 text-slate-500" />
                  {item.label}
                </button>
              ))}
            </div>
          </details>
          <button type="button" onClick={() => setIsAddCustomerOpen(true)} className={PRIMARY_BUTTON}>
            <Plus className="w-4 h-4" />
            Tambah Customer
          </button>
        </div>
      </div>

      {/* Segmen */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {(['ALL', ...SEGMENTS] as MainCategoryTab[]).map((tab) => {
          const active = selectedCategoryTab === tab;
          const Icon = tab === 'ALL' ? Users : SEGMENT_INFO[tab].icon;
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={active}
              title={tab === 'ALL' ? 'Semua kontak' : SEGMENT_INFO[tab].hint}
              onClick={() => withReset(setSelectedCategoryTab)(tab)}
              className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                active ? 'bg-white border-slate-900 ring-1 ring-slate-900' : 'bg-white border-slate-200 hover:border-slate-400'
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {tab === 'ALL' ? 'Semua' : SEGMENT_INFO[tab].label}
              </span>
              <span className="block text-xl font-bold text-slate-900 font-mono mt-1">{categoryCounts[tab].count}</span>
              <span className="block text-[11px] text-slate-500 truncate">Belanja {formatCompactRupiah(categoryCounts[tab].totalSpent)}</span>
            </button>
          );
        })}
      </div>

      {selectedCategoryTab === 'Internal' && (
        <p className="text-xs text-slate-600 px-1">
          Akun internal = penampung order tanpa data pembeli (mis. "Pelanggan Umum") atau akun milik sendiri. Tidak ikut deteksi VIP. Tandai akun lain lewat
          tombol segmen di tiap baris.
        </p>
      )}

      {/* Tabel customer */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Cari customer"
              placeholder="Cari nama, no. WhatsApp, kota, atau catatan…"
              value={searchQuery}
              onChange={(e) => withReset(setSearchQuery)(e.target.value)}
              className="w-full bg-white border border-slate-300 pl-9 pr-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Frekuensi order"
              value={selectedFreqFilter}
              onChange={(e) => withReset(setSelectedFreqFilter)(e.target.value as FrequencyFilter)}
              className="bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none cursor-pointer"
            >
              {(Object.keys(FREQUENCY_LABELS) as FrequencyFilter[]).map((key) => (
                <option key={key} value={key}>
                  {FREQUENCY_LABELS[key]}
                </option>
              ))}
            </select>
            <select
              aria-label="Urutan"
              value={sortBy}
              onChange={(e) => withReset(setSortBy)(e.target.value as SortOption)}
              className="bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none cursor-pointer"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCustomerIds.size > 0 && (
          <div className="bg-slate-50 border-b border-slate-200 p-3 px-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-900">{selectedCustomerIds.size} customer dipilih</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500">Ubah segmen:</span>
              {SEGMENTS.map((segment) => (
                <button key={segment} type="button" onClick={() => handleBulkSetCategory(segment)} className={`${OUTLINE_BUTTON} py-1`}>
                  {SEGMENT_INFO[segment].label}
                </button>
              ))}
              <button type="button" onClick={() => setIsBulkDeleteModalOpen(true)} className={`${OUTLINE_BUTTON} py-1 text-rose-700`}>
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </button>
              <button type="button" onClick={() => setSelectedCustomerIds(new Set())} className={`${OUTLINE_BUTTON} py-1`}>
                Batal pilih
              </button>
            </div>
          </div>
        )}

        {sortedCustomers.length === 0 ? (
          <div className="px-4 py-14 text-center text-slate-500 text-xs">
            <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">Tidak ada customer yang cocok.</p>
            <p className="mt-1">Ubah kata kunci atau pilih segmen lain.</p>
          </div>
        ) : (
          <>
            {/* Desktop: tabel */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="w-10 px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectPage}
                        aria-label={allOnPageSelected ? 'Batalkan pilihan di halaman ini' : `Pilih ${paginatedCustomers.length} customer di halaman ini`}
                        title={allOnPageSelected ? 'Batalkan pilihan di halaman ini' : `Pilih ${paginatedCustomers.length} customer di halaman ini`}
                        className="text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        {allOnPageSelected ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Segmen</th>
                    <th className="px-3 py-3 text-right">Order</th>
                    <th className="px-3 py-3 text-right">Total Belanja</th>
                    <th className="px-3 py-3">Order Terakhir</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCustomers.map((cust) => {
                    const stats = customerStatsMap[cust.id];
                    const selected = selectedCustomerIds.has(cust.id);
                    return (
                      <tr key={cust.id} className={`hover:bg-slate-50 ${selected ? 'bg-slate-50' : ''}`}>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectRow(cust.id)}
                            aria-label={selected ? `Batal pilih ${cust.nama}` : `Pilih ${cust.nama}`}
                            className="text-slate-400 hover:text-slate-900 cursor-pointer"
                          >
                            {selected ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-3 min-w-[220px]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                              {getInitials(cust.nama)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 text-sm truncate">{cust.nama}</div>
                              {contactLine(cust)}
                              {cust.catatan && <div className="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-xs">{cust.catatan}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="relative inline-block">
                            <SegmentBadge
                              segment={stats.resolvedCategory}
                              onClick={() => setActiveTagDropdownId(activeTagDropdownId === cust.id ? null : cust.id)}
                            />
                            {activeTagDropdownId === cust.id && segmentMenu(cust)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {frequencyText(stats)}
                            {stats.isManualTagged && cust.kategoriManual && ' · manual'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{stats.totalOrders}x</div>
                          <div className="text-[11px] text-slate-500">{stats.totalPcs} pcs</div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{formatRupiah(stats.totalSpent)}</div>
                          {stats.totalOrders > 0 && (
                            <div className="text-[11px] text-slate-500" title="Rata-rata belanja per order">
                              {formatRupiah(stats.totalSpent / stats.totalOrders)}/order
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {stats.lastOrderDate ? (
                            <>
                              <div className="font-mono text-slate-900">{stats.lastOrderDate}</div>
                              <div className="text-[11px] text-slate-500">via {stats.lastChannel}</div>
                            </>
                          ) : (
                            <span className="text-slate-400">–</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{rowActions(cust, stats)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* HP: kartu */}
            <div className="md:hidden divide-y divide-slate-100">
              <div className="px-4 py-2 flex items-center justify-between text-xs text-slate-500">
                <button type="button" onClick={handleToggleSelectPage} className="inline-flex items-center gap-1.5 cursor-pointer">
                  {allOnPageSelected ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4" />}
                  Pilih halaman ini
                </button>
              </div>
              {paginatedCustomers.map((cust) => {
                const stats = customerStatsMap[cust.id];
                const selected = selectedCustomerIds.has(cust.id);
                return (
                  <div key={cust.id} className={`p-4 space-y-2 ${selected ? 'bg-slate-50' : ''}`}>
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectRow(cust.id)}
                        aria-label={selected ? `Batal pilih ${cust.nama}` : `Pilih ${cust.nama}`}
                        className="mt-0.5 text-slate-400 cursor-pointer"
                      >
                        {selected ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-slate-900 text-sm">{cust.nama}</span>
                          <span className="font-mono font-semibold text-slate-900 text-xs whitespace-nowrap">{formatRupiah(stats.totalSpent)}</span>
                        </div>
                        {contactLine(cust)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-6 text-[11px] text-slate-500">
                      <div className="relative">
                        <SegmentBadge segment={stats.resolvedCategory} onClick={() => setActiveTagDropdownId(activeTagDropdownId === cust.id ? null : cust.id)} />
                        {activeTagDropdownId === cust.id && segmentMenu(cust)}
                      </div>
                      <span>{frequencyText(stats)}</span>
                      {stats.lastOrderDate && <span>Terakhir {stats.lastOrderDate}</span>}
                    </div>
                    <div className="pl-6">{rowActions(cust, stats)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {sortedCustomers.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, sortedCustomers.length)} dari {sortedCustomers.length} customer
            </span>
            {totalCustomerPages > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCustomerPage(currentPage - 1)} disabled={currentPage === 1} className={`${OUTLINE_BUTTON} disabled:opacity-40 disabled:cursor-default`}>
                  ← Sebelumnya
                </button>
                <span className="font-mono">
                  {currentPage} / {totalCustomerPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomerPage(currentPage + 1)}
                  disabled={currentPage >= totalCustomerPages}
                  className={`${OUTLINE_BUTTON} disabled:opacity-40 disabled:cursor-default`}
                >
                  Selanjutnya →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Jadikan mitra */}
      {promoteCustomerModal && (
        <Modal
          title="Jadikan Mitra Reseller"
          subtitle={`${promoteCustomerModal.nama}${promoteCustomerModal.noHp ? ` · ${promoteCustomerModal.noHp}` : ''}`}
          icon={<Store className="w-5 h-5 text-slate-500 mt-0.5" />}
          onClose={() => setPromoteCustomerModal(null)}
          size="lg"
        >
          <form onSubmit={handleConfirmPromote} className="space-y-4 text-xs">
            <p className="text-slate-600 leading-relaxed">
              Customer akan tercatat di menu Reseller & Konsinyasi: bisa dititipi barang lewat surat jalan, dapat harga khusus, dan piutang serta stok di tokonya
              dipantau.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Level mitra">
                <select value={mitraLevel} onChange={(e) => setMitraLevel(e.target.value as 'Platinum' | 'Gold' | 'Silver')} className={INPUT}>
                  <option value="Platinum">Platinum (prioritas)</option>
                  <option value="Gold">Gold (standar)</option>
                  <option value="Silver">Silver (pemula)</option>
                </select>
              </Field>
              <Field label="Diskon mitra (%)">
                <input type="number" min="0" max="70" value={mitraDiskon} onChange={(e) => setMitraDiskon(Number(e.target.value))} className={`${INPUT} font-mono`} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plafon titipan (Rp)" hint={formatRupiah(mitraPlafon)}>
                <input type="number" step="500000" min="0" value={mitraPlafon} onChange={(e) => setMitraPlafon(Number(e.target.value))} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Jadwal setoran & opname">
                <select value={mitraJadwal} onChange={(e) => setMitraJadwal(e.target.value)} className={INPUT}>
                  <option value="Setiap Hari Senin">Setiap hari Senin</option>
                  <option value="Setiap Hari Jumat">Setiap hari Jumat</option>
                  <option value="Tiap Tanggal 1 & 15">Tiap tanggal 1 & 15</option>
                  <option value="Akhir Bulan">Akhir bulan</option>
                </select>
              </Field>
            </div>
            <Field label="Alamat toko / pengiriman">
              <textarea rows={2} value={mitraAlamat} onChange={(e) => setMitraAlamat(e.target.value)} placeholder="Jalan, kecamatan, kota" className={INPUT} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPromoteCustomerModal(null)} className={OUTLINE_BUTTON}>
                Batal
              </button>
              <button type="submit" className={PRIMARY_BUTTON}>
                Simpan sebagai mitra
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Riwayat order */}
      {historyCustomerModal && historyStats && (
        <Modal
          title={`Riwayat Order: ${historyCustomerModal.nama}`}
          subtitle={[SEGMENT_INFO[historyStats.resolvedCategory].label, historyCustomerModal.noHp, displayCity(historyCustomerModal.kota)].filter(Boolean).join(' · ')}
          onClose={() => setHistoryCustomerModal(null)}
          size="xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['Total belanja', formatRupiah(historyStats.totalSpent)],
                ['Order', `${historyStats.totalOrders}x · ${historyStats.totalPcs} pcs`],
                ['Channel', Array.from(historyStats.channelsUsed).join(', ') || '–'],
                ['Produk favorit', historyStats.topItem || '–'],
              ].map(([label, value]) => (
                <div key={label} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-500">{label}</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{value}</div>
                </div>
              ))}
            </div>
            {historyStats.ordersList.length === 0 ? (
              <p className="text-center py-8 text-slate-500">Belum ada riwayat order.</p>
            ) : (
              historyStats.ordersList.map((ord) => (
                <div key={ord.id} className="p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{ord.noOrder}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{ord.channel}</span>
                      <span className="text-slate-500">{ord.tanggal}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          ord.statusBayar === 'lunas' ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {ord.statusBayar === 'lunas' ? 'Lunas' : ord.statusBayar === 'piutang' ? 'Piutang' : 'Bayar sebagian'}
                      </span>
                      <span className="font-mono font-bold text-slate-900">{formatRupiah(ord.totalTagihan)}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-slate-700">
                    {ord.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span>
                          {it.namaProduk} <span className="font-semibold">×{it.qty}</span>
                        </span>
                        <span className="font-mono text-slate-500">{formatRupiah(it.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                  {ord.noResi && (
                    <div className="text-slate-500">
                      No. resi: <span className="font-mono text-slate-900">{ord.noResi}</span>
                    </div>
                  )}
                </div>
              ))
            )}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setHistoryCustomerModal(null);
                  setQuickOrderModalOpen(true);
                }}
                className={PRIMARY_BUTTON}
              >
                <Plus className="w-3.5 h-3.5" />
                Buat order baru
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Tambah customer */}
      {isAddCustomerOpen && (
        <Modal title="Tambah Customer" onClose={() => setIsAddCustomerOpen(false)}>
          <form onSubmit={handleSaveNewCustomer} className="space-y-3.5 text-xs">
            <Field label="Nama customer / toko *">
              <input type="text" required placeholder="Contoh: Budi Santoso" value={newCustNama} onChange={(e) => setNewCustNama(e.target.value)} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="No. WhatsApp / HP">
                <input type="tel" placeholder="0812…" value={newCustHp} onChange={(e) => setNewCustHp(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Kota">
                <input type="text" placeholder="Contoh: Makassar" value={newCustKota} onChange={(e) => setNewCustKota(e.target.value)} className={INPUT} />
              </Field>
            </div>
            <Field label="Segmen">
              <select value={newCustCategory} onChange={(e) => setNewCustCategory(e.target.value as CustomerSegment)} className={INPUT}>
                {SEGMENTS.map((segment) => (
                  <option key={segment} value={segment}>
                    {SEGMENT_INFO[segment].label} — {SEGMENT_INFO[segment].hint}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Alamat pengiriman (opsional)">
              <textarea rows={2} value={newCustAlamat} onChange={(e) => setNewCustAlamat(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Catatan (opsional)">
              <input type="text" placeholder="Contoh: sering order lewat Shopee Live" value={newCustCatatan} onChange={(e) => setNewCustCatatan(e.target.value)} className={INPUT} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsAddCustomerOpen(false)} className={OUTLINE_BUTTON}>
                Batal
              </button>
              <button type="submit" className={PRIMARY_BUTTON}>
                Simpan customer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Edit customer */}
      {editCustomerModal && (
        <Modal title="Edit Customer" onClose={() => setEditCustomerModal(null)}>
          <form onSubmit={handleSaveEditCustomer} className="space-y-3.5 text-xs">
            <Field label="Nama customer">
              <input
                type="text"
                required
                value={editCustomerModal.nama}
                onChange={(e) => setEditCustomerModal({ ...editCustomerModal, nama: e.target.value })}
                className={INPUT}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="No. WhatsApp / HP">
                <input type="tel" value={editCustomerModal.noHp} onChange={(e) => setEditCustomerModal({ ...editCustomerModal, noHp: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Kota">
                <input
                  type="text"
                  value={displayCity(editCustomerModal.kota)}
                  onChange={(e) => setEditCustomerModal({ ...editCustomerModal, kota: e.target.value })}
                  className={INPUT}
                />
              </Field>
            </div>
            <Field label="Segmen tetap (manual)" hint="Menimpa deteksi otomatis. Kosongkan lewat menu segmen di tabel.">
              <select
                value={editCustomerModal.kategoriManual || customerStatsMap[editCustomerModal.id]?.resolvedCategory || 'Umum'}
                onChange={(e) => {
                  const val = e.target.value as CustomerSegment;
                  setEditCustomerModal({ ...editCustomerModal, tipe: val === 'Umum' ? 'Retail' : val, kategoriManual: val });
                }}
                className={INPUT}
              >
                {SEGMENTS.map((segment) => (
                  <option key={segment} value={segment}>
                    {SEGMENT_INFO[segment].label} — {SEGMENT_INFO[segment].hint}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Alamat">
              <textarea rows={2} value={editCustomerModal.alamat || ''} onChange={(e) => setEditCustomerModal({ ...editCustomerModal, alamat: e.target.value })} className={INPUT} />
            </Field>
            <Field label="Catatan">
              <input type="text" value={editCustomerModal.catatan || ''} onChange={(e) => setEditCustomerModal({ ...editCustomerModal, catatan: e.target.value })} className={INPUT} />
            </Field>
            <div className="flex items-center justify-between gap-2 pt-2">
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    const target = editCustomerModal;
                    setEditCustomerModal(null);
                    setDeleteConfirmCustomer(target);
                  }}
                  className="text-rose-700 hover:underline text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus customer
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" onClick={() => setEditCustomerModal(null)} className={OUTLINE_BUTTON}>
                  Batal
                </button>
                <button type="submit" className={PRIMARY_BUTTON}>
                  Simpan
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Impor */}
      {isImportModalOpen && (
        <Modal
          title="Impor Customer"
          subtitle="Salin baris dari Excel atau CSV, lalu tempel di bawah."
          icon={<Upload className="w-5 h-5 text-slate-500 mt-0.5" />}
          onClose={() => setIsImportModalOpen(false)}
          size="lg"
        >
          <div className="space-y-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-700 space-y-1.5">
              <div className="font-semibold">Urutan kolom (dipisah tab, koma, atau titik koma):</div>
              <code className="block font-mono text-slate-900">Nama, No. HP, Kota, Segmen (Umum/Reseller/Marketplace/VIP), Alamat, Catatan</code>
              <div className="text-slate-500">
                Contoh: <code className="text-slate-700">Budi Santoso, 08123456789, Bandung, Reseller, Jl. Riau No 10, Toko distro</code>
              </div>
            </div>
            {importError && <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl">{importError}</div>}
            <Field label="Data customer">
              <textarea rows={7} value={importCsvText} onChange={(e) => setImportCsvText(e.target.value)} className={`${INPUT} font-mono`} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setIsImportModalOpen(false)} className={OUTLINE_BUTTON}>
                Batal
              </button>
              <button type="button" onClick={handleProcessImportCsv} className={PRIMARY_BUTTON}>
                Impor & simpan
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Hapus satu customer */}
      {deleteConfirmCustomer && (
        <Modal title="Hapus customer?" icon={<AlertTriangle className="w-5 h-5 text-rose-700 mt-0.5" />} onClose={() => setDeleteConfirmCustomer(null)}>
          <div className="space-y-3 text-xs text-slate-700">
            <div className="p-3 rounded-xl border border-slate-200 space-y-1">
              <div className="text-sm font-bold text-slate-900">{deleteConfirmCustomer.nama}</div>
              <div className="text-slate-500">{[deleteConfirmCustomer.noHp || 'Tanpa no. HP', displayCity(deleteConfirmCustomer.kota)].filter(Boolean).join(' · ')}</div>
              {deleteStats && (
                <div className="text-slate-700">
                  {deleteStats.totalOrders}x order · belanja {formatRupiah(deleteStats.totalSpent)}
                </div>
              )}
            </div>
            <p>Customer hilang dari daftar. Nota penjualan dan buku kas yang sudah tercatat tidak ikut terhapus.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setDeleteConfirmCustomer(null)} className={OUTLINE_BUTTON}>
                Batal
              </button>
              <button type="button" onClick={handleConfirmSingleDelete} className={DANGER_BUTTON}>
                <Trash2 className="w-3.5 h-3.5" />
                Hapus customer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Hapus banyak customer */}
      {isBulkDeleteModalOpen && (
        <Modal title={`Hapus ${selectedCustomerIds.size} customer?`} icon={<AlertTriangle className="w-5 h-5 text-rose-700 mt-0.5" />} onClose={() => setIsBulkDeleteModalOpen(false)}>
          <div className="space-y-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">
              {customers
                .filter((c) => selectedCustomerIds.has(c.id))
                .slice(0, 5)
                .map((c) => c.nama)
                .join(', ')}
              {selectedCustomerIds.size > 5 && ` dan ${selectedCustomerIds.size - 5} lainnya`}
            </p>
            <p>Customer yang dihapus tidak bisa dipulihkan, kecuali diimpor ulang atau ditarik lagi dari order. Nota penjualan tetap ada.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setIsBulkDeleteModalOpen(false)} className={OUTLINE_BUTTON}>
                Batal
              </button>
              <button type="button" onClick={handleConfirmBulkDelete} className={DANGER_BUTTON}>
                <Trash2 className="w-3.5 h-3.5" />
                Hapus {selectedCustomerIds.size} customer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
