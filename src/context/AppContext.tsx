import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ApiError, WorkspaceDocId, api, onUnauthorized } from '../services/api';
import { docsToRefetch, isFreshBrowser, pickInitial } from '../services/workspaceSync';

/** Selang cek perubahan data di server (ms) selama tab terlihat. */
const POLL_INTERVAL_MS = 5000;

const ALL_WORKSPACE_DOC_IDS: WorkspaceDocId[] = ['orders', 'stock_movements', 'master', 'finance', 'operations', 'audit_logs'];

// Helper to merge lists of objects by ID or custom key, ensuring no records from cloud or local are dropped
function mergeByKey<T>(
  localList: T[],
  cloudList: T[] | undefined,
  deletedIds?: Set<string>,
  keyField: string = 'id'
): T[] {
  if (!cloudList || !Array.isArray(cloudList)) return localList || [];
  if (!localList || !Array.isArray(localList)) return cloudList || [];

  const map = new Map<string, T>();
  // 1. Add cloud items unless marked as locally deleted
  for (const item of cloudList) {
    if (item) {
      const k = String((item as any)[keyField] || (item as any).id || (item as any).sku || (item as any).code || '');
      if (!k) continue;
      if (deletedIds && deletedIds.has(k)) continue;
      map.set(k, item);
    }
  }
  // 2. Add or override with local items (local actions take immediate precedence)
  for (const localItem of localList) {
    if (localItem) {
      const k = String((localItem as any)[keyField] || (localItem as any).id || (localItem as any).sku || (localItem as any).code || '');
      if (!k) continue;
      if (deletedIds && deletedIds.has(k)) continue;
      map.set(k, localItem);
    }
  }
  return Array.from(map.values());
}

function mergeById<T extends { id?: string; sku?: string; code?: string }>(
  localList: T[],
  cloudList: T[] | undefined,
  deletedIds?: Set<string>,
  keyField: string = 'id'
): T[] {
  return mergeByKey(localList, cloudList, deletedIds, keyField);
}
import {
  User,
  ProductSeries,
  SKUItem,
  BOMItem,
  SalesChannel,
  SalesChannelName,
  Customer,
  Reseller,
  Order,
  StockMovement,
  SuratTitip,
  LaporanTitipLaku,
  BiayaOperasional,
  AuditLog,
  OrderItem,
  PaymentStatus,
  OrderStatus,
  CashAccount,
  CashMutation,
  StockOpnameSession,
  StockOpnameItem,
  BankReconciliationSession,
  Vendor,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchasePaymentStatus,
  JournalEntry,
  JournalLineItem,
  orderSortComparator,
  getLocalDateString,
  FixedAssetItem,
  BalanceSheetConfig,
} from '../types';
import {
  INITIAL_SERIES,
  INITIAL_BOM,
  INITIAL_SKUS,
  INITIAL_CHANNELS,
  INITIAL_CUSTOMERS,
  INITIAL_RESELLERS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_SURAT_TITIP,
  INITIAL_ORDERS,
  INITIAL_LAPORAN_TITIP_LAKU,
  INITIAL_BIAYA_OPERASIONAL,
  INITIAL_AUDIT_LOGS,
  INITIAL_COLORS,
  INITIAL_CASH_ACCOUNTS,
  INITIAL_CASH_MUTATIONS,
  INITIAL_STOCK_OPNAME_SESSIONS,
  INITIAL_BANK_RECONCILIATIONS,
  INITIAL_VENDORS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_JOURNAL_ENTRIES,
  INITIAL_FIXED_ASSETS,
  DEFAULT_BALANCE_SHEET_CONFIG,
} from '../data/initialData';

export type AppView =
  | 'dashboard'
  | 'sales'
  | 'inventory'
  | 'purchases'
  | 'products'
  | 'customers'
  | 'reseller'
  | 'finance'
  | 'import_export'
  | 'audit'
  | 'users';

export type ThemeMode = 'dark' | 'light';

export const normalizePhone = (phone?: string): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) {
    digits = '0' + digits.substring(2);
  } else if (!digits.startsWith('0') && digits.length >= 8) {
    digits = '0' + digits;
  }
  return digits;
};

interface AppContextType {
  currentUser: User;
  isOwner: boolean;
  logout: () => Promise<void>;
  logAudit: (module: AuditLog['module'], action: string, detail: string) => void;
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  quickOrderModalOpen: boolean;
  setQuickOrderModalOpen: (open: boolean) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  
  // Cloud & Multi-User Realtime Sync
  cloudSyncStatus: 'connecting' | 'connected' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: string | null;
  syncToCloudNow: () => Promise<{ success: boolean; message?: string }>;

  // Data
  series: ProductSeries[];
  skus: SKUItem[];
  bomItems: BOMItem[];
  channels: SalesChannel[];
  customers: Customer[];
  resellers: Reseller[];
  orders: Order[];
  stockMovements: StockMovement[];
  suratTitip: SuratTitip[];
  laporanTitipLaku: LaporanTitipLaku[];
  biayaOperasional: BiayaOperasional[];
  auditLogs: AuditLog[];
  cashAccounts: CashAccount[];
  cashMutations: CashMutation[];
  stockOpnameSessions: StockOpnameSession[];
  bankReconciliations: BankReconciliationSession[];
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
  journalEntries: JournalEntry[];
  fixedAssets: FixedAssetItem[];
  setFixedAssets: (assets: FixedAssetItem[]) => void;
  balanceSheetConfig: BalanceSheetConfig;
  setBalanceSheetConfig: (config: BalanceSheetConfig) => void;
  customOpexCategories: string[];
  setCustomOpexCategories: (categories: string[]) => void;

  // Inventory Computations
  calculateStock: (sku: string, lokasi?: string) => number;
  calculateStockSummary: () => Record<string, { gudang: number; reseller: number; total: number; minStock: number }>;
  getLowStockSKUs: () => SKUItem[];

  // Action methods
  addOrder: (orderData: {
    channel: Order['channel'];
    customerId: string;
    customerNama: string;
    customerHp: string;
    customerKota: string;
    items: { sku: string; qty: number; hargaSatuan?: number }[];
    diskon: number;
    ongkir: number;
    statusBayar: PaymentStatus;
    totalTerbayar: number;
    jatuhTempo?: string;
    noResi?: string;
    catatan?: string;
    overrideStock?: boolean;
    tanggal?: string;
  }) => Promise<{ success: boolean; error?: string; order?: Order }>;


  updateOrder: (
    orderId: string,
    updatedData: {
      tanggal?: string;
      channel?: SalesChannelName;
      customerId?: string;
      customerNama?: string;
      customerHp?: string;
      customerKota?: string;
      noResi?: string;
      items?: { sku: string; qty: number; hargaSatuan?: number }[];
      diskon?: number;
      ongkir?: number;
      statusBayar?: PaymentStatus;
      totalTerbayar?: number;
      jatuhTempo?: string;
      catatan?: string;
      statusOrder?: OrderStatus;
      overrideStock?: boolean;
    }
  ) => { success: boolean; error?: string; order?: Order };

  deleteOrder: (orderId: string) => void;

  requestCancelOrder: (orderId: string, reason: string) => void;
  approveCancelOrder: (orderId: string) => void;
  rejectCancelOrder: (orderId: string) => void;
  recordPayment: (orderId: string, amount: number, method: string, catatan?: string, accountId?: string) => void;

  // Kas & Bank Actions
  addCashAccount: (account: Omit<CashAccount, 'id' | 'saldo'> & { saldoAwal: number }) => CashAccount;
  updateCashAccount: (id: string, updates: Partial<CashAccount>) => void;
  deleteCashAccount: (id: string) => { success: boolean; error?: string };
  recordCashTransaction: (data: {
    accountId: string;
    tipe: 'masuk' | 'keluar';
    jumlah: number;
    kategori: string;
    deskripsi: string;
    referensi?: string;
    tanggal?: string;
  }) => void;
  transferCashAccount: (data: {
    fromAccountId: string;
    toAccountId: string;
    jumlah: number;
    deskripsi?: string;
    tanggal?: string;
  }) => { success: boolean; error?: string };
  saveBankReconciliationSession: (data: {
    accountId: string;
    periodeAwal: string;
    periodeAkhir: string;
    tanggalRekonsiliasi?: string;
    saldoAwalBuku: number;
    saldoAkhirBuku: number;
    saldoRekeningKoranBank: number;
    matchedMutationIds: string[];
    catatan?: string;
  }) => { success: boolean; session?: BankReconciliationSession; error?: string };
  deleteBankReconciliationSession: (id: string) => void;
  toggleMutationReconciliation: (mutationId: string, isReconciled: boolean, sessionId?: string) => void;

  // Inventory actions
  recordRestock: (items: { sku: string; qty: number }[], sumber: string, catatan?: string) => void;
  recordStockOpname: (sku: string, physicalCount: number, catatan: string) => void;
  recordBatchStockOpname: (data: {
    judul: string;
    kategoriFilter?: string;
    lokasi?: string;
    items: { sku: string; physicalQty: number; alasan?: string }[];
    alasanGlobal: string;
    tanggal?: string;
  }) => { success: boolean; session?: StockOpnameSession; error?: string };
  recordReject: (sku: string, qty: number, alasan: string) => void;

  // Consignment / Reseller
  createSuratTitip: (resellerId: string, items: { sku: string; qty: number; hargaTitip: number }[], catatan?: string) => { success: boolean; error?: string };
  createLaporanTitipLaku: (resellerId: string, periode: string, items: { sku: string; qty: number; hargaTitip: number }[], statusBayar: PaymentStatus, terbayar: number) => void;
  recordReturTitip: (resellerId: string, items: { sku: string; qty: number; kondisi: 'baik_ke_gudang' | 'rusak_ke_reject' }[], alasan: string) => void;
  recordSetoranReseller: (resellerId: string, jumlah: number, metode: string, catatan?: string, accountId?: string) => void;
  updateReseller: (id: string, updates: Partial<Reseller>) => void;
  deleteReseller: (
    id: string,
    options?: { returnStockToWarehouse?: boolean; force?: boolean }
  ) => { success: boolean; error?: string; returnedQty?: number };

  // Pengadaan & Pembelian Kaos (Vendor & PO Lifecycle)
  addVendor: (vendorData: Omit<Vendor, 'id' | 'totalPO' | 'totalBelanja'>) => Vendor;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  deleteVendor: (id: string) => { success: boolean; error?: string };
  createPurchaseOrder: (data: {
    vendorId: string;
    tanggalPO: string;
    items: { sku: string; qtyPesan: number; hargaBeliSatuan: number; catatan?: string }[];
    biayaEkspedisi?: number;
    biayaTambahan?: number;
    statusBayar: PurchasePaymentStatus;
    jumlahTerbayar: number;
    jatuhTempoBayar?: string;
    accountId?: string;
    ekspedisi?: string;
    noResi?: string;
    tanggalKirim?: string;
    estimasiTiba?: string;
    alamatTujuanGudang?: string;
    catatanPengiriman?: string;
    catatanPO?: string;
    gudangTujuan?: string;
  }) => { success: boolean; po?: PurchaseOrder; error?: string };
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => { success: boolean; po?: PurchaseOrder; error?: string };
  updatePOShipping: (id: string, shippingData: { ekspedisi: string; noResi: string; tanggalKirim: string; estimasiTiba?: string; catatanPengiriman?: string }) => { success: boolean; error?: string };
  receivePOGoods: (id: string, receiptData: {
    tanggalDiterima: string;
    penerimaGudang: string;
    kondisiPenerimaan: 'lengkap_sempurna' | 'ada_reject' | 'selisih_kurang' | 'kelebihan_qc';
    itemsReceived: { sku: string; qtyDiterima: number }[];
    catatanPenerimaan?: string;
    autoStockIn?: boolean;
  }) => { success: boolean; message?: string; error?: string };
  payPurchaseOrder: (id: string, paymentData: { jumlahBayar: number; accountId: string; tanggal: string; catatan?: string }) => { success: boolean; error?: string };
  deletePurchaseOrder: (id: string) => { success: boolean; error?: string };

  // Penjurnalan Akuntansi (Double-Entry General Journal)
  recordJournalEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'noJurnal' | 'isBalanced'>) => JournalEntry;
  deleteJournalEntry: (id: string) => void;

  // Finance & Master
  addBiayaOperasional: (data: Omit<BiayaOperasional, 'id' | 'dicatatOleh'>) => void;
  updateBiayaOperasional: (id: string, updates: Partial<Omit<BiayaOperasional, 'id' | 'dicatatOleh'>>) => void;
  deleteBiayaOperasional: (id: string) => void;
  clearBiayaOperasional: () => void;
  updateBOM: (newBom: BOMItem[]) => void;
  updateSeries: (seriesId: string, updates: Partial<ProductSeries>) => void;
  updateSKU: (skuCode: string, updates: Partial<SKUItem>) => void;
  addSKU: (item: SKUItem) => void;
  deleteSKU: (skuCode: string) => void;
  syncAllSkuNames: () => void;
  addCustomer: (cust: Omit<Customer, 'id'>) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  bulkDeleteCustomers: (ids: string[]) => void;
  syncCustomersFromOrders: () => { count: number; mergedCount: number };
  mergeDuplicateCustomers: () => { mergedCount: number };
  relinkAndRepairOrders: () => { repairedCount: number; newCustomersCount: number };
  promoteCustomerToReseller: (
    customerId: string,
    resellerData?: {
      level?: 'Platinum' | 'Gold' | 'Silver';
      diskonPersen?: number;
      batasPlafonTitipan?: number;
      jadwalSetoran?: string;
      alamat?: string;
    }
  ) => { success: boolean; reseller?: Reseller };
  addReseller: (reseller: Omit<Reseller, 'id'>) => Reseller;

  // Data management
  resetData: () => void;
  importInitialData: (importedData: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_PREFIX = 'kalima_app_v1_';

/**
 * Penyedia data ERP. Hanya dirender setelah pengguna login, sehingga API data tidak dipanggil tanpa sesi.
 */
export const AppProvider: React.FC<{
  children: React.ReactNode;
  authUser: User;
  onSignOut: () => Promise<void>;
}> = ({ children, authUser, onSignOut }) => {
  const currentUser = authUser;

  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickOrderModalOpen, setQuickOrderModalOpen] = useState(false);

  // Theme state: default to soft light mode
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}theme`);
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}theme`, theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // States
  const [series, setSeries] = useState<ProductSeries[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}series`);
    return saved ? JSON.parse(saved) : INITIAL_SERIES;
  });
  const [skus, setSkus] = useState<SKUItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}skus`);
    return saved ? JSON.parse(saved) : INITIAL_SKUS;
  });
  const [bomItems, setBomItems] = useState<BOMItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}bom`);
    return saved ? JSON.parse(saved) : INITIAL_BOM;
  });
  const [channels] = useState<SalesChannel[]>(INITIAL_CHANNELS);
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}customers`);
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });
  const [resellers, setResellers] = useState<Reseller[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}resellers`);
    return saved ? JSON.parse(saved) : INITIAL_RESELLERS;
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}orders`);
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}movements`);
    return saved ? JSON.parse(saved) : INITIAL_STOCK_MOVEMENTS;
  });
  const [suratTitip, setSuratTitip] = useState<SuratTitip[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}surat_titip`);
    return saved ? JSON.parse(saved) : INITIAL_SURAT_TITIP;
  });
  const [laporanTitipLaku, setLaporanTitipLaku] = useState<LaporanTitipLaku[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}laporan_laku`);
    return saved ? JSON.parse(saved) : INITIAL_LAPORAN_TITIP_LAKU;
  });
  const [biayaOperasional, setBiayaOperasional] = useState<BiayaOperasional[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}opex`);
    return saved ? JSON.parse(saved) : INITIAL_BIAYA_OPERASIONAL;
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}audit`);
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}cash_accounts`);
    return saved ? JSON.parse(saved) : INITIAL_CASH_ACCOUNTS;
  });
  const [cashMutations, setCashMutations] = useState<CashMutation[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}cash_mutations`);
    return saved ? JSON.parse(saved) : INITIAL_CASH_MUTATIONS;
  });
  const [stockOpnameSessions, setStockOpnameSessions] = useState<StockOpnameSession[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}opname_sessions`);
    return saved ? JSON.parse(saved) : INITIAL_STOCK_OPNAME_SESSIONS;
  });
  const [bankReconciliations, setBankReconciliations] = useState<BankReconciliationSession[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}bank_reconciliations`);
    return saved ? JSON.parse(saved) : INITIAL_BANK_RECONCILIATIONS;
  });
  const [vendors, setVendors] = useState<Vendor[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}vendors`);
    return saved ? JSON.parse(saved) : INITIAL_VENDORS;
  });
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}purchase_orders`);
    return saved ? JSON.parse(saved) : INITIAL_PURCHASE_ORDERS;
  });
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}journal_entries`);
    return saved ? JSON.parse(saved) : INITIAL_JOURNAL_ENTRIES;
  });

  /** Data neraca & kategori biaya; dulu hanya di browser, sekarang ikut dokumen `finance`. */
  const readLegacy = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  };
  const [fixedAssets, setFixedAssets] = useState<FixedAssetItem[]>(() => readLegacy('kalima_fixed_assets', INITIAL_FIXED_ASSETS));
  const [balanceSheetConfig, setBalanceSheetConfig] = useState<BalanceSheetConfig>(() => readLegacy('kalima_balance_sheet_config', DEFAULT_BALANCE_SHEET_CONFIG));
  const [customOpexCategories, setCustomOpexCategories] = useState<string[]>(() => readLegacy('kalima_custom_opex_categories', []));

  // Cloud & Multi-User Synchronization States
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'connecting' | 'connected' | 'syncing' | 'offline' | 'error'>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const isRemoteUpdateRef = useRef(false);
  const isCloudInitializedRef = useRef(false);
  const masterSyncTimeoutRef = useRef<any>(null);
  const financeSyncTimeoutRef = useRef<any>(null);
  const operationsSyncTimeoutRef = useRef<any>(null);
  const auditSyncTimeoutRef = useRef<any>(null);
  /** Versi terakhir tiap dokumen yang sudah diketahui browser ini. */
  const knownVersionsRef = useRef<Partial<Record<WorkspaceDocId, number>>>({});
  /** Browser baru (belum ada cache): data server dipakai apa adanya tanpa data contoh. */
  const freshBrowserRef = useRef(isFreshBrowser(localStorage, STORAGE_PREFIX));

  // Synchronous State Refs to prevent stale closures during saving and merging
  const ordersRef = useRef<Order[]>(orders);
  const stockMovementsRef = useRef<StockMovement[]>(stockMovements);
  const customersRef = useRef<Customer[]>(customers);
  const resellersRef = useRef<Reseller[]>(resellers);
  const skusRef = useRef<SKUItem[]>(skus);
  const seriesRef = useRef<ProductSeries[]>(series);
  const bomItemsRef = useRef<BOMItem[]>(bomItems);
  const cashAccountsRef = useRef<CashAccount[]>(cashAccounts);
  const cashMutationsRef = useRef<CashMutation[]>(cashMutations);
  const biayaOperasionalRef = useRef<BiayaOperasional[]>(biayaOperasional);
  const auditLogsRef = useRef<AuditLog[]>(auditLogs);
  const suratTitipRef = useRef<SuratTitip[]>(suratTitip);
  const laporanTitipLakuRef = useRef<LaporanTitipLaku[]>(laporanTitipLaku);
  const stockOpnameSessionsRef = useRef<StockOpnameSession[]>(stockOpnameSessions);
  const bankReconciliationsRef = useRef<BankReconciliationSession[]>(bankReconciliations);
  const vendorsRef = useRef<Vendor[]>(vendors);
  const purchaseOrdersRef = useRef<PurchaseOrder[]>(purchaseOrders);
  const journalEntriesRef = useRef<JournalEntry[]>(journalEntries);
  const fixedAssetsRef = useRef<FixedAssetItem[]>(fixedAssets);
  const balanceSheetConfigRef = useRef<BalanceSheetConfig>(balanceSheetConfig);
  const customOpexCategoriesRef = useRef<string[]>(customOpexCategories);

  const deletedOrderIdsRef = useRef<Set<string>>(new Set());
  const deletedMovementIdsRef = useRef<Set<string>>(new Set());

  // Keep refs always aligned with React state
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { stockMovementsRef.current = stockMovements; }, [stockMovements]);
  useEffect(() => { customersRef.current = customers; }, [customers]);
  useEffect(() => { resellersRef.current = resellers; }, [resellers]);
  useEffect(() => { skusRef.current = skus; }, [skus]);
  useEffect(() => { seriesRef.current = series; }, [series]);
  useEffect(() => { bomItemsRef.current = bomItems; }, [bomItems]);
  useEffect(() => { cashAccountsRef.current = cashAccounts; }, [cashAccounts]);
  useEffect(() => { cashMutationsRef.current = cashMutations; }, [cashMutations]);
  useEffect(() => { biayaOperasionalRef.current = biayaOperasional; }, [biayaOperasional]);
  useEffect(() => { auditLogsRef.current = auditLogs; }, [auditLogs]);
  useEffect(() => { suratTitipRef.current = suratTitip; }, [suratTitip]);
  useEffect(() => { laporanTitipLakuRef.current = laporanTitipLaku; }, [laporanTitipLaku]);
  useEffect(() => { stockOpnameSessionsRef.current = stockOpnameSessions; }, [stockOpnameSessions]);
  useEffect(() => { bankReconciliationsRef.current = bankReconciliations; }, [bankReconciliations]);
  useEffect(() => { vendorsRef.current = vendors; }, [vendors]);
  useEffect(() => { purchaseOrdersRef.current = purchaseOrders; }, [purchaseOrders]);
  useEffect(() => { journalEntriesRef.current = journalEntries; }, [journalEntries]);
  useEffect(() => { fixedAssetsRef.current = fixedAssets; }, [fixedAssets]);
  useEffect(() => { balanceSheetConfigRef.current = balanceSheetConfig; }, [balanceSheetConfig]);
  useEffect(() => { customOpexCategoriesRef.current = customOpexCategories; }, [customOpexCategories]);

  // Sesi habis / akun dinonaktifkan → kembali ke halaman login.
  useEffect(() => {
    onUnauthorized(() => { void onSignOut(); });
    return () => onUnauthorized(null);
  }, [onSignOut]);

  /** Simpan satu dokumen ke server dan catat versinya agar polling tidak mengambil ulang perubahan sendiri. */
  const saveWorkspaceDoc = async (id: WorkspaceDocId, data: object): Promise<void> => {
    const { version } = await api.saveDoc(id, data);
    knownVersionsRef.current[id] = version;
  };

  /** Gagal simpan: data lokal tetap ada, status sinkron jadi error, data terlalu besar diberi tahu. */
  const reportSaveError = (id: WorkspaceDocId, err: unknown) => {
    console.warn(`Failed to save ${id} to server:`, err);
    setCloudSyncStatus('error');
    if (err instanceof ApiError && err.status === 413) {
      window.alert(err.message);
    }
  };

  // Save orders & stock movements to Cloud immediately
  const saveOrdersToCloud = async (targetOrders?: Order[], targetMovements?: StockMovement[]): Promise<{ success: boolean; error?: string }> => {
    try {
      setCloudSyncStatus('syncing');
      if (targetOrders) ordersRef.current = targetOrders;
      if (targetMovements) stockMovementsRef.current = targetMovements;

      const ordersToSave = ordersRef.current;
      const movementsToSave = stockMovementsRef.current;

      await Promise.all([
        saveWorkspaceDoc('orders', { orders: ordersToSave }),
        saveWorkspaceDoc('stock_movements', { stockMovements: movementsToSave }),
      ]);

      const now = new Date();
      setLastSyncedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
      setCloudSyncStatus('connected');
      return { success: true };
    } catch (err: any) {
      reportSaveError('orders', err);
      return { success: false, error: err?.message || 'Gagal menyimpan ke server' };
    }
  };

  // Save master data (series, skus, bom, customers, resellers) to Cloud
  const saveMasterToCloud = async (overrides?: {
    series?: ProductSeries[];
    skus?: SKUItem[];
    bomItems?: BOMItem[];
    customers?: Customer[];
    resellers?: Reseller[];
  }) => {
    try {
      if (overrides?.series) seriesRef.current = overrides.series;
      if (overrides?.skus) skusRef.current = overrides.skus;
      if (overrides?.bomItems) bomItemsRef.current = overrides.bomItems;
      if (overrides?.customers) customersRef.current = overrides.customers;
      if (overrides?.resellers) resellersRef.current = overrides.resellers;

      await saveWorkspaceDoc('master', {
        series: seriesRef.current,
        skus: skusRef.current,
        bomItems: bomItemsRef.current,
        customers: customersRef.current,
        resellers: resellersRef.current
      });
      setCloudSyncStatus('connected');
    } catch (err) {
      reportSaveError('master', err);
    }
  };

  // Save finance to Cloud
  const saveFinanceToCloud = async (overrides?: {
    biayaOperasional?: BiayaOperasional[];
    cashAccounts?: CashAccount[];
    cashMutations?: CashMutation[];
    bankReconciliations?: BankReconciliationSession[];
    journalEntries?: JournalEntry[];
  }) => {
    try {
      if (overrides?.biayaOperasional) biayaOperasionalRef.current = overrides.biayaOperasional;
      if (overrides?.cashAccounts) cashAccountsRef.current = overrides.cashAccounts;
      if (overrides?.cashMutations) cashMutationsRef.current = overrides.cashMutations;
      if (overrides?.bankReconciliations) bankReconciliationsRef.current = overrides.bankReconciliations;
      if (overrides?.journalEntries) journalEntriesRef.current = overrides.journalEntries;

      await saveWorkspaceDoc('finance', {
        biayaOperasional: biayaOperasionalRef.current,
        cashAccounts: cashAccountsRef.current,
        cashMutations: cashMutationsRef.current,
        bankReconciliations: bankReconciliationsRef.current,
        journalEntries: journalEntriesRef.current,
        fixedAssets: fixedAssetsRef.current,
        balanceSheetConfig: balanceSheetConfigRef.current,
        customOpexCategories: customOpexCategoriesRef.current,
      });
      setCloudSyncStatus('connected');
    } catch (err) {
      reportSaveError('finance', err);
    }
  };

  // Save operations to Cloud
  const saveOperationsToCloud = async (overrides?: {
    suratTitip?: SuratTitip[];
    laporanTitipLaku?: LaporanTitipLaku[];
    stockOpnameSessions?: StockOpnameSession[];
    vendors?: Vendor[];
    purchaseOrders?: PurchaseOrder[];
  }) => {
    try {
      if (overrides?.suratTitip) suratTitipRef.current = overrides.suratTitip;
      if (overrides?.laporanTitipLaku) laporanTitipLakuRef.current = overrides.laporanTitipLaku;
      if (overrides?.stockOpnameSessions) stockOpnameSessionsRef.current = overrides.stockOpnameSessions;
      if (overrides?.vendors) vendorsRef.current = overrides.vendors;
      if (overrides?.purchaseOrders) purchaseOrdersRef.current = overrides.purchaseOrders;

      await saveWorkspaceDoc('operations', {
        suratTitip: suratTitipRef.current,
        laporanTitipLaku: laporanTitipLakuRef.current,
        stockOpnameSessions: stockOpnameSessionsRef.current,
        vendors: vendorsRef.current,
        purchaseOrders: purchaseOrdersRef.current
      });
      setCloudSyncStatus('connected');
    } catch (err) {
      reportSaveError('operations', err);
    }
  };

  /**
   * Gabungkan satu dokumen dari server ke state lokal (logika gabung sama untuk semua perangkat).
   * `fresh` = browser baru: pakai data server apa adanya tanpa data contoh.
   */
  const applyRemoteDoc = (id: WorkspaceDocId, data: Record<string, any>, fresh: boolean) => {
    /** Daftar dari server; untuk browser baru, field yang belum ada dianggap kosong (tanpa data contoh). */
    const list = (key: string): any[] | undefined => (Array.isArray(data[key]) ? data[key] : fresh ? [] : undefined);
    switch (id) {
      case 'orders': {
        if (list('orders')) {
          const merged = pickInitial(fresh, ordersRef.current, list('orders')!, (local, server) => mergeById(local, server, deletedOrderIdsRef.current).sort(orderSortComparator));
          ordersRef.current = merged;
          isRemoteUpdateRef.current = true;
          setOrders(merged);
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 300);
        }
        break;
      }
      case 'stock_movements': {
        if (list('stockMovements')) {
          const merged = pickInitial(fresh, stockMovementsRef.current, list('stockMovements')!, (local, server) => mergeById(local, server, deletedMovementIdsRef.current).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()));
          stockMovementsRef.current = merged;
          isRemoteUpdateRef.current = true;
          setStockMovements(merged);
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 300);
        }
        break;
      }
      case 'master': {
        isRemoteUpdateRef.current = true;
        if (list('series')) {
          const merged = pickInitial(fresh, seriesRef.current, list('series')!, (local, server) => mergeByKey(local, server, undefined, 'id'));
          seriesRef.current = merged;
          setSeries(merged);
        }
        if (list('skus')) {
          const merged = pickInitial(fresh, skusRef.current, list('skus')!, (local, server) => mergeByKey(local, server, undefined, 'sku'));
          skusRef.current = merged;
          setSkus(merged);
        }
        if (list('bomItems')) {
          const merged = pickInitial(fresh, bomItemsRef.current, list('bomItems')!, (local, server) => mergeByKey(local, server, undefined, 'id'));
          bomItemsRef.current = merged;
          setBomItems(merged);
        }
        if (list('customers')) {
          const merged = pickInitial(fresh, customersRef.current, list('customers')!, (local, server) => mergeById(local, server));
          customersRef.current = merged;
          setCustomers(merged);
        }
        if (list('resellers')) {
          const merged = pickInitial(fresh, resellersRef.current, list('resellers')!, (local, server) => mergeById(local, server));
          resellersRef.current = merged;
          setResellers(merged);
        }
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 300);
        break;
      }
      case 'finance': {
        isRemoteUpdateRef.current = true;
        if (list('biayaOperasional')) {
          const merged = pickInitial(fresh, biayaOperasionalRef.current, list('biayaOperasional')!, (local, server) => mergeById(local, server));
          biayaOperasionalRef.current = merged;
          setBiayaOperasional(merged);
        }
        if (list('cashAccounts')) {
          const merged = pickInitial(fresh, cashAccountsRef.current, list('cashAccounts')!, (local, server) => mergeById(local, server));
          cashAccountsRef.current = merged;
          setCashAccounts(merged);
        }
        if (list('cashMutations')) {
          const merged = pickInitial(fresh, cashMutationsRef.current, list('cashMutations')!, (local, server) => mergeById(local, server));
          cashMutationsRef.current = merged;
          setCashMutations(merged);
        }
        if (list('bankReconciliations')) {
          const merged = pickInitial(fresh, bankReconciliationsRef.current, list('bankReconciliations')!, (local, server) => mergeById(local, server));
          bankReconciliationsRef.current = merged;
          setBankReconciliations(merged);
        }
        if (list('journalEntries')) {
          const merged = pickInitial(fresh, journalEntriesRef.current, list('journalEntries')!, (local, server) => mergeById(local, server));
          journalEntriesRef.current = merged;
          setJournalEntries(merged);
        }
        if (list('fixedAssets')) {
          const merged = pickInitial(fresh, fixedAssetsRef.current, list('fixedAssets')!, (local, server) => mergeById(local, server));
          fixedAssetsRef.current = merged;
          setFixedAssets(merged);
        }
        if (data.balanceSheetConfig && typeof data.balanceSheetConfig === 'object') {
          balanceSheetConfigRef.current = data.balanceSheetConfig;
          setBalanceSheetConfig(data.balanceSheetConfig);
        }
        if (list('customOpexCategories')) {
          const merged = pickInitial(fresh, customOpexCategoriesRef.current, list('customOpexCategories')!, (local, server) => Array.from(new Set([...server, ...local])));
          customOpexCategoriesRef.current = merged;
          setCustomOpexCategories(merged);
        }
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 300);
        break;
      }
      case 'operations': {
        isRemoteUpdateRef.current = true;
        if (list('suratTitip')) {
          const merged = pickInitial(fresh, suratTitipRef.current, list('suratTitip')!, (local, server) => mergeById(local, server));
          suratTitipRef.current = merged;
          setSuratTitip(merged);
        }
        if (list('laporanTitipLaku')) {
          const merged = pickInitial(fresh, laporanTitipLakuRef.current, list('laporanTitipLaku')!, (local, server) => mergeById(local, server));
          laporanTitipLakuRef.current = merged;
          setLaporanTitipLaku(merged);
        }
        if (list('stockOpnameSessions')) {
          const merged = pickInitial(fresh, stockOpnameSessionsRef.current, list('stockOpnameSessions')!, (local, server) => mergeById(local, server));
          stockOpnameSessionsRef.current = merged;
          setStockOpnameSessions(merged);
        }
        if (list('vendors')) {
          const merged = pickInitial(fresh, vendorsRef.current, list('vendors')!, (local, server) => mergeById(local, server));
          vendorsRef.current = merged;
          setVendors(merged);
        }
        if (list('purchaseOrders')) {
          const merged = pickInitial(fresh, purchaseOrdersRef.current, list('purchaseOrders')!, (local, server) => mergeById(local, server));
          purchaseOrdersRef.current = merged;
          setPurchaseOrders(merged);
        }
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 300);
        break;
      }
      case 'audit_logs': {
        if (list('auditLogs')) {
          const merged = pickInitial(fresh, auditLogsRef.current, list('auditLogs')!, (local, server) => mergeById(local, server).slice(0, 150));
          auditLogsRef.current = merged;
          setAuditLogs(merged);
        }
        break;
      }
    }
  };

  const markSynced = () => {
    const now = new Date();
    setLastSyncedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
    setCloudSyncStatus('connected');
  };

  /** Ambil dokumen dari server dan gabungkan; `onlyIds` membatasi dokumen yang diterapkan. */
  const pullWorkspace = async (onlyIds?: WorkspaceDocId[]) => {
    const docs = await api.fetchWorkspace();
    const fresh = freshBrowserRef.current;
    isRemoteUpdateRef.current = true;
    const ids = fresh ? ALL_WORKSPACE_DOC_IDS : (Object.keys(docs) as WorkspaceDocId[]);
    for (const id of ids) {
      if (onlyIds && !onlyIds.includes(id)) {
        continue;
      }
      applyRemoteDoc(id, (docs[id]?.data ?? {}) as Record<string, any>, fresh);
      if (docs[id]) {
        knownVersionsRef.current[id] = docs[id]!.version;
      }
    }
    setTimeout(() => { isRemoteUpdateRef.current = false; }, 300);
    markSynced();
  };

  // Muat data dari server saat aplikasi dibuka, lalu cek perubahan tiap 5 detik selama tab terlihat.
  useEffect(() => {
    let cancelled = false;
    let polling = false;

    const initialLoad = async () => {
      try {
        await pullWorkspace();
        if (cancelled) return;
        freshBrowserRef.current = false;
        isCloudInitializedRef.current = true;
      } catch (err) {
        console.warn('Initial workspace load failed:', err);
        setCloudSyncStatus('offline');
      }
    };

    const poll = async () => {
      if (polling || cancelled || document.visibilityState !== 'visible') return;
      if (!isCloudInitializedRef.current) {
        await initialLoad();
        return;
      }
      polling = true;
      try {
        const changed = docsToRefetch(knownVersionsRef.current, await api.fetchVersions());
        if (changed.length > 0 && !cancelled) {
          await pullWorkspace(changed);
        }
      } catch (err) {
        console.warn('Workspace poll failed:', err);
        setCloudSyncStatus('offline');
      } finally {
        polling = false;
      }
    };

    void initialLoad();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    const handleVisibility = () => { void poll(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Function to manually or automatically force sync to cloud (bidirectional union across all split docs)
  const syncToCloudNow = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      // Jangan gabungkan sebelum data awal dari server dimuat (mencegah data contoh ikut terkirim).
      if (!isCloudInitializedRef.current) {
        return { success: false, message: 'Data dari server belum selesai dimuat. Coba lagi sebentar.' };
      }
      setCloudSyncStatus('syncing');

      // 1. Direct fetch from server documents
      const cloudDocs = await api.fetchWorkspace();

      // 2. Union merge with local refs (local modifications always preserved!)
      const cloudOrders = cloudDocs.orders?.data.orders as Order[];
      const mergedOrders = mergeById(ordersRef.current, cloudOrders, deletedOrderIdsRef.current)
        .sort(orderSortComparator);

      const cloudMovements = cloudDocs.stock_movements?.data.stockMovements as StockMovement[];
      const mergedMovements = mergeById(stockMovementsRef.current, cloudMovements, deletedMovementIdsRef.current)
        .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

      const cloudMaster = (cloudDocs.master?.data ?? null) as Record<string, any> | null;
      const mergedSeries = mergeByKey(seriesRef.current, cloudMaster?.series, undefined, 'id');
      const mergedSkus = mergeByKey(skusRef.current, cloudMaster?.skus, undefined, 'sku');
      const mergedBom = mergeByKey(bomItemsRef.current, cloudMaster?.bomItems, undefined, 'id');
      const mergedCustomers = mergeById(customersRef.current, cloudMaster?.customers);
      const mergedResellers = mergeById(resellersRef.current, cloudMaster?.resellers);

      const cloudFinance = (cloudDocs.finance?.data ?? null) as Record<string, any> | null;
      const mergedBO = mergeById(biayaOperasionalRef.current, cloudFinance?.biayaOperasional);
      const mergedAccounts = mergeById(cashAccountsRef.current, cloudFinance?.cashAccounts);
      const mergedMutations = mergeById(cashMutationsRef.current, cloudFinance?.cashMutations);
      const mergedRecon = mergeById(bankReconciliationsRef.current, cloudFinance?.bankReconciliations);
      const mergedJournals = mergeById(journalEntriesRef.current, cloudFinance?.journalEntries);
      const mergedFixedAssets = mergeById(fixedAssetsRef.current, cloudFinance?.fixedAssets);
      const mergedOpexCategories = Array.from(new Set([...(cloudFinance?.customOpexCategories ?? []), ...customOpexCategoriesRef.current])) as string[];

      const cloudOps = (cloudDocs.operations?.data ?? null) as Record<string, any> | null;
      const mergedSurat = mergeById(suratTitipRef.current, cloudOps?.suratTitip);
      const mergedLaporan = mergeById(laporanTitipLakuRef.current, cloudOps?.laporanTitipLaku);
      const mergedSessions = mergeById(stockOpnameSessionsRef.current, cloudOps?.stockOpnameSessions);
      const mergedVendors = mergeById(vendorsRef.current, cloudOps?.vendors);
      const mergedPOs = mergeById(purchaseOrdersRef.current, cloudOps?.purchaseOrders);

      const cloudAudit = (cloudDocs.audit_logs?.data ?? null) as Record<string, any> | null;
      const mergedAudit = mergeById(auditLogsRef.current, cloudAudit?.auditLogs).slice(0, 150);

      // 3. Save back to server
      await Promise.all([
        saveWorkspaceDoc('orders', { orders: mergedOrders }),
        saveWorkspaceDoc('stock_movements', { stockMovements: mergedMovements }),
        saveWorkspaceDoc('master', {
          series: mergedSeries,
          skus: mergedSkus,
          bomItems: mergedBom,
          customers: mergedCustomers,
          resellers: mergedResellers,
        }),
        saveWorkspaceDoc('finance', {
          biayaOperasional: mergedBO,
          cashAccounts: mergedAccounts,
          cashMutations: mergedMutations,
          bankReconciliations: mergedRecon,
          journalEntries: mergedJournals,
          fixedAssets: mergedFixedAssets,
          balanceSheetConfig: balanceSheetConfigRef.current,
          customOpexCategories: mergedOpexCategories,
        }),
        saveWorkspaceDoc('operations', {
          suratTitip: mergedSurat,
          laporanTitipLaku: mergedLaporan,
          stockOpnameSessions: mergedSessions,
          vendors: mergedVendors,
          purchaseOrders: mergedPOs,
        }),
        saveWorkspaceDoc('audit_logs', {
          auditLogs: mergedAudit,
        })
      ]);

      // 4. Update local states and refs
      ordersRef.current = mergedOrders;
      stockMovementsRef.current = mergedMovements;
      seriesRef.current = mergedSeries;
      skusRef.current = mergedSkus;
      bomItemsRef.current = mergedBom;
      customersRef.current = mergedCustomers;
      resellersRef.current = mergedResellers;
      biayaOperasionalRef.current = mergedBO;
      cashAccountsRef.current = mergedAccounts;
      cashMutationsRef.current = mergedMutations;
      bankReconciliationsRef.current = mergedRecon;
      journalEntriesRef.current = mergedJournals;
      suratTitipRef.current = mergedSurat;
      laporanTitipLakuRef.current = mergedLaporan;
      stockOpnameSessionsRef.current = mergedSessions;
      vendorsRef.current = mergedVendors;
      purchaseOrdersRef.current = mergedPOs;
      auditLogsRef.current = mergedAudit;
      fixedAssetsRef.current = mergedFixedAssets;
      customOpexCategoriesRef.current = mergedOpexCategories;

      isRemoteUpdateRef.current = true;
      setOrders(mergedOrders);
      setStockMovements(mergedMovements);
      setSeries(mergedSeries);
      setSkus(mergedSkus);
      setBomItems(mergedBom);
      setCustomers(mergedCustomers);
      setResellers(mergedResellers);
      setBiayaOperasional(mergedBO);
      setCashAccounts(mergedAccounts);
      setCashMutations(mergedMutations);
      setBankReconciliations(mergedRecon);
      setJournalEntries(mergedJournals);
      setSuratTitip(mergedSurat);
      setLaporanTitipLaku(mergedLaporan);
      setStockOpnameSessions(mergedSessions);
      setVendors(mergedVendors);
      setPurchaseOrders(mergedPOs);
      setAuditLogs(mergedAudit);
      setFixedAssets(mergedFixedAssets);
      setCustomOpexCategories(mergedOpexCategories);

      const now = new Date();
      setLastSyncedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
      setCloudSyncStatus('connected');
      isCloudInitializedRef.current = true;

      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 500);

      return { success: true, message: 'Data berhasil disinkronkan ke server!' };
    } catch (e: any) {
      console.warn('Sync to cloud failed:', e);
      setCloudSyncStatus('error');
      return { success: false, message: e?.message || 'Gagal tersambung ke server cloud' };
    }
  };

  // Auto-sync on window focus (throttled to at most once per 60s) and online events
  useEffect(() => {
    let lastFocusSync = 0;
    const handleOnline = () => { syncToCloudNow(); };
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusSync > 60000) {
        lastFocusSync = now;
        syncToCloudNow();
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Debounced auto-save for Master Data
  useEffect(() => {
    if (isRemoteUpdateRef.current || !isCloudInitializedRef.current) return;
    if (masterSyncTimeoutRef.current) clearTimeout(masterSyncTimeoutRef.current);
    masterSyncTimeoutRef.current = setTimeout(() => { saveMasterToCloud(); }, 1500);
    return () => { if (masterSyncTimeoutRef.current) clearTimeout(masterSyncTimeoutRef.current); };
  }, [series, skus, bomItems, customers, resellers]);

  // Debounced auto-save for Finance Data
  useEffect(() => {
    if (isRemoteUpdateRef.current || !isCloudInitializedRef.current) return;
    if (financeSyncTimeoutRef.current) clearTimeout(financeSyncTimeoutRef.current);
    financeSyncTimeoutRef.current = setTimeout(() => { saveFinanceToCloud(); }, 1500);
    return () => { if (financeSyncTimeoutRef.current) clearTimeout(financeSyncTimeoutRef.current); };
  }, [biayaOperasional, cashAccounts, cashMutations, bankReconciliations, journalEntries, fixedAssets, balanceSheetConfig, customOpexCategories]);

  // Debounced auto-save for Operations Data
  useEffect(() => {
    if (isRemoteUpdateRef.current || !isCloudInitializedRef.current) return;
    if (operationsSyncTimeoutRef.current) clearTimeout(operationsSyncTimeoutRef.current);
    operationsSyncTimeoutRef.current = setTimeout(() => { saveOperationsToCloud(); }, 1500);
    return () => { if (operationsSyncTimeoutRef.current) clearTimeout(operationsSyncTimeoutRef.current); };
  }, [suratTitip, laporanTitipLaku, stockOpnameSessions, vendors, purchaseOrders]);

  // Debounced auto-save for Audit Logs
  useEffect(() => {
    if (isRemoteUpdateRef.current || !isCloudInitializedRef.current) return;
    if (auditSyncTimeoutRef.current) clearTimeout(auditSyncTimeoutRef.current);
    auditSyncTimeoutRef.current = setTimeout(() => {
      saveWorkspaceDoc('audit_logs', { auditLogs: auditLogsRef.current.slice(0, 150) }).catch((err) => reportSaveError('audit_logs', err));
    }, 1500);
    return () => { if (auditSyncTimeoutRef.current) clearTimeout(auditSyncTimeoutRef.current); };
  }, [auditLogs]);

  // Safe LocalStorage sync helper
  const safeSaveLocal = (key: string, data: any) => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn(`LocalStorage save skipped for ${key}:`, e);
    }
  };

  useEffect(() => { safeSaveLocal('series', series); }, [series]);
  useEffect(() => { safeSaveLocal('skus', skus); }, [skus]);
  useEffect(() => { safeSaveLocal('bom', bomItems); }, [bomItems]);
  useEffect(() => { safeSaveLocal('customers', customers); }, [customers]);
  useEffect(() => { safeSaveLocal('resellers', resellers); }, [resellers]);
  useEffect(() => { safeSaveLocal('orders', orders); }, [orders]);
  useEffect(() => { safeSaveLocal('movements', stockMovements); }, [stockMovements]);
  useEffect(() => { safeSaveLocal('surat_titip', suratTitip); }, [suratTitip]);
  useEffect(() => { safeSaveLocal('laporan_laku', laporanTitipLaku); }, [laporanTitipLaku]);
  useEffect(() => { safeSaveLocal('opex', biayaOperasional); }, [biayaOperasional]);
  useEffect(() => { safeSaveLocal('audit', auditLogs); }, [auditLogs]);
  useEffect(() => { safeSaveLocal('cash_accounts', cashAccounts); }, [cashAccounts]);
  useEffect(() => { safeSaveLocal('cash_mutations', cashMutations); }, [cashMutations]);
  useEffect(() => { safeSaveLocal('opname_sessions', stockOpnameSessions); }, [stockOpnameSessions]);
  useEffect(() => { safeSaveLocal('bank_reconciliations', bankReconciliations); }, [bankReconciliations]);
  useEffect(() => { safeSaveLocal('vendors', vendors); }, [vendors]);
  useEffect(() => { safeSaveLocal('purchase_orders', purchaseOrders); }, [purchaseOrders]);
  useEffect(() => { safeSaveLocal('journal_entries', journalEntries); }, [journalEntries]);
  useEffect(() => {
    try {
      localStorage.setItem('kalima_fixed_assets', JSON.stringify(fixedAssets));
      localStorage.setItem('kalima_balance_sheet_config', JSON.stringify(balanceSheetConfig));
      localStorage.setItem('kalima_custom_opex_categories', JSON.stringify(customOpexCategories));
    } catch (e) {
      console.warn('Local cache write failed:', e);
    }
  }, [fixedAssets, balanceSheetConfig, customOpexCategories]);

  const isOwner = currentUser.role === 'owner';

  const logout = async (): Promise<void> => {
    logAudit('Auth', 'Logout Pengguna', `Pengguna ${currentUser.name} keluar dari sistem`);
    try {
      sessionStorage.removeItem(`${STORAGE_PREFIX}login_logged_${currentUser.id}`);
    } catch {
      // abaikan
    }
    await onSignOut();
  };

  const logAudit = (module: AuditLog['module'], action: string, detail: string) => {
    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newEntry: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: formattedTime,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      module,
      detail,
    };
    setAuditLogs((prev) => [newEntry, ...prev.slice(0, 200)]);
  };

  // Catat login sekali per sesi browser (bukan setiap muat ulang halaman).
  useEffect(() => {
    const sessionKey = `${STORAGE_PREFIX}login_logged_${currentUser.id}`;
    try {
      if (sessionStorage.getItem(sessionKey)) {
        return;
      }
      sessionStorage.setItem(sessionKey, '1');
    } catch {
      // sessionStorage tidak tersedia: tetap catat login.
    }
    logAudit('Auth', 'Login Pengguna', `Pengguna ${currentUser.name} (${currentUser.role.toUpperCase()}) berhasil masuk ke sistem`);
  }, [currentUser.id]);

  // Pre-calculate memoized stock summary and indexed lookup map for instant O(1) queries
  const stockSummaryMemo = useMemo(() => {
    const summary: Record<string, { gudang: number; reseller: number; total: number; minStock: number }> = {};

    for (let i = 0; i < skus.length; i++) {
      const s = skus[i];
      summary[s.sku] = {
        gudang: 0,
        reseller: 0,
        total: 0,
        minStock: s.minStock ?? 10,
      };
    }

    for (let i = 0; i < stockMovements.length; i++) {
      const mov = stockMovements[i];
      let entry = summary[mov.sku];
      if (!entry) {
        entry = { gudang: 0, reseller: 0, total: 0, minStock: 10 };
        summary[mov.sku] = entry;
      }
      entry.total += mov.qty;
      if (mov.lokasi === 'Gudang Utama') {
        entry.gudang += mov.qty;
      } else if (mov.lokasi.startsWith('Reseller:')) {
        entry.reseller += mov.qty;
      }
    }

    return summary;
  }, [skus, stockMovements]);

  const lowStockSKUsMemo = useMemo(() => {
    return skus.filter((sku) => {
      const stockGudang = stockSummaryMemo[sku.sku]?.gudang ?? 0;
      return stockGudang <= sku.minStock;
    });
  }, [skus, stockSummaryMemo]);

  const calculateStockSummary = useCallback(() => {
    return stockSummaryMemo;
  }, [stockSummaryMemo]);

  const getLowStockSKUs = useCallback((): SKUItem[] => {
    return lowStockSKUsMemo;
  }, [lowStockSKUsMemo]);

  const calculateStock = useCallback((sku: string, lokasi?: string): number => {
    const entry = stockSummaryMemo[sku];
    if (!entry) return 0;
    if (!lokasi) return entry.total;
    if (lokasi === 'Gudang Utama') return entry.gudang;
    if (lokasi.startsWith('Reseller:')) {
      let sum = 0;
      for (let i = 0; i < stockMovements.length; i++) {
        const mov = stockMovements[i];
        if (mov.sku === sku && mov.lokasi === lokasi) {
          sum += mov.qty;
        }
      }
      return sum;
    }
    return 0;
  }, [stockSummaryMemo, stockMovements]);

  // Add Order (< 60s input workflow)
  const addOrder = useCallback(
    async (orderData: {
      channel: Order['channel'];
      customerId: string;
      customerNama: string;
      customerHp: string;
      customerKota: string;
      items: { sku: string; qty: number; hargaSatuan?: number }[];
      diskon: number;
      ongkir: number;
      statusBayar: PaymentStatus;
      totalTerbayar: number;
      jatuhTempo?: string;
      noResi?: string;
      catatan?: string;
      overrideStock?: boolean;
      tanggal?: string;
    }): Promise<{ success: boolean; error?: string; order?: Order }> => {
    // 1. Stock validation (Gudang Utama)
    if (!orderData.overrideStock) {
      for (const item of orderData.items) {
        const available = calculateStock(item.sku, 'Gudang Utama');
        if (available < item.qty) {
          const skuObj = skus.find((s) => s.sku === item.sku);
          return {
            success: false,
            error: `Stok tidak cukup untuk ${skuObj?.name || item.sku}. Tersedia di gudang: ${available} pcs, diminta: ${item.qty} pcs. Centang opsi "Izinkan Stok Minus / Pre-Order" di bawah jika fisik barang ada di toko atau pesanan PO.`,
          };
        }
      }
    }

    const orderDate = orderData.tanggal && orderData.tanggal.trim() ? orderData.tanggal.trim() : getLocalDateString();
    const cleanDate = orderDate.replace(/-/g, '');
    const sameDateOrders = ordersRef.current.filter((o) => (o.tanggal || '').replace(/-/g, '') === cleanDate);
    const nextSeq = sameDateOrders.length + 1;
    const orderNumber = `ORD-${cleanDate}-${String(nextSeq).padStart(3, '0')}`;
    const channelObj = channels.find((c) => c.name === orderData.channel);
    const adminFeePct = channelObj?.adminFeePercent ?? 0;

    let subtotal = 0;
    let totalHpp = 0;

    const detailedItems: OrderItem[] = orderData.items.map((it) => {
      const skuObj = skus.find((s) => s.sku === it.sku);
      const unitPrice =
        it.hargaSatuan !== undefined
          ? it.hargaSatuan
          : (it as { customPrice?: number }).customPrice !== undefined
          ? (it as { customPrice?: number }).customPrice!
          : (skuObj?.price ?? 129000);
      const unitHpp = skuObj?.hpp ?? 55000;
      const itemSubtotal = unitPrice * it.qty;

      subtotal += itemSubtotal;
      totalHpp += unitHpp * it.qty;

      return {
        sku: it.sku,
        namaProduk: skuObj?.name || it.sku,
        size: skuObj?.size || 'L',
        colorName: skuObj?.colorName || 'Default',
        qty: it.qty,
        hargaSatuan: unitPrice,
        hppSatuan: unitHpp,
        subtotal: itemSubtotal,
      };
    });

    const netSales = Math.max(0, subtotal - (orderData.diskon || 0));
    const adminFeeAmount = Math.round((netSales * adminFeePct) / 100);
    const totalTagihan = netSales + (orderData.ongkir || 0);
    const labaKotor = netSales - totalHpp - adminFeeAmount;
    const sisaPiutang = Math.max(0, totalTagihan - (orderData.totalTerbayar || 0));

    // Auto-create / sync customer in database if not yet existing
    let finalCustomerId = orderData.customerId;
    const custNamaTrimmed = orderData.customerNama.trim();
    const custHpTrimmed = (orderData.customerHp || '').trim();
    const normOrderPhone = normalizePhone(custHpTrimmed);
    const custKotaTrimmed = (orderData.customerKota || 'Jakarta').trim();

    if (custNamaTrimmed || normOrderPhone) {
      const existingCust = customersRef.current.find((c) => {
        if (orderData.customerId && c.id === orderData.customerId) return true;
        const normExistingPhone = normalizePhone(c.noHp);
        if (normOrderPhone.length >= 8 && normExistingPhone.length >= 8 && normExistingPhone === normOrderPhone) {
          return true;
        }
        if (custNamaTrimmed && c.nama.trim().toLowerCase() === custNamaTrimmed.toLowerCase()) {
          return true;
        }
        return false;
      });

      if (!existingCust) {
        const newCustId =
          orderData.customerId && orderData.customerId.startsWith('cust-')
            ? orderData.customerId
            : `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newCust: Customer = {
          id: newCustId,
          nama: custNamaTrimmed || `Customer ${custHpTrimmed}`,
          noHp: custHpTrimmed,
          kota: custKotaTrimmed,
          tipe: orderData.channel === 'Reseller' ? 'Reseller' : 'Retail',
        };
        const nextCustomers = [newCust, ...customersRef.current];
        customersRef.current = nextCustomers;
        setCustomers(nextCustomers);
        saveMasterToCloud({ customers: nextCustomers });
        finalCustomerId = newCustId;
      } else {
        finalCustomerId = existingCust.id;
        // Update / merge contact details if was previously blank or new data is available
        const nextCustomers = customersRef.current.map((c) =>
          c.id === existingCust.id
            ? {
                ...c,
                noHp: c.noHp || custHpTrimmed,
                kota: (!c.kota || c.kota === 'Jakarta') && custKotaTrimmed ? custKotaTrimmed : (c.kota || custKotaTrimmed),
                nama: (c.nama.startsWith('Customer 08') || c.nama.startsWith('Customer 62')) && custNamaTrimmed ? custNamaTrimmed : c.nama,
              }
            : c
        );
        customersRef.current = nextCustomers;
        setCustomers(nextCustomers);
        saveMasterToCloud({ customers: nextCustomers });
      }
    }

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      noOrder: orderNumber,
      tanggal: orderDate,
      channel: orderData.channel,
      customerId: finalCustomerId,
      customerNama: custNamaTrimmed,
      customerHp: custHpTrimmed,
      customerKota: custKotaTrimmed,
      noResi: orderData.noResi,
      items: detailedItems,
      subtotal,
      diskon: orderData.diskon || 0,
      ongkir: orderData.ongkir || 0,
      adminFeeAmount,
      totalTagihan,
      totalHpp,
      labaKotor,
      statusOrder: 'selesai',
      statusBayar: orderData.statusBayar,
      totalTerbayar: orderData.totalTerbayar,
      sisaPiutang,
      jatuhTempo: orderData.jatuhTempo,
      catatan: orderData.catatan,
      createdBy: currentUser.name,
    };

    // Stock movements deduction
    const movements: StockMovement[] = detailedItems.map((item, idx) => ({
      id: `sm-ord-${newOrder.id}-${idx}`,
      tanggal: orderDate,
      sku: item.sku,
      tipe: 'jual',
      qty: -item.qty,
      lokasi: 'Gudang Utama',
      referensi: orderNumber,
      catatan: `Penjualan ${newOrder.channel} ke ${newOrder.customerNama}`,
      recordedBy: currentUser.name,
    }));

    const nextOrders = [newOrder, ...ordersRef.current].sort(orderSortComparator);
    const nextMovements = [...movements, ...stockMovementsRef.current].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    ordersRef.current = nextOrders;
    stockMovementsRef.current = nextMovements;
    setOrders(nextOrders);
    setStockMovements(nextMovements);

    logAudit('Penjualan', 'Input Order Baru', `Order ${orderNumber} (${newOrder.channel}) total Rp ${totalTagihan.toLocaleString('id-ID')}`);
    if (orderData.overrideStock) {
      logAudit('Inventori', 'Override Stok Minus', `Order ${orderNumber} disimpan dengan stok minus/pre-order oleh ${currentUser.name} (${currentUser.role})`);
    }

    // Direct immediate save to the server awaited so persistence is verified before modal closes
    const saveRes = await saveOrdersToCloud(nextOrders, nextMovements);
    if (!saveRes.success) {
      console.warn('Persistence warning during addOrder:', saveRes.error);
    }

    return { success: true, order: newOrder };
  }, [calculateStock, skus, channels, currentUser, saveOrdersToCloud, saveMasterToCloud]);

  // Edit / Update Order (Memperbaiki kesalahan input SKU, qty, harga, dll)
  const updateOrder = (
    orderId: string,
    updatedData: {
      tanggal?: string;
      channel?: SalesChannelName;
      customerId?: string;
      customerNama?: string;
      customerHp?: string;
      customerKota?: string;
      noResi?: string;
      items?: { sku: string; qty: number; hargaSatuan?: number }[];
      diskon?: number;
      ongkir?: number;
      statusBayar?: PaymentStatus;
      totalTerbayar?: number;
      jatuhTempo?: string;
      catatan?: string;
      statusOrder?: OrderStatus;
      overrideStock?: boolean;
    }
  ) => {
    const existingOrder = orders.find((o) => o.id === orderId);
    if (!existingOrder) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    const channel = updatedData.channel || existingOrder.channel;
    const channelObj = channels.find((c) => c.name === channel);
    const adminFeePct = channelObj?.adminFeePercent ?? 0;

    let detailedItems: OrderItem[] = existingOrder.items;
    let subtotal = 0;
    let totalHpp = 0;

    if (updatedData.items) {
      if (updatedData.items.length === 0) {
        return { success: false, error: 'Order harus memiliki minimal 1 produk' };
      }

      // Check stock sufficiency jika bukan batal dan overrideStock false
      if (
        !updatedData.overrideStock &&
        existingOrder.statusOrder !== 'batal' &&
        updatedData.statusOrder !== 'batal'
      ) {
        for (const item of updatedData.items) {
          const skuObj = skus.find((s) => s.sku === item.sku);
          if (!skuObj) {
            return { success: false, error: `SKU ${item.sku} tidak terdaftar di sistem master` };
          }
          const oldQty = existingOrder.items.find((i) => i.sku === item.sku)?.qty || 0;
          const currentGudangStock = calculateStock(item.sku, 'Gudang Utama');
          const availableStock = currentGudangStock + oldQty;
          if (item.qty > availableStock) {
            return {
              success: false,
              error: `Stok tidak mencukupi untuk ${skuObj.name}. Tersedia: ${availableStock} pcs, diminta: ${item.qty} pcs.`,
            };
          }
        }
      }

      detailedItems = updatedData.items.map((it) => {
        const skuObj = skus.find((s) => s.sku === it.sku);
        const unitPrice =
          it.hargaSatuan !== undefined
            ? it.hargaSatuan
            : skuObj?.price || 120000;
        const unitHpp = skuObj?.hpp ?? 55000;
        const itemSubtotal = unitPrice * it.qty;

        subtotal += itemSubtotal;
        totalHpp += unitHpp * it.qty;

        return {
          sku: it.sku,
          namaProduk: skuObj?.name || it.sku,
          size: skuObj?.size || 'L',
          colorName: skuObj?.colorName || 'Default',
          qty: it.qty,
          hargaSatuan: unitPrice,
          hppSatuan: unitHpp,
          subtotal: itemSubtotal,
        };
      });
    } else {
      subtotal = existingOrder.subtotal;
      totalHpp = existingOrder.totalHpp;
    }

    const diskon = updatedData.diskon !== undefined ? updatedData.diskon : existingOrder.diskon;
    const ongkir = updatedData.ongkir !== undefined ? updatedData.ongkir : existingOrder.ongkir;
    const netSales = Math.max(0, subtotal - diskon);
    const adminFeeAmount = Math.round((netSales * adminFeePct) / 100);
    const totalTagihan = netSales + ongkir;
    const labaKotor = netSales - totalHpp - adminFeeAmount;
    const totalTerbayar =
      updatedData.totalTerbayar !== undefined
        ? updatedData.totalTerbayar
        : existingOrder.totalTerbayar;
    const sisaPiutang = Math.max(0, totalTagihan - totalTerbayar);
    const statusBayar =
      updatedData.statusBayar ||
      (sisaPiutang === 0 ? 'lunas' : totalTerbayar > 0 ? 'sebagian' : 'piutang');
    const statusOrder = updatedData.statusOrder || existingOrder.statusOrder;
    const tanggal = updatedData.tanggal || existingOrder.tanggal;

    const updatedOrder: Order = {
      ...existingOrder,
      tanggal,
      channel,
      customerId: updatedData.customerId ?? existingOrder.customerId,
      customerNama: updatedData.customerNama ?? existingOrder.customerNama,
      customerHp: updatedData.customerHp ?? existingOrder.customerHp,
      customerKota: updatedData.customerKota ?? existingOrder.customerKota,
      noResi: updatedData.noResi ?? existingOrder.noResi,
      items: detailedItems,
      subtotal,
      diskon,
      ongkir,
      adminFeeAmount,
      totalTagihan,
      totalHpp,
      labaKotor,
      statusOrder,
      statusBayar,
      totalTerbayar,
      sisaPiutang,
      jatuhTempo: updatedData.jatuhTempo ?? existingOrder.jatuhTempo,
      catatan: updatedData.catatan ?? existingOrder.catatan,
    };

    // Update stock movements jika status order bukan batal
    let nextMovements = stockMovementsRef.current;
    if (statusOrder !== 'batal') {
      const movements: StockMovement[] = detailedItems.map((item, idx) => ({
        id: `sm-ord-${orderId}-${idx}`,
        tanggal,
        sku: item.sku,
        tipe: 'jual',
        qty: -item.qty,
        lokasi: 'Gudang Utama',
        referensi: existingOrder.noOrder,
        catatan: `Penjualan (diedit) ${channel} ke ${updatedOrder.customerNama}`,
        recordedBy: currentUser.name,
      }));

      nextMovements = [
        ...movements,
        ...stockMovementsRef.current.filter(
          (m) =>
            !m.id.startsWith(`sm-ord-${orderId}-`) &&
            !(m.referensi === existingOrder.noOrder && m.tipe === 'jual')
        ),
      ];
      stockMovementsRef.current = nextMovements;
      setStockMovements(nextMovements);
    }

    const nextOrders = ordersRef.current.map((o) => (o.id === orderId ? updatedOrder : o));
    ordersRef.current = nextOrders;
    setOrders(nextOrders);
    logAudit(
      'Penjualan',
      'Edit Order',
      `Order ${existingOrder.noOrder} diperbarui (Total: Rp ${totalTagihan.toLocaleString('id-ID')}, Items: ${detailedItems.length} SKU)`
    );

    saveOrdersToCloud(nextOrders, nextMovements);

    return { success: true, order: updatedOrder };
  };

  // Hapus order langsung (Permanent Delete)
  const deleteOrder = (orderId: string) => {
    const targetOrder = ordersRef.current.find((o) => o.id === orderId);
    if (!targetOrder) return;

    deletedOrderIdsRef.current.add(orderId);

    const nextMovements = stockMovementsRef.current.filter(
      (m) =>
        !m.id.startsWith(`sm-ord-${orderId}-`) &&
        !m.id.startsWith(`sm-cancel-${orderId}-`) &&
        m.referensi !== targetOrder.noOrder
    );

    const nextOrders = ordersRef.current.filter((o) => o.id !== orderId);

    ordersRef.current = nextOrders;
    stockMovementsRef.current = nextMovements;
    setStockMovements(nextMovements);
    setOrders(nextOrders);
    logAudit('Penjualan', 'Hapus Order', `Order ${targetOrder.noOrder} dihapus permanen dari sistem`);

    saveOrdersToCloud(nextOrders, nextMovements);
  };

  // Order Cancellation Flow (Admin requests, Owner approves)
  const requestCancelOrder = (orderId: string, reason: string) => {
    const nextOrders = ordersRef.current.map((ord) => {
      if (ord.id !== orderId) return ord;
      return {
        ...ord,
        statusOrder: 'menunggu_approval_batal' as OrderStatus,
        cancellationReason: reason,
        cancellationRequestedBy: currentUser.name,
      };
    });
    ordersRef.current = nextOrders;
    setOrders(nextOrders);
    logAudit('Penjualan', 'Pengajuan Batal Order', `Order ${orderId} diajukan pembatalan: "${reason}"`);
    saveOrdersToCloud(nextOrders);
  };

  const approveCancelOrder = (orderId: string) => {
    if (!isOwner) return;
    const targetOrder = ordersRef.current.find((o) => o.id === orderId);
    if (!targetOrder) return;

    // Restore stock movements
    const todayStr = new Date().toISOString().split('T')[0];
    const restoreMovements: StockMovement[] = targetOrder.items.map((item, idx) => ({
      id: `sm-cancel-${orderId}-${idx}`,
      tanggal: todayStr,
      sku: item.sku,
      tipe: 'retur_jual',
      qty: item.qty, // positive return
      lokasi: 'Gudang Utama',
      referensi: `Batal Order ${targetOrder.noOrder}`,
      catatan: `Pengembalian stok dari order dibatalkan (${targetOrder.cancellationReason || 'Disetujui Owner'})`,
      recordedBy: currentUser.name,
    }));

    const nextOrders = ordersRef.current.map((ord) =>
      ord.id === orderId
        ? { ...ord, statusOrder: 'batal' as OrderStatus, sisaPiutang: 0 }
        : ord
    );
    const nextMovements = [...restoreMovements, ...stockMovementsRef.current];

    ordersRef.current = nextOrders;
    stockMovementsRef.current = nextMovements;
    setOrders(nextOrders);
    setStockMovements(nextMovements);
    logAudit('Penjualan', 'Setujui Pembatalan Order', `Order ${targetOrder.noOrder} resmi dibatalkan, stok dikembalikan.`);
    saveOrdersToCloud(nextOrders, nextMovements);
  };

  const rejectCancelOrder = (orderId: string) => {
    if (!isOwner) return;
    const nextOrders = ordersRef.current.map((ord) =>
      ord.id === orderId
        ? { ...ord, statusOrder: 'selesai' as OrderStatus, cancellationReason: undefined, cancellationRequestedBy: undefined }
        : ord
    );
    ordersRef.current = nextOrders;
    setOrders(nextOrders);
    logAudit('Penjualan', 'Tolak Pembatalan Order', `Permintaan pembatalan order ${orderId} ditolak.`);
    saveOrdersToCloud(nextOrders);
  };

  // Record Payment for Piutang
  const recordPayment = (orderId: string, amount: number, method: string, catatan?: string, accountId?: string) => {
    let targetOrderNo = orderId;
    const nextOrders = ordersRef.current.map((ord) => {
      if (ord.id !== orderId) return ord;
      targetOrderNo = ord.noOrder;
      const newTerbayar = ord.totalTerbayar + amount;
      const newSisa = Math.max(0, ord.totalTagihan - newTerbayar);
      const newStatus: PaymentStatus = newSisa === 0 ? 'lunas' : 'sebagian';
      return {
        ...ord,
        totalTerbayar: newTerbayar,
        sisaPiutang: newSisa,
        statusBayar: newStatus,
        catatan: catatan ? `${ord.catatan ? ord.catatan + ' | ' : ''}Bayar ${method} Rp ${amount.toLocaleString('id-ID')}` : ord.catatan,
      };
    });
    ordersRef.current = nextOrders;
    setOrders(nextOrders);

    // Otomatis catat mutasi kas masuk ke akun terkait jika ada
    let accToCredit = accountId ? cashAccounts.find((a) => a.id === accountId) : undefined;
    if (!accToCredit) {
      const lowerMethod = method.toLowerCase();
      if (lowerMethod.includes('bca')) {
        accToCredit = cashAccounts.find((a) => a.nama.toLowerCase().includes('bca'));
      } else if (lowerMethod.includes('mandiri')) {
        accToCredit = cashAccounts.find((a) => a.nama.toLowerCase().includes('mandiri'));
      } else if (lowerMethod.includes('cash') || lowerMethod.includes('tunai') || lowerMethod.includes('cod')) {
        accToCredit = cashAccounts.find((a) => a.tipe === 'tunai');
      } else if (lowerMethod.includes('qris')) {
        accToCredit = cashAccounts.find((a) => a.tipe === 'e-wallet');
      }
    }

    if (accToCredit) {
      const todayStr = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const newSaldo = accToCredit.saldo + amount;

      setCashAccounts((prev) =>
        prev.map((acc) => (acc.id === accToCredit!.id ? { ...acc, saldo: newSaldo } : acc))
      );

      const newMutation: CashMutation = {
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        tanggal: todayStr,
        waktu: nowTime,
        accountId: accToCredit.id,
        accountNama: accToCredit.nama,
        tipe: 'masuk',
        jumlah: amount,
        kategori: 'Pelunasan Piutang',
        deskripsi: `Pelunasan piutang order #${targetOrderNo} via ${method}`,
        referensi: `Order #${targetOrderNo}`,
        saldoSetelah: newSaldo,
        dicatatOleh: currentUser.name,
      };

      setCashMutations((prev) => [newMutation, ...prev]);
    }

    logAudit('Keuangan', 'Penerimaan Pembayaran', `Pembayaran Rp ${amount.toLocaleString('id-ID')} via ${method} untuk order ${targetOrderNo}`);
    saveOrdersToCloud(nextOrders);
  };

  // Restock (Barang Masuk)
  const recordRestock = (items: { sku: string; qty: number }[], sumber: string, catatan?: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newMovements: StockMovement[] = items.map((it, idx) => ({
      id: `sm-in-${Date.now()}-${idx}`,
      tanggal: todayStr,
      sku: it.sku,
      tipe: 'masuk',
      qty: it.qty,
      lokasi: 'Gudang Utama',
      referensi: `Barang Masuk: ${sumber}`,
      catatan: catatan || `Batch produksi ${sumber}`,
      recordedBy: currentUser.name,
    }));

    const nextMovements = [...newMovements, ...stockMovementsRef.current];
    stockMovementsRef.current = nextMovements;
    setStockMovements(nextMovements);
    const totalPcs = items.reduce((a, b) => a + b.qty, 0);
    logAudit('Inventori', 'Barang Masuk', `Restock ${totalPcs} pcs dari ${sumber}`);
    saveOrdersToCloud(undefined, nextMovements);
  };

  // Stock Opname
  const recordStockOpname = (sku: string, physicalCount: number, catatan: string) => {
    const currentSystemStock = calculateStock(sku, 'Gudang Utama');
    const selisih = physicalCount - currentSystemStock;
    if (selisih === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const skuObj = skus.find((s) => s.sku === sku);
    const hppSatuan = skuObj?.hpp ?? 50000;
    const selisihNominal = selisih * hppSatuan;
    const nowTs = Date.now();
    const sessionNo = `SO-${todayStr.replace(/-/g, '').substring(0, 6)}-${String(stockOpnameSessions.length + 1).padStart(3, '0')}`;

    const movement: StockMovement = {
      id: `sm-opname-${nowTs}`,
      tanggal: todayStr,
      sku,
      tipe: 'opname',
      qty: selisih,
      lokasi: 'Gudang Utama',
      referensi: `Opname Fisik (${sessionNo})`,
      catatan: `${catatan} (Fisik: ${physicalCount}, Sistem: ${currentSystemStock}, Selisih: ${selisih > 0 ? '+' : ''}${selisih} pcs)`,
      recordedBy: currentUser.name,
    };

    const singleSession: StockOpnameSession = {
      id: `so-sess-${nowTs}`,
      nomorSesi: sessionNo,
      tanggal: todayStr,
      judul: `Penyesuaian Cepat SKU ${sku}`,
      kategoriFilter: skuObj?.seriesCode || 'Umum',
      lokasi: 'Gudang Utama',
      items: [
        {
          sku,
          namaProduk: skuObj?.name || sku,
          systemQty: currentSystemStock,
          physicalQty: physicalCount,
          selisihQty: selisih,
          hppSatuan,
          selisihNominal,
          alasan: catatan,
        },
      ],
      totalItemChecked: 1,
      totalMatch: 0,
      totalSurplus: selisih > 0 ? 1 : 0,
      totalDeficit: selisih < 0 ? 1 : 0,
      netSelisihQty: selisih,
      netSelisihNominal: selisihNominal,
      alasanGlobal: catatan,
      petugas: currentUser.name,
      userRole: currentUser.role,
      status: 'selesai',
    };

    setStockMovements((prev) => [movement, ...prev]);
    setStockOpnameSessions((prev) => [singleSession, ...prev]);
    logAudit('Inventori', 'Stok Opname Cepat', `Penyesuaian fisik ${sku}: Sistem ${currentSystemStock} → Fisik ${physicalCount} (Selisih: ${selisih > 0 ? '+' : ''}${selisih} pcs, Dampak Nilai: Rp ${selisihNominal.toLocaleString('id-ID')}). Alasan: ${catatan}`);
  };

  // Batch / Periodic Stock Opname
  const recordBatchStockOpname = (data: {
    judul: string;
    kategoriFilter?: string;
    lokasi?: string;
    items: { sku: string; physicalQty: number; alasan?: string }[];
    alasanGlobal: string;
    tanggal?: string;
  }): { success: boolean; session?: StockOpnameSession; error?: string } => {
    const todayStr = data.tanggal || new Date().toISOString().split('T')[0];
    const lokasi = data.lokasi || 'Gudang Utama';

    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Tidak ada item SKU yang dipilih untuk opname' };
    }

    let totalMatch = 0;
    let totalSurplus = 0;
    let totalDeficit = 0;
    let netSelisihQty = 0;
    let netSelisihNominal = 0;
    const processedItems: StockOpnameItem[] = [];
    const newMovements: StockMovement[] = [];

    const nowTs = Date.now();
    const sessionNo = `SO-${todayStr.replace(/-/g, '').substring(0, 6)}-${String(stockOpnameSessions.length + 1).padStart(3, '0')}`;

    data.items.forEach((it, idx) => {
      const skuObj = skus.find((s) => s.sku === it.sku);
      const systemQty = calculateStock(it.sku, lokasi);
      const selisihQty = it.physicalQty - systemQty;
      const hppSatuan = skuObj?.hpp ?? 50000;
      const selisihNominal = selisihQty * hppSatuan;

      if (selisihQty === 0) {
        totalMatch += 1;
      } else if (selisihQty > 0) {
        totalSurplus += 1;
      } else {
        totalDeficit += 1;
      }

      netSelisihQty += selisihQty;
      netSelisihNominal += selisihNominal;

      const itemAlasan = it.alasan?.trim() || (selisihQty === 0 ? 'Sesuai hitungan fisik' : data.alasanGlobal);

      processedItems.push({
        sku: it.sku,
        namaProduk: skuObj?.name || it.sku,
        systemQty,
        physicalQty: it.physicalQty,
        selisihQty,
        hppSatuan,
        selisihNominal,
        alasan: itemAlasan,
      });

      if (selisihQty !== 0) {
        newMovements.push({
          id: `sm-opname-${nowTs}-${idx}`,
          tanggal: todayStr,
          sku: it.sku,
          tipe: 'opname',
          qty: selisihQty,
          lokasi,
          referensi: `Sesi Opname #${sessionNo}`,
          catatan: `${itemAlasan} (Fisik: ${it.physicalQty}, Sistem: ${systemQty}, Selisih: ${selisihQty > 0 ? '+' : ''}${selisihQty} pcs)`,
          recordedBy: currentUser.name,
        });
      }
    });

    const newSession: StockOpnameSession = {
      id: `so-sess-${nowTs}`,
      nomorSesi: sessionNo,
      tanggal: todayStr,
      judul: data.judul || `Stok Opname ${todayStr}`,
      kategoriFilter: data.kategoriFilter || 'Semua Lini',
      lokasi,
      items: processedItems,
      totalItemChecked: processedItems.length,
      totalMatch,
      totalSurplus,
      totalDeficit,
      netSelisihQty,
      netSelisihNominal,
      alasanGlobal: data.alasanGlobal,
      petugas: currentUser.name,
      userRole: currentUser.role,
      status: 'selesai',
    };

    if (newMovements.length > 0) {
      setStockMovements((prev) => [...newMovements, ...prev]);
    }
    setStockOpnameSessions((prev) => [newSession, ...prev]);

    const summaryText = `Sesi ${sessionNo} (${data.judul}): ${processedItems.length} SKU diperiksa (${totalMatch} cocok, ${totalSurplus} surplus, ${totalDeficit} minus). Net selisih: ${netSelisihQty > 0 ? '+' : ''}${netSelisihQty} pcs (Dampak Nilai: Rp ${netSelisihNominal.toLocaleString('id-ID')}). Alasan: ${data.alasanGlobal}`;
    logAudit('Inventori', 'Stok Opname Berkala', summaryText);

    return { success: true, session: newSession };
  };

  // Reject / Rusak
  const recordReject = (sku: string, qty: number, alasan: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const movement: StockMovement = {
      id: `sm-rej-${Date.now()}`,
      tanggal: todayStr,
      sku,
      tipe: 'reject',
      qty: -qty,
      lokasi: 'Gudang Utama',
      referensi: 'Barang Reject / Cacat',
      catatan: alasan,
      recordedBy: currentUser.name,
    };

    setStockMovements((prev) => [movement, ...prev]);
    logAudit('Inventori', 'Catat Barang Reject', `${qty} pcs ${sku} dipindahkan ke reject. Alasan: ${alasan}`);
  };

  // Reseller / Konsinyasi Methods
  const createSuratTitip = (
    resellerId: string,
    items: { sku: string; qty: number; hargaTitip: number }[],
    catatan?: string
  ): { success: boolean; error?: string } => {
    const reseller = resellers.find((r) => r.id === resellerId);
    if (!reseller) return { success: false, error: 'Reseller tidak ditemukan.' };

    // Check warehouse stock
    for (const item of items) {
      const available = calculateStock(item.sku, 'Gudang Utama');
      if (available < item.qty) {
        return {
          success: false,
          error: `Stok gudang tidak cukup untuk ${item.sku}. Tersedia: ${available} pcs, diminta: ${item.qty} pcs.`,
        };
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const noSurat = `SJ-TITIP-${todayStr.replace(/-/g, '').substring(2)}-${String(suratTitip.length + 1).padStart(3, '0')}`;
    const totalQty = items.reduce((sum, it) => sum + it.qty, 0);
    const totalNilai = items.reduce((sum, it) => sum + it.qty * it.hargaTitip, 0);

    const detailedItems = items.map((it) => {
      const skuObj = skus.find((s) => s.sku === it.sku);
      return {
        sku: it.sku,
        namaProduk: skuObj?.name || it.sku,
        qty: it.qty,
        hargaTitip: it.hargaTitip,
      };
    });

    const newSurat: SuratTitip = {
      id: `st-${Date.now()}`,
      noSurat,
      tanggal: todayStr,
      resellerId,
      resellerNama: reseller.nama,
      items: detailedItems,
      totalQty,
      totalNilai,
      catatan,
      status: 'dikirim',
    };

    // Movements: Out of Gudang Utama, In to Reseller Location
    const movements: StockMovement[] = [];
    detailedItems.forEach((it, i) => {
      movements.push({
        id: `sm-st-out-${newSurat.id}-${i}`,
        tanggal: todayStr,
        sku: it.sku,
        tipe: 'titip',
        qty: -it.qty,
        lokasi: 'Gudang Utama',
        referensi: noSurat,
        catatan: `Kirim titipan ke ${reseller.nama}`,
        recordedBy: currentUser.name,
      });
      movements.push({
        id: `sm-st-in-${newSurat.id}-${i}`,
        tanggal: todayStr,
        sku: it.sku,
        tipe: 'titip',
        qty: it.qty,
        lokasi: `Reseller: ${reseller.nama}`,
        referensi: noSurat,
        catatan: `Titipan aktif di ${reseller.nama}`,
        recordedBy: currentUser.name,
      });
    });

    setSuratTitip((prev) => [newSurat, ...prev]);
    setStockMovements((prev) => [...movements, ...prev]);
    logAudit('Reseller', 'Kirim Surat Titipan', `${noSurat}: ${totalQty} pcs ke ${reseller.nama} (Nilai Rp ${totalNilai.toLocaleString('id-ID')})`);

    return { success: true };
  };

  const createLaporanTitipLaku = (
    resellerId: string,
    periode: string,
    items: { sku: string; qty: number; hargaTitip: number }[],
    statusBayar: PaymentStatus,
    terbayar: number
  ) => {
    const reseller = resellers.find((r) => r.id === resellerId);
    if (!reseller) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const noLaporan = `LAKU-TITIP-${todayStr.replace(/-/g, '').substring(2)}-${String(laporanTitipLaku.length + 1).padStart(2, '0')}`;
    let totalTagihan = 0;

    const formattedItems = items.map((it) => {
      const skuObj = skus.find((s) => s.sku === it.sku);
      const subtotal = it.qty * it.hargaTitip;
      totalTagihan += subtotal;
      return {
        sku: it.sku,
        namaProduk: skuObj?.name || it.sku,
        qty: it.qty,
        hargaTitip: it.hargaTitip,
        subtotal,
      };
    });

    const newLaporan: LaporanTitipLaku = {
      id: `ltl-${Date.now()}`,
      noLaporan,
      tanggal: todayStr,
      periode,
      resellerId,
      resellerNama: reseller.nama,
      items: formattedItems,
      totalTagihan,
      statusBayar,
      terbayar,
    };

    // Deduct stock from Reseller Location
    const movements: StockMovement[] = formattedItems.map((it, i) => ({
      id: `sm-laku-${newLaporan.id}-${i}`,
      tanggal: todayStr,
      sku: it.sku,
      tipe: 'laku_titip',
      qty: -it.qty,
      lokasi: `Reseller: ${reseller.nama}`,
      referensi: noLaporan,
      catatan: `Terjual laku di ${reseller.nama}`,
      recordedBy: currentUser.name,
    }));

    // Automatically create a Sales Order in channel "Reseller"
    const orderItems: OrderItem[] = formattedItems.map((it) => {
      const skuObj = skus.find((s) => s.sku === it.sku);
      return {
        sku: it.sku,
        namaProduk: it.namaProduk,
        size: skuObj?.size || 'L',
        colorName: skuObj?.colorName || '',
        qty: it.qty,
        hargaSatuan: it.hargaTitip,
        hppSatuan: skuObj?.hpp || 55000,
        subtotal: it.subtotal,
      };
    });

    const orderHpp = orderItems.reduce((acc, it) => acc + it.qty * it.hppSatuan, 0);

    const resellerOrder: Order = {
      id: `ord-titip-${Date.now()}`,
      noOrder: `KLM-RES-${noLaporan}`,
      tanggal: todayStr,
      channel: 'Reseller',
      customerId: reseller.id,
      customerNama: reseller.nama,
      customerHp: reseller.noHp,
      customerKota: reseller.kota,
      items: orderItems,
      subtotal: totalTagihan,
      diskon: 0,
      ongkir: 0,
      adminFeeAmount: 0,
      totalTagihan,
      totalHpp: orderHpp,
      labaKotor: totalTagihan - orderHpp,
      statusOrder: 'selesai',
      statusBayar,
      totalTerbayar: terbayar,
      sisaPiutang: Math.max(0, totalTagihan - terbayar),
      catatan: `Laporan Penjualan Titipan ${periode}`,
      createdBy: currentUser.name,
    };

    newLaporan.orderIdRef = resellerOrder.id;

    setLaporanTitipLaku((prev) => [newLaporan, ...prev]);
    setOrders((prev) => [resellerOrder, ...prev]);
    setStockMovements((prev) => [...movements, ...prev]);

    // Otomatis catat kas masuk jika ada pembayaran langsung pada laporan konsinyasi
    if (terbayar > 0) {
      const targetAcc = cashAccounts.find((a) => a.isDefault) || cashAccounts[0];
      if (targetAcc) {
        const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const newSaldo = targetAcc.saldo + terbayar;
        setCashAccounts((prev) =>
          prev.map((acc) => (acc.id === targetAcc.id ? { ...acc, saldo: newSaldo } : acc))
        );
        const newMutation: CashMutation = {
          id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          tanggal: todayStr,
          waktu: nowTime,
          accountId: targetAcc.id,
          accountNama: targetAcc.nama,
          tipe: 'masuk',
          jumlah: terbayar,
          kategori: 'Laporan Konsinyasi Reseller',
          deskripsi: `Penerimaan setor laku konsinyasi ${reseller.nama} (${noLaporan})`,
          referensi: noLaporan,
          saldoSetelah: newSaldo,
          dicatatOleh: currentUser.name,
        };
        setCashMutations((prev) => [newMutation, ...prev]);
      }
    }

    logAudit('Reseller', 'Laporan Laku Titipan', `${noLaporan}: ${reseller.nama} melaporkan laku total Rp ${totalTagihan.toLocaleString('id-ID')}`);
  };

  const recordReturTitip = (
    resellerId: string,
    items: { sku: string; qty: number; kondisi: 'baik_ke_gudang' | 'rusak_ke_reject' }[],
    alasan: string
  ) => {
    const reseller = resellers.find((r) => r.id === resellerId);
    if (!reseller) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const movements: StockMovement[] = [];

    items.forEach((it, i) => {
      // Deduct from Reseller location
      movements.push({
        id: `sm-retur-out-${Date.now()}-${i}`,
        tanggal: todayStr,
        sku: it.sku,
        tipe: 'retur_titip',
        qty: -it.qty,
        lokasi: `Reseller: ${reseller.nama}`,
        referensi: `Retur Titipan: ${reseller.nama}`,
        catatan: alasan,
        recordedBy: currentUser.name,
      });

      // Add to Gudang or Reject
      if (it.kondisi === 'baik_ke_gudang') {
        movements.push({
          id: `sm-retur-in-${Date.now()}-${i}`,
          tanggal: todayStr,
          sku: it.sku,
          tipe: 'retur_titip',
          qty: it.qty,
          lokasi: 'Gudang Utama',
          referensi: `Retur Masuk Gudang: ${reseller.nama}`,
          catatan: `Barang baik kembali ke stok gudang: ${alasan}`,
          recordedBy: currentUser.name,
        });
      } else {
        movements.push({
          id: `sm-retur-rej-${Date.now()}-${i}`,
          tanggal: todayStr,
          sku: it.sku,
          tipe: 'reject',
          qty: -it.qty,
          lokasi: 'Gudang Utama',
          referensi: `Retur Cacat: ${reseller.nama}`,
          catatan: `Barang cacat/rusak dari reseller: ${alasan}`,
          recordedBy: currentUser.name,
        });
      }
    });

    setStockMovements((prev) => [...movements, ...prev]);
    logAudit('Reseller', 'Retur Titipan', `Retur dari ${reseller.nama}: ${alasan}`);
  };

  const recordSetoranReseller = (resellerId: string, jumlah: number, metode: string, catatan?: string, accountId?: string) => {
    const reseller = resellers.find((r) => r.id === resellerId);
    if (!reseller) return;

    // Find unpaid orders for this reseller and apply payment
    let remainingAmount = jumlah;
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.channel === 'Reseller' && ord.customerId === resellerId && ord.sisaPiutang > 0 && remainingAmount > 0) {
          const deduction = Math.min(remainingAmount, ord.sisaPiutang);
          remainingAmount -= deduction;
          const newTerbayar = ord.totalTerbayar + deduction;
          const newSisa = ord.totalTagihan - newTerbayar;
          return {
            ...ord,
            totalTerbayar: newTerbayar,
            sisaPiutang: newSisa,
            statusBayar: (newSisa === 0 ? 'lunas' : 'sebagian') as PaymentStatus,
          };
        }
        return ord;
      })
    );

    // Otomatis catat mutasi kas masuk ke akun terkait
    let accToCredit = accountId ? cashAccounts.find((a) => a.id === accountId) : undefined;
    if (!accToCredit) {
      const lowerMethod = (metode || '').toLowerCase();
      if (lowerMethod.includes('bca')) {
        accToCredit = cashAccounts.find((a) => a.nama.toLowerCase().includes('bca'));
      } else if (lowerMethod.includes('mandiri')) {
        accToCredit = cashAccounts.find((a) => a.nama.toLowerCase().includes('mandiri'));
      } else if (lowerMethod.includes('cash') || lowerMethod.includes('tunai') || lowerMethod.includes('cod')) {
        accToCredit = cashAccounts.find((a) => a.tipe === 'tunai');
      } else if (lowerMethod.includes('qris')) {
        accToCredit = cashAccounts.find((a) => a.tipe === 'e-wallet');
      } else {
        accToCredit = cashAccounts.find((a) => a.isDefault) || cashAccounts[0];
      }
    }

    if (accToCredit) {
      const todayStr = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const newSaldo = accToCredit.saldo + jumlah;

      setCashAccounts((prev) =>
        prev.map((acc) => (acc.id === accToCredit!.id ? { ...acc, saldo: newSaldo } : acc))
      );

      const newMutation: CashMutation = {
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        tanggal: todayStr,
        waktu: nowTime,
        accountId: accToCredit.id,
        accountNama: accToCredit.nama,
        tipe: 'masuk',
        jumlah: jumlah,
        kategori: 'Setoran Reseller',
        deskripsi: `Setoran reseller ${reseller.nama} via ${metode}${catatan ? ` (${catatan})` : ''}`,
        referensi: `Reseller: ${reseller.nama}`,
        saldoSetelah: newSaldo,
        dicatatOleh: currentUser.name,
      };

      setCashMutations((prev) => [newMutation, ...prev]);
    }

    logAudit('Keuangan', 'Setoran Reseller', `Setoran Rp ${jumlah.toLocaleString('id-ID')} via ${metode} dari ${reseller.nama} ${catatan ? `(${catatan})` : ''}`);
  };

  // ==========================================
  // PENGADAAN & PEMBELIAN KAOS DARI VENDOR (PO)
  // ==========================================
  const addVendor = (vendorData: Omit<Vendor, 'id' | 'totalPO' | 'totalBelanja'>): Vendor => {
    const newVen: Vendor = {
      ...vendorData,
      id: `ven-${Date.now()}`,
      totalPO: 0,
      totalBelanja: 0,
    };
    setVendors((prev) => [newVen, ...prev]);
    logAudit(
      'Pengadaan',
      'Tambah Vendor / Supplier',
      `Menambahkan vendor baru: ${newVen.nama} (${newVen.kategori}) - ${newVen.kota}`
    );
    return newVen;
  };

  const updateVendor = (id: string, updates: Partial<Vendor>) => {
    setVendors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...updates } : v))
    );
    logAudit('Pengadaan', 'Update Data Vendor', `Memperbarui profil vendor ID: ${id}`);
  };

  const deleteVendor = (id: string): { success: boolean; error?: string } => {
    const hasPOs = purchaseOrders.some((po) => po.vendorId === id && po.statusPO !== 'batal');
    if (hasPOs) {
      return {
        success: false,
        error: 'Vendor tidak dapat dihapus karena memiliki riwayat Purchase Order aktif.',
      };
    }
    const ven = vendors.find((v) => v.id === id);
    setVendors((prev) => prev.filter((v) => v.id !== id));
    logAudit('Pengadaan', 'Hapus Vendor', `Menghapus vendor: ${ven?.nama || id}`);
    return { success: true };
  };

  const createPurchaseOrder = (data: {
    vendorId: string;
    tanggalPO: string;
    items: { sku: string; qtyPesan: number; hargaBeliSatuan: number; catatan?: string }[];
    biayaEkspedisi?: number;
    biayaTambahan?: number;
    statusBayar: PurchasePaymentStatus;
    jumlahTerbayar: number;
    jatuhTempoBayar?: string;
    accountId?: string;
    ekspedisi?: string;
    noResi?: string;
    tanggalKirim?: string;
    estimasiTiba?: string;
    alamatTujuanGudang?: string;
    catatanPengiriman?: string;
    catatanPO?: string;
    gudangTujuan?: string;
  }): { success: boolean; po?: PurchaseOrder; error?: string } => {
    const vendor = vendors.find((v) => v.id === data.vendorId);
    if (!vendor) {
      return { success: false, error: 'Vendor supplier tidak ditemukan.' };
    }
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Minimal 1 item kaos/bahan harus dipilih dalam PO.' };
    }

    const todayStr = data.tanggalPO || new Date().toISOString().split('T')[0];
    const poSeq = String(purchaseOrders.length + 1).padStart(3, '0');
    const noPO = `PO-KLM-${todayStr.replace(/-/g, '').substring(0, 6)}-${poSeq}`;

    let totalQtyPesan = 0;
    let totalBiayaBahan = 0;

    const detailedItems: PurchaseOrderItem[] = data.items.map((it) => {
      const skuObj = skus.find((s) => s.sku === it.sku);
      const subtotal = it.qtyPesan * it.hargaBeliSatuan;
      totalQtyPesan += it.qtyPesan;
      totalBiayaBahan += subtotal;

      return {
        sku: it.sku,
        namaProduk: skuObj?.name || it.sku,
        size: skuObj?.size || 'L',
        colorName: skuObj?.colorName || 'Hitam',
        qtyPesan: it.qtyPesan,
        qtyDiterima: 0,
        hargaBeliSatuan: it.hargaBeliSatuan,
        subtotal,
        catatan: it.catatan || '',
      };
    });

    const biayaEkspedisi = data.biayaEkspedisi || 0;
    const biayaTambahan = data.biayaTambahan || 0;
    const totalTagihan = totalBiayaBahan + biayaEkspedisi + biayaTambahan;
    const jumlahTerbayar = Math.min(totalTagihan, data.jumlahTerbayar || 0);
    const sisaHutang = Math.max(0, totalTagihan - jumlahTerbayar);

    let statusBayar: PurchasePaymentStatus = data.statusBayar;
    if (jumlahTerbayar >= totalTagihan && totalTagihan > 0) {
      statusBayar = 'lunas';
    } else if (jumlahTerbayar > 0) {
      statusBayar = 'dp';
    } else {
      statusBayar = 'belum_bayar';
    }

    let initialStatusPO: PurchaseOrderStatus = 'dipesan';
    if (data.noResi && data.noResi.trim()) {
      initialStatusPO = 'dikirim';
    }

    let accObj: CashAccount | undefined;
    if (data.accountId) {
      accObj = cashAccounts.find((a) => a.id === data.accountId);
    }

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      noPO,
      tanggalPO: todayStr,
      vendorId: vendor.id,
      vendorNama: vendor.nama,
      vendorHp: vendor.noHp,
      vendorKota: vendor.kota,
      vendorAlamat: vendor.alamat,
      items: detailedItems,
      totalQtyPesan,
      totalQtyDiterima: 0,
      totalBiayaBahan,
      biayaEkspedisi,
      biayaTambahan,
      totalTagihan,
      statusPO: initialStatusPO,
      statusBayar,
      jumlahTerbayar,
      sisaHutang,
      jatuhTempoBayar: data.jatuhTempoBayar,
      accountId: data.accountId,
      accountNama: accObj?.nama,
      ekspedisi: data.ekspedisi,
      noResi: data.noResi,
      tanggalKirim: data.tanggalKirim,
      estimasiTiba: data.estimasiTiba,
      alamatTujuanGudang: data.alamatTujuanGudang || 'Gudang Utama Kalima Apparel - Bandung',
      catatanPengiriman: data.catatanPengiriman,
      gudangTujuan: data.gudangTujuan || 'Gudang Utama',
      catatanPO: data.catatanPO,
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    // If initial payment was made from cash account, deduct cash balance
    if (jumlahTerbayar > 0 && accObj) {
      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const newSaldo = accObj.saldo - jumlahTerbayar;

      setCashAccounts((prev) =>
        prev.map((acc) => (acc.id === accObj!.id ? { ...acc, saldo: newSaldo } : acc))
      );

      const newMutation: CashMutation = {
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        tanggal: todayStr,
        waktu: nowTime,
        accountId: accObj.id,
        accountNama: accObj.nama,
        tipe: 'keluar',
        jumlah: jumlahTerbayar,
        kategori: 'Pembelian Bahan & Kaos / Vendor',
        deskripsi: `Pembayaran ${statusBayar === 'lunas' ? 'Lunas' : 'DP'} ${noPO} ke ${vendor.nama}`,
        referensi: noPO,
        saldoSetelah: newSaldo,
        dicatatOleh: currentUser.name,
      };

      setCashMutations((prev) => [newMutation, ...prev]);

      // Otomatisasi Penjurnalan Akuntansi untuk Uang Muka / Pembayaran Awal PO
      const journalNo = `JU-${todayStr.replace(/-/g, '').substring(0, 6)}-${String(journalEntries.length + 1).padStart(4, '0')}`;
      const initialJournal: JournalEntry = {
        id: `je-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        noJurnal: journalNo,
        tanggal: todayStr,
        waktu: nowTime,
        tipe: 'pembayaran_utang_vendor',
        referensi: noPO,
        keterangan: `Pembayaran ${statusBayar === 'lunas' ? 'Lunas' : 'DP/Termin 1'} PO #${noPO} ke ${vendor.nama} via ${accObj.nama}`,
        items: [
          {
            accountCode: '2-10100',
            accountName: `Utang Dagang (Vendor: ${vendor.nama})`,
            category: 'Kewajiban',
            debit: jumlahTerbayar,
            kredit: 0,
            memo: `Debit pengurang kewajiban awal PO #${noPO}`,
          },
          {
            accountId: accObj.id,
            accountCode: '1-10100',
            accountName: `Kas & Bank (${accObj.nama})`,
            category: 'Aset',
            debit: 0,
            kredit: jumlahTerbayar,
            memo: `Kredit mutasi kas keluar dari ${accObj.nama}`,
          },
        ],
        totalDebit: jumlahTerbayar,
        totalKredit: jumlahTerbayar,
        isBalanced: true,
        dicatatOleh: currentUser.name,
        createdAt: new Date().toISOString(),
      };
      setJournalEntries((prev) => [initialJournal, ...prev]);
    }

    // Update vendor total purchases stats
    setVendors((prev) =>
      prev.map((v) =>
        v.id === vendor.id
          ? {
              ...v,
              totalPO: (v.totalPO || 0) + 1,
              totalBelanja: (v.totalBelanja || 0) + totalTagihan,
            }
          : v
      )
    );

    setPurchaseOrders((prev) => [newPO, ...prev]);
    logAudit(
      'Pengadaan',
      'Buat Purchase Order Kaos',
      `Menerbitkan ${noPO} ke ${vendor.nama}: ${totalQtyPesan} pcs (Total Rp ${totalTagihan.toLocaleString('id-ID')})`
    );

    return { success: true, po: newPO };
  };

  const updatePurchaseOrder = (id: string, updates: Partial<PurchaseOrder>): { success: boolean; po?: PurchaseOrder; error?: string } => {
    let updatedPO: PurchaseOrder | undefined;
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id === id) {
          updatedPO = { ...po, ...updates };
          return updatedPO;
        }
        return po;
      })
    );
    if (!updatedPO) return { success: false, error: 'Purchase Order tidak ditemukan' };
    logAudit('Pengadaan', 'Update Purchase Order', `Memperbarui data PO #${updatedPO.noPO}`);
    return { success: true, po: updatedPO };
  };

  const updatePOShipping = (
    id: string,
    shippingData: {
      ekspedisi: string;
      noResi: string;
      tanggalKirim: string;
      estimasiTiba?: string;
      catatanPengiriman?: string;
    }
  ): { success: boolean; error?: string } => {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return { success: false, error: 'PO tidak ditemukan' };

    setPurchaseOrders((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const nextStatus: PurchaseOrderStatus =
            p.statusPO === 'draft' || p.statusPO === 'dipesan' ? 'dikirim' : p.statusPO;
          return {
            ...p,
            ...shippingData,
            statusPO: nextStatus,
          };
        }
        return p;
      })
    );

    logAudit(
      'Pengadaan',
      'Pengiriman Barang Vendor',
      `PO #${po.noPO} sedang dikirim via ${shippingData.ekspedisi} (Resi: ${shippingData.noResi})`
    );
    return { success: true };
  };

  const receivePOGoods = (
    id: string,
    receiptData: {
      tanggalDiterima: string;
      penerimaGudang: string;
      kondisiPenerimaan: 'lengkap_sempurna' | 'ada_reject' | 'selisih_kurang' | 'kelebihan_qc';
      itemsReceived: { sku: string; qtyDiterima: number }[];
      catatanPenerimaan?: string;
      autoStockIn?: boolean;
    }
  ): { success: boolean; message?: string; error?: string } => {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return { success: false, error: 'Purchase Order tidak ditemukan.' };

    const todayStr = receiptData.tanggalDiterima || new Date().toISOString().split('T')[0];
    const lokasiGudang = po.gudangTujuan || 'Gudang Utama';

    // Map received quantities to PO items
    let totalAllReceived = 0;
    let totalAllOrdered = 0;
    const stockMovementsToAdd: StockMovement[] = [];

    const updatedItems: PurchaseOrderItem[] = po.items.map((it, idx) => {
      const match = receiptData.itemsReceived.find((r) => r.sku === it.sku);
      const newlyReceivedQty = match ? Math.max(0, match.qtyDiterima) : 0;
      const totalItemReceived = (it.qtyDiterima || 0) + newlyReceivedQty;

      totalAllReceived += totalItemReceived;
      totalAllOrdered += it.qtyPesan;

      // Create stock movement for newly received items
      if (newlyReceivedQty > 0 && receiptData.autoStockIn !== false) {
        stockMovementsToAdd.push({
          id: `sm-po-in-${po.id}-${idx}-${Date.now()}`,
          tanggal: todayStr,
          sku: it.sku,
          tipe: 'masuk',
          qty: newlyReceivedQty,
          lokasi: lokasiGudang,
          referensi: `Penerimaan ${po.noPO}`,
          catatan: `Vendor: ${po.vendorNama} (${receiptData.kondisiPenerimaan}). ${receiptData.catatanPenerimaan || ''}`,
          recordedBy: receiptData.penerimaGudang || currentUser.name,
        });
      }

      return {
        ...it,
        qtyDiterima: totalItemReceived,
      };
    });

    const isFullyReceived = totalAllReceived >= totalAllOrdered;
    const finalPOStatus: PurchaseOrderStatus = isFullyReceived ? 'diterima' : 'diterima_sebagian';

    setPurchaseOrders((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            items: updatedItems,
            totalQtyDiterima: totalAllReceived,
            statusPO: finalPOStatus,
            tanggalDiterima: todayStr,
            penerimaGudang: receiptData.penerimaGudang || currentUser.name,
            kondisiPenerimaan: receiptData.kondisiPenerimaan,
            catatanPenerimaan: receiptData.catatanPenerimaan,
          };
        }
        return p;
      })
    );

    if (stockMovementsToAdd.length > 0) {
      setStockMovements((prev) => [...stockMovementsToAdd, ...prev]);
    }

    const totalNewPcs = receiptData.itemsReceived.reduce((sum, r) => sum + (r.qtyDiterima || 0), 0);
    const logMsg = `Penerimaan barang ${po.noPO} (${totalNewPcs} pcs baru masuk ke ${lokasiGudang}). Status PO: ${
      isFullyReceived ? 'Diterima Lengkap' : 'Diterima Sebagian'
    }. Petugas: ${receiptData.penerimaGudang || currentUser.name}`;

    logAudit('Pengadaan', 'Penerimaan Barang Gudang', logMsg);

    return {
      success: true,
      message: `Berhasil menerima ${totalNewPcs} pcs kaos ke ${lokasiGudang}. Kartu stok gudang telah diperbarui secara otomatis.`,
    };
  };

  const payPurchaseOrder = (
    id: string,
    paymentData: {
      jumlahBayar: number;
      accountId: string;
      tanggal: string;
      catatan?: string;
    }
  ): { success: boolean; error?: string } => {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return { success: false, error: 'PO tidak ditemukan.' };

    const acc = cashAccounts.find((a) => a.id === paymentData.accountId);
    if (!acc) return { success: false, error: 'Akun kas/bank tidak valid.' };

    if (paymentData.jumlahBayar <= 0) {
      return { success: false, error: 'Nominal pembayaran harus lebih dari Rp 0.' };
    }

    const newTerbayar = po.jumlahTerbayar + paymentData.jumlahBayar;
    const newSisa = Math.max(0, po.totalTagihan - newTerbayar);
    const newStatusBayar: PurchasePaymentStatus = newSisa === 0 ? 'lunas' : 'dp';

    const todayStr = paymentData.tanggal || new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Update PO
    setPurchaseOrders((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            jumlahTerbayar: newTerbayar,
            sisaHutang: newSisa,
            statusBayar: newStatusBayar,
            accountId: acc.id,
            accountNama: acc.nama,
          };
        }
        return p;
      })
    );

    // Deduct cash account
    const newSaldo = acc.saldo - paymentData.jumlahBayar;
    setCashAccounts((prev) =>
      prev.map((a) => (a.id === acc.id ? { ...a, saldo: newSaldo } : a))
    );

    // Record cash mutation
    const newMutation: CashMutation = {
      id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      tanggal: todayStr,
      waktu: nowTime,
      accountId: acc.id,
      accountNama: acc.nama,
      tipe: 'keluar',
      jumlah: paymentData.jumlahBayar,
      kategori: 'Pembelian Bahan & Kaos / Vendor',
      deskripsi: `Pelunasan/Pembayaran PO #${po.noPO} ke ${po.vendorNama}${paymentData.catatan ? ` (${paymentData.catatan})` : ''}`,
      referensi: po.noPO,
      saldoSetelah: newSaldo,
      dicatatOleh: currentUser.name,
    };

    setCashMutations((prev) => [newMutation, ...prev]);

    // Otomatisasi Penjurnalan Akuntansi (Double-Entry Bookkeeping):
    // Mendebit akun 'Utang Dagang' (mengurangi kewajiban) & Mengkredit akun 'Kas/Bank' (mengurangi kas)
    const journalNo = `JU-${todayStr.replace(/-/g, '').substring(0, 6)}-${String(journalEntries.length + 1).padStart(4, '0')}`;
    const paymentJournal: JournalEntry = {
      id: `je-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      noJurnal: journalNo,
      tanggal: todayStr,
      waktu: nowTime,
      tipe: 'pembayaran_utang_vendor',
      referensi: po.noPO,
      keterangan: `Pelunasan Utang Dagang PO #${po.noPO} (${po.vendorNama}) via ${acc.nama}${paymentData.catatan ? ` - ${paymentData.catatan}` : ''}`,
      items: [
        {
          accountCode: '2-10100',
          accountName: `Utang Dagang (Vendor: ${po.vendorNama})`,
          category: 'Kewajiban',
          debit: paymentData.jumlahBayar,
          kredit: 0,
          memo: `Debit pelunasan utang usaha PO #${po.noPO}`,
        },
        {
          accountId: acc.id,
          accountCode: '1-10100',
          accountName: `Kas & Bank (${acc.nama})`,
          category: 'Aset',
          debit: 0,
          kredit: paymentData.jumlahBayar,
          memo: `Kredit mutasi kas keluar dari ${acc.nama}`,
        },
      ],
      totalDebit: paymentData.jumlahBayar,
      totalKredit: paymentData.jumlahBayar,
      isBalanced: true,
      dicatatOleh: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    setJournalEntries((prev) => [paymentJournal, ...prev]);

    logAudit(
      'Keuangan',
      'Pembayaran PO Vendor',
      `Membayar Rp ${paymentData.jumlahBayar.toLocaleString('id-ID')} untuk PO #${po.noPO} (${po.vendorNama}) via ${acc.nama}. Jurnal ${journalNo} otomatis terbit (Debit Utang Dagang, Kredit Kas/Bank).`
    );

    return { success: true };
  };

  const deletePurchaseOrder = (id: string): { success: boolean; error?: string } => {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return { success: false, error: 'PO tidak ditemukan' };

    setPurchaseOrders((prev) => prev.filter((p) => p.id !== id));
    logAudit('Pengadaan', 'Hapus Purchase Order', `Menghapus PO #${po.noPO}`);
    return { success: true };
  };

  // Penjurnalan Akuntansi (Double-Entry General Journal) Actions
  const recordJournalEntry = (
    entryData: Omit<JournalEntry, 'id' | 'createdAt' | 'noJurnal' | 'isBalanced'>
  ): JournalEntry => {
    const todayStr = entryData.tanggal || new Date().toISOString().split('T')[0];
    const journalNo = `JU-${todayStr.replace(/-/g, '').substring(0, 6)}-${String(journalEntries.length + 1).padStart(4, '0')}`;
    const totalDebit = entryData.items.reduce((sum, item) => sum + (item.debit || 0), 0);
    const totalKredit = entryData.items.reduce((sum, item) => sum + (item.kredit || 0), 0);
    const newEntry: JournalEntry = {
      ...entryData,
      id: `je-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      noJurnal: journalNo,
      totalDebit,
      totalKredit,
      isBalanced: Math.round(totalDebit) === Math.round(totalKredit),
      createdAt: new Date().toISOString(),
    };
    setJournalEntries((prev) => [newEntry, ...prev]);
    logAudit('Keuangan', 'Pencatatan Jurnal Akuntansi', `Jurnal ${newEntry.noJurnal} (${newEntry.keterangan}) dicatat`);
    return newEntry;
  };

  const deleteJournalEntry = (id: string) => {
    const entry = journalEntries.find((j) => j.id === id);
    setJournalEntries((prev) => prev.filter((j) => j.id !== id));
    logAudit('Keuangan', 'Hapus Jurnal Akuntansi', `Jurnal ${entry?.noJurnal || id} dihapus`);
  };

  // Operational Expenses
  const addBiayaOperasional = (data: Omit<BiayaOperasional, 'id' | 'dicatatOleh'>) => {
    // Tentukan akun kas/bank target: gunakan data.accountId jika ada, atau fallback ke default account jika tidak 'none'
    const targetAccountId = data.accountId && data.accountId !== 'none'
      ? data.accountId
      : (data.accountId === undefined ? (cashAccounts.find((a) => a.isDefault)?.id || cashAccounts[0]?.id) : undefined);

    let accountName = data.accountNama;
    if (targetAccountId && !accountName) {
      const acc = cashAccounts.find((a) => a.id === targetAccountId);
      accountName = acc?.nama;
    }

    const newEntry: BiayaOperasional = {
      ...data,
      id: `bo-${Date.now()}`,
      accountId: targetAccountId,
      accountNama: accountName,
      dicatatOleh: currentUser.name,
    };
    setBiayaOperasional((prev) => [newEntry, ...prev]);

    // Jika akun kas/bank dipilih, kurangi saldo dan catat mutasi keluar secara otomatis
    if (targetAccountId) {
      recordCashTransaction({
        accountId: targetAccountId,
        tipe: 'keluar',
        jumlah: data.jumlah,
        kategori: 'Biaya Operasional (OPEX)',
        deskripsi: `${data.kategori}: ${data.deskripsi}`,
        referensi: `OPEX #${newEntry.id}`,
        tanggal: data.tanggal,
      });
    }

    logAudit('Keuangan', 'Catat Biaya Operasional', `${data.kategori}: Rp ${data.jumlah.toLocaleString('id-ID')} (${data.deskripsi})`);
  };

  const updateBiayaOperasional = (id: string, updates: Partial<Omit<BiayaOperasional, 'id' | 'dicatatOleh'>>) => {
    const existing = biayaOperasional.find((b) => b.id === id);
    if (!existing) return;

    const oldAccId = existing.accountId;
    const oldAmount = existing.jumlah;
    const newAccId = updates.accountId !== undefined ? updates.accountId : oldAccId;
    const newAmount = updates.jumlah !== undefined ? updates.jumlah : oldAmount;
    const newCategory = updates.kategori !== undefined ? updates.kategori : existing.kategori;
    const newDesc = updates.deskripsi !== undefined ? updates.deskripsi : existing.deskripsi;
    const newAccountName = newAccId ? cashAccounts.find((a) => a.id === newAccId)?.nama : undefined;

    // Adjust cash account balances if amount or account changed
    if (oldAccId !== newAccId || oldAmount !== newAmount) {
      // 1. Restore old amount to old account
      if (oldAccId) {
        setCashAccounts((prev) =>
          prev.map((a) => (a.id === oldAccId ? { ...a, saldo: a.saldo + oldAmount } : a))
        );
      }
      // 2. Deduct new amount from new account
      if (newAccId) {
        setCashAccounts((prev) =>
          prev.map((a) =>
            a.id === newAccId
              ? { ...a, saldo: (oldAccId === newAccId ? a.saldo + oldAmount : a.saldo) - newAmount }
              : a
          )
        );
      }
    }

    setBiayaOperasional((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              ...updates,
              accountId: newAccId || undefined,
              accountNama: newAccountName,
            }
          : b
      )
    );

    logAudit(
      'Keuangan',
      'Edit Biaya Operasional',
      `Ubah biaya ${newCategory}: Rp ${newAmount.toLocaleString('id-ID')} (${newDesc})`
    );
  };

  const deleteBiayaOperasional = (id: string) => {
    const item = biayaOperasional.find((b) => b.id === id);
    if (item && item.accountId) {
      // Pulihkan saldo kas jika sebelumnya dipotong dari kas/bank
      const acc = cashAccounts.find((a) => a.id === item.accountId);
      if (acc) {
        const restoredSaldo = acc.saldo + item.jumlah;
        setCashAccounts((prev) =>
          prev.map((a) => (a.id === acc.id ? { ...a, saldo: restoredSaldo } : a))
        );
        const todayStr = new Date().toISOString().split('T')[0];
        const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const restoreMutation: CashMutation = {
          id: `mut-${Date.now()}-del-bo`,
          tanggal: todayStr,
          waktu: nowTime,
          accountId: acc.id,
          accountNama: acc.nama,
          tipe: 'masuk',
          jumlah: item.jumlah,
          kategori: 'Koreksi Pembatalan Biaya',
          deskripsi: `Koreksi pembatalan biaya OPEX: ${item.kategori} (${item.deskripsi})`,
          referensi: `Batal #${item.id}`,
          saldoSetelah: restoredSaldo,
          dicatatOleh: currentUser.name,
        };
        setCashMutations((prev) => [restoreMutation, ...prev]);
      }
    }
    setBiayaOperasional((prev) => prev.filter((b) => b.id !== id));
    logAudit('Keuangan', 'Hapus Biaya Operasional', `Biaya ${item?.kategori || id} senilai Rp ${item?.jumlah?.toLocaleString('id-ID') || 0} dihapus.`);
  };

  const clearBiayaOperasional = () => {
    setBiayaOperasional([]);
    logAudit('Keuangan', 'Hapus Data OPEX', 'Mengosongkan seluruh riwayat pengeluaran operasional');
  };

  // Kas & Bank Action Methods
  const addCashAccount = (accountData: Omit<CashAccount, 'id' | 'saldo'> & { saldoAwal: number }): CashAccount => {
    const newAccount: CashAccount = {
      ...accountData,
      id: `acc-${Date.now()}`,
      saldo: accountData.saldoAwal,
    };

    setCashAccounts((prev) => [...prev, newAccount]);

    if (accountData.saldoAwal > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const initMutation: CashMutation = {
        id: `mut-${Date.now()}-init`,
        tanggal: todayStr,
        waktu: nowTime,
        accountId: newAccount.id,
        accountNama: newAccount.nama,
        tipe: 'masuk',
        jumlah: accountData.saldoAwal,
        kategori: 'Saldo Awal',
        deskripsi: `Saldo awal akun ${newAccount.nama}`,
        saldoSetelah: accountData.saldoAwal,
        dicatatOleh: currentUser.name,
      };
      setCashMutations((prev) => [initMutation, ...prev]);
    }

    logAudit(
      'Keuangan',
      'Tambah Akun Kas/Bank',
      `Akun baru ${newAccount.nama} (${newAccount.tipe.toUpperCase()}) saldo awal Rp ${accountData.saldoAwal.toLocaleString('id-ID')}`
    );
    return newAccount;
  };

  const updateCashAccount = (id: string, updates: Partial<CashAccount>) => {
    setCashAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc))
    );
    logAudit('Keuangan', 'Update Akun Kas/Bank', `Data akun ${updates.nama || id} diperbarui`);
  };

  const deleteCashAccount = (id: string): { success: boolean; error?: string } => {
    const target = cashAccounts.find((a) => a.id === id);
    if (!target) return { success: false, error: 'Akun tidak ditemukan' };
    if (cashAccounts.length <= 1) {
      return { success: false, error: 'Minimal harus ada 1 akun kas atau bank aktif di sistem.' };
    }
    setCashAccounts((prev) => prev.filter((a) => a.id !== id));
    logAudit('Keuangan', 'Hapus Akun Kas/Bank', `Akun ${target.nama} telah dihapus dari sistem.`);
    return { success: true };
  };

  const recordCashTransaction = (data: {
    accountId: string;
    tipe: 'masuk' | 'keluar';
    jumlah: number;
    kategori: string;
    deskripsi: string;
    referensi?: string;
    tanggal?: string;
  }) => {
    const targetAccount = cashAccounts.find((a) => a.id === data.accountId);
    if (!targetAccount) return;

    const todayStr = data.tanggal || new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const diff = data.tipe === 'masuk' ? data.jumlah : -data.jumlah;
    const newSaldo = targetAccount.saldo + diff;

    setCashAccounts((prev) =>
      prev.map((acc) => (acc.id === data.accountId ? { ...acc, saldo: newSaldo } : acc))
    );

    const newMutation: CashMutation = {
      id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      tanggal: todayStr,
      waktu: nowTime,
      accountId: targetAccount.id,
      accountNama: targetAccount.nama,
      tipe: data.tipe,
      jumlah: data.jumlah,
      kategori: data.kategori,
      deskripsi: data.deskripsi,
      referensi: data.referensi,
      saldoSetelah: newSaldo,
      dicatatOleh: currentUser.name,
    };

    setCashMutations((prev) => [newMutation, ...prev]);
    logAudit(
      'Keuangan',
      data.tipe === 'masuk' ? 'Kas Masuk' : 'Kas Keluar',
      `[${targetAccount.nama}] ${data.kategori}: Rp ${data.jumlah.toLocaleString('id-ID')} (${data.deskripsi})`
    );
  };

  const transferCashAccount = (data: {
    fromAccountId: string;
    toAccountId: string;
    jumlah: number;
    deskripsi?: string;
    tanggal?: string;
  }): { success: boolean; error?: string } => {
    if (data.fromAccountId === data.toAccountId) {
      return { success: false, error: 'Akun sumber dan akun tujuan tidak boleh sama.' };
    }
    const fromAcc = cashAccounts.find((a) => a.id === data.fromAccountId);
    const toAcc = cashAccounts.find((a) => a.id === data.toAccountId);
    if (!fromAcc || !toAcc) {
      return { success: false, error: 'Akun kas/bank tidak ditemukan.' };
    }
    if (data.jumlah <= 0) {
      return { success: false, error: 'Nominal transfer harus lebih besar dari 0.' };
    }

    const todayStr = data.tanggal || new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const newFromSaldo = fromAcc.saldo - data.jumlah;
    const newToSaldo = toAcc.saldo + data.jumlah;

    setCashAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === fromAcc.id) return { ...acc, saldo: newFromSaldo };
        if (acc.id === toAcc.id) return { ...acc, saldo: newToSaldo };
        return acc;
      })
    );

    const desc = data.deskripsi || `Pindah saldo dari ${fromAcc.nama} ke ${toAcc.nama}`;

    const outMutation: CashMutation = {
      id: `mut-${Date.now()}-out`,
      tanggal: todayStr,
      waktu: nowTime,
      accountId: fromAcc.id,
      accountNama: fromAcc.nama,
      tipe: 'transfer',
      jumlah: data.jumlah,
      kategori: 'Pindah Saldo Keluar',
      deskripsi: desc,
      targetAccountId: toAcc.id,
      targetAccountNama: toAcc.nama,
      saldoSetelah: newFromSaldo,
      dicatatOleh: currentUser.name,
    };

    const inMutation: CashMutation = {
      id: `mut-${Date.now()}-in`,
      tanggal: todayStr,
      waktu: nowTime,
      accountId: toAcc.id,
      accountNama: toAcc.nama,
      tipe: 'masuk',
      jumlah: data.jumlah,
      kategori: 'Pindah Saldo Masuk',
      deskripsi: `Terima pindah saldo dari ${fromAcc.nama} (${desc})`,
      referensi: fromAcc.nama,
      saldoSetelah: newToSaldo,
      dicatatOleh: currentUser.name,
    };

    setCashMutations((prev) => [outMutation, inMutation, ...prev]);
    logAudit(
      'Keuangan',
      'Pindah Saldo Kas & Bank',
      `Transfer Rp ${data.jumlah.toLocaleString('id-ID')} dari [${fromAcc.nama}] ke [${toAcc.nama}]`
    );

    return { success: true };
  };

  // Rekonsiliasi Bank Actions
  const toggleMutationReconciliation = (mutationId: string, isReconciled: boolean, sessionId?: string) => {
    setCashMutations((prev) =>
      prev.map((m) => {
        if (m.id === mutationId) {
          return {
            ...m,
            isReconciled,
            reconciledSessionId: isReconciled ? (sessionId || m.reconciledSessionId) : undefined,
            reconciledAt: isReconciled ? new Date().toISOString() : undefined,
          };
        }
        return m;
      })
    );
  };

  const saveBankReconciliationSession = (data: {
    accountId: string;
    periodeAwal: string;
    periodeAkhir: string;
    tanggalRekonsiliasi?: string;
    saldoAwalBuku: number;
    saldoAkhirBuku: number;
    saldoRekeningKoranBank: number;
    matchedMutationIds: string[];
    catatan?: string;
  }): { success: boolean; session?: BankReconciliationSession; error?: string } => {
    const targetAcc = cashAccounts.find((a) => a.id === data.accountId);
    if (!targetAcc) {
      return { success: false, error: 'Akun kas/bank tidak ditemukan.' };
    }

    const todayStr = data.tanggalRekonsiliasi || new Date().toISOString().split('T')[0];
    const sessionCount = bankReconciliations.length + 1;
    const accCode = targetAcc.tipe === 'bank' ? (targetAcc.nama.toUpperCase().includes('BCA') ? 'BCA' : targetAcc.nama.toUpperCase().includes('MANDIRI') ? 'MANDIRI' : 'BANK') : 'KAS';
    const noRek = `REK-${accCode}-${todayStr.replace(/-/g, '').substring(2)}-${String(sessionCount).padStart(3, '0')}`;

    const selisih = data.saldoAkhirBuku - data.saldoRekeningKoranBank;
    const status = Math.abs(selisih) < 1 ? 'seimbang' : 'ada_selisih';

    // Calculate totals of matched mutations
    const matchedMutations = cashMutations.filter((m) => data.matchedMutationIds.includes(m.id));
    const totalMasuk = matchedMutations.filter((m) => m.tipe === 'masuk').reduce((sum, m) => sum + m.jumlah, 0);
    const totalKeluar = matchedMutations.filter((m) => m.tipe === 'keluar' || m.tipe === 'transfer').reduce((sum, m) => sum + m.jumlah, 0);

    const newSession: BankReconciliationSession = {
      id: `rek-${Date.now()}`,
      noRekonsiliasi: noRek,
      accountId: targetAcc.id,
      accountNama: targetAcc.nama,
      periodeAwal: data.periodeAwal,
      periodeAkhir: data.periodeAkhir,
      tanggalRekonsiliasi: todayStr,
      saldoAwalBuku: data.saldoAwalBuku,
      saldoAkhirBuku: data.saldoAkhirBuku,
      saldoRekeningKoranBank: data.saldoRekeningKoranBank,
      selisih,
      status,
      totalMasukTerekonsiliasi: totalMasuk,
      totalKeluarTerekonsiliasi: totalKeluar,
      totalItemTerekonsiliasi: data.matchedMutationIds.length,
      matchedMutationIds: data.matchedMutationIds,
      catatan: data.catatan,
      dicatatOleh: `${currentUser.name} (${currentUser.role === 'owner' ? 'Owner' : 'Staff'})`,
      createdAt: new Date().toISOString(),
    };

    // Update cashMutations to flag matched mutations
    const nowIso = new Date().toISOString();
    setCashMutations((prev) =>
      prev.map((m) => {
        if (data.matchedMutationIds.includes(m.id)) {
          return {
            ...m,
            isReconciled: true,
            reconciledSessionId: newSession.id,
            reconciledAt: nowIso,
          };
        }
        return m;
      })
    );

    setBankReconciliations((prev) => [newSession, ...prev]);

    logAudit(
      'Keuangan',
      'Rekonsiliasi Bank',
      `Sesi rekonsiliasi ${noRek} [${targetAcc.nama}]: Saldo Buku Rp ${data.saldoAkhirBuku.toLocaleString('id-ID')} vs Saldo Bank Rp ${data.saldoRekeningKoranBank.toLocaleString('id-ID')} (Status: ${status === 'seimbang' ? 'SEIMBANG/KLIR' : `Selisih Rp ${selisih.toLocaleString('id-ID')}`})`
    );

    return { success: true, session: newSession };
  };

  const deleteBankReconciliationSession = (id: string) => {
    const session = bankReconciliations.find((s) => s.id === id);
    if (!session) return;

    // Unflag mutations linked to this session
    setCashMutations((prev) =>
      prev.map((m) => {
        if (m.reconciledSessionId === id) {
          return {
            ...m,
            isReconciled: false,
            reconciledSessionId: undefined,
            reconciledAt: undefined,
          };
        }
        return m;
      })
    );

    setBankReconciliations((prev) => prev.filter((s) => s.id !== id));
    logAudit('Keuangan', 'Hapus Rekonsiliasi Bank', `Sesi ${session.noRekonsiliasi} [${session.accountNama}] dihapus.`);
  };

  // Master SKU & BOM
  const updateBOM = (newBom: BOMItem[]) => {
    setBomItems(newBom);
    const totalAksesoris = newBom.reduce((a, b) => a + b.biayaPerUnit, 0);
    // Recalculate HPP for all SKUs
    setSkus((prev) =>
      prev.map((sku) => {
        const ser = series.find((s) => s.id === sku.seriesId || s.code === sku.seriesCode);
        const base = ser?.baseCost ?? 45000;
        return {
          ...sku,
          hpp: base + totalAksesoris,
        };
      })
    );
    logAudit('Master Data', 'Update BOM Aksesoris', `Komponen BOM diubah. Total aksesoris: Rp ${totalAksesoris.toLocaleString('id-ID')}`);
  };

  const updateSeries = (seriesId: string, updates: Partial<ProductSeries>) => {
    setSeries((prev) =>
      prev.map((s) => (s.id === seriesId || s.code === seriesId ? { ...s, ...updates } : s))
    );
    if (updates.baseCost !== undefined || updates.defaultPrice !== undefined) {
      const totalAksesoris = bomItems.reduce((a, b) => a + b.biayaPerUnit, 0);
      setSkus((prev) =>
        prev.map((sku) => {
          if (sku.seriesId === seriesId || sku.seriesCode === seriesId) {
            const nextHpp = updates.baseCost !== undefined ? updates.baseCost + totalAksesoris : sku.hpp;
            const nextPrice = updates.defaultPrice !== undefined ? updates.defaultPrice : sku.price;
            return {
              ...sku,
              hpp: nextHpp,
              price: nextPrice,
            };
          }
          return sku;
        })
      );
    }
    logAudit('Master Data', 'Update Lini Produk', `Parameter lini ${updates.name || seriesId} diperbarui`);
  };

  const updateSKU = (skuCode: string, updates: Partial<SKUItem>) => {
    const newSkuCode = updates.sku ? updates.sku.trim() : skuCode;
    setSkus((prev) =>
      prev.map((s) => (s.sku === skuCode ? { ...s, ...updates, sku: newSkuCode } : s))
    );

    if (newSkuCode !== skuCode) {
      // Cascade update to stock movements, orders, and consignment slips
      setStockMovements((prev) =>
        prev.map((m) => (m.sku === skuCode ? { ...m, sku: newSkuCode } : m))
      );
      setOrders((prev) =>
        prev.map((ord) => ({
          ...ord,
          items: ord.items.map((it) =>
            it.sku === skuCode
              ? { ...it, sku: newSkuCode, namaProduk: updates.name || it.namaProduk }
              : it
          ),
        }))
      );
      setSuratTitip((prev) =>
        prev.map((st) => ({
          ...st,
          items: st.items.map((it) =>
            it.sku === skuCode
              ? { ...it, sku: newSkuCode, namaProduk: updates.name || it.namaProduk }
              : it
          ),
        }))
      );
    }
    logAudit('Master Data', 'Update Master SKU', `Perubahan SKU ${skuCode} -> ${newSkuCode}`);
  };

  const syncAllSkuNames = () => {
    setSkus((prev) =>
      prev.map((s) => {
        // If SKU matches standard format KL-SERIES-COLOR-SIZE (e.g. KL-210OV-HT-M)
        const parts = s.sku.split('-');
        if (parts.length >= 4 && parts[0] === 'KL') {
          const serCode = parts[1];
          const colCode = parts[2];
          const sz = parts[3];
          const serObj = series.find((sr) => sr.code === serCode);
          const colorList = INITIAL_COLORS[serCode] || [];
          const colObj = colorList.find((c) => c.code === colCode);
          const seriesName = serObj ? serObj.name : serCode;
          const colorName = colObj ? colObj.name : (s.colorName || colCode);
          return {
            ...s,
            seriesCode: serCode,
            colorCode: colCode,
            colorName: colorName,
            size: (sz as any) || s.size,
            name: `Kalima ${seriesName} - ${colorName} (${sz})`,
          };
        }
        return s;
      })
    );
    logAudit('Master Data', 'Sinkronisasi SKU', 'Nama produk dan lini SKU disinkronkan otomatis sesuai kode SKU');
  };

  const addSKU = (item: SKUItem) => {
    const next = [...skusRef.current.filter((s) => s.sku !== item.sku), item];
    skusRef.current = next;
    setSkus(next);
    logAudit('Master Data', 'Tambah SKU Baru', `SKU ${item.sku} (${item.name}) ditambahkan`);
  };

  const deleteSKU = (skuCode: string) => {
    const target = skusRef.current.find((s) => s.sku === skuCode);
    const next = skusRef.current.filter((s) => s.sku !== skuCode);
    skusRef.current = next;
    setSkus(next);
    logAudit('Master Data', 'Hapus SKU', `SKU ${skuCode} (${target?.name || ''}) dihapus dari master`);
  };

  const addCustomer = useCallback((cust: Omit<Customer, 'id'>): Customer => {
    const newCust: Customer = {
      ...cust,
      id: `cust-${Date.now()}`,
    };
    const next = [newCust, ...customersRef.current];
    customersRef.current = next;
    setCustomers(next);
    logAudit('Master Data', 'Tambah Customer', `Customer baru: ${cust.nama} (${cust.tipe || 'Retail'}, ${cust.kota || '-'})`);
    return newCust;
  }, []);

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    const next = customersRef.current.map((c) => (c.id === id ? { ...c, ...updates } : c));
    customersRef.current = next;
    setCustomers(next);
    // If name or hp changed, cascade update to orders if necessary
    if (updates.nama || updates.noHp || updates.kota) {
      setOrders((prev) =>
        prev.map((o) =>
          o.customerId === id
            ? {
                ...o,
                customerNama: updates.nama || o.customerNama,
                customerHp: updates.noHp || o.customerHp,
                customerKota: updates.kota || o.customerKota,
              }
            : o
        )
      );
    }
    logAudit('Master Data', 'Update Customer', `Data customer ID ${id} diperbarui: ${updates.nama || ''} [Tipe: ${updates.tipe || ''}]`);
  };

  const deleteCustomer = (id: string) => {
    const cust = customersRef.current.find((c) => c.id === id);
    if (cust?.resellerIdRef) {
      resellersRef.current = resellersRef.current.filter((r) => r.id !== cust.resellerIdRef);
      setResellers(resellersRef.current);
    }
    const next = customersRef.current.filter((c) => c.id !== id);
    customersRef.current = next;
    setCustomers(next);
    logAudit('Master Data', 'Hapus Customer', `Customer ${cust?.nama || id} (${cust?.noHp || '-'}) dihapus dari master`);
  };

  const bulkDeleteCustomers = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const setIds = new Set(ids);
    setCustomers((prev) => prev.filter((c) => !setIds.has(c.id)));
    logAudit('Master Data', 'Hapus Massal Customer', `${ids.length} data customer berhasil dihapus dari database.`);
  };

  const promoteCustomerToReseller = (
    customerId: string,
    resellerData?: {
      level?: 'Platinum' | 'Gold' | 'Silver';
      diskonPersen?: number;
      batasPlafonTitipan?: number;
      jadwalSetoran?: string;
      alamat?: string;
    }
  ): { success: boolean; reseller?: Reseller } => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return { success: false };

    // Check if already in resellers
    const existingReseller = resellers.find(
      (r) => r.id === cust.resellerIdRef || r.nama.toLowerCase() === cust.nama.toLowerCase() || r.noHp === cust.noHp
    );

    let newReseller: Reseller;

    if (existingReseller) {
      // Update existing reseller
      newReseller = {
        ...existingReseller,
        level: resellerData?.level || existingReseller.level || 'Silver',
        diskonPersen: resellerData?.diskonPersen ?? existingReseller.diskonPersen ?? 20,
        batasPlafonTitipan: resellerData?.batasPlafonTitipan ?? existingReseller.batasPlafonTitipan ?? 10000000,
        jadwalSetoran: resellerData?.jadwalSetoran || existingReseller.jadwalSetoran || 'Setiap Hari Senin',
        alamat: resellerData?.alamat || cust.alamat || existingReseller.alamat || cust.kota,
      };
      setResellers((prev) =>
        prev.map((r) => (r.id === existingReseller.id ? newReseller : r))
      );
    } else {
      // Create new reseller entry
      newReseller = {
        id: `res-${Date.now()}`,
        nama: cust.nama,
        kontakPerson: cust.nama,
        noHp: cust.noHp,
        kota: cust.kota,
        level: resellerData?.level || 'Silver',
        diskonPersen: resellerData?.diskonPersen ?? 20,
        batasPlafonTitipan: resellerData?.batasPlafonTitipan ?? 10000000,
        jadwalSetoran: resellerData?.jadwalSetoran || 'Setiap Hari Senin',
        alamat: resellerData?.alamat || cust.alamat || cust.kota || '-',
      };
      setResellers((prev) => [newReseller, ...prev]);
    }

    // Update customer status to Reseller
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId
          ? {
              ...c,
              tipe: 'Reseller',
              resellerIdRef: newReseller.id,
              diskonKhusus: resellerData?.diskonPersen ?? 20,
              alamat: resellerData?.alamat || c.alamat,
            }
          : c
      )
    );

    logAudit('Reseller', 'Upgrade Customer ke Mitra', `Customer ${cust.nama} (${cust.noHp}) resmi ditetapkan sebagai Mitra/Reseller [Level: ${newReseller.level}, Diskon: ${newReseller.diskonPersen}%]`);

    return { success: true, reseller: newReseller };
  };

  const relinkAndRepairOrders = () => {
    // Re-link all orders to their proper distinct customers and fix any merged/corrupted customer IDs
    const phoneMap = new Map<string, Customer>();
    const nameMap = new Map<string, Customer>();
    const idMap = new Map<string, Customer>();
    const updatedCustomersList: Customer[] = [];

    // 1. Index existing customers
    customers.forEach((c) => {
      const normPhone = normalizePhone(c.noHp);
      if (normPhone && normPhone.length >= 8 && !phoneMap.has(normPhone)) {
        phoneMap.set(normPhone, c);
      }
      const normName = c.nama.trim().toLowerCase();
      if (normName && !nameMap.has(normName)) {
        nameMap.set(normName, c);
      }
      idMap.set(c.id, c);
      updatedCustomersList.push(c);
    });

    // 2. Scan every order to ensure each order points to the correct customer record
    let repairedOrdersCount = 0;
    const newCustomersCreated: Customer[] = [];

    const updatedOrders = orders.map((ord, idx) => {
      const ordName = (ord.customerNama || '').trim();
      const ordHp = (ord.customerHp || '').trim();
      const normOrdPhone = normalizePhone(ordHp);

      // Find matching customer
      let matchedCust: Customer | undefined;

      if (normOrdPhone && normOrdPhone.length >= 8 && phoneMap.has(normOrdPhone)) {
        matchedCust = phoneMap.get(normOrdPhone);
      } else if (ordName && nameMap.has(ordName.toLowerCase())) {
        matchedCust = nameMap.get(ordName.toLowerCase());
      } else if (ord.customerId && idMap.has(ord.customerId)) {
        const candidate = idMap.get(ord.customerId);
        // Verify candidate actually matches either name or phone
        if (
          candidate &&
          (candidate.nama.trim().toLowerCase() === ordName.toLowerCase() ||
            (normOrdPhone && normalizePhone(candidate.noHp) === normOrdPhone))
        ) {
          matchedCust = candidate;
        }
      }

      if (matchedCust) {
        if (ord.customerId !== matchedCust.id) {
          repairedOrdersCount++;
          return {
            ...ord,
            customerId: matchedCust.id,
          };
        }
        return ord;
      } else if (ordName || normOrdPhone) {
        // Create dedicated customer record for this order
        const newCustId = `cust-fix-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        const newCust: Customer = {
          id: newCustId,
          nama: ordName || `Customer ${ordHp}`,
          noHp: ordHp,
          kota: (ord.customerKota || 'Jakarta').trim(),
          tipe: ord.channel === 'Reseller' ? 'Reseller' : 'Retail',
        };
        newCustomersCreated.push(newCust);
        idMap.set(newCustId, newCust);
        if (normOrdPhone && normOrdPhone.length >= 8) {
          phoneMap.set(normOrdPhone, newCust);
        }
        if (ordName) {
          nameMap.set(ordName.toLowerCase(), newCust);
        }
        repairedOrdersCount++;
        return {
          ...ord,
          customerId: newCustId,
        };
      }
      return ord;
    });

    if (newCustomersCreated.length > 0) {
      setCustomers([...updatedCustomersList, ...newCustomersCreated]);
    }
    setOrders(updatedOrders);

    logAudit(
      'Master Data',
      'Perbaikan Relasi Order-Customer',
      `Sistem memvalidasi ulang seluruh riwayat penjualan: ${repairedOrdersCount} transaksi diperbaiki kaitannya, ${newCustomersCreated.length} profil customer baru dipisahkan secara akurat.`
    );

    return { repairedCount: repairedOrdersCount, newCustomersCount: newCustomersCreated.length };
  };

  const mergeDuplicateCustomers = (): { mergedCount: number } => {
    let mergedCount = 0;
    const phoneToMaster = new Map<string, Customer>();
    const oldIdToMasterId = new Map<string, string>();
    const consolidatedList: Customer[] = [];

    customers.forEach((cust) => {
      const normPhone = normalizePhone(cust.noHp);
      if (normPhone && normPhone.length >= 8) {
        if (phoneToMaster.has(normPhone)) {
          const master = phoneToMaster.get(normPhone)!;
          oldIdToMasterId.set(cust.id, master.id);
          mergedCount++;
          // Merge missing attributes into master
          if (!master.noHp && cust.noHp) master.noHp = cust.noHp;
          if ((!master.kota || master.kota === 'Jakarta') && cust.kota) master.kota = cust.kota;
          if (!master.alamat && cust.alamat) master.alamat = cust.alamat;
          if (!master.catatan && cust.catatan) master.catatan = cust.catatan;
          if (cust.kategoriManual && !master.kategoriManual) {
            master.kategoriManual = cust.kategoriManual;
            master.tipe = cust.tipe;
          }
          if (cust.resellerIdRef && !master.resellerIdRef) {
            master.resellerIdRef = cust.resellerIdRef;
          }
        } else {
          phoneToMaster.set(normPhone, cust);
          consolidatedList.push(cust);
        }
      } else {
        consolidatedList.push(cust);
      }
    });

    if (mergedCount > 0) {
      setCustomers(consolidatedList);
      // Re-link only orders that had the specific duplicate customer ID
      setOrders((prevOrders) =>
        prevOrders.map((ord) => {
          if (ord.customerId && oldIdToMasterId.has(ord.customerId)) {
            const masterId = oldIdToMasterId.get(ord.customerId)!;
            const master = consolidatedList.find((c) => c.id === masterId);
            return {
              ...ord,
              customerId: masterId,
              customerNama: master?.nama || ord.customerNama,
            };
          }
          return ord;
        })
      );
      logAudit(
        'Master Data',
        'Penggabungan Duplikat Customer',
        `Berhasil menggabungkan ${mergedCount} customer dengan nomor HP yang sama.`
      );
    }

    return { mergedCount };
  };

  const syncCustomersFromOrders = (): { count: number; mergedCount: number } => {
    let newCount = 0;
    let mergedCount = 0;

    const phoneMap = new Map<string, Customer>();
    const nameMap = new Map<string, Customer>();
    const idMap = new Map<string, Customer>();
    const oldIdToMasterId = new Map<string, string>();
    const resultCustomers: Customer[] = [];

    // Step 1: Deduplicate existing customers in state by normalized phone number (>= 8 digits)
    customers.forEach((c) => {
      const normPhone = normalizePhone(c.noHp);
      if (normPhone && normPhone.length >= 8) {
        if (phoneMap.has(normPhone)) {
          const master = phoneMap.get(normPhone)!;
          oldIdToMasterId.set(c.id, master.id);
          mergedCount++;
          // Merge customer attributes into master
          if ((!master.kota || master.kota === 'Jakarta') && c.kota) master.kota = c.kota;
          if (!master.alamat && c.alamat) master.alamat = c.alamat;
          if (!master.catatan && c.catatan) master.catatan = c.catatan;
          if (c.kategoriManual && !master.kategoriManual) {
            master.kategoriManual = c.kategoriManual;
            master.tipe = c.tipe;
          }
          if (c.resellerIdRef && !master.resellerIdRef) {
            master.resellerIdRef = c.resellerIdRef;
          }
        } else {
          phoneMap.set(normPhone, c);
          idMap.set(c.id, c);
          nameMap.set(c.nama.trim().toLowerCase(), c);
          resultCustomers.push(c);
        }
      } else {
        idMap.set(c.id, c);
        nameMap.set(c.nama.trim().toLowerCase(), c);
        resultCustomers.push(c);
      }
    });

    // Step 2: Scan all orders to extract new customers or link individually
    const orderCustomerUpdates = new Map<string, string>(); // order.id -> targetCustomerId

    orders.forEach((ord, idx) => {
      const ordName = (ord.customerNama || '').trim();
      const ordPhone = (ord.customerHp || '').trim();
      const normOrdPhone = normalizePhone(ordPhone);

      if (!ordName && !normOrdPhone) return;

      let matched: Customer | undefined;

      if (normOrdPhone && normOrdPhone.length >= 8 && phoneMap.has(normOrdPhone)) {
        matched = phoneMap.get(normOrdPhone);
      } else if (ordName && nameMap.has(ordName.toLowerCase())) {
        matched = nameMap.get(ordName.toLowerCase());
      } else if (ord.customerId && idMap.has(ord.customerId)) {
        const cand = idMap.get(ord.customerId);
        if (
          cand &&
          (cand.nama.trim().toLowerCase() === ordName.toLowerCase() ||
            (normOrdPhone && normalizePhone(cand.noHp) === normOrdPhone))
        ) {
          matched = cand;
        }
      }

      if (!matched) {
        const newCustId = `cust-sync-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        const newCust: Customer = {
          id: newCustId,
          nama: ordName || `Customer ${ordPhone}`,
          noHp: ordPhone,
          kota: (ord.customerKota || 'Jakarta').trim(),
          tipe: ord.channel === 'Reseller' ? 'Reseller' : 'Retail',
        };
        resultCustomers.push(newCust);
        idMap.set(newCustId, newCust);
        if (normOrdPhone && normOrdPhone.length >= 8) {
          phoneMap.set(normOrdPhone, newCust);
        }
        if (ordName) {
          nameMap.set(ordName.toLowerCase(), newCust);
        }
        orderCustomerUpdates.set(ord.id, newCustId);
        newCount++;
      } else {
        orderCustomerUpdates.set(ord.id, matched.id);
        // Fill missing info in matched customer without overwriting existing data
        if (!matched.noHp && ordPhone) {
          matched.noHp = ordPhone;
          if (normOrdPhone && normOrdPhone.length >= 8) {
            phoneMap.set(normOrdPhone, matched);
          }
        }
        if ((!matched.kota || matched.kota === 'Jakarta') && ord.customerKota) {
          matched.kota = ord.customerKota.trim();
        }
      }
    });

    setCustomers(resultCustomers);

    // Step 3: Update orders with their exact target customer IDs
    setOrders((prevOrders) =>
      prevOrders.map((ord) => {
        let targetId = orderCustomerUpdates.get(ord.id);
        if (!targetId && ord.customerId && oldIdToMasterId.has(ord.customerId)) {
          targetId = oldIdToMasterId.get(ord.customerId);
        }
        if (targetId && targetId !== ord.customerId) {
          return {
            ...ord,
            customerId: targetId,
          };
        }
        return ord;
      })
    );

    if (newCount > 0 || mergedCount > 0) {
      logAudit(
        'Master Data',
        'Sinkronisasi Customer & Deduplikasi HP',
        `Sinkronisasi selesai: ${newCount} customer baru diekstrak, ${mergedCount} duplikat nomor HP berhasil disinkronkan menjadi customer yang sama.`
      );
    }

    return { count: newCount, mergedCount };
  };

  // Run auto-sync once on mount to capture any legacy/existing orders into customers database & repair HPP discrepancies
  useEffect(() => {
    if (orders.length > 0) {
      syncCustomersFromOrders();

      // Sanitize any corrupted historical orders HPP
      let hasHppFix = false;
      const totalAksesoris = bomItems.reduce((a, b) => a + b.biayaPerUnit, 0);

      const fixedOrders = orders.map((ord) => {
        let orderTotalHpp = 0;
        let modified = false;

        const updatedItems = ord.items.map((it) => {
          const skuObj = skus.find((s) => s.sku === it.sku);
          const sCode = skuObj?.seriesCode || (it.sku.includes('290') ? '290OV' : it.sku.includes('185') ? '185RG' : it.sku.includes('BAG') ? 'BAG' : '210OV');
          const serObj = series.find((s) => s.code === sCode);
          const isApparel = sCode === '210OV' || sCode === '290OV' || sCode === '185RG';

          let standardHpp = skuObj?.hpp;
          if (!standardHpp || standardHpp < 20000) {
            standardHpp = serObj ? serObj.baseCost + totalAksesoris : (sCode === '290OV' ? 74500 : sCode === '185RG' ? 45500 : 57500);
          }

          let itemHpp = it.hppSatuan;
          if (!itemHpp || (isApparel && itemHpp < 20000)) {
            itemHpp = standardHpp;
            modified = true;
            hasHppFix = true;
          }

          orderTotalHpp += itemHpp * it.qty;

          return {
            ...it,
            hppSatuan: itemHpp,
          };
        });

        if (modified || ord.totalHpp !== orderTotalHpp) {
          const channelObj = channels.find((c) => c.name === ord.channel);
          const adminFeePct = channelObj?.adminFeePercent ?? 0;
          const netSales = Math.max(0, ord.subtotal - (ord.diskon || 0));
          const adminFeeAmount = Math.round((netSales * adminFeePct) / 100);
          const labaKotor = netSales - orderTotalHpp - adminFeeAmount;

          return {
            ...ord,
            items: updatedItems,
            adminFeeAmount,
            totalHpp: orderTotalHpp,
            labaKotor,
          };
        }
        return ord;
      });

      if (hasHppFix) {
        setOrders(fixedOrders);
      }
    }
  }, []);

  const addReseller = (reseller: Omit<Reseller, 'id'>): Reseller => {
    const newRes: Reseller = {
      ...reseller,
      id: `res-${Date.now()}`,
    };
    setResellers((prev) => [newRes, ...prev]);
    logAudit('Reseller', 'Tambah Mitra Reseller', `Mitra reseller baru: ${reseller.nama} (${reseller.kota}) [Level: ${reseller.level || 'Silver'}]`);
    return newRes;
  };

  const updateReseller = (id: string, updates: Partial<Reseller>) => {
    setResellers((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
    logAudit('Reseller', 'Update Mitra Reseller', `Update data mitra: ${id}`);
  };

  const deleteReseller = (
    id: string,
    options?: { returnStockToWarehouse?: boolean; force?: boolean }
  ): { success: boolean; error?: string; returnedQty?: number } => {
    const res = resellers.find((r) => r.id === id);
    if (!res) return { success: false, error: 'Mitra tidak ditemukan' };
    
    // Check if there is active stock at this reseller
    const loc = `Reseller: ${res.nama}`;
    const resellerMovements = stockMovements.filter((m) => m.lokasi === loc);
    const activeStock = resellerMovements.reduce((sum, m) => sum + m.qty, 0);

    let returnedQty = 0;
    if (activeStock > 0) {
      if (options?.returnStockToWarehouse || options?.force) {
        // Automatically return physical stock to Gudang Utama
        const today = new Date().toISOString().split('T')[0];
        
        // Group remaining stock by SKU
        const skuQuantities: Record<string, number> = {};
        resellerMovements.forEach((m) => {
          skuQuantities[m.sku] = (skuQuantities[m.sku] || 0) + m.qty;
        });

        const newMovements: StockMovement[] = [];
        Object.entries(skuQuantities).forEach(([sku, qty]) => {
          if (qty > 0) {
            returnedQty += qty;
            // Deduct from Reseller location
            newMovements.push({
              id: `sm-retur-del-${Date.now()}-${sku}-out`,
              tanggal: today,
              sku,
              tipe: 'retur_titip',
              qty: -qty,
              lokasi: loc,
              referensi: `Retur Hapus Mitra: ${res.nama}`,
              catatan: `Barang ditarik otomatis ke Gudang Utama karena mitra dihapus`,
              recordedBy: currentUser.name,
            });
            // Return to Gudang Utama
            newMovements.push({
              id: `sm-retur-del-${Date.now()}-${sku}-in`,
              tanggal: today,
              sku,
              tipe: 'retur_titip',
              qty: qty,
              lokasi: 'Gudang Utama',
              referensi: `Retur Hapus Mitra: ${res.nama}`,
              catatan: `Barang kembali ke Gudang Utama dari mitra ${res.nama}`,
              recordedBy: currentUser.name,
            });
          }
        });

        if (newMovements.length > 0) {
          setStockMovements((prev) => [...prev, ...newMovements]);
        }
      } else {
        return {
          success: false,
          error: `Tidak dapat menghapus mitra. Masih ada stok titip fisik sebanyak ${activeStock} pcs di rak toko mitra. Centang opsi untuk menarik stok ke Gudang Utama secara otomatis atau lakukan retur terlebih dahulu.`,
        };
      }
    }

    // Revert associated customer if any
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.resellerIdRef === id || (c.nama.toLowerCase() === res.nama.toLowerCase() && c.tipe === 'Reseller')) {
          return {
            ...c,
            tipe: 'Retail',
            kategoriManual: undefined,
            resellerIdRef: undefined,
          };
        }
        return c;
      })
    );

    setResellers((prev) => prev.filter((r) => r.id !== id));
    logAudit(
      'Reseller',
      'Hapus Mitra Reseller',
      `Menghapus mitra: ${res.nama}${returnedQty > 0 ? ` (${returnedQty} pcs stok fisik otomatis dikembalikan ke Gudang Utama)` : ''}`
    );
    return { success: true, returnedQty };
  };

  const resetData = () => {
    localStorage.clear();
    setSeries(INITIAL_SERIES);
    setSkus(INITIAL_SKUS);
    setBomItems(INITIAL_BOM);
    setCustomers(INITIAL_CUSTOMERS);
    setResellers(INITIAL_RESELLERS);
    setOrders(INITIAL_ORDERS);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
    setSuratTitip(INITIAL_SURAT_TITIP);
    setLaporanTitipLaku(INITIAL_LAPORAN_TITIP_LAKU);
    setBiayaOperasional(INITIAL_BIAYA_OPERASIONAL);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setCashAccounts(INITIAL_CASH_ACCOUNTS);
    setCashMutations(INITIAL_CASH_MUTATIONS);
    setStockOpnameSessions(INITIAL_STOCK_OPNAME_SESSIONS);
    setBankReconciliations(INITIAL_BANK_RECONCILIATIONS);
    setVendors(INITIAL_VENDORS);
    setPurchaseOrders(INITIAL_PURCHASE_ORDERS);
    logAudit('Auth', 'Reset Data Sistem', 'Sistem dikembalikan ke snapshot bawaan awal.');
  };

  const importInitialData = (importedData: any) => {
    if (importedData.series) { seriesRef.current = importedData.series; setSeries(importedData.series); }
    if (importedData.skus) { skusRef.current = importedData.skus; setSkus(importedData.skus); }
    if (importedData.orders) {
      const sorted = [...importedData.orders].sort(orderSortComparator);
      ordersRef.current = sorted;
      setOrders(sorted);
    }
    if (importedData.stockMovements) { stockMovementsRef.current = importedData.stockMovements; setStockMovements(importedData.stockMovements); }
    if (importedData.customers) { customersRef.current = importedData.customers; setCustomers(importedData.customers); }
    if (importedData.resellers) { resellersRef.current = importedData.resellers; setResellers(importedData.resellers); }
    if (importedData.biayaOperasional) { biayaOperasionalRef.current = importedData.biayaOperasional; setBiayaOperasional(importedData.biayaOperasional); }
    if (importedData.cashAccounts) { cashAccountsRef.current = importedData.cashAccounts; setCashAccounts(importedData.cashAccounts); }
    if (importedData.cashMutations) { cashMutationsRef.current = importedData.cashMutations; setCashMutations(importedData.cashMutations); }
    if (importedData.stockOpnameSessions) { stockOpnameSessionsRef.current = importedData.stockOpnameSessions; setStockOpnameSessions(importedData.stockOpnameSessions); }
    if (importedData.bankReconciliations) { bankReconciliationsRef.current = importedData.bankReconciliations; setBankReconciliations(importedData.bankReconciliations); }
    if (importedData.vendors) { vendorsRef.current = importedData.vendors; setVendors(importedData.vendors); }
    if (importedData.purchaseOrders) { purchaseOrdersRef.current = importedData.purchaseOrders; setPurchaseOrders(importedData.purchaseOrders); }
    logAudit('Master Data', 'Impor Data Excel / JSON', 'Data berhasil diimpor ke sistem Kalima.');

    // Direct immediate upload to cloud so imported orders never disappear
    if (importedData.orders || importedData.stockMovements) {
      saveOrdersToCloud(importedData.orders ?? ordersRef.current, importedData.stockMovements ?? stockMovementsRef.current);
    }
    if (importedData.series || importedData.skus || importedData.customers || importedData.resellers) {
      saveMasterToCloud();
    }
    if (importedData.biayaOperasional || importedData.cashAccounts || importedData.cashMutations || importedData.bankReconciliations) {
      saveFinanceToCloud();
    }
    if (importedData.stockOpnameSessions || importedData.vendors || importedData.purchaseOrders) {
      saveOperationsToCloud();
    }
  };

  const contextValue = useMemo(
    () => ({
      currentUser,
      isOwner,
      logout,
      logAudit,
      currentView,
      setCurrentView,
      mobileMenuOpen,
      setMobileMenuOpen,
      quickOrderModalOpen,
      setQuickOrderModalOpen,
      theme,
      setTheme,
      toggleTheme,
      cloudSyncStatus,
      lastSyncedAt,
      syncToCloudNow,
      series,
      skus,
      bomItems,
      channels,
      customers,
      resellers,
      orders,
      stockMovements,
      suratTitip,
      laporanTitipLaku,
      biayaOperasional,
      auditLogs,
      cashAccounts,
      cashMutations,
      stockOpnameSessions,
      bankReconciliations,
      vendors,
      purchaseOrders,
      calculateStock,
      calculateStockSummary,
      getLowStockSKUs,
      addOrder,
      updateOrder,
      deleteOrder,
      requestCancelOrder,
      approveCancelOrder,
      rejectCancelOrder,
      recordPayment,
      addCashAccount,
      updateCashAccount,
      deleteCashAccount,
      recordCashTransaction,
      transferCashAccount,
      saveBankReconciliationSession,
      deleteBankReconciliationSession,
      toggleMutationReconciliation,
      recordRestock,
      recordStockOpname,
      recordBatchStockOpname,
      recordReject,
      createSuratTitip,
      createLaporanTitipLaku,
      recordReturTitip,
      recordSetoranReseller,
      addVendor,
      updateVendor,
      deleteVendor,
      createPurchaseOrder,
      updatePurchaseOrder,
      updatePOShipping,
      receivePOGoods,
      payPurchaseOrder,
      deletePurchaseOrder,
      journalEntries,
      fixedAssets,
      setFixedAssets,
      balanceSheetConfig,
      setBalanceSheetConfig,
      customOpexCategories,
      setCustomOpexCategories,
      recordJournalEntry,
      deleteJournalEntry,
      addBiayaOperasional,
      updateBiayaOperasional,
      deleteBiayaOperasional,
      clearBiayaOperasional,
      updateBOM,
      updateSeries,
      updateSKU,
      addSKU,
      deleteSKU,
      syncAllSkuNames,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      bulkDeleteCustomers,
      syncCustomersFromOrders,
      mergeDuplicateCustomers,
      relinkAndRepairOrders,
      promoteCustomerToReseller,
      addReseller,
      updateReseller,
      deleteReseller,
      resetData,
      importInitialData,
    }),
    [
      currentUser,
      isOwner,
      currentView,
      mobileMenuOpen,
      quickOrderModalOpen,
      theme,
      cloudSyncStatus,
      lastSyncedAt,
      series,
      skus,
      bomItems,
      channels,
      customers,
      resellers,
      orders,
      stockMovements,
      suratTitip,
      laporanTitipLaku,
      biayaOperasional,
      auditLogs,
      cashAccounts,
      cashMutations,
      stockOpnameSessions,
      bankReconciliations,
      vendors,
      purchaseOrders,
      journalEntries,
      fixedAssets,
      balanceSheetConfig,
      customOpexCategories,
      calculateStock,
      calculateStockSummary,
      getLowStockSKUs,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
