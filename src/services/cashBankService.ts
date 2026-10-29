import { CashAccount, CashMutation, Order } from '../types';

export interface ServiceResult {
  success: boolean;
  error?: string;
  updatedAccounts: CashAccount[];
  mutations: CashMutation[];
}

/**
 * Service murni untuk pengelolaan saldo Kas & Bank dan pemotongan/penambahan otomatis.
 */
export const cashBankService = {
  /**
   * Memotong saldo akun kas/bank yang dipilih (Pengeluaran / Debit).
   */
  potongSaldo: (params: {
    cashAccounts: CashAccount[];
    accountId: string;
    jumlah: number;
    kategori: string;
    deskripsi: string;
    referensi?: string;
    tanggal?: string;
    waktu?: string;
    dicatatOleh: string;
  }): ServiceResult => {
    const { cashAccounts, accountId, jumlah, kategori, deskripsi, referensi, tanggal, waktu, dicatatOleh } = params;

    const targetAccount = cashAccounts.find((a) => a.id === accountId);
    if (!targetAccount) {
      return {
        success: false,
        error: `Akun kas/bank tujuan (ID: ${accountId}) tidak ditemukan.`,
        updatedAccounts: cashAccounts,
        mutations: [],
      };
    }

    if (jumlah <= 0) {
      return {
        success: false,
        error: 'Nominal pemotongan harus lebih besar dari 0.',
        updatedAccounts: cashAccounts,
        mutations: [],
      };
    }

    const todayStr = tanggal || new Date().toISOString().split('T')[0];
    const nowTime = waktu || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const newSaldo = targetAccount.saldo - jumlah;

    const updatedAccounts = cashAccounts.map((acc) =>
      acc.id === targetAccount.id ? { ...acc, saldo: newSaldo } : acc
    );

    const mutation: CashMutation = {
      id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tanggal: todayStr,
      waktu: nowTime,
      accountId: targetAccount.id,
      accountNama: targetAccount.nama,
      tipe: 'keluar',
      jumlah,
      kategori,
      deskripsi,
      referensi,
      saldoSetelah: newSaldo,
      dicatatOleh,
    };

    return {
      success: true,
      updatedAccounts,
      mutations: [mutation],
    };
  },

  /**
   * Menambah saldo akun kas/bank yang dipilih (Pemasukan / Kredit).
   */
  tambahSaldo: (params: {
    cashAccounts: CashAccount[];
    accountId: string;
    jumlah: number;
    kategori: string;
    deskripsi: string;
    referensi?: string;
    tanggal?: string;
    waktu?: string;
    dicatatOleh: string;
  }): ServiceResult => {
    const { cashAccounts, accountId, jumlah, kategori, deskripsi, referensi, tanggal, waktu, dicatatOleh } = params;

    const targetAccount = cashAccounts.find((a) => a.id === accountId);
    if (!targetAccount) {
      return {
        success: false,
        error: `Akun kas/bank tujuan (ID: ${accountId}) tidak ditemukan.`,
        updatedAccounts: cashAccounts,
        mutations: [],
      };
    }

    if (jumlah <= 0) {
      return {
        success: false,
        error: 'Nominal penambahan harus lebih besar dari 0.',
        updatedAccounts: cashAccounts,
        mutations: [],
      };
    }

    const todayStr = tanggal || new Date().toISOString().split('T')[0];
    const nowTime = waktu || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const newSaldo = targetAccount.saldo + jumlah;

    const updatedAccounts = cashAccounts.map((acc) =>
      acc.id === targetAccount.id ? { ...acc, saldo: newSaldo } : acc
    );

    const mutation: CashMutation = {
      id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tanggal: todayStr,
      waktu: nowTime,
      accountId: targetAccount.id,
      accountNama: targetAccount.nama,
      tipe: 'masuk',
      jumlah,
      kategori,
      deskripsi,
      referensi,
      saldoSetelah: newSaldo,
      dicatatOleh,
    };

    return {
      success: true,
      updatedAccounts,
      mutations: [mutation],
    };
  },

  /**
   * Service otomatis yang dieksekusi saat transaksi penjualan berhasil disimpan:
   * 1. Menambah saldo akun kas/bank penerimaan jika ada pembayaran diterima (Lunas / DP).
   * 2. Memotong saldo akun kas/bank jika ada biaya ongkir talangan toko atau admin marketplace yang dipotong langsung.
   */
  prosesTransaksiPenjualan: (params: {
    cashAccounts: CashAccount[];
    order: Order;
    paymentAccountId?: string;
    potongOngkirAccountId?: string;
    potongAdminAccountId?: string;
    potongOngkirDariKas?: boolean;
    potongAdminDariKas?: boolean;
    dicatatOleh: string;
  }): ServiceResult => {
    const {
      cashAccounts,
      order,
      paymentAccountId,
      potongOngkirAccountId,
      potongAdminAccountId,
      potongOngkirDariKas,
      potongAdminDariKas,
      dicatatOleh,
    } = params;

    let currentAccounts = [...cashAccounts];
    const allMutations: CashMutation[] = [];

    const defaultAcc = currentAccounts.find((a) => a.isDefault) || currentAccounts[0];

    // 1. Catat Penerimaan Pembayaran Penjualan (jika ada terbayar > 0)
    if (order.totalTerbayar > 0) {
      const targetAccId = paymentAccountId || defaultAcc?.id;
      if (targetAccId) {
        const res = cashBankService.tambahSaldo({
          cashAccounts: currentAccounts,
          accountId: targetAccId,
          jumlah: order.totalTerbayar,
          kategori: 'Penjualan Order',
          deskripsi: `Penerimaan bayar order #${order.noOrder} (${order.channel}) - ${order.customerNama}`,
          referensi: `Order #${order.noOrder}`,
          tanggal: order.tanggal,
          dicatatOleh,
        });

        if (res.success) {
          currentAccounts = res.updatedAccounts;
          allMutations.push(...res.mutations);
        }
      }
    }

    // 2. Potong Saldo untuk Talangan Ongkir Pengiriman (jika opsi dipilih dan ada ongkir)
    if (potongOngkirDariKas && order.ongkir > 0) {
      const targetDeductId = potongOngkirAccountId || paymentAccountId || defaultAcc?.id;
      if (targetDeductId) {
        const res = cashBankService.potongSaldo({
          cashAccounts: currentAccounts,
          accountId: targetDeductId,
          jumlah: order.ongkir,
          kategori: 'Biaya Pengiriman (Ongkir)',
          deskripsi: `Talangan ongkir kirim order #${order.noOrder} ke ${order.customerKota || order.customerNama}`,
          referensi: `Order #${order.noOrder}`,
          tanggal: order.tanggal,
          dicatatOleh,
        });

        if (res.success) {
          currentAccounts = res.updatedAccounts;
          allMutations.push(...res.mutations);
        }
      }
    }

    // 3. Potong Saldo untuk Biaya Admin Marketplace (jika opsi dipilih dan ada biaya admin)
    if (potongAdminDariKas && order.adminFeeAmount > 0) {
      const targetAdminId = potongAdminAccountId || paymentAccountId || defaultAcc?.id;
      if (targetAdminId) {
        const res = cashBankService.potongSaldo({
          cashAccounts: currentAccounts,
          accountId: targetAdminId,
          jumlah: order.adminFeeAmount,
          kategori: 'Biaya Admin Marketplace',
          deskripsi: `Potongan fee marketplace order #${order.noOrder} (${order.channel})`,
          referensi: `Order #${order.noOrder}`,
          tanggal: order.tanggal,
          dicatatOleh,
        });

        if (res.success) {
          currentAccounts = res.updatedAccounts;
          allMutations.push(...res.mutations);
        }
      }
    }

    return {
      success: true,
      updatedAccounts: currentAccounts,
      mutations: allMutations,
    };
  },

  /**
   * Service otomatis pemotongan saldo saat terjadi pembatalan / retur order yang sudah terbayar (Refund).
   */
  prosesRefundPenjualan: (params: {
    cashAccounts: CashAccount[];
    order: Order;
    refundAmount: number;
    accountId?: string;
    alasan?: string;
    dicatatOleh: string;
  }): ServiceResult => {
    const { cashAccounts, order, refundAmount, accountId, alasan, dicatatOleh } = params;

    const targetAccId =
      accountId ||
      cashAccounts.find((a) => a.isDefault)?.id ||
      cashAccounts[0]?.id;

    if (!targetAccId || refundAmount <= 0) {
      return {
        success: false,
        error: 'Akun kas atau nominal refund tidak valid.',
        updatedAccounts: cashAccounts,
        mutations: [],
      };
    }

    return cashBankService.potongSaldo({
      cashAccounts,
      accountId: targetAccId,
      jumlah: refundAmount,
      kategori: 'Refund Pembatalan Penjualan',
      deskripsi: `Pengembalian dana batal order #${order.noOrder} ke ${order.customerNama}${alasan ? ` (${alasan})` : ''}`,
      referensi: `Batal #${order.noOrder}`,
      dicatatOleh,
    });
  },

  /**
   * Service otomatis saat pengeluaran operasional (OPEX) disimpan:
   * Secara otomatis memotong saldo akun kas/bank yang dipilih.
   */
  prosesPengeluaranOpex: (params: {
    cashAccounts: CashAccount[];
    opexId: string;
    kategori: string;
    deskripsi: string;
    jumlah: number;
    accountId: string;
    tanggal?: string;
    dicatatOleh: string;
  }): ServiceResult => {
    const { cashAccounts, opexId, kategori, deskripsi, jumlah, accountId, tanggal, dicatatOleh } = params;

    return cashBankService.potongSaldo({
      cashAccounts,
      accountId,
      jumlah,
      kategori: `Biaya: ${kategori}`,
      deskripsi,
      referensi: `OPEX #${opexId}`,
      tanggal,
      dicatatOleh,
    });
  },
};
